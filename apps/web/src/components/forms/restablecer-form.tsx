'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/ui/icon';
import { useFormErrors } from './use-form-errors';
import { AvisoDisenio, CampoDisenio } from './campo-disenio';
import { MarcoCuenta } from './recuperar-form';

/** Llega desde el enlace del correo: elegir una contraseña nueva. */
export function RestablecerForm() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const errors = useFormErrors();
  const [valido, setValido] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!/^[0-9a-f]{64}$/i.test(token)) {
      setValido(false);
      return;
    }
    api<{ valido: boolean }>(`/auth/recuperar/${token}`).then(
      (r) => setValido(r.valido),
      () => setValido(false)
    );
  }, [token]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    errors.clear();
    if (form.get('password') !== form.get('repetir')) {
      errors.field('repetir', 'Las contraseñas no coinciden');
      return;
    }
    setSending(true);
    try {
      const { email } = await api<{ email: string | null }>('/auth/restablecer', {
        method: 'POST',
        body: { token, password: String(form.get('password')) },
      });
      router.replace(`/login?restablecida=1${email ? `&email=${encodeURIComponent(email)}` : ''}`);
    } catch (error) {
      errors.set(error);
      setSending(false);
    }
  }

  if (valido === null) {
    return (
      <MarcoCuenta>
        <p className="cuenta-cargando" role="status">
          <span className="spinner" /> Revisando el enlace…
        </p>
      </MarcoCuenta>
    );
  }

  if (!valido) {
    return (
      <MarcoCuenta>
        <div className="cuenta-icono error" aria-hidden="true">
          <Icon name="alert" size={28} />
        </div>
        <div className="form-heading centered">
          <span>ENLACE VENCIDO</span>
          <h2>Este enlace ya no sirve</h2>
          <p>Los enlaces para cambiar la contraseña valen una hora y se usan una sola vez. Pedí uno nuevo y usá el último que te llegue.</p>
        </div>
        <div className="stack-actions">
          <Link href="/recuperar" className="ds-btn primary">
            Pedir un enlace nuevo
          </Link>
          <Link href="/login" className="ds-btn secondary">
            Volver a iniciar sesión
          </Link>
        </div>
      </MarcoCuenta>
    );
  }

  return (
    <MarcoCuenta>
      {errors.message && <AvisoDisenio titulo="No pudimos cambiar la contraseña">{errors.message}</AvisoDisenio>}
      <div className="form-heading centered">
        <span>CONTRASEÑA NUEVA</span>
        <h2>Elegí tu nueva contraseña</h2>
        <p>Al guardarla, se cierran las sesiones abiertas en otros dispositivos.</p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <CampoDisenio
          label="Contraseña nueva"
          name="password"
          type="password"
          icono="lock"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          required
          error={errors.fields.password}
        />
        <CampoDisenio
          label="Repetir contraseña"
          name="repetir"
          type="password"
          icono="lock"
          placeholder="Ingresala nuevamente"
          autoComplete="new-password"
          required
          error={errors.fields.repetir}
        />
        <button className="ds-btn primary" type="submit" disabled={sending}>
          {sending ? (
            <>
              <span className="spinner" /> Guardando…
            </>
          ) : (
            <>
              Guardar contraseña <Icon name="arrow-right" size={17} />
            </>
          )}
        </button>
      </form>
    </MarcoCuenta>
  );
}
