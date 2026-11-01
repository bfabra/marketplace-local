-- ============================================================================
-- Paquetes del API: carrito (pkg_carrito), compras del cliente (pkg_compras)
-- y pedidos de cada tienda (pkg_ventas). Convenciones en ..._1800.
--
-- Sin sesión, el carrito vive en el navegador: vista_previa arma la pantalla
-- con los datos actuales de cada producto. Al ingresar, unir lo pasa a la base.
-- El pedido lo arma public.crear_pedido (reserva el stock y vacía el carrito);
-- el pago lo confirma el servidor con public.confirmar_pago.
-- ============================================================================

create schema if not exists pkg_carrito;
comment on schema pkg_carrito is 'Carrito de compras. Solo lo llama el API.';
create schema if not exists pkg_compras;
comment on schema pkg_compras is 'Direcciones, pedidos y pago del cliente. Solo lo llama el API.';
create schema if not exists pkg_ventas;
comment on schema pkg_ventas is 'Pedidos recibidos por cada tienda. Solo lo llama el API.';

-- ----------------------------------------------------------------------------
-- pkg_carrito: auxiliares
-- ----------------------------------------------------------------------------

-- Arma la pantalla del carrito a partir de [{variante_id, cantidad}], agrupado
-- por tienda y con el precio y stock de hoy.
-- security definer: un producto pausado no se ve con RLS, pero en el carrito
-- tiene que aparecer como "ya no está a la venta" para que el cliente lo quite.
create or replace function pkg_carrito._armar(p_items jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  with pedido as (
    select (e.item ->> 'variante_id')::uuid as variante_id,
           sum((e.item ->> 'cantidad')::integer)::integer as cantidad,
           min(e.n) as n
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality e(item, n)
    group by 1
  ), base as (
    select p.n, p.cantidad, v.id as variante_id, v.tienda_id, pr.nombre, pr.slug,
           coalesce(v.precio_oferta, v.precio) as precio, v.precio as precio_lista,
           greatest(public.stock_disponible(v.id), 0) as disponibles,
           pr.estado = 'publicado' and t.estado = 'activa' and v.activa as a_la_venta,
           pkg_catalogo.imagen_principal(pr.id) as imagen,
           (select string_agg(a.nombre || ': ' || o.valor, ' / ' order by a.nombre)
              from public.variante_opciones vo
              join public.atributos a on a.id = vo.atributo_id
              join public.atributo_opciones o on o.id = vo.opcion_id
             where vo.variante_id = v.id) as variante
    from pedido p
    join public.variantes v on v.id = p.variante_id
    join public.productos pr on pr.id = v.producto_id
    join public.tiendas t on t.id = v.tienda_id
  ), items as (
    select b.*,
           b.a_la_venta and b.cantidad <= b.disponibles as ok,
           case when not b.a_la_venta then 'Ya no está a la venta'
                when b.disponibles = 0 then 'Sin stock'
                when b.cantidad > b.disponibles then format('Solo quedan %s unidades', b.disponibles)
           end as aviso
    from base b
  ), por_tienda as (
    select min(i.n) as n,
           sum(i.cantidad) as cantidad,
           sum(i.precio * i.cantidad) filter (where i.ok) as subtotal,
           bool_and(i.ok) as ok,
           jsonb_build_object(
             'id', t.id,
             'nombre', t.nombre,
             'slug', t.slug,
             'direccion', t.direccion,
             'localidad', l.nombre,
             'subtotal', coalesce(sum(i.precio * i.cantidad) filter (where i.ok), 0),
             'items', jsonb_agg(jsonb_build_object(
               'variante_id', i.variante_id,
               'cantidad', i.cantidad,
               'nombre', i.nombre,
               'slug', i.slug,
               'imagen', i.imagen,
               'variante', i.variante,
               'precio', i.precio,
               'precio_lista', i.precio_lista,
               'disponibles', i.disponibles,
               'ok', i.ok,
               'aviso', i.aviso
             ) order by i.n)
           ) as tienda
    from items i
    join public.tiendas t on t.id = i.tienda_id
    join public.localidades l on l.id = t.localidad_id
    group by t.id, l.nombre
  )
  select jsonb_build_object(
    'tiendas', coalesce(jsonb_agg(pt.tienda order by pt.n), '[]'::jsonb),
    'cantidad', coalesce(sum(pt.cantidad), 0),
    'subtotal', coalesce(sum(pt.subtotal), 0),
    'listo', coalesce(bool_and(pt.ok), false)
  )
  from por_tienda pt
$$;

-- Unidades que se pueden comprar de una variante, o null si no está a la venta.
create or replace function pkg_carrito._disponibles(p_variante uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(public.stock_disponible(v.id), 0)
  from public.variantes v
  join public.productos p on p.id = v.producto_id
  join public.tiendas t on t.id = v.tienda_id
  where v.id = p_variante and v.activa and p.estado = 'publicado' and t.estado = 'activa'
$$;

-- Carrito del usuario con sesión iniciada; lo crea si todavía no tiene.
create or replace function pkg_carrito._mi_carrito()
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para guardar tu carrito' using errcode = 'TC403';
  end if;
  insert into public.carritos (usuario_id) values (auth.uid())
  on conflict (usuario_id) do nothing;
  select id into v_id from public.carritos where usuario_id = auth.uid();
  return v_id;
end $$;

-- ----------------------------------------------------------------------------
-- pkg_carrito: consultas y cambios
-- ----------------------------------------------------------------------------

-- Carrito del navegador (sin sesión). Máximo 100 productos distintos.
create or replace function pkg_carrito.vista_previa(p_items jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'El carrito puede tener hasta 100 productos distintos' using errcode = 'TC400';
  end if;
  return pkg_carrito._armar(p_items);
end $$;

create or replace function pkg_carrito.ver()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select pkg_carrito._armar(coalesce((
    select jsonb_agg(jsonb_build_object('variante_id', ci.variante_id, 'cantidad', ci.cantidad)
                     order by ci.creado_en, ci.id)
    from public.carrito_items ci
    join public.carritos c on c.id = ci.carrito_id
    where c.usuario_id = auth.uid()
  ), '[]'::jsonb))
$$;

create or replace function pkg_carrito.agregar(p_variante uuid, p_cantidad integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_disp    integer := pkg_carrito._disponibles(p_variante);
  v_carrito uuid;
  v_actual  integer;
begin
  if v_disp is null then
    raise exception 'Este producto ya no está a la venta' using errcode = 'TC404';
  end if;
  if coalesce(p_cantidad, 0) < 1 then
    raise exception 'La cantidad tiene que ser al menos 1' using errcode = 'TC400';
  end if;

  v_carrito := pkg_carrito._mi_carrito();
  select cantidad into v_actual from public.carrito_items
  where carrito_id = v_carrito and variante_id = p_variante;
  v_actual := coalesce(v_actual, 0);

  if v_actual + p_cantidad > v_disp then
    if v_disp = 0 then
      raise exception 'No queda stock de este producto' using errcode = 'TC409';
    elsif v_actual > 0 then
      raise exception 'Solo quedan % unidades y ya tenés % en el carrito', v_disp, v_actual using errcode = 'TC409';
    else
      raise exception 'Solo quedan % unidades', v_disp using errcode = 'TC409';
    end if;
  end if;

  insert into public.carrito_items (carrito_id, variante_id, cantidad)
  values (v_carrito, p_variante, v_actual + p_cantidad)
  on conflict (carrito_id, variante_id)
  do update set cantidad = excluded.cantidad, actualizado_en = now();
  return pkg_carrito.ver();
end $$;

create or replace function pkg_carrito.cambiar_cantidad(p_variante uuid, p_cantidad integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_disp integer := pkg_carrito._disponibles(p_variante);
begin
  if coalesce(p_cantidad, 0) < 1 then
    raise exception 'La cantidad tiene que ser al menos 1' using errcode = 'TC400';
  end if;
  if v_disp is null then
    raise exception 'Este producto ya no está a la venta: quitalo del carrito' using errcode = 'TC409';
  end if;
  if p_cantidad > v_disp then
    raise exception 'Solo quedan % unidades', v_disp using errcode = 'TC409';
  end if;

  update public.carrito_items ci set cantidad = p_cantidad, actualizado_en = now()
  from public.carritos c
  where c.id = ci.carrito_id and c.usuario_id = auth.uid() and ci.variante_id = p_variante;
  if not found then
    raise exception 'Ese producto no está en tu carrito' using errcode = 'TC404';
  end if;
  return pkg_carrito.ver();
end $$;

create or replace function pkg_carrito.quitar(p_variante uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  delete from public.carrito_items ci
  using public.carritos c
  where c.id = ci.carrito_id and c.usuario_id = auth.uid() and ci.variante_id = p_variante;
  select pkg_carrito.ver();
$$;

-- Suma el carrito del navegador al guardado. Lo que ya no está a la venta se
-- descarta y cada cantidad se ajusta al stock disponible.
create or replace function pkg_carrito.unir(p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_carrito uuid;
  v_item    record;
  v_disp    integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'El carrito puede tener hasta 100 productos distintos' using errcode = 'TC400';
  end if;
  v_carrito := pkg_carrito._mi_carrito();

  for v_item in
    select (e ->> 'variante_id')::uuid as variante_id, sum((e ->> 'cantidad')::integer)::integer as cantidad
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    v_disp := pkg_carrito._disponibles(v_item.variante_id);
    continue when coalesce(v_disp, 0) = 0 or v_item.cantidad < 1;

    insert into public.carrito_items (carrito_id, variante_id, cantidad)
    values (v_carrito, v_item.variante_id, least(v_item.cantidad, v_disp))
    on conflict (carrito_id, variante_id)
    do update set cantidad = least(public.carrito_items.cantidad + excluded.cantidad, v_disp),
                  actualizado_en = now();
  end loop;
  return pkg_carrito.ver();
end $$;

-- ----------------------------------------------------------------------------
-- pkg_compras: direcciones
-- ----------------------------------------------------------------------------

create or replace function pkg_compras.direcciones()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'alias', d.alias,
           'calle', d.calle,
           'numero', d.numero,
           'piso_depto', d.piso_depto,
           'localidad', jsonb_build_object('id', l.id, 'nombre', l.nombre, 'provincia', pr.nombre),
           'codigo_postal', d.codigo_postal,
           'referencias', d.referencias,
           'es_principal', d.es_principal,
           'costo_envio', te.costo
         ) order by d.es_principal desc, d.creado_en), '[]'::jsonb)
  from public.direcciones d
  join public.localidades l on l.id = d.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  left join public.tarifas_envio te on te.localidad_id = d.localidad_id and te.activa
  where d.usuario_id = auth.uid()
$$;

-- p_id null: dirección nueva. La primera queda como principal.
create or replace function pkg_compras.guardar_direccion(
  p_id           uuid,
  p_alias        text,
  p_calle        text,
  p_numero       text,
  p_piso_depto   text,
  p_localidad    uuid,
  p_codigo_postal text,
  p_referencias  text,
  p_principal    boolean)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id        uuid := p_id;
  v_principal boolean := coalesce(p_principal, false)
                         or not exists (select 1 from public.direcciones
                                        where usuario_id = auth.uid() and id is distinct from p_id);
begin
  if coalesce(trim(p_calle), '') = '' or coalesce(trim(p_numero), '') = '' then
    raise exception 'Completá la calle y el número' using errcode = 'TC400';
  end if;
  if not exists (select 1 from public.localidades where id = p_localidad and activa) then
    raise exception 'Elegí una localidad de la lista' using errcode = 'TC400';
  end if;

  if v_principal then
    update public.direcciones set es_principal = false
    where usuario_id = auth.uid() and es_principal and id is distinct from p_id;
  end if;

  if p_id is null then
    insert into public.direcciones
      (usuario_id, alias, calle, numero, piso_depto, localidad_id, codigo_postal, referencias, es_principal)
    values (auth.uid(), nullif(trim(p_alias), ''), trim(p_calle), trim(p_numero), nullif(trim(p_piso_depto), ''),
            p_localidad, nullif(trim(p_codigo_postal), ''), nullif(trim(p_referencias), ''), v_principal)
    returning id into v_id;
  else
    update public.direcciones set
      alias = nullif(trim(p_alias), ''),
      calle = trim(p_calle),
      numero = trim(p_numero),
      piso_depto = nullif(trim(p_piso_depto), ''),
      localidad_id = p_localidad,
      codigo_postal = nullif(trim(p_codigo_postal), ''),
      referencias = nullif(trim(p_referencias), ''),
      es_principal = v_principal or es_principal,
      actualizado_en = now()
    where id = p_id and usuario_id = auth.uid();
    if not found then
      raise exception 'No encontramos esa dirección' using errcode = 'TC404';
    end if;
  end if;
  return v_id;
end $$;

-- Si se borra la principal, pasa a serlo la más reciente.
create or replace function pkg_compras.borrar_direccion(p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_era_principal boolean;
begin
  delete from public.direcciones where id = p_id and usuario_id = auth.uid()
  returning es_principal into v_era_principal;
  if not found then
    raise exception 'No encontramos esa dirección' using errcode = 'TC404';
  end if;
  if v_era_principal then
    update public.direcciones set es_principal = true
    where id = (select id from public.direcciones where usuario_id = auth.uid()
                order by creado_en desc limit 1);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- pkg_compras: pedidos
-- ----------------------------------------------------------------------------

-- Todo lo que necesita la pantalla de checkout, en un solo viaje.
create or replace function pkg_compras.checkout()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'carrito', pkg_carrito.ver(),
    'direcciones', pkg_compras.direcciones(),
    'retiroHabilitado', public.config_bool('retiro_en_local_habilitado')
  )
$$;

create or replace function pkg_compras.crear_pedido(p_direccion uuid, p_tiendas_retiro uuid[])
returns uuid language sql security invoker set search_path = '' as $$
  select public.crear_pedido(p_direccion, coalesce(p_tiendas_retiro, '{}'))
$$;

-- Datos de la tienda de una parte del pedido, para su comprador.
-- security definer: si la tienda dejó de estar activa, RLS ya no la muestra.
create or replace function pkg_compras._tienda(p_pt uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nombre', t.nombre, 'slug', t.slug, 'direccion', t.direccion,
                            'localidad', l.nombre, 'telefono', t.telefono)
  from public.pedidos_tienda pt
  join public.tiendas t on t.id = pt.tienda_id
  join public.localidades l on l.id = t.localidad_id
  where pt.id = p_pt and public.es_comprador(pt.pedido_id)
$$;

-- Hasta cuándo está reservado el stock de un pedido sin pagar.
create or replace function pkg_compras._reserva_hasta(p_pedido uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select min(r.expira_en) from public.reservas_stock r
  where r.pedido_id = p_pedido and public.es_comprador(p_pedido)
$$;

create or replace function pkg_compras.mis_pedidos()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'numero', p.numero,
           'total', p.total,
           'estado_pago', p.estado_pago,
           'creado_en', p.creado_en,
           'unidades', (select coalesce(sum(i.cantidad), 0) from public.pedido_items i
                        join public.pedidos_tienda pt on pt.id = i.pedido_tienda_id
                        where pt.pedido_id = p.id),
           'partes', (select jsonb_agg(jsonb_build_object(
                               'tienda', pkg_compras._tienda(pt.id) ->> 'nombre',
                               'estado', pt.estado,
                               'modalidad', pt.modalidad
                             ) order by pt.creado_en)
                      from public.pedidos_tienda pt where pt.pedido_id = p.id)
         ) order by p.creado_en desc), '[]'::jsonb)
  from public.pedidos p
  where p.comprador_id = auth.uid()
$$;

create or replace function pkg_compras.pedido(p_pedido uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'numero', p.numero,
    'estado_pago', p.estado_pago,
    'subtotal', p.subtotal,
    'costo_envio', p.costo_envio,
    'total', p.total,
    'direccion_envio', p.direccion_envio,
    'creado_en', p.creado_en,
    'reservaHasta', pkg_compras._reserva_hasta(p.id),
    'partes', (
      select jsonb_agg(jsonb_build_object(
               'id', pt.id,
               'tienda', pkg_compras._tienda(pt.id),
               'modalidad', pt.modalidad,
               'estado', pt.estado,
               'subtotal', pt.subtotal,
               'motivo_cancelacion', pt.motivo_cancelacion,
               'items', (select jsonb_agg(jsonb_build_object(
                                  'nombre', i.nombre_producto,
                                  'variante', i.descripcion_variante,
                                  'precio', i.precio_unitario,
                                  'cantidad', i.cantidad,
                                  'subtotal', i.subtotal
                                ) order by i.creado_en, i.id)
                         from public.pedido_items i where i.pedido_tienda_id = pt.id),
               'historial', (select jsonb_agg(jsonb_build_object('estado', h.estado_nuevo, 'fecha', h.creado_en)
                                              order by h.creado_en)
                             from public.historial_estados h where h.pedido_tienda_id = pt.id)
             ) order by pt.creado_en)
      from public.pedidos_tienda pt where pt.pedido_id = p.id
    )
  )
  from public.pedidos p
  where p.id = p_pedido and p.comprador_id = auth.uid()
$$;

-- Pago simulado (solo desarrollo). Lo llama el servidor, nunca el navegador.
-- Aprobado: confirma el pago por el total, como lo haría el aviso de Mercado Pago.
-- Rechazado: libera el stock y devuelve los productos al carrito.
create or replace function pkg_compras.simular_pago(p_usuario uuid, p_pedido uuid, p_aprobado boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_pedido     public.pedidos;
  v_canceladas integer := 0;
  v_carrito    uuid;
begin
  select * into v_pedido from public.pedidos
  where id = p_pedido and comprador_id = p_usuario for update;
  if not found then
    raise exception 'No encontramos ese pedido' using errcode = 'TC404';
  end if;
  if v_pedido.estado_pago <> 'pendiente' then
    raise exception 'Este pedido ya no está esperando el pago' using errcode = 'TC409';
  end if;

  if p_aprobado then
    select count(*) filter (where c.cancelada_sin_stock) into v_canceladas
    from public.confirmar_pago(p_pedido, 'SIMULADO-' || gen_random_uuid(), v_pedido.total,
                               jsonb_build_object('simulado', true)) c;
  else
    perform public.rechazar_pago(p_pedido, jsonb_build_object('simulado', true));

    insert into public.carritos (usuario_id) values (p_usuario)
    on conflict (usuario_id) do nothing;
    select id into v_carrito from public.carritos where usuario_id = p_usuario;

    insert into public.carrito_items (carrito_id, variante_id, cantidad)
    select v_carrito, i.variante_id, sum(i.cantidad)
    from public.pedido_items i
    join public.pedidos_tienda pt on pt.id = i.pedido_tienda_id
    where pt.pedido_id = p_pedido and i.variante_id is not null
    group by i.variante_id
    on conflict (carrito_id, variante_id)
    do update set cantidad = public.carrito_items.cantidad + excluded.cantidad, actualizado_en = now();
  end if;

  return jsonb_build_object(
    'estado_pago', (select estado_pago from public.pedidos where id = p_pedido),
    'partesSinStock', v_canceladas
  );
end $$;

-- ----------------------------------------------------------------------------
-- pkg_ventas: pedidos de una tienda
-- ----------------------------------------------------------------------------

create or replace function pkg_ventas._exigir(p_tienda uuid, p_permiso text)
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.tiene_permiso(p_tienda, p_permiso) then
    raise exception 'No tenés permiso para %',
      case when p_permiso = 'pedidos.ver' then 'ver los pedidos de esta tienda'
           else 'gestionar los pedidos de esta tienda' end
      using errcode = 'TC403';
  end if;
end $$;

-- Una parte del pedido como la ve el comercio. El comprador se muestra solo
-- con el permiso clientes.ver (lo decide RLS sobre perfiles).
create or replace function pkg_ventas._parte(p_pt uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', pt.id,
    'numero', p.numero,
    'creado_en', pt.creado_en,
    'estado', pt.estado,
    'modalidad', pt.modalidad,
    'subtotal', pt.subtotal,
    'comision', pt.comision,
    'motivo_cancelacion', pt.motivo_cancelacion,
    'listo_en', pt.listo_en,
    'comprador', case when pe.id is not null then jsonb_build_object(
                   'nombre', nullif(concat_ws(' ', pe.nombre, pe.apellido), ''),
                   'telefono', pe.telefono) end,
    'items', (select jsonb_agg(jsonb_build_object(
                       'nombre', i.nombre_producto,
                       'variante', i.descripcion_variante,
                       'precio', i.precio_unitario,
                       'cantidad', i.cantidad,
                       'subtotal', i.subtotal
                     ) order by i.creado_en, i.id)
              from public.pedido_items i where i.pedido_tienda_id = pt.id),
    'acciones', case when public.tiene_permiso(pt.tienda_id, 'pedidos.gestionar') then coalesce((
                  select jsonb_agg(e order by e)
                  from unnest(enum_range(null::public.estado_pedido_tienda)) e
                  where public.transicion_pedido_tienda(pt.estado, e, pt.modalidad) = 'comercio'
                ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.pedidos_tienda pt
  join public.pedidos p on p.id = pt.pedido_id
  left join public.perfiles pe on pe.id = p.comprador_id
  where pt.id = p_pt
$$;

-- Solo los pedidos pagados: los que esperan el pago o fueron rechazados no
-- le sirven al comercio.
create or replace function pkg_ventas.listar(p_tienda uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  perform pkg_ventas._exigir(p_tienda, 'pedidos.ver');
  return coalesce((
    select jsonb_agg(pkg_ventas._parte(x.id) order by x.creado_en desc)
    from (select pt.id, pt.creado_en from public.pedidos_tienda pt
          where pt.tienda_id = p_tienda and pt.estado not in ('pendiente', 'rechazado')
          order by pt.creado_en desc limit 200) x
  ), '[]'::jsonb);
end $$;

-- La base valida la transición (trigger pedidos_tienda_control); acá se
-- devuelven mensajes claros antes de intentarlo.
create or replace function pkg_ventas.cambiar_estado(
  p_tienda uuid,
  p_pt     uuid,
  p_estado public.estado_pedido_tienda,
  p_motivo text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_pt public.pedidos_tienda;
begin
  perform pkg_ventas._exigir(p_tienda, 'pedidos.gestionar');
  select * into v_pt from public.pedidos_tienda where id = p_pt and tienda_id = p_tienda;
  if not found then
    raise exception 'No encontramos ese pedido' using errcode = 'TC404';
  end if;
  if public.transicion_pedido_tienda(v_pt.estado, p_estado, v_pt.modalidad) is distinct from 'comercio' then
    raise exception 'Este pedido ya no se puede pasar a ese estado (actualizá la página)' using errcode = 'TC409';
  end if;
  if p_estado = 'cancelado' and length(coalesce(trim(p_motivo), '')) < 5 then
    raise exception 'Contale al cliente por qué cancelás el pedido' using errcode = 'TC400';
  end if;

  update public.pedidos_tienda
  set estado = p_estado,
      motivo_cancelacion = case when p_estado = 'cancelado' then trim(p_motivo) else motivo_cancelacion end
  where id = p_pt;
  return pkg_ventas._parte(p_pt);
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke all on schema pkg_carrito from public;
revoke all on schema pkg_compras from public;
revoke all on schema pkg_ventas from public;
revoke execute on all functions in schema pkg_carrito from public, anon, authenticated, service_role;
revoke execute on all functions in schema pkg_compras from public, anon, authenticated, service_role;
revoke execute on all functions in schema pkg_ventas from public, anon, authenticated, service_role;

grant usage on schema pkg_carrito to anon, authenticated;
grant usage on schema pkg_compras, pkg_ventas to authenticated;

grant execute on function pkg_carrito._armar(jsonb), pkg_carrito.vista_previa(jsonb) to anon, authenticated;
grant execute on function
  pkg_carrito._disponibles(uuid),
  pkg_carrito._mi_carrito(),
  pkg_carrito.ver(),
  pkg_carrito.agregar(uuid, integer),
  pkg_carrito.cambiar_cantidad(uuid, integer),
  pkg_carrito.quitar(uuid),
  pkg_carrito.unir(jsonb)
to authenticated;

-- simular_pago queda sin permisos: solo el servidor.
grant execute on function
  pkg_compras.direcciones(),
  pkg_compras.guardar_direccion(uuid, text, text, text, text, uuid, text, text, boolean),
  pkg_compras.borrar_direccion(uuid),
  pkg_compras.checkout(),
  pkg_compras.crear_pedido(uuid, uuid[]),
  pkg_compras._tienda(uuid),
  pkg_compras._reserva_hasta(uuid),
  pkg_compras.mis_pedidos(),
  pkg_compras.pedido(uuid)
to authenticated;

grant execute on all functions in schema pkg_ventas to authenticated;
