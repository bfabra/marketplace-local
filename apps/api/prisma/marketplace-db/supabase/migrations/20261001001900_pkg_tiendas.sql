-- ============================================================================
-- Paquete del API: tiendas (pkg_tiendas). Convenciones en ..._1800.
-- Las funciones con "_" al principio son auxiliares del paquete.
-- ============================================================================

create schema if not exists pkg_tiendas;
comment on schema pkg_tiendas is 'Alta, panel y datos de las tiendas. Solo lo llama el API.';

-- Primer slug libre a partir de la base: mi-tienda, mi-tienda-2, …
-- security definer: tiene que ver también las tiendas que RLS le oculta al usuario.
create or replace function pkg_tiendas._slug_libre(p_base text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_base text := coalesce(nullif(p_base, ''), 'tienda');
  v_slug text := v_base;
  v_n integer := 2;
begin
  while exists (select 1 from public.tiendas where slug = v_slug) loop
    v_slug := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end $$;

-- El rol authenticated no puede crear suscripciones (las maneja finanzas).
-- Esta auxiliar le da el plan Gratis a una tienda recién creada por su dueño.
-- El trigger de suscripciones sigue rechazando una segunda tienda gratis del mismo dueño.
create or replace function pkg_tiendas._asignar_plan_gratis(p_tienda uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_plan uuid;
begin
  if not public.es_duenio(p_tienda) then
    raise exception 'Solo el dueño puede elegir el plan de la tienda' using errcode = 'TC403';
  end if;
  if exists (select 1 from public.suscripciones where tienda_id = p_tienda) then
    raise exception 'La tienda ya tiene un plan' using errcode = 'TC409';
  end if;

  select id into v_plan from public.planes where es_gratis and activo order by orden limit 1;
  if v_plan is null then
    raise exception 'No hay un plan gratis disponible';
  end if;

  insert into public.suscripciones (tienda_id, plan_id, estado) values (p_tienda, v_plan, 'activa');
end $$;

-- cuentas_mp_tienda guarda tokens y nadie la lee directo: esta auxiliar solo
-- informa si hay cuenta vinculada, y solo a quien trabaja en la tienda.
create or replace function pkg_tiendas._estado_mp(p_tienda uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'vinculada', mp.id is not null,
    'esPrueba', coalesce(mp.mp_user_id like 'PRUEBA-%', false)
  )
  from (select 1) x
  left join public.cuentas_mp_tienda mp
    on mp.tienda_id = p_tienda and (public.es_miembro(p_tienda) or public.es_admin())
$$;

-- La tienda nace "pendiente" y con el plan Gratis, todo en la misma transacción.
-- El trigger de tiendas pone al usuario como dueño.
create or replace function pkg_tiendas.crear(p_datos jsonb, p_slug_base text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.tiendas
    (propietario_id, nombre, slug, descripcion, cuit, razon_social, telefono, email, localidad_id, direccion)
  values (
    auth.uid(),
    p_datos ->> 'nombre',
    pkg_tiendas._slug_libre(p_slug_base),
    p_datos ->> 'descripcion',
    p_datos ->> 'cuit',
    p_datos ->> 'razon_social',
    p_datos ->> 'telefono',
    p_datos ->> 'email',
    (p_datos ->> 'localidad_id')::uuid,
    p_datos ->> 'direccion'
  )
  returning id into v_id;

  perform pkg_tiendas._asignar_plan_gratis(v_id);
  return v_id;
end $$;

-- Panel de la tienda: datos, plan, Mercado Pago y lo que el usuario puede hacer.
-- Devuelve null si no existe o el usuario no la puede ver.
create or replace function pkg_tiendas.detalle(p_tienda uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'nombre', t.nombre,
    'slug', t.slug,
    'descripcion', t.descripcion,
    'cuit', t.cuit,
    'razon_social', t.razon_social,
    'telefono', t.telefono,
    'email', t.email,
    'direccion', t.direccion,
    'estado', t.estado,
    'creado_en', t.creado_en,
    'localidad', jsonb_build_object('id', l.id, 'nombre', l.nombre, 'provincia', pr.nombre),
    'esDuenio', t.propietario_id = auth.uid(),
    'permisos', coalesce((
      select jsonb_agg(pe.codigo order by pe.codigo)
      from public.permisos pe
      where public.tiene_permiso(t.id, pe.codigo)
    ), '[]'::jsonb),
    'plan', (
      select jsonb_build_object(
        'nombre', pl.nombre,
        'es_gratis', pl.es_gratis,
        'max_productos', pl.max_productos,
        'max_empleados', pl.max_empleados,
        'estado', s.estado,
        'fin_periodo', s.fin_periodo
      )
      from public.suscripciones s
      join public.planes pl on pl.id = s.plan_id
      where s.tienda_id = t.id and s.estado in ('activa', 'en_gracia', 'pendiente')
      limit 1
    ),
    'mercadoPago', pkg_tiendas._estado_mp(t.id)
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  where t.id = p_tienda
$$;

-- Datos de la tienda. Solo cambia las claves presentes en p_cambios.
create or replace function pkg_tiendas.actualizar(p_tienda uuid, p_cambios jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.tiene_permiso(p_tienda, 'configuracion.editar') then
    raise exception 'No tenés permiso para modificar los datos de esta tienda' using errcode = 'TC403';
  end if;

  update public.tiendas set
    nombre       = case when p_cambios ? 'nombre'       then p_cambios ->> 'nombre'       else nombre end,
    descripcion  = case when p_cambios ? 'descripcion'  then p_cambios ->> 'descripcion'  else descripcion end,
    cuit         = case when p_cambios ? 'cuit'         then p_cambios ->> 'cuit'         else cuit end,
    razon_social = case when p_cambios ? 'razon_social' then p_cambios ->> 'razon_social' else razon_social end,
    telefono     = case when p_cambios ? 'telefono'     then p_cambios ->> 'telefono'     else telefono end,
    email        = case when p_cambios ? 'email'        then p_cambios ->> 'email'        else email end,
    localidad_id = case when p_cambios ? 'localidad_id' then (p_cambios ->> 'localidad_id')::uuid else localidad_id end,
    direccion    = case when p_cambios ? 'direccion'    then p_cambios ->> 'direccion'    else direccion end
  where id = p_tienda;
end $$;

-- Solo desarrollo (servidor; el API no la ofrece en producción): simula la
-- vinculación con Mercado Pago, que la base exige para activar una tienda.
create or replace function pkg_tiendas.vincular_mp_prueba(p_usuario uuid, p_tienda uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.tiendas where id = p_tienda and propietario_id = p_usuario) then
    raise exception 'Solo el dueño puede vincular Mercado Pago' using errcode = 'TC403';
  end if;

  insert into public.cuentas_mp_tienda
    (tienda_id, mp_user_id, access_token_cifrado, refresh_token_cifrado, expira_en)
  values (p_tienda, 'PRUEBA-' || left(p_tienda::text, 8), 'prueba', 'prueba', now() + interval '365 days')
  on conflict (tienda_id) do update set
    mp_user_id            = excluded.mp_user_id,
    access_token_cifrado  = excluded.access_token_cifrado,
    refresh_token_cifrado = excluded.refresh_token_cifrado,
    expira_en             = excluded.expira_en;
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke all on schema pkg_tiendas from public;
revoke execute on all functions in schema pkg_tiendas from public, anon, authenticated, service_role;
grant usage on schema pkg_tiendas to authenticated;
grant execute on function
  pkg_tiendas._slug_libre(text),
  pkg_tiendas._asignar_plan_gratis(uuid),
  pkg_tiendas._estado_mp(uuid),
  pkg_tiendas.crear(jsonb, text),
  pkg_tiendas.detalle(uuid),
  pkg_tiendas.actualizar(uuid, jsonb)
to authenticated;
