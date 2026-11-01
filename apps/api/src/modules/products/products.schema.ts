import { z } from 'zod';

const uuid = (mensaje: string) => z.string().uuid(mensaje);

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => v || null)
    .nullable()
    .optional();

const importe = (mensaje: string) =>
  z
    .number({ required_error: mensaje, invalid_type_error: mensaje })
    .min(0, 'No puede ser negativo')
    .max(9_999_999_999.99, 'Importe demasiado alto');

const variante = z
  .object({
    opciones: z
      .array(z.object({ atributo_id: uuid('Opción inválida'), opcion_id: uuid('Opción inválida') }))
      .default([]),
    precio: importe('Ingresá el precio'),
    precio_oferta: importe('Precio de oferta inválido').nullable().optional(),
    stock: z
      .number({ required_error: 'Ingresá el stock', invalid_type_error: 'Ingresá el stock' })
      .int('El stock es un número entero')
      .min(0, 'No puede ser negativo'),
    sku: textoOpcional(60),
  })
  .refine((v) => v.precio_oferta == null || v.precio_oferta < v.precio, {
    message: 'La oferta tiene que ser menor que el precio',
    path: ['precio_oferta'],
  });

const valorAtributo = z.object({
  atributo_id: uuid('Atributo inválido'),
  valor_texto: z.string().trim().max(200).nullable().optional(),
  valor_numero: z.number().nullable().optional(),
  opcion_id: uuid('Opción inválida').nullable().optional(),
});

export const productSchema = z.object({
  body: z.object({
    categoria_id: uuid('Elegí una categoría'),
    nombre: z
      .string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(120, 'Máximo 120 caracteres'),
    descripcion: textoOpcional(5000),
    atributos: z.array(valorAtributo).default([]),
    variantes: z.array(variante).min(1, 'Cargá al menos una variante con precio'),
  }),
});

export const productStateSchema = z.object({
  body: z.object({
    estado: z.enum(['borrador', 'publicado', 'pausado', 'archivado'], {
      errorMap: () => ({ message: 'Estado inválido' }),
    }),
  }),
});

export type ProductInput = z.infer<typeof productSchema>['body'];
export type ProductState = z.infer<typeof productStateSchema>['body']['estado'];
