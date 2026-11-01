-- ============================================================================
-- Registro de actividad (auditoría), etapa 2: filtros por período, tipo de
-- acción, origen (personas o sistema) y búsqueda libre; resumen del filtro y
-- exportación. Solo superadmin (la ruta lo exige; las funciones corren como
-- servidor porque el autor sale de auth.users).
-- El período llega como instantes: el navegador calcula el inicio y el fin de
-- cada día en la hora de quien mira. p_hasta no se incluye.
-- ============================================================================

create index if not exists auditoria_creado_en_idx on public.auditoria (creado_en desc);
create index if not exists auditoria_actor_idx on public.auditoria (actor_id, id desc);

drop function if exists pkg_admin.actividad(text, bigint, integer);

-- ----------------------------------------------------------------------------
-- Movimientos que cumplen los filtros (sin orden ni límite)
-- ----------------------------------------------------------------------------
create or replace function pkg_admin.auditoria_filtrada(
  p_entidad text, p_accion text, p_desde timestamptz, p_hasta timestamptz, p_buscar text, p_origen text
) returns setof public.auditoria language sql stable set search_path = '' as $$
  select a.*
  from public.auditoria a
  where (p_entidad is null or a.entidad = p_entidad)
    and (p_accion is null or a.accion = p_accion)
    and (p_desde is null or a.creado_en >= p_desde)
    and (p_hasta is null or a.creado_en < p_hasta)
    and (p_origen is null or (p_origen = 'personas') = (a.actor_id is not null))
    and (nullif(trim(p_buscar), '') is null or exists (
          select 1
          from (select coalesce(a.despues, a.antes) as fila) f
          left join public.perfiles p on p.id = a.actor_id
          left join auth.users u on u.id = a.actor_id
          left join public.tiendas t on t.id = a.tienda_id
          where public.f_unaccent(lower(concat_ws(' ',
                  p.nombre, p.apellido, u.email, t.nombre, a.entidad_id,
                  f.fila ->> 'nombre', f.fila ->> 'clave', f.fila ->> 'rol', f.fila ->> 'sku')))
                like '%' || public.f_unaccent(lower(trim(p_buscar))) || '%'))
$$;

-- ----------------------------------------------------------------------------
-- Un movimiento listo para mostrar: autor, tienda, referencia y campos cambiados
-- ----------------------------------------------------------------------------
create or replace function pkg_admin.movimiento(a public.auditoria)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id,
    'creado_en', a.creado_en,
    'accion', a.accion,
    'entidad', a.entidad,
    'entidad_id', a.entidad_id,
    'referencia', coalesce(f.fila ->> 'nombre', f.fila ->> 'clave', f.fila ->> 'rol', f.fila ->> 'sku'),
    'actor', case when a.actor_id is not null then jsonb_build_object(
               'nombre', nullif(concat_ws(' ', p.nombre, p.apellido), ''),
               'email', u.email) end,
    'tienda', case when t.id is not null then jsonb_build_object('id', t.id, 'nombre', t.nombre) end,
    'cambios', case when a.accion = 'UPDATE' then coalesce((
                 select jsonb_agg(jsonb_build_object('campo', k, 'antes', a.antes -> k, 'despues', a.despues -> k)
                                  order by k)
                 from jsonb_object_keys(a.despues) k
                 where k not in ('actualizado_en', 'creado_en')
                   and (a.antes -> k) is distinct from (a.despues -> k)
               ), '[]'::jsonb) end)
  from (select coalesce(a.despues, a.antes) as fila) f
  left join public.perfiles p on p.id = a.actor_id
  left join auth.users u on u.id = a.actor_id
  left join public.tiendas t on t.id = a.tienda_id
$$;

create or replace function pkg_admin.validar_filtro_actividad(
  p_accion text, p_desde timestamptz, p_hasta timestamptz, p_origen text
) returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_accion is not null and p_accion not in ('INSERT', 'UPDATE', 'DELETE') then
    raise exception 'Tipo de acción inválido' using errcode = 'TC400';
  end if;
  if p_origen is not null and p_origen not in ('personas', 'sistema') then
    raise exception 'Origen inválido' using errcode = 'TC400';
  end if;
  if p_desde is not null and p_hasta is not null and p_desde >= p_hasta then
    raise exception 'La fecha "desde" tiene que ser anterior a la fecha "hasta"' using errcode = 'TC400';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Registro de actividad paginado por id (p_antes: último id de la página
-- anterior). La primera página trae además el resumen del filtro.
-- Los tres primeros parámetros conservan el orden de la versión anterior.
-- ----------------------------------------------------------------------------
create or replace function pkg_admin.actividad(
  p_entidad text default null,
  p_antes   bigint default null,
  p_limite  integer default 30,
  p_accion  text default null,
  p_desde   timestamptz default null,
  p_hasta   timestamptz default null,
  p_buscar  text default null,
  p_origen  text default null
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_limite  integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_items   jsonb;
  v_resumen jsonb;
begin
  perform pkg_admin.validar_filtro_actividad(p_accion, p_desde, p_hasta, p_origen);

  select coalesce(jsonb_agg(pkg_admin.movimiento(x.fila) order by (x.fila).id desc), '[]'::jsonb) into v_items
  from (
    select a as fila
    from pkg_admin.auditoria_filtrada(p_entidad, p_accion, p_desde, p_hasta, p_buscar, p_origen) a
    where p_antes is null or a.id < p_antes
    order by a.id desc
    limit v_limite + 1
  ) x;

  if p_antes is null then
    select jsonb_build_object(
             'total',    count(*)::integer,
             'altas',    (count(*) filter (where a.accion = 'INSERT'))::integer,
             'cambios',  (count(*) filter (where a.accion = 'UPDATE'))::integer,
             'bajas',    (count(*) filter (where a.accion = 'DELETE'))::integer,
             'personas', count(distinct a.actor_id)::integer,
             'sistema',  (count(*) filter (where a.actor_id is null))::integer,
             'desde',    min(a.creado_en),
             'hasta',    max(a.creado_en))
      into v_resumen
    from pkg_admin.auditoria_filtrada(p_entidad, p_accion, p_desde, p_hasta, p_buscar, p_origen) a;
  end if;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > v_limite then v_items - v_limite else v_items end,
    'siguiente', case when jsonb_array_length(v_items) > v_limite
                      then (v_items -> (v_limite - 1) ->> 'id')::bigint end,
    'resumen', v_resumen
  );
end $$;

-- ----------------------------------------------------------------------------
-- Exportación: hasta 5.000 movimientos del filtro, del más nuevo al más viejo
-- ----------------------------------------------------------------------------
create or replace function pkg_admin.exportar_actividad(
  p_entidad text default null,
  p_accion  text default null,
  p_desde   timestamptz default null,
  p_hasta   timestamptz default null,
  p_buscar  text default null,
  p_origen  text default null
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_maximo constant integer := 5000;
  v_items  jsonb;
begin
  perform pkg_admin.validar_filtro_actividad(p_accion, p_desde, p_hasta, p_origen);

  select coalesce(jsonb_agg(pkg_admin.movimiento(x.fila) order by (x.fila).id desc), '[]'::jsonb) into v_items
  from (
    select a as fila
    from pkg_admin.auditoria_filtrada(p_entidad, p_accion, p_desde, p_hasta, p_buscar, p_origen) a
    order by a.id desc
    limit v_maximo + 1
  ) x;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > v_maximo then v_items - v_maximo else v_items end,
    'recortado', jsonb_array_length(v_items) > v_maximo
  );
end $$;

-- ----------------------------------------------------------------------------
-- Permisos: solo el servidor (dueño de las funciones)
-- ----------------------------------------------------------------------------
revoke execute on function
  pkg_admin.auditoria_filtrada(text, text, timestamptz, timestamptz, text, text),
  pkg_admin.movimiento(public.auditoria),
  pkg_admin.validar_filtro_actividad(text, timestamptz, timestamptz, text),
  pkg_admin.actividad(text, bigint, integer, text, timestamptz, timestamptz, text, text),
  pkg_admin.exportar_actividad(text, text, timestamptz, timestamptz, text, text)
from public, anon, authenticated, service_role;
