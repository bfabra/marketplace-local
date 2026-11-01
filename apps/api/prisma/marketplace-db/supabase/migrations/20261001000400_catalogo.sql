-- ============================================================================
-- MÓDULO 4 · Catálogo
-- Tablas: categorias, atributos, atributo_opciones, categorias_atributos,
--         productos, producto_atributos, variantes, variante_opciones,
--         imagenes_producto
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Categorías en árbol, sin límite de niveles
-- ----------------------------------------------------------------------------
create table public.categorias (
  id             uuid primary key default gen_random_uuid(),
  padre_id       uuid references public.categorias(id),
  nombre         text not null,
  slug           text not null,
  ruta           text not null default '',   -- ej.: /indumentaria/mujer/calzado/  (la calcula la base)
  orden          integer not null default 0,
  activa         boolean not null default true,
  comision_pct   numeric(5,2) not null default 0 check (comision_pct between 0 and 100),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (padre_id is distinct from id)
);
create unique index categorias_ruta_unica on public.categorias (ruta);
create index on public.categorias (padre_id);
create index categorias_ruta_prefijo on public.categorias (ruta text_pattern_ops);

-- Calcula la ruta a partir de la categoría padre.
create or replace function public.tg_categoria_ruta()
returns trigger language plpgsql as $$
declare ruta_padre text;
begin
  if new.padre_id is null then
    new.ruta := '/' || new.slug || '/';
  else
    select ruta into ruta_padre from public.categorias where id = new.padre_id;
    new.ruta := ruta_padre || new.slug || '/';
  end if;
  return new;
end $$;

create trigger categoria_ruta
  before insert or update of padre_id, slug on public.categorias
  for each row execute function public.tg_categoria_ruta();

-- ----------------------------------------------------------------------------
-- Atributos (ficha técnica y filtros): Talle, Color, Memoria, Material…
-- ----------------------------------------------------------------------------
create type public.tipo_atributo as enum ('texto', 'numero', 'lista', 'si_no');

create table public.atributos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  tipo           public.tipo_atributo not null,
  unidad         text,                        -- ej.: 'GB', 'cm'
  filtrable      boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.atributo_opciones (
  id          uuid primary key default gen_random_uuid(),
  atributo_id uuid not null references public.atributos(id) on delete cascade,
  valor       text not null,                  -- ej.: 'M', 'Rojo'
  orden       integer not null default 0,
  unique (atributo_id, valor)
);

-- Qué atributos usa cada categoría. Las subcategorías heredan los de su padre.
create table public.categorias_atributos (
  categoria_id    uuid not null references public.categorias(id) on delete cascade,
  atributo_id     uuid not null references public.atributos(id) on delete cascade,
  obligatorio     boolean not null default false,
  define_variante boolean not null default false,  -- Talle y Color generan variantes
  orden           integer not null default 0,
  primary key (categoria_id, atributo_id)
);

-- ----------------------------------------------------------------------------
-- Productos. Precio y stock NO están acá: viven en variantes.
-- ----------------------------------------------------------------------------
create type public.estado_producto as enum ('borrador', 'publicado', 'pausado', 'archivado');
create type public.motivo_pausa as enum ('manual', 'limite_plan', 'moderacion');

create table public.productos (
  id               uuid primary key default gen_random_uuid(),
  tienda_id        uuid not null references public.tiendas(id) on delete cascade,
  categoria_id     uuid not null references public.categorias(id),
  nombre           text not null,
  slug             text not null,
  descripcion      text,
  estado           public.estado_producto not null default 'borrador',
  motivo_pausa     public.motivo_pausa,
  publicado_en     timestamptz,
  texto_busqueda   tsvector,                   -- lo calcula la base
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (tienda_id, slug)
);
create index on public.productos (tienda_id, estado);
create index on public.productos (categoria_id) where estado = 'publicado';
create index productos_busqueda on public.productos using gin (texto_busqueda);
create index productos_nombre_trgm on public.productos
  using gin (public.f_unaccent(lower(nombre)) extensions.gin_trgm_ops);

create or replace function public.tg_producto_texto_busqueda()
returns trigger language plpgsql as $$
begin
  new.texto_busqueda :=
      setweight(to_tsvector('spanish', public.f_unaccent(coalesce(new.nombre, ''))), 'A')
   || setweight(to_tsvector('spanish', public.f_unaccent(coalesce(new.descripcion, ''))), 'B');
  return new;
end $$;

create trigger producto_texto_busqueda
  before insert or update of nombre, descripcion on public.productos
  for each row execute function public.tg_producto_texto_busqueda();

-- Ficha técnica del producto (valores de atributos que no generan variantes).
create table public.producto_atributos (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  tienda_id    uuid not null references public.tiendas(id) on delete cascade,  -- copia, la pone la base
  atributo_id  uuid not null references public.atributos(id),
  valor_texto  text,
  valor_numero numeric,
  opcion_id    uuid references public.atributo_opciones(id),
  unique (producto_id, atributo_id)
);

-- Variantes: todo producto tiene al menos una. Un producto sin talles tiene una sola.
create table public.variantes (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references public.productos(id) on delete cascade,
  tienda_id      uuid not null references public.tiendas(id) on delete cascade,  -- copia, la pone la base
  sku            text,
  precio         numeric(12,2) not null check (precio >= 0),
  precio_oferta  numeric(12,2) check (precio_oferta >= 0),
  stock          integer not null default 0 check (stock >= 0),
  activa         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (precio_oferta is null or precio_oferta < precio)
);
create index on public.variantes (producto_id);
create index on public.variantes (tienda_id);

-- Combinación de opciones de cada variante, ej.: Talle = M, Color = Rojo.
create table public.variante_opciones (
  variante_id  uuid not null references public.variantes(id) on delete cascade,
  atributo_id  uuid not null references public.atributos(id),
  opcion_id    uuid not null references public.atributo_opciones(id),
  primary key (variante_id, atributo_id)
);

create table public.imagenes_producto (
  id                uuid primary key default gen_random_uuid(),
  producto_id       uuid not null references public.productos(id) on delete cascade,
  tienda_id         uuid not null references public.tiendas(id) on delete cascade,  -- copia, la pone la base
  variante_id       uuid references public.variantes(id) on delete set null,     -- foto de un color en particular
  ruta_storage      text not null,          -- ej.: tiendas/<tienda_id>/productos/<archivo>.webp
  orden             integer not null default 0,
  texto_alternativo text,
  creado_en         timestamptz not null default now()
);
create index on public.imagenes_producto (producto_id, orden);

-- ----------------------------------------------------------------------------
-- La base copia tienda_id del producto en las tablas hijas, así nadie puede
-- poner un producto de otra tienda por error ni a propósito.
-- ----------------------------------------------------------------------------
create or replace function public.tg_heredar_tienda_de_producto()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select p.tienda_id into new.tienda_id from public.productos p where p.id = new.producto_id;
  return new;
end $$;

create trigger heredar_tienda before insert or update of producto_id, tienda_id on public.variantes
  for each row execute function public.tg_heredar_tienda_de_producto();
create trigger heredar_tienda before insert or update of producto_id, tienda_id on public.producto_atributos
  for each row execute function public.tg_heredar_tienda_de_producto();
create trigger heredar_tienda before insert or update of producto_id, tienda_id on public.imagenes_producto
  for each row execute function public.tg_heredar_tienda_de_producto();
