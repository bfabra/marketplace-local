'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type EstadoPedidoTienda, type Modalidad, type Pedido } from '@/lib/api-client';
import { formatDate, formatPrice } from '@/lib/utils';
import { COLOR_PAGO, ESTADO_PAGO, ESTADO_PEDIDO, MODALIDAD } from '@/lib/pedidos';
import { Alert } from '@/components/ui/alert';
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina';
import { Icon } from '@/components/ui/icon';
import { OrderStatus } from '@/components/ui/order-status';
import { PageSkeleton } from '@/components/ui/skeleton';

const hora = (fecha: string) =>
  new Date(fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const PASOS: Record<Modalidad, string[]> = {
  entrega_plataforma: ['Pagado', 'En preparación', 'En camino', 'Entregado'],
  retiro_en_local: ['Pagado', 'En preparación', 'Listo para retirar', 'Entregado'],
};

/** Cuántos pasos de la barra de seguimiento ya se cumplieron. */
const AVANCE: Partial<Record<EstadoPedidoTienda, number>> = {
  pendiente: 0,
  pago_confirmado: 1,
  en_preparacion: 2,
  listo_para_recoleccion: 2,
  listo_para_retiro: 3,
  recolectado: 3,
  en_camino: 3,
  entregado: 4,
};

function Seguimiento({ modalidad, estado }: { modalidad: Modalidad; estado: EstadoPedidoTienda }) {
  const avance = AVANCE[estado];
  if (avance === undefined) return null;
  return (
    <ol className="seguimiento" aria-label="Avance del pedido">
      {PASOS[modalidad].map((paso, i) => {
        const hecho = i < avance;
        const actual = i === avance - 1;
        return (
          <li
            key={paso}
            className={hecho ? 'seguimiento-paso seguimiento-hecho' : 'seguimiento-paso'}
            aria-current={actual ? 'step' : undefined}
          >
            <span className="seguimiento-punto" aria-hidden="true">
              {hecho ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className="seguimiento-texto">{paso}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function MyOrderPage({ params }: { params: { id: string } }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recienPagado, setRecienPagado] = useState(false);

  useEffect(() => {
    setRecienPagado(new URLSearchParams(window.location.search).get('pago') === 'aprobado');
    api<Pedido>(`/orders/${params.id}`)
      .then(setPedido)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  if (error && !pedido) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href="/mis-compras">Volver a mis compras</Link>
      </div>
    );
  }
  if (!pedido) return <PageSkeleton />;

  const dir = pedido.direccion_envio;

  return (
    <div className="market-container market-page compra-detalle-page">
      <nav className="cuenta-breadcrumb" aria-label="Navegación">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">›</span>
        <Link href="/mis-compras">Mis compras</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Pedido #{pedido.numero}</span>
      </nav>

      <EncabezadoPagina
        icono="receipt"
        antetitulo={formatDate(pedido.creado_en)}
        titulo={`Pedido #${pedido.numero}`}
        descripcion={
          <span className={`badge ${COLOR_PAGO[pedido.estado_pago]}`}>{ESTADO_PAGO[pedido.estado_pago]}</span>
        }
      >
        {pedido.estado_pago === 'pendiente' && (
          <Link href={`/pago-simulado/${pedido.id}`} className="btn btn-accent">
            <Icon name="card" size={16} /> Pagar {formatPrice(pedido.total)}
          </Link>
        )}
      </EncabezadoPagina>

      {recienPagado && pedido.estado_pago === 'aprobado' && (
        <Alert kind="success">¡Listo! Recibimos tu pago. Cada tienda ya está al tanto de tu pedido.</Alert>
      )}
      {pedido.estado_pago === 'pendiente' && pedido.reservaHasta && (
        <Alert kind="info">
          Tenés el stock reservado hasta las{' '}
          {new Date(pedido.reservaHasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </Alert>
      )}

      <div className="compra-detalle">
        <div className="stack">
          {pedido.partes.map((p) => (
            <section key={p.id} className="card stack">
              <div className="tarjeta-cabecera">
                <span className="icono-suave" aria-hidden="true">
                  <Icon name="store" size={20} />
                </span>
                <div>
                  <h2>
                    {p.tienda ? <Link href={`/tiendas/${p.tienda.slug}`}>{p.tienda.nombre}</Link> : 'Tienda'}
                  </h2>
                  <p>{MODALIDAD[p.modalidad]}</p>
                </div>
                <OrderStatus estado={p.estado} />
              </div>

              <Seguimiento modalidad={p.modalidad} estado={p.estado} />

              {p.modalidad === 'retiro_en_local' && p.tienda && (
                <div className={p.estado === 'listo_para_retiro' ? 'aviso-banda compra-retiro-listo' : 'aviso-banda'}>
                  <Icon name="pin" size={18} />
                  <span>
                    {p.estado === 'listo_para_retiro' ? 'Ya podés pasar a retirarlo' : 'Lo retirás'} en{' '}
                    <strong>
                      {p.tienda.direccion}, {p.tienda.localidad}
                    </strong>
                    {p.tienda.telefono ? ` · Tel. ${p.tienda.telefono}` : ''}.
                  </span>
                </div>
              )}
              {p.motivo_cancelacion && (
                <Alert kind="info">
                  Motivo de la cancelación: {p.motivo_cancelacion}
                  {['aprobado', 'reembolsado_parcial', 'reembolsado'].includes(pedido.estado_pago)
                    ? '. Te devolvemos el dinero de esta parte.'
                    : ''}
                </Alert>
              )}

              <ul className="compra-items">
                {p.items.map((i, n) => (
                  <li key={n}>
                    <span className="compra-item-cantidad">{i.cantidad}×</span>
                    <span className="compra-item-nombre">
                      <strong>{i.nombre}</strong>
                      {i.variante && <span className="muted">{i.variante}</span>}
                    </span>
                    <span className="compra-item-precio">
                      <strong>{formatPrice(i.subtotal)}</strong>
                      {i.cantidad > 1 && <span className="muted">{formatPrice(i.precio)} c/u</span>}
                    </span>
                  </li>
                ))}
              </ul>

              {(p.historial ?? []).length > 0 && (
                <details className="compra-historial">
                  <summary>
                    <Icon name="history" size={16} /> Ver todos los movimientos
                  </summary>
                  <ol className="historial">
                    {(p.historial ?? []).map((h, n) => (
                      <li key={n}>
                        <time className="muted" dateTime={h.fecha}>
                          {hora(h.fecha)}
                        </time>
                        <p>{ESTADO_PEDIDO[h.estado]}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </section>
          ))}
        </div>

        <aside className="card stack compra-resumen">
          <div className="tarjeta-cabecera">
            <span className="icono-suave" aria-hidden="true">
              <Icon name="receipt" size={20} />
            </span>
            <div>
              <h2>Resumen</h2>
              <p>{pedido.partes.length === 1 ? '1 tienda' : `${pedido.partes.length} tiendas`}</p>
            </div>
          </div>
          {dir && (
            <div className="compra-entrega">
              <Icon name="pin" size={18} />
              <div>
                <strong>Entrega en</strong>
                <span>
                  {dir.calle} {dir.numero}
                  {dir.piso_depto ? `, ${dir.piso_depto}` : ''}
                </span>
                <span className="muted">
                  {dir.localidad}, {dir.provincia}
                </span>
              </div>
            </div>
          )}
          <dl className="compra-montos">
            <div>
              <dt>Productos</dt>
              <dd>{formatPrice(pedido.subtotal)}</dd>
            </div>
            <div>
              <dt>Envío</dt>
              <dd>{pedido.costo_envio > 0 ? formatPrice(pedido.costo_envio) : 'Sin costo'}</dd>
            </div>
            <div className="compra-montos-total">
              <dt>Total</dt>
              <dd>{formatPrice(pedido.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
