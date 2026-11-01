import { z } from 'zod';

// Los estados a los que puede mover el comercio; la base valida desde cuál.
export const ESTADOS_COMERCIO = [
  'en_preparacion',
  'listo_para_recoleccion',
  'listo_para_retiro',
  'entregado',
  'cancelado',
] as const;

export const orderStatusSchema = z.object({
  body: z.object({
    estado: z.enum(ESTADOS_COMERCIO, { errorMap: () => ({ message: 'Estado inválido' }) }),
    motivo: z.string().trim().max(300, 'Máximo 300 caracteres').optional().nullable(),
  }),
});

export type OrderStatusInput = z.infer<typeof orderStatusSchema>['body'];
