-- ============================================================================
-- Paquete del API: catálogo público (pkg_catalogo). Convenciones en ..._1800.
-- Todo es lectura con el rol del visitante: RLS solo deja ver tiendas activas
-- y productos publicados.
-- Las fotos se devuelven con su ruta de almacenamiento ("ruta" / "imagen");
-- el API arma la URL según dónde estén guardadas (disco o Supabase Storage).
-- ============================================================================

create schema if not exists pkg_catalogo;
comment on schema pkg_catalogo is 'Categorías, atributos, tiendas y productos públicos. Solo lo llama el API.';

-- Precio "desde" de un producto: la variante activa más barata (con su oferta, si tiene).
-- "desde" es true si hay variantes más caras; "stock" es la suma de todas.
create or replace function pkg_catalogo.resumen_precio(p_producto uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'precio', b.precio,
    'precio_oferta', b.precio_oferta,
    'desde', coalesce(a.max_efectivo > a.min_efectivo, false),
    'stock', coalesce(a.stock, 0)
  )
  from (
    select min(coalesce(v.precio_oferta, v.precio)) as min_efectivo,
           max(coalesce(v.precio_oferta, v.precio)) as max_efectivo,
           sum(v.stock)::integer as stock
    from public.variantes v
    where v.producto_id = p_producto and v.activa
  ) a
  left join lateral (
    select v.precio, v.precio_oferta
    from public.variantes v
    where v.producto_id = p_producto and v.activa
    order by coalesce(v.precio_oferta, v.precio), v.creado_en
    limit 1
  ) b on true
$$;

-- Ruta de la foto principal (la de menor orden), o null.
create or replace function pkg_catalogo.imagen_principal(p_producto uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select i.ruta_storage
  from public.imagenes_producto i
  where i.producto_id = p_producto
  order by i.orden, i.creado_en
  limit 1
$$;

-- Tarjeta de producto para los listados.
create or replace function pkg_catalogo.tarjeta(p_producto uuid, p_nombre text, p_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
           'id', p_producto,
           'nombre', p_nombre,
           'slug', p_slug,
           'imagen', pkg_catalogo.imagen_principal(p_producto)
         ) || pkg_catalogo.resumen_precio(p_producto)
$$;

-- Árbol de categorías activas, con su etiqueta completa: "Indumentaria › Mujer".
create or replace function pkg_catalogo.categorias()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with recursive arbol as (
    select c.id, c.nombre, c.padre_id, c.ruta, c.nombre as etiqueta
    from public.categorias c
    where c.padre_id is null and c.activa
    union all
    select c.id, c.nombre, c.padre_id, c.ruta, a.etiqueta || ' › ' || c.nombre
    from public.categorias c
    join arbol a on c.padre_id = a.id
    where c.activa
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'nombre', nombre, 'padre_id', padre_id, 'ruta', ruta, 'etiqueta', etiqueta
         ) order by ruta), '[]'::jsonb)
  from arbol
$$;

-- Atributos de la categoría (incluidos los heredados), con unidad y opciones.
-- Primero los que definen variante (talle, color…), después la ficha técnica.
create or replace function pkg_catalogo.atributos_categoria(p_categoria uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', ac.atributo_id,
           'nombre', ac.nombre,
           'tipo', ac.tipo,
           'unidad', a.unidad,
           'obligatorio', ac.obligatorio,
           'define_variante', ac.define_variante,
           'opciones', coalesce((
             select jsonb_agg(jsonb_build_object('id', o.id, 'valor', o.valor) order by o.orden, o.valor)
             from public.atributo_opciones o
             where o.atributo_id = ac.atributo_id
           ), '[]'::jsonb)
         ) order by ac.define_variante desc, ac.nombre), '[]'::jsonb)
  from public.atributos_de_categoria(p_categoria) ac
  join public.atributos a on a.id = ac.atributo_id
$$;

-- Tiendas activas para la portada.
create or replace function pkg_catalogo.tiendas()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'nombre', t.nombre,
           'slug', t.slug,
           'descripcion', t.descripcion,
           'localidad', l.nombre,
           'productos', (select count(*) from public.productos p
                         where p.tienda_id = t.id and p.estado = 'publicado')
         ) order by t.nombre), '[]'::jsonb)
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  where t.estado = 'activa'
$$;

-- Página pública de una tienda con sus productos publicados. Null si no está activa.
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
    'productos', coalesce((
      select jsonb_agg(pkg_catalogo.tarjeta(p.id, p.nombre, p.slug) order by p.publicado_en desc)
      from public.productos p
      where p.tienda_id = t.id and p.estado = 'publicado'
    ), '[]'::jsonb)
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  where t.slug = p_slug and t.estado = 'activa'
$$;

-- Página pública de un producto. Null si no está publicado o la tienda no está activa.
-- opcionesVariante trae solo las opciones que usa alguna variante, para el selector.
create or replace function pkg_catalogo.producto(p_tienda_slug text, p_producto_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'slug', p.slug,
    'descripcion', p.descripcion,
    'categoria', c.nombre,
    'tienda', jsonb_build_object('nombre', t.nombre, 'slug', t.slug, 'localidad', l.nombre),
    'imagenes', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'ruta', i.ruta_storage, 'alt', i.texto_alternativo)
                       order by i.orden, i.creado_en)
      from public.imagenes_producto i
      where i.producto_id = p.id
    ), '[]'::jsonb),
    'ficha', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre', a.nombre,
               'valor', coalesce(
                 o.valor,
                 trim_scale(pa.valor_numero)::text || coalesce(' ' || a.unidad, ''),
                 pa.valor_texto)
             ) order by a.nombre)
      from public.producto_atributos pa
      join public.atributos a on a.id = pa.atributo_id
      left join public.atributo_opciones o on o.id = pa.opcion_id
      where pa.producto_id = p.id
    ), '[]'::jsonb),
    'opcionesVariante', coalesce((
      select jsonb_agg(a.valor || jsonb_build_object('opciones', coalesce((
               select jsonb_agg(o.valor order by o.n)
               from jsonb_array_elements(a.valor -> 'opciones') with ordinality o(valor, n)
               where exists (
                 select 1
                 from public.variante_opciones vo
                 join public.variantes v on v.id = vo.variante_id
                 where vo.opcion_id = (o.valor ->> 'id')::uuid and v.producto_id = p.id and v.activa
               )
             ), '[]'::jsonb)) order by a.n)
      from jsonb_array_elements(pkg_catalogo.atributos_categoria(p.categoria_id)) with ordinality a(valor, n)
      where (a.valor ->> 'define_variante')::boolean
    ), '[]'::jsonb),
    'variantes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id,
               'precio', v.precio,
               'precio_oferta', v.precio_oferta,
               'stock', v.stock,
               'opciones', coalesce((
                 select jsonb_agg(jsonb_build_object('atributo_id', vo.atributo_id, 'opcion_id', vo.opcion_id))
                 from public.variante_opciones vo
                 where vo.variante_id = v.id
               ), '[]'::jsonb)
             ) order by v.creado_en, v.id)
      from public.variantes v
      where v.producto_id = p.id and v.activa
    ), '[]'::jsonb)
  )
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id
  join public.localidades l on l.id = t.localidad_id
  join public.categorias c on c.id = p.categoria_id
  where t.slug = p_tienda_slug
    and p.slug = p_producto_slug
    and p.estado = 'publicado'
    and t.estado = 'activa'
$$;

-- ----------------------------------------------------------------------------
-- Permisos: lectura pública
-- ----------------------------------------------------------------------------
revoke all on schema pkg_catalogo from public;
revoke execute on all functions in schema pkg_catalogo from public, anon, authenticated, service_role;
grant usage on schema pkg_catalogo to anon, authenticated;
grant execute on all functions in schema pkg_catalogo to anon, authenticated;
