'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type Tienda } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useOpciones } from '@/hooks/use-opciones';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';

/** Panel #merchant-panel → Seguridad y Cuenta (cambio de clave con 2FA + recuperación). */
export default function SeguridadPage({ params }: { params: { id: string } }) {
  const { user, refresh } = useAuth();
  const opciones = useOpciones();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [campoError, setCampoError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pidiendoCodigo, setPidiendoCodigo] = useState(false);
  const [codigoPedido, setCodigoPedido] = useState(false);
  const [destinoCodigo, setDestinoCodigo] = useState<string | null>(null);
  const [recuperando, setRecuperando] = useState(false);

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
  const puedeRecuperar = !!opciones?.recuperarClave && !!user.email && user.tieneClave;

  async function solicitarCodigo() {
    setAviso(null);
    setCampoError(null);
    setPidiendoCodigo(true);
    try {
      const r = await api<{ destino: string; telefono: string | null }>('/auth/password/2fa', {
        method: 'POST',
      });
      setCodigoPedido(true);
      setDestinoCodigo(r.destino);
      setAviso(
        r.telefono
          ? `Código 2FA enviado a ${r.destino} (y aviso al teléfono ${r.telefono}).`
          : `Código 2FA enviado a ${r.destino}.`
      );
    } catch (err) {
      setCampoError(err instanceof ApiError ? err.message : 'No pudimos enviar el código 2FA');
    } finally {
      setPidiendoCodigo(false);
    }
  }

  async function recuperarPorCorreo() {
    if (!user?.email) return;
    setAviso(null);
    setCampoError(null);
    setRecuperando(true);
    try {
      await api('/auth/recuperar', { method: 'POST', body: { email: user.email } });
      setAviso(
        'Te enviamos un enlace para restablecer la contraseña a tu correo. Revisá la bandeja de entrada.'
      );
    } catch (err) {
      setCampoError(err instanceof ApiError ? err.message : 'No pudimos iniciar la recuperación');
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
    const codigo = String(datos.get('codigo2fa') ?? '').trim();

    setAviso(null);
    setCampoError(null);

    if ((!crear && !actual) || !nueva || !codigo) {
      setCampoError('Completá todos los campos y el código 2FA.');
      return;
    }
    if (!/^\d{6}$/.test(codigo)) {
      setCampoError('El código de doble autenticación (2FA) es inválido.');
      return;
    }
    if (nueva.length < 8) {
      setCampoError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== repetir) {
      setCampoError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (!codigoPedido) {
      setCampoError('Primero solicitá el código 2FA.');
      return;
    }

    setEnviando(true);
    try {
      await api('/auth/password', {
        method: 'POST',
        body: { ...(!crear && { actual }), nueva, codigo2fa: codigo },
      });
      form.reset();
      setCodigoPedido(false);
      setDestinoCodigo(null);
      setAviso('¡Contraseña actualizada con éxito mediante doble autenticación!');
      if (crear) await refresh();
    } catch (err) {
      setCampoError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mp-panel mp-seguridad">
      <EncabezadoPanel
        titulo="Seguridad y Cuenta"
        descripcion="Modificá tu contraseña de acceso con autenticación de doble factor (2FA)."
      />

      {aviso && <Alert kind="success">{aviso}</Alert>}
      {campoError && <Alert>{campoError}</Alert>}

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
              ? 'Solo Google — creá una contraseña con 2FA'
              : user.conGoogle
                ? 'Contraseña y Google'
                : 'Contraseña'}
          </strong>
        </div>
      </div>

      <div className="mp-bloque mp-seguridad-form">
        <h3>
          {crear
            ? 'Crear Contraseña con Doble Autenticación (2FA)'
            : 'Cambiar Contraseña con Doble Autenticación (2FA)'}
        </h3>

        <form className="mp-form-seguridad" onSubmit={onSubmit} noValidate>
          {!crear && (
            <label className="mp-label">
              Contraseña Actual *
              <input type="password" name="actual" autoComplete="current-password" required />
            </label>
          )}

          <label className="mp-label">
            Nueva Contraseña *
            <input type="password" name="nueva" autoComplete="new-password" required minLength={8} />
          </label>

          <label className="mp-label">
            Confirmar Nueva Contraseña *
            <input type="password" name="repetir" autoComplete="new-password" required minLength={8} />
          </label>

          <label className="mp-label">
            Código de Doble Autenticación (2FA - SMS / Email) *
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
              <button
                type="button"
                className="mp-btn-secundario"
                onClick={solicitarCodigo}
                disabled={pidiendoCodigo || enviando}
              >
                {pidiendoCodigo ? 'Enviando…' : 'Solicitar Código'}
              </button>
            </div>
            {codigoPedido && destinoCodigo && (
              <span className="mp-2fa-hint">
                Ingresá el código de 6 dígitos enviado a {destinoCodigo}. Vence en 10 minutos.
              </span>
            )}
          </label>

          <button type="submit" className="mp-btn-editar mp-btn-seguridad" disabled={enviando}>
            {enviando ? 'Actualizando…' : 'Actualizar Contraseña de Forma Segura'}
          </button>
        </form>
      </div>

      {puedeRecuperar && (
        <div className="mp-bloque mp-seguridad-recuperar">
          <h3>¿Olvidaste tu contraseña?</h3>
          <p>
            Te enviamos un enlace a <strong>{user.email}</strong> para elegir una contraseña nueva sin usar la actual.
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

      <p className="mp-seguridad-pie">
        <Link href="/cuenta">
          Ir a Mi cuenta completa <Icon name="arrow-right" size={14} />
        </Link>
      </p>
    </section>
  );
}
