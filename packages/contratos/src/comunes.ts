import { z } from 'zod';

// Formato de uuid sin exigir versión: la base también tiene ids fijos cargados a mano.
export const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'No es un id válido');

export const contador = z.number().int().nonnegative();
