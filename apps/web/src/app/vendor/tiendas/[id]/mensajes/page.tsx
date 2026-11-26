'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Tienda } from '@/lib/api-client';
import { Alert } from '@/components/ui/alert';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';

/**
 * Panel #merchant-panel → Mensajes y Consultas (merchant.js renderChatTab).
 * UX del inbox alineada a la maqueta; sin backend de chat todavía (CAMBIOS.md).
 */
export default function MensajesPage({ params }: { params: { id: string } }) {
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <EncabezadoPanel
        titulo={`Mensajes y Consultas de Clientes — ${tienda.nombre}`}
        descripcion="Respondé en tiempo real a las consultas enviadas por los usuarios desde su perfil de tienda."
      />

      {error && <Alert>{error}</Alert>}

      <div className="mp-mensajes-caja">
        <aside className="mp-mensajes-lista">
          <div className="mp-mensajes-lista-cabecera">CONVERSACIONES ACTIVAS (0)</div>
          <div className="mp-mensajes-vacio">
            <strong>Sin consultas por ahora</strong>
            <p>Cuando un cliente te escriba desde el perfil de tu tienda, la conversación aparece acá.</p>
          </div>
        </aside>

        <div className="mp-mensajes-pane">
          <div className="mp-mensajes-pane-cabecera">
            <div className="mp-mensajes-pane-titulo">
              <span className="mp-mensajes-back">← CONVERSACIONES ACTIVAS</span>
              <strong className="mp-mensajes-chat-con">Chat con: —</strong>
            </div>
            <span className="mp-mensajes-online">En línea</span>
          </div>

          <div className="mp-mensajes-hilo">
            <p className="mp-mensajes-hilo-vacio">Seleccioná una conversación para ver los mensajes.</p>
          </div>

          <form
            className="mp-mensajes-composer"
            onSubmit={(e) => e.preventDefault()}
            aria-label="Responder consulta"
          >
            <input
              type="text"
              name="message"
              placeholder="Escribí tu respuesta como comerciante..."
              autoComplete="off"
              disabled
              aria-disabled="true"
            />
            <button type="submit" className="mp-mensajes-enviar" disabled>
              Responder
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
