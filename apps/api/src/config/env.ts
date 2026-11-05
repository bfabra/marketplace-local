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
 *
 * En Render/Vercel las vars vienen de process.env; dotenv no las pisa.
 * Cadenas vacías del panel se tratan como “no definidas” (si no, rompe .default()).
 */
const perfil = (process.env.APP_ENV || 'local').trim().toLowerCase();
const cargado = dotenv.config({ path: path.join(apiRoot, `.env.${perfil}`) });
if (cargado.error) {
  dotenv.config({ path: path.join(apiRoot, '.env') });
}

/** Render a veces crea la key con valor ""; Zod no aplica .default() en ese caso. */
const vacio = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const opcional = z.preprocess(
  vacio,
  z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.preprocess(vacio, z.string().default('3000')).transform(Number),
    // No usamos .url(): claves con @ # % sin encode rompen el parseo y son válidas para Prisma.
    DATABASE_URL: z.preprocess(
      vacio,
      z
        .string({ required_error: 'Falta DATABASE_URL (URI de Supabase en el panel de Render)' })
        .min(1)
        .refine((s) => /^postgres(ql)?:\/\//i.test(s), 'DATABASE_URL debe empezar con postgresql://')
    ),
    JWT_SECRET: z.preprocess(
      vacio,
      z.string({ required_error: 'Falta JWT_SECRET' }).min(10, 'JWT_SECRET debe tener al menos 10 caracteres')
    ),
    WEB_ORIGIN: z.preprocess(vacio, z.string().url().default('http://localhost:3001')),
    REDIS_URL: opcional,
    GOOGLE_CLIENT_ID: opcional,
    GOOGLE_MAPS_API_KEY: opcional,
    SMTP_HOST: opcional,
    SMTP_PORT: z.preprocess(vacio, z.string().default('587')).transform(Number),
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

function cargarEnv() {
  const r = envSchema.safeParse(process.env);
  if (r.success) return r.data;

  console.error('\n[env] Variables de entorno inválidas o faltantes:\n');
  for (const issue of r.error.issues) {
    const donde = issue.path.length ? issue.path.join('.') : '(general)';
    console.error(`  · ${donde}: ${issue.message}`);
  }
  console.error(
    '\nEn Render → Environment: DATABASE_URL, JWT_SECRET, WEB_ORIGIN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.\nVer docs/DESPLIEGUE.md § Environment Variables.\n'
  );
  process.exit(1);
}

export const env = cargarEnv();
export const appEnv = perfil;
