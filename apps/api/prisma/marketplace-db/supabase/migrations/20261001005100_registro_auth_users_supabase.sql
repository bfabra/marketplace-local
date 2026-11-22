-- Registro compatible con auth.users de Supabase alojado (GoTrue).
-- El insert mínimo (email, encrypted_password, raw_user_meta_data) alcanza en el
-- simulado local, pero en el proyecto cloud falla por columnas NOT NULL
-- (instance_id, aud, role, tokens, etc.) → el API responde
-- "Algún dato no cumple las reglas de la plataforma".

create or replace function pkg_auth._nueva_cuenta(
  p_email text,
  p_hash text,
  p_meta jsonb
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_instance uuid;
begin
  begin
    select id into v_instance from auth.instances limit 1;
  exception
    when undefined_table then
      v_instance := null;
  end;
  if v_instance is null then
    v_instance := '00000000-0000-0000-0000-000000000000';
  end if;

  begin
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      v_instance,
      v_id,
      'authenticated',
      'authenticated',
      p_email,
      p_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      coalesce(p_meta, '{}'::jsonb),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  exception
    when undefined_column then
      -- Simulado local / esquema reducido.
      insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
      values (v_id, p_email, p_hash, coalesce(p_meta, '{}'::jsonb));
  end;

  begin
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_id,
      v_id,
      jsonb_build_object('sub', v_id::text, 'email', p_email),
      'email',
      v_id::text,
      now(),
      now(),
      now()
    );
  exception
    when undefined_table then
      null;
    when unique_violation then
      null;
  end;

  return v_id;
end $$;

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

  v_id := pkg_auth._nueva_cuenta(
    v_email,
    p_hash,
    jsonb_build_object('nombre', p_datos ->> 'nombre', 'apellido', p_datos ->> 'apellido')
  );

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

  v_id := pkg_auth._nueva_cuenta(
    v_email,
    null,
    jsonb_build_object('nombre', p_nombre, 'apellido', p_apellido)
  );
  update public.perfiles set avatar_url = p_avatar where id = v_id;
  insert into public.datos_cuenta (usuario_id, google_sub, terminos_version, terminos_aceptados_en)
  values (v_id, p_sub, p_terminos, now());
  return jsonb_build_object('id', v_id, 'nueva', true);
end $$;
