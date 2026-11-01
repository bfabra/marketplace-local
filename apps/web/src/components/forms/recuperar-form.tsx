'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useOpciones } from '@/hooks/use-opciones';
import { Icon } from '@/components/ui/icon';
import { BRAND_NAME } from '@/components/layout/logo';
import { useFormErrors } from './use-form-errors';
import { AvisoDisenio, CampoDisenio } from './campo-disenio';

/** Marco de las pantallas de cuenta sin el panel lateral (registro, recuperar contraseña). */
export function MarcoCuenta({ children }: { children: ReactNode }) {
  return (
    <div className="centered-screen">
      <div className="simple-header">
        <Link href="/" className="official-logo" aria-label={`${BRAND_NAME}, ir al inicio`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logos/Negativo_logo_h_w.svg" width={250} height={31} alt="" />
        </Link>
        <span>
          ¿Te acordaste? <Link href="/login">Iniciar sesión</Link>
        </span>
      </div>
      <main className="signup-shell cuenta-shell">{children}</main>
    </div>
  );
}

/** "¿Olvidaste tu contraseña?": manda un enlace por correo para elegir una nueva. */
export function RecuperarForm() {
  const params = useSearchParams();
  const opciones = useOpciones();
  const errors = useFormErrors();
  const [sending, setSending] = useState(false);
  const [enviadoA, setEnviadoA] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    errors.clear();
    setSending(true);
    try {
      await api('/auth/recuperar', { method: 'POST', body: { email } });
      setEnviadoA(email);
    } catch (error) {
      errors.set(error);
    } finally {
      setSending(false);
    }
  }

  if (enviadoA) {
    return (
      <MarcoCuenta>
        <div className="cuenta-icono" aria-hidden="true">
          <Icon name="mail" size={28} />
        </div>
        <div className="form-heading centered">
          <span>REVISÁ TU CORREO</span>
          <h2>Te mandamos un enlace</h2>
          <p>
            Si <strong>{enviadoA}</strong> tiene una cuenta en {BRAND_NAME}, en unos minutos te llega un correo para elegir una
            contraseña nueva. El enlace vale una hora.
          </p>
        </div>
        <div className="account-note">
          <Icon name="info" size={17} />
          <p>¿No lo encontrás? Mirá en correo no deseado o promociones. Si pasaron unos minutos, podés pedir otro.</p>
        </div>
        <div className="stack-actions">
          <Link href={`/login?email=${encodeURIComponent(enviadoA)}`} className="ds-btn primary">
            Volver a iniciar sesión
          </Link>
          <button type="button" className="ds-btn secondary" onClick={() => setEnviadoA(null)}>
            Pedir otro enlace
          </button>
        </div>
      </MarcoCuenta>
    );
  }

  return (
    <MarcoCuenta>
      {opciones && !opciones.recuperarClave && (
        <AvisoDisenio titulo="Todavía no está disponible">
          La recuperación por correo no está habilitada en este momento. Pedile ayuda al equipo de {BRAND_NAME}.
        </AvisoDisenio>
      )}
      {errors.message && <AvisoDisenio titulo="No pudimos mandar el correo">{errors.message}</AvisoDisenio>}
      <div className="form-heading centered">
        <span>RECUPERÁ TU CUENTA</span>
        <h2>¿Olvidaste tu contraseña?</h2>
        <p>Escribí el correo con el que te registraste y te mandamos un enlace para elegir una nueva.</p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <CampoDisenio
          label="Correo electrónico"
          name="email"
          type="email"
          icono="mail"
          placeholder="nombre@correo.com"
          autoComplete="email"
          defaultValue={params.get('email') ?? undefined}
          required
          error={errors.fields.email}
        />
        <button className="ds-btn primary" type="submit" disabled={sending || opciones?.recuperarClave === false}>
          {sending ? (
            <>
              <span className="spinner" /> Enviando…
            </>
          ) : (
            <>
              Mandarme el enlace <Icon name="arrow-right" size={17} />
            </>
          )}
        </button>
      </form>
    </MarcoCuenta>
  );
}
