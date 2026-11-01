import { Prisma } from '@prisma/client';
import { llamar, prisma } from '../../config/db.js';

export const MENSAJE_CUENTA_BLOQUEADA = 'Tu cuenta está bloqueada. Escribinos a soporte para resolverlo.';

export interface ControlSesion {
  bloqueada: boolean;
  /** Las sesiones emitidas antes de este momento (ms) ya no valen: cambió la contraseña. */
  sesionesDesde: number | null;
}

// Cada pedido con sesión consulta si la cuenta está bloqueada y desde cuándo
// valen sus sesiones. Se recuerda unos segundos para no ir a la base en cada
// pedido; bloquear o cambiar la contraseña lo olvida en el acto en este proceso.
const TTL_MS = 30_000;
const MAX_ENTRADAS = 5_000;
const cache = new Map<string, ControlSesion & { vence: number }>();

export async function controlSesion(userId: string): Promise<ControlSesion> {
  const ahora = Date.now();
  const guardado = cache.get(userId);
  if (guardado && guardado.vence > ahora) return guardado;

  const r = await llamar<{ bloqueo: string | null; sesiones_desde: string | null }>(
    prisma,
    Prisma.sql`select pkg_auth.control_sesion(${userId}::uuid) as r`
  );
  const control = {
    bloqueada: r.bloqueo !== null,
    sesionesDesde: r.sesiones_desde ? new Date(r.sesiones_desde).getTime() : null,
  };
  if (cache.size >= MAX_ENTRADAS) cache.clear();
  cache.set(userId, { ...control, vence: ahora + TTL_MS });
  return control;
}

/** ¿El token (emitido en `iat`, segundos) es anterior al último cambio de contraseña? */
export const sesionVencida = (iat: number, control: ControlSesion) =>
  control.sesionesDesde !== null && iat < Math.floor(control.sesionesDesde / 1000);

export function olvidarBloqueo(userId: string) {
  cache.delete(userId);
}
