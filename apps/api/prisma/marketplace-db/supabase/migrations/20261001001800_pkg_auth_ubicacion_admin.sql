-- ============================================================================
-- Paquetes del API: cuentas (pkg_auth), ubicación (pkg_ubicacion) y
-- administración de la plataforma (pkg_admin).
--
-- Convenciones de todos los paquetes pkg_*:
--   · El API no lee ni escribe tablas: solo llama a estas funciones.
--   · Cada paquete es un esquema propio. Supabase no los publica en su API REST
--     (solo publica "public"), así que el navegador no los puede llamar.
--   · "security invoker" (lo normal): corre con el rol del usuario, así que las
--     políticas RLS y los triggers de reglas de negocio siguen aplicando.
--   · Sin permiso para anon/authenticated: solo las llama el servidor con el
--     usuario dueño de la base (login, registro, datos de auth.users).
--   · Los errores usan códigos propios que el API traduce a HTTP:
--       TC400 dato inválido · TC403 sin permiso · TC404 no existe · TC409 conflicto
--   · Las respuestas compuestas se devuelven como jsonb en un solo viaje.
-- ============================================================================

create schema if not exists pkg_auth;
create schema if not exists pkg_ubicacion;
create schema if not exists pkg_admin;
comment on schema pkg_auth is 'Cuentas, sesión y perfil. Solo lo llama el API.';
comment on schema pkg_ubicacion is 'Provincias y localidades. Solo lo llama el API.';
comment on schema pkg_admin is 'Administración de la plataforma. Solo lo llama el API.';

-- ----------------------------------------------------------------------------
-- pkg_auth
-- ----------------------------------------------------------------------------

-- Registro (servidor). El trigger crear_perfil_al_registrarse crea el perfil.
create or replace function pkg_auth.registrar(
  p_email text, p_hash text, p_nombre text, p_apellido text, p_telefono text default null
) returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  if exists (select 1 from auth.users where email = p_email) then
    raise exception 'El correo electrónico ya está registrado' using errcode = 'TC409';
  end if;

  insert into auth.users (email, encrypted_password, raw_user_meta_data)
  values (p_email, p_hash, jsonb_build_object('nombre', p_nombre, 'apellido', p_apellido))
  returning id into v_id;

  if p_telefono is not null then
    update public.perfiles set telefono = p_telefono where id = v_id;
  end if;
  return v_id;
end $$;

-- Login (servidor): el hash se compara en el API con bcrypt.
create or replace function pkg_auth.credenciales(p_email text)
returns table (id uuid, hash text) language sql stable set search_path = '' as $$
  select u.id, u.encrypted_password from auth.users u where u.email = p_email
$$;

create or replace function pkg_auth.hash_actual(p_usuario uuid)
returns text language sql stable set search_path = '' as $$
  select u.encrypted_password from auth.users u where u.id = p_usuario
$$;

create or replace function pkg_auth.cambiar_clave(p_usuario uuid, p_hash text)
returns void language plpgsql set search_path = '' as $$
begin
  update auth.users set encrypted_password = p_hash where id = p_usuario;
  if not found then
    raise exception 'Usuario no encontrado' using errcode = 'TC404';
  end if;
end $$;

-- Datos de la sesión (servidor): perfil, roles de plataforma y tiendas donde trabaja.
create or replace function pkg_auth.sesion(p_usuario uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'email', u.email,
    'nombre', p.nombre,
    'apellido', p.apellido,
    'telefono', p.telefono,
    'avatar_url', p.avatar_url,
    'creado_en', p.creado_en,
    'rolesPlataforma', coalesce((
      select jsonb_agg(r.rol order by r.rol)
      from public.roles_plataforma r where r.usuario_id = p.id
    ), '[]'::jsonb),
    'tiendas', coalesce((
      select jsonb_agg(x.tienda order by x.orden, x.nombre)
      from (
        select jsonb_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug,
                                  'estado', t.estado, 'rol', 'propietario') as tienda,
               0 as orden, t.nombre
        from public.tiendas t
        where t.propietario_id = p.id
        union all
        select jsonb_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug,
                                  'estado', t.estado, 'rol', rt.nombre),
               1, t.nombre
        from public.miembros_tienda m
        join public.tiendas t on t.id = m.tienda_id
        join public.roles_tienda rt on rt.id = m.rol_id
        where m.usuario_id = p.id and m.estado = 'activo'
      ) x
    ), '[]'::jsonb)
  )
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.id = p_usuario
$$;

-- Perfil propio. Solo cambia las claves presentes en p_cambios.
create or replace function pkg_auth.actualizar_perfil(p_cambios jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.perfiles set
    nombre   = case when p_cambios ? 'nombre'   then p_cambios ->> 'nombre'   else nombre end,
    apellido = case when p_cambios ? 'apellido' then p_cambios ->> 'apellido' else apellido end,
    telefono = case when p_cambios ? 'telefono' then p_cambios ->> 'telefono' else telefono end
  where id = auth.uid();
  if not found then
    raise exception 'Usuario no encontrado' using errcode = 'TC404';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- pkg_ubicacion
-- ----------------------------------------------------------------------------

create or replace function pkg_ubicacion.localidades()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('id', l.id, 'nombre', l.nombre, 'provincia', pr.nombre)
           order by pr.nombre, l.nombre), '[]'::jsonb)
  from public.localidades l
  join public.provincias pr on pr.id = l.provincia_id
  where l.activa and pr.activa
$$;

-- ----------------------------------------------------------------------------
-- pkg_admin
-- ----------------------------------------------------------------------------

-- ¿Tiene alguno de estos roles de plataforma? (servidor). Lista vacía = cualquiera.
-- Igual que public.es_admin(): el superadmin cuenta como todos.
create or replace function pkg_admin.tiene_rol(p_usuario uuid, p_roles text[])
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.roles_plataforma r
    where r.usuario_id = p_usuario
      and (cardinality(p_roles) = 0 or r.rol = 'superadmin' or r.rol::text = any (p_roles))
  )
$$;

-- Tiendas para revisar (servidor): incluye el correo del dueño, que vive en auth.users.
create or replace function pkg_admin.listar_tiendas(p_estado public.estado_tienda default null)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'nombre', t.nombre,
           'slug', t.slug,
           'cuit', t.cuit,
           'razon_social', t.razon_social,
           'telefono', t.telefono,
           'direccion', t.direccion,
           'estado', t.estado,
           'creado_en', t.creado_en,
           'localidad', l.nombre,
           'duenio', jsonb_build_object('nombre', concat_ws(' ', p.nombre, p.apellido), 'email', u.email),
           'mercadoPagoVinculada', exists (select 1 from public.cuentas_mp_tienda mp where mp.tienda_id = t.id),
           'plan', (select pl.nombre
                    from public.suscripciones s
                    join public.planes pl on pl.id = s.plan_id
                    where s.tienda_id = t.id and s.estado in ('activa', 'en_gracia', 'pendiente')
                    limit 1)
         ) order by t.creado_en desc), '[]'::jsonb)
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.perfiles p on p.id = t.propietario_id
  left join auth.users u on u.id = t.propietario_id
  where p_estado is null or t.estado = p_estado
$$;

-- Corre como el admin: el trigger de tiendas valida quién cambia el estado
-- y exige Mercado Pago vinculado para activar.
create or replace function pkg_admin.cambiar_estado_tienda(p_tienda uuid, p_estado public.estado_tienda)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_tienda jsonb;
begin
  update public.tiendas set estado = p_estado
  where id = p_tienda
  returning jsonb_build_object('id', id, 'nombre', nombre, 'estado', estado) into v_tienda;
  if v_tienda is null then
    raise exception 'No encontramos esa tienda' using errcode = 'TC404';
  end if;
  return v_tienda;
end $$;

-- La plataforma tiene un único superadmin (servidor, script db:superadmin).
-- Devuelve 'asignado' o 'ya_era'.
create or replace function pkg_admin.asignar_superadmin(p_email text, p_reemplazar boolean default false)
returns text language plpgsql set search_path = '' as $$
declare
  v_usuario uuid;
  v_actual uuid;
  v_nombre text;
begin
  select id into v_usuario from auth.users where email = lower(trim(p_email));
  if v_usuario is null then
    raise exception 'No hay ninguna cuenta registrada con %. Registrate primero desde la web.', p_email
      using errcode = 'TC404';
  end if;

  select r.usuario_id, nullif(concat_ws(' ', p.nombre, p.apellido), '')
    into v_actual, v_nombre
  from public.roles_plataforma r
  join public.perfiles p on p.id = r.usuario_id
  where r.rol = 'superadmin';

  if v_actual = v_usuario then
    return 'ya_era';
  end if;
  if v_actual is not null and not p_reemplazar then
    raise exception 'Ya hay un superadmin (%). Volvé a ejecutar con --reemplazar para pasarle el rol a esta cuenta.',
      coalesce(v_nombre, v_actual::text) using errcode = 'TC409';
  end if;

  delete from public.roles_plataforma where rol = 'superadmin';
  insert into public.roles_plataforma (usuario_id, rol) values (v_usuario, 'superadmin');
  return 'asignado';
end $$;

-- ----------------------------------------------------------------------------
-- pkg_sistema
-- ----------------------------------------------------------------------------
create schema if not exists pkg_sistema;
comment on schema pkg_sistema is 'Estado de la plataforma. Solo lo llama el API.';

-- Chequeo de salud (servidor): confirma la conexión y que la base esté cargada.
create or replace function pkg_sistema.estado()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'tablas', (select count(*) from pg_catalog.pg_tables where schemaname = 'public')
  )
$$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke all on schema pkg_auth, pkg_ubicacion, pkg_admin, pkg_sistema from public;
revoke execute on all functions in schema pkg_auth, pkg_ubicacion, pkg_admin, pkg_sistema
  from public, anon, authenticated, service_role;

grant usage on schema pkg_auth, pkg_admin to authenticated;
grant usage on schema pkg_ubicacion to anon, authenticated;

grant execute on function pkg_auth.actualizar_perfil(jsonb) to authenticated;
grant execute on function pkg_ubicacion.localidades() to anon, authenticated;
grant execute on function pkg_admin.cambiar_estado_tienda(uuid, public.estado_tienda) to authenticated;
