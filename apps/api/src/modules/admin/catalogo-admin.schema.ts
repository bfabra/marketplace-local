import { z } from 'zod';

const uuid = z.string().uuid('Identificador inválido');
const idParams = z.object({ id: uuid });
const nombre = z
  .string()
  .trim()
  .min(2, 'El nombre tiene que tener al menos 2 caracteres')
  .max(60, 'El nombre puede tener hasta 60 caracteres');
const activa = z.object({ activa: z.boolean({ errorMap: () => ({ message: 'Elegí sí o no' }) }) });

export const idSchema = z.object({ params: idParams });

// ---------- Categorías y atributos ----------
const datosCategoria = z.object({
  nombre,
  padre_id: uuid.nullable().optional(),
  comision_pct: z.coerce
    .number({ invalid_type_error: 'Ingresá un número' })
    .min(0, 'La comisión no puede ser negativa')
    .max(100, 'La comisión no puede superar el 100 %'),
});

export const createCategorySchema = z.object({ body: datosCategoria });
export const updateCategorySchema = z.object({ params: idParams, body: datosCategoria });
export const activeSchema = z.object({ params: idParams, body: activa });
export const reviewCategorySchema = z.object({
  params: idParams,
  body: z.object({ requiere_revision: z.boolean({ errorMap: () => ({ message: 'Elegí sí o no' }) }) }),
});
export const orderCategorySchema = z.object({
  params: idParams,
  body: z.object({ direccion: z.enum(['subir', 'bajar'], { errorMap: () => ({ message: 'Dirección inválida' }) }) }),
});

const categoriaAtributoParams = z.object({ id: uuid, atributoId: uuid });
export const categoryAttributeSchema = z.object({
  params: categoriaAtributoParams,
  body: z.object({ obligatorio: z.boolean().default(false), define_variante: z.boolean().default(false) }),
});
export const removeCategoryAttributeSchema = z.object({ params: categoriaAtributoParams });

const datosAtributo = z.object({
  nombre: z.string().trim().min(2, 'El nombre tiene que tener al menos 2 caracteres').max(40, 'Hasta 40 caracteres'),
  tipo: z.enum(['texto', 'numero', 'lista', 'si_no'], { errorMap: () => ({ message: 'Elegí el tipo de dato' }) }),
  unidad: z.string().trim().max(10, 'La unidad puede tener hasta 10 caracteres').nullable().optional(),
  filtrable: z.boolean().default(false),
});
export const createAttributeSchema = z.object({ body: datosAtributo });
export const updateAttributeSchema = z.object({ params: idParams, body: datosAtributo });

const valorOpcion = z.object({
  valor: z.string().trim().min(1, 'Escribí la opción').max(40, 'La opción puede tener hasta 40 caracteres'),
});
export const createOptionSchema = z.object({ params: idParams, body: valorOpcion });
export const updateOptionSchema = z.object({ params: z.object({ id: uuid, opcionId: uuid }), body: valorOpcion });
export const removeOptionSchema = z.object({ params: z.object({ id: uuid, opcionId: uuid }) });

// ---------- Rubros ----------
const nombreRubro = z
  .string()
  .trim()
  .min(2, 'El nombre tiene que tener al menos 2 caracteres')
  .max(80, 'El nombre puede tener hasta 80 caracteres');
export const createRubroSchema = z.object({
  body: z.object({ nombre: nombreRubro, padre_id: uuid.nullable().optional() }),
});
export const updateRubroSchema = z.object({
  params: idParams,
  body: z
    .object({
      nombre: nombreRubro.optional(),
      descripcion: z.string().trim().max(120, 'La descripción puede tener hasta 120 caracteres').nullable().optional(),
    })
    .refine((b) => b.nombre !== undefined || b.descripcion !== undefined, 'Indicá qué querés cambiar'),
});

// ---------- Territorio ----------
export const territoryQuery = z.object({ provincia: uuid.optional() });
export const createProvinceSchema = z.object({ body: z.object({ nombre }) });
export const updateProvinceSchema = z.object({ params: idParams, body: z.object({ nombre }) });
export const createLocalitySchema = z.object({ params: idParams, body: z.object({ nombre }) });
export const updateLocalitySchema = z.object({
  params: z.object({ id: uuid, localidadId: uuid }),
  body: z.object({ nombre }),
});
export const shippingRateSchema = z.object({
  params: idParams,
  body: z.object({
    costo: z.coerce
      .number({ invalid_type_error: 'Ingresá un número' })
      .min(0, 'El costo no puede ser negativo')
      .max(10_000_000, 'El costo es demasiado alto'),
    activa: z.boolean().default(true),
  }),
});

export type CategoryInput = z.infer<typeof datosCategoria>;
export type CategoryAttributeInput = z.infer<typeof categoryAttributeSchema>['body'];
export type AttributeInput = z.infer<typeof datosAtributo>;
export type ShippingRateInput = z.infer<typeof shippingRateSchema>['body'];
