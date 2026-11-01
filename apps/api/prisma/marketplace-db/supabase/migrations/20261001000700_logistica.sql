-- ============================================================================
-- MÓDULO 7 · Logística (a cargo de la plataforma)
-- Tablas: tarifas_envio, repartidores, envios, recolecciones
-- Se entrega todo junto en una sola visita, con repartidores propios.
-- ============================================================================

-- Costo de envío por localidad. Lo fija el dueño de la plataforma; no hay envío gratis.
create table public.tarifas_envio (
  id             uuid primary key default gen_random_uuid(),
  localidad_id   uuid not null unique references public.localidades(id),
  costo          numeric(12,2) not null check (costo >= 0),
  activa         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.repartidores (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null unique references public.perfiles(id),
  nombre         text not null,
  telefono       text not null,
  vehiculo       text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Una sola entrega por compra.
create type public.estado_envio as enum
  ('pendiente', 'en_recoleccion', 'en_camino', 'entregado', 'fallido');

create table public.envios (
  id                  uuid primary key default gen_random_uuid(),
  pedido_id           uuid not null unique references public.pedidos(id) on delete cascade,
  repartidor_id       uuid references public.repartidores(id),
  direccion_destino   jsonb not null,        -- copia de la dirección
  costo               numeric(12,2) not null default 0,
  estado              public.estado_envio not null default 'pendiente',
  entregado_en        timestamptz,
  comprobante_entrega text,                  -- foto o firma en Storage
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index on public.envios (repartidor_id, estado);

-- Una recolección por cada tienda de la compra.
-- llegada_en y recolectado_en permiten medir cuánto esperó el repartidor.
create type public.estado_recoleccion as enum ('pendiente', 'asignada', 'recolectada', 'fallida');

create table public.recolecciones (
  id               uuid primary key default gen_random_uuid(),
  envio_id         uuid not null references public.envios(id) on delete cascade,
  pedido_tienda_id uuid not null unique references public.pedidos_tienda(id) on delete cascade,
  tienda_id        uuid not null references public.tiendas(id),
  repartidor_id    uuid references public.repartidores(id),
  estado           public.estado_recoleccion not null default 'pendiente',
  llegada_en       timestamptz,
  recolectado_en   timestamptz,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index on public.recolecciones (envio_id);
create index on public.recolecciones (tienda_id, estado);
create index on public.recolecciones (repartidor_id, estado);
