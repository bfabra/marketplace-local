-- ============================================================================
-- Reglas de negocio dentro de la base de datos.
-- Aunque alguien llame a la API directo (sin pasar por las pantallas), la base
-- rechaza lo que no corresponde.
--
-- Convención: los disparadores BEFORE validan (corren con los permisos de
-- quien hace el cambio); los AFTER aplican efectos en otras tablas (corren
-- como "security definer" porque tocan tablas que el usuario no puede tocar).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Utilidades
-- ----------------------------------------------------------------------------

-- ¿Cambió algo además de las columnas permitidas?
create or replace function public.cambio_fuera_de(viejo jsonb, nuevo jsonb, permitidas text[])
returns boolean language sql immutable as $$
  select (viejo - permitidas - 'actualizado_en') is distinct from (nuevo - permitidas - 'actualizado_en')
$$;

-- actualizado_en automático en todas las tablas que lo tienen.
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'actualizado_en'
  loop
    execute format(
      'create trigger actualizado_en before update on public.%I
         for each row execute function public.tg_actualizado_en()', t);
  end loop;
end $$;

-- Conteos que no deben depender de lo que cada usuario puede ver.
create or replace function public.contar_publicados(p_tienda uuid, p_excluir uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.productos
  where tienda_id = p_tienda and estado = 'publicado' and id is distinct from p_excluir
$$;

create or replace function public.contar_empleados_activos(p_tienda uuid, p_excluir uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.miembros_tienda
  where tienda_id = p_tienda and estado = 'activo' and id is distinct from p_excluir
$$;

-- ----------------------------------------------------------------------------
-- 1. Tiendas: el dueño lo pone la base; el estado solo lo cambia el admin
-- ----------------------------------------------------------------------------
create or replace function public.tiene_cuenta_mp(p_tienda uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cuentas_mp_tienda c where c.tienda_id = p_tienda)
$$;

create or replace function public.tg_tiendas_control()
returns trigger language plpgsql as $$
begin
  if public.es_usuario_final() and not public.es_admin() then
    if tg_op = 'INSERT' then
      new.propietario_id := auth.uid();
      new.estado := 'pendiente';
    else
      if new.propietario_id <> old.propietario_id then
        raise exception 'El dueño de una tienda no se puede cambiar desde la aplicación';
      end if;
      if new.estado <> old.estado then
        raise exception 'Solo la administración puede cambiar el estado de una tienda';
      end if;
    end if;
  end if;

  if new.estado = 'activa' and (tg_op = 'INSERT' or old.estado <> 'activa')
     and not public.tiene_cuenta_mp(new.id) then
    raise exception 'La tienda debe vincular su cuenta de Mercado Pago antes de activarse';
  end if;
  return new;
end $$;

create trigger tiendas_control
  before insert or update on public.tiendas
  for each row execute function public.tg_tiendas_control();

-- ----------------------------------------------------------------------------
-- 2. Suscripciones: una sola tienda gratis por usuario; sincroniza la tienda
-- ----------------------------------------------------------------------------
create or replace function public.tg_suscripciones_validar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_propietario uuid;
begin
  if new.estado in ('pendiente', 'activa', 'en_gracia')
     and (select es_gratis from public.planes where id = new.plan_id) then
    select propietario_id into v_propietario from public.tiendas where id = new.tienda_id;
    if exists (
      select 1 from public.suscripciones s
      join public.tiendas t on t.id = s.tienda_id
      join public.planes p on p.id = s.plan_id
      where t.propietario_id = v_propietario
        and s.tienda_id <> new.tienda_id
        and s.estado in ('pendiente', 'activa', 'en_gracia')
        and p.es_gratis
    ) then
      raise exception 'Cada usuario puede tener una sola tienda con el plan gratis';
    end if;
  end if;
  return new;
end $$;

create trigger suscripciones_validar
  before insert or update of plan_id, estado on public.suscripciones
  for each row execute function public.tg_suscripciones_validar();

-- Pausa los productos y suspende los empleados que superan el plan.
-- Conserva los más antiguos; nada se borra. El dueño después puede elegir
-- cuáles publicar, siempre dentro del límite.
create or replace function public.aplicar_limites_plan(p_tienda uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare pl public.planes;
begin
  pl := public.plan_vigente(p_tienda);
  if pl.id is null then return; end if;

  if pl.max_productos is not null then
    update public.productos set estado = 'pausado', motivo_pausa = 'limite_plan'
    where id in (
      select id from public.productos
      where tienda_id = p_tienda and estado = 'publicado'
      order by publicado_en asc nulls last, creado_en asc
      offset pl.max_productos
    );
  end if;

  if pl.max_empleados is not null then
    update public.miembros_tienda set estado = 'suspendido'
    where id in (
      select id from public.miembros_tienda
      where tienda_id = p_tienda and estado = 'activo'
      order by creado_en asc
      offset pl.max_empleados
    );
  end if;
end $$;

create or replace function public.tg_suscripciones_efectos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado in ('activa', 'en_gracia') then
    update public.tiendas set estado = 'activa'
    where id = new.tienda_id and estado = 'vencida';
    perform public.aplicar_limites_plan(new.tienda_id);
  elsif new.estado = 'vencida' then
    update public.tiendas set estado = 'vencida'
    where id = new.tienda_id and estado = 'activa';
  end if;
  return null;
end $$;

create trigger suscripciones_efectos
  after insert or update of plan_id, estado on public.suscripciones
  for each row execute function public.tg_suscripciones_efectos();

-- ----------------------------------------------------------------------------
-- 3. Empleados: límite del plan; el dueño no puede ser empleado de su tienda
-- ----------------------------------------------------------------------------
create or replace function public.tg_miembros_control()
returns trigger language plpgsql as $$
declare pl public.planes;
begin
  if exists (select 1 from public.tiendas t
             where t.id = new.tienda_id and t.propietario_id = new.usuario_id) then
    raise exception 'El dueño ya tiene todos los permisos; no se agrega como empleado';
  end if;

  if new.estado = 'activo' and (tg_op = 'INSERT' or old.estado <> 'activo') then
    perform pg_advisory_xact_lock(hashtext('empleados:' || new.tienda_id::text));
    pl := public.plan_vigente(new.tienda_id);
    if pl.id is null then
      raise exception 'La tienda no tiene una suscripción activa';
    end if;
    if pl.max_empleados is not null
       and public.contar_empleados_activos(new.tienda_id, new.id) >= pl.max_empleados then
      raise exception 'Tu plan (%) permite hasta % empleados', pl.nombre, pl.max_empleados;
    end if;
  end if;
  return new;
end $$;

create trigger miembros_control
  before insert or update on public.miembros_tienda
  for each row execute function public.tg_miembros_control();

-- ----------------------------------------------------------------------------
-- 4. Productos: permiso para publicar, límite del plan, al menos una variante
-- ----------------------------------------------------------------------------
create or replace function public.tg_productos_control()
returns trigger language plpgsql as $$
declare
  pl public.planes;
  cambia_estado boolean := tg_op = 'INSERT' and new.estado <> 'borrador'
                           or tg_op = 'UPDATE' and new.estado <> old.estado;
begin
  if tg_op = 'UPDATE' and new.tienda_id <> old.tienda_id then
    raise exception 'Un producto no se puede mover a otra tienda';
  end if;

  if cambia_estado and public.es_usuario_final() then
    if not public.tiene_permiso(new.tienda_id, 'productos.publicar') and not public.es_admin('moderacion') then
      raise exception 'No tenés permiso para publicar o pausar productos';
    end if;
    if tg_op = 'UPDATE' and old.motivo_pausa = 'moderacion' and not public.es_admin('moderacion') then
      raise exception 'Este producto fue pausado por moderación; contactá a soporte';
    end if;
  end if;

  if new.estado = 'publicado' and (tg_op = 'INSERT' or old.estado <> 'publicado') then
    perform pg_advisory_xact_lock(hashtext('productos:' || new.tienda_id::text));
    pl := public.plan_vigente(new.tienda_id);
    if pl.id is null then
      raise exception 'La tienda no tiene una suscripción activa';
    end if;
    if pl.max_productos is not null
       and public.contar_publicados(new.tienda_id, new.id) >= pl.max_productos then
      raise exception 'Tu plan (%) permite hasta % productos publicados', pl.nombre, pl.max_productos;
    end if;
    if tg_op = 'INSERT' or not exists (
      select 1 from public.variantes v where v.producto_id = new.id and v.activa) then
      raise exception 'Agregá al menos una variante con precio antes de publicar';
    end if;
    new.publicado_en := coalesce(new.publicado_en, now());
  end if;

  if new.estado = 'pausado' then
    new.motivo_pausa := coalesce(new.motivo_pausa, 'manual');
  else
    new.motivo_pausa := null;
  end if;
  return new;
end $$;

create trigger productos_control
  before insert or update on public.productos
  for each row execute function public.tg_productos_control();

-- Variantes: cambiar stock pide "stock.editar"; cambiar lo demás, "productos.editar".
create or replace function public.tg_variantes_control()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and public.es_usuario_final() then
    if new.stock <> old.stock and not public.tiene_permiso(new.tienda_id, 'stock.editar') then
      raise exception 'No tenés permiso para modificar el stock';
    end if;
    if public.cambio_fuera_de(to_jsonb(old), to_jsonb(new), array['stock'])
       and not public.tiene_permiso(new.tienda_id, 'productos.editar') then
      raise exception 'No tenés permiso para editar productos';
    end if;
  end if;
  return new;
end $$;

create trigger variantes_control
  before update on public.variantes
  for each row execute function public.tg_variantes_control();

-- ----------------------------------------------------------------------------
-- 5. Partes del pedido: quién puede mover cada estado
-- ----------------------------------------------------------------------------
-- Devuelve quién puede hacer la transición: 'comercio', 'sistema' o null (no permitida).
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
    when desde = 'listo_para_recoleccion' and hacia = 'recolectado' then 'sistema'
    when desde = 'recolectado' and hacia = 'en_camino' then 'sistema'
    when desde = 'en_camino'   and hacia = 'entregado' then 'sistema'
    when desde in ('listo_para_recoleccion', 'listo_para_retiro', 'recolectado', 'en_camino')
         and hacia = 'cancelado' then 'sistema'
    else null
  end
$$;

create or replace function public.tg_pedidos_tienda_control()
returns trigger language plpgsql as $$
declare
  quien text;
  es_sistema boolean := not public.es_usuario_final()
                        or public.es_admin('logistica') or public.es_admin('soporte');
begin
  if not es_sistema and public.cambio_fuera_de(to_jsonb(old), to_jsonb(new),
       array['estado', 'motivo_cancelacion', 'listo_en']) then
    raise exception 'El comercio solo puede cambiar el estado de su parte del pedido';
  end if;

  if new.estado <> old.estado then
    quien := public.transicion_pedido_tienda(old.estado, new.estado, old.modalidad);
    if quien is null then
      raise exception 'No se puede pasar de "%" a "%"', old.estado, new.estado;
    end if;
    if quien = 'sistema' and not es_sistema then
      raise exception 'El estado "%" lo actualiza la plataforma, no el comercio', new.estado;
    end if;
    if new.estado = 'cancelado' and coalesce(trim(new.motivo_cancelacion), '') = '' then
      raise exception 'Indicá el motivo de la cancelación';
    end if;
    if new.estado in ('listo_para_recoleccion', 'listo_para_retiro') then
      new.listo_en := now();
    end if;
  end if;
  return new;
end $$;

create trigger pedidos_tienda_control
  before update on public.pedidos_tienda
  for each row execute function public.tg_pedidos_tienda_control();

-- Efectos de cada cambio de estado.
create or replace function public.tg_pedidos_tienda_efectos()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pedido public.pedidos;
  v_tienda text;
begin
  select * into v_pedido from public.pedidos where id = new.pedido_id;
  select nombre into v_tienda from public.tiendas where id = new.tienda_id;

  -- Historial: quién y cuándo.
  insert into public.historial_estados (pedido_tienda_id, estado_anterior, estado_nuevo, usuario_id, nota)
  values (new.id, old.estado, new.estado, auth.uid(), new.motivo_cancelacion);

  -- Cancelación después del pago: devuelve stock y deja el reembolso pendiente.
  if new.estado = 'cancelado'
     and old.estado in ('pago_confirmado', 'en_preparacion', 'listo_para_recoleccion',
                        'listo_para_retiro', 'recolectado', 'en_camino') then
    update public.variantes v set stock = v.stock + i.cantidad
    from public.pedido_items i
    where i.pedido_tienda_id = new.id and i.variante_id = v.id;

    insert into public.reembolsos (pedido_tienda_id, monto, motivo)
    values (new.id, new.total, new.motivo_cancelacion);

    -- Si no quedan partes activas, la entrega se cancela.
    if not exists (select 1 from public.pedidos_tienda
                   where pedido_id = new.pedido_id and estado not in ('cancelado', 'rechazado')) then
      update public.envios set estado = 'fallido'
      where pedido_id = new.pedido_id and estado in ('pendiente', 'en_recoleccion');
    end if;
  end if;

  -- Aviso al comprador (base para correo y, más adelante, WhatsApp).
  insert into public.notificaciones (usuario_id, tipo, datos)
  values (v_pedido.comprador_id, 'estado_pedido',
          jsonb_build_object('pedido', v_pedido.numero, 'tienda', v_tienda, 'estado', new.estado));
  return null;
end $$;

create trigger pedidos_tienda_efectos
  after update of estado on public.pedidos_tienda
  for each row when (old.estado is distinct from new.estado)
  execute function public.tg_pedidos_tienda_efectos();

-- ----------------------------------------------------------------------------
-- 6. Logística: recolecciones y envíos
-- ----------------------------------------------------------------------------
create or replace function public.tg_recolecciones_control()
returns trigger language plpgsql as $$
declare
  es_logistica boolean := not public.es_usuario_final() or public.es_admin('logistica');
  estado_parte public.estado_pedido_tienda;
begin
  if not es_logistica then
    if public.cambio_fuera_de(to_jsonb(old), to_jsonb(new), array['estado', 'llegada_en']) then
      raise exception 'El repartidor solo puede registrar su llegada y el estado de la recolección';
    end if;
    if new.estado <> old.estado and not (old.estado = 'asignada' and new.estado in ('recolectada', 'fallida')) then
      raise exception 'No se puede pasar la recolección de "%" a "%"', old.estado, new.estado;
    end if;
  end if;

  if new.estado = 'recolectada' and old.estado <> 'recolectada' then
    select estado into estado_parte from public.pedidos_tienda where id = new.pedido_tienda_id;
    if estado_parte <> 'listo_para_recoleccion' then
      raise exception 'La tienda todavía no marcó su parte como lista (estado actual: %)', estado_parte;
    end if;
    new.llegada_en := coalesce(new.llegada_en, now());
    new.recolectado_en := now();
  end if;
  return new;
end $$;

create trigger recolecciones_control
  before update on public.recolecciones
  for each row execute function public.tg_recolecciones_control();

create or replace function public.tg_recolecciones_efectos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'recolectada' and old.estado <> 'recolectada' then
    update public.pedidos_tienda set estado = 'recolectado' where id = new.pedido_tienda_id;

    -- Cuando se recolectaron todas las partes activas, sale hacia el cliente.
    if not exists (
      select 1 from public.recolecciones r
      join public.pedidos_tienda pt on pt.id = r.pedido_tienda_id
      where r.envio_id = new.envio_id
        and pt.estado not in ('cancelado', 'rechazado')
        and r.estado <> 'recolectada'
    ) then
      update public.envios set estado = 'en_camino' where id = new.envio_id;
      update public.pedidos_tienda pt set estado = 'en_camino'
      from public.recolecciones r
      where r.envio_id = new.envio_id and r.pedido_tienda_id = pt.id and pt.estado = 'recolectado';
    end if;
  end if;
  return null;
end $$;

create trigger recolecciones_efectos
  after update of estado on public.recolecciones
  for each row execute function public.tg_recolecciones_efectos();

create or replace function public.tg_envios_control()
returns trigger language plpgsql as $$
declare es_logistica boolean := not public.es_usuario_final() or public.es_admin('logistica');
begin
  if not es_logistica then
    if public.cambio_fuera_de(to_jsonb(old), to_jsonb(new), array['estado', 'comprobante_entrega', 'entregado_en']) then
      raise exception 'El repartidor solo puede marcar la entrega';
    end if;
    if new.estado <> old.estado and not (old.estado = 'en_camino' and new.estado in ('entregado', 'fallido')) then
      raise exception 'No se puede pasar la entrega de "%" a "%"', old.estado, new.estado;
    end if;
  end if;

  if new.repartidor_id is not null and old.repartidor_id is null and new.estado = 'pendiente' then
    new.estado := 'en_recoleccion';
  end if;
  if new.estado = 'entregado' and old.estado <> 'entregado' then
    new.entregado_en := now();
  end if;
  return new;
end $$;

create trigger envios_control
  before update on public.envios
  for each row execute function public.tg_envios_control();

create or replace function public.tg_envios_efectos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.repartidor_id is distinct from old.repartidor_id then
    update public.recolecciones
    set repartidor_id = new.repartidor_id,
        estado = case when new.repartidor_id is null then 'pendiente'::public.estado_recoleccion
                      else 'asignada'::public.estado_recoleccion end
    where envio_id = new.id and estado in ('pendiente', 'asignada');
  end if;

  if new.estado = 'entregado' and old.estado <> 'entregado' then
    update public.pedidos_tienda set estado = 'entregado'
    where pedido_id = new.pedido_id and estado = 'en_camino';
  end if;
  return null;
end $$;

create trigger envios_efectos
  after update on public.envios
  for each row execute function public.tg_envios_efectos();

-- ----------------------------------------------------------------------------
-- 7. Preguntas: el cliente pregunta, el comercio responde
-- ----------------------------------------------------------------------------
create or replace function public.tg_preguntas_control()
returns trigger language plpgsql as $$
begin
  if public.es_usuario_final() and not public.es_admin('moderacion') then
    if tg_op = 'INSERT' then
      new.usuario_id := auth.uid();
      new.respuesta := null; new.respondida_por := null; new.respondida_en := null;
      new.visible := true;
    else
      if public.cambio_fuera_de(to_jsonb(old), to_jsonb(new),
           array['respuesta', 'respondida_por', 'respondida_en', 'visible']) then
        raise exception 'Una pregunta no se puede modificar después de enviada';
      end if;
      if not public.tiene_permiso(new.tienda_id, 'preguntas.responder') then
        raise exception 'No tenés permiso para responder preguntas';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.respuesta is distinct from old.respuesta then
    new.respondida_por := auth.uid();
    new.respondida_en := now();
  end if;
  return new;
end $$;

create trigger preguntas_control
  before insert or update on public.preguntas
  for each row execute function public.tg_preguntas_control();

-- Mensajes, reclamos y denuncias: el autor siempre es quien tiene la sesión.
create or replace function public.tg_autor_actual()
returns trigger language plpgsql as $$
begin
  if public.es_usuario_final() then
    if tg_table_name = 'mensajes_pedido' then new.autor_id := auth.uid();
    else new.usuario_id := auth.uid();
    end if;
  end if;
  return new;
end $$;

create trigger autor_actual before insert on public.mensajes_pedido
  for each row execute function public.tg_autor_actual();
create trigger autor_actual before insert on public.reclamos
  for each row execute function public.tg_autor_actual();
create trigger autor_actual before insert on public.denuncias
  for each row execute function public.tg_autor_actual();

-- ----------------------------------------------------------------------------
-- 8. Auditoría automática de cambios sensibles
-- ----------------------------------------------------------------------------
create or replace function public.tg_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.auditoria (actor_id, tienda_id, accion, entidad, entidad_id, antes, despues)
  values (
    auth.uid(),
    coalesce((fila ->> 'tienda_id')::uuid,
             case when tg_table_name = 'tiendas' then (fila ->> 'id')::uuid end),
    tg_op,
    tg_table_name,
    coalesce(fila ->> 'id', fila ->> 'clave', fila ->> 'rol_id'),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'planes', 'roles_plataforma', 'tiendas', 'suscripciones', 'miembros_tienda',
    'roles_tienda', 'roles_permisos', 'configuracion', 'tarifas_envio',
    'productos', 'variantes', 'repartidores']
  loop
    execute format(
      'create trigger auditar after insert or update or delete on public.%I
         for each row execute function public.tg_auditar()', t);
  end loop;
end $$;
