import { z } from 'zod';

const uuid = z.string().uuid('Identificador inválido');
const idParams = z.object({ id: uuid });
const pagina = z.coerce.number().int().min(1).max(1000).optional();
const buscar = z.string().trim().max(100).optional();
const motivo = (texto: string) =>
  z
    .string({ required_error: texto })
    .trim()
    .min(5, `${texto} (al menos 5 caracteres)`)
    .max(500, 'Puede tener hasta 500 caracteres');
const notaOpcional = z.string().trim().max(500, 'La nota puede tener hasta 500 caracteres').optional();

export const idSchema = z.object({ params: idParams });

// ---------- Usuarios (soporte) ----------
export const usersQuery = z.object({
  filtro: z.enum(['todos', 'vendedores', 'compradores', 'equipo', 'bloqueados']).optional(),
  buscar,
  pagina,
});

export const blockUserSchema = z.object({
  params: idParams,
  body: z.object({ motivo: motivo('Contá el motivo del bloqueo') }),
});

export const unblockUserSchema = z.object({
  params: idParams,
  body: z.object({ nota: notaOpcional }),
});

// ---------- Pedidos (soporte, finanzas y logística) ----------
export const ordersQuery = z.object({
  vista: z.enum(['todos', 'en_curso', 'pendiente_pago', 'reembolsos', 'cancelados', 'entregados']).optional(),
  buscar,
  pagina,
});

export const cancelPartSchema = z.object({
  params: z.object({ id: uuid, parteId: uuid }),
  body: z.object({ motivo: motivo('Contale al comprador y a la tienda el motivo') }),
});

export const refundSchema = z.object({
  params: idParams,
  body: z.object({
    parteId: uuid,
    monto: z.coerce
      .number({ invalid_type_error: 'Ingresá un monto' })
      .positive('Ingresá un monto mayor a cero')
      .max(99999999, 'Monto inválido'),
    motivo: motivo('Contale al comprador el motivo'),
  }),
});

export const processRefundSchema = z.object({
  params: z.object({ id: uuid, reembolsoId: uuid }),
  body: z.object({
    aprobar: z.boolean({ errorMap: () => ({ message: 'Elegí si se procesa o se rechaza' }) }),
    nota: notaOpcional,
  }),
});

// ---------- Planes y suscripciones (finanzas) ----------
const limite = z.coerce
  .number({ invalid_type_error: 'Ingresá un número' })
  .int('Ingresá un número entero')
  .min(0, 'El límite no puede ser negativo')
  .nullable();

const datosPlan = z.object({
  nombre: z.string().trim().min(2, 'El nombre tiene que tener al menos 2 caracteres').max(40, 'Hasta 40 caracteres'),
  precio_mensual: z.coerce
    .number({ invalid_type_error: 'Ingresá un precio' })
    .min(0, 'El precio no puede ser negativo')
    .max(99999999, 'Precio inválido'),
  max_productos: limite,
  max_empleados: limite,
  activo: z.boolean().default(true),
});

export const createPlanSchema = z.object({ body: datosPlan });
export const updatePlanSchema = z.object({ params: idParams, body: datosPlan });
export const orderPlanSchema = z.object({
  params: idParams,
  body: z.object({ direccion: z.enum(['subir', 'bajar'], { errorMap: () => ({ message: 'Dirección inválida' }) }) }),
});

export const subscriptionsQuery = z.object({
  vista: z.enum(['vigentes', 'por_vencer', 'en_gracia', 'vencidas', 'canceladas', 'todas']).optional(),
  plan: uuid.optional(),
  buscar,
  pagina,
});

export const extendSubscriptionSchema = z.object({
  params: idParams,
  body: z.object({
    dias: z.coerce
      .number({ invalid_type_error: 'Ingresá los días' })
      .int('Ingresá un número entero')
      .min(1, 'Se extiende entre 1 y 90 días')
      .max(90, 'Se extiende entre 1 y 90 días'),
    motivo: motivo('Anotá el motivo'),
  }),
});

export const subscriptionPaymentSchema = z.object({
  params: idParams,
  body: z.object({
    referencia: z.string().trim().max(60, 'La referencia puede tener hasta 60 caracteres').optional(),
  }),
});

export const cancelSubscriptionSchema = z.object({
  params: idParams,
  body: z.object({ motivo: motivo('Anotá el motivo') }),
});

export type UsersQuery = z.infer<typeof usersQuery>;
export type OrdersQuery = z.infer<typeof ordersQuery>;
export type RefundInput = z.infer<typeof refundSchema>['body'];
export type PlanInput = z.infer<typeof datosPlan>;
export type SubscriptionsQuery = z.infer<typeof subscriptionsQuery>;
