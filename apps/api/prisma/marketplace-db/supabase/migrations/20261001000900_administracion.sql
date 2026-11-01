-- ============================================================================
-- MÓDULO 9 · Administración
-- Tablas: auditoria, configuracion
-- ============================================================================

-- Registro de cambios sensibles. Nadie la puede editar ni borrar.
create table public.auditoria (
  id          bigint generated always as identity primary key,
  actor_id    uuid,                     -- quién hizo el cambio (null = el sistema)
  tienda_id   uuid,                     -- para que cada dueño vea lo de su tienda
  accion      text not null,            -- INSERT, UPDATE o DELETE
  entidad     text not null,            -- nombre de la tabla
  entidad_id  text,
  antes       jsonb,
  despues     jsonb,
  creado_en   timestamptz not null default now()
);
create index on public.auditoria (tienda_id, creado_en desc);
create index on public.auditoria (entidad, entidad_id);

create or replace function public.tg_auditoria_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'La auditoría no se puede modificar ni borrar';
end $$;

create trigger auditoria_inmutable
  before update or delete on public.auditoria
  for each row execute function public.tg_auditoria_inmutable();

-- Parámetros que el admin cambia sin programar.
create table public.configuracion (
  clave          text primary key,
  valor          jsonb not null,
  descripcion    text,
  actualizado_en timestamptz not null default now()
);

-- Lee un parámetro. Ej.: public.config_int('minutos_reserva_stock')
create or replace function public.config(p_clave text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select valor from public.configuracion where clave = p_clave
$$;

create or replace function public.config_int(p_clave text)
returns integer language sql stable set search_path = '' as $$
  select (public.config(p_clave))::text::integer
$$;

create or replace function public.config_bool(p_clave text)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((public.config(p_clave))::text::boolean, false)
$$;
