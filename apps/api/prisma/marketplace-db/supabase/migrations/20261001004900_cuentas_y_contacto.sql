-- ============================================================================
-- Cuentas completas y contacto de las tiendas. Convenciones en ..._1800.
--
-- Cuentas:
--   * DNI, aceptación de los términos e ingreso con Google, en datos_cuenta: es
--     privada (solo la ve el dueño y soporte), a diferencia de perfiles, que
--     ven los comercios y repartidores de sus pedidos.
--   * El registro guarda en un solo paso la cuenta, el DNI, los términos y el
--     domicilio de entrega (la primera dirección, principal).
--   * Recuperar la contraseña: el API manda por correo un enlace con un código;
--     acá se guarda solo su hash y vence a los pocos minutos.
--   * sesiones_desde: al cambiar o restablecer la contraseña se cierran las
--     sesiones anteriores (el API rechaza los tokens emitidos antes).
--
-- Tiendas:
--   * Varios teléfonos (hasta 5) con característica de país y tipo
--     (WhatsApp, celular o fijo). La columna telefono sigue siendo el principal
--     (el primero) para las pantallas que muestran uno solo.
--   * Coordenadas (lat, lng, ya existían) que se cargan al importar el local
--     desde Google Maps.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Datos privados de la cuenta
-- ----------------------------------------------------------------------------
create table public.datos_cuenta (
  usuario_id            uuid primary key references public.perfiles (id) on delete cascade,
  dni                   text unique check (dni ~ '^[0-9]{7,8}$'),
  google_sub            text unique,
  terminos_version      text,
  terminos_aceptados_en timestamptz,
  sesiones_desde        timestamptz,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
comment on table public.datos_cuenta is 'Datos privados de cada cuenta: DNI, ingreso con Google, términos aceptados. Solo los ve el dueño y soporte.';
comment on column public.datos_cuenta.google_sub is 'Id de la cuenta de Google ("sub" del token). Sin valor: la cuenta no se vinculó con Google.';
comment on column public.datos_cuenta.sesiones_desde is 'Las sesiones iniciadas antes de este momento ya no valen (cambio de contraseña).';

create trigger actualizado_en before update on public.datos_cuenta
  for each row execute function public.tg_actualizado_en();

alter table public.datos_cuenta enable row level security;
create policy "datos_cuenta: el propio ve" on public.datos_cuenta
  for select to authenticated using (usuario_id = auth.uid());
create policy "datos_cuenta: soporte ve" on public.datos_cuenta
  for select to authenticated using (public.es_admin('soporte'));

-- ----------------------------------------------------------------------------
-- Pedidos para restablecer la contraseña (solo el servidor: sin políticas)
-- ----------------------------------------------------------------------------
create table public.recuperaciones_clave (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  token_hash  text not null unique,     -- se guarda el hash, nunca el código
  vence_en    timestamptz not null,
  usada_en    timestamptz,
  creado_en   timestamptz not null default now()
);
comment on table public.recuperaciones_clave is 'Enlaces para restablecer la contraseña. Solo los maneja el servidor.';
create index recuperaciones_clave_usuario_idx on public.recuperaciones_clave (usuario_id, creado_en desc);
alter table public.recuperaciones_clave enable row level security;

-- ----------------------------------------------------------------------------
-- Teléfonos de la tienda
-- ----------------------------------------------------------------------------
alter table public.tiendas
  add column telefonos jsonb not null default '[]'::jsonb
  check (jsonb_typeof(telefonos) = 'array');
comment on column public.tiendas.telefonos is 'Hasta 5: [{pais: "+54", numero: "264 4123456", tipo: whatsapp|celular|fijo}]. El primero es el principal (columna telefono).';

update public.tiendas
set telefonos = jsonb_build_array(jsonb_build_object(
      'pais', '+54',
      'numero', trim(regexp_replace(telefono, '[^0-9 ()-]', '', 'g')),
      'tipo', 'celular'))
where nullif(trim(regexp_replace(telefono, '[^0-9 ()-]', '', 'g')), '') is not null;

-- ----------------------------------------------------------------------------
-- pkg_auth
-- ----------------------------------------------------------------------------

create or replace function pkg_auth._dni(p_dni text)
returns text language plpgsql immutable set search_path = '' as $$
declare v_dni text := regexp_replace(coalesce(p_dni, ''), '[.\s-]', '', 'g');
begin
  if v_dni = '' then
    return null;
  end if;
  if v_dni !~ '^[0-9]{7,8}$' then
    raise exception 'El DNI son 7 u 8 números, sin puntos' using errcode = 'TC400';
  end if;
  return v_dni;
end $$;

-- Registro completo (servidor). p_datos: email, nombre, apellido, telefono?,
-- dni, terminos (versión aceptada) y domicilio {calle, numero, piso_depto?, localidad_id}.
-- El trigger crear_perfil_al_registrarse crea el perfil.
create or replace function pkg_auth.registrar_cliente(p_datos jsonb, p_hash text)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_id        uuid;
  v_email     text := lower(trim(p_datos ->> 'email'));
  v_dni       text := pkg_auth._dni(p_datos ->> 'dni');
  v_domicilio jsonb := p_datos -> 'domicilio';
begin
  if nullif(p_datos ->> 'terminos', '') is null then
    raise exception 'Para crear tu cuenta aceptá los Términos y Condiciones' using errcode = 'TC400';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'El correo electrónico ya está registrado' using errcode = 'TC409';
  end if;
  if v_dni is not null and exists (select 1 from public.datos_cuenta where dni = v_dni) then
    raise exception 'Ese DNI ya está registrado en otra cuenta' using errcode = 'TC409';
  end if;
  if v_domicilio is not null and not exists (
       select 1 from public.localidades l
       join public.provincias pr on pr.id = l.provincia_id
       where l.id = (v_domicilio ->> 'localidad_id')::uuid and l.activa and pr.activa) then
    raise exception 'Todavía no estamos en esa localidad. Elegí una de la lista' using errcode = 'TC400';
  end if;

  insert into auth.users (email, encrypted_password, raw_user_meta_data)
  values (v_email, p_hash,
          jsonb_build_object('nombre', p_datos ->> 'nombre', 'apellido', p_datos ->> 'apellido'))
  returning id into v_id;

  update public.perfiles set telefono = nullif(trim(p_datos ->> 'telefono'), '') where id = v_id;

  insert into public.datos_cuenta (usuario_id, dni, terminos_version, terminos_aceptados_en)
  values (v_id, v_dni, p_datos ->> 'terminos', now());

  if v_domicilio is not null then
    insert into public.direcciones (usuario_id, alias, calle, numero, piso_depto, localidad_id, es_principal)
    values (v_id, 'Casa', trim(v_domicilio ->> 'calle'), trim(v_domicilio ->> 'numero'),
            nullif(trim(v_domicilio ->> 'piso_depto'), ''), (v_domicilio ->> 'localidad_id')::uuid, true);
  end if;
  return v_id;
end $$;

-- Ingreso con Google (servidor), con el token ya verificado por el API.
-- Busca la cuenta por el id de Google; si no, por el correo (y la vincula);
-- si no existe, la crea, siempre que se hayan aceptado los términos.
-- Devuelve {id, nueva}.
create or replace function pkg_auth.ingresar_google(
  p_sub text, p_email text, p_nombre text, p_apellido text, p_avatar text, p_terminos text
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_id    uuid;
  v_email text := lower(trim(p_email));
begin
  select usuario_id into v_id from public.datos_cuenta where google_sub = p_sub;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'nueva', false);
  end if;

  select id into v_id from auth.users where email = v_email;
  if v_id is not null then
    insert into public.datos_cuenta (usuario_id, google_sub) values (v_id, p_sub)
    on conflict (usuario_id) do update set google_sub = excluded.google_sub
    where public.datos_cuenta.google_sub is null;
    update public.perfiles set avatar_url = coalesce(avatar_url, p_avatar) where id = v_id;
    return jsonb_build_object('id', v_id, 'nueva', false);
  end if;

  if nullif(p_terminos, '') is null then
    raise exception 'Para crear tu cuenta aceptá los Términos y Condiciones' using errcode = 'TC400';
  end if;
  insert into auth.users (email, encrypted_password, raw_user_meta_data)
  values (v_email, null, jsonb_build_object('nombre', p_nombre, 'apellido', p_apellido))
  returning id into v_id;
  update public.perfiles set avatar_url = p_avatar where id = v_id;
  insert into public.datos_cuenta (usuario_id, google_sub, terminos_version, terminos_aceptados_en)
  values (v_id, p_sub, p_terminos, now());
  return jsonb_build_object('id', v_id, 'nueva', true);
end $$;

-- DNI desde "Mi cuenta" (servidor). Vacío lo borra.
create or replace function pkg_auth.guardar_dni(p_usuario uuid, p_dni text)
returns void language plpgsql set search_path = '' as $$
declare v_dni text := pkg_auth._dni(p_dni);
begin
  if v_dni is not null and exists (select 1 from public.datos_cuenta
                                   where dni = v_dni and usuario_id <> p_usuario) then
    raise exception 'Ese DNI ya está registrado en otra cuenta' using errcode = 'TC409';
  end if;
  insert into public.datos_cuenta (usuario_id, dni) values (p_usuario, v_dni)
  on conflict (usuario_id) do update set dni = excluded.dni;
end $$;

-- Pide un enlace para restablecer la contraseña (servidor). Anula los anteriores.
-- Devuelve {nombre, email}, o null si no hay cuenta con ese correo o ya pidió
-- demasiados en la última hora (el API responde lo mismo en todos los casos).
create or replace function pkg_auth.crear_recuperacion(p_email text, p_token_hash text, p_minutos integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_id     uuid;
  v_nombre text;
  v_email  text;
begin
  select u.id, p.nombre, u.email into v_id, v_nombre, v_email
  from auth.users u
  join public.perfiles p on p.id = u.id
  where u.email = lower(trim(p_email));
  if v_id is null then
    return null;
  end if;
  if (select count(*) from public.recuperaciones_clave
      where usuario_id = v_id and creado_en > now() - interval '1 hour') >= 5 then
    return null;
  end if;

  update public.recuperaciones_clave set usada_en = now()
  where usuario_id = v_id and usada_en is null;
  insert into public.recuperaciones_clave (usuario_id, token_hash, vence_en)
  values (v_id, p_token_hash, now() + make_interval(mins => p_minutos));
  return jsonb_build_object('nombre', v_nombre, 'email', v_email);
end $$;

create or replace function pkg_auth.recuperacion_valida(p_token_hash text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.recuperaciones_clave
                 where token_hash = p_token_hash and usada_en is null and vence_en > now())
$$;

-- Cambia la contraseña con el enlace (servidor) y cierra las sesiones abiertas.
create or replace function pkg_auth.restablecer_clave(p_token_hash text, p_hash text)
returns uuid language plpgsql set search_path = '' as $$
declare v_rec public.recuperaciones_clave;
begin
  select * into v_rec from public.recuperaciones_clave where token_hash = p_token_hash for update;
  if v_rec.id is null or v_rec.usada_en is not null or v_rec.vence_en <= now() then
    raise exception 'El enlace para cambiar la contraseña venció o ya se usó. Pedí uno nuevo.'
      using errcode = 'TC400';
  end if;

  update auth.users set encrypted_password = p_hash where id = v_rec.usuario_id;
  update public.recuperaciones_clave set usada_en = now()
  where usuario_id = v_rec.usuario_id and usada_en is null;
  insert into public.datos_cuenta (usuario_id, sesiones_desde) values (v_rec.usuario_id, now())
  on conflict (usuario_id) do update set sesiones_desde = excluded.sesiones_desde;
  return v_rec.usuario_id;
end $$;

-- Cambiar la contraseña también cierra las demás sesiones (el API renueva la actual).
create or replace function pkg_auth.cambiar_clave(p_usuario uuid, p_hash text)
returns void language plpgsql set search_path = '' as $$
begin
  update auth.users set encrypted_password = p_hash where id = p_usuario;
  if not found then
    raise exception 'Usuario no encontrado' using errcode = 'TC404';
  end if;
  insert into public.datos_cuenta (usuario_id, sesiones_desde) values (p_usuario, now())
  on conflict (usuario_id) do update set sesiones_desde = excluded.sesiones_desde;
end $$;

-- Lo que el API revisa en cada pedido con sesión: bloqueo y desde cuándo valen las sesiones.
create or replace function pkg_auth.control_sesion(p_usuario uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'bloqueo', pkg_auth.bloqueo(p_usuario),
    'sesiones_desde', (select d.sesiones_desde from public.datos_cuenta d where d.usuario_id = p_usuario)
  )
$$;

-- Datos de la sesión: suma DNI, si tiene contraseña y si entra con Google.
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
    'dni', d.dni,
    'tieneClave', u.encrypted_password is not null,
    'conGoogle', d.google_sub is not null,
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
  left join public.datos_cuenta d on d.usuario_id = p.id
  where p.id = p_usuario
$$;

-- ----------------------------------------------------------------------------
-- pkg_tiendas: teléfonos y coordenadas
-- ----------------------------------------------------------------------------

-- Valida y limpia la lista de teléfonos. Las filas sin número se descartan.
create or replace function pkg_tiendas._telefonos(p_telefonos jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_lista  jsonb := '[]'::jsonb;
  v_tel    jsonb;
  v_pais   text;
  v_numero text;
  v_tipo   text;
begin
  if p_telefonos is null or jsonb_typeof(p_telefonos) = 'null' then
    return v_lista;
  end if;
  if jsonb_typeof(p_telefonos) <> 'array' then
    raise exception 'Los teléfonos tienen que ser una lista' using errcode = 'TC400';
  end if;

  for v_tel in select x from jsonb_array_elements(p_telefonos) x loop
    v_numero := trim(regexp_replace(coalesce(v_tel ->> 'numero', ''), '\s+', ' ', 'g'));
    continue when v_numero = '';
    v_pais := coalesce(nullif(trim(v_tel ->> 'pais'), ''), '+54');
    v_tipo := coalesce(nullif(v_tel ->> 'tipo', ''), 'celular');
    if v_pais !~ '^\+[0-9]{1,4}$' then
      raise exception 'La característica de país % no es válida', v_pais using errcode = 'TC400';
    end if;
    if v_numero !~ '^[0-9 ()-]{6,20}$' or length(regexp_replace(v_numero, '\D', '', 'g')) < 6 then
      raise exception 'El teléfono % no es válido', v_numero using errcode = 'TC400';
    end if;
    if v_tipo not in ('whatsapp', 'celular', 'fijo') then
      raise exception 'El tipo de teléfono tiene que ser WhatsApp, celular o fijo' using errcode = 'TC400';
    end if;
    v_lista := v_lista || jsonb_build_array(jsonb_build_object('pais', v_pais, 'numero', v_numero, 'tipo', v_tipo));
  end loop;

  if jsonb_array_length(v_lista) > 5 then
    raise exception 'Podés cargar hasta 5 teléfonos' using errcode = 'TC400';
  end if;
  return v_lista;
end $$;

-- Teléfonos y ubicación en el mapa. Solo cambia las claves presentes en
-- p_cambios: telefonos (lista) y ubicacion ({lat, lng} o null para quitarla).
create or replace function pkg_tiendas.guardar_contacto(p_tienda uuid, p_cambios jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_telefonos jsonb;
  v_lat numeric;
  v_lng numeric;
begin
  if not public.tiene_permiso(p_tienda, 'configuracion.editar') then
    raise exception 'No tenés permiso para modificar los datos de esta tienda' using errcode = 'TC403';
  end if;

  if p_cambios ? 'telefonos' then
    v_telefonos := pkg_tiendas._telefonos(p_cambios -> 'telefonos');
    update public.tiendas set
      telefonos = v_telefonos,
      telefono = case when jsonb_array_length(v_telefonos) > 0
                      then (v_telefonos -> 0 ->> 'pais') || ' ' || (v_telefonos -> 0 ->> 'numero') end
    where id = p_tienda;
  end if;

  if p_cambios ? 'ubicacion' then
    if jsonb_typeof(p_cambios -> 'ubicacion') = 'object' then
      v_lat := (p_cambios -> 'ubicacion' ->> 'lat')::numeric;
      v_lng := (p_cambios -> 'ubicacion' ->> 'lng')::numeric;
      if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
        raise exception 'La ubicación en el mapa no es válida' using errcode = 'TC400';
      end if;
    end if;
    update public.tiendas set lat = round(v_lat, 6), lng = round(v_lng, 6) where id = p_tienda;
  end if;
end $$;

-- Panel de la tienda: suma teléfonos y ubicación.
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
    'telefonos', t.telefonos,
    'email', t.email,
    'direccion', t.direccion,
    'ubicacion', case when t.lat is not null and t.lng is not null
                      then jsonb_build_object('lat', t.lat, 'lng', t.lng) end,
    'estado', t.estado,
    'motivo_estado', t.motivo_estado,
    'creado_en', t.creado_en,
    'portada', t.portada_url,
    'logo', t.logo_url,
    'localidad', jsonb_build_object('id', l.id, 'nombre', l.nombre, 'provincia', pr.nombre),
    'rubro', case when r.id is not null then jsonb_build_object('id', r.id, 'nombre', r.nombre, 'slug', r.slug) end,
    'subrubro', case when s.id is not null then jsonb_build_object('id', s.id, 'nombre', s.nombre) end,
    'especialidades', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre) order by e.orden, e.nombre)
      from public.tienda_especialidades te
      join public.rubros e on e.id = te.rubro_id
      where te.tienda_id = t.id
    ), '[]'::jsonb),
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
        'estado', s2.estado,
        'fin_periodo', s2.fin_periodo
      )
      from public.suscripciones s2
      join public.planes pl on pl.id = s2.plan_id
      where s2.tienda_id = t.id and s2.estado in ('activa', 'en_gracia', 'pendiente')
      limit 1
    ),
    'mercadoPago', pkg_tiendas._estado_mp(t.id)
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  left join public.rubros r on r.id = t.rubro_id
  left join public.rubros s on s.id = t.subrubro_id
  where t.id = p_tienda
$$;

-- ----------------------------------------------------------------------------
-- pkg_catalogo: la página pública muestra todos los teléfonos y el mapa
-- ----------------------------------------------------------------------------
create or replace function pkg_catalogo.tienda(p_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'nombre', t.nombre,
    'slug', t.slug,
    'descripcion', t.descripcion,
    'telefono', t.telefono,
    'telefonos', t.telefonos,
    'direccion', t.direccion,
    'ubicacion', case when t.lat is not null and t.lng is not null
                      then jsonb_build_object('lat', t.lat, 'lng', t.lng) end,
    'localidad', l.nombre || ', ' || pr.nombre,
    'localidad_id', l.id,
    'desde', t.creado_en,
    'portada', t.portada_url,
    'logo', t.logo_url,
    'rubro', pkg_catalogo.rubro(t.id),
    'seguidores', pkg_catalogo._seguidores(t.id),
    'productos', pkg_catalogo.tarjetas(array(
      select p.id from public.productos p
      where p.tienda_id = t.id and p.estado = 'publicado'
      order by p.publicado_en desc))
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  where t.slug = p_slug and t.estado = 'activa'
$$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  pkg_auth._dni(text),
  pkg_auth.registrar_cliente(jsonb, text),
  pkg_auth.ingresar_google(text, text, text, text, text, text),
  pkg_auth.guardar_dni(uuid, text),
  pkg_auth.crear_recuperacion(text, text, integer),
  pkg_auth.recuperacion_valida(text),
  pkg_auth.restablecer_clave(text, text),
  pkg_auth.control_sesion(uuid),
  pkg_tiendas._telefonos(jsonb),
  pkg_tiendas.guardar_contacto(uuid, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  pkg_tiendas._telefonos(jsonb),
  pkg_tiendas.guardar_contacto(uuid, jsonb)
to authenticated;
