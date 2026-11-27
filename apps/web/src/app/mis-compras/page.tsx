'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type Pedido, type ResumenPedido } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import {
  MESES_HISTORIAL_COMPRAS,
  estaEnHistorial,
  expiraHistorialTexto,
  fechaCompraTexto,
} from '@/lib/compras-historial';
import { formatPrice } from '@/lib/utils';
import { plural } from '@/lib/visual';
import { PRODUCT_NAME } from '@/components/layout/logo';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';
import { ESTADO_PAGO } from '@/lib/pedidos';

function comerciosDe(p: ResumenPedido) {
  const nombres = p.partes.map((x) => x.tienda).filter(Boolean) as string[];
  return [...new Set(nombres)].join(', ') || 'Compra';
}

function resumenProductos(pedido: Pedido | undefined) {
  if (!pedido) return null;
  const items = pedido.partes.flatMap((parte) =>
    parte.items.map((i) => `${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}`)
  );
  if (items.length === 0) return null;
  if (items.length <= 2) return items.join(' · ');
  return `${items.slice(0, 2).join(' · ')} · +${items.length - 2} más`;
}

/** Mis Compras (Historial) — tickets del cliente (#profile → purchases). */
export default function MyOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<ResumenPedido[] | null>(null);
  const [detalles, setDetalles] = useState<Record<string, Pedido>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/mis-compras');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api<ResumenPedido[]>('/orders')
      .then(setPedidos)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [user]);

  const visibles = useMemo(() => {
    if (!pedidos) return [];
    return pedidos.filter((p) => estaEnHistorial(p.creado_en, p.estado_pago));
  }, [pedidos]);

  const idsVisibles = useMemo(() => visibles.map((p) => p.id).join(','), [visibles]);

  useEffect(() => {
    if (!idsVisibles) return;
    const ids = idsVisibles.split(',');
    let vivo = true;
    Promise.all(
      ids.map(async (id) => {
        try {
          const pedido = await api<Pedido>(`/orders/${id}`);
          return [id, pedido] as const;
        } catch {
          return null;
        }
      })
    ).then((pares) => {
      if (!vivo) return;
      const mapa: Record<string, Pedido> = {};
      for (const par of pares) {
        if (par) mapa[par[0]] = par[1];
      }
      setDetalles(mapa);
    });
    return () => {
      vivo = false;
    };
  }, [idsVisibles]);

  if (loading || !user) return <PageSkeleton />;

  return (
    <CuentaShell
      user={user}
      titulo="Mis Compras (Historial)"
      descripcion={`Historial detallado de tickets y comprobantes en ${PRODUCT_NAME} San Juan.`}
    >
      {error && <Alert>{error}</Alert>}

      {!pedidos ? (
        error ? null : <PageSkeleton />
      ) : pedidos.length === 0 ? (
        <EmptyState
          icono="bag"
          titulo="No hay compras registradas en este período"
          acciones={
            <Link href="/tiendas" className="market-primary-button">
              Explorar tiendas
            </Link>
          }
        >
          Cuando compres en los comercios de tu ciudad, vas a ver acá tus tickets.
        </EmptyState>
      ) : (
        <div className="cuenta-compras-historial">
          <div className="cuenta-compras-aviso" role="note">
            <span aria-hidden="true">ℹ️</span>
            <p>
              El historial de compras guarda tus tickets durante{' '}
              <strong>{MESES_HISTORIAL_COMPRAS} meses</strong> desde la fecha de cada compra. Pasado ese plazo se
              limpian automáticamente y ya no aparecen acá.
            </p>
          </div>

          {visibles.length === 0 ? (
            <p className="cuenta-vacio-filtro">No hay compras registradas en este período.</p>
          ) : (
            <ul className="cuenta-tickets">
              {visibles.map((p) => {
                const detalle = detalles[p.id];
                const productos = resumenProductos(detalle);
                return (
                  <li key={p.id} className="cuenta-ticket">
                    <div className="cuenta-ticket-info">
                      <strong>
                        Ticket #{p.numero} — {comerciosDe(p)}
                      </strong>
                      <span>
                        Fecha de compra: {fechaCompraTexto(p.creado_en)} · Visible hasta:{' '}
                        {expiraHistorialTexto(p.creado_en)}
                      </span>
                      <span>
                        {plural(p.unidades, 'unidad', 'unidades')}
                        {productos ? ` · ${productos}` : ''}
                        {` · ${ESTADO_PAGO[p.estado_pago]}`}
                      </span>
                    </div>
                    <div className="cuenta-ticket-acciones">
                      <strong className="cuenta-ticket-total">{formatPrice(p.total)}</strong>
                      {p.estado_pago === 'pendiente' && (
                        <Link href={`/pago-simulado/${p.id}`} className="market-primary-button">
                          Pagar
                        </Link>
                      )}
                      <Link href={`/mis-compras/${p.id}`} className="cuenta-ticket-btn">
                        Ver Ticket ›
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </CuentaShell>
  );
}
