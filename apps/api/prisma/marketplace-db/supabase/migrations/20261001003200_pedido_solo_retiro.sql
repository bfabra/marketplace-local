-- ============================================================================
-- Compra con retiro en el local en todas las tiendas.
-- crear_pedido leía los campos de la dirección aunque no hiciera falta envío,
-- y PL/pgSQL falla con un registro sin asignar. Ahora la dirección se arma
-- solo cuando hay entrega a domicilio. El resto de la función no cambia.
-- ============================================================================

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
  v_envio     jsonb;
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
    v_envio := jsonb_build_object(
      'calle', v_dir.calle, 'numero', v_dir.numero, 'piso_depto', v_dir.piso_depto,
      'localidad_id', v_dir.localidad_id, 'localidad', v_dir.localidad,
      'provincia', v_dir.provincia, 'codigo_postal', v_dir.codigo_postal,
      'referencias', v_dir.referencias);
  end if;

  insert into public.pedidos (comprador_id, costo_envio, direccion_envio)
  values (v_usuario, v_costo, v_envio)
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
