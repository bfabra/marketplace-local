-- ============================================================================
-- Métricas del panel de ventas: listado de seguidores (solo miembros) y
-- productos de la tienda guardados en favoritos por clientes.
-- ============================================================================

-- security definer: cuenta y lista a todos los seguidores; solo la ve un miembro.
create or replace function pkg_tiendas.seguidores(p_tienda uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_miembro(p_tienda) then
    raise exception 'No encontramos esa tienda o no tenés acceso a ella' using errcode = 'TC404';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'semana', (count(*) filter (where s.creado_en > now() - interval '7 days'))::integer,
      'lista', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', s.usuario_id,
            'nombre', nullif(trim(both from concat_ws(' ', p.nombre, p.apellido)), ''),
            'desde', s.creado_en
          )
          order by s.creado_en desc
        ) filter (where s.usuario_id is not null),
        '[]'::jsonb
      )
    )
    from public.seguidores_tienda s
    left join public.perfiles p on p.id = s.usuario_id
    where s.tienda_id = p_tienda
  );
end $$;

revoke execute on function pkg_tiendas.seguidores(uuid) from public, anon, authenticated, service_role;
grant execute on function pkg_tiendas.seguidores(uuid) to authenticated;

-- Productos de la tienda que algún cliente guardó, con cuántas veces.
create or replace function pkg_tiendas.productos_en_favoritos(p_tienda uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_items jsonb;
  v_total integer;
begin
  if not public.es_miembro(p_tienda) then
    raise exception 'No encontramos esa tienda o no tenés acceso a ella' using errcode = 'TC404';
  end if;

  select coalesce(jsonb_agg(x.item order by x.veces desc, x.nombre), '[]'::jsonb),
         coalesce(sum(x.veces), 0)::integer
    into v_items, v_total
  from (
    select
      p.nombre,
      count(*)::integer as veces,
      jsonb_build_object(
        'id', p.id,
        'nombre', p.nombre,
        'slug', p.slug,
        'imagen', pkg_catalogo.imagen_principal(p.id),
        'precio', coalesce(
          (pkg_catalogo.resumen_precio(p.id) ->> 'precio_oferta')::numeric,
          (pkg_catalogo.resumen_precio(p.id) ->> 'precio')::numeric
        ),
        'veces', count(*)::integer
      ) as item
    from public.favoritos f
    join public.productos p on p.id = f.producto_id
    where p.tienda_id = p_tienda
    group by p.id, p.nombre, p.slug
  ) x;

  return jsonb_build_object('total', v_total, 'productos', v_items);
end $$;

revoke execute on function pkg_tiendas.productos_en_favoritos(uuid) from public, anon, authenticated, service_role;
grant execute on function pkg_tiendas.productos_en_favoritos(uuid) to authenticated;
