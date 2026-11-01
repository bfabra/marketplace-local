-- ============================================================================
-- MÓDULO 1 · Base, identidad y ubicación
-- Tablas: provincias, localidades, perfiles, direcciones, roles_plataforma
-- ============================================================================

-- Extensiones para la búsqueda: ignorar acentos y tolerar errores de tipeo.
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- "unaccent" no se puede usar en índices tal cual; esta versión sí.
create or replace function public.f_unaccent(texto text)
returns text language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, texto) $$;

-- Mantiene al día la columna actualizado_en de cualquier tabla.
create or replace function public.tg_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- Ubicación: provincia → localidad
-- ----------------------------------------------------------------------------
create table public.provincias (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  slug           text not null unique,
  activa         boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.provincias is 'San Juan activa al lanzar; otras provincias se agregan como filas, sin cambiar el modelo.';

create table public.localidades (
  id             uuid primary key default gen_random_uuid(),
  provincia_id   uuid not null references public.provincias(id),
  nombre         text not null,
  slug           text not null,
  activa         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (provincia_id, slug)
);
create index on public.localidades (provincia_id);

-- ----------------------------------------------------------------------------
-- Perfiles: datos públicos de cada cuenta (la cuenta en sí vive en auth.users)
-- ----------------------------------------------------------------------------
create table public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text,
  apellido       text,
  telefono       text,
  avatar_url     text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.perfiles is 'Se crea solo al registrarse. La cuenta es gratuita.';

-- Crea el perfil automáticamente cuando alguien se registra en Supabase Auth.
create or replace function public.tg_crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, apellido)
  values (new.id,
          new.raw_user_meta_data ->> 'nombre',
          new.raw_user_meta_data ->> 'apellido');
  return new;
end $$;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.tg_crear_perfil();

-- ----------------------------------------------------------------------------
-- Direcciones de los clientes
-- ----------------------------------------------------------------------------
create table public.direcciones (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  alias          text,
  calle          text not null,
  numero         text not null,
  piso_depto     text,
  localidad_id   uuid not null references public.localidades(id),
  codigo_postal  text,
  referencias    text,
  es_principal   boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.direcciones (usuario_id);
-- Una sola dirección principal por usuario.
create unique index direcciones_una_principal
  on public.direcciones (usuario_id) where es_principal;

-- ----------------------------------------------------------------------------
-- Roles de la plataforma (administración)
-- ----------------------------------------------------------------------------
create type public.rol_plataforma as enum
  ('superadmin', 'moderacion', 'soporte', 'finanzas', 'logistica');

create table public.roles_plataforma (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  rol            public.rol_plataforma not null,
  creado_en      timestamptz not null default now(),
  unique (usuario_id, rol)
);
comment on table public.roles_plataforma is 'Un único superadmin, que delega los demás roles.';
-- Un solo superadministrador en toda la plataforma.
create unique index roles_plataforma_un_superadmin
  on public.roles_plataforma (rol) where rol = 'superadmin';
