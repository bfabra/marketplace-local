-- ============================================================================
-- El listado público de categorías suma cuántos productos publicados tiene
-- cada una (con sus subcategorías y solo de tiendas activas, como la portada).
-- Lo usan el menú de categorías y la página «Todas las categorías».
-- ============================================================================

create or replace function pkg_catalogo.categorias()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with recursive arbol as (
    select c.id, c.nombre, c.padre_id, c.ruta, c.nombre as etiqueta, c.requiere_revision as revision,
           array[lpad(c.orden::text, 6, '0') || c.nombre] as camino
    from public.categorias c
    where c.padre_id is null and c.activa
    union all
    select c.id, c.nombre, c.padre_id, c.ruta, a.etiqueta || ' › ' || c.nombre, a.revision or c.requiere_revision,
           a.camino || (lpad(c.orden::text, 6, '0') || c.nombre)
    from public.categorias c
    join arbol a on c.padre_id = a.id
    where c.activa
  ), conteo as (
    select c.ruta, count(*) as n
    from public.productos p
    join public.categorias c on c.id = p.categoria_id
    join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
    where p.estado = 'publicado'
    group by c.ruta
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'nombre', a.nombre, 'padre_id', a.padre_id, 'ruta', a.ruta, 'etiqueta', a.etiqueta,
           'revision', a.revision,
           'productos', (select coalesce(sum(n), 0)::int from conteo where conteo.ruta like a.ruta || '%')
         ) order by a.camino), '[]'::jsonb)
  from arbol a
$$;
