'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type Pedido } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatPrice } from '@/lib/utils';
import { COLOR_PAGO, ESTADO_PAGO, ESTADO_PEDIDO, MODALIDAD } from '@/lib/pedidos';
import { PRODUCT_NAME } from '@/components/layout/logo';
import { Alert } from '@/components/ui/alert';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';

function expiraTicket(creadoEn: string) {
  const d = new Date(creadoEn);
  d.setFullYear(d.getFullYear() + 1);
  return formatDate(d.toISOString());
}

/** Detalle del ticket (#profile → purchase detail). */
export default function MyOrderPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recienPagado, setRecienPagado] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=/mis-compras/${params.id}`);
  }, [loading, user, router, params.id]);

  useEffect(() => {
    setRecienPagado(new URLSearchParams(window.location.search).get('pago') === 'aprobado');
    api<Pedido>(`/orders/${params.id}`)
      .then(setPedido)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  if (loading || !user) return <PageSkeleton />;

  if (error && !pedido) {
    return (
      <CuentaShell user={user} titulo="Detalle del Ticket" descripcion="No pudimos cargar este comprobante.">
        <Alert>{error}</Alert>
        <Link href="/mis-compras" className="cuenta-ticket-volver">
          ‹ Volver
        </Link>
      </CuentaShell>
    );
  }

  if (!pedido) return <PageSkeleton />;

  const dir = pedido.direccion_envio;
  const comercio =
    [...new Set(pedido.partes.map((p) => p.tienda?.nombre).filter(Boolean))].join(', ') || 'Comercio';
  const estadoLabel = ESTADO_PAGO[pedido.estado_pago];

  return (
    <CuentaShell
      user={user}
      titulo={`Detalle del Ticket #${pedido.numero}`}
      descripcion={`Comprobante de tu compra en ${PRODUCT_NAME} San Juan.`}
    >
      <div className="cuenta-ticket-detalle">
        <div className="cuenta-ticket-detalle-cabecera">
          <Link href="/mis-compras" className="cuenta-ticket-volver">
            ‹ Volver
          </Link>
          <span className={`badge ${COLOR_PAGO[pedido.estado_pago]}`}>{estadoLabel}</span>
        </div>

        {recienPagado && pedido.estado_pago === 'aprobado' && (
          <Alert kind="success">¡Listo! Recibimos tu pago. Cada tienda ya está al tanto de tu pedido.</Alert>
        )}
        {pedido.estado_pago === 'pendiente' && (
          <div className="cuenta-ticket-pagar">
            <Link href={`/pago-simulado/${pedido.id}`} className="market-primary-button">
              Pagar {formatPrice(pedido.total)}
            </Link>
          </div>
        )}

        <div className="cuenta-ticket-cuerpo">
          <div className="cuenta-ticket-meta">
            <div>
              <span>Comercio Vendedor</span>
              <strong>{comercio}</strong>
            </div>
            <div>
              <span>Fecha de Emisión</span>
              <strong>{formatDate(pedido.creado_en)}</strong>
            </div>
            <div>
              <span>Expiración del Ticket</span>
              <strong>{expiraTicket(pedido.creado_en)}</strong>
            </div>
          </div>

          {pedido.partes.map((p) => (
            <div key={p.id} className="cuenta-ticket-bloque">
              <div className="cuenta-ticket-bloque-cabecera">
                <strong>{p.tienda?.nombre ?? 'Tienda'}</strong>
                <em>
                  {MODALIDAD[p.modalidad]} · {ESTADO_PEDIDO[p.estado]}
                </em>
              </div>
              <span className="cuenta-ticket-etiqueta">Productos Adquiridos</span>
              <ul className="cuenta-ticket-items">
                {p.items.map((i, n) => (
                  <li key={n}>
                    <div>
                      <strong>{i.nombre}</strong>
                      <span>
                        Cantidad: {i.cantidad}
                        {i.variante ? ` · ${i.variante}` : ''}
                      </span>
                    </div>
                    <strong>{formatPrice(i.subtotal)}</strong>
                  </li>
                ))}
              </ul>
              {p.motivo_cancelacion && (
                <Alert kind="info">Motivo de la cancelación: {p.motivo_cancelacion}</Alert>
              )}
            </div>
          ))}

          <div className="cuenta-ticket-montos">
            <div>
              <span>Subtotal Productos:</span>
              <span>{formatPrice(pedido.subtotal)}</span>
            </div>
            <div>
              <span>Costo de Envío Local:</span>
              <span>{pedido.costo_envio > 0 ? formatPrice(pedido.costo_envio) : 'Sin costo'}</span>
            </div>
            <div className="cuenta-ticket-montos-total">
              <span>Total Abonado:</span>
              <span>{formatPrice(pedido.total)}</span>
            </div>
          </div>

          <div className="cuenta-ticket-pie">
            <div>
              <strong>Método de pago:</strong> {estadoLabel}
            </div>
            {dir && (
              <div>
                <strong>Dirección de entrega:</strong> {dir.calle} {dir.numero}
                {dir.piso_depto ? `, ${dir.piso_depto}` : ''}, {dir.localidad}, {dir.provincia}
                {dir.referencias ? ` — ${dir.referencias}` : ''}
              </div>
            )}
          </div>

          <div className="cuenta-ticket-opiniones">
            <div>
              <strong>¿Recibiste tu pedido? Compartí tu experiencia</strong>
              <span>Tus opiniones verificadas impulsan el prestigio de los comercios locales.</span>
            </div>
            <div className="cuenta-ticket-opiniones-btns">
              <button type="button" disabled title="Próximamente">
                ★ Opinar sobre el producto
              </button>
              <button type="button" disabled title="Próximamente">
                ★ Valorar atención del comercio
              </button>
            </div>
          </div>
        </div>
      </div>
    </CuentaShell>
  );
}
