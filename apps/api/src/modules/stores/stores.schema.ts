import { z } from 'zod';
import { cuitValido, formatearCuit } from '../../common/utils/cuit.js';

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => v || null)
    .nullable()
    .optional();

const datosTienda = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(80, 'Máximo 80 caracteres'),
  descripcion: textoOpcional(500),
  cuit: z
    .string()
    .trim()
    .refine(cuitValido, 'El CUIT no es válido (son 11 números, por ejemplo 20-12345678-6)')
    .transform(formatearCuit),
  razon_social: textoOpcional(120),
  telefonos: z
    .array(
      z.object({
        pais: z.string().trim().regex(/^\+\d{1,4}$/, 'Elegí la característica del país'),
        numero: z
          .string()
          .trim()
          .max(20, 'Máximo 20 caracteres')
          .refine((v) => v === '' || (/^[\d ()-]+$/.test(v) && v.replace(/\D/g, '').length >= 6), 'El teléfono no es válido'),
        tipo: z.enum(['whatsapp', 'celular', 'fijo'], { errorMap: () => ({ message: 'Elegí el tipo de teléfono' }) }),
      })
    )
    .max(5, 'Podés cargar hasta 5 teléfonos')
    .transform((lista) => lista.filter((t) => t.numero !== ''))
    .optional(),
  ubicacion: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'El correo no es válido')
    .transform((v) => v || null)
    .nullable()
    .optional(),
  localidad_id: z.string().uuid('Elegí una localidad'),
  direccion: z
    .string()
    .trim()
    .min(5, 'Ingresá la dirección del local')
    .max(200, 'Máximo 200 caracteres'),
  rubro_id: z.string({ required_error: 'Elegí el rubro principal de tu negocio' }).uuid('Elegí el rubro principal de tu negocio'),
  subrubro_id: z
    .string()
    .uuid('Elegí un subrubro de la lista')
    .or(z.literal('').transform(() => null))
    .nullable()
    .optional(),
  especialidades: z
    .array(z.string().uuid('Elegí especialidades de la lista'))
    .max(20, 'Podés marcar hasta 20 especialidades')
    .optional(),
});

export const createStoreSchema = z.object({ body: datosTienda });
export const updateStoreSchema = z.object({ body: datosTienda.partial() });

export const googleMapsSchema = z.object({
  query: z.object({
    q: z.string().trim().min(3, 'Escribí el nombre del local o pegá el enlace de Google Maps').max(500),
  }),
});

export const changePlanSchema = z.object({
  body: z.object({ plan_id: z.string().uuid('Elegí un plan') }),
});

export type CreateStoreInput = z.infer<typeof datosTienda>;
export type UpdateStoreInput = Partial<CreateStoreInput>;
