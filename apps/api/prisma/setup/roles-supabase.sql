-- Crea los roles de Supabase (anon, authenticated, service_role) y deja que
-- marketplace_dev los use, como el usuario "postgres" en Supabase.
-- Sin esto, withUser() no puede aplicar las políticas RLS.
--
-- Ejecutar desde apps/api con el superusuario de PostgreSQL (se puede repetir):
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -v ON_ERROR_STOP=1 -f prisma/setup/roles-supabase.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

-- SET TRUE: puede cambiar a esos roles. INHERIT FALSE: no hereda sus permisos.
GRANT anon, authenticated, service_role TO marketplace_dev WITH INHERIT FALSE, SET TRUE;

\echo 'Listo: marketplace_dev puede usar los roles anon, authenticated y service_role.'
