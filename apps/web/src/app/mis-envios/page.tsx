'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  api,
  type EstadoPedidoTienda,
  type Modalidad,
  type Pedido,
  type ResumenPedido,
} from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/utils';
import { ESTADO_PEDIDO } from '@/lib/pedidos';
import { PRODUCT_NAME } from '@/components/layout/logo';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';

/** Pedidos con seguimiento activo o recién entregados (para ver la línea de tiempo completa). */
const CON_SEGUIMIENTO: EstadoPedidoTienda[] = [
  'pago_confirmado',
  'en_preparacion',
  'listo_para_recoleccion',
  'listo_para_retiro',
  'recolectado',
  'en_camino',
  'entregado',
];

/** Línea de tiempo de envío a domicilio (#profile → shipments). */
const PASOS_ENTREGA = [
  {
    label: 'Procesando la Compra',
    desc: 'La tienda recibió el pago y está preparando tu pedido',
  },
  {
    label: 'Entregado al Repartidor',
    desc: 'El paquete fue retirado por el cadete en el comercio',
  },
  {
    label: 'Envío en Camino',
    desc: 'El repartidor va hacia tu domicilio en San Juan',
  },
  {
    label: 'Entregado',
    desc: 'Recibido conforme en tu domicilio',
  },
] as const;

const PASOS_RETIRO = [
  { label: 'Procesando la Compra', desc: 'La tienda recibió el pago y está preparando tu pedido' },
  { label: 'En Preparación', desc: 'El comercio está armando tu pedido' },
  { label: 'Listo para Retirar', desc: 'Podés pasar a buscarlo al local' },
  { label: 'Entregado', desc: 'Retirado conforme en el local' },
] as const;

function pasoActual(estado: EstadoPedidoTienda, modalidad: Modalidad): number {
  if (modalidad === 'retiro_en_local') {
    if (estado === 'pago_confirmado') return 1;
    if (estado === 'en_preparacion') return 2;
    if (estado === 'listo_para_retiro') return 3;
    if (estado === 'entregado') return 4;
    return 1;
  }
  if (estado === 'pago_confirmado' || estado === 'en_preparacion' || estado === 'listo_para_recoleccion') return 1;
  if (estado === 'recolectado') return 2;
  if (estado === 'en_camino') return 3;
  if (estado === 'entregado') return 4;
  return 1;
}

function descActual(estado: EstadoPedidoTienda, modalidad: Modalidad): string {
  if (modalidad === 'retiro_en_local') {
    if (estado === 'listo_para_retiro') return 'Tu pedido ya está listo para retirar en el local.';
    if (estado === 'en_preparacion') return 'El comercio está preparando tu pedido.';
    if (estado === 'entregado') return 'Ya retiraste tu pedido en el local.';
    return ESTADO_PEDIDO[estado];
  }
  if (estado === 'entregado') return 'Tu pedido fue entregado en el domicilio.';
  if (estado === 'en_camino') return 'El repartidor se encuentra en ruta por San Juan.';
  if (estado === 'recolectado') return 'El cadete ya retiró el paquete de la tienda.';
  if (estado === 'en_preparacion' || estado === 'listo_para_recoleccion') {
    return 'La tienda está preparando y empaquetando tu pedido.';
  }
  if (estado === 'pago_confirmado') return 'Pago acreditado; la tienda está por empezar a preparar el pedido.';
  return ESTADO_PEDIDO[estado];
}

function horaLog(fecha: string) {
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type EnvioActivo = {
  pedidoId: string;
  numero: number;
  total: number;
  parteIdx: number;
  tienda: string | null;
  estado: EstadoPedidoTienda;
  modalidad: Modalidad;
};

/** Estado de envíos y trazabilidad (#profile → shipments). */
export default function MisEnviosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<ResumenPedido[] | null>(null);
  const [detalles, setDetalles] = useState<Record<string, Pedido>>({});
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

  const activos = useMemo(() => {
    if (!pedidos) return [] as EnvioActivo[];
    return pedidos.flatMap((p) =>
      p.partes
        .map((parte, parteIdx) => ({ p, parte, parteIdx }))
        .filter(
          ({ parte }) =>
            CON_SEGUIMIENTO.includes(parte.estado) &&
            (parte.modalidad === 'entrega_plataforma' || parte.modalidad === 'retiro_en_local')
        )
        .map(({ p, parte, parteIdx }) => ({
          pedidoId: p.id,
          numero: p.numero,
          total: p.total,
          parteIdx,
          tienda: parte.tienda,
          estado: parte.estado,
          modalidad: parte.modalidad,
        }))
    );
  }, [pedidos]);

  useEffect(() => {
    const ids = [...new Set(activos.map((e) => e.pedidoId))];
    if (ids.length === 0) return;
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
  }, [activos]);

  if (loading || !user) return <PageSkeleton />;

  return (
    <CuentaShell
      user={user}
      titulo="Estado de Envíos y Trazabilidad"
      descripcion={`Seguimiento en tiempo real de tus envíos locales en ${PRODUCT_NAME} San Juan.`}
    >
      {error && <Alert>{error}</Alert>}

      {!pedidos ? (
        error ? null : <PageSkeleton />
      ) : activos.length === 0 ? (
        <EmptyState
          icono="truck"
          titulo="No tenés envíos para seguir"
          acciones={
            <Link href="/mis-compras" className="btn btn-secondary">
              Ver mis compras
            </Link>
          }
        >
          Cuando una tienda procese tu compra, vas a ver acá la línea de tiempo: procesando, repartidor, en camino y
          entregado.
        </EmptyState>
      ) : (
        <div className="cuenta-trazabilidad">
          {activos.map((envio) => {
            const detalle = detalles[envio.pedidoId];
            const parte = detalle?.partes[envio.parteIdx];
            const pasos = envio.modalidad === 'retiro_en_local' ? PASOS_RETIRO : PASOS_ENTREGA;
            const actual = pasoActual(envio.estado, envio.modalidad);
            const producto =
              parte?.items.map((i) => i.nombre).join(', ') ||
              (detalle
                ? `${detalle.partes.reduce((n, p) => n + p.items.reduce((a, i) => a + i.cantidad, 0), 0)} unidad(es)`
                : 'Cargando productos…');
            const monto = parte?.subtotal ?? envio.total;
            const dir = detalle?.direccion_envio;
            const logs = [...(parte?.historial ?? [])].reverse();

            return (
              <article key={`${envio.pedidoId}-${envio.parteIdx}`} className="cuenta-envio-card">
                <header className="cuenta-envio-card-cabecera">
                  <div>
                    <strong>
                      Pedido #{envio.numero}
                      {envio.tienda ? ` — ${envio.tienda}` : ''}
                    </strong>
                    <span>Producto: {producto}</span>
                  </div>
                  <em>{formatPrice(monto)}</em>
                </header>

                <div className="cuenta-envio-timeline-bloque">
                  <h3 className="cuenta-envio-timeline-titulo">Línea de Tiempo del Pedido</h3>
                  <ol className="cuenta-envio-timeline" aria-label="Línea de tiempo del envío">
                    {pasos.map((paso, idx) => {
                      const step = idx + 1;
                      const hecho = step < actual || (envio.estado === 'entregado' && step <= actual);
                      const corriente = envio.estado !== 'entregado' && step === actual;
                      const completo = envio.estado === 'entregado' && step === 4;
                      return (
                        <li
                          key={paso.label}
                          className={
                            hecho || completo ? 'is-hecho' : corriente ? 'is-actual' : undefined
                          }
                          aria-current={corriente ? 'step' : undefined}
                        >
                          <span className="cuenta-envio-timeline-punto" aria-hidden="true">
                            {hecho || completo ? '✓' : step}
                          </span>
                          <div>
                            <strong>{paso.label}</strong>
                            <span>
                              {corriente || completo
                                ? descActual(envio.estado, envio.modalidad)
                                : paso.desc}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                <div className="cuenta-envio-historial">
                  <strong>Historial de Seguimiento</strong>
                  {logs.length === 0 ? (
                    <p>Todavía no hay movimientos registrados para este envío.</p>
                  ) : (
                    <ul>
                      {logs.map((h, n) => (
                        <li key={`${h.fecha}-${n}`}>
                          <time dateTime={h.fecha}>{horaLog(h.fecha)}</time>
                          <span>{ESTADO_PEDIDO[h.estado]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {envio.modalidad === 'entrega_plataforma' && dir && (
                  <p className="cuenta-envio-destino">
                    <strong>Dirección de Destino:</strong> {dir.calle} {dir.numero}
                    {dir.piso_depto ? `, ${dir.piso_depto}` : ''}, {dir.localidad}, {dir.provincia}
                    {dir.referencias ? ` (${dir.referencias})` : ''}
                  </p>
                )}
                {envio.modalidad === 'retiro_en_local' && parte?.tienda && (
                  <p className="cuenta-envio-destino">
                    <strong>Retiro en:</strong> {parte.tienda.direccion}, {parte.tienda.localidad}
                    {parte.tienda.telefono ? ` · Tel. ${parte.tienda.telefono}` : ''}
                  </p>
                )}

                <Link href={`/mis-compras/${envio.pedidoId}`} className="cuenta-ticket-btn">
                  Ver Ticket ›
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </CuentaShell>
  );
}
