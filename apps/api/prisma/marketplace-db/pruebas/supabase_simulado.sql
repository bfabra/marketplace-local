-- ============================================================================
-- SOLO PARA PRUEBAS Y POSTGRESQL LOCAL. NO se ejecuta en Supabase.
-- Recrea lo mínimo que Supabase ya trae de fábrica: esquemas auth y extensions,
-- la tabla auth.users, la función auth.uid() y los roles anon, authenticated
-- y service_role. Así las migraciones se pueden probar sin una cuenta real.
-- Se puede ejecutar varias veces: los roles son del servidor, no de la base,
-- y sobreviven aunque la base se borre.
-- ============================================================================

create schema if not exists extensions;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  -- Hash bcrypt, igual que en Supabase Auth.
  encrypted_password text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table auth.users add column if not exists encrypted_password text;

-- Igual que en Supabase: el id del usuario sale del token de sesión.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth, extensions, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase da estos permisos por defecto a todo lo que se crea en "public";
-- las políticas RLS son las que después restringen qué filas ve cada uno.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
