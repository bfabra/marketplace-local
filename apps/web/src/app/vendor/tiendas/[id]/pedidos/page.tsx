'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type EstadoPedidoTienda, type Tienda, type Venta } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import {
  ACCION_COMERCIO,
  aplicarEstadoEjemplo,
  esPedidoEjemplo,
  MODALIDAD,
  MP_BADGE_PEDIDO,
  MP_ESTADO_PEDIDO,
  pedidosEjemploDeTienda,
  ESTADO_PEDIDO,
} from '@/lib/pedidos';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { usePanelTienda } from '@/components/vendor/panel-vendedor';
import { ModalPortal } from '@/components/vendor/modal-portal';

const fecha = (f: string) =>
  new Date(f).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function BadgePedido({ estado }: { estado: EstadoPedidoTienda }) {
  const clase = MP_BADGE_PEDIDO[estado] ?? 'mp-badge-preparar';
  const texto = MP_ESTADO_PEDIDO[estado] ?? ESTADO_PEDIDO[estado];
  return <span className={`mp-pedido-badge ${clase}`}>{texto}</span>;
}

export default function StoreOrdersPage({ params }: { params: { id: string } }) {
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [esEjemplo, setEsEjemplo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Venta | null>(null);
  const { recontarPedidos } = usePanelTienda();

  const cargar = useCallback(() => {
    setError(null);
    api<Tienda>(`/stores/${params.id}`)
      .then(async (t) => {
        setTienda(t);
        try {
          const lista = await api<Venta[]>(`/stores/${params.id}/orders`);
          if (lista.length === 0) {
            setVentas(pedidosEjemploDeTienda(params.id));
            setEsEjemplo(true);
          } else {
            setVentas(lista);
            setEsEjemplo(false);
          }
        } catch {
          setVentas(pedidosEjemploDeTienda(params.id));
          setEsEjemplo(true);
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!ticket) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTicket(null);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      document.body.classList.remove('mp-imprimiendo-ticket');
      document.querySelectorAll('.mp-ticket-print-copia').forEach((n) => n.remove());
    };
  }, [ticket]);

  function imprimirTicket() {
    const papel = document.querySelector('.mp-ticket-papel');
    if (!papel) return;

    // Copia al body: evita hoja en blanco por el transform/altura del panel.
    document.querySelectorAll('.mp-ticket-print-copia').forEach((n) => n.remove());
    const copia = papel.cloneNode(true) as HTMLElement;
    copia.classList.add('mp-ticket-print-copia');
    copia.setAttribute('aria-hidden', 'true');
    document.body.appendChild(copia);
    document.body.classList.add('mp-imprimiendo-ticket');

    let limpio = false;
    const limpiar = () => {
      if (limpio) return;
      limpio = true;
      copia.remove();
      document.body.classList.remove('mp-imprimiendo-ticket');
      window.removeEventListener('afterprint', limpiar);
    };
    window.addEventListener('afterprint', limpiar);
    // Deja aplicar la clase antes de abrir el diálogo de impresión
    window.setTimeout(() => {
      window.print();
      // Safari a veces no dispara afterprint
      window.setTimeout(limpiar, 500);
    }, 50);
  }

  async function cambiar(venta: Venta, estado: EstadoPedidoTienda) {
    let motivo: string | null = null;
    if (estado === 'cancelado') {
      motivo = window.prompt(`¿Por qué cancelás el pedido #${venta.numero}? El cliente va a ver este motivo.`);
      if (motivo === null) return;
    }
    setOcupado(venta.id);
    setError(null);
    try {
      if (esEjemplo || esPedidoEjemplo(venta.id)) {
        setVentas((lista) =>
          lista?.map((v) => (v.id === venta.id ? aplicarEstadoEjemplo(v, estado, motivo) : v)) ?? null
        );
        return;
      }
      const actualizada = await api<Venta>(`/stores/${params.id}/orders/${venta.id}`, {
        method: 'PATCH',
        body: { estado, motivo },
      });
      setVentas((lista) => lista?.map((v) => (v.id === venta.id ? actualizada : v)) ?? null);
      recontarPedidos();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(null);
    }
  }

  if (error && !tienda) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={`/vendor/tiendas/${params.id}`}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda || !ventas) return <PageSkeleton />;

  const vigentes = ventas.filter((v) => v.estado !== 'entregado' && v.estado !== 'cancelado' && v.estado !== 'rechazado');
  const lista = vigentes.length > 0 ? vigentes : ventas;

  return (
    <section className="mp-panel">
      <EncabezadoPanel
        titulo="Pedidos Vigentes y Compras Entrantes"
        descripcion={
          <>
            Gestioná en tiempo real las compras activas en <strong>{tienda.nombre}</strong>.
          </>
        }
      >
        <button type="button" className="mp-btn-secundario" onClick={cargar}>
          <Icon name="history" size={14} /> Actualizar
        </button>
      </EncabezadoPanel>

      {esEjemplo && (
        <div className="mp-demo" role="status">
          <Icon name="info" size={18} />
          <div>
            <strong>Pedido de ejemplo</strong>
            <p>Así se ve un pedido vigente en la plantilla. Las compras reales reemplazan este ejemplo.</p>
          </div>
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      {lista.length === 0 ? (
        <p className="mp-vacio">No hay pedidos vigentes en este momento para esta sucursal.</p>
      ) : (
        <div className="mp-pedidos">
          {lista.map((v) => (
            <article key={v.id} className="mp-pedido">
              <div className="mp-pedido-top">
                <div className="mp-pedido-id">
                  <strong>#{v.numero}</strong>
                  <span>
                    <Icon name="history" size={13} /> {fecha(v.creado_en)}
                  </span>
                </div>
                <div className="mp-pedido-top-der">
                  <button type="button" className="mp-btn-ticket" onClick={() => setTicket(v)}>
                    <Icon name="receipt" size={13} /> Ver Ticket
                  </button>
                  <BadgePedido estado={v.estado} />
                </div>
              </div>

              <div className="mp-pedido-grid">
                <div>
                  <span className="mp-pedido-label">Cliente</span>
                  <strong>{v.comprador?.nombre ?? 'Cliente'}</strong>
                  {v.comprador?.telefono && (
                    <span className="mp-pedido-dato mp-pedido-tel">
                      <Icon name="phone" size={12} /> {v.comprador.telefono}
                    </span>
                  )}
                </div>
                <div>
                  <span className="mp-pedido-label">Modalidad de entrega</span>
                  <strong>{MODALIDAD[v.modalidad]}</strong>
                  <span className="mp-pedido-dato">
                    <Icon name="pin" size={12} />
                    {esEjemplo
                      ? 'Calle Mendoza 1420 Sur, San Juan'
                      : v.modalidad === 'retiro_en_local'
                        ? tienda.direccion
                        : 'Envío a domicilio'}
                  </span>
                </div>
                <div>
                  <span className="mp-pedido-label">Productos</span>
                  <strong>
                    {v.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}
                  </strong>
                  <span className="mp-pedido-total">Total: {formatPrice(v.subtotal)}</span>
                </div>
              </div>

              {v.motivo_cancelacion && (
                <p className="mp-pedido-motivo">
                  <Icon name="alert" size={14} /> Motivo: {v.motivo_cancelacion}
                </p>
              )}

              <div className="mp-pedido-estados">
                <span>Cambiar estado del pedido:</span>
                <div className="mp-pedido-acciones">
                  {v.acciones.length === 0 ? (
                    <span className="muted">Sin acciones disponibles</span>
                  ) : (
                    v.acciones.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`mp-estado-btn${a === 'cancelado' ? ' peligro' : ''}${
                          a === 'entregado' ? ' ok' : ''
                        }${a === 'listo_para_recoleccion' || a === 'listo_para_retiro' ? ' listo' : ''}`}
                        disabled={ocupado === v.id}
                        onClick={() => cambiar(v, a)}
                      >
                        {ACCION_COMERCIO[a] ?? a}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {ticket && tienda && (
        <ModalPortal>
          <div className="mp-modal-overlay" role="presentation" onClick={() => setTicket(null)}>
            <div
              className="mp-modal mp-modal-ticket"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mp-ticket-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="mp-modal-cabecera">
                <h3 id="mp-ticket-titulo">Ticket de Pedido #{ticket.numero}</h3>
                <button type="button" className="mp-modal-cerrar" onClick={() => setTicket(null)} aria-label="Cerrar">
                  <Icon name="x" size={22} />
                </button>
              </header>
              <div className="mp-modal-cuerpo mp-ticket-cuerpo">
                <div className="mp-ticket-papel">
                  <div className="mp-ticket-cabeza">
                    <strong>COMPRALOCAL SAN JUAN ({tienda.nombre})</strong>
                    <span>Comprobante de Orden de Compra</span>
                  </div>
                  <div className="mp-ticket-datos">
                    <div>
                      <strong>Nº de Orden:</strong> #{ticket.numero}
                    </div>
                    <div>
                      <strong>Fecha y Hora:</strong> {fecha(ticket.creado_en)}
                    </div>
                    <div>
                      <strong>Cliente:</strong> {ticket.comprador?.nombre ?? 'Cliente'}
                      {ticket.comprador?.telefono ? ` (${ticket.comprador.telefono})` : ''}
                    </div>
                    <div>
                      <strong>Entrega:</strong> {MODALIDAD[ticket.modalidad]}
                    </div>
                    <div>
                      <strong>Estado:</strong> {MP_ESTADO_PEDIDO[ticket.estado] ?? ESTADO_PEDIDO[ticket.estado]}
                    </div>
                  </div>
                  <div className="mp-ticket-items">
                    <strong>Detalle de Productos:</strong>
                    {ticket.items.map((i, idx) => (
                      <div key={idx} className="mp-ticket-item">
                        <span>
                          {i.cantidad}x {i.nombre}
                        </span>
                        <span>{formatPrice(i.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mp-ticket-total-row">
                    <span>TOTAL:</span>
                    <span>{formatPrice(ticket.subtotal)}</span>
                  </div>
                </div>
              </div>
              <footer className="mp-modal-pie mp-ticket-pie">
                <button type="button" className="mp-modal-pie-primary" onClick={imprimirTicket}>
                  <Icon name="download" size={14} /> Imprimir Ticket
                </button>
                <button type="button" className="mp-modal-pie-cancelar" onClick={() => setTicket(null)}>
                  Cerrar
                </button>
              </footer>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
}
