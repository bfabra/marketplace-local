-- ============================================================================
-- Favoritos (tabla + pkg_favoritos) y catálogo de la portada nueva:
-- tarjetas con tienda, portada por localidad, sugerencias del buscador y
-- búsqueda paginada con orden. Convenciones en ..._1800.
--
-- Sin sesión, los favoritos viven en el navegador (como el carrito):
-- vista_previa arma la pantalla y unir los pasa a la base al ingresar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Favoritos: un producto guardado por usuario
-- ----------------------------------------------------------------------------
create table public.favoritos (
  usuario_id  uuid not null references public.perfiles(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  primary key (usuario_id, producto_id)
);
create index favoritos_producto_id_idx on public.favoritos (producto_id);
create index favoritos_usuario_creado_idx on public.favoritos (usuario_id, creado_en desc);

alter table public.favoritos enable row level security;
revoke all on public.favoritos from anon;
create policy "favoritos: los propios" on public.favoritos
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Portada: productos publicados más recientes y ventas de los últimos días.
create index if not exists productos_publicados_recientes_idx
  on public.productos (publicado_en desc) where estado = 'publicado';
create index if not exists pedido_items_creado_en_idx
  on public.pedido_items (creado_en desc) include (variante_id, cantidad, pedido_tienda_id);

-- Texto del usuario listo para "like": sin acentos, en minúsculas y con los
-- comodines escapados.
create or replace function public.texto_para_like(p_texto text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(public.f_unaccent(lower(trim(p_texto))), '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- La búsqueda también encuentra palabras a medio escribir ("zapat" → zapatilla).
create or replace function public.buscar_productos(
  p_texto        text    default null,
  p_localidad    uuid    default null,
  p_categoria    uuid    default null,
  p_precio_min   numeric default null,
  p_precio_max   numeric default null,
  p_opciones     uuid[]  default null,
  p_limite       integer default 24,
  p_desde        integer default 0)
returns table (
  producto_id   uuid,
  nombre        text,
  slug          text,
  tienda_id     uuid,
  tienda_nombre text,
  tienda_slug   text,
  precio_desde  numeric,
  sin_stock     boolean,
  relevancia    real)
language sql stable set search_path = '' as $$
  with q as (
    select nullif(trim(p_texto), '') as texto,
           public.f_unaccent(lower(nullif(trim(p_texto), ''))) as texto_norm,
           public.texto_para_like(nullif(trim(p_texto), '')) as texto_like
  ), cat as (
    select ruta from public.categorias where id = p_categoria
  )
  select p.id, p.nombre, p.slug, t.id, t.nombre, t.slug,
         min(coalesce(v.precio_oferta, v.precio)) as precio_desde,
         coalesce(sum(v.stock) filter (where v.activa), 0) = 0 as sin_stock,
         (case when q.texto is null then 0
               else ts_rank(p.texto_busqueda, websearch_to_tsquery('spanish', q.texto_norm))
                    + extensions.word_similarity(q.texto_norm, public.f_unaccent(lower(p.nombre)))
                    + case when public.f_unaccent(lower(p.nombre)) like q.texto_like || '%' then 0.5 else 0 end
          end)::real as relevancia
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
  join public.categorias c on c.id = p.categoria_id
  join public.variantes v on v.producto_id = p.id and v.activa
  cross join q
  where p.estado = 'publicado'
    and (q.texto is null
         or p.texto_busqueda @@ websearch_to_tsquery('spanish', q.texto_norm)
         or public.f_unaccent(lower(p.nombre)) like '%' || q.texto_like || '%'
         or extensions.word_similarity(q.texto_norm, public.f_unaccent(lower(p.nombre))) >= 0.5)
    and (p_localidad is null or t.localidad_id = p_localidad)
    and (p_categoria is null or c.ruta like (select ruta from cat) || '%')
    and (p_opciones is null or not exists (
          select 1 from unnest(p_opciones) as o(id)
          where not exists (select 1 from public.variante_opciones vo
                            join public.variantes v2 on v2.id = vo.variante_id
                            where v2.producto_id = p.id and vo.opcion_id = o.id)
            and not exists (select 1 from public.producto_atributos pa
                            where pa.producto_id = p.id and pa.opcion_id = o.id)))
  group by p.id, t.id, q.texto, q.texto_norm, q.texto_like
  having (p_precio_min is null or min(coalesce(v.precio_oferta, v.precio)) >= p_precio_min)
     and (p_precio_max is null or min(coalesce(v.precio_oferta, v.precio)) <= p_precio_max)
  order by relevancia desc, p.publicado_en desc
  limit p_limite offset p_desde
$$;

-- ----------------------------------------------------------------------------
-- pkg_catalogo: tarjetas, portada, sugerencias y búsqueda
-- ----------------------------------------------------------------------------

-- Tarjetas de producto en el orden recibido, con la tienda. Omite lo que no
-- está a la venta. "variante_unica" permite agregar al carrito desde la tarjeta.
create or replace function pkg_catalogo.tarjetas(p_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(
           pkg_catalogo.tarjeta(p.id, p.nombre, p.slug) || jsonb_build_object(
             'tienda', jsonb_build_object('nombre', t.nombre, 'slug', t.slug,
                                          'localidad', l.nombre, 'localidad_id', l.id),
             'nuevo', p.publicado_en > now() - interval '14 days',
             'variante_unica', (select case when count(*) = 1 then min(v.id::text)::uuid end
                                from public.variantes v
                                where v.producto_id = p.id and v.activa)
           ) order by i.n), '[]'::jsonb)
  from unnest(coalesce(p_ids, '{}'::uuid[])) with ordinality i(id, n)
  join public.productos p on p.id = i.id and p.estado = 'publicado'
  join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
  join public.localidades l on l.id = t.localidad_id
$$;

-- Rubro de la tienda: la categoría principal con más productos publicados.
create or replace function pkg_catalogo.rubro(p_tienda uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('nombre', r.nombre, 'slug', r.slug)
  from public.productos p
  join public.categorias c on c.id = p.categoria_id
  join public.categorias r on r.padre_id is null and c.ruta like r.ruta || '%'
  where p.tienda_id = p_tienda and p.estado = 'publicado'
  group by r.id, r.nombre, r.slug
  order by count(*) desc, r.nombre
  limit 1
$$;

-- Productos más vendidos en los últimos 60 días (pedidos pagados).
-- security definer: los pedidos no son visibles para el visitante; solo
-- devuelve ids de productos que están a la venta.
create or replace function pkg_catalogo._mas_vendidos(p_localidad uuid, p_limite integer)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x.id order by x.unidades desc, x.id), '{}'::uuid[])
  from (
    select v.producto_id as id, sum(pi.cantidad) as unidades
    from public.pedido_items pi
    join public.pedidos_tienda pt on pt.id = pi.pedido_tienda_id
    join public.variantes v on v.id = pi.variante_id
    join public.productos p on p.id = v.producto_id and p.estado = 'publicado'
    join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
    where pi.creado_en > now() - interval '60 days'
      and pt.estado not in ('pendiente', 'cancelado', 'rechazado')
      and (p_localidad is null or t.localidad_id = p_localidad)
    group by v.producto_id
    order by unidades desc
    limit least(greatest(p_limite, 0), 24)
  ) x
$$;

-- Portada: categorías principales, tiendas (primero las de la localidad
-- elegida), productos populares y novedades, y cifras de la comunidad.
create or replace function pkg_catalogo.inicio(p_localidad uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_populares uuid[];
  v_recientes uuid[];
begin
  v_populares := pkg_catalogo._mas_vendidos(p_localidad, 8);
  if p_localidad is not null and cardinality(v_populares) < 8 then
    v_populares := v_populares || array(
      select id from unnest(pkg_catalogo._mas_vendidos(null, 8)) with ordinality m(id, n)
      where id <> all(v_populares) order by n);
  end if;

  v_recientes := array(
    select p.id
    from public.productos p
    join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
    where p.estado = 'publicado'
    order by (t.localidad_id = p_localidad) is true desc, p.publicado_en desc
    limit 16);

  if cardinality(v_populares) < 8 then
    v_populares := v_populares || array(
      select id from unnest(v_recientes) with ordinality r(id, n)
      where id <> all(v_populares) order by n);
  end if;

  return jsonb_build_object(
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id, 'nombre', r.nombre, 'slug', r.slug,
               'productos', (select count(*)
                             from public.productos p
                             join public.categorias c on c.id = p.categoria_id
                             join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
                             where p.estado = 'publicado' and c.ruta like r.ruta || '%')
             ) order by r.orden, r.nombre), '[]'::jsonb)
      from public.categorias r
      where r.padre_id is null and r.activa),
    'tiendas', (
      select coalesce(jsonb_agg(x.tienda order by x.cerca desc, x.productos desc, x.nombre), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'id', t.id, 'nombre', t.nombre, 'slug', t.slug, 'descripcion', t.descripcion,
                 'localidad', l.nombre, 'localidad_id', l.id,
                 'productos', n.productos,
                 'nueva', t.creado_en > now() - interval '30 days',
                 'rubro', pkg_catalogo.rubro(t.id)
               ) as tienda,
               (t.localidad_id = p_localidad) is true as cerca,
               n.productos, t.nombre
        from public.tiendas t
        join public.localidades l on l.id = t.localidad_id
        cross join lateral (
          select count(*)::integer as productos
          from public.productos p
          where p.tienda_id = t.id and p.estado = 'publicado') n
        where t.estado = 'activa'
        order by cerca desc, n.productos desc, t.nombre
        limit 12) x),
    'populares', pkg_catalogo.tarjetas(v_populares[1:8]),
    'novedades', pkg_catalogo.tarjetas(v_recientes[1:8]),
    'cifras', jsonb_build_object(
      'tiendas', (select count(*) from public.tiendas where estado = 'activa'),
      'productos', (select count(*)
                    from public.productos p
                    join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
                    where p.estado = 'publicado'),
      'localidades', (select count(distinct localidad_id) from public.tiendas where estado = 'activa'))
  );
end $$;

-- Autocompletado del buscador: productos, tiendas y categorías. Desde 2 letras.
create or replace function pkg_catalogo.sugerencias(p_texto text, p_localidad uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_texto text := left(nullif(trim(p_texto), ''), 80);
  v_norm  text;
  v_like  text;
begin
  if v_texto is null or length(v_texto) < 2 then
    return jsonb_build_object('productos', '[]'::jsonb, 'tiendas', '[]'::jsonb, 'categorias', '[]'::jsonb);
  end if;
  v_norm := public.f_unaccent(lower(v_texto));
  v_like := public.texto_para_like(v_texto);

  return jsonb_build_object(
    'productos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id, 'nombre', x.nombre, 'slug', x.slug,
               'tienda', x.tienda, 'tiendaSlug', x.tienda_slug,
               'imagen', pkg_catalogo.imagen_principal(x.id)
             ) || pkg_catalogo.resumen_precio(x.id) order by x.n), '[]'::jsonb)
      from (
        select p.id, p.nombre, p.slug, t.nombre as tienda, t.slug as tienda_slug,
               row_number() over (order by
                 (public.f_unaccent(lower(p.nombre)) like v_like || '%') desc,
                 extensions.word_similarity(v_norm, public.f_unaccent(lower(p.nombre))) desc,
                 p.publicado_en desc) as n
        from public.productos p
        join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
        where p.estado = 'publicado'
          and (p_localidad is null or t.localidad_id = p_localidad)
          and (public.f_unaccent(lower(p.nombre)) like '%' || v_like || '%'
               or p.texto_busqueda @@ websearch_to_tsquery('spanish', v_norm))
        order by n
        limit 6) x),
    'tiendas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id, 'nombre', x.nombre, 'slug', x.slug, 'localidad', x.localidad
             ) order by x.empieza desc, x.nombre), '[]'::jsonb)
      from (
        select t.id, t.nombre, t.slug, l.nombre as localidad,
               public.f_unaccent(lower(t.nombre)) like v_like || '%' as empieza
        from public.tiendas t
        join public.localidades l on l.id = t.localidad_id
        where t.estado = 'activa'
          and (p_localidad is null or t.localidad_id = p_localidad)
          and public.f_unaccent(lower(t.nombre)) like '%' || v_like || '%'
        order by empieza desc, t.nombre
        limit 3) x),
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id, 'nombre', x.nombre, 'ruta', x.ruta
             ) order by x.ruta), '[]'::jsonb)
      from (
        select c.id, c.nombre, c.ruta
        from public.categorias c
        where c.activa and public.f_unaccent(lower(c.nombre)) like '%' || v_like || '%'
        order by c.ruta
        limit 4) x)
  );
end $$;

-- Resultados de búsqueda, de a 24. Orden: relevancia, recientes, precio_asc o
-- precio_desc. Revisa hasta 480 coincidencias.
create or replace function pkg_catalogo.buscar(
  p_texto     text    default null,
  p_localidad uuid    default null,
  p_categoria uuid    default null,
  p_orden     text    default 'relevancia',
  p_pagina    integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_pagina integer := least(greatest(coalesce(p_pagina, 1), 1), 20);
  v_total  integer;
  v_ids    uuid[];
begin
  if coalesce(p_orden, 'relevancia') not in ('relevancia', 'recientes', 'precio_asc', 'precio_desc') then
    raise exception 'Orden inválido' using errcode = 'TC400';
  end if;

  with r as (
    select b.producto_id, b.precio_desde, b.relevancia, b.sin_stock, p.publicado_en
    from public.buscar_productos(left(p_texto, 80), p_localidad, p_categoria, null, null, null, 480, 0) b
    join public.productos p on p.id = b.producto_id
  ), o as (
    select r.producto_id, count(*) over () as total,
           row_number() over (order by
             r.sin_stock,
             case when p_orden = 'precio_asc' then r.precio_desde end asc nulls last,
             case when p_orden = 'precio_desc' then r.precio_desde end desc nulls last,
             case when p_orden = 'recientes' or nullif(trim(p_texto), '') is null then r.publicado_en end desc nulls last,
             r.relevancia desc,
             r.publicado_en desc) as n
    from r
  )
  select coalesce(max(o.total), 0),
         coalesce(array_agg(o.producto_id order by o.n)
                    filter (where o.n > (v_pagina - 1) * 24 and o.n <= v_pagina * 24), '{}'::uuid[])
  into v_total, v_ids
  from o;

  return jsonb_build_object(
    'total', v_total,
    'pagina', v_pagina,
    'paginas', least(ceil(v_total / 24.0)::integer, 20),
    'productos', pkg_catalogo.tarjetas(v_ids)
  );
end $$;

-- Página pública de la tienda: suma localidad_id, rubro y tarjetas con tienda.
create or replace function pkg_catalogo.tienda(p_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'nombre', t.nombre,
    'slug', t.slug,
    'descripcion', t.descripcion,
    'telefono', t.telefono,
    'direccion', t.direccion,
    'localidad', l.nombre || ', ' || pr.nombre,
    'localidad_id', l.id,
    'desde', t.creado_en,
    'rubro', pkg_catalogo.rubro(t.id),
    'productos', pkg_catalogo.tarjetas(array(
      select p.id from public.productos p
      where p.tienda_id = t.id and p.estado = 'publicado'
      order by p.publicado_en desc))
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  where t.slug = p_slug and t.estado = 'activa'
$$;

-- ----------------------------------------------------------------------------
-- pkg_favoritos
-- ----------------------------------------------------------------------------
create schema if not exists pkg_favoritos;
comment on schema pkg_favoritos is 'Productos guardados por cada cliente. Solo lo llama el API.';

create or replace function pkg_favoritos._ids()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(f.producto_id order by f.creado_en desc), '[]'::jsonb)
  from public.favoritos f
  where f.usuario_id = auth.uid()
$$;

create or replace function pkg_favoritos._exigir_sesion()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para guardar favoritos' using errcode = 'TC403';
  end if;
end $$;

-- Favoritos del navegador (sin sesión). Máximo 100.
create or replace function pkg_favoritos.vista_previa(p_ids uuid[])
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if cardinality(coalesce(p_ids, '{}'::uuid[])) > 100 then
    raise exception 'Podés guardar hasta 100 favoritos sin cuenta' using errcode = 'TC400';
  end if;
  return pkg_catalogo.tarjetas(p_ids);
end $$;

create or replace function pkg_favoritos.ids()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  perform pkg_favoritos._exigir_sesion();
  return pkg_favoritos._ids();
end $$;

create or replace function pkg_favoritos.ver()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  perform pkg_favoritos._exigir_sesion();
  return jsonb_build_object(
    'ids', pkg_favoritos._ids(),
    'productos', pkg_catalogo.tarjetas(array(
      select f.producto_id from public.favoritos f
      where f.usuario_id = auth.uid()
      order by f.creado_en desc)));
end $$;

create or replace function pkg_favoritos.agregar(p_producto uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_favoritos._exigir_sesion();
  if not exists (
    select 1 from public.productos p
    join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
    where p.id = p_producto and p.estado = 'publicado'
  ) then
    raise exception 'Este producto ya no está a la venta' using errcode = 'TC404';
  end if;
  if (select count(*) from public.favoritos where usuario_id = auth.uid()) >= 500 then
    raise exception 'Llegaste al máximo de 500 favoritos' using errcode = 'TC409';
  end if;

  insert into public.favoritos (usuario_id, producto_id)
  values (auth.uid(), p_producto)
  on conflict do nothing;
  return pkg_favoritos._ids();
end $$;

create or replace function pkg_favoritos.quitar(p_producto uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_favoritos._exigir_sesion();
  delete from public.favoritos where usuario_id = auth.uid() and producto_id = p_producto;
  return pkg_favoritos._ids();
end $$;

-- Suma los favoritos del navegador a la cuenta; descarta lo que no está a la venta.
create or replace function pkg_favoritos.unir(p_ids uuid[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_favoritos._exigir_sesion();
  if cardinality(coalesce(p_ids, '{}'::uuid[])) > 100 then
    raise exception 'Podés guardar hasta 100 favoritos sin cuenta' using errcode = 'TC400';
  end if;

  insert into public.favoritos (usuario_id, producto_id)
  select auth.uid(), p.id
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
  where p.id = any(p_ids) and p.estado = 'publicado'
  on conflict do nothing;
  return pkg_favoritos._ids();
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function public.texto_para_like(text) from public;
grant execute on function public.texto_para_like(text) to anon, authenticated;

revoke execute on all functions in schema pkg_catalogo from public, anon, authenticated, service_role;
grant execute on all functions in schema pkg_catalogo to anon, authenticated;

revoke all on schema pkg_favoritos from public;
revoke execute on all functions in schema pkg_favoritos from public, anon, authenticated, service_role;
grant usage on schema pkg_favoritos to anon, authenticated;
grant execute on function pkg_catalogo.tarjetas(uuid[]), pkg_favoritos.vista_previa(uuid[]) to anon, authenticated;
grant execute on function
  pkg_favoritos._ids(),
  pkg_favoritos._exigir_sesion(),
  pkg_favoritos.ids(),
  pkg_favoritos.ver(),
  pkg_favoritos.agregar(uuid),
  pkg_favoritos.quitar(uuid),
  pkg_favoritos.unir(uuid[])
to authenticated;
