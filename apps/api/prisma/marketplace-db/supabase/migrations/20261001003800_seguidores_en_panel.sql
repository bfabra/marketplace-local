-- ============================================================================
-- El panel de la tienda muestra cuántas personas la siguen y cuántas se
-- sumaron en los últimos 7 días. Solo la ven el dueño y sus empleados; nunca
-- quiénes son los seguidores.
-- ============================================================================

-- security definer: cada persona solo ve lo que sigue ella; acá se cuenta a todos.
create or replace function pkg_tiendas.seguidores(p_tienda uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_miembro(p_tienda) then
    raise exception 'No encontramos esa tienda o no tenés acceso a ella' using errcode = 'TC404';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*)::integer,
      'semana', (count(*) filter (where s.creado_en > now() - interval '7 days'))::integer)
    from public.seguidores_tienda s
    where s.tienda_id = p_tienda);
end $$;

revoke execute on function pkg_tiendas.seguidores(uuid) from public, anon, authenticated, service_role;
grant execute on function pkg_tiendas.seguidores(uuid) to authenticated;
