-- ============================================================================
-- MÓDULO 6 · Pagos de ventas (Mercado Pago)
-- Tablas: pagos, reembolsos
-- Nunca se guardan datos de tarjetas: solo identificadores y estados.
-- ============================================================================

create type public.estado_pago as enum
  ('pendiente', 'aprobado', 'rechazado', 'reembolsado_parcial', 'reembolsado');

create table public.pagos (
  id                   uuid primary key default gen_random_uuid(),
  pedido_id            uuid not null references public.pedidos(id) on delete cascade,
  pedido_tienda_id     uuid references public.pedidos_tienda(id),  -- solo si Mercado Pago no habilita el pago 1:N (plan B)
  mp_payment_id        text unique,
  monto                numeric(12,2) not null check (monto >= 0),
  comision_marketplace numeric(12,2) not null default 0,
  estado               public.estado_pago not null default 'pendiente',
  respuesta_mp         jsonb,          -- respuesta completa del aviso (webhook) de Mercado Pago
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
create index on public.pagos (pedido_id);

create type public.estado_reembolso as enum ('pendiente', 'procesado', 'rechazado');

-- Permite devolver solo la parte de una tienda.
create table public.reembolsos (
  id               uuid primary key default gen_random_uuid(),
  pedido_tienda_id uuid not null references public.pedidos_tienda(id) on delete cascade,
  monto            numeric(12,2) not null check (monto > 0),
  motivo           text not null,
  mp_refund_id     text unique,
  estado           public.estado_reembolso not null default 'pendiente',
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index on public.reembolsos (pedido_tienda_id);
