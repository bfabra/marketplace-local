-- ============================================================================
-- Operaciones de negocio que la aplicación llama como funciones (RPC).
-- Desde Next.js: supabase.rpc('crear_pedido', { p_direccion_id, p_tiendas_retiro })
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Crear el pedido a partir del carrito del usuario con sesión iniciada.
-- - Valida que cada producto siga publicado y con stock.
-- - Copia nombre y precio (el pedido no cambia si el producto cambia).
-- - Arma una parte por tienda y calcula el envío por localidad.
-- - Reserva el stock por unos minutos mientras el cliente paga.
-- p_tiendas_retiro: tiendas en las que el cliente prefiere retirar en el local.
-- ----------------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_direccion_id   uuid default null,
  p_tiendas_retiro uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario   uuid := auth.uid();
  v_carrito   uuid;
  v_pedido    uuid;
  v_dir       record;
  v_costo     numeric(12,2) := 0;
  v_hay_envio boolean;
  v_item      record;
  v_tienda    uuid;
  v_pt        uuid;
  v_minutos   integer := coalesce(public.config_int('minutos_reserva_stock'), 15);
begin
  if v_usuario is null then
    raise exception 'Iniciá sesión para comprar';
  end if;

  select id into v_carrito from public.carritos where usuario_id = v_usuario;
  if v_carrito is null or not exists (select 1 from public.carrito_items where carrito_id = v_carrito) then
    raise exception 'El carrito está vacío';
  end if;

  if cardinality(p_tiendas_retiro) > 0 and not public.config_bool('retiro_en_local_habilitado') then
    raise exception 'El retiro en el local no está disponible';
  end if;

  -- Bloquea las variantes del carrito para que dos compras no tomen la última unidad.
  perform 1 from public.variantes v
  join public.carrito_items ci on ci.variante_id = v.id
  where ci.carrito_id = v_carrito
  order by v.id
  for update of v;

  -- Valida cada ítem.
  for v_item in
    select ci.cantidad, v.id as variante_id, v.activa, p.nombre, p.estado as estado_producto,
           t.estado as estado_tienda, public.stock_disponible(v.id) as disponible
    from public.carrito_items ci
    join public.variantes v on v.id = ci.variante_id
    join public.productos p on p.id = v.producto_id
    join public.tiendas t on t.id = v.tienda_id
    where ci.carrito_id = v_carrito
  loop
    if v_item.estado_producto <> 'publicado' or v_item.estado_tienda <> 'activa' or not v_item.activa then
      raise exception '"%" ya no está disponible; quitalo del carrito', v_item.nombre;
    end if;
    if v_item.disponible < v_item.cantidad then
      raise exception 'Solo quedan % unidades de "%"', greatest(v_item.disponible, 0), v_item.nombre;
    end if;
  end loop;

  -- ¿Hace falta entrega a domicilio?
  select exists (
    select 1 from public.carrito_items ci join public.variantes v on v.id = ci.variante_id
    where ci.carrito_id = v_carrito and not (v.tienda_id = any (p_tiendas_retiro))
  ) into v_hay_envio;

  if v_hay_envio then
    select d.*, l.nombre as localidad, pr.nombre as provincia into v_dir
    from public.direcciones d
    join public.localidades l on l.id = d.localidad_id
    join public.provincias pr on pr.id = l.provincia_id
    where d.id = p_direccion_id and d.usuario_id = v_usuario;
    if not found then
      raise exception 'Elegí una dirección de entrega';
    end if;
    select costo into v_costo from public.tarifas_envio
    where localidad_id = v_dir.localidad_id and activa;
    if not found then
      raise exception 'Todavía no hacemos entregas en %', v_dir.localidad;
    end if;
  end if;

  insert into public.pedidos (comprador_id, costo_envio, direccion_envio)
  values (v_usuario, v_costo,
          case when v_hay_envio then jsonb_build_object(
            'calle', v_dir.calle, 'numero', v_dir.numero, 'piso_depto', v_dir.piso_depto,
            'localidad_id', v_dir.localidad_id, 'localidad', v_dir.localidad,
            'provincia', v_dir.provincia, 'codigo_postal', v_dir.codigo_postal,
            'referencias', v_dir.referencias) end)
  returning id into v_pedido;

  -- Una parte por tienda.
  for v_tienda in
    select distinct v.tienda_id from public.carrito_items ci
    join public.variantes v on v.id = ci.variante_id
    where ci.carrito_id = v_carrito
  loop
    insert into public.pedidos_tienda (pedido_id, tienda_id, modalidad)
    values (v_pedido, v_tienda,
            case when v_tienda = any (p_tiendas_retiro) then 'retiro_en_local'
                 else 'entrega_plataforma' end::public.modalidad_entrega)
    returning id into v_pt;

    insert into public.pedido_items
      (pedido_tienda_id, tienda_id, variante_id, nombre_producto, descripcion_variante,
       precio_unitario, cantidad, subtotal)
    select v_pt, v_tienda, v.id, p.nombre,
           (select string_agg(a.nombre || ': ' || o.valor, ' / ' order by a.nombre)
              from public.variante_opciones vo
              join public.atributos a on a.id = vo.atributo_id
              join public.atributo_opciones o on o.id = vo.opcion_id
             where vo.variante_id = v.id),
           coalesce(v.precio_oferta, v.precio),
           ci.cantidad,
           coalesce(v.precio_oferta, v.precio) * ci.cantidad
    from public.carrito_items ci
    join public.variantes v on v.id = ci.variante_id
    join public.productos p on p.id = v.producto_id
    where ci.carrito_id = v_carrito and v.tienda_id = v_tienda;

    -- Subtotal y comisión según la categoría de cada producto.
    update public.pedidos_tienda pt set
      subtotal = x.subtotal,
      total    = x.subtotal,
      comision = x.comision
    from (
      select sum(i.subtotal) as subtotal,
             round(sum(i.subtotal * c.comision_pct / 100), 2) as comision
      from public.pedido_items i
      join public.variantes v on v.id = i.variante_id
      join public.productos p on p.id = v.producto_id
      join public.categorias c on c.id = p.categoria_id
      where i.pedido_tienda_id = v_pt
    ) x
    where pt.id = v_pt;
  end loop;

  update public.pedidos set
    subtotal = (select sum(subtotal) from public.pedidos_tienda where pedido_id = v_pedido),
    total    = (select sum(subtotal) from public.pedidos_tienda where pedido_id = v_pedido) + v_costo
  where id = v_pedido;

  insert into public.reservas_stock (variante_id, pedido_id, cantidad, expira_en)
  select ci.variante_id, v_pedido, ci.cantidad, now() + make_interval(mins => v_minutos)
  from public.carrito_items ci where ci.carrito_id = v_carrito;

  delete from public.carrito_items where carrito_id = v_carrito;
  return v_pedido;
end $$;

-- ----------------------------------------------------------------------------
-- Confirmar el pago. La llama SOLO el servidor, al recibir el aviso firmado
-- (webhook) de Mercado Pago. Si llega dos veces, la segunda no hace nada.
-- Devuelve las partes que se cancelaron por falta de stock (hay que reembolsarlas).
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
  if v_pedido.estado_pago <> 'pendiente' then return; end if;   -- aviso repetido

  insert into public.pagos (pedido_id, mp_payment_id, monto, comision_marketplace, estado, respuesta_mp)
  values (p_pedido, p_mp_payment_id, p_monto,
          (select coalesce(sum(comision), 0) from public.pedidos_tienda where pedido_id = p_pedido),
          'aprobado', p_respuesta);

  update public.pedidos set estado_pago = 'aprobado' where id = p_pedido;

  for v_pt in select * from public.pedidos_tienda where pedido_id = p_pedido and estado = 'pendiente' loop
    -- Bloquea y revisa el stock de toda la parte antes de descontar.
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

  -- Una sola entrega para toda la compra, con una recolección por tienda.
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

-- El pago fue rechazado: libera el stock reservado.
create or replace function public.rechazar_pago(p_pedido uuid, p_respuesta jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.pedidos set estado_pago = 'rechazado'
  where id = p_pedido and estado_pago = 'pendiente';
  if not found then return; end if;
  insert into public.pagos (pedido_id, monto, estado, respuesta_mp)
  select id, total, 'rechazado', p_respuesta from public.pedidos where id = p_pedido;
  update public.pedidos_tienda set estado = 'rechazado'
  where pedido_id = p_pedido and estado = 'pendiente';
  delete from public.reservas_stock where pedido_id = p_pedido;
end $$;

-- ----------------------------------------------------------------------------
-- Tareas programadas (en Supabase: pg_cron, ver la guía)
-- ----------------------------------------------------------------------------
create or replace function public.liberar_reservas_vencidas()
returns integer language sql security definer set search_path = '' as $$
  with borradas as (delete from public.reservas_stock where expira_en <= now() returning 1)
  select count(*)::integer from borradas
$$;

create or replace function public.procesar_vencimientos_suscripciones()
returns void language plpgsql security definer set search_path = '' as $$
declare v_dias integer := coalesce(public.config_int('dias_gracia'), 7);
begin
  update public.suscripciones
  set estado = 'en_gracia', gracia_hasta = fin_periodo + make_interval(days => v_dias)
  where estado = 'activa' and fin_periodo is not null and fin_periodo < now();

  update public.suscripciones set estado = 'vencida'
  where estado = 'en_gracia' and gracia_hasta < now();
end $$;

-- ----------------------------------------------------------------------------
-- Invitaciones de empleados
-- ----------------------------------------------------------------------------
-- La crea el dueño; devuelve el código que se envía por correo (no se guarda).
create or replace function public.crear_invitacion(p_tienda uuid, p_email text, p_rol uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.es_duenio(p_tienda) then
    raise exception 'Solo el dueño puede invitar empleados';
  end if;
  if not exists (select 1 from public.roles_tienda
                 where id = p_rol and (tienda_id is null or tienda_id = p_tienda)) then
    raise exception 'Rol inválido para esta tienda';
  end if;
  insert into public.invitaciones (tienda_id, email, rol_id, token_hash, invitado_por, expira_en)
  values (p_tienda, lower(trim(p_email)), p_rol, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
          auth.uid(), now() + make_interval(days => coalesce(public.config_int('dias_vencimiento_invitacion'), 7)));
  return v_token;
end $$;

-- La acepta el invitado con su sesión iniciada. Respeta el límite del plan.
create or replace function public.aceptar_invitacion(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.invitaciones;
  v_email text;
begin
  select * into v_inv from public.invitaciones
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;

  if not found or v_inv.estado <> 'pendiente' then
    raise exception 'La invitación no es válida';
  end if;
  if v_inv.expira_en < now() then
    update public.invitaciones set estado = 'vencida' where id = v_inv.id;
    raise exception 'La invitación venció; pedile al dueño una nueva';
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from v_inv.email then
    raise exception 'Esta invitación es para otro correo';
  end if;

  insert into public.miembros_tienda (tienda_id, usuario_id, rol_id, estado, invitado_por)
  values (v_inv.tienda_id, auth.uid(), v_inv.rol_id, 'activo', v_inv.invitado_por)
  on conflict (tienda_id, usuario_id)
  do update set rol_id = excluded.rol_id, estado = 'activo';

  update public.invitaciones set estado = 'aceptada' where id = v_inv.id;
  return v_inv.tienda_id;
end $$;

-- ----------------------------------------------------------------------------
-- Botón de Arrepentimiento / Botón de Baja (Disposición 954/2025).
-- Funciona sin iniciar sesión y devuelve el código de gestión.
-- ----------------------------------------------------------------------------
create or replace function public.enviar_solicitud_consumidor(
  p_tipo          public.tipo_solicitud_consumidor,
  p_nombre        text,
  p_email         text,
  p_numero_pedido text default null,
  p_detalle       text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text;
begin
  if coalesce(trim(p_nombre), '') = '' or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Completá tu nombre y un correo válido';
  end if;
  insert into public.solicitudes_consumidor (tipo, nombre, email, numero_pedido, detalle)
  values (p_tipo, trim(p_nombre), lower(trim(p_email)), p_numero_pedido, p_detalle)
  returning codigo_gestion into v_codigo;
  return v_codigo;
end $$;

-- ----------------------------------------------------------------------------
-- Búsqueda del marketplace: texto (sin acentos, tolera errores de tipeo),
-- localidad, categoría (incluye subcategorías), precio y opciones (talle, color…)
-- ----------------------------------------------------------------------------
create or replace function public.buscar_productos(
  p_texto        text    default null,
  p_localidad    uuid    default null,
  p_categoria    uuid    default null,
  p_precio_min   numeric default null,
  p_precio_max   numeric default null,
  p_opciones     uuid[]  default null,
  p_limite       integer default 24,
  p_desde        integer default 0)
returns table (
  producto_id   uuid,
  nombre        text,
  slug          text,
  tienda_id     uuid,
  tienda_nombre text,
  tienda_slug   text,
  precio_desde  numeric,
  sin_stock     boolean,
  relevancia    real)
language sql stable set search_path = '' as $$
  with q as (
    select nullif(trim(p_texto), '') as texto,
           public.f_unaccent(lower(nullif(trim(p_texto), ''))) as texto_norm
  ), cat as (
    select ruta from public.categorias where id = p_categoria
  )
  select p.id, p.nombre, p.slug, t.id, t.nombre, t.slug,
         min(coalesce(v.precio_oferta, v.precio)) as precio_desde,
         coalesce(sum(v.stock) filter (where v.activa), 0) = 0 as sin_stock,
         (case when q.texto is null then 0
               else ts_rank(p.texto_busqueda, websearch_to_tsquery('spanish', q.texto_norm))
                    + extensions.word_similarity(q.texto_norm, public.f_unaccent(lower(p.nombre)))
          end)::real as relevancia
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id and t.estado = 'activa'
  join public.categorias c on c.id = p.categoria_id
  join public.variantes v on v.producto_id = p.id and v.activa
  cross join q
  where p.estado = 'publicado'
    and (q.texto is null
         or p.texto_busqueda @@ websearch_to_tsquery('spanish', q.texto_norm)
         or extensions.word_similarity(q.texto_norm, public.f_unaccent(lower(p.nombre))) >= 0.5)
    and (p_localidad is null or t.localidad_id = p_localidad)
    and (p_categoria is null or c.ruta like (select ruta from cat) || '%')
    and (p_opciones is null or not exists (
          select 1 from unnest(p_opciones) as o(id)
          where not exists (select 1 from public.variante_opciones vo
                            join public.variantes v2 on v2.id = vo.variante_id
                            where v2.producto_id = p.id and vo.opcion_id = o.id)
            and not exists (select 1 from public.producto_atributos pa
                            where pa.producto_id = p.id and pa.opcion_id = o.id)))
  group by p.id, t.id, q.texto, q.texto_norm
  having (p_precio_min is null or min(coalesce(v.precio_oferta, v.precio)) >= p_precio_min)
     and (p_precio_max is null or min(coalesce(v.precio_oferta, v.precio)) <= p_precio_max)
  order by relevancia desc, p.publicado_en desc
  limit p_limite offset p_desde
$$;

-- Atributos de una categoría, incluidos los heredados de sus categorías padre.
create or replace function public.atributos_de_categoria(p_categoria uuid)
returns table (atributo_id uuid, nombre text, tipo public.tipo_atributo, filtrable boolean,
               obligatorio boolean, define_variante boolean)
language sql stable set search_path = '' as $$
  select distinct on (a.id) a.id, a.nombre, a.tipo, a.filtrable, ca.obligatorio, ca.define_variante
  from public.categorias c
  join public.categorias padre on c.ruta like padre.ruta || '%'
  join public.categorias_atributos ca on ca.categoria_id = padre.id
  join public.atributos a on a.id = ca.atributo_id
  where c.id = p_categoria
  order by a.id, length(padre.ruta) desc
$$;

-- ----------------------------------------------------------------------------
-- Quién puede llamar a cada función
-- ----------------------------------------------------------------------------
revoke execute on function public.confirmar_pago(uuid, text, numeric, jsonb) from public, anon, authenticated;
revoke execute on function public.rechazar_pago(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.liberar_reservas_vencidas() from public, anon, authenticated;
revoke execute on function public.procesar_vencimientos_suscripciones() from public, anon, authenticated;
revoke execute on function public.aplicar_limites_plan(uuid) from public, anon, authenticated;
revoke execute on function public.crear_pedido(uuid, uuid[]) from public, anon;
revoke execute on function public.crear_invitacion(uuid, text, uuid) from public, anon;
revoke execute on function public.aceptar_invitacion(text) from public, anon;
grant execute on function public.confirmar_pago(uuid, text, numeric, jsonb) to service_role;
grant execute on function public.rechazar_pago(uuid, jsonb) to service_role;
grant execute on function public.liberar_reservas_vencidas() to service_role;
grant execute on function public.procesar_vencimientos_suscripciones() to service_role;
grant execute on function public.crear_pedido(uuid, uuid[]) to authenticated;
grant execute on function public.crear_invitacion(uuid, text, uuid) to authenticated;
grant execute on function public.aceptar_invitacion(text) to authenticated;
grant execute on function public.enviar_solicitud_consumidor(public.tipo_solicitud_consumidor, text, text, text, text) to anon, authenticated;
