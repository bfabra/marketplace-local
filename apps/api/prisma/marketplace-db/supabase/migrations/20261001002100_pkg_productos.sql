-- ============================================================================
-- Paquete del API: productos del panel de cada tienda (pkg_productos).
-- Convenciones en ..._1800. Todo corre con el rol del usuario: los permisos
-- (productos.ver / editar / publicar, stock.editar), los límites del plan y la
-- variante obligatoria para publicar los siguen controlando RLS y los triggers.
-- ============================================================================

create schema if not exists pkg_productos;
comment on schema pkg_productos is 'Productos, variantes y fotos del panel de la tienda. Solo lo llama el API.';

-- Primer slug libre dentro de la tienda. security definer: RLS no debe ocultar
-- productos de la misma tienda al buscar repetidos.
create or replace function pkg_productos._slug_libre(p_tienda uuid, p_base text, p_excluir uuid default null)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_base text := coalesce(nullif(p_base, ''), 'producto');
  v_slug text := v_base;
  v_n integer := 2;
begin
  while exists (
    select 1 from public.productos
    where tienda_id = p_tienda and slug = v_slug and id is distinct from p_excluir
  ) loop
    v_slug := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end $$;

-- Identifica una variante por su combinación de opciones, sin importar el orden.
create or replace function pkg_productos._clave(p_opciones jsonb)
returns text language sql immutable set search_path = '' as $$
  select coalesce(string_agg(o ->> 'opcion_id', '|' order by o ->> 'opcion_id' collate "C"), 'unica')
  from jsonb_array_elements(coalesce(p_opciones, '[]'::jsonb)) o
$$;

-- El producto existe en la tienda y el usuario lo puede ver (productos.ver).
create or replace function pkg_productos._existe(p_tienda uuid, p_producto uuid)
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.productos where id = p_producto and tienda_id = p_tienda) then
    raise exception 'No encontramos ese producto en esta tienda' using errcode = 'TC404';
  end if;
end $$;

create or replace function pkg_productos._puede_editar_fotos(p_tienda uuid, p_producto uuid)
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.tiene_permiso(p_tienda, 'productos.editar') then
    raise exception 'No tenés permiso para cambiar las fotos de este producto' using errcode = 'TC403';
  end if;
  perform pkg_productos._existe(p_tienda, p_producto);
end $$;

-- Listado del panel con el límite de publicados del plan.
create or replace function pkg_productos.listar(p_tienda uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_plan public.planes;
begin
  if not public.tiene_permiso(p_tienda, 'productos.ver') then
    raise exception 'No tenés permiso para ver los productos de esta tienda' using errcode = 'TC403';
  end if;

  v_plan := public.plan_vigente(p_tienda);

  return jsonb_build_object(
    'productos', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', p.id,
                 'nombre', p.nombre,
                 'slug', p.slug,
                 'estado', p.estado,
                 'motivo_pausa', p.motivo_pausa,
                 'categoria', c.nombre,
                 'variantes', (select count(*) from public.variantes v where v.producto_id = p.id and v.activa),
                 'imagen', pkg_catalogo.imagen_principal(p.id)
               ) || pkg_catalogo.resumen_precio(p.id)
               order by p.actualizado_en desc)
      from public.productos p
      join public.categorias c on c.id = p.categoria_id
      where p.tienda_id = p_tienda and p.estado <> 'archivado'
    ), '[]'::jsonb),
    'limite', jsonb_build_object(
      'plan', v_plan.nombre,
      'max', v_plan.max_productos,
      'publicados', (select count(*) from public.productos p
                     where p.tienda_id = p_tienda and p.estado = 'publicado')
    )
  );
end $$;

-- Producto completo para editarlo. Null si no existe en esa tienda.
create or replace function pkg_productos.detalle(p_tienda uuid, p_producto uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'slug', p.slug,
    'descripcion', p.descripcion,
    'estado', p.estado,
    'motivo_pausa', p.motivo_pausa,
    'categoria_id', p.categoria_id,
    'atributos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'atributo_id', pa.atributo_id,
               'valor_texto', pa.valor_texto,
               'valor_numero', pa.valor_numero,
               'opcion_id', pa.opcion_id))
      from public.producto_atributos pa
      where pa.producto_id = p.id
    ), '[]'::jsonb),
    'variantes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id,
               'sku', v.sku,
               'precio', v.precio,
               'precio_oferta', v.precio_oferta,
               'stock', v.stock,
               'opciones', coalesce((
                 select jsonb_agg(jsonb_build_object('atributo_id', vo.atributo_id, 'opcion_id', vo.opcion_id))
                 from public.variante_opciones vo
                 where vo.variante_id = v.id
               ), '[]'::jsonb)
             ) order by v.creado_en, v.id)
      from public.variantes v
      where v.producto_id = p.id and v.activa
    ), '[]'::jsonb),
    'imagenes', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'ruta', i.ruta_storage) order by i.orden, i.creado_en)
      from public.imagenes_producto i
      where i.producto_id = p.id
    ), '[]'::jsonb)
  )
  from public.productos p
  where p.id = p_producto and p.tienda_id = p_tienda
$$;

-- Alta (p_producto null) o edición completa de un producto en una sola llamada:
-- datos, ficha técnica y variantes. Valida todo contra los atributos de la categoría.
--
-- p_datos: { categoria_id, nombre, descripcion,
--            atributos: [{ atributo_id, valor_texto, valor_numero, opcion_id }],
--            variantes: [{ opciones: [{ atributo_id, opcion_id }], precio, precio_oferta, stock, sku }] }
--
-- El producto nuevo nace como borrador. Al editar, las variantes se reconocen por su
-- combinación de opciones; las que ya no vienen se desactivan (pueden tener ventas).
-- El slug solo cambia mientras el producto es borrador, para no romper enlaces compartidos.
create or replace function pkg_productos.guardar(p_tienda uuid, p_producto uuid, p_datos jsonb, p_slug_base text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id          uuid := p_producto;
  v_estado      public.estado_producto;
  v_categoria   uuid := (p_datos ->> 'categoria_id')::uuid;
  v_atributos   jsonb;
  v_entrada     jsonb := coalesce(p_datos -> 'atributos', '[]'::jsonb);
  v_variantes   jsonb := coalesce(p_datos -> 'variantes', '[]'::jsonb);
  v_ficha       jsonb := '[]'::jsonb;
  v_a           jsonb;
  v_valor       jsonb;
  v_var         jsonb;
  v_texto       text;
  v_numero      numeric;
  v_opcion      uuid;
  v_nombre      text;
  v_cant_var    integer;
  v_clave       text;
  v_claves      text[] := '{}';
  v_existentes  jsonb := '{}'::jsonb;
  v_variante_id uuid;
  v_vigentes    uuid[] := '{}';
begin
  if not public.tiene_permiso(p_tienda, 'productos.editar') then
    raise exception 'No tenés permiso para editar los productos de esta tienda' using errcode = 'TC403';
  end if;

  if v_id is not null then
    select estado into v_estado from public.productos where id = v_id and tienda_id = p_tienda;
    if not found then
      raise exception 'No encontramos ese producto en esta tienda' using errcode = 'TC404';
    end if;
  end if;

  if not exists (select 1 from public.categorias where id = v_categoria and activa) then
    raise exception 'La categoría no existe' using errcode = 'TC400';
  end if;
  v_atributos := pkg_catalogo.atributos_categoria(v_categoria);

  -- Ficha técnica --------------------------------------------------------------
  if exists (
    select 1 from jsonb_array_elements(v_entrada) e
    where not exists (
      select 1 from jsonb_array_elements(v_atributos) a
      where a ->> 'id' = e ->> 'atributo_id' and not (a ->> 'define_variante')::boolean
    )
  ) then
    raise exception 'Hay un dato que no corresponde a esta categoría' using errcode = 'TC400';
  end if;

  for v_a in
    select a from jsonb_array_elements(v_atributos) a where not (a ->> 'define_variante')::boolean
  loop
    select e into v_valor from jsonb_array_elements(v_entrada) e where e ->> 'atributo_id' = v_a ->> 'id' limit 1;
    v_texto  := nullif(trim(v_valor ->> 'valor_texto'), '');
    v_numero := (v_valor ->> 'valor_numero')::numeric;
    v_opcion := (v_valor ->> 'opcion_id')::uuid;

    case v_a ->> 'tipo'
      when 'lista' then
        v_texto := null;
        v_numero := null;
        if v_opcion is not null and not exists (
          select 1 from jsonb_array_elements(v_a -> 'opciones') o where o ->> 'id' = v_opcion::text
        ) then
          raise exception 'Opción inválida para "%"', v_a ->> 'nombre' using errcode = 'TC400';
        end if;
      when 'numero' then
        v_texto := null;
        v_opcion := null;
      when 'si_no' then
        v_numero := null;
        v_opcion := null;
        if v_texto is not null and v_texto not in ('Sí', 'No') then
          raise exception 'Elegí Sí o No en "%"', v_a ->> 'nombre' using errcode = 'TC400';
        end if;
      else
        v_numero := null;
        v_opcion := null;
    end case;

    if v_texto is null and v_numero is null and v_opcion is null then
      if (v_a ->> 'obligatorio')::boolean then
        raise exception 'Completá "%"', v_a ->> 'nombre' using errcode = 'TC400';
      end if;
      continue;
    end if;

    v_ficha := v_ficha || jsonb_build_object(
      'atributo_id', v_a ->> 'id', 'valor_texto', v_texto, 'valor_numero', v_numero, 'opcion_id', v_opcion);
  end loop;

  -- Variantes ------------------------------------------------------------------
  select count(*) into v_cant_var
  from jsonb_array_elements(v_atributos) a where (a ->> 'define_variante')::boolean;

  if jsonb_array_length(v_variantes) = 0 then
    raise exception 'Cargá al menos una variante con precio' using errcode = 'TC400';
  end if;
  if v_cant_var = 0 and (
       jsonb_array_length(v_variantes) <> 1
       or jsonb_array_length(coalesce(v_variantes -> 0 -> 'opciones', '[]'::jsonb)) > 0) then
    raise exception 'Esta categoría no usa variantes: cargá un solo precio y stock' using errcode = 'TC400';
  end if;

  for v_var in select value from jsonb_array_elements(v_variantes) loop
    if jsonb_array_length(coalesce(v_var -> 'opciones', '[]'::jsonb)) <> v_cant_var then
      select string_agg(a ->> 'nombre', ' y ') into v_nombre
      from jsonb_array_elements(v_atributos) a where (a ->> 'define_variante')::boolean;
      raise exception 'Cada variante tiene que indicar %', v_nombre using errcode = 'TC400';
    end if;

    select a ->> 'nombre' into v_nombre
    from jsonb_array_elements(v_atributos) a
    where (a ->> 'define_variante')::boolean
      and not exists (
        select 1
        from jsonb_array_elements(v_var -> 'opciones') o
        join jsonb_array_elements(a -> 'opciones') ao on ao ->> 'id' = o ->> 'opcion_id'
        where o ->> 'atributo_id' = a ->> 'id'
      )
    limit 1;
    if found then
      raise exception 'Falta o es inválido "%" en una variante', v_nombre using errcode = 'TC400';
    end if;

    v_clave := pkg_productos._clave(v_var -> 'opciones');
    if v_clave = any (v_claves) then
      raise exception 'Hay dos variantes con la misma combinación' using errcode = 'TC400';
    end if;
    v_claves := v_claves || v_clave;
  end loop;

  -- Producto y ficha -------------------------------------------------------------
  if v_id is null then
    insert into public.productos (tienda_id, categoria_id, nombre, slug, descripcion)
    values (p_tienda, v_categoria, p_datos ->> 'nombre',
            pkg_productos._slug_libre(p_tienda, p_slug_base), p_datos ->> 'descripcion')
    returning id into v_id;
  else
    update public.productos set
      categoria_id = v_categoria,
      nombre       = p_datos ->> 'nombre',
      descripcion  = p_datos ->> 'descripcion',
      slug         = case when v_estado = 'borrador'
                          then pkg_productos._slug_libre(p_tienda, p_slug_base, v_id)
                          else slug end
    where id = v_id;
    delete from public.producto_atributos where producto_id = v_id;

    select coalesce(jsonb_object_agg(x.clave, x.id), '{}'::jsonb) into v_existentes
    from (
      select v.id,
             coalesce(string_agg(vo.opcion_id::text, '|' order by vo.opcion_id::text collate "C"), 'unica') as clave
      from public.variantes v
      left join public.variante_opciones vo on vo.variante_id = v.id
      where v.producto_id = v_id
      group by v.id
    ) x;
  end if;

  -- tienda_id lo vuelve a copiar la base desde el producto.
  insert into public.producto_atributos (producto_id, tienda_id, atributo_id, valor_texto, valor_numero, opcion_id)
  select v_id, p_tienda, (f ->> 'atributo_id')::uuid, f ->> 'valor_texto',
         (f ->> 'valor_numero')::numeric, (f ->> 'opcion_id')::uuid
  from jsonb_array_elements(v_ficha) f;

  -- Variantes ------------------------------------------------------------------
  for v_var in select value from jsonb_array_elements(v_variantes) loop
    v_variante_id := (v_existentes ->> pkg_productos._clave(v_var -> 'opciones'))::uuid;

    if v_variante_id is not null then
      update public.variantes set
        precio        = (v_var ->> 'precio')::numeric,
        precio_oferta = (v_var ->> 'precio_oferta')::numeric,
        stock         = (v_var ->> 'stock')::integer,
        sku           = nullif(v_var ->> 'sku', ''),
        activa        = true
      where id = v_variante_id;
    else
      insert into public.variantes (producto_id, tienda_id, sku, precio, precio_oferta, stock)
      values (v_id, p_tienda, nullif(v_var ->> 'sku', ''), (v_var ->> 'precio')::numeric,
              (v_var ->> 'precio_oferta')::numeric, (v_var ->> 'stock')::integer)
      returning id into v_variante_id;

      insert into public.variante_opciones (variante_id, atributo_id, opcion_id)
      select v_variante_id, (o ->> 'atributo_id')::uuid, (o ->> 'opcion_id')::uuid
      from jsonb_array_elements(coalesce(v_var -> 'opciones', '[]'::jsonb)) o;
    end if;

    v_vigentes := v_vigentes || v_variante_id;
  end loop;

  update public.variantes set activa = false
  where producto_id = v_id and activa and id <> all (v_vigentes);

  return v_id;
end $$;

-- Publicar, pausar, archivar o volver a borrador. Los límites del plan, el permiso
-- de publicar y la variante obligatoria los controla el trigger de productos.
create or replace function pkg_productos.cambiar_estado(p_tienda uuid, p_producto uuid, p_estado public.estado_producto)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_producto jsonb;
begin
  perform pkg_productos._existe(p_tienda, p_producto);

  update public.productos set estado = p_estado
  where id = p_producto and tienda_id = p_tienda
  returning jsonb_build_object('id', id, 'estado', estado, 'motivo_pausa', motivo_pausa) into v_producto;
  if v_producto is null then
    raise exception 'No tenés permiso para cambiar el estado de este producto' using errcode = 'TC403';
  end if;
  return v_producto;
end $$;

-- Borra el producto y devuelve las rutas de sus fotos, para que el API borre los archivos.
create or replace function pkg_productos.borrar(p_tienda uuid, p_producto uuid)
returns text[] language plpgsql security invoker set search_path = '' as $$
declare v_rutas text[];
begin
  perform pkg_productos._existe(p_tienda, p_producto);

  select coalesce(array_agg(ruta_storage), '{}') into v_rutas
  from public.imagenes_producto
  where producto_id = p_producto and tienda_id = p_tienda;

  delete from public.productos where id = p_producto and tienda_id = p_tienda;
  if not found then
    raise exception 'No tenés permiso para borrar este producto' using errcode = 'TC403';
  end if;
  return v_rutas;
exception
  when foreign_key_violation then
    raise exception 'Este producto ya tiene compras o está en carritos: archivalo en lugar de borrarlo'
      using errcode = 'TC409';
end $$;

-- ¿Se pueden sumar p_cantidad fotos? Se llama antes de guardar los archivos.
create or replace function pkg_productos.validar_imagenes(p_tienda uuid, p_producto uuid, p_cantidad integer)
returns integer language plpgsql stable security invoker set search_path = '' as $$
declare v_actuales integer;
begin
  perform pkg_productos._puede_editar_fotos(p_tienda, p_producto);
  if p_cantidad < 1 then
    raise exception 'Elegí al menos una foto' using errcode = 'TC400';
  end if;

  select count(*) into v_actuales from public.imagenes_producto where producto_id = p_producto;
  if v_actuales + p_cantidad > 8 then
    raise exception 'Cada producto puede tener hasta 8 fotos' using errcode = 'TC400';
  end if;
  return v_actuales;
end $$;

-- Registra las fotos ya guardadas, al final del orden actual.
create or replace function pkg_productos.agregar_imagenes(p_tienda uuid, p_producto uuid, p_rutas text[])
returns void language plpgsql security invoker set search_path = '' as $$
declare v_actuales integer;
begin
  v_actuales := pkg_productos.validar_imagenes(p_tienda, p_producto, cardinality(p_rutas));

  insert into public.imagenes_producto (producto_id, tienda_id, ruta_storage, orden)
  select p_producto, p_tienda, x.ruta, v_actuales + x.n - 1
  from unnest(p_rutas) with ordinality as x(ruta, n);
end $$;

-- Quita una foto y devuelve su ruta, para que el API borre el archivo.
create or replace function pkg_productos.borrar_imagen(p_tienda uuid, p_producto uuid, p_imagen uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_ruta text;
begin
  perform pkg_productos._puede_editar_fotos(p_tienda, p_producto);

  delete from public.imagenes_producto
  where id = p_imagen and producto_id = p_producto and tienda_id = p_tienda
  returning ruta_storage into v_ruta;
  if v_ruta is null then
    raise exception 'No encontramos esa foto' using errcode = 'TC404';
  end if;
  return v_ruta;
end $$;

-- La foto principal es la de menor orden: se usa en listados y tarjetas.
create or replace function pkg_productos.imagen_principal(p_tienda uuid, p_producto uuid, p_imagen uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_productos._puede_editar_fotos(p_tienda, p_producto);

  if not exists (
    select 1 from public.imagenes_producto
    where id = p_imagen and producto_id = p_producto and tienda_id = p_tienda
  ) then
    raise exception 'No encontramos esa foto' using errcode = 'TC404';
  end if;

  update public.imagenes_producto i set orden = x.n - 1
  from (
    select id, row_number() over (order by id = p_imagen desc, orden, creado_en) as n
    from public.imagenes_producto
    where producto_id = p_producto
  ) x
  where i.id = x.id;
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke all on schema pkg_productos from public;
revoke execute on all functions in schema pkg_productos from public, anon, authenticated, service_role;
grant usage on schema pkg_productos to authenticated;
grant execute on all functions in schema pkg_productos to authenticated;
