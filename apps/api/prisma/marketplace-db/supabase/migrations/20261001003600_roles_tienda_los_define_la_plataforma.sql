-- ============================================================================
-- Los roles que se asignan a los empleados de las tiendas los define la
-- plataforma. El dueño ya no crea, edita ni borra roles: ve los predefinidos
-- y elige uno al invitar o al cambiar el rol de una persona. Solo el
-- superadmin crea, edita y borra los roles predefinidos (tienda_id vacío).
-- Los roles propios que ya existían siguen funcionando, pero nadie los edita.
-- ============================================================================

drop function pkg_equipo.guardar_rol(uuid, uuid, text, text[]);
drop function pkg_equipo.borrar_rol(uuid, uuid);

drop policy "roles_tienda: el dueño crea los suyos" on public.roles_tienda;
drop policy "roles_permisos: el dueño edita sus roles" on public.roles_permisos;

create policy "roles_tienda: el superadmin define los predefinidos" on public.roles_tienda
  for all to authenticated
  using (tienda_id is null and public.es_admin('superadmin'))
  with check (tienda_id is null and public.es_admin('superadmin'));
create policy "roles_permisos: el superadmin edita los predefinidos" on public.roles_permisos
  for all to authenticated
  using (public.es_admin('superadmin')
         and exists (select 1 from public.roles_tienda r where r.id = rol_id and r.tienda_id is null))
  with check (public.es_admin('superadmin')
              and exists (select 1 from public.roles_tienda r where r.id = rol_id and r.tienda_id is null));

-- ----------------------------------------------------------------------------
-- pkg_admin: roles de las tiendas
-- ----------------------------------------------------------------------------

create or replace function pkg_admin._exigir_superadmin_roles()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.es_admin('superadmin') then
    raise exception 'Solo el superadmin define los roles de las tiendas' using errcode = 'TC403';
  end if;
end $$;

-- Roles predefinidos con su uso en todas las tiendas (servidor: la ruta exige superadmin).
create or replace function pkg_admin.roles_tienda()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'nombre', r.nombre,
               'permisos', coalesce((
                 select jsonb_agg(rp.permiso_codigo order by rp.permiso_codigo)
                 from public.roles_permisos rp where rp.rol_id = r.id
               ), '[]'::jsonb),
               'personas', (select count(*) from public.miembros_tienda m
                            where m.rol_id = r.id and m.estado <> 'retirado'),
               'tiendas', (select count(distinct m.tienda_id) from public.miembros_tienda m
                           where m.rol_id = r.id and m.estado <> 'retirado'),
               'invitaciones', (select count(*) from public.invitaciones i
                                where i.rol_id = r.id and i.estado = 'pendiente')
             ) order by r.nombre)
      from public.roles_tienda r
      where r.tienda_id is null
    ), '[]'::jsonb),
    'permisos', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', pe.codigo, 'area', pe.area, 'descripcion', pe.descripcion)
                       order by pe.area, pe.codigo)
      from public.permisos pe
    ), '[]'::jsonb)
  )
$$;

-- Crea (p_rol null) o edita un rol predefinido.
create or replace function pkg_admin.guardar_rol_tienda(p_rol uuid, p_nombre text, p_permisos text[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre text := trim(p_nombre);
  v_id     uuid := p_rol;
begin
  perform pkg_admin._exigir_superadmin_roles();
  if char_length(coalesce(v_nombre, '')) not between 2 and 40 then
    raise exception 'El nombre del rol debe tener entre 2 y 40 caracteres' using errcode = 'TC400';
  end if;
  if coalesce(cardinality(p_permisos), 0) = 0 then
    raise exception 'Elegí al menos un permiso' using errcode = 'TC400';
  end if;
  if exists (select 1 from unnest(p_permisos) c
             where not exists (select 1 from public.permisos pe where pe.codigo = c)) then
    raise exception 'Hay un permiso que no existe' using errcode = 'TC400';
  end if;

  if v_id is null then
    insert into public.roles_tienda (tienda_id, nombre) values (null, v_nombre) returning id into v_id;
  else
    update public.roles_tienda set nombre = v_nombre where id = v_id and tienda_id is null;
    if not found then
      raise exception 'No encontramos ese rol' using errcode = 'TC404';
    end if;
    delete from public.roles_permisos where rol_id = v_id;
  end if;

  insert into public.roles_permisos (rol_id, permiso_codigo)
  select distinct v_id, c from unnest(p_permisos) c;
  return v_id;
exception
  when unique_violation then
    raise exception 'Ya hay un rol con ese nombre' using errcode = 'TC409';
end $$;

-- security definer: los retirados y las invitaciones viejas de cualquier tienda
-- pasan a otro rol predefinido para poder borrar este.
create or replace function pkg_admin.borrar_rol_tienda(p_rol uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_otro uuid;
begin
  perform pkg_admin._exigir_superadmin_roles();
  if not exists (select 1 from public.roles_tienda where id = p_rol and tienda_id is null) then
    raise exception 'No encontramos ese rol' using errcode = 'TC404';
  end if;
  if exists (select 1 from public.miembros_tienda where rol_id = p_rol and estado <> 'retirado')
     or exists (select 1 from public.invitaciones where rol_id = p_rol and estado = 'pendiente') then
    raise exception 'Hay personas o invitaciones con este rol en alguna tienda: no se puede borrar' using errcode = 'TC409';
  end if;
  select id into v_otro from public.roles_tienda
  where tienda_id is null and id <> p_rol order by nombre limit 1;
  if v_otro is null then
    raise exception 'Tiene que quedar al menos un rol para que las tiendas puedan sumar empleados' using errcode = 'TC409';
  end if;

  update public.miembros_tienda set rol_id = v_otro where rol_id = p_rol;
  update public.invitaciones set rol_id = v_otro where rol_id = p_rol;
  delete from public.roles_tienda where id = p_rol;
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  pkg_admin._exigir_superadmin_roles(),
  pkg_admin.roles_tienda(),
  pkg_admin.guardar_rol_tienda(uuid, text, text[]),
  pkg_admin.borrar_rol_tienda(uuid)
from public, anon, authenticated, service_role;
grant execute on function
  pkg_admin._exigir_superadmin_roles(),
  pkg_admin.guardar_rol_tienda(uuid, text, text[]),
  pkg_admin.borrar_rol_tienda(uuid)
to authenticated;
