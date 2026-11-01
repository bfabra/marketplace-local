'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { useFormErrors } from './use-form-errors';

/** Cambiar la contraseña; quien entró solo con Google la crea sin escribir la actual. */
export function PasswordForm() {
  const { user, refresh } = useAuth();
  const errors = useFormErrors();
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const crear = user?.tieneClave === false;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    errors.clear();
    setSaved(false);

    if (form.get('nueva') !== form.get('repetir')) {
      errors.field('repetir', 'Las contraseñas no coinciden');
      return;
    }

    setSending(true);
    try {
      await api('/auth/password', {
        method: 'POST',
        body: { ...(!crear && { actual: String(form.get('actual')) }), nueva: String(form.get('nueva')) },
      });
      formEl.reset();
      setSaved(true);
      if (crear) await refresh();
    } catch (error) {
      errors.set(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card form form-plain" onSubmit={onSubmit} noValidate>
      <div className="tarjeta-cabecera">
        <span className="icono-suave" aria-hidden="true">
          <Icon name="lock" size={20} />
        </span>
        <div>
          <h2>{crear ? 'Crear una contraseña' : 'Cambiar contraseña'}</h2>
          <p>
            {crear
              ? 'Entrás con Google. Si creás una contraseña, también podés ingresar con tu correo.'
              : 'Usá al menos 8 caracteres. Se cierran las sesiones en otros dispositivos.'}
          </p>
        </div>
      </div>
      {errors.message && <Alert>{errors.message}</Alert>}
      {saved && <Alert kind="success">{crear ? 'Contraseña creada' : 'Contraseña actualizada'}</Alert>}
      {!crear && (
        <Field label="Contraseña actual" name="actual" type="password" autoComplete="current-password" error={errors.fields.actual} />
      )}
      <Field label="Contraseña nueva (mínimo 8 caracteres)" name="nueva" type="password" autoComplete="new-password" error={errors.fields.nueva} />
      <Field label="Repetí la contraseña nueva" name="repetir" type="password" autoComplete="new-password" error={errors.fields.repetir} />
      <button className="btn" type="submit" disabled={sending}>
        {sending ? 'Guardando…' : crear ? 'Crear contraseña' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
