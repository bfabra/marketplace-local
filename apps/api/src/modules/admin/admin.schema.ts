import { z } from 'zod';

const estadoTienda = z.enum(['pendiente', 'activa', 'suspendida', 'vencida', 'archivada']);

const idParams = z.object({ id: z.string().uuid('Identificador inválido') });
const pagina = z.coerce.number().int().min(1).max(1000).optional();
const buscar = z.string().trim().max(100).optional();

export const storesQuery = z.object({ estado: estadoTienda.optional(), buscar, pagina });

export const idParamsSchema = z.object({ params: idParams });

// "vencida" la pone el sistema cuando termina la suscripción, no administración.
export const changeStoreStateSchema = z.object({
  params: idParams,
  body: z.object({
    estado: z.enum(['pendiente', 'activa', 'suspendida', 'archivada'], {
      errorMap: () => ({ message: 'Estado inválido' }),
    }),
    motivo: z.string().trim().max(500, 'El motivo puede tener hasta 500 caracteres').optional(),
  }),
});

export const reviewPolicySchema = z.object({
  params: idParams,
  body: z.object({
    politica: z.enum(['automatica', 'siempre', 'nunca'], {
      errorMap: () => ({ message: 'Elegí cómo se revisan los productos' }),
    }),
  }),
});

export const productsQuery = z.object({
  vista: z.enum(['revision', 'rechazados', 'moderacion', 'publicados', 'todos']).optional(),
  tienda: z.string().uuid().optional(),
  buscar,
  pagina,
});

export const moderateProductSchema = z.object({
  params: idParams,
  body: z.object({
    accion: z.enum(['aprobar', 'rechazar', 'pausar', 'reactivar'], {
      errorMap: () => ({ message: 'Acción inválida' }),
    }),
    nota: z.string().trim().max(500, 'La nota puede tener hasta 500 caracteres').optional(),
  }),
});

// El superadmin no se asigna desde la web (script db:superadmin).
export const rolDelegable = z.enum(['moderacion', 'soporte', 'finanzas', 'logistica'], {
  errorMap: () => ({ message: 'Elegí un rol' }),
});

export const assignRoleSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('El correo no es válido'),
    rol: rolDelegable,
  }),
});

export const removeRoleSchema = z.object({
  params: z.object({ usuarioId: z.string().uuid('Identificador inválido'), rol: rolDelegable }),
});

const storeRoleBody = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(40, 'Máximo 40 caracteres'),
  permisos: z.array(z.string()).min(1, 'Elegí al menos un permiso'),
});

export const createStoreRoleSchema = z.object({ body: storeRoleBody });
export const updateStoreRoleSchema = z.object({ params: idParams, body: storeRoleBody });

export const saveSettingSchema = z.object({
  params: z.object({ clave: z.string().regex(/^[a-z_]{2,60}$/, 'Parámetro inválido') }),
  body: z.object({
    valor: z.union([z.boolean(), z.number().int('Ingresá un número entero')], {
      errorMap: () => ({ message: 'Valor inválido' }),
    }),
  }),
});

// Tablas que registra la auditoría (trigger "auditar", migraciones ..._1100, ..._2800 a ..._3100 y ..._4000).
export const entidadAuditada = z.enum([
  'rubros',
  'bloqueos_cuenta',
  'reembolsos',
  'pagos_suscripcion',
  'categorias',
  'categorias_atributos',
  'atributos',
  'atributo_opciones',
  'provincias',
  'localidades',
  'planes',
  'roles_plataforma',
  'tiendas',
  'suscripciones',
  'miembros_tienda',
  'roles_tienda',
  'roles_permisos',
  'configuracion',
  'tarifas_envio',
  'productos',
  'variantes',
  'repartidores',
]);

// El período llega como instantes ISO: el navegador calcula los días en la hora de quien mira.
export const activityFilters = z
  .object({
    entidad: entidadAuditada.optional(),
    accion: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
    origen: z.enum(['personas', 'sistema']).optional(),
    desde: z.string().datetime({ offset: true, message: 'Fecha "desde" inválida' }).optional(),
    hasta: z.string().datetime({ offset: true, message: 'Fecha "hasta" inválida' }).optional(),
    buscar,
  })
  .refine((f) => !f.desde || !f.hasta || new Date(f.desde) < new Date(f.hasta), {
    message: 'La fecha "desde" tiene que ser anterior a la fecha "hasta"',
  });

export const activityQuery = z.intersection(
  activityFilters,
  z.object({ antes: z.coerce.number().int().positive().optional() })
);

export type ActivityFilters = z.infer<typeof activityFilters>;
export type ActivityQuery = z.infer<typeof activityQuery>;
export type StoresQuery = z.infer<typeof storesQuery>;
export type ProductsQuery = z.infer<typeof productsQuery>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>['body'];
export type StoreRoleInput = z.infer<typeof storeRoleBody>;
export type ChangeStoreStateInput = z.infer<typeof changeStoreStateSchema>['body'];
export type ModerateProductInput = z.infer<typeof moderateProductSchema>['body'];
