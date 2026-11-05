import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';

// apps/api — independiente del cwd (raíz del monorepo o apps/api).
const apiRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * Entorno de variables:
 * - APP_ENV=local     → .env.local     (PostgreSQL en la PC)
 * - APP_ENV=supabase  → .env.supabase  (proyecto en la nube)
 * Si no hay .env.{APP_ENV}, se intenta el .env clásico (compatibilidad).
 */
const perfil = (process.env.APP_ENV || 'local').trim().toLowerCase();
const cargado = dotenv.config({ path: path.join(apiRoot, `.env.${perfil}`) });
if (cargado.error) {
  dotenv.config({ path: path.join(apiRoot, '.env') });
}

const opcional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3000'),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(10),
    WEB_ORIGIN: z.string().url().default('http://localhost:3001'),
    REDIS_URL: z.string().optional(),
    GOOGLE_CLIENT_ID: opcional,
    GOOGLE_MAPS_API_KEY: opcional,
    SMTP_HOST: opcional,
    SMTP_PORT: z.string().default('587').transform(Number),
    SMTP_USER: opcional,
    SMTP_PASS: opcional,
    MAIL_FROM: opcional,
    // Fotos: con ambas vars → Supabase Storage; sin ellas → disco local.
    SUPABASE_URL: opcional,
    SUPABASE_SERVICE_ROLE_KEY: opcional,
  })
  .superRefine((v, ctx) => {
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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SUPABASE_URL no es una URL válida',
          path: ['SUPABASE_URL'],
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
export const appEnv = perfil;
