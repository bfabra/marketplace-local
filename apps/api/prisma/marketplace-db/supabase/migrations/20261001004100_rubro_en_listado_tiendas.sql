-- ============================================================================
-- El listado público de tiendas (/tiendas) muestra el rubro declarado, como la
-- portada y la página de cada tienda. Convenciones en ..._1800.
-- ============================================================================

create or replace function pkg_catalogo.tiendas()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'nombre', t.nombre,
           'slug', t.slug,
           'descripcion', t.descripcion,
           'localidad', l.nombre,
           'localidad_id', l.id,
           'productos', (select count(*) from public.productos p
                         where p.tienda_id = t.id and p.estado = 'publicado'),
           'rubro', pkg_catalogo.rubro(t.id)
         ) order by t.nombre), '[]'::jsonb)
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  where t.estado = 'activa'
$$;
