-- Registro: guardar referencias del domicilio (barrio / indicaciones para el cadete).
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
    insert into public.direcciones
      (usuario_id, alias, calle, numero, piso_depto, localidad_id, referencias, es_principal)
    values (
      v_id,
      'Casa',
      trim(v_domicilio ->> 'calle'),
      trim(v_domicilio ->> 'numero'),
      nullif(trim(v_domicilio ->> 'piso_depto'), ''),
      (v_domicilio ->> 'localidad_id')::uuid,
      nullif(trim(v_domicilio ->> 'referencias'), ''),
      true
    );
  end if;
  return v_id;
end $$;
