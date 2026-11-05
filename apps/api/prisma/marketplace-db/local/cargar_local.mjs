// Aplica marketplace-db sobre un PostgreSQL local (sin Supabase).
//
//   node local/cargar_local.mjs              aplica solo las migraciones nuevas
//   node local/cargar_local.mjs --reiniciar  borra todo y carga desde cero
//   node local/cargar_local.mjs --sin-datos  no carga seed.sql en una base nueva
//
// Toma DATABASE_URL de apps/api/.env.local (APP_ENV=local) o .env.
// Registra lo aplicado en supabase_migrations.schema_migrations.
// pg_cron no existe en local: las tareas de tareas_programadas.sql se llaman a mano.

import pg from 'pg';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const apiRoot = fileURLToPath(new URL('../../..', import.meta.url));
const perfil = (process.env.APP_ENV || 'local').trim();
const candidatos = [`.env.${perfil}`, '.env'];
const args = new Set(process.argv.slice(2));
const reiniciar = args.has('--reiniciar');
const sinDatos = args.has('--sin-datos');

if (!process.env.DATABASE_URL) {
  for (const nombre of candidatos) {
    const archivoEnv = `${apiRoot}/${nombre}`;
    if (existsSync(archivoEnv)) {
      process.loadEnvFile(archivoEnv);
      break;
    }
  }
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (en apps/api/.env.local o apps/api/.env).');
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete('schema');
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
  console.error(`DATABASE_URL apunta a "${url.hostname}". Este script es solo para PostgreSQL local.`);
  process.exit(1);
}

const leer = (ruta) => readFileSync(raiz + ruta, 'utf8');
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();

try {
  if (reiniciar) {
    const { rows: paquetes } = await db.query(
      `select nspname from pg_namespace where nspname like 'pkg\\_%'`
    );
    for (const { nspname } of paquetes) await db.query(`drop schema if exists "${nspname}" cascade`);
    await db.query(`
      drop schema if exists public cascade;
      drop schema if exists auth cascade;
      drop schema if exists extensions cascade;
      drop schema if exists supabase_migrations cascade;
      create schema public;
    `);
    console.log('Base vaciada.');
  }

  const { rows: [estado] } = await db.query(`
    select
      (select count(*) from pg_tables where schemaname = 'public')::int as tablas,
      to_regclass('supabase_migrations.schema_migrations') is not null as registrada
  `);
  if (estado.tablas > 0 && !estado.registrada) {
    console.error('La base tiene tablas que no vienen de marketplace-db. Usa --reiniciar (borra todo).');
    process.exit(1);
  }

  await db.query(leer('pruebas/supabase_simulado.sql'));
  await db.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      name text,
      aplicada_en timestamptz not null default now()
    );
  `);

  const { rows } = await db.query('select version from supabase_migrations.schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.version));
  const baseNueva = aplicadas.size === 0;
  const pendientes = readdirSync(raiz + 'supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => !aplicadas.has(f.split('_')[0]));

  for (const f of pendientes) {
    const [version, ...resto] = f.replace(/\.sql$/, '').split('_');
    try {
      await db.query('begin');
      await db.query(leer('supabase/migrations/' + f));
      await db.query(
        'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)',
        [version, resto.join('_')],
      );
      await db.query('commit');
      console.log('  ✓', f);
    } catch (e) {
      await db.query('rollback');
      throw new Error(`Falló ${f}: ${e.message}`);
    }
  }
  if (pendientes.length === 0) console.log('No hay migraciones nuevas.');

  if (baseNueva && pendientes.length > 0 && !sinDatos) {
    await db.query(leer('supabase/seed.sql'));
    console.log('  ✓ seed.sql (datos de ejemplo)');
  }

  const { rows: [r] } = await db.query(`
    select
      (select count(*) from pg_tables where schemaname = 'public')::int as tablas,
      (select count(*) from pg_policies where schemaname = 'public')::int as politicas
  `);
  console.log(`Listo: ${r.tablas} tablas y ${r.politicas} políticas RLS en ${url.pathname.slice(1)}.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
