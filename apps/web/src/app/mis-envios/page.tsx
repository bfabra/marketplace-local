'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type EstadoPedidoTienda, type ResumenPedido } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatPrice } from '@/lib/utils';
import { ESTADO_PEDIDO, MODALIDAD } from '@/lib/pedidos';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';

/** Estados con movimiento de envío/retiro (el backend ya los expone por parte). */
const SEGUIMIENTO: EstadoPedidoTienda[] = [
  'pago_confirmado',
  'en_preparacion',
  'listo_para_recoleccion',
  'listo_para_retiro',
  'recolectado',
  'en_camino',
];

const PASOS_ENVIO = ['Pago', 'Preparación', 'En camino', 'Entregado'] as const;

function avanceEnvio(estado: EstadoPedidoTienda): number {
  if (estado === 'pago_confirmado') return 1;
  if (estado === 'en_preparacion' || estado === 'listo_para_recoleccion') return 2;
  if (estado === 'recolectado' || estado === 'en_camino' || estado === 'listo_para_retiro') return 3;
  if (estado === 'entregado') return 4;
  return 0;
}

/**
 * Estado de envíos: UI mínima basada en estados reales de cada parte del pedido.
 * Sin timeline inventado: el detalle con historial está en /mis-compras/[id].
 */
export default function MisEnviosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<ResumenPedido[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/mis-envios');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api<ResumenPedido[]>('/orders')
      .then(setPedidos)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [user]);

  const envios = useMemo(() => {
    if (!pedidos) return [];
    return pedidos.flatMap((p) =>
      p.partes
        .filter((parte) => SEGUIMIENTO.includes(parte.estado) || parte.estado === 'entregado')
        .filter((parte) => parte.modalidad === 'entrega_plataforma' || parte.estado === 'listo_para_retiro')
        .map((parte) => ({ pedido: p, parte }))
    );
  }, [pedidos]);

  const activos = envios.filter((e) => SEGUIMIENTO.includes(e.parte.estado));

  if (loading || !user) return <PageSkeleton />;

  return (
    <CuentaShell
      user={user}
      titulo="Estado de envíos"
      descripcion="Seguimiento según el estado que informa cada comercio. El detalle completo está en cada pedido."
    >
      {error && <Alert>{error}</Alert>}

      {!pedidos ? (
        error ? null : <PageSkeleton />
      ) : activos.length === 0 ? (
        <EmptyState
          icono="truck"
          titulo="No tenés envíos en curso"
          acciones={
            <Link href="/mis-compras" className="btn btn-secondary">
              Ver mis compras
            </Link>
          }
        >
          Cuando un pedido esté en preparación o en camino, vas a verlo acá.
        </EmptyState>
      ) : (
        <ul className="cuenta-envios">
          {activos.map(({ pedido, parte }, i) => {
            const avance = avanceEnvio(parte.estado);
            return (
              <li key={`${pedido.id}-${i}`}>
                <div className="cuenta-envio-cabecera">
                  <div>
                    <strong>
                      Pedido #{pedido.numero}
                      {parte.tienda ? ` — ${parte.tienda}` : ''}
                    </strong>
                    <span>
                      {formatDate(pedido.creado_en)} · {MODALIDAD[parte.modalidad]}
                    </span>
                  </div>
                  <em>{formatPrice(pedido.total)}</em>
                </div>

                <p className="cuenta-envio-estado">
                  <Icon name="truck" size={16} /> {ESTADO_PEDIDO[parte.estado]}
                </p>

                <ol className="cuenta-envio-pasos" aria-label="Avance del envío">
                  {PASOS_ENVIO.map((paso, idx) => (
                    <li key={paso} className={idx < avance ? 'is-hecho' : undefined} aria-current={idx === avance - 1 ? 'step' : undefined}>
                      <span aria-hidden="true">{idx < avance ? <Icon name="check" size={12} strokeWidth={3} /> : idx + 1}</span>
                      {paso}
                    </li>
                  ))}
                </ol>

                <Link href={`/mis-compras/${pedido.id}`}>Ver detalle del pedido</Link>
              </li>
            );
          })}
        </ul>
      )}
    </CuentaShell>
  );
}
