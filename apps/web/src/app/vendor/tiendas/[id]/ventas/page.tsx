'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type ListadoProductos, type Tienda, type Venta } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import { MODALIDAD, MP_BADGE_PEDIDO, MP_ESTADO_PEDIDO, ESTADO_PEDIDO, ventasEjemploDeTienda } from '@/lib/pedidos';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';

const SIN_VENTA = new Set(['cancelado', 'rechazado', 'pendiente']);

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Panel #merchant-panel → Mis Ventas y Métricas. */
export default function VentasPage({ params }: { params: { id: string } }) {
  const base = `/vendor/tiendas/${params.id}`;
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [esEjemplo, setEsEjemplo] = useState(false);
  const [catalogo, setCatalogo] = useState<ListadoProductos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<Tienda>(`/stores/${params.id}`)
      .then((t) => {
        setTienda(t);
        if (t.permisos.includes('pedidos.ver')) {
          api<Venta[]>(`/stores/${params.id}/orders`)
            .then((lista) => {
              if (lista.length === 0) {
                setVentas(ventasEjemploDeTienda(params.id));
                setEsEjemplo(true);
              } else {
                setVentas(lista);
                setEsEjemplo(false);
              }
            })
            .catch(() => {
              setVentas(ventasEjemploDeTienda(params.id));
              setEsEjemplo(true);
            });
        } else {
          setVentas(ventasEjemploDeTienda(params.id));
          setEsEjemplo(true);
        }
        if (t.permisos.includes('productos.ver')) {
          api<ListadoProductos>(`/stores/${params.id}/products`).then(setCatalogo).catch(() => setCatalogo(null));
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !tienda) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={base}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda) return <PageSkeleton />;

  const lista = ventas ?? [];
  const ahora = new Date();
  const delMes = lista.filter((v) => {
    const f = new Date(v.creado_en);
    return !SIN_VENTA.has(v.estado) && f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
  });
  const ventasAnio = lista
    .filter((v) => !SIN_VENTA.has(v.estado) && new Date(v.creado_en).getFullYear() === ahora.getFullYear())
    .reduce((s, v) => s + v.subtotal, 0);
  const totalAnio = esEjemplo ? ventasAnio + 450000 : ventasAnio;
  const opsMes = esEjemplo ? delMes.length + 5 : delMes.length;
  const seguidores = esEjemplo ? 142 : 0;
  const favoritos = esEjemplo ? 28 : (catalogo?.productos.length ?? 0);
  const historial = [...lista]
    .filter((v) => v.estado === 'entregado' || !SIN_VENTA.has(v.estado))
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en));

  return (
    <section className="mp-panel mp-ventas">
      <EncabezadoPanel
        titulo={`Mis Ventas y Métricas — ${tienda.nombre}`}
        descripcion="Panel independiente de rendimiento y operaciones de esta sucursal."
      />

      {esEjemplo && (
        <div className="mp-demo" role="status">
          <Icon name="info" size={18} />
          <div>
            <strong>Datos de ejemplo</strong>
            <p>Métricas e historial de muestra como en la plantilla. Se reemplazan con ventas reales.</p>
          </div>
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      <div className="mp-metricas">
        <div className="mp-metrica mp-metrica-navy">
          <span>Ventas totales del año</span>
          <strong>{formatPrice(totalAnio)}</strong>
        </div>
        <div className="mp-metrica">
          <span>Operaciones (mes actual)</span>
          <strong>{opsMes} ventas</strong>
        </div>
        <Link href={`${base}/pedidos`} className="mp-metrica mp-metrica-link">
          <span>Seguidores de tienda</span>
          <strong className="mp-metrica-accent">{seguidores || '—'} usuarios</strong>
          <em>Ver listado →</em>
        </Link>
        <Link href={`${base}/productos`} className="mp-metrica mp-metrica-link">
          <span>Productos guardados</span>
          <strong className="mp-metrica-blue">{favoritos} en favoritos</strong>
          <em>Ver favoritos →</em>
        </Link>
      </div>

      <div className="mp-ventas-historial">
        <h3>Historial de ventas y tickets archivados ({tienda.nombre})</h3>
        {historial.length === 0 ? (
          <p className="mp-vacio">No hay ventas registradas en esta sucursal.</p>
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
                  <span className={`mp-pedido-badge ${MP_BADGE_PEDIDO[v.estado] ?? 'mp-badge-preparar'}`}>
                    {MP_ESTADO_PEDIDO[v.estado] ?? ESTADO_PEDIDO[v.estado]}
                  </span>
                  <Link href={`${base}/pedidos`} className="mp-btn-ticket">
                    Ver Ticket
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
