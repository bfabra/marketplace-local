-- ============================================================================
-- Correcciones de la revisión del modelo
-- 1. confirmar_pago exige que el monto coincida con el total del pedido.
-- 2. Un pago aprobado después de un rechazo reabre el pedido.
-- 3. Se devuelve el costo de envío si se cancelan todas las partes con entrega.
-- 4. Renombrar o mover una categoría actualiza la ruta de sus subcategorías.
-- 5. Una suscripción cancelada o rechazada, sin otra vigente, vence la tienda.
-- 6. Los pedidos que nunca se pagaron se cierran solos (tarea programada).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2. Transición nueva: "rechazado" → "pendiente", solo la plataforma
-- ----------------------------------------------------------------------------
create or replace function public.transicion_pedido_tienda(
  desde public.estado_pedido_tienda,
  hacia public.estado_pedido_tienda,
  modalidad public.modalidad_entrega)
returns text language sql immutable as $$
  select case
    when desde = 'pago_confirmado' and hacia = 'en_preparacion' then 'comercio'
    when desde = 'en_preparacion'  and hacia = 'listo_para_recoleccion'
         and modalidad = 'entrega_plataforma' then 'comercio'
    when desde = 'en_preparacion'  and hacia = 'listo_para_retiro'
         and modalidad = 'retiro_en_local' then 'comercio'
    when desde = 'listo_para_retiro' and hacia = 'entregado' then 'comercio'
    when desde in ('pago_confirmado', 'en_preparacion') and hacia = 'cancelado' then 'comercio'
    when desde = 'pendiente' and hacia in ('pago_confirmado', 'rechazado', 'cancelado') then 'sistema'
    when desde = 'rechazado' and hacia = 'pendiente' then 'sistema'
    when desde = 'listo_para_recoleccion' and hacia = 'recolectado' then 'sistema'
    when desde = 'recolectado' and hacia = 'en_camino' then 'sistema'
    when desde = 'en_camino'   and hacia = 'entregado' then 'sistema'
    when desde in ('listo_para_recoleccion', 'listo_para_retiro', 'recolectado', 'en_camino')
         and hacia = 'cancelado' then 'sistema'
    else null
  end
$$;

-- ----------------------------------------------------------------------------
-- 1 y 2. Confirmar el pago
-- ----------------------------------------------------------------------------
create or replace function public.confirmar_pago(
  p_pedido        uuid,
  p_mp_payment_id text,
  p_monto         numeric,
  p_respuesta     jsonb default null)
returns table (pedido_tienda_id uuid, cancelada_sin_stock boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_pedido public.pedidos;
  v_pt     public.pedidos_tienda;
  v_falta  boolean;
begin
  select * into v_pedido from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido inexistente'; end if;

  -- Aviso repetido: el pedido ya está pagado o este pago ya se registró.
  if v_pedido.estado_pago not in ('pendiente', 'rechazado')
     or exists (select 1 from public.pagos where mp_payment_id = p_mp_payment_id) then
    return;
  end if;

  -- El servidor debe registrar este error y avisar: el dinero entró pero no se confirma.
  if round(p_monto, 2) <> v_pedido.total then
    raise exception 'El monto pagado (%) no coincide con el total del pedido (%)', p_monto, v_pedido.total;
  end if;

  -- El cliente reintentó con otro medio después de un rechazo.
  if v_pedido.estado_pago = 'rechazado' then
    update public.pedidos_tienda set estado = 'pendiente'
    where pedido_id = p_pedido and estado = 'rechazado';
  end if;

  insert into public.pagos (pedido_id, mp_payment_id, monto, comision_marketplace, estado, respuesta_mp)
  values (p_pedido, p_mp_payment_id, p_monto,
          (select coalesce(sum(comision), 0) from public.pedidos_tienda where pedido_id = p_pedido),
          'aprobado', p_respuesta);

  update public.pedidos set estado_pago = 'aprobado' where id = p_pedido;

  for v_pt in select * from public.pedidos_tienda where pedido_id = p_pedido and estado = 'pendiente' loop
    perform 1 from public.variantes v join public.pedido_items i on i.variante_id = v.id
    where i.pedido_tienda_id = v_pt.id order by v.id for update of v;

    select exists (
      select 1 from public.pedido_items i left join public.variantes v on v.id = i.variante_id
      where i.pedido_tienda_id = v_pt.id and (v.id is null or v.stock < i.cantidad)
    ) into v_falta;

    if v_falta then
      update public.pedidos_tienda
      set estado = 'cancelado', motivo_cancelacion = 'Sin stock al confirmar el pago'
      where id = v_pt.id;
      insert into public.reembolsos (pedido_tienda_id, monto, motivo)
      values (v_pt.id, v_pt.total, 'Sin stock al confirmar el pago');
    else
      update public.variantes v set stock = v.stock - i.cantidad
      from public.pedido_items i
      where i.pedido_tienda_id = v_pt.id and i.variante_id = v.id;
      update public.pedidos_tienda set estado = 'pago_confirmado' where id = v_pt.id;

      insert into public.notificaciones (usuario_id, tipo, datos)
      select t.propietario_id, 'pedido_nuevo',
             jsonb_build_object('pedido', v_pedido.numero, 'pedido_tienda_id', v_pt.id)
      from public.tiendas t where t.id = v_pt.tienda_id;
    end if;
    pedido_tienda_id := v_pt.id;
    cancelada_sin_stock := v_falta;
    return next;
  end loop;

  delete from public.reservas_stock where pedido_id = p_pedido;

  if exists (select 1 from public.pedidos_tienda
             where pedido_id = p_pedido and modalidad = 'entrega_plataforma' and estado = 'pago_confirmado') then
    with e as (
      insert into public.envios (pedido_id, direccion_destino, costo)
      values (p_pedido, v_pedido.direccion_envio, v_pedido.costo_envio)
      returning id
    )
    insert into public.recolecciones (envio_id, pedido_tienda_id, tienda_id)
    select e.id, pt.id, pt.tienda_id
    from e, public.pedidos_tienda pt
    where pt.pedido_id = p_pedido and pt.modalidad = 'entrega_plataforma' and pt.estado = 'pago_confirmado';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Devolución del costo de envío
-- ----------------------------------------------------------------------------
alter table public.reembolsos
  add column es_envio boolean not null default false;

-- Si no queda ninguna parte con entrega a domicilio, la entrega se cancela y,
-- si el pedido estaba pagado, se devuelve el envío (una sola vez).
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
  if v_pedido.estado_pago = 'aprobado'
     and v_pedido.costo_envio > 0
     and not exists (select 1 from public.envios where pedido_id = p_pedido and estado = 'entregado')
     and not exists (select 1 from public.reembolsos r
                     join public.pedidos_tienda pt on pt.id = r.pedido_tienda_id
                     where pt.pedido_id = p_pedido and r.es_envio) then
    insert into public.reembolsos (pedido_tienda_id, monto, motivo, es_envio)
    values (p_pt, v_pedido.costo_envio, 'Devolución del costo de envío', true);
  end if;
end $$;

create or replace function public.tg_pedidos_tienda_efectos()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pedido public.pedidos;
  v_tienda text;
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

      insert into public.reembolsos (pedido_tienda_id, monto, motivo)
      values (new.id, new.total, new.motivo_cancelacion);
    end if;

    perform public.cerrar_envio_si_corresponde(new.pedido_id, new.id);
  end if;

  insert into public.notificaciones (usuario_id, tipo, datos)
  values (v_pedido.comprador_id, 'estado_pedido',
          jsonb_build_object('pedido', v_pedido.numero, 'tienda', v_tienda, 'estado', new.estado));
  return null;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Rutas de categorías
-- ----------------------------------------------------------------------------
create or replace function public.tg_categoria_ruta()
returns trigger language plpgsql as $$
declare ruta_padre text;
begin
  if new.padre_id is null then
    new.ruta := '/' || new.slug || '/';
  else
    select ruta into ruta_padre from public.categorias where id = new.padre_id;
    if tg_op = 'UPDATE' and starts_with(ruta_padre, old.ruta) then
      raise exception 'Una categoría no puede quedar dentro de sus propias subcategorías';
    end if;
    new.ruta := ruta_padre || new.slug || '/';
  end if;
  return new;
end $$;

-- Un solo UPDATE mueve todo el subárbol; las filas hijas no vuelven a disparar
-- categoria_ruta porque solo cambia la columna ruta.
-- No se usa "after update of ruta": ese filtro mira el SET de la consulta, y la
-- ruta la calcula el trigger categoria_ruta, no quien actualiza.
create or replace function public.tg_categoria_ruta_hijas()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.categorias
  set ruta = new.ruta || substr(ruta, length(old.ruta) + 1)
  where starts_with(ruta, old.ruta) and id <> new.id;
  return null;
end $$;

create trigger categoria_ruta_hijas
  after update on public.categorias
  for each row when (old.ruta is distinct from new.ruta)
  execute function public.tg_categoria_ruta_hijas();

-- ----------------------------------------------------------------------------
-- 5. Suscripciones: sin plan vigente, la tienda vence
-- ----------------------------------------------------------------------------
create or replace function public.tg_suscripciones_efectos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado in ('activa', 'en_gracia') then
    update public.tiendas set estado = 'activa'
    where id = new.tienda_id and estado = 'vencida';
    perform public.aplicar_limites_plan(new.tienda_id);
  elsif new.estado = 'vencida'
        or (new.estado in ('cancelada', 'rechazada')
            and not exists (select 1 from public.suscripciones s
                            where s.tienda_id = new.tienda_id and s.id <> new.id
                              and s.estado in ('activa', 'en_gracia'))) then
    update public.tiendas set estado = 'vencida'
    where id = new.tienda_id and estado = 'activa';
  end if;
  return null;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Pedidos sin pago
-- ----------------------------------------------------------------------------
insert into public.configuracion (clave, valor, descripcion) values
  ('horas_vencimiento_pedido', '24', 'Horas sin pago tras las cuales un pedido se cierra solo')
on conflict (clave) do nothing;

-- Quedan "rechazado": si Mercado Pago aprueba tarde, confirmar_pago los reabre.
create or replace function public.cerrar_pedidos_sin_pago()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_horas integer := coalesce(public.config_int('horas_vencimiento_pedido'), 24);
  v_ids   uuid[];
begin
  select array_agg(id) into v_ids from public.pedidos
  where estado_pago = 'pendiente' and creado_en < now() - make_interval(hours => v_horas);
  if v_ids is null then return 0; end if;

  update public.pedidos set estado_pago = 'rechazado' where id = any (v_ids);
  update public.pedidos_tienda set estado = 'rechazado'
  where pedido_id = any (v_ids) and estado = 'pendiente';
  delete from public.reservas_stock where pedido_id = any (v_ids);
  return cardinality(v_ids);
end $$;

-- ----------------------------------------------------------------------------
-- Quién puede llamar a las funciones nuevas
-- ----------------------------------------------------------------------------
revoke execute on function public.cerrar_envio_si_corresponde(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.cerrar_pedidos_sin_pago() from public, anon, authenticated;
revoke execute on function public.confirmar_pago(uuid, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.cerrar_pedidos_sin_pago() to service_role;
grant execute on function public.confirmar_pago(uuid, text, numeric, jsonb) to service_role;
