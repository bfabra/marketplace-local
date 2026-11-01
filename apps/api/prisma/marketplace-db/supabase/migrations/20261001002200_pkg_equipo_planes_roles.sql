-- ============================================================================
-- Paquetes del API: equipo de cada tienda (pkg_equipo), cambio de plan
-- (pkg_tiendas) y roles de la plataforma (pkg_admin). Convenciones en ..._1800.
--
-- El equipo lo administra solo el dueño: invitar, cambiar roles, suspender y
-- retirar empleados. El límite de empleados del plan lo controla la base al
-- invitar (contando las invitaciones pendientes) y al activar a cada empleado.
-- ============================================================================

create schema if not exists pkg_equipo;
comment on schema pkg_equipo is 'Empleados, invitaciones y roles de cada tienda. Solo lo llama el API.';

-- ----------------------------------------------------------------------------
-- pkg_equipo: auxiliares
-- ----------------------------------------------------------------------------

create or replace function pkg_equipo._solo_duenio(p_tienda uuid)
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.es_duenio(p_tienda) then
    raise exception 'Solo el dueño administra el equipo de la tienda' using errcode = 'TC403';
  end if;
end $$;

-- Correo de un integrante (vive en auth.users). Solo para el dueño de una
-- tienda donde esa persona trabaja.
create or replace function pkg_equipo._email(p_usuario uuid)
returns text language sql stable security definer set search_path = '' as $$
  select u.email from auth.users u
  where u.id = p_usuario
    and exists (select 1 from public.miembros_tienda m
                where m.usuario_id = p_usuario and public.es_duenio(m.tienda_id))
$$;

-- Que el invitado no sea el dueño ni alguien que ya trabaja en la tienda.
create or replace function pkg_equipo._validar_invitado(p_tienda uuid, p_email text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_duenio(p_tienda) then
    raise exception 'Solo el dueño administra el equipo de la tienda' using errcode = 'TC403';
  end if;
  if exists (select 1 from public.tiendas t join auth.users u on u.id = t.propietario_id
             where t.id = p_tienda and lower(u.email) = p_email) then
    raise exception 'Ese correo es el tuyo: como dueño ya tenés todos los permisos' using errcode = 'TC400';
  end if;
  if exists (select 1 from public.miembros_tienda m join auth.users u on u.id = m.usuario_id
             where m.tienda_id = p_tienda and m.estado in ('activo', 'suspendido') and lower(u.email) = p_email) then
    raise exception 'Esa persona ya es parte del equipo' using errcode = 'TC409';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- pkg_equipo: consultas
-- ----------------------------------------------------------------------------

-- Todo lo que necesita la pantalla de equipo, en un solo viaje.
create or replace function pkg_equipo.equipo(p_tienda uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_plan public.planes;
begin
  perform pkg_equipo._solo_duenio(p_tienda);
  v_plan := public.plan_vigente(p_tienda);

  return jsonb_build_object(
    'plan', jsonb_build_object('nombre', v_plan.nombre, 'max_empleados', v_plan.max_empleados),
    'activos', public.contar_empleados_activos(p_tienda, null),
    'miembros', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'nombre', nullif(concat_ws(' ', p.nombre, p.apellido), ''),
               'email', pkg_equipo._email(m.usuario_id),
               'rol', jsonb_build_object('id', r.id, 'nombre', r.nombre),
               'estado', m.estado,
               'creado_en', m.creado_en
             ) order by m.creado_en)
      from public.miembros_tienda m
      join public.roles_tienda r on r.id = m.rol_id
      left join public.perfiles p on p.id = m.usuario_id
      where m.tienda_id = p_tienda and m.estado <> 'retirado'
    ), '[]'::jsonb),
    'invitaciones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'email', i.email,
               'rol', r.nombre,
               'expira_en', i.expira_en,
               'vencida', i.expira_en < now()
             ) order by i.creado_en desc)
      from public.invitaciones i
      join public.roles_tienda r on r.id = i.rol_id
      where i.tienda_id = p_tienda and i.estado = 'pendiente'
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'nombre', r.nombre,
               'propio', r.tienda_id is not null,
               'permisos', coalesce((
                 select jsonb_agg(rp.permiso_codigo order by rp.permiso_codigo)
                 from public.roles_permisos rp where rp.rol_id = r.id
               ), '[]'::jsonb),
               'enUso', (select count(*) from public.miembros_tienda m
                         where m.rol_id = r.id and m.tienda_id = p_tienda and m.estado <> 'retirado')
             ) order by r.tienda_id is not null, r.nombre)
      from public.roles_tienda r
      where r.tienda_id is null or r.tienda_id = p_tienda
    ), '[]'::jsonb),
    'permisos', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', pe.codigo, 'area', pe.area, 'descripcion', pe.descripcion)
                       order by pe.area, pe.codigo)
      from public.permisos pe
    ), '[]'::jsonb)
  );
end $$;

-- Datos públicos de una invitación, para la página que la acepta.
-- security definer: el invitado todavía no ve la tienda; el código es secreto.
create or replace function pkg_equipo.ver_invitacion(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tienda', t.nombre,
    'rol', r.nombre,
    'email', i.email,
    'estado', case when i.estado = 'pendiente' and i.expira_en < now() then 'vencida'
                   else i.estado::text end,
    'permisos', coalesce((
      select jsonb_agg(pe.descripcion order by pe.area, pe.codigo)
      from public.roles_permisos rp join public.permisos pe on pe.codigo = rp.permiso_codigo
      where rp.rol_id = r.id
    ), '[]'::jsonb)
  )
  from public.invitaciones i
  join public.tiendas t on t.id = i.tienda_id
  join public.roles_tienda r on r.id = i.rol_id
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

-- ----------------------------------------------------------------------------
-- pkg_equipo: invitaciones
-- ----------------------------------------------------------------------------

-- Devuelve el código de la invitación (no se guarda: el API arma el enlace y lo envía).
create or replace function pkg_equipo.invitar(p_tienda uuid, p_email text, p_rol uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_plan  public.planes;
  v_token text;
begin
  perform pkg_equipo._validar_invitado(p_tienda, v_email);

  v_plan := public.plan_vigente(p_tienda);
  if v_plan.id is null then
    raise exception 'La tienda no tiene una suscripción activa' using errcode = 'TC400';
  end if;
  if v_plan.max_empleados = 0 then
    raise exception 'El plan % no incluye empleados. Cambiá de plan para sumar a tu equipo.', v_plan.nombre
      using errcode = 'TC400';
  end if;
  if v_plan.max_empleados is not null
     and public.contar_empleados_activos(p_tienda, null) + (
           select count(*) from public.invitaciones
           where tienda_id = p_tienda and estado = 'pendiente' and expira_en > now() and email <> v_email
         ) >= v_plan.max_empleados then
    raise exception 'Tu plan (%) permite hasta % empleados, contando las invitaciones pendientes', v_plan.nombre, v_plan.max_empleados
      using errcode = 'TC400';
  end if;

  -- Una sola invitación vigente por correo: la nueva reemplaza a la anterior.
  update public.invitaciones set estado = 'anulada'
  where tienda_id = p_tienda and email = v_email and estado = 'pendiente';

  v_token := public.crear_invitacion(p_tienda, v_email, p_rol);
  return jsonb_build_object(
    'token', v_token,
    'email', v_email,
    'tienda', (select nombre from public.tiendas where id = p_tienda)
  );
end $$;

create or replace function pkg_equipo.anular_invitacion(p_tienda uuid, p_invitacion uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_equipo._solo_duenio(p_tienda);
  update public.invitaciones set estado = 'anulada'
  where id = p_invitacion and tienda_id = p_tienda and estado = 'pendiente';
  if not found then
    raise exception 'No encontramos esa invitación pendiente' using errcode = 'TC404';
  end if;
end $$;

-- La acepta el invitado con su sesión. Devuelve la tienda.
create or replace function pkg_equipo.aceptar(p_token text)
returns uuid language sql security invoker set search_path = '' as $$
  select public.aceptar_invitacion(p_token)
$$;

-- ----------------------------------------------------------------------------
-- pkg_equipo: integrantes
-- ----------------------------------------------------------------------------

create or replace function pkg_equipo.cambiar_rol(p_tienda uuid, p_miembro uuid, p_rol uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_equipo._solo_duenio(p_tienda);
  if not exists (select 1 from public.roles_tienda
                 where id = p_rol and (tienda_id is null or tienda_id = p_tienda)) then
    raise exception 'Rol inválido para esta tienda' using errcode = 'TC400';
  end if;
  update public.miembros_tienda set rol_id = p_rol
  where id = p_miembro and tienda_id = p_tienda and estado <> 'retirado';
  if not found then
    raise exception 'No encontramos a esa persona en el equipo' using errcode = 'TC404';
  end if;
end $$;

-- activo, suspendido o retirado. Al reactivar, la base vuelve a controlar el límite del plan.
create or replace function pkg_equipo.cambiar_estado(p_tienda uuid, p_miembro uuid, p_estado public.estado_miembro)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_equipo._solo_duenio(p_tienda);
  if p_estado = 'invitado' then
    raise exception 'Estado inválido' using errcode = 'TC400';
  end if;
  update public.miembros_tienda set estado = p_estado
  where id = p_miembro and tienda_id = p_tienda and estado <> 'retirado';
  if not found then
    raise exception 'No encontramos a esa persona en el equipo' using errcode = 'TC404';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- pkg_equipo: roles propios de la tienda (los predefinidos no se editan)
-- ----------------------------------------------------------------------------

create or replace function pkg_equipo.guardar_rol(p_tienda uuid, p_rol uuid, p_nombre text, p_permisos text[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre text := trim(p_nombre);
  v_id     uuid := p_rol;
begin
  perform pkg_equipo._solo_duenio(p_tienda);
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
    insert into public.roles_tienda (tienda_id, nombre) values (p_tienda, v_nombre) returning id into v_id;
  else
    update public.roles_tienda set nombre = v_nombre where id = v_id and tienda_id = p_tienda;
    if not found then
      raise exception 'No encontramos ese rol entre los de tu tienda' using errcode = 'TC404';
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

create or replace function pkg_equipo.borrar_rol(p_tienda uuid, p_rol uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_equipo._solo_duenio(p_tienda);
  if exists (select 1 from public.miembros_tienda where rol_id = p_rol and estado <> 'retirado')
     or exists (select 1 from public.invitaciones where rol_id = p_rol and estado = 'pendiente') then
    raise exception 'Hay personas o invitaciones con este rol: asignales otro antes de borrarlo' using errcode = 'TC409';
  end if;

  -- Los retirados y las invitaciones viejas pasan a un rol predefinido para poder borrar este.
  update public.miembros_tienda set rol_id = (select id from public.roles_tienda where tienda_id is null order by nombre limit 1)
  where rol_id = p_rol and tienda_id = p_tienda;
  update public.invitaciones set rol_id = (select id from public.roles_tienda where tienda_id is null order by nombre limit 1)
  where rol_id = p_rol and tienda_id = p_tienda;

  delete from public.roles_tienda where id = p_rol and tienda_id = p_tienda;
  if not found then
    raise exception 'No encontramos ese rol entre los de tu tienda' using errcode = 'TC404';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- pkg_tiendas: planes
-- ----------------------------------------------------------------------------

-- Planes disponibles, con el actual marcado y lo que la tienda usa hoy.
create or replace function pkg_tiendas.planes(p_tienda uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_actual public.planes;
begin
  if not public.es_miembro(p_tienda) then
    raise exception 'No encontramos esa tienda o no tenés acceso a ella' using errcode = 'TC404';
  end if;
  v_actual := public.plan_vigente(p_tienda);

  return jsonb_build_object(
    'actual', v_actual.id,
    'esDuenio', public.es_duenio(p_tienda),
    'uso', jsonb_build_object(
      'publicados', public.contar_publicados(p_tienda, null),
      'empleados', public.contar_empleados_activos(p_tienda, null)
    ),
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pl.id,
               'nombre', pl.nombre,
               'precio_mensual', pl.precio_mensual,
               'max_productos', pl.max_productos,
               'max_empleados', pl.max_empleados,
               'es_gratis', pl.es_gratis
             ) order by pl.orden)
      from public.planes pl
      where pl.activo
    ), '[]'::jsonb)
  );
end $$;

-- Cambio de plan (servidor: el usuario no puede escribir suscripciones).
-- Un plan con precio exige el id del pago aprobado por Mercado Pago.
-- Al bajar de plan, la base pausa los productos y suspende los empleados que sobran.
create or replace function pkg_tiendas.cambiar_plan(p_usuario uuid, p_tienda uuid, p_plan uuid, p_pago_mp text default null)
returns void language plpgsql set search_path = '' as $$
declare
  v_plan public.planes;
  v_susc public.suscripciones;
begin
  if not exists (select 1 from public.tiendas where id = p_tienda and propietario_id = p_usuario) then
    raise exception 'Solo el dueño puede cambiar el plan de la tienda' using errcode = 'TC403';
  end if;

  select * into v_plan from public.planes where id = p_plan and activo;
  if not found then
    raise exception 'Ese plan no está disponible' using errcode = 'TC404';
  end if;
  if v_plan.precio_mensual > 0 and p_pago_mp is null then
    raise exception 'Este plan se paga con Mercado Pago' using errcode = 'TC400';
  end if;

  select * into v_susc from public.suscripciones
  where tienda_id = p_tienda and estado in ('activa', 'en_gracia', 'pendiente')
  for update;

  if v_susc.plan_id = p_plan and v_susc.estado = 'activa' then
    raise exception 'La tienda ya tiene el plan %', v_plan.nombre using errcode = 'TC409';
  end if;

  if v_susc.id is null then
    insert into public.suscripciones (tienda_id, plan_id, estado, fin_periodo)
    values (p_tienda, p_plan, 'activa',
            case when v_plan.precio_mensual > 0 then now() + interval '1 month' end)
    returning * into v_susc;
  else
    update public.suscripciones set
      plan_id      = p_plan,
      estado       = 'activa',
      inicio       = now(),
      fin_periodo  = case when v_plan.precio_mensual > 0 then now() + interval '1 month' end,
      gracia_hasta = null
    where id = v_susc.id;
  end if;

  if v_plan.precio_mensual > 0 then
    insert into public.pagos_suscripcion (suscripcion_id, periodo, monto, estado, mp_payment_id, pagado_en)
    values (v_susc.id, date_trunc('month', now())::date, v_plan.precio_mensual, 'aprobado', p_pago_mp, now())
    on conflict (suscripcion_id, periodo) do update set
      monto = excluded.monto, estado = 'aprobado',
      mp_payment_id = excluded.mp_payment_id, pagado_en = excluded.pagado_en;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- pkg_admin: roles de la plataforma (solo el superadmin)
-- ----------------------------------------------------------------------------

create or replace function pkg_admin._usuario_por_email(p_email text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.es_admin('superadmin') then
    raise exception 'Solo el superadmin asigna roles de plataforma' using errcode = 'TC403';
  end if;
  select id into v_id from auth.users where email = lower(trim(p_email));
  if v_id is null then
    raise exception 'No hay ninguna cuenta con ese correo. Pedile que se registre primero.' using errcode = 'TC404';
  end if;
  return v_id;
end $$;

-- Quién tiene cada rol (servidor: incluye correos de auth.users).
create or replace function pkg_admin.roles_plataforma()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'usuario_id', x.usuario_id,
           'nombre', x.nombre,
           'email', x.email,
           'roles', x.roles
         ) order by x.es_super desc, x.nombre), '[]'::jsonb)
  from (
    select r.usuario_id,
           nullif(concat_ws(' ', p.nombre, p.apellido), '') as nombre,
           u.email,
           jsonb_agg(r.rol order by r.rol) as roles,
           bool_or(r.rol = 'superadmin') as es_super
    from public.roles_plataforma r
    join public.perfiles p on p.id = r.usuario_id
    left join auth.users u on u.id = r.usuario_id
    group by r.usuario_id, p.nombre, p.apellido, u.email
  ) x
$$;

create or replace function pkg_admin.asignar_rol(p_email text, p_rol public.rol_plataforma)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_usuario uuid;
begin
  if p_rol = 'superadmin' then
    raise exception 'El superadmin es uno solo y se asigna con el script db:superadmin' using errcode = 'TC400';
  end if;
  v_usuario := pkg_admin._usuario_por_email(p_email);
  insert into public.roles_plataforma (usuario_id, rol) values (v_usuario, p_rol)
  on conflict (usuario_id, rol) do nothing;
  if not found then
    raise exception 'Esa cuenta ya tiene ese rol' using errcode = 'TC409';
  end if;
end $$;

create or replace function pkg_admin.quitar_rol(p_usuario uuid, p_rol public.rol_plataforma)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_rol = 'superadmin' then
    raise exception 'El superadmin no se quita desde acá: se reemplaza con el script db:superadmin' using errcode = 'TC400';
  end if;
  delete from public.roles_plataforma where usuario_id = p_usuario and rol = p_rol;
  if not found then
    raise exception 'Esa cuenta no tiene ese rol' using errcode = 'TC404';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke all on schema pkg_equipo from public;
revoke execute on all functions in schema pkg_equipo from public, anon, authenticated, service_role;
grant usage on schema pkg_equipo to anon, authenticated;
grant execute on all functions in schema pkg_equipo to authenticated;
grant execute on function pkg_equipo.ver_invitacion(text) to anon;

revoke execute on function
  pkg_tiendas.planes(uuid),
  pkg_tiendas.cambiar_plan(uuid, uuid, uuid, text),
  pkg_admin._usuario_por_email(text),
  pkg_admin.roles_plataforma(),
  pkg_admin.asignar_rol(text, public.rol_plataforma),
  pkg_admin.quitar_rol(uuid, public.rol_plataforma)
from public, anon, authenticated, service_role;
grant execute on function
  pkg_tiendas.planes(uuid),
  pkg_admin._usuario_por_email(text),
  pkg_admin.asignar_rol(text, public.rol_plataforma),
  pkg_admin.quitar_rol(uuid, public.rol_plataforma)
to authenticated;
