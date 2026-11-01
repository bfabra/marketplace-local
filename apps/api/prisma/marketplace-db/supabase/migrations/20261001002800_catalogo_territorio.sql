-- ============================================================================
-- Panel de administración, etapa 3: catálogo (categorías y atributos) y
-- territorio (provincias, localidades y tarifas de envío). Convenciones en ..._1800.
--
-- Quién edita (el superadmin, todo):
--   moderación → categorías, subcategorías y atributos
--   logística  → provincias, localidades y tarifas de envío
--
-- Categoría oculta (activa = false): ella y sus subcategorías salen del menú,
-- sus productos dejan de verse en el sitio y salen de los carritos. Las tiendas
-- los siguen viendo en su panel.
-- Provincia o localidad inactiva: no se ofrece para tiendas ni direcciones
-- nuevas; las que ya están ahí siguen funcionando.
-- Las variantes (talle, color…) de una categoría con productos no se pueden
-- cambiar: romperían las combinaciones que ya cargaron las tiendas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Índices para los conteos del panel y los borrados
-- ----------------------------------------------------------------------------
create index if not exists productos_categoria_id_idx on public.productos (categoria_id);
create index if not exists tiendas_localidad_id_idx on public.tiendas (localidad_id);

-- ----------------------------------------------------------------------------
-- Visibilidad
-- ----------------------------------------------------------------------------
create or replace function public.categoria_activa(p_categoria uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select c.activa from public.categorias c where c.id = p_categoria), false)
$$;

create or replace function public.producto_visible(p_producto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.productos p
    join public.tiendas t on t.id = p.tienda_id
    join public.categorias c on c.id = p.categoria_id
    where p.id = p_producto and p.estado = 'publicado' and t.estado = 'activa' and c.activa
  )
$$;

drop policy "productos: publicados de tiendas activas" on public.productos;
create policy "productos: publicados de tiendas activas" on public.productos
  for select to anon, authenticated
  using (estado = 'publicado' and public.tienda_activa(tienda_id) and public.categoria_activa(categoria_id));

-- Categorías, provincias y localidades no son datos privados: se leen todas y
-- cada función pública filtra las activas. Así una tienda sigue viendo sus
-- productos de una categoría oculta y nadie pierde su dirección cuando se
-- desactiva una localidad.
drop policy "categorias: lectura pública" on public.categorias;
create policy "categorias: lectura pública" on public.categorias
  for select to anon, authenticated using (true);

drop policy "ubicacion: lectura pública" on public.provincias;
drop policy "ubicacion: admin edita" on public.provincias;
create policy "provincias: lectura pública" on public.provincias
  for select to anon, authenticated using (true);
create policy "provincias: logística edita" on public.provincias
  for all to authenticated using (public.es_admin('logistica')) with check (public.es_admin('logistica'));

drop policy "localidades: lectura pública" on public.localidades;
drop policy "localidades: admin edita" on public.localidades;
create policy "localidades: lectura pública" on public.localidades
  for select to anon, authenticated using (true);
create policy "localidades: logística edita" on public.localidades
  for all to authenticated using (public.es_admin('logistica')) with check (public.es_admin('logistica'));

-- Tiendas y direcciones nuevas, solo en localidades activas de provincias activas.
create or replace function public.tg_localidad_disponible()
returns trigger language plpgsql as $$
begin
  if public.es_usuario_final()
     and (tg_op = 'INSERT' or new.localidad_id is distinct from old.localidad_id)
     and not exists (select 1 from public.localidades l
                     join public.provincias pr on pr.id = l.provincia_id
                     where l.id = new.localidad_id and l.activa and pr.activa) then
    raise exception 'Todavía no estamos en esa localidad. Elegí una de la lista';
  end if;
  return new;
end $$;

create trigger localidad_disponible
  before insert or update of localidad_id on public.tiendas
  for each row execute function public.tg_localidad_disponible();
create trigger localidad_disponible
  before insert or update of localidad_id on public.direcciones
  for each row execute function public.tg_localidad_disponible();

-- El menú respeta el orden que fija moderación (antes salía por dirección web).
create or replace function pkg_catalogo.categorias()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with recursive arbol as (
    select c.id, c.nombre, c.padre_id, c.ruta, c.nombre as etiqueta,
           array[lpad(c.orden::text, 6, '0') || c.nombre] as camino
    from public.categorias c
    where c.padre_id is null and c.activa
    union all
    select c.id, c.nombre, c.padre_id, c.ruta, a.etiqueta || ' › ' || c.nombre,
           a.camino || (lpad(c.orden::text, 6, '0') || c.nombre)
    from public.categorias c
    join arbol a on c.padre_id = a.id
    where c.activa
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'nombre', nombre, 'padre_id', padre_id, 'ruta', ruta, 'etiqueta', etiqueta
         ) order by camino), '[]'::jsonb)
  from arbol
$$;

-- ----------------------------------------------------------------------------
-- Auditoría: los cambios de catálogo y territorio quedan en el registro
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categorias', 'categorias_atributos', 'atributos', 'atributo_opciones',
                           'provincias', 'localidades']
  loop
    execute format(
      'create trigger auditar after insert or update or delete on public.%I
         for each row execute function public.tg_auditar()', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Ayudas internas. security definer: cuentan productos de todas las tiendas,
-- pero solo responden a administración.
-- ----------------------------------------------------------------------------

-- Productos (sin los archivados) de una categoría y sus subcategorías.
create or replace function pkg_admin._productos_en(p_ruta text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.productos p
  join public.categorias c on c.id = p.categoria_id
  where public.es_admin() and c.ruta like p_ruta || '%' and p.estado <> 'archivado'
$$;

-- Productos (sin los archivados) que tienen cargado un atributo, en la ficha o
-- en sus variantes. Con p_ruta, solo los de esa categoría y sus subcategorías.
create or replace function pkg_admin._uso_atributo(p_atributo uuid, p_ruta text default null)
returns integer language sql stable security definer set search_path = '' as $$
  select count(distinct x.producto_id)::integer
  from (
    select pa.producto_id from public.producto_atributos pa where pa.atributo_id = p_atributo
    union all
    select v.producto_id
    from public.variante_opciones vo
    join public.variantes v on v.id = vo.variante_id
    where vo.atributo_id = p_atributo
  ) x
  join public.productos p on p.id = x.producto_id and p.estado <> 'archivado'
  join public.categorias c on c.id = p.categoria_id
  where public.es_admin() and (p_ruta is null or c.ruta like p_ruta || '%')
$$;

-- ¿Alguna variante o ficha (aunque sea de un producto archivado) usa esta opción?
create or replace function pkg_admin._opcion_en_uso(p_opcion uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_admin() and (
    exists (select 1 from public.variante_opciones vo where vo.opcion_id = p_opcion)
    or exists (select 1 from public.producto_atributos pa where pa.opcion_id = p_opcion))
$$;

-- Atributos de variante que una categoría hereda (o tiene), ordenados.
create or replace function pkg_admin._variantes_de(p_categoria uuid)
returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(ac.atributo_id order by ac.atributo_id), '{}'::uuid[])
  from public.atributos_de_categoria(p_categoria) ac
  where ac.define_variante
$$;

-- Saca de los carritos los productos de una categoría oculta: el carrito ya no
-- los muestra y el pedido no los tiene que cobrar.
create or replace function pkg_admin._quitar_de_carritos(p_ruta text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_quitados integer;
begin
  if not public.es_admin('moderacion') then
    raise exception 'Solo moderación edita las categorías' using errcode = 'TC403';
  end if;
  delete from public.carrito_items ci
  using public.variantes v, public.productos p, public.categorias c
  where v.id = ci.variante_id and p.id = v.producto_id and c.id = p.categoria_id
    and c.ruta like p_ruta || '%';
  get diagnostics v_quitados = row_count;
  return v_quitados;
end $$;

create or replace function pkg_admin._exigir_moderacion()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.es_admin('moderacion') then
    raise exception 'Solo moderación edita las categorías y los atributos' using errcode = 'TC403';
  end if;
end $$;

create or replace function pkg_admin._exigir_logistica()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.es_admin('logistica') then
    raise exception 'Solo logística edita provincias, localidades y tarifas' using errcode = 'TC403';
  end if;
end $$;

create or replace function pkg_admin._validar_nombre(p_nombre text, p_slug text, p_max integer default 60)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if char_length(coalesce(trim(p_nombre), '')) not between 2 and p_max then
    raise exception 'El nombre tiene que tener entre 2 y % caracteres', p_max using errcode = 'TC400';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 60 then
    raise exception 'El nombre tiene que tener al menos una letra o un número' using errcode = 'TC400';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Categorías: lecturas (servidor: cuentan productos de todas las tiendas)
-- ----------------------------------------------------------------------------

-- Todas las categorías, también las ocultas, con sus productos contando las
-- subcategorías. La web arma el árbol con padre_id y orden.
create or replace function pkg_admin.categorias()
returns jsonb language sql stable set search_path = '' as $$
  with propios as (
    select p.categoria_id,
           count(*) filter (where p.estado = 'publicado') as publicados,
           count(*) filter (where p.estado <> 'archivado') as total
    from public.productos p
    group by p.categoria_id
  ), por_categoria as (
    select c.id, c.ruta, coalesce(pr.publicados, 0) as publicados, coalesce(pr.total, 0) as total
    from public.categorias c
    left join propios pr on pr.categoria_id = c.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'padre_id', c.padre_id,
           'nombre', c.nombre,
           'slug', c.slug,
           'ruta', c.ruta,
           'orden', c.orden,
           'activa', c.activa,
           'comision_pct', c.comision_pct,
           'atributos', (select count(*) from public.categorias_atributos ca where ca.categoria_id = c.id),
           'productos', (select jsonb_build_object('publicados', coalesce(sum(x.publicados), 0),
                                                   'total', coalesce(sum(x.total), 0))
                         from por_categoria x where x.ruta like c.ruta || '%')
         ) order by c.ruta), '[]'::jsonb)
  from public.categorias c
$$;

-- Ficha de una categoría: camino, subcategorías, atributos propios y heredados
-- y sus productos (con las subcategorías). Null si no existe.
create or replace function pkg_admin.categoria(p_categoria uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'padre_id', c.padre_id,
    'nombre', c.nombre,
    'slug', c.slug,
    'ruta', c.ruta,
    'orden', c.orden,
    'activa', c.activa,
    'comision_pct', c.comision_pct,
    'creado_en', c.creado_en,
    'camino', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre, 'activa', a.activa)
                       order by length(a.ruta))
      from public.categorias a
      where c.ruta like a.ruta || '%' and a.id <> c.id
    ), '[]'::jsonb),
    'subcategorias', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'activa', s.activa)
                       order by s.orden, s.nombre)
      from public.categorias s
      where s.padre_id = c.id
    ), '[]'::jsonb),
    'productos', (
      select jsonb_build_object(
               'publicados', count(*) filter (where p.estado = 'publicado'),
               'pausados',   count(*) filter (where p.estado = 'pausado'),
               'borradores', count(*) filter (where p.estado = 'borrador'),
               'archivados', count(*) filter (where p.estado = 'archivado'),
               'total',      count(*) filter (where p.estado <> 'archivado'),
               'tiendas',    count(distinct p.tienda_id) filter (where p.estado = 'publicado'))
      from public.productos p
      join public.categorias d on d.id = p.categoria_id
      where d.ruta like c.ruta || '%'),
    'atributos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id,
               'nombre', a.nombre,
               'tipo', a.tipo,
               'unidad', a.unidad,
               'obligatorio', ca.obligatorio,
               'define_variante', ca.define_variante,
               'opciones', (select count(*) from public.atributo_opciones o where o.atributo_id = a.id),
               'desde', case when o.id <> c.id then jsonb_build_object('id', o.id, 'nombre', o.nombre) end,
               'enUso', case when o.id = c.id then (
                 select count(distinct x.producto_id)
                 from (
                   select pa.producto_id from public.producto_atributos pa where pa.atributo_id = a.id
                   union all
                   select v.producto_id from public.variante_opciones vo
                   join public.variantes v on v.id = vo.variante_id
                   where vo.atributo_id = a.id
                 ) x
                 join public.productos p on p.id = x.producto_id and p.estado <> 'archivado'
                 join public.categorias d on d.id = p.categoria_id
                 where d.ruta like c.ruta || '%') end
             ) order by o.id = c.id, length(o.ruta), ca.define_variante desc, ca.orden, a.nombre)
      from public.categorias o
      join public.categorias_atributos ca on ca.categoria_id = o.id
      join public.atributos a on a.id = ca.atributo_id
      where c.ruta like o.ruta || '%'
    ), '[]'::jsonb)
  )
  from public.categorias c
  where c.id = p_categoria
$$;

-- ----------------------------------------------------------------------------
-- Categorías: cambios (corren como moderación; la auditoría registra quién fue)
-- ----------------------------------------------------------------------------

-- Crea (p_categoria null) o edita. La dirección web (slug) solo se fija al
-- crearla: renombrar no cambia la ruta ni los íconos de la web.
-- Mover una categoría con productos solo se permite si las variantes que
-- hereda siguen siendo las mismas.
create or replace function pkg_admin.guardar_categoria(
  p_categoria uuid, p_nombre text, p_slug text, p_padre uuid, p_comision numeric
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre text := trim(p_nombre);
  v_actual public.categorias;
  v_padre  public.categorias;
  v_id     uuid;
  v_ruta   text;
begin
  perform pkg_admin._exigir_moderacion();
  if p_comision is null or p_comision < 0 or p_comision > 100 then
    raise exception 'La comisión tiene que estar entre 0 y 100' using errcode = 'TC400';
  end if;
  if p_padre is not null then
    select * into v_padre from public.categorias where id = p_padre;
    if not found then
      raise exception 'No encontramos la categoría donde va' using errcode = 'TC404';
    end if;
  end if;

  if p_categoria is null then
    perform pkg_admin._validar_nombre(v_nombre, p_slug);
    insert into public.categorias (padre_id, nombre, slug, comision_pct, activa, orden)
    values (p_padre, v_nombre, p_slug, p_comision, coalesce(v_padre.activa, true),
            (select coalesce(max(orden), 0) + 1 from public.categorias where padre_id is not distinct from p_padre))
    returning id into v_id;
  else
    select * into v_actual from public.categorias where id = p_categoria for update;
    if not found then
      raise exception 'No encontramos esa categoría' using errcode = 'TC404';
    end if;
    perform pkg_admin._validar_nombre(v_nombre, v_actual.slug);

    if p_padre is distinct from v_actual.padre_id then
      if p_padre = p_categoria or v_padre.ruta like v_actual.ruta || '%' then
        raise exception 'Una categoría no puede quedar dentro de sus propias subcategorías' using errcode = 'TC409';
      end if;
      if pkg_admin._variantes_de(p_padre) is distinct from pkg_admin._variantes_de(v_actual.padre_id)
         and pkg_admin._productos_en(v_actual.ruta) > 0 then
        raise exception 'Sus productos usan otras variantes (talle, color…): solo se puede mover a una categoría que use las mismas'
          using errcode = 'TC409';
      end if;
    end if;

    update public.categorias set
      nombre = v_nombre,
      padre_id = p_padre,
      comision_pct = p_comision,
      orden = case when p_padre is distinct from v_actual.padre_id
                   then (select coalesce(max(x.orden), 0) + 1 from public.categorias x
                         where x.padre_id is not distinct from p_padre)
                   else orden end
    where id = p_categoria
    returning ruta into v_ruta;

    -- Movida dentro de una categoría oculta, queda oculta con sus subcategorías.
    if v_padre.activa is false and v_actual.activa then
      update public.categorias set activa = false where ruta like v_ruta || '%' and activa;
      perform pkg_admin._quitar_de_carritos(v_ruta);
    end if;
    v_id := p_categoria;
  end if;

  return (select jsonb_build_object('id', id, 'nombre', nombre, 'ruta', ruta, 'activa', activa)
          from public.categorias where id = v_id);
exception
  when unique_violation then
    raise exception 'Ya hay una categoría con ese nombre en ese lugar' using errcode = 'TC409';
end $$;

-- Mostrar u ocultar una categoría, siempre con sus subcategorías.
create or replace function pkg_admin.activar_categoria(p_categoria uuid, p_activa boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v         public.categorias;
  v_padre   public.categorias;
  v_cambios integer;
  v_carritos integer := 0;
begin
  perform pkg_admin._exigir_moderacion();
  if p_activa is null then
    raise exception 'Elegí si la categoría se muestra o no' using errcode = 'TC400';
  end if;
  select * into v from public.categorias where id = p_categoria for update;
  if not found then
    raise exception 'No encontramos esa categoría' using errcode = 'TC404';
  end if;
  if p_activa and v.padre_id is not null then
    select * into v_padre from public.categorias where id = v.padre_id;
    if not v_padre.activa then
      raise exception 'Primero mostrá «%», la categoría que la contiene', v_padre.nombre using errcode = 'TC409';
    end if;
  end if;

  update public.categorias set activa = p_activa
  where ruta like v.ruta || '%' and activa is distinct from p_activa;
  get diagnostics v_cambios = row_count;
  if not p_activa then
    v_carritos := pkg_admin._quitar_de_carritos(v.ruta);
  end if;

  return jsonb_build_object(
    'id', v.id,
    'activa', p_activa,
    'categorias', v_cambios,
    'productos', (select count(*) from public.productos p
                  join public.categorias c on c.id = p.categoria_id
                  where c.ruta like v.ruta || '%' and p.estado = 'publicado'),
    'carritos', v_carritos);
end $$;

-- Sube o baja una categoría entre sus hermanas (el orden del menú).
create or replace function pkg_admin.ordenar_categoria(p_categoria uuid, p_direccion text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v     public.categorias;
  v_ids uuid[];
  i     integer;
begin
  perform pkg_admin._exigir_moderacion();
  if p_direccion is null or p_direccion not in ('subir', 'bajar') then
    raise exception 'Dirección inválida' using errcode = 'TC400';
  end if;
  select * into v from public.categorias where id = p_categoria;
  if not found then
    raise exception 'No encontramos esa categoría' using errcode = 'TC404';
  end if;

  select array_agg(c.id order by c.orden, c.nombre) into v_ids
  from public.categorias c
  where c.padre_id is not distinct from v.padre_id;
  i := array_position(v_ids, v.id);

  if p_direccion = 'subir' and i > 1 then
    v_ids[i] := v_ids[i - 1];
    v_ids[i - 1] := v.id;
  elsif p_direccion = 'bajar' and i < cardinality(v_ids) then
    v_ids[i] := v_ids[i + 1];
    v_ids[i + 1] := v.id;
  end if;

  update public.categorias c set orden = x.n
  from unnest(v_ids) with ordinality x(id, n)
  where c.id = x.id and c.orden <> x.n;
end $$;

-- Solo se borra una categoría vacía: sin subcategorías ni productos (tampoco
-- archivados, que conservan su historial de ventas).
create or replace function pkg_admin.eliminar_categoria(p_categoria uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_productos integer;
begin
  perform pkg_admin._exigir_moderacion();
  perform 1 from public.categorias where id = p_categoria for update;
  if not found then
    raise exception 'No encontramos esa categoría' using errcode = 'TC404';
  end if;
  if exists (select 1 from public.categorias where padre_id = p_categoria) then
    raise exception 'Tiene subcategorías: borralas o movelas primero' using errcode = 'TC409';
  end if;
  select count(*) into v_productos from public.productos where categoria_id = p_categoria;
  if v_productos > 0 then
    raise exception 'Tiene % productos (contando los archivados), así que no se puede borrar. Podés ocultarla', v_productos
      using errcode = 'TC409';
  end if;
  delete from public.categorias where id = p_categoria;
end $$;

-- Agrega un atributo a la categoría o cambia si es obligatorio o define variantes.
-- Las variantes siempre son obligatorias. Un atributo se carga una sola vez en
-- cada rama del árbol: lo heredan las subcategorías.
create or replace function pkg_admin.guardar_atributo_categoria(
  p_categoria uuid, p_atributo uuid, p_obligatorio boolean, p_define_variante boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_cat     public.categorias;
  v_atr     public.atributos;
  v_actual  public.categorias_atributos;
  v_existe  boolean;
  v_otra    text;
  v_variante boolean := coalesce(p_define_variante, false);
begin
  perform pkg_admin._exigir_moderacion();
  select * into v_cat from public.categorias where id = p_categoria;
  if not found then
    raise exception 'No encontramos esa categoría' using errcode = 'TC404';
  end if;
  select * into v_atr from public.atributos where id = p_atributo;
  if not found then
    raise exception 'No encontramos ese atributo' using errcode = 'TC404';
  end if;
  if v_variante and v_atr.tipo <> 'lista' then
    raise exception 'Solo un atributo de tipo lista puede generar variantes' using errcode = 'TC400';
  end if;
  if v_variante and not exists (select 1 from public.atributo_opciones where atributo_id = p_atributo) then
    raise exception 'Cargale opciones a «%» antes de usarlo para variantes', v_atr.nombre using errcode = 'TC400';
  end if;

  select o.nombre into v_otra
  from public.categorias o
  join public.categorias_atributos ca on ca.categoria_id = o.id and ca.atributo_id = p_atributo
  where o.id <> v_cat.id and v_cat.ruta like o.ruta || '%'
  limit 1;
  if v_otra is not null then
    raise exception 'Ya lo hereda de «%»', v_otra using errcode = 'TC409';
  end if;
  select o.nombre into v_otra
  from public.categorias o
  join public.categorias_atributos ca on ca.categoria_id = o.id and ca.atributo_id = p_atributo
  where o.id <> v_cat.id and o.ruta like v_cat.ruta || '%'
  limit 1;
  if v_otra is not null then
    raise exception 'La subcategoría «%» ya lo tiene: quitáselo primero', v_otra using errcode = 'TC409';
  end if;

  select * into v_actual from public.categorias_atributos
  where categoria_id = p_categoria and atributo_id = p_atributo;
  v_existe := found;
  if ((not v_existe and v_variante) or (v_existe and v_actual.define_variante <> v_variante))
     and pkg_admin._productos_en(v_cat.ruta) > 0 then
    raise exception 'Ya hay productos en esta categoría: no se pueden cambiar las variantes que usan'
      using errcode = 'TC409';
  end if;

  insert into public.categorias_atributos (categoria_id, atributo_id, obligatorio, define_variante, orden)
  values (p_categoria, p_atributo, coalesce(p_obligatorio, false) or v_variante, v_variante,
          (select coalesce(max(orden), 0) + 1 from public.categorias_atributos where categoria_id = p_categoria))
  on conflict (categoria_id, atributo_id) do update
    set obligatorio = excluded.obligatorio, define_variante = excluded.define_variante;
end $$;

create or replace function pkg_admin.quitar_atributo_categoria(p_categoria uuid, p_atributo uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_actual public.categorias_atributos;
  v_ruta   text;
  v_uso    integer;
begin
  perform pkg_admin._exigir_moderacion();
  select * into v_actual from public.categorias_atributos
  where categoria_id = p_categoria and atributo_id = p_atributo;
  if not found then
    raise exception 'Esa categoría no tiene ese atributo' using errcode = 'TC404';
  end if;
  select ruta into v_ruta from public.categorias where id = p_categoria;

  if v_actual.define_variante and pkg_admin._productos_en(v_ruta) > 0 then
    raise exception 'Ya hay productos en esta categoría: no se pueden cambiar las variantes que usan'
      using errcode = 'TC409';
  end if;
  v_uso := pkg_admin._uso_atributo(p_atributo, v_ruta);
  if v_uso > 0 then
    raise exception '% productos tienen cargado este dato. Podés dejarlo como opcional', v_uso using errcode = 'TC409';
  end if;
  delete from public.categorias_atributos where categoria_id = p_categoria and atributo_id = p_atributo;
end $$;

-- ----------------------------------------------------------------------------
-- Atributos (Talle, Color, Memoria…)
-- ----------------------------------------------------------------------------

-- Catálogo de atributos con sus opciones, dónde se usan y cuántos productos
-- los tienen cargados (servidor).
create or replace function pkg_admin.atributos()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'nombre', a.nombre,
           'tipo', a.tipo,
           'unidad', a.unidad,
           'filtrable', a.filtrable,
           'opciones', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', o.id,
                      'valor', o.valor,
                      'enUso', exists (select 1 from public.variante_opciones vo where vo.opcion_id = o.id)
                               or exists (select 1 from public.producto_atributos pa where pa.opcion_id = o.id)
                    ) order by o.orden, o.valor)
             from public.atributo_opciones o
             where o.atributo_id = a.id
           ), '[]'::jsonb),
           'categorias', coalesce((
             select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'ruta', c.ruta,
                                                 'define_variante', ca.define_variante) order by c.ruta)
             from public.categorias_atributos ca
             join public.categorias c on c.id = ca.categoria_id
             where ca.atributo_id = a.id
           ), '[]'::jsonb),
           'productos', (
             select count(distinct x.producto_id)
             from (
               select pa.producto_id from public.producto_atributos pa where pa.atributo_id = a.id
               union all
               select v.producto_id from public.variante_opciones vo
               join public.variantes v on v.id = vo.variante_id
               where vo.atributo_id = a.id
             ) x
             join public.productos p on p.id = x.producto_id and p.estado <> 'archivado')
         ) order by a.nombre), '[]'::jsonb)
  from public.atributos a
$$;

-- Crea (p_atributo null) o edita. El tipo no cambia si ya se usa en alguna
-- categoría o producto.
create or replace function pkg_admin.guardar_atributo(
  p_atributo uuid, p_nombre text, p_tipo public.tipo_atributo, p_unidad text, p_filtrable boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre text := trim(p_nombre);
  v_unidad text := nullif(trim(p_unidad), '');
  v_actual public.atributos;
  v_id     uuid;
begin
  perform pkg_admin._exigir_moderacion();
  if char_length(coalesce(v_nombre, '')) not between 2 and 40 then
    raise exception 'El nombre tiene que tener entre 2 y 40 caracteres' using errcode = 'TC400';
  end if;
  if char_length(coalesce(v_unidad, '')) > 10 then
    raise exception 'La unidad puede tener hasta 10 caracteres' using errcode = 'TC400';
  end if;
  if p_tipo is null then
    raise exception 'Elegí el tipo de dato' using errcode = 'TC400';
  end if;

  if p_atributo is null then
    insert into public.atributos (nombre, tipo, unidad, filtrable)
    values (v_nombre, p_tipo, v_unidad, coalesce(p_filtrable, false))
    returning id into v_id;
  else
    select * into v_actual from public.atributos where id = p_atributo for update;
    if not found then
      raise exception 'No encontramos ese atributo' using errcode = 'TC404';
    end if;
    if p_tipo <> v_actual.tipo
       and (exists (select 1 from public.categorias_atributos where atributo_id = p_atributo)
            or pkg_admin._uso_atributo(p_atributo) > 0
            or exists (select 1 from public.atributo_opciones where atributo_id = p_atributo)) then
      raise exception 'Ya se usa o tiene opciones: el tipo no se puede cambiar' using errcode = 'TC409';
    end if;
    update public.atributos
    set nombre = v_nombre, tipo = p_tipo, unidad = v_unidad, filtrable = coalesce(p_filtrable, false)
    where id = p_atributo;
    v_id := p_atributo;
  end if;
  return jsonb_build_object('id', v_id);
exception
  when unique_violation then
    raise exception 'Ya hay un atributo llamado «%»', v_nombre using errcode = 'TC409';
end $$;

create or replace function pkg_admin.eliminar_atributo(p_atributo uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_categorias integer;
begin
  perform pkg_admin._exigir_moderacion();
  perform 1 from public.atributos where id = p_atributo for update;
  if not found then
    raise exception 'No encontramos ese atributo' using errcode = 'TC404';
  end if;
  select count(*) into v_categorias from public.categorias_atributos where atributo_id = p_atributo;
  if v_categorias > 0 then
    raise exception 'Lo usan % categorías: quitáselo primero', v_categorias using errcode = 'TC409';
  end if;
  if pkg_admin._uso_atributo(p_atributo) > 0
     or exists (select 1 from public.atributo_opciones o where o.atributo_id = p_atributo
                and pkg_admin._opcion_en_uso(o.id)) then
    raise exception 'Hay productos que lo tienen cargado: no se puede borrar' using errcode = 'TC409';
  end if;
  delete from public.atributos where id = p_atributo;
end $$;

-- Agrega (p_opcion null) o renombra una opción de un atributo de lista.
-- Renombrar cambia lo que ven todos los productos que la usan.
create or replace function pkg_admin.guardar_opcion(p_atributo uuid, p_opcion uuid, p_valor text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_valor text := trim(p_valor);
  v_tipo  public.tipo_atributo;
  v_id    uuid;
begin
  perform pkg_admin._exigir_moderacion();
  select tipo into v_tipo from public.atributos where id = p_atributo;
  if not found then
    raise exception 'No encontramos ese atributo' using errcode = 'TC404';
  end if;
  if v_tipo <> 'lista' then
    raise exception 'Solo los atributos de tipo lista tienen opciones' using errcode = 'TC409';
  end if;
  if char_length(coalesce(v_valor, '')) not between 1 and 40 then
    raise exception 'La opción tiene que tener entre 1 y 40 caracteres' using errcode = 'TC400';
  end if;

  if p_opcion is null then
    insert into public.atributo_opciones (atributo_id, valor, orden)
    values (p_atributo, v_valor,
            (select coalesce(max(orden), 0) + 1 from public.atributo_opciones where atributo_id = p_atributo))
    returning id into v_id;
  else
    update public.atributo_opciones set valor = v_valor
    where id = p_opcion and atributo_id = p_atributo
    returning id into v_id;
    if v_id is null then
      raise exception 'No encontramos esa opción' using errcode = 'TC404';
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'valor', v_valor);
exception
  when unique_violation then
    raise exception 'La opción «%» ya existe', v_valor using errcode = 'TC409';
end $$;

create or replace function pkg_admin.eliminar_opcion(p_opcion uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_valor text;
begin
  perform pkg_admin._exigir_moderacion();
  select valor into v_valor from public.atributo_opciones where id = p_opcion for update;
  if not found then
    raise exception 'No encontramos esa opción' using errcode = 'TC404';
  end if;
  if pkg_admin._opcion_en_uso(p_opcion) then
    raise exception 'Hay productos que usan «%»: no se puede borrar', v_valor using errcode = 'TC409';
  end if;
  delete from public.atributo_opciones where id = p_opcion;
end $$;

-- ----------------------------------------------------------------------------
-- Territorio: provincias, localidades y tarifas de envío
-- ----------------------------------------------------------------------------

-- Provincias con sus cifras y las localidades de una (por defecto, la primera
-- activa). Servidor: cuenta tiendas y direcciones de todos.
create or replace function pkg_admin.territorio(p_provincia uuid default null)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_provincia uuid := coalesce(
    (select id from public.provincias where id = p_provincia),
    (select id from public.provincias order by activa desc, nombre limit 1));
begin
  return jsonb_build_object(
    'provincias', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pr.id,
               'nombre', pr.nombre,
               'activa', pr.activa,
               'localidades', (select count(*) from public.localidades l where l.provincia_id = pr.id),
               'localidadesActivas', (select count(*) from public.localidades l
                                      where l.provincia_id = pr.id and l.activa),
               'tiendas', (select count(*) from public.tiendas t
                           join public.localidades l on l.id = t.localidad_id
                           where l.provincia_id = pr.id and t.estado <> 'archivada')
             ) order by pr.activa desc, pr.nombre), '[]'::jsonb)
      from public.provincias pr),
    'provincia', (
      select jsonb_build_object('id', pr.id, 'nombre', pr.nombre, 'activa', pr.activa)
      from public.provincias pr where pr.id = v_provincia),
    'localidades', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', l.id,
               'nombre', l.nombre,
               'activa', l.activa,
               'tiendas', (select count(*) from public.tiendas t
                           where t.localidad_id = l.id and t.estado <> 'archivada'),
               'direcciones', (select count(*) from public.direcciones d where d.localidad_id = l.id),
               'tarifa', (select jsonb_build_object('costo', te.costo, 'activa', te.activa)
                          from public.tarifas_envio te where te.localidad_id = l.id)
             ) order by l.nombre), '[]'::jsonb)
      from public.localidades l
      where l.provincia_id = v_provincia),
    'sinEnvio', (
      select count(*) from public.localidades l
      join public.provincias pr on pr.id = l.provincia_id
      where l.activa and pr.activa
        and not exists (select 1 from public.tarifas_envio te where te.localidad_id = l.id and te.activa))
  );
end $$;

-- Crea (p_provincia null, nace inactiva) o renombra. El slug solo se fija al crearla.
create or replace function pkg_admin.guardar_provincia(p_provincia uuid, p_nombre text, p_slug text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre text := trim(p_nombre);
  v_id     uuid;
begin
  perform pkg_admin._exigir_logistica();
  if p_provincia is null then
    perform pkg_admin._validar_nombre(v_nombre, p_slug);
    insert into public.provincias (nombre, slug) values (v_nombre, p_slug) returning id into v_id;
  else
    perform pkg_admin._validar_nombre(v_nombre, 'x');
    update public.provincias set nombre = v_nombre where id = p_provincia returning id into v_id;
    if v_id is null then
      raise exception 'No encontramos esa provincia' using errcode = 'TC404';
    end if;
  end if;
  return (select jsonb_build_object('id', id, 'nombre', nombre, 'activa', activa)
          from public.provincias where id = v_id);
exception
  when unique_violation then
    raise exception 'Ya existe la provincia «%»', v_nombre using errcode = 'TC409';
end $$;

-- Para activar una provincia tiene que tener al menos una localidad activa.
create or replace function pkg_admin.activar_provincia(p_provincia uuid, p_activa boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v public.provincias;
begin
  perform pkg_admin._exigir_logistica();
  if p_activa is null then
    raise exception 'Elegí si la provincia está activa o no' using errcode = 'TC400';
  end if;
  select * into v from public.provincias where id = p_provincia for update;
  if not found then
    raise exception 'No encontramos esa provincia' using errcode = 'TC404';
  end if;
  if p_activa and not exists (select 1 from public.localidades where provincia_id = p_provincia and activa) then
    raise exception 'Activá al menos una localidad de % antes', v.nombre using errcode = 'TC409';
  end if;
  update public.provincias set activa = p_activa where id = p_provincia and activa <> p_activa;
  return jsonb_build_object('id', v.id, 'nombre', v.nombre, 'activa', p_activa);
end $$;

-- Crea (p_localidad null, nace activa) o renombra. El slug solo se fija al crearla.
create or replace function pkg_admin.guardar_localidad(
  p_provincia uuid, p_localidad uuid, p_nombre text, p_slug text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre    text := trim(p_nombre);
  v_provincia text;
  v_id        uuid;
begin
  perform pkg_admin._exigir_logistica();
  select nombre into v_provincia from public.provincias where id = p_provincia;
  if not found then
    raise exception 'No encontramos esa provincia' using errcode = 'TC404';
  end if;
  if p_localidad is null then
    perform pkg_admin._validar_nombre(v_nombre, p_slug);
    insert into public.localidades (provincia_id, nombre, slug)
    values (p_provincia, v_nombre, p_slug) returning id into v_id;
  else
    perform pkg_admin._validar_nombre(v_nombre, 'x');
    update public.localidades set nombre = v_nombre
    where id = p_localidad and provincia_id = p_provincia returning id into v_id;
    if v_id is null then
      raise exception 'No encontramos esa localidad' using errcode = 'TC404';
    end if;
  end if;
  return (select jsonb_build_object('id', id, 'nombre', nombre, 'activa', activa)
          from public.localidades where id = v_id);
exception
  when unique_violation then
    raise exception 'Ya existe «%» en %', v_nombre, v_provincia using errcode = 'TC409';
end $$;

create or replace function pkg_admin.activar_localidad(p_localidad uuid, p_activa boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v public.localidades;
begin
  perform pkg_admin._exigir_logistica();
  if p_activa is null then
    raise exception 'Elegí si la localidad está activa o no' using errcode = 'TC400';
  end if;
  update public.localidades set activa = p_activa where id = p_localidad returning * into v;
  if v.id is null then
    raise exception 'No encontramos esa localidad' using errcode = 'TC404';
  end if;
  return jsonb_build_object('id', v.id, 'nombre', v.nombre, 'activa', v.activa);
end $$;

-- Solo se borra una localidad sin tiendas ni direcciones (sirve para corregir
-- una carga equivocada). Su tarifa de envío se borra con ella.
create or replace function pkg_admin.eliminar_localidad(p_localidad uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_admin._exigir_logistica();
  perform 1 from public.localidades where id = p_localidad for update;
  if not found then
    raise exception 'No encontramos esa localidad' using errcode = 'TC404';
  end if;
  if pkg_admin._localidad_en_uso(p_localidad) then
    raise exception 'Tiene tiendas o direcciones cargadas: desactivala en lugar de borrarla' using errcode = 'TC409';
  end if;
  delete from public.tarifas_envio where localidad_id = p_localidad;
  delete from public.localidades where id = p_localidad;
end $$;

-- ¿Alguna tienda o dirección (de cualquier usuario) está en esta localidad?
create or replace function pkg_admin._localidad_en_uso(p_localidad uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_admin() and (
    exists (select 1 from public.tiendas where localidad_id = p_localidad)
    or exists (select 1 from public.direcciones where localidad_id = p_localidad))
$$;

-- Costo de envío a una localidad. Sin tarifa activa no se hacen entregas ahí.
create or replace function pkg_admin.tarifa_envio(p_localidad uuid, p_costo numeric, p_activa boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v public.tarifas_envio;
begin
  perform pkg_admin._exigir_logistica();
  if not exists (select 1 from public.localidades where id = p_localidad) then
    raise exception 'No encontramos esa localidad' using errcode = 'TC404';
  end if;
  if p_costo is null or p_costo < 0 or p_costo > 10000000 then
    raise exception 'Ingresá un costo entre $ 0 y $ 10.000.000' using errcode = 'TC400';
  end if;
  insert into public.tarifas_envio (localidad_id, costo, activa)
  values (p_localidad, round(p_costo, 2), coalesce(p_activa, true))
  on conflict (localidad_id) do update set costo = excluded.costo, activa = excluded.activa
  returning * into v;
  return jsonb_build_object('localidad_id', v.localidad_id, 'costo', v.costo, 'activa', v.activa);
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  public.categoria_activa(uuid),
  pkg_admin._productos_en(text),
  pkg_admin._uso_atributo(uuid, text),
  pkg_admin._opcion_en_uso(uuid),
  pkg_admin._variantes_de(uuid),
  pkg_admin._quitar_de_carritos(text),
  pkg_admin._exigir_moderacion(),
  pkg_admin._exigir_logistica(),
  pkg_admin._validar_nombre(text, text, integer),
  pkg_admin._localidad_en_uso(uuid),
  pkg_admin.categorias(),
  pkg_admin.categoria(uuid),
  pkg_admin.guardar_categoria(uuid, text, text, uuid, numeric),
  pkg_admin.activar_categoria(uuid, boolean),
  pkg_admin.ordenar_categoria(uuid, text),
  pkg_admin.eliminar_categoria(uuid),
  pkg_admin.guardar_atributo_categoria(uuid, uuid, boolean, boolean),
  pkg_admin.quitar_atributo_categoria(uuid, uuid),
  pkg_admin.atributos(),
  pkg_admin.guardar_atributo(uuid, text, public.tipo_atributo, text, boolean),
  pkg_admin.eliminar_atributo(uuid),
  pkg_admin.guardar_opcion(uuid, uuid, text),
  pkg_admin.eliminar_opcion(uuid),
  pkg_admin.territorio(uuid),
  pkg_admin.guardar_provincia(uuid, text, text),
  pkg_admin.activar_provincia(uuid, boolean),
  pkg_admin.guardar_localidad(uuid, uuid, text, text),
  pkg_admin.activar_localidad(uuid, boolean),
  pkg_admin.eliminar_localidad(uuid),
  pkg_admin.tarifa_envio(uuid, numeric, boolean)
from public, anon, authenticated, service_role;

-- La política de productos la evalúa también el visitante.
grant execute on function public.categoria_activa(uuid) to anon, authenticated;

-- Los cambios corren como el admin: validan el rol adentro y RLS hace el resto.
grant execute on function
  pkg_admin._productos_en(text),
  pkg_admin._uso_atributo(uuid, text),
  pkg_admin._opcion_en_uso(uuid),
  pkg_admin._variantes_de(uuid),
  pkg_admin._quitar_de_carritos(text),
  pkg_admin._exigir_moderacion(),
  pkg_admin._exigir_logistica(),
  pkg_admin._validar_nombre(text, text, integer),
  pkg_admin._localidad_en_uso(uuid),
  pkg_admin.guardar_categoria(uuid, text, text, uuid, numeric),
  pkg_admin.activar_categoria(uuid, boolean),
  pkg_admin.ordenar_categoria(uuid, text),
  pkg_admin.eliminar_categoria(uuid),
  pkg_admin.guardar_atributo_categoria(uuid, uuid, boolean, boolean),
  pkg_admin.quitar_atributo_categoria(uuid, uuid),
  pkg_admin.guardar_atributo(uuid, text, public.tipo_atributo, text, boolean),
  pkg_admin.eliminar_atributo(uuid),
  pkg_admin.guardar_opcion(uuid, uuid, text),
  pkg_admin.eliminar_opcion(uuid),
  pkg_admin.guardar_provincia(uuid, text, text),
  pkg_admin.activar_provincia(uuid, boolean),
  pkg_admin.guardar_localidad(uuid, uuid, text, text),
  pkg_admin.activar_localidad(uuid, boolean),
  pkg_admin.eliminar_localidad(uuid),
  pkg_admin.tarifa_envio(uuid, numeric, boolean)
to authenticated;
