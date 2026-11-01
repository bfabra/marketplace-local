-- ============================================================================
-- MÓDULO 3 · Equipo y permisos
-- Tablas: permisos, roles_tienda, roles_permisos, miembros_tienda, invitaciones
-- ============================================================================

-- Lista fija de permisos que se pueden dar a un empleado.
create table public.permisos (
  codigo      text primary key,         -- ej.: 'productos.editar'
  area        text not null,
  descripcion text not null
);

-- Roles: predefinidos (tienda_id vacío) o creados por cada tienda.
create table public.roles_tienda (
  id             uuid primary key default gen_random_uuid(),
  tienda_id      uuid references public.tiendas(id) on delete cascade,
  nombre         text not null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index roles_tienda_nombre_unico
  on public.roles_tienda (coalesce(tienda_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));

create table public.roles_permisos (
  rol_id         uuid not null references public.roles_tienda(id) on delete cascade,
  permiso_codigo text not null references public.permisos(codigo),
  primary key (rol_id, permiso_codigo)
);

-- Empleados de cada tienda. El dueño NO va acá (está en tiendas.propietario_id).
create type public.estado_miembro as enum ('invitado', 'activo', 'suspendido', 'retirado');

create table public.miembros_tienda (
  id             uuid primary key default gen_random_uuid(),
  tienda_id      uuid not null references public.tiendas(id) on delete cascade,
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  rol_id         uuid not null references public.roles_tienda(id),
  estado         public.estado_miembro not null default 'activo',
  invitado_por   uuid references public.perfiles(id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tienda_id, usuario_id)
);
create index on public.miembros_tienda (usuario_id);

-- Invitaciones por correo (sirven aunque la persona todavía no tenga cuenta).
create type public.estado_invitacion as enum ('pendiente', 'aceptada', 'vencida', 'anulada');

create table public.invitaciones (
  id             uuid primary key default gen_random_uuid(),
  tienda_id      uuid not null references public.tiendas(id) on delete cascade,
  email          text not null,
  rol_id         uuid not null references public.roles_tienda(id),
  token_hash     text not null unique,     -- se guarda el hash, nunca el token
  expira_en      timestamptz not null default now() + interval '7 days',
  estado         public.estado_invitacion not null default 'pendiente',
  invitado_por   uuid references public.perfiles(id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.invitaciones (tienda_id);
