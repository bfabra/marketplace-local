'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type {
  EstadoPedidoTienda,
  EstadoReembolso,
  EstadoSuscripcion,
  RolPlataforma,
} from '@/lib/api-client';
import { COLOR_PEDIDO, ESTADO_PEDIDO } from '@/lib/pedidos';
import { formatDate } from '@/lib/utils';

export const ROL_LABEL: Record<RolPlataforma, string> = {
  superadmin: 'Superadmin',
  moderacion: 'Moderación',
  soporte: 'Soporte',
  finanzas: 'Finanzas',
  logistica: 'Logística',
};

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });

export function EstadoPedido({ estado }: { estado: EstadoPedidoTienda }) {
  return <span className={`badge ${COLOR_PEDIDO[estado]}`}>{ESTADO_PEDIDO[estado]}</span>;
}

export const ESTADO_REEMBOLSO: Record<EstadoReembolso, { label: string; badge: string }> = {
  pendiente: { label: 'Pendiente', badge: 'badge-pendiente' },
  procesado: { label: 'Devuelto', badge: 'badge-activa' },
  rechazado: { label: 'Rechazado', badge: 'badge-archivada' },
};

export const ESTADO_SUSCRIPCION: Record<EstadoSuscripcion, { label: string; badge: string }> = {
  pendiente: { label: 'Esperando el pago', badge: 'badge-pendiente' },
  activa: { label: 'Al día', badge: 'badge-activa' },
  en_gracia: { label: 'En gracia', badge: 'badge-pendiente' },
  vencida: { label: 'Vencida', badge: 'badge-vencida' },
  cancelada: { label: 'Cancelada', badge: 'badge-archivada' },
  rechazada: { label: 'Pago rechazado', badge: 'badge-suspendida' },
};

export function EstadoSuscripcionBadge({ estado }: { estado: EstadoSuscripcion }) {
  const e = ESTADO_SUSCRIPCION[estado];
  return <span className={`badge ${e.badge}`}>{e.label}</span>;
}

/** Días que faltan (negativo si ya pasó). */
export const diasHasta = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

export const limite = (n: number | null, unidad: string) => (n === null ? `${unidad} ilimitados` : `${n} ${unidad}`);

/** Qué vence y cuándo, en palabras. */
export function vencimiento(s: { estado: EstadoSuscripcion; fin_periodo: string | null; gracia_hasta: string | null }) {
  if (s.estado === 'en_gracia' && s.gracia_hasta) {
    const d = diasHasta(s.gracia_hasta);
    return { texto: d > 0 ? `La tienda vence en ${d} ${d === 1 ? 'día' : 'días'}` : 'La tienda vence hoy', alerta: true };
  }
  if (s.estado === 'activa' && s.fin_periodo) {
    const d = diasHasta(s.fin_periodo);
    if (d <= 0) return { texto: 'Terminó el período: hoy pasa a gracia', alerta: true };
    return { texto: `Renueva el ${formatDate(s.fin_periodo)}`, alerta: d <= 7 };
  }
  if (s.estado === 'activa') return { texto: 'Sin vencimiento', alerta: false };
  return null;
}

export function SuscripcionesTabs() {
  const pathname = usePathname();
  const enPlanes = pathname.startsWith('/admin/suscripciones/planes');
  return (
    <nav className="tabs" aria-label="Suscripciones y planes">
      <Link href="/admin/suscripciones" className="tab" aria-current={!enPlanes ? 'page' : undefined}>
        Suscripciones
      </Link>
      <Link href="/admin/suscripciones/planes" className="tab" aria-current={enPlanes ? 'page' : undefined}>
        Planes
      </Link>
    </nav>
  );
}
