-- ============================================================================
-- Panel de administración, etapa 1 (pkg_admin): tablero, configuración general
-- y registro de actividad. Convenciones en ..._1800.
--
-- Qué ve cada rol de plataforma (el superadmin ve todo):
--   moderación → tiendas, productos y denuncias
--   soporte    → usuarios, pedidos, reclamos y solicitudes de consumidores
--   finanzas   → pedidos, ventas, reembolsos y suscripciones
--   logística  → pedidos y envíos
-- La configuración general y el registro de actividad son solo del superadmin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Configuración: datos para editar cada parámetro desde el panel
-- ----------------------------------------------------------------------------
alter table public.configuracion
  add column etiqueta text,
  add column grupo    text,
  add column minimo   integer,
  add column maximo   integer,
  add constraint configuracion_rango check (minimo is null or maximo is null or minimo <= maximo);

update public.configuracion c set
  etiqueta = x.etiqueta, grupo = x.grupo, minimo = x.minimo, maximo = x.maximo
from (values
  ('retiro_en_local_habilitado',  'Retiro en el local',                         'Compras',       null::integer, null::integer),
  ('minutos_reserva_stock',       'Reserva de stock mientras se paga (minutos)', 'Compras',       5,    120),
  ('horas_vencimiento_pedido',    'Cierre de pedidos sin pago (horas)',          'Compras',       1,    168),
  ('dias_gracia',                 'Días de gracia por cobro fallido',            'Suscripciones', 0,    30),
  ('dias_conservacion_datos',     'Conservación de datos de tiendas vencidas (días)', 'Suscripciones', 30, 3650),
  ('dias_vencimiento_invitacion', 'Validez de las invitaciones a empleados (días)',   'Tiendas',       1,  30)
) as x(clave, etiqueta, grupo, minimo, maximo)
where c.clave = x.clave;

-- ----------------------------------------------------------------------------
-- Índices para el tablero y el registro de actividad
-- ----------------------------------------------------------------------------
create index if not exists pedidos_creado_en_idx   on public.pedidos (creado_en desc);
create index if not exists perfiles_creado_en_idx  on public.perfiles (creado_en desc);
create index if not exists auditoria_entidad_id_idx on public.auditoria (entidad, id desc);

-- ----------------------------------------------------------------------------
-- Tablero (servidor): cifras según los roles de quien lo pide
-- ----------------------------------------------------------------------------
create or replace function pkg_admin.tablero(p_usuario uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v         jsonb := jsonb_build_object('generadoEn', now());
  v_hoy     timestamptz := date_trunc('day', now());
  v_mes     timestamptz := date_trunc('month', now());
  moderacion boolean := pkg_admin.tiene_rol(p_usuario, array['moderacion']);
  soporte    boolean := pkg_admin.tiene_rol(p_usuario, array['soporte']);
  finanzas   boolean := pkg_admin.tiene_rol(p_usuario, array['finanzas']);
  logistica  boolean := pkg_admin.tiene_rol(p_usuario, array['logistica']);
begin
  if not (moderacion or soporte or finanzas or logistica) then
    raise exception 'Esta sección es solo para el equipo de administración' using errcode = 'TC403';
  end if;

  if moderacion then
    v := v || jsonb_build_object(
      'tiendas', (select jsonb_build_object(
                    'pendiente',  count(*) filter (where estado = 'pendiente'),
                    'activa',     count(*) filter (where estado = 'activa'),
                    'suspendida', count(*) filter (where estado = 'suspendida'),
                    'vencida',    count(*) filter (where estado = 'vencida'),
                    'archivada',  count(*) filter (where estado = 'archivada'))
                  from public.tiendas),
      'productos', (select jsonb_build_object(
                      'publicados', count(*) filter (where estado = 'publicado'),
                      'pausadosModeracion', count(*) filter (where estado = 'pausado' and motivo_pausa = 'moderacion'))
                    from public.productos),
      'denunciasAbiertas', (select count(*) from public.denuncias where estado = 'abierta'));
  end if;

  if soporte then
    v := v || jsonb_build_object(
      'usuarios', (select jsonb_build_object(
                     'total', count(*),
                     'nuevos7dias', count(*) filter (where creado_en >= now() - interval '7 days'))
                   from public.perfiles),
      'reclamosAbiertos', (select count(*) from public.reclamos where estado in ('abierto', 'en_revision')),
      'solicitudesPendientes', (select count(*) from public.solicitudes_consumidor where estado <> 'resuelta'));
  end if;

  if soporte or finanzas or logistica then
    v := v || jsonb_build_object(
      'pedidos', jsonb_build_object(
        'hoy', (select count(*) from public.pedidos where creado_en >= v_hoy),
        'pendientesPago', (select count(*) from public.pedidos where estado_pago = 'pendiente'),
        'enCurso', (select count(*) from public.pedidos_tienda
                    where estado in ('pago_confirmado', 'en_preparacion', 'listo_para_recoleccion',
                                     'listo_para_retiro', 'recolectado', 'en_camino'))));
  end if;

  if finanzas then
    v := v || jsonb_build_object(
      'ventasMes', (select jsonb_build_object('monto', coalesce(sum(total), 0), 'pedidos', count(*))
                    from public.pedidos
                    where creado_en >= v_mes and estado_pago in ('aprobado', 'reembolsado_parcial')),
      'reembolsosPendientes', (select count(*) from public.reembolsos where estado = 'pendiente'),
      'suscripciones', (select jsonb_build_object(
                          'activa',    count(*) filter (where estado = 'activa'),
                          'en_gracia', count(*) filter (where estado = 'en_gracia'),
                          'pendiente', count(*) filter (where estado = 'pendiente'))
                        from public.suscripciones
                        where estado in ('activa', 'en_gracia', 'pendiente')));
  end if;

  if logistica then
    v := v || jsonb_build_object(
      'envios', (select jsonb_build_object(
                   'pendiente',      count(*) filter (where estado = 'pendiente'),
                   'en_recoleccion', count(*) filter (where estado = 'en_recoleccion'),
                   'en_camino',      count(*) filter (where estado = 'en_camino'),
                   'fallido',        count(*) filter (where estado = 'fallido'))
                 from public.envios
                 where estado <> 'entregado'));
  end if;

  return v;
end $$;

-- ----------------------------------------------------------------------------
-- Configuración general
-- ----------------------------------------------------------------------------

-- Parámetros con su último cambio (servidor: el autor sale de auth.users).
create or replace function pkg_admin.configuracion()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'clave', c.clave,
           'etiqueta', coalesce(c.etiqueta, c.clave),
           'descripcion', c.descripcion,
           'grupo', coalesce(c.grupo, 'General'),
           'tipo', case jsonb_typeof(c.valor) when 'boolean' then 'booleano'
                                              when 'number'  then 'entero'
                                              else 'texto' end,
           'valor', c.valor,
           'minimo', c.minimo,
           'maximo', c.maximo,
           'actualizado_en', c.actualizado_en,
           'actualizadoPor', ultimo.autor
         ) order by coalesce(c.grupo, 'General'), coalesce(c.etiqueta, c.clave)), '[]'::jsonb)
  from public.configuracion c
  left join lateral (
    select coalesce(nullif(concat_ws(' ', p.nombre, p.apellido), ''), u.email) as autor
    from public.auditoria a
    left join public.perfiles p on p.id = a.actor_id
    left join auth.users u on u.id = a.actor_id
    where a.entidad = 'configuracion' and a.entidad_id = c.clave and a.actor_id is not null
    order by a.id desc
    limit 1
  ) ultimo on true
$$;

-- Corre como el superadmin: RLS solo le deja a él escribir y la auditoría
-- registra quién hizo el cambio. El valor conserva el tipo que ya tenía.
create or replace function pkg_admin.guardar_configuracion(p_clave text, p_valor jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_actual public.configuracion;
  v_numero integer;
begin
  if not public.es_admin('superadmin') then
    raise exception 'Solo el superadmin cambia la configuración general' using errcode = 'TC403';
  end if;

  select * into v_actual from public.configuracion where clave = p_clave for update;
  if not found then
    raise exception 'No existe ese parámetro' using errcode = 'TC404';
  end if;

  if jsonb_typeof(p_valor) is distinct from jsonb_typeof(v_actual.valor) then
    raise exception '%', case jsonb_typeof(v_actual.valor)
                           when 'boolean' then 'Elegí sí o no'
                           when 'number'  then 'Ingresá un número'
                           else 'Valor inválido' end
      using errcode = 'TC400';
  end if;

  if jsonb_typeof(p_valor) = 'number' then
    if p_valor::text !~ '^-?\d+$' then
      raise exception 'Ingresá un número entero' using errcode = 'TC400';
    end if;
    v_numero := p_valor::text::integer;
    if (v_actual.minimo is not null and v_numero < v_actual.minimo)
       or (v_actual.maximo is not null and v_numero > v_actual.maximo) then
      raise exception 'Tiene que estar entre % y %',
        coalesce(v_actual.minimo::text, 'sin mínimo'), coalesce(v_actual.maximo::text, 'sin máximo')
        using errcode = 'TC400';
    end if;
  end if;

  if p_valor = v_actual.valor then
    return;
  end if;
  update public.configuracion set valor = p_valor where clave = p_clave;
end $$;

-- ----------------------------------------------------------------------------
-- Registro de actividad (servidor: el autor sale de auth.users)
-- Paginado por id: p_antes es el último id de la página anterior.
-- ----------------------------------------------------------------------------
create or replace function pkg_admin.actividad(
  p_entidad text default null, p_antes bigint default null, p_limite integer default 30
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_items  jsonb;
begin
  select coalesce(jsonb_agg(x.item order by x.id desc), '[]'::jsonb) into v_items
  from (
    select a.id, jsonb_build_object(
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
                        ), '[]'::jsonb) end
           ) as item
    from public.auditoria a
    cross join lateral (select coalesce(a.despues, a.antes) as fila) f
    left join public.perfiles p on p.id = a.actor_id
    left join auth.users u on u.id = a.actor_id
    left join public.tiendas t on t.id = a.tienda_id
    where (p_entidad is null or a.entidad = p_entidad)
      and (p_antes is null or a.id < p_antes)
    order by a.id desc
    limit v_limite + 1
  ) x;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > v_limite then v_items - v_limite else v_items end,
    'siguiente', case when jsonb_array_length(v_items) > v_limite
                      then (v_items -> (v_limite - 1) ->> 'id')::bigint end
  );
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  pkg_admin.tablero(uuid),
  pkg_admin.configuracion(),
  pkg_admin.guardar_configuracion(text, jsonb),
  pkg_admin.actividad(text, bigint, integer)
from public, anon, authenticated, service_role;
grant execute on function pkg_admin.guardar_configuracion(text, jsonb) to authenticated;
