import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function crearBase() {
  const db = new PGlite({ extensions: { unaccent, pg_trgm } });
  const raiz = fileURLToPath(new URL('..', import.meta.url));
  await db.exec(readFileSync(raiz + 'pruebas/supabase_simulado.sql', 'utf8'));
  const dir = raiz + 'supabase/migrations/';
  for (const f of readdirSync(dir).sort()) {
    try { await db.exec(readFileSync(dir + f, 'utf8')); }
    catch (e) { throw new Error(`Falló ${f}: ${e.message}`); }
  }
  await db.exec(readFileSync(raiz + 'supabase/seed.sql', 'utf8'));
  return db;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = await crearBase();
  const r = await db.query(`select count(*) from pg_tables where schemaname='public'`);
  const p = await db.query(`select count(*) from pg_policies where schemaname='public'`);
  const sin = await db.query(`select tablename from pg_tables where schemaname='public' and not rowsecurity`);
  console.log('tablas:', r.rows[0].count, 'políticas:', p.rows[0].count, 'sin RLS:', sin.rows);
}
