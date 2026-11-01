import type { ZodType } from 'zod';

export type Contrato<T> = ZodType<T>;

/**
 * Comprueba que `datos` cumpla el contrato y los devuelve tal cual (sin quitar campos de más).
 * Si no lo cumple, el error dice de dónde vienen los datos y qué campos no coinciden.
 */
export function verificar<T>(contrato: Contrato<T>, origen: string, datos: unknown): T {
  const r = contrato.safeParse(datos);
  if (!r.success) {
    const detalle = r.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(respuesta)'}: ${i.message}`)
      .join('; ');
    throw new Error(`${origen} no cumple su contrato: ${detalle}`);
  }
  return datos as T;
}
