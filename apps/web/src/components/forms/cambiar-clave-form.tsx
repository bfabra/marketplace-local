'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useOpciones } from '@/hooks/use-opciones';
import { Alert } from '@/components/ui/alert';

/** Crear / cambiar contraseña sin 2FA (clave actual + nueva + recuperación por correo). */
export function CambiarClaveForm({
  user,
  className,
}: {
  user: Usuario;
  className?: string;
}) {
  const { refresh } = useAuth();
  const opciones = useOpciones();
  const crear = !user.tieneClave;
  const puedeRecuperar = !!opciones?.recuperarClave && !!user.email && user.tieneClave;
  const [enviando, setEnviando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function recuperarPorCorreo() {
    if (!user.email) return;
    setAviso(null);
    setError(null);
    setRecuperando(true);
    try {
      await api('/auth/recuperar', { method: 'POST', body: { email: user.email } });
      setAviso(
        'Te enviamos un enlace para restablecer la contraseña a tu correo. Revisá la bandeja de entrada.'
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos iniciar la recuperación');
    } finally {
      setRecuperando(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const actual = String(datos.get('actual') ?? '');
    const nueva = String(datos.get('nueva') ?? '');
    const repetir = String(datos.get('repetir') ?? '');

    setAviso(null);
    setError(null);

    if ((!crear && !actual) || !nueva) {
      setError('Completá todos los campos.');
      return;
    }
    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== repetir) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setEnviando(true);
    try {
      await api('/auth/password', {
        method: 'POST',
        body: { ...(!crear && { actual }), nueva },
      });
      form.reset();
      setAviso(crear ? 'Contraseña creada. Ya podés ingresar también con correo.' : 'Contraseña actualizada.');
      if (crear) await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={className}>
      {aviso && <Alert kind="success">{aviso}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="mp-seguridad-cuenta">
        <div className="mp-seguridad-cuenta-dato">
          <span>Cuenta</span>
          <strong>{user.email || 'Sin correo'}</strong>
        </div>
        {user.telefono && (
          <div className="mp-seguridad-cuenta-dato">
            <span>Teléfono</span>
            <strong>{user.telefono}</strong>
          </div>
        )}
        <div className="mp-seguridad-cuenta-dato">
          <span>Acceso</span>
          <strong>
            {crear
              ? 'Solo Google — podés crear una contraseña'
              : user.conGoogle
                ? 'Contraseña y Google'
                : 'Contraseña'}
          </strong>
        </div>
      </div>

      <div className="mp-bloque mp-seguridad-form">
        <h3>{crear ? 'Crear contraseña' : 'Cambiar contraseña'}</h3>
        <form className="mp-form-seguridad" onSubmit={onSubmit} noValidate>
          {!crear && (
            <label className="mp-label">
              Contraseña actual *
              <input type="password" name="actual" autoComplete="current-password" required />
            </label>
          )}
          <label className="mp-label">
            Nueva contraseña *
            <input type="password" name="nueva" autoComplete="new-password" required minLength={8} />
          </label>
          <label className="mp-label">
            Confirmar nueva contraseña *
            <input type="password" name="repetir" autoComplete="new-password" required minLength={8} />
          </label>
          <button type="submit" className="mp-btn-editar mp-btn-seguridad" disabled={enviando}>
            {enviando ? 'Guardando…' : crear ? 'Crear contraseña' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>

      {puedeRecuperar && (
        <div className="mp-bloque mp-seguridad-recuperar">
          <h3>¿Olvidaste tu contraseña?</h3>
          <p>
            Te enviamos un enlace a <strong>{user.email}</strong> para elegir una contraseña nueva sin usar la
            actual.
          </p>
          <button
            type="button"
            className="mp-btn-secundario"
            onClick={recuperarPorCorreo}
            disabled={recuperando || enviando}
          >
            {recuperando ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}
          </button>
          <p className="mp-seguridad-recuperar-alt">
            También podés hacerlo desde{' '}
            <Link href="/recuperar" className="text-link">
              Recuperar contraseña
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
