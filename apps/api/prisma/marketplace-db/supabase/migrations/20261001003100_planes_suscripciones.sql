-- ============================================================================
-- Panel de administración, etapa 6: planes y suscripciones. Convenciones en ..._1800.
--
-- Finanzas (y el superadmin):
--   * edita los planes: nombre, precio, límites y si se ofrece a tiendas nuevas.
--     Bajar un límite se aplica en el acto a las tiendas con ese plan: se pausan
--     los productos y se suspenden los empleados que sobran (nada se borra).
--     Un precio nuevo se cobra desde la próxima renovación.
--   * sigue cada suscripción: extiende el período (cortesía o compensación),
--     registra un pago recibido o la cancela con motivo (la tienda vence si no
--     le queda otro plan vigente).
-- El plan gratis no tiene precio, no se desactiva y no vence.
-- ============================================================================

alter table public.suscripciones
  add column motivo_cancelacion text check (char_length(motivo_cancelacion) <= 500),
  add column nota_admin         text check (char_length(nota_admin) <= 500);

create index if not exists suscripciones_plan_estado_idx on public.suscripciones (plan_id, estado);
create index if not exists suscripciones_estado_fin_idx on public.suscripciones (estado, fin_periodo);

create policy "pagos_suscripcion: finanzas registra" on public.pagos_suscripcion
  for insert to authenticated with check (public.es_admin('finanzas'));
create policy "pagos_suscripcion: finanzas corrige" on public.pagos_suscripcion
  for update to authenticated using (public.es_admin('finanzas')) with check (public.es_admin('finanzas'));

create trigger auditar after insert or update or delete on public.pagos_suscripcion
  for each row execute function public.tg_auditar();

-- ----------------------------------------------------------------------------
-- Planes
-- ----------------------------------------------------------------------------

-- Planes con cuántas tiendas los usan y lo que facturan por mes (servidor).
create or replace function pkg_admin.planes()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pl.id,
           'nombre', pl.nombre,
           'precio_mensual', pl.precio_mensual,
           'max_productos', pl.max_productos,
           'max_empleados', pl.max_empleados,
           'es_gratis', pl.es_gratis,
           'activo', pl.activo,
           'orden', pl.orden,
           'tiendas', coalesce(s.vigentes, 0),
           'enGracia', coalesce(s.en_gracia, 0),
           'ingresoMensual', coalesce(s.al_dia, 0) * pl.precio_mensual
         ) order by pl.orden, pl.precio_mensual), '[]'::jsonb)
  from public.planes pl
  left join (
    select plan_id,
           count(*) as vigentes,
           count(*) filter (where estado = 'en_gracia') as en_gracia,
           count(*) filter (where estado = 'activa') as al_dia
    from public.suscripciones
    where estado in ('activa', 'en_gracia', 'pendiente')
    group by plan_id
  ) s on s.plan_id = pl.id
$$;

-- security definer: aplicar_limites_plan es del servidor. Devuelve cuántas
-- tiendas, productos y empleados quedaron afectados.
create or replace function pkg_admin._aplicar_limites_de(p_plan uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tienda    uuid;
  v_tiendas   integer := 0;
  v_productos integer := 0;
  v_empleados integer := 0;
  v_p integer;
  v_e integer;
begin
  perform pkg_admin._exigir_finanzas();
  for v_tienda in
    select tienda_id from public.suscripciones
    where plan_id = p_plan and estado in ('activa', 'en_gracia')
  loop
    select count(*) into v_p from public.productos
    where tienda_id = v_tienda and estado = 'pausado' and motivo_pausa = 'limite_plan';
    select count(*) into v_e from public.miembros_tienda where tienda_id = v_tienda and estado = 'suspendido';

    perform public.aplicar_limites_plan(v_tienda);

    v_p := (select count(*) from public.productos
            where tienda_id = v_tienda and estado = 'pausado' and motivo_pausa = 'limite_plan') - v_p;
    v_e := (select count(*) from public.miembros_tienda where tienda_id = v_tienda and estado = 'suspendido') - v_e;
    if v_p > 0 or v_e > 0 then
      v_tiendas := v_tiendas + 1;
      v_productos := v_productos + v_p;
      v_empleados := v_empleados + v_e;
    end if;
  end loop;
  return jsonb_build_object('tiendas', v_tiendas, 'productos', v_productos, 'empleados', v_empleados);
end $$;

-- Crea (p_plan null) o edita un plan.
create or replace function pkg_admin.guardar_plan(
  p_plan uuid, p_nombre text, p_precio numeric,
  p_max_productos integer, p_max_empleados integer, p_activo boolean default true
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre text := nullif(trim(p_nombre), '');
  v_activo boolean := coalesce(p_activo, true);
  v_antes  public.planes;
  v_plan   public.planes;
  v_efectos jsonb;
begin
  perform pkg_admin._exigir_finanzas();
  if char_length(coalesce(v_nombre, '')) not between 2 and 40 then
    raise exception 'El nombre tiene que tener entre 2 y 40 caracteres' using errcode = 'TC400';
  end if;
  if p_precio is null or p_precio < 0 or p_precio > 99999999 or p_precio <> round(p_precio, 2) then
    raise exception 'Ingresá un precio válido' using errcode = 'TC400';
  end if;
  if coalesce(p_max_productos, 0) not between 0 and 100000 or coalesce(p_max_empleados, 0) not between 0 and 1000 then
    raise exception 'Los límites tienen que ser números positivos (vacío = ilimitado)' using errcode = 'TC400';
  end if;
  if exists (select 1 from public.planes
             where lower(nombre) = lower(v_nombre) and id is distinct from p_plan) then
    raise exception 'Ya hay un plan con ese nombre' using errcode = 'TC409';
  end if;

  if p_plan is null then
    if p_precio = 0 then
      raise exception 'Un plan nuevo necesita un precio mayor a cero (ya existe el plan gratis)' using errcode = 'TC400';
    end if;
    insert into public.planes (nombre, precio_mensual, max_productos, max_empleados, activo, orden)
    values (v_nombre, p_precio, p_max_productos, p_max_empleados, v_activo,
            coalesce((select max(orden) + 1 from public.planes), 1))
    returning * into v_plan;
    return to_jsonb(v_plan) || jsonb_build_object('efectos', null);
  end if;

  select * into v_antes from public.planes where id = p_plan for update;
  if not found then
    raise exception 'No encontramos ese plan' using errcode = 'TC404';
  end if;
  if v_antes.es_gratis and p_precio <> 0 then
    raise exception 'El plan gratis no tiene precio' using errcode = 'TC400';
  end if;
  if v_antes.es_gratis and not v_activo then
    raise exception 'El plan gratis no se puede desactivar: es el que eligen las tiendas que recién empiezan'
      using errcode = 'TC409';
  end if;
  -- Los planes de los datos iniciales arrancan sin precio; el que ya cobra no vuelve a cero.
  if not v_antes.es_gratis and p_precio = 0 and v_antes.precio_mensual > 0 then
    raise exception 'Un plan pago necesita un precio mayor a cero' using errcode = 'TC400';
  end if;

  update public.planes set
    nombre = v_nombre, precio_mensual = p_precio,
    max_productos = p_max_productos, max_empleados = p_max_empleados, activo = v_activo
  where id = p_plan
  returning * into v_plan;

  -- Bajó algún límite: se aplica ya a las tiendas con este plan.
  if (p_max_productos is not null and (v_antes.max_productos is null or p_max_productos < v_antes.max_productos))
     or (p_max_empleados is not null and (v_antes.max_empleados is null or p_max_empleados < v_antes.max_empleados)) then
    v_efectos := pkg_admin._aplicar_limites_de(p_plan);
  end if;
  return to_jsonb(v_plan) || jsonb_build_object('efectos', v_efectos);
end $$;

-- Cambia el orden en que se muestran los planes.
create or replace function pkg_admin.ordenar_plan(p_plan uuid, p_direccion text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_plan public.planes;
  v_otro public.planes;
begin
  perform pkg_admin._exigir_finanzas();
  if p_direccion not in ('subir', 'bajar') then
    raise exception 'Dirección inválida' using errcode = 'TC400';
  end if;
  select * into v_plan from public.planes where id = p_plan;
  if not found then
    raise exception 'No encontramos ese plan' using errcode = 'TC404';
  end if;
  if p_direccion = 'subir' then
    select * into v_otro from public.planes
    where (orden, precio_mensual, id) < (v_plan.orden, v_plan.precio_mensual, v_plan.id)
    order by orden desc, precio_mensual desc, id desc limit 1;
  else
    select * into v_otro from public.planes
    where (orden, precio_mensual, id) > (v_plan.orden, v_plan.precio_mensual, v_plan.id)
    order by orden, precio_mensual, id limit 1;
  end if;
  if v_otro.id is null then
    return;
  end if;
  -- Si tenían el mismo orden, se separan antes de intercambiar.
  update public.planes set orden = case when id = v_plan.id then v_otro.orden else v_plan.orden end
  where id in (v_plan.id, v_otro.id);
  if v_plan.orden = v_otro.orden then
    update public.planes set orden = orden + case when p_direccion = 'subir' then -1 else 1 end
    where id = v_plan.id;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Suscripciones: lecturas (servidor: los correos viven en auth.users)
-- ----------------------------------------------------------------------------

-- Vistas:
--   vigentes   → activas, en gracia o esperando el primer pago (lo que vence antes, primero)
--   por_vencer → activas que vencen en los próximos 7 días
--   en_gracia  → impagas, con la tienda todavía abierta
--   vencidas, canceladas (incluye rechazadas), todas
create or replace function pkg_admin.suscripciones(
  p_vista text default 'vigentes', p_plan uuid default null,
  p_buscar text default null, p_pagina integer default 1
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_por_pagina constant integer := 20;
  v_vista  text := coalesce(p_vista, 'vigentes');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_buscar text := nullif(trim(p_buscar), '');
  v_patron text := '%' || public.f_unaccent(lower(nullif(trim(p_buscar), ''))) || '%';
  v_items  jsonb;
  v_total  integer;
begin
  if v_vista not in ('vigentes', 'por_vencer', 'en_gracia', 'vencidas', 'canceladas', 'todas') then
    raise exception 'Vista inválida' using errcode = 'TC400';
  end if;

  with filtrados as (
    select s.id,
           -- Las vigentes, por vencimiento; el historial, lo último primero.
           case when v_vista in ('vencidas', 'canceladas', 'todas')
                then -extract(epoch from s.actualizado_en)
                else extract(epoch from coalesce(s.gracia_hasta, s.fin_periodo, 'infinity'::timestamptz))
           end as clave
    from public.suscripciones s
    join public.tiendas t on t.id = s.tienda_id
    left join auth.users u on u.id = t.propietario_id
    where (p_plan is null or s.plan_id = p_plan)
      and (v_buscar is null
           or public.f_unaccent(lower(t.nombre)) like v_patron
           or lower(u.email) like v_patron)
      and case v_vista
            when 'vigentes'   then s.estado in ('activa', 'en_gracia', 'pendiente')
            when 'por_vencer' then s.estado = 'activa' and s.fin_periodo < now() + interval '7 days'
            when 'en_gracia'  then s.estado = 'en_gracia'
            when 'vencidas'   then s.estado = 'vencida'
            when 'canceladas' then s.estado in ('cancelada', 'rechazada')
            else true
          end
  ), pagina as (
    select id, clave from filtrados order by clave, id
    limit v_por_pagina offset (v_pagina - 1) * v_por_pagina
  )
  select (select count(*) from filtrados),
         coalesce(jsonb_agg(x.item order by x.clave, x.id), '[]'::jsonb)
  into v_total, v_items
  from (
    select f.clave, f.id, jsonb_build_object(
             'id', s.id,
             'estado', s.estado,
             'inicio', s.inicio,
             'fin_periodo', s.fin_periodo,
             'gracia_hasta', s.gracia_hasta,
             'tienda', jsonb_build_object('id', t.id, 'nombre', t.nombre, 'estado', t.estado),
             'duenio', jsonb_build_object('nombre', nullif(concat_ws(' ', p.nombre, p.apellido), ''), 'email', u.email),
             'plan', jsonb_build_object('id', pl.id, 'nombre', pl.nombre, 'precio_mensual', pl.precio_mensual,
                                        'es_gratis', pl.es_gratis),
             'ultimoPago', (select jsonb_build_object('periodo', ps.periodo, 'monto', ps.monto,
                                                      'estado', ps.estado, 'pagado_en', ps.pagado_en)
                            from public.pagos_suscripcion ps
                            where ps.suscripcion_id = s.id
                            order by ps.periodo desc limit 1)
           ) as item
    from pagina f
    join public.suscripciones s on s.id = f.id
    join public.tiendas t on t.id = s.tienda_id
    join public.planes pl on pl.id = s.plan_id
    join public.perfiles p on p.id = t.propietario_id
    left join auth.users u on u.id = t.propietario_id
  ) x;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'pagina', v_pagina,
    'porPagina', v_por_pagina,
    'conteos', (select jsonb_build_object(
                  'vigentes',   count(*) filter (where estado in ('activa', 'en_gracia', 'pendiente')),
                  'por_vencer', count(*) filter (where estado = 'activa' and fin_periodo < now() + interval '7 days'),
                  'en_gracia',  count(*) filter (where estado = 'en_gracia'),
                  'vencidas',   count(*) filter (where estado = 'vencida'),
                  'canceladas', count(*) filter (where estado in ('cancelada', 'rechazada')))
                from public.suscripciones
                where p_plan is null or plan_id = p_plan)
  );
end $$;

-- Ficha de una suscripción: tienda, plan y uso, pagos, otras suscripciones de
-- la tienda y los cambios hechos desde el panel.
create or replace function pkg_admin.suscripcion(p_suscripcion uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id,
    'estado', s.estado,
    'inicio', s.inicio,
    'fin_periodo', s.fin_periodo,
    'gracia_hasta', s.gracia_hasta,
    'motivo_cancelacion', s.motivo_cancelacion,
    'nota_admin', s.nota_admin,
    'debitoAutomatico', s.mp_preapproval_id is not null,
    'creado_en', s.creado_en,
    'diasGracia', coalesce(public.config_int('dias_gracia'), 7),
    'tienda', jsonb_build_object('id', t.id, 'nombre', t.nombre, 'estado', t.estado,
                                 'motivo_estado', t.motivo_estado),
    'duenio', jsonb_build_object('id', p.id, 'nombre', nullif(concat_ws(' ', p.nombre, p.apellido), ''),
                                 'email', u.email),
    'plan', jsonb_build_object('id', pl.id, 'nombre', pl.nombre, 'precio_mensual', pl.precio_mensual,
                               'max_productos', pl.max_productos, 'max_empleados', pl.max_empleados,
                               'es_gratis', pl.es_gratis, 'activo', pl.activo),
    'uso', jsonb_build_object(
      'productos', (select count(*) from public.productos pr where pr.tienda_id = t.id and pr.estado = 'publicado'),
      'pausadosPorLimite', (select count(*) from public.productos pr
                            where pr.tienda_id = t.id and pr.estado = 'pausado' and pr.motivo_pausa = 'limite_plan'),
      'empleados', (select count(*) from public.miembros_tienda m where m.tienda_id = t.id and m.estado = 'activo')),
    'pagos', coalesce((
      select jsonb_agg(x.item order by x.periodo desc)
      from (
        select ps.periodo, jsonb_build_object(
                 'id', ps.id, 'periodo', ps.periodo, 'monto', ps.monto, 'estado', ps.estado,
                 'mp_payment_id', ps.mp_payment_id, 'pagado_en', ps.pagado_en) as item
        from public.pagos_suscripcion ps
        where ps.suscripcion_id = s.id
        order by ps.periodo desc
        limit 12
      ) x
    ), '[]'::jsonb),
    'otras', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'plan', op.nombre, 'estado', o.estado,
               'inicio', o.inicio, 'fin_periodo', o.fin_periodo) order by o.creado_en desc)
      from public.suscripciones o
      join public.planes op on op.id = o.plan_id
      where o.tienda_id = s.tienda_id and o.id <> s.id
    ), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(h.item order by h.id desc)
      from (
        select a.id, jsonb_build_object(
                 'fecha', a.creado_en,
                 'accion', a.accion,
                 'estado', a.despues ->> 'estado',
                 'estadoAnterior', a.antes ->> 'estado',
                 'plan', case when a.antes ->> 'plan_id' is distinct from a.despues ->> 'plan_id'
                              then (select nombre from public.planes where id = (a.despues ->> 'plan_id')::uuid) end,
                 'fin_periodo', a.despues ->> 'fin_periodo',
                 'finAnterior', a.antes ->> 'fin_periodo',
                 'nota', coalesce(case when a.antes ->> 'nota_admin' is distinct from a.despues ->> 'nota_admin'
                                       then a.despues ->> 'nota_admin' end,
                                  case when a.antes ->> 'motivo_cancelacion' is distinct from a.despues ->> 'motivo_cancelacion'
                                       then a.despues ->> 'motivo_cancelacion' end),
                 'actor', nullif(concat_ws(' ', ap.nombre, ap.apellido), '')) as item
        from public.auditoria a
        left join public.perfiles ap on ap.id = a.actor_id
        where a.entidad = 'suscripciones' and a.entidad_id = s.id::text
        order by a.id desc
        limit 20
      ) h
    ), '[]'::jsonb)
  )
  from public.suscripciones s
  join public.tiendas t on t.id = s.tienda_id
  join public.planes pl on pl.id = s.plan_id
  join public.perfiles p on p.id = t.propietario_id
  left join auth.users u on u.id = t.propietario_id
  where s.id = p_suscripcion
$$;

-- ----------------------------------------------------------------------------
-- Suscripciones: acciones (corren como finanzas; los triggers vencen o
-- reactivan la tienda y la auditoría registra quién fue)
-- ----------------------------------------------------------------------------

-- Toma la suscripción para extenderla o registrarle un pago. Una vencida solo
-- se reactiva si la tienda no tiene otra vigente.
create or replace function pkg_admin._suscripcion_renovable(p_suscripcion uuid)
returns public.suscripciones language plpgsql security invoker set search_path = '' as $$
declare
  v_s public.suscripciones;
begin
  select * into v_s from public.suscripciones where id = p_suscripcion for update;
  if not found then
    raise exception 'No encontramos esa suscripción' using errcode = 'TC404';
  end if;
  if (select precio_mensual from public.planes where id = v_s.plan_id) = 0 then
    raise exception 'Este plan no tiene precio, así que no vence ni se paga' using errcode = 'TC409';
  end if;
  if v_s.estado not in ('activa', 'en_gracia', 'vencida') then
    raise exception 'Solo se extiende o se paga una suscripción activa, en gracia o vencida' using errcode = 'TC409';
  end if;
  if v_s.estado = 'vencida' and exists (
       select 1 from public.suscripciones o
       where o.tienda_id = v_s.tienda_id and o.id <> v_s.id and o.estado in ('activa', 'en_gracia', 'pendiente')) then
    raise exception 'La tienda ya tiene otro plan vigente' using errcode = 'TC409';
  end if;
  return v_s;
end $$;

create or replace function pkg_admin.extender_suscripcion(p_suscripcion uuid, p_dias integer, p_motivo text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_motivo text := nullif(trim(p_motivo), '');
  v_s public.suscripciones;
begin
  perform pkg_admin._exigir_finanzas();
  if p_dias is null or p_dias not between 1 and 90 then
    raise exception 'Se extiende entre 1 y 90 días' using errcode = 'TC400';
  end if;
  if char_length(coalesce(v_motivo, '')) not between 5 and 500 then
    raise exception 'Anotá el motivo (entre 5 y 500 caracteres)' using errcode = 'TC400';
  end if;
  v_s := pkg_admin._suscripcion_renovable(p_suscripcion);

  update public.suscripciones set
    estado = 'activa',
    fin_periodo = greatest(coalesce(fin_periodo, now()), now()) + make_interval(days => p_dias),
    gracia_hasta = null,
    nota_admin = v_motivo
  where id = v_s.id
  returning * into v_s;
  return jsonb_build_object('id', v_s.id, 'estado', v_s.estado, 'fin_periodo', v_s.fin_periodo);
end $$;

-- Registra el pago de un mes (simulado) y corre el vencimiento un mes.
create or replace function pkg_admin.registrar_pago_suscripcion(p_suscripcion uuid, p_referencia text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_ref    text := nullif(trim(p_referencia), '');
  v_s      public.suscripciones;
  v_desde  timestamptz;
  v_precio numeric;
begin
  perform pkg_admin._exigir_finanzas();
  if char_length(coalesce(v_ref, '')) > 60 then
    raise exception 'La referencia puede tener hasta 60 caracteres' using errcode = 'TC400';
  end if;
  v_s := pkg_admin._suscripcion_renovable(p_suscripcion);
  v_desde := greatest(coalesce(v_s.fin_periodo, now()), now());
  select precio_mensual into v_precio from public.planes where id = v_s.plan_id;

  if exists (select 1 from public.pagos_suscripcion
             where suscripcion_id = v_s.id and periodo = date_trunc('month', v_desde)::date and estado = 'aprobado') then
    raise exception 'Ese mes ya está pagado' using errcode = 'TC409';
  end if;
  if v_ref is not null and exists (select 1 from public.pagos_suscripcion where mp_payment_id = v_ref) then
    raise exception 'Esa referencia de pago ya está registrada' using errcode = 'TC409';
  end if;

  insert into public.pagos_suscripcion (suscripcion_id, periodo, monto, estado, mp_payment_id, pagado_en)
  values (v_s.id, date_trunc('month', v_desde)::date, v_precio, 'aprobado',
          coalesce(v_ref, pkg_admin._referencia_simulada('SIM-SUS')), now())
  on conflict (suscripcion_id, periodo) do update set
    monto = excluded.monto, estado = 'aprobado',
    mp_payment_id = excluded.mp_payment_id, pagado_en = excluded.pagado_en;

  update public.suscripciones set
    estado = 'activa',
    fin_periodo = v_desde + interval '1 month',
    gracia_hasta = null
  where id = v_s.id
  returning * into v_s;
  return jsonb_build_object('id', v_s.id, 'estado', v_s.estado, 'fin_periodo', v_s.fin_periodo, 'monto', v_precio);
end $$;

create or replace function pkg_admin.cancelar_suscripcion(p_suscripcion uuid, p_motivo text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_motivo text := nullif(trim(p_motivo), '');
  v_s public.suscripciones;
begin
  perform pkg_admin._exigir_finanzas();
  if char_length(coalesce(v_motivo, '')) not between 5 and 500 then
    raise exception 'Anotá el motivo (entre 5 y 500 caracteres)' using errcode = 'TC400';
  end if;
  select * into v_s from public.suscripciones where id = p_suscripcion for update;
  if not found then
    raise exception 'No encontramos esa suscripción' using errcode = 'TC404';
  end if;
  if (select es_gratis from public.planes where id = v_s.plan_id) then
    raise exception 'El plan gratis no se cancela. Si hay que frenar la tienda, la suspende moderación'
      using errcode = 'TC409';
  end if;
  if v_s.estado not in ('activa', 'en_gracia', 'pendiente') then
    raise exception 'Esta suscripción ya no está vigente' using errcode = 'TC409';
  end if;

  update public.suscripciones set estado = 'cancelada', motivo_cancelacion = v_motivo
  where id = v_s.id;
  return jsonb_build_object('id', v_s.id, 'estado', 'cancelada');
end $$;

-- ----------------------------------------------------------------------------
-- Tablero: cuentas bloqueadas (soporte) y suscripciones por vencer (finanzas)
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
                      'enRevision', count(*) filter (where motivo_pausa = 'revision'),
                      'rechazados', count(*) filter (where motivo_pausa = 'rechazado'),
                      'pausadosModeracion', count(*) filter (where estado = 'pausado' and motivo_pausa = 'moderacion'))
                    from public.productos),
      'denunciasAbiertas', (select count(*) from public.denuncias where estado = 'abierta'));
  end if;

  if soporte then
    v := v || jsonb_build_object(
      'usuarios', (select jsonb_build_object(
                     'total', count(*),
                     'nuevos7dias', count(*) filter (where creado_en >= now() - interval '7 days'),
                     'bloqueados', (select count(*) from public.bloqueos_cuenta where desbloqueado_en is null))
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
                    where estado = any (pkg_admin._estados_en_curso()))));
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
                          'pendiente', count(*) filter (where estado = 'pendiente'),
                          'porVencer', count(*) filter (where estado = 'activa'
                                                          and fin_periodo < now() + interval '7 days'))
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
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  pkg_admin.planes(),
  pkg_admin._aplicar_limites_de(uuid),
  pkg_admin.guardar_plan(uuid, text, numeric, integer, integer, boolean),
  pkg_admin.ordenar_plan(uuid, text),
  pkg_admin.suscripciones(text, uuid, text, integer),
  pkg_admin.suscripcion(uuid),
  pkg_admin._suscripcion_renovable(uuid),
  pkg_admin.extender_suscripcion(uuid, integer, text),
  pkg_admin.registrar_pago_suscripcion(uuid, text),
  pkg_admin.cancelar_suscripcion(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function
  pkg_admin._aplicar_limites_de(uuid),
  pkg_admin.guardar_plan(uuid, text, numeric, integer, integer, boolean),
  pkg_admin.ordenar_plan(uuid, text),
  pkg_admin._suscripcion_renovable(uuid),
  pkg_admin.extender_suscripcion(uuid, integer, text),
  pkg_admin.registrar_pago_suscripcion(uuid, text),
  pkg_admin.cancelar_suscripcion(uuid, text)
to authenticated;
