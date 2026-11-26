'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Tienda, type Venta } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import { MODALIDAD, MP_ESTADO_PEDIDO, ESTADO_PEDIDO } from '@/lib/pedidos';
import { iniciales } from '@/lib/visual';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { ModalPortal } from '@/components/vendor/modal-portal';

const SIN_VENTA = new Set(['cancelado', 'rechazado', 'pendiente']);

type PeriodoHistorial = 3 | 6;
type ModalMetrica = 'seguidores' | 'favoritos' | null;

type SeguidorItem = { id: string; nombre: string | null; desde: string };
type FavoritoItem = {
  id: string;
  nombre: string;
  slug: string;
  imagen: string | null;
  precio: number | null;
  veces: number;
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function desdeMeses(meses: PeriodoHistorial) {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
}

/** Estrellas vacías: las valoraciones reales todavía no están en la base. */
function BadgePrestigio() {
  return (
    <div className="mp-prestigio-badge" title="Comercio nuevo o sin valoraciones aún">
      <span className="mp-prestigio-estrellas" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Icon key={i} name="star" size={15} />
        ))}
      </span>
      <span>Sin valoraciones</span>
    </div>
  );
}

/** Panel #merchant-panel → Mis Ventas y Métricas (merchant.js renderSalesTab). */
export default function VentasPage({ params }: { params: { id: string } }) {
  const base = `/vendor/tiendas/${params.id}`;
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [seguidores, setSeguidores] = useState<{ total: number; lista: SeguidorItem[] }>({
    total: 0,
    lista: [],
  });
  const [favoritos, setFavoritos] = useState<{ total: number; productos: FavoritoItem[] }>({
    total: 0,
    productos: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Venta | null>(null);
  const [modal, setModal] = useState<ModalMetrica>(null);
  const [periodo, setPeriodo] = useState<PeriodoHistorial>(6);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(() => {
    setError(null);
    api<Tienda>(`/stores/${params.id}`)
      .then(async (t) => {
        setTienda(t);
        const pedidos = t.permisos.includes('pedidos.ver')
          ? await api<Venta[]>(`/stores/${params.id}/orders`).catch(() => [] as Venta[])
          : [];
        setVentas(pedidos);

        const seg = await api<{ total: number; lista?: SeguidorItem[] }>(
          `/stores/${params.id}/seguidores`
        ).catch(() => null);
        setSeguidores({ total: seg?.total ?? 0, lista: seg?.lista ?? [] });

        const fav = await api<{ total: number; productos: FavoritoItem[] }>(
          `/stores/${params.id}/favoritos`
        ).catch(() => null);
        setFavoritos({ total: fav?.total ?? 0, productos: fav?.productos ?? [] });
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!ticket && !modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setTicket(null);
      setModal(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ticket, modal]);

  const historial = useMemo(() => {
    if (!ventas) return [];
    const desde = desdeMeses(periodo).getTime();
    const q = busqueda.trim().toLowerCase();
    return [...ventas]
      .filter((v) => v.estado === 'entregado')
      .filter((v) => new Date(v.creado_en).getTime() >= desde)
      .filter((v) => {
        if (!q) return true;
        const nro = String(v.numero);
        const cliente = (v.comprador?.nombre ?? '').toLowerCase();
        return nro.includes(q) || cliente.includes(q);
      })
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en));
  }, [ventas, periodo, busqueda]);

  if (error && !tienda) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={base}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda || ventas === null) return <PageSkeleton />;

  const ahora = new Date();
  const delMes = ventas.filter((v) => {
    const f = new Date(v.creado_en);
    return !SIN_VENTA.has(v.estado) && f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
  });
  const totalAnio = ventas
    .filter((v) => !SIN_VENTA.has(v.estado) && new Date(v.creado_en).getFullYear() === ahora.getFullYear())
    .reduce((s, v) => s + v.subtotal, 0);

  return (
    <section className="mp-panel mp-ventas">
      <EncabezadoPanel
        titulo={`Mis Ventas y Métricas — ${tienda.nombre}`}
        descripcion="Panel independiente de rendimiento y operaciones de esta sucursal."
      />

      {error && <Alert>{error}</Alert>}

      <div className="mp-metricas">
        <div className="mp-metrica mp-metrica-navy">
          <span>Ventas Totales del Año</span>
          <strong>{formatPrice(totalAnio)}</strong>
        </div>
        <div className="mp-metrica">
          <span>Operaciones (Mes Actual)</span>
          <strong>
            {delMes.length} {delMes.length === 1 ? 'venta' : 'ventas'}
          </strong>
        </div>
        <div className="mp-metrica">
          <span>Prestigio de la Tienda</span>
          <BadgePrestigio />
          <em className="mp-metrica-nota">Basado exclusivamente en compras verificadas</em>
        </div>
        <button
          type="button"
          className="mp-metrica mp-metrica-link"
          onClick={() => setModal('seguidores')}
        >
          <span>Seguidores de Tienda</span>
          <strong className="mp-metrica-accent">
            {seguidores.total} {seguidores.total === 1 ? 'usuario' : 'usuarios'}
          </strong>
          <em>Ver listado →</em>
        </button>
        <button
          type="button"
          className="mp-metrica mp-metrica-link"
          onClick={() => setModal('favoritos')}
        >
          <span>Productos en Favoritos</span>
          <strong className="mp-metrica-blue">
            {favoritos.total} {favoritos.total === 1 ? 'guardado' : 'guardados'}
          </strong>
          <em>Ver favoritos →</em>
        </button>
      </div>

      <div className="mp-ventas-historial">
        <h3>Historial de Ventas y Tickets Archivados ({tienda.nombre})</h3>

        <div className="mp-historial-filtros">
          <label className="mp-historial-periodo">
            <span className="sr-only">Período</span>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(Number(e.target.value) as PeriodoHistorial)}
            >
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
            </select>
          </label>
          <label className="mp-historial-buscar">
            <Icon name="search" size={16} />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por N° de operación o cliente"
              autoComplete="off"
            />
          </label>
        </div>
        <p className="mp-historial-ayuda">
          El historial muestra como máximo los últimos {periodo} meses para mantener la lista manejable.
        </p>

        {historial.length === 0 ? (
          <p className="mp-vacio">
            {busqueda.trim()
              ? 'No hay ventas que coincidan con esa búsqueda en el período elegido.'
              : 'No hay ventas registradas en este período.'}
          </p>
        ) : (
          <ul className="mp-tickets">
            {historial.map((v) => (
              <li key={v.id} className="mp-ticket">
                <div>
                  <strong>Venta #{v.numero}</strong>
                  <span>
                    {fechaCorta(v.creado_en)} · {v.comprador?.nombre ?? 'Cliente'} ({MODALIDAD[v.modalidad]})
                  </span>
                </div>
                <div className="mp-ticket-der">
                  <strong className="mp-ticket-monto">{formatPrice(v.subtotal)}</strong>
                  <button type="button" className="mp-btn-ticket" onClick={() => setTicket(v)}>
                    Ver Ticket
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal === 'seguidores' && (
        <ModalPortal>
          <div className="mp-modal-overlay" role="presentation" onClick={() => setModal(null)}>
            <div
              className="mp-modal mp-modal-metrica"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mp-modal-seguidores-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="mp-modal-cabecera">
                <h3 id="mp-modal-seguidores-titulo">Seguidores de la Tienda</h3>
                <button type="button" className="mp-modal-cerrar" onClick={() => setModal(null)} aria-label="Cerrar">
                  <Icon name="x" size={22} />
                </button>
              </header>
              <div className="mp-modal-cuerpo">
                <p className="mp-metrica-modal-intro">Usuarios que siguen actualmente a esta tienda:</p>
                {seguidores.lista.length === 0 ? (
                  <p className="mp-vacio">Todavía nadie sigue esta tienda.</p>
                ) : (
                  <ul className="mp-metrica-lista">
                    {seguidores.lista.map((s) => {
                      const nombre = s.nombre?.trim() || 'Usuario';
                      return (
                        <li key={s.id} className="mp-metrica-fila">
                          <span className="mp-metrica-avatar" aria-hidden="true">
                            {iniciales(nombre)}
                          </span>
                          <div>
                            <strong>{nombre}</strong>
                            <small>Desde {fechaCorta(s.desde)}</small>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <footer className="mp-modal-pie">
                <button type="button" className="mp-modal-pie-cancelar" onClick={() => setModal(null)}>
                  Cerrar
                </button>
              </footer>
            </div>
          </div>
        </ModalPortal>
      )}

      {modal === 'favoritos' && (
        <ModalPortal>
          <div className="mp-modal-overlay" role="presentation" onClick={() => setModal(null)}>
            <div
              className="mp-modal mp-modal-metrica"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mp-modal-favoritos-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="mp-modal-cabecera">
                <h3 id="mp-modal-favoritos-titulo">Productos Guardados en Favoritos</h3>
                <button type="button" className="mp-modal-cerrar" onClick={() => setModal(null)} aria-label="Cerrar">
                  <Icon name="x" size={22} />
                </button>
              </header>
              <div className="mp-modal-cuerpo">
                <p className="mp-metrica-modal-intro">
                  Artículos de tu tienda guardados por los clientes en sus listas de deseos:
                </p>
                {favoritos.productos.length === 0 ? (
                  <p className="mp-vacio">No hay productos guardados actualmente en favoritos.</p>
                ) : (
                  <ul className="mp-metrica-lista">
                    {favoritos.productos.map((p) => (
                      <li key={p.id} className="mp-metrica-fila mp-metrica-fila-prod">
                        {p.imagen ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagen} alt="" className="mp-metrica-thumb" />
                        ) : (
                          <span className="mp-metrica-thumb mp-metrica-thumb-vacio" aria-hidden="true">
                            <Icon name="package" size={16} />
                          </span>
                        )}
                        <div className="mp-metrica-prod-texto">
                          <strong>{p.nombre}</strong>
                          <span>
                            {p.precio != null ? formatPrice(p.precio) : 'Sin precio'}
                            {' · '}
                            {p.veces} {p.veces === 1 ? 'guardado' : 'guardados'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <footer className="mp-modal-pie">
                <button type="button" className="mp-modal-pie-cancelar" onClick={() => setModal(null)}>
                  Cerrar
                </button>
              </footer>
            </div>
          </div>
        </ModalPortal>
      )}

      {ticket && (
        <ModalPortal>
          <div className="mp-modal-overlay" role="presentation" onClick={() => setTicket(null)}>
            <div
              className="mp-modal mp-modal-ticket"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mp-venta-ticket-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="mp-modal-cabecera">
                <h3 id="mp-venta-ticket-titulo">Ticket de Venta #{ticket.numero}</h3>
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
                      <strong>Fecha y Hora:</strong> {fechaHora(ticket.creado_en)}
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
