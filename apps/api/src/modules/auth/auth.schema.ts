import { z } from 'zod';

const email = z.string({ required_error: 'Ingresá tu correo electrónico' }).trim().toLowerCase().email('El formato del correo electrónico no es válido');
const clave = z.string({ required_error: 'Ingresá una contraseña' }).min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'Máximo 72 caracteres');
const dni = z
  .string({ required_error: 'Ingresá tu DNI' })
  .trim()
  .transform((v) => v.replace(/[.\s-]/g, ''))
  .refine((v) => /^\d{7,8}$/.test(v), 'El DNI son 7 u 8 números, sin puntos');
const aceptaTerminos = z.literal(true, {
  errorMap: () => ({ message: 'Para crear tu cuenta aceptá los Términos y Condiciones' }),
});

export const registerSchema = z.object({
  body: z.object({
    email,
    password: clave,
    nombre: z.string({ required_error: 'Ingresá tu nombre' }).trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    apellido: z.string({ required_error: 'Ingresá tu apellido' }).trim().min(2, 'El apellido debe tener al menos 2 caracteres'),
    telefono: z.string().trim().max(30, 'Máximo 30 caracteres').optional(),
    dni,
    domicilio: z.object(
      {
        calle: z.string().trim().min(2, 'Ingresá la calle').max(120, 'Máximo 120 caracteres'),
        numero: z.string().trim().min(1, 'Ingresá la altura').max(10, 'Máximo 10 caracteres'),
        piso_depto: z.string().trim().max(30, 'Máximo 30 caracteres').optional(),
        localidad_id: z.string({ required_error: 'Elegí una localidad' }).uuid('Elegí una localidad'),
      },
      { required_error: 'Ingresá tu domicilio de entrega' }
    ),
    aceptaTerminos,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('El correo electrónico es requerido'),
    password: z.string().min(1, 'La contraseña es requerida'),
    recordarme: z.boolean().optional(),
  }),
});

export const googleSchema = z.object({
  body: z.object({
    credencial: z.string().min(20, 'Falta el token de Google'),
    aceptaTerminos: z.boolean().optional(),
  }),
});

export const recoverSchema = z.object({
  body: z.object({ email }),
});

export const resetSchema = z.object({
  body: z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/, 'El enlace no es válido'),
    password: clave,
  }),
});

export const resetTokenSchema = z.object({
  params: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'El enlace no es válido') }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
      apellido: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres'),
      telefono: z
        .string()
        .trim()
        .transform((t) => t || null)
        .nullable(),
      dni: z.literal('').transform(() => null).or(dni).nullable(),
    })
    .partial(),
});

export const changePasswordSchema = z.object({
  body: z.object({
    actual: z.string().optional(),
    nueva: z.string().min(8, 'La contraseña nueva debe tener al menos 8 caracteres').max(72, 'Máximo 72 caracteres'),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type GoogleInput = z.infer<typeof googleSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
