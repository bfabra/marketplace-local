import { formatDate } from '@/lib/utils';

/** Retención del historial de compras del cliente (#profile → purchases). */
export const MESES_HISTORIAL_COMPRAS = 6;

export function fechaLimiteHistorial(desde = new Date()) {
  const d = new Date(desde);
  d.setMonth(d.getMonth() - MESES_HISTORIAL_COMPRAS);
  return d;
}

/** Fecha en que el ticket sale del historial del cliente (compra + 6 meses). */
export function fechaExpiraHistorial(creadoEn: string) {
  const d = new Date(creadoEn);
  d.setMonth(d.getMonth() + MESES_HISTORIAL_COMPRAS);
  return d;
}

export function expiraHistorialTexto(creadoEn: string) {
  return formatDate(fechaExpiraHistorial(creadoEn).toISOString());
}

export function estaEnHistorial(creadoEn: string, estadoPago?: string) {
  if (estadoPago === 'pendiente') return true;
  return new Date(creadoEn) >= fechaLimiteHistorial();
}

export function fechaCompraTexto(creadoEn: string) {
  return new Date(creadoEn).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
