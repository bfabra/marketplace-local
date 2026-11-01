-- ============================================================================
-- MÓDULO 8 · Comunicación
-- Tablas: preguntas, mensajes_pedido, reclamos, denuncias, notificaciones,
--         solicitudes_consumidor
-- ============================================================================

-- Preguntas públicas en la publicación, como en Mercado Libre.
create table public.preguntas (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references public.productos(id) on delete cascade,
  tienda_id      uuid not null references public.tiendas(id) on delete cascade,  -- copia, la pone la base
  usuario_id     uuid not null references public.perfiles(id),
  texto          text not null check (length(texto) between 3 and 1000),
  respuesta      text,
  respondida_por uuid references public.perfiles(id),
  respondida_en  timestamptz,
  visible        boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.preguntas (producto_id, creado_en desc);
create index on public.preguntas (tienda_id) where respuesta is null;

create trigger heredar_tienda before insert or update of producto_id, tienda_id on public.preguntas
  for each row execute function public.tg_heredar_tienda_de_producto();

-- Conversación privada entre cliente y comercio después de la compra.
create table public.mensajes_pedido (
  id               uuid primary key default gen_random_uuid(),
  pedido_tienda_id uuid not null references public.pedidos_tienda(id) on delete cascade,
  autor_id         uuid not null references public.perfiles(id),
  texto            text not null check (length(texto) between 1 and 2000),
  creado_en        timestamptz not null default now()
);
create index on public.mensajes_pedido (pedido_tienda_id, creado_en);

create type public.estado_reclamo as enum ('abierto', 'en_revision', 'resuelto', 'cerrado');

create table public.reclamos (
  id               uuid primary key default gen_random_uuid(),
  pedido_tienda_id uuid not null references public.pedidos_tienda(id) on delete cascade,
  usuario_id       uuid not null references public.perfiles(id),
  motivo           text not null,
  descripcion      text,
  estado           public.estado_reclamo not null default 'abierto',
  resolucion       text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index on public.reclamos (pedido_tienda_id);
create index on public.reclamos (estado);

create type public.estado_denuncia as enum ('abierta', 'revisada', 'descartada');

create table public.denuncias (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid references public.productos(id) on delete cascade,
  tienda_id      uuid references public.tiendas(id) on delete cascade,
  usuario_id     uuid not null references public.perfiles(id),
  motivo         text not null,
  estado         public.estado_denuncia not null default 'abierta',
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (producto_id is not null or tienda_id is not null)
);
create index on public.denuncias (estado);

-- Base para correo hoy y WhatsApp después.
create table public.notificaciones (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.perfiles(id) on delete cascade,
  tipo                text not null,          -- ej.: 'pedido_nuevo', 'estado_pedido', 'suscripcion_por_vencer'
  datos               jsonb not null default '{}'::jsonb,
  leida               boolean not null default false,
  enviada_por_correo  boolean not null default false,
  creado_en           timestamptz not null default now()
);
create index on public.notificaciones (usuario_id, leida, creado_en desc);

-- Botón de Arrepentimiento y Botón de Baja (Disposición 954/2025).
-- Se puede cargar sin iniciar sesión; la base genera el código de gestión.
create type public.tipo_solicitud_consumidor as enum ('arrepentimiento', 'baja_servicio');
create type public.estado_solicitud_consumidor as enum ('recibida', 'en_gestion', 'resuelta');

create sequence public.solicitudes_consumidor_seq start 1;

create table public.solicitudes_consumidor (
  id               uuid primary key default gen_random_uuid(),
  tipo             public.tipo_solicitud_consumidor not null,
  pedido_tienda_id uuid references public.pedidos_tienda(id),
  suscripcion_id   uuid references public.suscripciones(id),
  numero_pedido    text,                 -- lo que escribe la persona si no inició sesión
  nombre           text not null,
  email            text not null,
  detalle          text,
  codigo_gestion   text not null unique
                   default 'SC-' || lpad(nextval('public.solicitudes_consumidor_seq')::text, 6, '0'),
  estado           public.estado_solicitud_consumidor not null default 'recibida',
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index on public.solicitudes_consumidor (estado, creado_en);
