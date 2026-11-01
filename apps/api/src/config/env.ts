import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const opcional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  WEB_ORIGIN: z.string().url().default('http://localhost:3001'),
  REDIS_URL: z.string().optional(),
  // Ingresar con Google: id de cliente OAuth (tipo "Aplicación web").
  GOOGLE_CLIENT_ID: opcional,
  // Importar el local desde Google Maps: clave con "Places API (New)" habilitada.
  GOOGLE_MAPS_API_KEY: opcional,
  // Correo saliente (recuperar la contraseña). Sin SMTP_HOST, en desarrollo el
  // enlace se muestra en la consola del API; en producción no se ofrece.
  SMTP_HOST: opcional,
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: opcional,
  SMTP_PASS: opcional,
  MAIL_FROM: opcional,
  // Fotos en Supabase Storage (bucket "productos"). Sin estas vars, en local
  // se guardan en apps/api/uploads y se sirven en /api/uploads.
  SUPABASE_URL: opcional,
  SUPABASE_SERVICE_ROLE_KEY: opcional,
}).superRefine((v, ctx) => {
  const url = v.SUPABASE_URL;
  const key = v.SUPABASE_SERVICE_ROLE_KEY;
  if ((url && !key) || (!url && key)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Definí SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY juntas (o ninguna, para disco local)',
    });
  }
  if (url) {
    try {
      new URL(url);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SUPABASE_URL no es una URL válida', path: ['SUPABASE_URL'] });
    }
  }
});

export const env = envSchema.parse(process.env);
