-- ============================================================================
-- MÓDULO 5 · Compras y pedidos
-- Tablas: carritos, carrito_items, pedidos, pedidos_tienda, pedido_items,
--         reservas_stock, historial_estados
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Carrito: uno por usuario. Sin sesión, vive en el navegador y se une al entrar.
-- ----------------------------------------------------------------------------
create table public.carritos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null unique references public.perfiles(id) on delete cascade,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.carrito_items (
  id             uuid primary key default gen_random_uuid(),
  carrito_id     uuid not null references public.carritos(id) on delete cascade,
  variante_id    uuid not null references public.variantes(id) on delete cascade,
  cantidad       integer not null check (cantidad > 0),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (carrito_id, variante_id)
);

-- ----------------------------------------------------------------------------
-- Pedido = la compra general (un número y un total para el cliente)
-- ----------------------------------------------------------------------------
create type public.estado_pago_pedido as enum
  ('pendiente', 'aprobado', 'rechazado', 'reembolsado_parcial', 'reembolsado');

create sequence public.pedidos_numero_seq start 1000;

create table public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  numero          bigint not null unique default nextval('public.pedidos_numero_seq'),
  comprador_id    uuid not null references public.perfiles(id),
  subtotal        numeric(12,2) not null default 0,
  costo_envio     numeric(12,2) not null default 0,   -- lo cobra la plataforma
  total           numeric(12,2) not null default 0,
  estado_pago     public.estado_pago_pedido not null default 'pendiente',
  direccion_envio jsonb,                              -- copia de la dirección al comprar
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index on public.pedidos (comprador_id, creado_en desc);

-- ----------------------------------------------------------------------------
-- Parte de cada tienda dentro de la compra.
-- El cliente ve cada parte por separado; cada comercio ve solo la suya.
-- El comercio NO envía: prepara y marca "listo para recolección".
-- ----------------------------------------------------------------------------
create type public.modalidad_entrega as enum ('entrega_plataforma', 'retiro_en_local');

create type public.estado_pedido_tienda as enum (
  'pendiente',               -- esperando el pago
  'pago_confirmado',
  'en_preparacion',
  'listo_para_recoleccion',  -- el comercio avisa: el repartidor puede pasar
  'listo_para_retiro',       -- solo con retiro en el local
  'recolectado',             -- el repartidor ya lo retiró de la tienda
  'en_camino',
  'entregado',
  'cancelado',               -- lo decidió alguien
  'rechazado'                -- falló el pago
);

create table public.pedidos_tienda (
  id                 uuid primary key default gen_random_uuid(),
  pedido_id          uuid not null references public.pedidos(id) on delete cascade,
  tienda_id          uuid not null references public.tiendas(id),
  modalidad          public.modalidad_entrega not null default 'entrega_plataforma',
  subtotal           numeric(12,2) not null default 0,
  comision           numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  estado             public.estado_pedido_tienda not null default 'pendiente',
  listo_en           timestamptz,
  motivo_cancelacion text,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  unique (pedido_id, tienda_id)
);
create index on public.pedidos_tienda (tienda_id, estado, creado_en desc);

-- ----------------------------------------------------------------------------
-- Productos comprados. Guarda copia de nombre y precio: si el producto
-- cambia o se borra después, el pedido no cambia.
-- ----------------------------------------------------------------------------
create table public.pedido_items (
  id                   uuid primary key default gen_random_uuid(),
  pedido_tienda_id     uuid not null references public.pedidos_tienda(id) on delete cascade,
  tienda_id            uuid not null references public.tiendas(id),
  variante_id          uuid references public.variantes(id) on delete set null,
  nombre_producto      text not null,
  descripcion_variante text,
  precio_unitario      numeric(12,2) not null check (precio_unitario >= 0),
  cantidad             integer not null check (cantidad > 0),
  subtotal             numeric(12,2) not null,
  creado_en            timestamptz not null default now()
);
create index on public.pedido_items (pedido_tienda_id);

-- ----------------------------------------------------------------------------
-- Reserva temporal de stock mientras el cliente paga (vence a los 15 minutos)
-- ----------------------------------------------------------------------------
create table public.reservas_stock (
  id          uuid primary key default gen_random_uuid(),
  variante_id uuid not null references public.variantes(id) on delete cascade,
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  cantidad    integer not null check (cantidad > 0),
  expira_en   timestamptz not null,
  creado_en   timestamptz not null default now()
);
create index on public.reservas_stock (variante_id, expira_en);
create index on public.reservas_stock (pedido_id);

-- ----------------------------------------------------------------------------
-- Historial: quién cambió cada estado y cuándo (lo llena la base sola)
-- ----------------------------------------------------------------------------
create table public.historial_estados (
  id               uuid primary key default gen_random_uuid(),
  pedido_tienda_id uuid not null references public.pedidos_tienda(id) on delete cascade,
  estado_anterior  public.estado_pedido_tienda,
  estado_nuevo     public.estado_pedido_tienda not null,
  usuario_id       uuid references public.perfiles(id),
  nota             text,
  creado_en        timestamptz not null default now()
);
create index on public.historial_estados (pedido_tienda_id, creado_en);
