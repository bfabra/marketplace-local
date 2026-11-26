'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Tienda } from '@/lib/api-client';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';

/** Panel #merchant-panel → Mensajes y Consultas (maqueta merchant.js). */
export default function MensajesPage({ params }: { params: { id: string } }) {
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');

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
  if (!tienda) return <PageSkeleton />;

  return (
    <section className="mp-panel mp-mensajes">
      <header className="mp-panel-cabecera">
        <div>
          <h2>Mensajes y Consultas de Clientes — {tienda.nombre}</h2>
          <p className="mp-panel-perfil-desc">
            Respondé en tiempo real a las consultas enviadas por los usuarios desde el perfil de tu tienda.
          </p>
        </div>
      </header>

      <div className="mp-mensajes-caja" role="status">
        <aside className="mp-mensajes-lista">
          <div className="mp-mensajes-lista-cabecera">CONVERSACIONES ACTIVAS (0)</div>
          <div className="mp-mensajes-vacio">
            <Icon name="message" size={22} />
            <strong>Sin consultas por ahora</strong>
            <p>Cuando un cliente te escriba desde tu tienda pública, la conversación aparece acá.</p>
          </div>
        </aside>

        <div className="mp-mensajes-pane">
          <div className="mp-mensajes-pane-cabecera">
            <strong>Seleccioná un chat</strong>
            <span className="mp-mensajes-online">En línea</span>
          </div>
          <div className="mp-mensajes-hilo">
            <div className="mp-msg mp-msg-cliente">
              <p>Hola, ¿tienen stock de este producto?</p>
              <time>Ejemplo · vista previa</time>
            </div>
            <div className="mp-msg mp-msg-tienda">
              <p>¡Hola! Sí, te confirmamos disponibilidad en el local.</p>
              <time>Ejemplo · vista previa</time>
            </div>
            <p className="mp-mensajes-hint muted">
              Las burbujas de arriba son de ejemplo. Las consultas reales van a aparecer cuando el chat esté
              conectado.
            </p>
          </div>
          <form
            className="mp-mensajes-composer"
            onSubmit={(e) => {
              e.preventDefault();
              setBorrador('');
            }}
          >
            <input
              type="text"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="Escribí tu respuesta…"
              aria-label="Mensaje de respuesta"
              disabled
            />
            <button type="submit" className="mp-btn-editar" disabled>
              Responder
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
