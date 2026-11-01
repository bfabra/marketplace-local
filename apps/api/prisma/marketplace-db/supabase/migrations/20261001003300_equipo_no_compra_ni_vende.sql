-- ============================================================================
-- Las cuentas del equipo de la plataforma (superadmin, moderación, soporte,
-- finanzas y logística) administran: no compran, no guardan favoritos y no
-- tienen ni integran tiendas. Así nadie del equipo decide sobre sus propias
-- compras, reembolsos, tiendas o productos.
--
-- La regla vive en triggers sobre las tablas, así se cumple venga el cambio de
-- la función que venga. Los BEFORE corren en orden alfabético: los zz_* corren
-- después de los que fijan el dueño de la fila, y el de miembros_tienda corre
-- antes que miembros_control para que el aviso sea este y no el del plan.
-- ============================================================================

create or replace function public.es_equipo(p_usuario uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.roles_plataforma r where r.usuario_id = p_usuario)
$$;
revoke execute on function public.es_equipo(uuid) from public, anon, authenticated, service_role;

-- Compras: pedidos, carrito y favoritos.
create or replace function public.equipo_no_compra()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_usuario uuid;
begin
  if tg_table_name = 'pedidos' then
    v_usuario := new.comprador_id;
  elsif tg_table_name = 'favoritos' then
    v_usuario := new.usuario_id;
  else
    select c.usuario_id into v_usuario from public.carritos c where c.id = new.carrito_id;
  end if;
  if public.es_equipo(v_usuario) then
    raise exception 'Las cuentas del equipo de la plataforma no compran ni guardan favoritos' using errcode = 'TC403';
  end if;
  return new;
end $$;

create trigger zz_equipo_no_compra before insert on public.pedidos
  for each row execute function public.equipo_no_compra();
create trigger zz_equipo_no_compra before insert or update of carrito_id on public.carrito_items
  for each row execute function public.equipo_no_compra();
create trigger zz_equipo_no_compra before insert on public.favoritos
  for each row execute function public.equipo_no_compra();

-- Ventas: ser dueño de una tienda o parte de su equipo.
create or replace function public.equipo_no_vende()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_usuario uuid;
begin
  if tg_table_name = 'tiendas' then
    v_usuario := new.propietario_id;
  elsif new.estado = 'activo' then
    v_usuario := new.usuario_id;
  end if;
  if public.es_equipo(v_usuario) then
    raise exception 'Las cuentas del equipo de la plataforma no tienen tiendas ni forman parte de una' using errcode = 'TC403';
  end if;
  return new;
end $$;

create trigger zz_equipo_no_vende before insert or update of propietario_id on public.tiendas
  for each row execute function public.equipo_no_vende();
create trigger equipo_no_vende before insert or update of usuario_id, estado on public.miembros_tienda
  for each row execute function public.equipo_no_vende();

-- Al sumar a alguien al equipo: no puede tener tiendas activas ni ser parte de
-- una. Su carrito y sus favoritos se vacían; sus compras anteriores quedan.
create or replace function public.rol_plataforma_control()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.tiendas t
             where t.propietario_id = new.usuario_id and t.estado <> 'archivada')
     or exists (select 1 from public.miembros_tienda m
                where m.usuario_id = new.usuario_id and m.estado = 'activo') then
    raise exception 'Esa cuenta tiene una tienda o es parte del equipo de una: primero tiene que dejarla'
      using errcode = 'TC409';
  end if;
  return new;
end $$;

create or replace function public.rol_plataforma_limpiar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.carrito_items i using public.carritos c
  where c.id = i.carrito_id and c.usuario_id = new.usuario_id;
  delete from public.favoritos f where f.usuario_id = new.usuario_id;
  return null;
end $$;

create trigger zz_rol_plataforma_control before insert or update of usuario_id on public.roles_plataforma
  for each row execute function public.rol_plataforma_control();
create trigger rol_plataforma_limpiar after insert or update of usuario_id on public.roles_plataforma
  for each row execute function public.rol_plataforma_limpiar();

revoke execute on function
  public.equipo_no_compra(),
  public.equipo_no_vende(),
  public.rol_plataforma_control(),
  public.rol_plataforma_limpiar()
from public, anon, authenticated, service_role;
