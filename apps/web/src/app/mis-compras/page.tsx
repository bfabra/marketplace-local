'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type EstadoPago, type EstadoPedidoTienda, type ResumenPedido } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatPrice } from '@/lib/utils';
import { plural } from '@/lib/visual';
import { COLOR_PAGO, ESTADO_PAGO, MODALIDAD } from '@/lib/pedidos';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { OrderStatus } from '@/components/ui/order-status';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';

const EN_CURSO: EstadoPedidoTienda[] = [
  'pago_confirmado',
  'en_preparacion',
  'listo_para_recoleccion',
  'listo_para_retiro',
  'recolectado',
  'en_camino',
];
const COBRADO: EstadoPago[] = ['aprobado', 'reembolsado_parcial'];

type Filtro = 'todas' | 'en_curso' | 'por_pagar' | 'terminadas';

const FILTROS: { id: Filtro; label: string; cumple: (p: ResumenPedido) => boolean }[] = [
  { id: 'todas', label: 'Todas', cumple: () => true },
  { id: 'en_curso', label: 'En curso', cumple: (p) => p.partes.some((x) => EN_CURSO.includes(x.estado)) },
  { id: 'por_pagar', label: 'Por pagar', cumple: (p) => p.estado_pago === 'pendiente' },
  {
    id: 'terminadas',
    label: 'Terminadas',
    cumple: (p) => p.estado_pago !== 'pendiente' && !p.partes.some((x) => EN_CURSO.includes(x.estado)),
  },
];

export default function MyOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<ResumenPedido[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/mis-compras');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api<ResumenPedido[]>('/orders')
      .then(setPedidos)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [user]);

  const resumen = useMemo(() => {
    const lista = pedidos ?? [];
    return {
      enCurso: lista.filter(FILTROS[1].cumple).length,
      porPagar: lista.filter(FILTROS[2].cumple).length,
      gastado: lista.filter((p) => COBRADO.includes(p.estado_pago)).reduce((t, p) => t + Number(p.total), 0),
    };
  }, [pedidos]);

  if (loading || !user) return <PageSkeleton />;

  const visibles = (pedidos ?? []).filter(FILTROS.find((f) => f.id === filtro)!.cumple);

  return (
    <CuentaShell
      user={user}
      titulo="Mis compras"
      descripcion="Seguí tus pedidos: cada tienda prepara su parte y te avisa cuando está lista."
    >
      {error && <Alert>{error}</Alert>}

      {!pedidos ? (
        error ? null : <PageSkeleton />
      ) : pedidos.length === 0 ? (
        <EmptyState
          icono="bag"
          titulo="Todavía no hiciste ninguna compra"
          acciones={
            <Link href="/tiendas" className="market-primary-button">
              Explorar tiendas
            </Link>
          }
        >
          Cuando compres en los comercios de tu ciudad, vas a ver acá el estado de cada pedido.
        </EmptyState>
      ) : (
        <div className="cuenta-compras">
          <section className="cuenta-cifras" aria-label="Resumen de tus compras">
            <div>
              <strong>{pedidos.length}</strong>
              <span>{pedidos.length === 1 ? 'Compra' : 'Compras'}</span>
            </div>
            <div className={resumen.enCurso > 0 ? 'is-destacada' : undefined}>
              <strong>{resumen.enCurso}</strong>
              <span>En curso</span>
            </div>
            <div>
              <strong>{resumen.porPagar}</strong>
              <span>Por pagar</span>
            </div>
            <div>
              <strong>{formatPrice(resumen.gastado)}</strong>
              <span>Total pagado</span>
            </div>
          </section>

          <div className="cuenta-filtros" role="group" aria-label="Filtrar compras">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
                {f.label} <em>{pedidos.filter(f.cumple).length}</em>
              </button>
            ))}
          </div>

          {visibles.length === 0 ? (
            <p className="cuenta-vacio-filtro">No hay compras en esta sección.</p>
          ) : (
            <ul className="cuenta-lista-compras">
              {visibles.map((p) => (
                <li key={p.id}>
                  <div className="cuenta-compra-cabecera">
                    <div>
                      <Link href={`/mis-compras/${p.id}`}>Pedido #{p.numero}</Link>
                      <span>
                        {formatDate(p.creado_en)} · {plural(p.unidades, 'unidad', 'unidades')}
                        {p.partes[0]?.tienda ? ` · ${p.partes.map((x) => x.tienda).filter(Boolean).join(', ')}` : ''}
                      </span>
                    </div>
                    <div className="cuenta-compra-total">
                      <strong>{formatPrice(p.total)}</strong>
                      <span className={`badge ${COLOR_PAGO[p.estado_pago]}`}>{ESTADO_PAGO[p.estado_pago]}</span>
                    </div>
                  </div>
                  <ul className="cuenta-compra-partes">
                    {p.partes.map((parte, i) => (
                      <li key={i}>
                        <span>
                          <Icon name={parte.modalidad === 'retiro_en_local' ? 'store' : 'truck'} size={15} />
                          <strong>{parte.tienda ?? 'Tienda'}</strong>
                          <em>· {MODALIDAD[parte.modalidad]}</em>
                        </span>
                        <OrderStatus estado={parte.estado} />
                      </li>
                    ))}
                  </ul>
                  <div className="cuenta-compra-acciones">
                    {p.estado_pago === 'pendiente' && (
                      <Link href={`/pago-simulado/${p.id}`} className="market-primary-button">
                        Pagar
                      </Link>
                    )}
                    <Link href={`/mis-compras/${p.id}`} className="btn btn-secondary">
                      Ver detalle
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
