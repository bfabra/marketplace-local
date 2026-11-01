-- ============================================================================
-- "Nueva" en el listado de tiendas: las 3 últimas que se sumaron en los
-- últimos 30 días (la sección "Recién llegados" de la portada). Si todas son
-- recientes, solo se destacan las últimas. Convenciones en ..._1800.
-- ============================================================================

create or replace function pkg_catalogo.tiendas()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with nuevas as (
    select id from public.tiendas
    where estado = 'activa' and creado_en > now() - interval '30 days'
    order by creado_en desc
    limit 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'nombre', t.nombre,
           'slug', t.slug,
           'descripcion', t.descripcion,
           'localidad', l.nombre,
           'localidad_id', l.id,
           'portada', t.portada_url,
           'logo', t.logo_url,
           'nueva', t.id in (select id from nuevas),
           'productos', (select count(*) from public.productos p
                         where p.tienda_id = t.id and p.estado = 'publicado'),
           'rubro', pkg_catalogo.rubro(t.id)
         ) order by t.nombre), '[]'::jsonb)
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  where t.estado = 'activa'
$$;
