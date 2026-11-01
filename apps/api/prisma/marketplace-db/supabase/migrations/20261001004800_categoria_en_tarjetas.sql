-- ============================================================================
-- Las tarjetas de producto suman su categoría (la del último nivel): se ve en
-- la tarjeta y la página de la tienda filtra por ella. Convenciones en ..._1800.
-- ============================================================================

create or replace function pkg_catalogo.tarjetas(p_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(
           pkg_catalogo.tarjeta(p.id, p.nombre, p.slug) || jsonb_build_object(
             'tienda', jsonb_build_object('nombre', t.nombre, 'slug', t.slug,
                                          'localidad', l.nombre, 'localidad_id', l.id),
             'categoria', jsonb_build_object('nombre', c.nombre, 'slug', c.slug),
             'nuevo', p.publicado_en > now() - interval '14 days',
             'variante_unica', (select case when count(*) = 1 then min(v.id::text)::uuid end
                                from public.variantes v
                                where v.producto_id = p.id and v.activa)
           ) order by i.n), '[]'::jsonb)
  from unnest(coalesce(p_ids, '{}'::uuid[])) with ordinality i(id, n)
  join public.productos p on p.id = i.id and p.estado = 'publicado'
  join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
  join public.localidades l on l.id = t.localidad_id
  join public.categorias c on c.id = p.categoria_id
$$;
