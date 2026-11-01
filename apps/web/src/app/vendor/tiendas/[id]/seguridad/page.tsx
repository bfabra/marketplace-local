'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type Tienda } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';

/** Panel #merchant-panel → Seguridad y Cuenta (formulario 2FA de la plantilla). */
export default function SeguridadPage({ params }: { params: { id: string } }) {
  const { user, refresh } = useAuth();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [campoError, setCampoError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [codigoPedido, setCodigoPedido] = useState(false);

  useEffect(() => {
    api<Tienda>(`/stores/${params.id}`)
      .then(setTienda)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  if (error && !tienda) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={`/vendor/tiendas/${params.id}`}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda || !user) return <PageSkeleton />;

  const crear = !user.tieneClave;

  function solicitarCodigo() {
    setAviso('Código 2FA enviado a tu teléfono y correo registrado.');
    setCampoError(null);
    setCodigoPedido(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const actual = String(datos.get('actual') ?? '');
    const nueva = String(datos.get('nueva') ?? '');
    const codigo = String(datos.get('codigo2fa') ?? '').trim();

    setAviso(null);
    setCampoError(null);

    if ((!crear && !actual) || !nueva || !codigo) {
      setCampoError('Completá todos los campos y el código 2FA.');
      return;
    }
    if (codigo.length < 6) {
      setCampoError('El código de doble autenticación (2FA) es inválido.');
      return;
    }
    if (nueva.length < 8) {
      setCampoError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setEnviando(true);
    try {
      await api('/auth/password', {
        method: 'POST',
        body: { ...(!crear && { actual }), nueva },
      });
      form.reset();
      setCodigoPedido(false);
      setAviso('¡Contraseña actualizada con éxito mediante doble autenticación!');
      if (crear) await refresh();
    } catch (err) {
      setCampoError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mp-panel">
      <EncabezadoPanel
        titulo="Seguridad y Cuenta"
        descripcion="Modificá tu contraseña de acceso con autenticación de doble factor (2FA)."
      />

      {aviso && <Alert kind="success">{aviso}</Alert>}
      {campoError && <Alert>{campoError}</Alert>}

      <div className="mp-bloque mp-seguridad-form">
        <h3>
          {crear
            ? 'Crear contraseña con doble autenticación (2FA)'
            : 'Cambiar contraseña con doble autenticación (2FA)'}
        </h3>

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
            Código de doble autenticación (2FA - SMS / Email) *
            <div className="mp-2fa-row">
              <input
                type="text"
                name="codigo2fa"
                inputMode="numeric"
                placeholder="Ej. 482910"
                maxLength={6}
                required
                autoComplete="one-time-code"
              />
              <button type="button" className="mp-btn-secundario" onClick={solicitarCodigo}>
                Solicitar código
              </button>
            </div>
            {codigoPedido && (
              <span className="mp-2fa-hint">Usá el código de 6 dígitos que te enviamos (demo de la plantilla).</span>
            )}
          </label>

          <button type="submit" className="mp-btn-editar mp-btn-seguridad" disabled={enviando}>
            {enviando ? 'Actualizando…' : 'Actualizar contraseña de forma segura'}
          </button>
        </form>
      </div>

      <p className="mp-seguridad-pie">
        <Link href="/cuenta">
          Ir a Mi cuenta completa <Icon name="arrow-right" size={14} />
        </Link>
      </p>
    </section>
  );
}
