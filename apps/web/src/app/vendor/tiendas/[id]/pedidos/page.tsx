'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type EstadoPedidoTienda, type Tienda, type Venta } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import {
  bucketEstadoPedido,
  estadoDestinoMaqueta,
  MODALIDAD,
  MP_BADGE_PEDIDO,
  MP_ESTADO_PEDIDO,
  ESTADO_PEDIDO,
  type BotonEstadoMaqueta,
} from '@/lib/pedidos';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { usePanelTienda } from '@/components/vendor/panel-vendedor';
import { ModalPortal } from '@/components/vendor/modal-portal';

const BOTONES_ESTADO: { id: BotonEstadoMaqueta; label: string; clase: string }[] = [
  { id: 'preparar', label: 'Por preparar', clase: 'is-preparar' },
  { id: 'listo', label: 'Listo para retirar / enviar', clase: 'is-listo' },
  { id: 'entregado', label: 'Entregado (Archivar)', clase: 'is-entregado' },
];

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
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Venta | null>(null);
  const [archivar, setArchivar] = useState<Venta | null>(null);
  const { recontarPedidos } = usePanelTienda();

  const cargar = useCallback(() => {
    setError(null);
    api<Tienda>(`/stores/${params.id}`)
      .then(async (t) => {
        setTienda(t);
        setVentas(await api<Venta[]>(`/stores/${params.id}/orders`));
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
      setArchivar(null);
    }
  }

  function clicEstado(venta: Venta, boton: BotonEstadoMaqueta) {
    if (bucketEstadoPedido(venta.estado) === boton) return;
    const destino = estadoDestinoMaqueta(boton, venta.modalidad);
    if (boton === 'entregado') {
      setArchivar(venta);
      return;
    }
    if (!venta.acciones.includes(destino)) {
      setError(
        boton === 'listo'
          ? 'Pasá primero el pedido a “Por preparar” y después a listo.'
          : 'Ese cambio de estado no está disponible todavía para este pedido.'
      );
      return;
    }
    void cambiar(venta, destino);
  }

  function confirmarArchivar() {
    if (!archivar) return;
    const destino = estadoDestinoMaqueta('entregado', archivar.modalidad);
    if (!archivar.acciones.includes(destino)) {
      setError(
        archivar.modalidad === 'entrega_plataforma'
          ? 'En envíos a domicilio, la plataforma marca Entregado cuando llega el repartidor.'
          : 'Marcá el pedido como listo para retirar antes de archivarlo.'
      );
      setArchivar(null);
      return;
    }
    void cambiar(archivar, destino);
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

      {error && <Alert>{error}</Alert>}

      {vigentes.length === 0 ? (
        <p className="mp-vacio">No hay pedidos vigentes en este momento para esta sucursal.</p>
      ) : (
        <div className="mp-pedidos">
          {vigentes.map((v) => (
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
                    {v.modalidad === 'retiro_en_local' ? tienda.direccion : 'Envío a domicilio'}
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
                <span>Cambiar Estado del Pedido:</span>
                <div className="mp-pedido-acciones">
                  {BOTONES_ESTADO.map((b) => {
                    const activo = bucketEstadoPedido(v.estado) === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className={`mp-estado-btn ${b.clase}${activo ? ' is-activo' : ''}`}
                        disabled={ocupado === v.id}
                        aria-pressed={activo}
                        onClick={() => clicEstado(v, b.id)}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {archivar && (
        <ModalPortal>
          <div className="mp-modal-overlay mp-confirm-archive-overlay" role="presentation">
            <div
              className="mp-modal mp-confirm-archive"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mp-archivar-titulo"
            >
              <div className="mp-confirm-archive-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 id="mp-archivar-titulo">¿Confirmar Entrega y Archivar?</h3>
              <p>
                ¿Estás seguro de marcar este pedido como <strong>Entregado</strong>? Al hacerlo, se removerá de los
                pedidos vigentes y se registrará permanentemente en el <strong>Historial de Ventas</strong>.
              </p>
              <div className="mp-confirm-archive-acciones">
                <button type="button" className="mp-checkout-btn-sec" disabled={ocupado !== null} onClick={() => setArchivar(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="mp-confirm-archive-ok"
                  disabled={ocupado !== null}
                  onClick={confirmarArchivar}
                >
                  {ocupado === archivar.id ? 'Archivando…' : 'Sí, Entregado y Archivar'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
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
