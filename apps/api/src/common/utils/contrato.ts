import { verificar, type Contrato } from '@marketplace/contratos';
import { env } from '../../config/env.js';

/**
 * Fuera de producción comprueba que lo que devolvió un pkg_* cumpla el contrato que usa la web:
 * si la base cambió la forma, responde 500 y el log dice qué campo no coincide.
 * En producción devuelve los datos sin revisarlos.
 */
export const conContrato = <T>(contrato: Contrato<T>, origen: string, datos: unknown): T =>
  env.NODE_ENV === 'production' ? (datos as T) : verificar(contrato, origen, datos);
