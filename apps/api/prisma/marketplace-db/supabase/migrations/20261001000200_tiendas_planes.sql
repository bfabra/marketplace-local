-- ============================================================================
-- MÓDULO 2 · Tiendas y planes
-- Tablas: planes, tiendas, suscripciones, pagos_suscripcion, cuentas_mp_tienda
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Planes: parametrizables desde el panel admin (null = ilimitado)
-- ----------------------------------------------------------------------------
create table public.planes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  precio_mensual numeric(12,2) not null default 0 check (precio_mensual >= 0),
  max_productos  integer check (max_productos >= 0),   -- null = ilimitado
  max_empleados  integer check (max_empleados >= 0),   -- null = ilimitado
  es_gratis      boolean not null default false,
  activo         boolean not null default true,
  orden          integer not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Tiendas: un único dueño (propietario_id); un usuario puede tener varias
-- ----------------------------------------------------------------------------
create type public.estado_tienda as enum
  ('pendiente', 'activa', 'suspendida', 'vencida', 'archivada');

create table public.tiendas (
  id             uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references public.perfiles(id),
  nombre         text not null,
  slug           text not null unique,
  descripcion    text,
  logo_url       text,
  portada_url    text,
  cuit           text not null,
  razon_social   text,
  telefono       text,
  email          text,
  localidad_id   uuid not null references public.localidades(id),
  direccion      text not null,
  lat            numeric(9,6),
  lng            numeric(9,6),
  horarios       jsonb not null default '{}'::jsonb,
  estado         public.estado_tienda not null default 'pendiente',
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on column public.tiendas.propietario_id is 'Única fuente de verdad sobre el dueño. Los empleados van en miembros_tienda.';
create index on public.tiendas (propietario_id);
create index on public.tiendas (localidad_id) where estado = 'activa';

-- ----------------------------------------------------------------------------
-- Suscripciones: historial completo; una sola vigente por tienda
-- ----------------------------------------------------------------------------
create type public.estado_suscripcion as enum
  ('pendiente', 'activa', 'en_gracia', 'vencida', 'cancelada', 'rechazada');

create table public.suscripciones (
  id                uuid primary key default gen_random_uuid(),
  tienda_id         uuid not null references public.tiendas(id) on delete cascade,
  plan_id           uuid not null references public.planes(id),
  estado            public.estado_suscripcion not null default 'pendiente',
  inicio            timestamptz not null default now(),
  fin_periodo       timestamptz,          -- null en el plan gratis
  gracia_hasta      timestamptz,
  mp_preapproval_id text,                 -- id del débito automático en Mercado Pago
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index on public.suscripciones (tienda_id);
create unique index suscripciones_una_vigente
  on public.suscripciones (tienda_id)
  where estado in ('pendiente', 'activa', 'en_gracia');

create type public.estado_cobro as enum ('pendiente', 'aprobado', 'rechazado', 'reembolsado');

create table public.pagos_suscripcion (
  id              uuid primary key default gen_random_uuid(),
  suscripcion_id  uuid not null references public.suscripciones(id) on delete cascade,
  periodo         date not null,            -- primer día del mes cobrado
  monto           numeric(12,2) not null check (monto >= 0),
  estado          public.estado_cobro not null default 'pendiente',
  mp_payment_id   text unique,
  pagado_en       timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (suscripcion_id, periodo)
);

-- ----------------------------------------------------------------------------
-- Cuenta de Mercado Pago vinculada por cada tienda (OAuth)
-- Solo la usa el servidor: ningún usuario la puede leer, ni siquiera el dueño.
-- ----------------------------------------------------------------------------
create table public.cuentas_mp_tienda (
  id                  uuid primary key default gen_random_uuid(),
  tienda_id           uuid not null unique references public.tiendas(id) on delete cascade,
  mp_user_id          text not null,
  access_token_cifrado  text not null,   -- cifrar en el servidor antes de guardar
  refresh_token_cifrado text not null,
  expira_en           timestamptz not null,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
