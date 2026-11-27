'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type ResumenPedido } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatPrice } from '@/lib/utils';
import { PRODUCT_NAME } from '@/components/layout/logo';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';

const MESES_HISTORIAL = 6;

function haceMeses(meses: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
}

function expiraTicket(creadoEn: string) {
  const d = new Date(creadoEn);
  d.setFullYear(d.getFullYear() + 1);
  return formatDate(d.toISOString());
}

function comerciosDe(p: ResumenPedido) {
  const nombres = p.partes.map((x) => x.tienda).filter(Boolean) as string[];
  return [...new Set(nombres)].join(', ') || 'Compra';
}

/** Mis compras — historial de tickets (#profile → purchases). */
export default function MyOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<ResumenPedido[] | null>(null);
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
    const desde = haceMeses(MESES_HISTORIAL);
    return pedidos.filter(
      (p) => p.estado_pago === 'pendiente' || new Date(p.creado_en) >= desde
    );
  }, [pedidos]);

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
              El historial muestra únicamente los últimos <strong>{MESES_HISTORIAL} meses</strong> de todas las
              compras realizadas en la plataforma antes de su limpieza automática.
            </p>
          </div>

          {visibles.length === 0 ? (
            <p className="cuenta-vacio-filtro">No hay compras registradas en este período.</p>
          ) : (
            <ul className="cuenta-tickets">
              {visibles.map((p) => (
                <li key={p.id} className="cuenta-ticket">
                  <div className="cuenta-ticket-info">
                    <strong>
                      #{p.numero} — {comerciosDe(p)}
                    </strong>
                    <span>
                      Fecha de compra: {formatDate(p.creado_en)} · Expira el: {expiraTicket(p.creado_en)}
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
              ))}
            </ul>
          )}
        </div>
      )}
    </CuentaShell>
  );
}
