import { z } from 'zod';

const opcional = (max: number, mensaje: string) => z.string().trim().max(max, mensaje).optional().nullable();

export const addressSchema = z.object({
  body: z.object({
    alias: opcional(40, 'El nombre puede tener hasta 40 caracteres'),
    calle: z.string().trim().min(2, 'Completá la calle').max(120, 'Máximo 120 caracteres'),
    numero: z.string().trim().min(1, 'Completá el número').max(10, 'Máximo 10 caracteres'),
    piso_depto: opcional(20, 'Máximo 20 caracteres'),
    localidad_id: z.string().uuid('Elegí una localidad'),
    codigo_postal: opcional(10, 'Máximo 10 caracteres'),
    referencias: opcional(200, 'Máximo 200 caracteres'),
    es_principal: z.boolean().optional(),
  }),
});

export const createOrderSchema = z.object({
  body: z.object({
    direccion_id: z.string().uuid('Elegí una dirección de entrega').optional().nullable(),
    tiendas_retiro: z.array(z.string().uuid()).max(100).default([]),
  }),
});

export const simulatedPaymentSchema = z.object({
  body: z.object({ aprobado: z.boolean({ required_error: 'Indicá si el pago se aprueba' }) }),
});

export type AddressInput = z.infer<typeof addressSchema>['body'];
export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
