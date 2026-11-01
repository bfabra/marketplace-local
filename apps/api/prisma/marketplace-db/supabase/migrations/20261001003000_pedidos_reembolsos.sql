-- ============================================================================
-- Panel de administración, etapa 5: pedidos y reembolsos. Convenciones en ..._1800.
--
-- Quién hace qué (el superadmin, todo):
--   soporte, logística y finanzas → ven todos los pedidos (los pagos, solo finanzas)
--   soporte y logística           → cancelan la parte de una tienda, con motivo
--   finanzas                      → procesa o rechaza reembolsos y devuelve dinero a mano
--
-- Circuito de un reembolso:
--   1. Se crea "pendiente": al cancelar una parte pagada (lo hace la base),
--      al devolver el envío, o a mano por finanzas.
--   2. Finanzas lo procesa (se devuelve por Mercado Pago, hoy simulado) o lo
--      rechaza con una nota.
--   3. Procesado, el pedido pasa a "reembolsado en parte" o "reembolsado" y el
--      comprador recibe un aviso.
-- Nunca se devuelve más de lo que se pagó por cada parte.
-- ============================================================================

alter table public.reembolsos
  add column nota          text check (char_length(nota) <= 500),
  add column creado_por    uuid references public.perfiles (id) on delete set null,
  add column procesado_por uuid references public.perfiles (id) on delete set null,
  add column procesado_en  timestamptz;

create index reembolsos_pendientes_idx on public.reembolsos (creado_en) where estado = 'pendiente';
create index reembolsos_creado_por_idx on public.reembolsos (creado_por);
create index reembolsos_procesado_por_idx on public.reembolsos (procesado_por);
create index if not exists pedidos_creado_en_idx on public.pedidos (creado_en desc);

create policy "reembolsos: finanzas crea" on public.reembolsos
  for insert to authenticated with check (public.es_admin('finanzas'));
create policy "reembolsos: finanzas procesa" on public.reembolsos
  for update to authenticated using (public.es_admin('finanzas')) with check (public.es_admin('finanzas'));

create trigger auditar after insert or update or delete on public.reembolsos
  for each row execute function public.tg_auditar();

-- ----------------------------------------------------------------------------
-- Reglas
-- ----------------------------------------------------------------------------

-- Lo que falta devolver de una parte: su total menos los reembolsos no
-- rechazados (el del envío va aparte).
create or replace function public.reembolsable(p_pt uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select greatest(pt.total - coalesce((
           select sum(r.monto) from public.reembolsos r
           where r.pedido_tienda_id = pt.id and not r.es_envio and r.estado <> 'rechazado'), 0), 0)
  from public.pedidos_tienda pt where pt.id = p_pt
$$;

create or replace function public.tg_reembolsos_control()
returns trigger language plpgsql as $$
declare v_maximo numeric;
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado and new.estado <> 'pendiente' then
    new.procesado_en := coalesce(new.procesado_en, now());
    new.procesado_por := coalesce(new.procesado_por, auth.uid());
  end if;
  -- Los reembolsos que genera la base (cancelaciones, envío) no pasan por acá.
  if not public.es_usuario_final() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.estado := 'pendiente';
    new.es_envio := false;
    new.mp_refund_id := null;
    new.nota := null;
    new.creado_por := auth.uid();
    new.procesado_por := null;
    new.procesado_en := null;
    if not exists (select 1 from public.pedidos_tienda pt
                   join public.pedidos p on p.id = pt.pedido_id
                   where pt.id = new.pedido_tienda_id
                     and p.estado_pago in ('aprobado', 'reembolsado_parcial')
                     and pt.estado not in ('pendiente', 'rechazado')) then
      raise exception 'Solo se devuelve dinero de una parte ya pagada' using errcode = 'TC409';
    end if;
    -- Finanzas ve la parte y sus reembolsos por RLS; reembolsable() es solo del servidor.
    select greatest(pt.total - coalesce((
             select sum(r.monto) from public.reembolsos r
             where r.pedido_tienda_id = pt.id and not r.es_envio and r.estado <> 'rechazado'), 0), 0)
    into v_maximo
    from public.pedidos_tienda pt where pt.id = new.pedido_tienda_id;
    if new.monto > v_maximo then
      raise exception 'El monto supera lo que queda por devolver de esta parte ($%)', v_maximo
        using errcode = 'TC400';
    end if;
    return new;
  end if;

  if old.estado <> 'pendiente' then
    raise exception 'Este reembolso ya fue %', old.estado using errcode = 'TC409';
  end if;
  if (new.pedido_tienda_id, new.monto, new.motivo, new.es_envio, new.creado_por, new.creado_en)
     is distinct from (old.pedido_tienda_id, old.monto, old.motivo, old.es_envio, old.creado_por, old.creado_en) then
    raise exception 'De un reembolso solo se decide si se procesa o se rechaza' using errcode = 'TC400';
  end if;
  if new.estado = 'rechazado' and char_length(coalesce(trim(new.nota), '')) < 5 then
    raise exception 'Contá por qué se rechaza (al menos 5 caracteres)' using errcode = 'TC400';
  end if;
  return new;
end $$;

create trigger reembolsos_control
  before insert or update on public.reembolsos
  for each row execute function public.tg_reembolsos_control();

-- Procesado: actualiza el estado de pago del pedido y avisa al comprador.
create or replace function public.tg_reembolsos_efectos()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pedido   public.pedidos;
  v_devuelto numeric;
  v_tienda   text;
begin
  select p.* into v_pedido
  from public.pedidos p join public.pedidos_tienda pt on pt.pedido_id = p.id
  where pt.id = new.pedido_tienda_id;

  select coalesce(sum(r.monto), 0) into v_devuelto
  from public.reembolsos r join public.pedidos_tienda pt on pt.id = r.pedido_tienda_id
  where pt.pedido_id = v_pedido.id and r.estado = 'procesado';

  update public.pedidos
  set estado_pago = case when v_devuelto >= total then 'reembolsado' else 'reembolsado_parcial' end::public.estado_pago_pedido
  where id = v_pedido.id and estado_pago in ('aprobado', 'reembolsado_parcial');

  select t.nombre into v_tienda
  from public.pedidos_tienda pt join public.tiendas t on t.id = pt.tienda_id
  where pt.id = new.pedido_tienda_id;

  insert into public.notificaciones (usuario_id, tipo, datos)
  values (v_pedido.comprador_id, 'reembolso',
          jsonb_build_object('pedido', v_pedido.numero, 'tienda', v_tienda, 'monto', new.monto,
                             'es_envio', new.es_envio));
  return null;
end $$;

create trigger reembolsos_efectos
  after update of estado on public.reembolsos
  for each row when (new.estado = 'procesado' and old.estado <> 'procesado')
  execute function public.tg_reembolsos_efectos();

-- Al cancelar una parte pagada se devuelve lo que falte (antes era el total
-- de la parte, aunque finanzas ya hubiera devuelto algo a mano).
create or replace function public.tg_pedidos_tienda_efectos()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pedido public.pedidos;
  v_tienda text;
  v_falta  numeric;
begin
  select * into v_pedido from public.pedidos where id = new.pedido_id;
  select nombre into v_tienda from public.tiendas where id = new.tienda_id;

  insert into public.historial_estados (pedido_tienda_id, estado_anterior, estado_nuevo, usuario_id, nota)
  values (new.id, old.estado, new.estado, auth.uid(), new.motivo_cancelacion);

  if new.estado = 'cancelado' then
    -- Después del pago: devuelve stock y deja el reembolso de la parte pendiente.
    if old.estado in ('pago_confirmado', 'en_preparacion', 'listo_para_recoleccion',
                      'listo_para_retiro', 'recolectado', 'en_camino') then
      update public.variantes v set stock = v.stock + i.cantidad
      from public.pedido_items i
      where i.pedido_tienda_id = new.id and i.variante_id = v.id;

      v_falta := public.reembolsable(new.id);
      if v_falta > 0 then
        insert into public.reembolsos (pedido_tienda_id, monto, motivo)
        values (new.id, v_falta, new.motivo_cancelacion);
      end if;
    end if;

    perform public.cerrar_envio_si_corresponde(new.pedido_id, new.id);
  end if;

  insert into public.notificaciones (usuario_id, tipo, datos)
  values (v_pedido.comprador_id, 'estado_pedido',
          jsonb_build_object('pedido', v_pedido.numero, 'tienda', v_tienda, 'estado', new.estado));
  return null;
end $$;

-- Un pedido con un reembolso parcial ya procesado sigue estando pagado.
create or replace function public.cerrar_envio_si_corresponde(p_pedido uuid, p_pt uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_pedido public.pedidos;
begin
  if exists (select 1 from public.pedidos_tienda
             where pedido_id = p_pedido and modalidad = 'entrega_plataforma'
               and estado not in ('cancelado', 'rechazado')) then
    return;
  end if;

  update public.envios set estado = 'fallido'
  where pedido_id = p_pedido and estado in ('pendiente', 'en_recoleccion');

  select * into v_pedido from public.pedidos where id = p_pedido;
  if v_pedido.estado_pago in ('aprobado', 'reembolsado_parcial')
     and v_pedido.costo_envio > 0
     and not exists (select 1 from public.envios where pedido_id = p_pedido and estado = 'entregado')
     and not exists (select 1 from public.reembolsos r
                     join public.pedidos_tienda pt on pt.id = r.pedido_tienda_id
                     where pt.pedido_id = p_pedido and r.es_envio) then
    insert into public.reembolsos (pedido_tienda_id, monto, motivo, es_envio)
    values (p_pt, v_pedido.costo_envio, 'Devolución del costo de envío', true);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Listado y ficha (servidor: los correos viven en auth.users)
-- ----------------------------------------------------------------------------

create or replace function pkg_admin._estados_en_curso()
returns public.estado_pedido_tienda[] language sql immutable set search_path = '' as $$
  select array['pago_confirmado', 'en_preparacion', 'listo_para_recoleccion',
               'listo_para_retiro', 'recolectado', 'en_camino']::public.estado_pedido_tienda[]
$$;

-- Vistas:
--   todos, en_curso (alguna parte en preparación o viaje), pendiente_pago,
--   reembolsos (con un reembolso pendiente), cancelados (alguna parte cancelada),
--   entregados (todo lo que no se canceló, entregado).
-- Busca por número (#1001), nombre o correo del comprador, o nombre de la tienda.
create or replace function pkg_admin.pedidos(
  p_vista text default 'todos', p_buscar text default null, p_pagina integer default 1
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_por_pagina constant integer := 20;
  v_vista  text := coalesce(p_vista, 'todos');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_buscar text := nullif(trim(p_buscar), '');
  v_numero bigint;
  v_patron text := '%' || public.f_unaccent(lower(nullif(trim(p_buscar), ''))) || '%';
  v_curso  public.estado_pedido_tienda[] := pkg_admin._estados_en_curso();
  v_items  jsonb;
  v_total  integer;
begin
  if v_vista not in ('todos', 'en_curso', 'pendiente_pago', 'reembolsos', 'cancelados', 'entregados') then
    raise exception 'Vista inválida' using errcode = 'TC400';
  end if;
  if v_buscar ~ '^#?[0-9]{1,15}$' then
    v_numero := ltrim(v_buscar, '#')::bigint;
  end if;

  with filtrados as (
    select pe.id, pe.creado_en
    from public.pedidos pe
    left join auth.users u on u.id = pe.comprador_id
    join public.perfiles pf on pf.id = pe.comprador_id
    where (v_buscar is null
           or pe.numero = v_numero
           or (v_numero is null and (
                 public.f_unaccent(lower(concat_ws(' ', pf.nombre, pf.apellido))) like v_patron
                 or lower(u.email) like v_patron
                 or exists (select 1 from public.pedidos_tienda pt
                            join public.tiendas t on t.id = pt.tienda_id
                            where pt.pedido_id = pe.id and public.f_unaccent(lower(t.nombre)) like v_patron))))
      and case v_vista
            when 'en_curso' then exists (select 1 from public.pedidos_tienda pt
                                         where pt.pedido_id = pe.id and pt.estado = any (v_curso))
            when 'pendiente_pago' then pe.estado_pago = 'pendiente'
            when 'reembolsos' then exists (select 1 from public.pedidos_tienda pt
                                           join public.reembolsos r on r.pedido_tienda_id = pt.id
                                           where pt.pedido_id = pe.id and r.estado = 'pendiente')
            when 'cancelados' then exists (select 1 from public.pedidos_tienda pt
                                           where pt.pedido_id = pe.id and pt.estado = 'cancelado')
            when 'entregados' then exists (select 1 from public.pedidos_tienda pt
                                           where pt.pedido_id = pe.id and pt.estado = 'entregado')
                               and not exists (select 1 from public.pedidos_tienda pt
                                               where pt.pedido_id = pe.id
                                                 and pt.estado not in ('entregado', 'cancelado', 'rechazado'))
            else true
          end
  ), pagina as (
    select id, creado_en from filtrados order by creado_en desc
    limit v_por_pagina offset (v_pagina - 1) * v_por_pagina
  )
  select (select count(*) from filtrados),
         coalesce(jsonb_agg(x.item order by x.creado_en desc), '[]'::jsonb)
  into v_total, v_items
  from (
    select pe.creado_en, jsonb_build_object(
             'id', pe.id,
             'numero', pe.numero,
             'creado_en', pe.creado_en,
             'total', pe.total,
             'estado_pago', pe.estado_pago,
             'comprador', jsonb_build_object(
               'id', pf.id, 'nombre', nullif(concat_ws(' ', pf.nombre, pf.apellido), ''), 'email', u.email),
             'partes', (select jsonb_agg(jsonb_build_object(
                                 'tienda', t.nombre, 'estado', pt.estado, 'modalidad', pt.modalidad)
                               order by t.nombre)
                        from public.pedidos_tienda pt
                        join public.tiendas t on t.id = pt.tienda_id
                        where pt.pedido_id = pe.id),
             'reembolsoPendiente', (select coalesce(sum(r.monto), 0)
                                    from public.pedidos_tienda pt
                                    join public.reembolsos r on r.pedido_tienda_id = pt.id
                                    where pt.pedido_id = pe.id and r.estado = 'pendiente')
           ) as item
    from pagina f
    join public.pedidos pe on pe.id = f.id
    join public.perfiles pf on pf.id = pe.comprador_id
    left join auth.users u on u.id = pe.comprador_id
  ) x;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'pagina', v_pagina,
    'porPagina', v_por_pagina,
    'conteos', jsonb_build_object(
      'en_curso', (select count(distinct pt.pedido_id) from public.pedidos_tienda pt
                   where pt.estado = any (v_curso)),
      'pendiente_pago', (select count(*) from public.pedidos where estado_pago = 'pendiente'),
      'reembolsos', (select count(distinct pt.pedido_id) from public.reembolsos r
                     join public.pedidos_tienda pt on pt.id = r.pedido_tienda_id
                     where r.estado = 'pendiente'))
  );
end $$;

-- Ficha de un pedido. Los pagos solo los ve finanzas; "permisos" le dice a la
-- web qué acciones mostrar (la base las vuelve a validar al ejecutarlas).
create or replace function pkg_admin.pedido(p_pedido uuid, p_usuario uuid)
returns jsonb language sql stable set search_path = '' as $$
  with permisos as (
    select pkg_admin.tiene_rol(p_usuario, array['soporte', 'logistica']) as cancelar,
           pkg_admin.tiene_rol(p_usuario, array['finanzas']) as finanzas,
           pkg_admin.tiene_rol(p_usuario, array['soporte']) as ver_usuarios
  )
  select jsonb_build_object(
    'id', pe.id,
    'numero', pe.numero,
    'creado_en', pe.creado_en,
    'subtotal', pe.subtotal,
    'costo_envio', pe.costo_envio,
    'total', pe.total,
    'estado_pago', pe.estado_pago,
    'direccion_envio', pe.direccion_envio,
    'permisos', jsonb_build_object('cancelar', pm.cancelar, 'reembolsar', pm.finanzas,
                                   'verUsuarios', pm.ver_usuarios),
    'comprador', jsonb_build_object(
      'id', pf.id,
      'nombre', nullif(concat_ws(' ', pf.nombre, pf.apellido), ''),
      'email', u.email,
      'telefono', pf.telefono,
      'bloqueado', exists (select 1 from public.bloqueos_cuenta b
                           where b.usuario_id = pf.id and b.desbloqueado_en is null)),
    'partes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pt.id,
               'tienda', jsonb_build_object('id', t.id, 'nombre', t.nombre, 'telefono', t.telefono),
               'modalidad', pt.modalidad,
               'estado', pt.estado,
               'subtotal', pt.subtotal,
               'comision', pt.comision,
               'total', pt.total,
               'motivo_cancelacion', pt.motivo_cancelacion,
               'listo_en', pt.listo_en,
               'cancelable', pt.estado = any (pkg_admin._estados_en_curso()),
               'reembolsable', case when pe.estado_pago in ('aprobado', 'reembolsado_parcial')
                                     and pt.estado not in ('pendiente', 'rechazado')
                                    then public.reembolsable(pt.id) else 0 end,
               'items', (select jsonb_agg(jsonb_build_object(
                                  'nombre', i.nombre_producto,
                                  'variante', i.descripcion_variante,
                                  'precio_unitario', i.precio_unitario,
                                  'cantidad', i.cantidad,
                                  'subtotal', i.subtotal) order by i.nombre_producto)
                         from public.pedido_items i where i.pedido_tienda_id = pt.id),
               'historial', (select jsonb_agg(jsonb_build_object(
                                      'fecha', h.creado_en,
                                      'anterior', h.estado_anterior,
                                      'estado', h.estado_nuevo,
                                      'nota', h.nota,
                                      'actor', nullif(concat_ws(' ', hp.nombre, hp.apellido), '')) order by h.creado_en)
                             from public.historial_estados h
                             left join public.perfiles hp on hp.id = h.usuario_id
                             where h.pedido_tienda_id = pt.id),
               'reclamos', (select jsonb_agg(jsonb_build_object(
                                     'motivo', rc.motivo, 'estado', rc.estado, 'creado_en', rc.creado_en)
                                   order by rc.creado_en desc)
                            from public.reclamos rc where rc.pedido_tienda_id = pt.id)
             ) order by t.nombre)
      from public.pedidos_tienda pt
      join public.tiendas t on t.id = pt.tienda_id
      where pt.pedido_id = pe.id
    ), '[]'::jsonb),
    'envio', (
      select jsonb_build_object(
               'estado', e.estado,
               'costo', e.costo,
               'entregado_en', e.entregado_en,
               'repartidor', (select jsonb_build_object('nombre', rp.nombre, 'telefono', rp.telefono)
                              from public.repartidores rp where rp.id = e.repartidor_id),
               'recolecciones', (select jsonb_agg(jsonb_build_object(
                                          'tienda', t.nombre,
                                          'estado', rc.estado,
                                          'llegada_en', rc.llegada_en,
                                          'recolectado_en', rc.recolectado_en) order by t.nombre)
                                 from public.recolecciones rc
                                 join public.tiendas t on t.id = rc.tienda_id
                                 where rc.envio_id = e.id))
      from public.envios e where e.pedido_id = pe.id),
    'reembolsos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'tienda', t.nombre,
               'monto', r.monto,
               'motivo', r.motivo,
               'estado', r.estado,
               'es_envio', r.es_envio,
               'nota', r.nota,
               'mp_refund_id', r.mp_refund_id,
               'creado_en', r.creado_en,
               'creadoPor', nullif(concat_ws(' ', cp.nombre, cp.apellido), ''),
               'procesado_en', r.procesado_en,
               'procesadoPor', nullif(concat_ws(' ', pp.nombre, pp.apellido), '')) order by r.creado_en)
      from public.reembolsos r
      join public.pedidos_tienda pt on pt.id = r.pedido_tienda_id
      join public.tiendas t on t.id = pt.tienda_id
      left join public.perfiles cp on cp.id = r.creado_por
      left join public.perfiles pp on pp.id = r.procesado_por
      where pt.pedido_id = pe.id
    ), '[]'::jsonb),
    'pagos', case when pm.finanzas then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pg.id,
               'mp_payment_id', pg.mp_payment_id,
               'monto', pg.monto,
               'comision_marketplace', pg.comision_marketplace,
               'estado', pg.estado,
               'creado_en', pg.creado_en) order by pg.creado_en)
      from public.pagos pg where pg.pedido_id = pe.id
    ), '[]'::jsonb) end
  )
  from public.pedidos pe
  join public.perfiles pf on pf.id = pe.comprador_id
  left join auth.users u on u.id = pe.comprador_id
  cross join permisos pm
  where pe.id = p_pedido
$$;

-- ----------------------------------------------------------------------------
-- Acciones (corren como el admin; RLS, los triggers y la auditoría hacen el resto)
-- ----------------------------------------------------------------------------

-- Cancela la parte de una tienda. Si estaba pagada, la base devuelve el stock y
-- deja el reembolso pendiente para finanzas (y el del envío, si corresponde).
create or replace function pkg_admin.cancelar_parte(p_pedido_tienda uuid, p_motivo text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_motivo text := nullif(trim(p_motivo), '');
  v_estado public.estado_pedido_tienda;
begin
  if not (public.es_admin('soporte') or public.es_admin('logistica')) then
    raise exception 'Solo soporte o logística cancelan pedidos' using errcode = 'TC403';
  end if;
  if char_length(coalesce(v_motivo, '')) not between 5 and 500 then
    raise exception 'Contale al comprador y a la tienda el motivo (entre 5 y 500 caracteres)' using errcode = 'TC400';
  end if;
  select estado into v_estado from public.pedidos_tienda where id = p_pedido_tienda for update;
  if not found then
    raise exception 'No encontramos esa parte del pedido' using errcode = 'TC404';
  end if;
  if v_estado = 'pendiente' then
    raise exception 'Esta compra todavía espera el pago: si no se paga, se cierra sola' using errcode = 'TC409';
  elsif v_estado in ('cancelado', 'rechazado') then
    raise exception 'Esta parte ya está cancelada' using errcode = 'TC409';
  elsif v_estado = 'entregado' then
    raise exception 'Esta parte ya se entregó. Si hay que devolver dinero, lo hace finanzas con un reembolso'
      using errcode = 'TC409';
  end if;

  update public.pedidos_tienda set estado = 'cancelado', motivo_cancelacion = v_motivo
  where id = p_pedido_tienda;
  return jsonb_build_object('id', p_pedido_tienda, 'estado', 'cancelado');
end $$;

create or replace function pkg_admin._exigir_finanzas()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.es_admin('finanzas') then
    raise exception 'Solo finanzas maneja reembolsos, planes y suscripciones' using errcode = 'TC403';
  end if;
end $$;

-- Referencia de la devolución en Mercado Pago (hoy simulada).
create or replace function pkg_admin._referencia_simulada(p_prefijo text)
returns text language sql volatile set search_path = '' as $$
  select p_prefijo || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
$$;

create or replace function pkg_admin.procesar_reembolso(p_reembolso uuid, p_aprobar boolean, p_nota text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_estado public.estado_reembolso;
begin
  perform pkg_admin._exigir_finanzas();
  if p_aprobar is null then
    raise exception 'Elegí si el reembolso se procesa o se rechaza' using errcode = 'TC400';
  end if;
  update public.reembolsos
  set estado = case when p_aprobar then 'procesado' else 'rechazado' end::public.estado_reembolso,
      nota = nullif(trim(p_nota), ''),
      mp_refund_id = case when p_aprobar then pkg_admin._referencia_simulada('SIM-REF') end
  where id = p_reembolso
  returning estado into v_estado;
  if not found then
    raise exception 'No encontramos ese reembolso' using errcode = 'TC404';
  end if;
  return jsonb_build_object('id', p_reembolso, 'estado', v_estado);
end $$;

-- Devolución a mano (por ejemplo, un producto que llegó fallado): se procesa en el acto.
create or replace function pkg_admin.reembolsar(p_pedido_tienda uuid, p_monto numeric, p_motivo text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_motivo text := nullif(trim(p_motivo), '');
  v_id uuid;
begin
  perform pkg_admin._exigir_finanzas();
  if p_monto is null or p_monto <= 0 or p_monto <> round(p_monto, 2) then
    raise exception 'Ingresá un monto mayor a cero' using errcode = 'TC400';
  end if;
  if char_length(coalesce(v_motivo, '')) not between 5 and 500 then
    raise exception 'Contale al comprador el motivo (entre 5 y 500 caracteres)' using errcode = 'TC400';
  end if;
  if not exists (select 1 from public.pedidos_tienda where id = p_pedido_tienda) then
    raise exception 'No encontramos esa parte del pedido' using errcode = 'TC404';
  end if;

  insert into public.reembolsos (pedido_tienda_id, monto, motivo)
  values (p_pedido_tienda, p_monto, v_motivo)
  returning id into v_id;
  update public.reembolsos
  set estado = 'procesado', mp_refund_id = pkg_admin._referencia_simulada('SIM-REF')
  where id = v_id;
  return jsonb_build_object('id', v_id, 'monto', p_monto, 'estado', 'procesado');
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  public.reembolsable(uuid),
  pkg_admin._estados_en_curso(),
  pkg_admin.pedidos(text, text, integer),
  pkg_admin.pedido(uuid, uuid),
  pkg_admin.cancelar_parte(uuid, text),
  pkg_admin._exigir_finanzas(),
  pkg_admin._referencia_simulada(text),
  pkg_admin.procesar_reembolso(uuid, boolean, text),
  pkg_admin.reembolsar(uuid, numeric, text)
from public, anon, authenticated, service_role;

grant execute on function
  pkg_admin.cancelar_parte(uuid, text),
  pkg_admin._exigir_finanzas(),
  pkg_admin._referencia_simulada(text),
  pkg_admin.procesar_reembolso(uuid, boolean, text),
  pkg_admin.reembolsar(uuid, numeric, text)
to authenticated;
