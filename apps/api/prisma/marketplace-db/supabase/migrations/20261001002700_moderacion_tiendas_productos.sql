-- ============================================================================
-- Panel de administración, etapa 2: seguimiento de tiendas y vendedores, y
-- moderación de productos. Convenciones en ..._1800.
--
-- Revisión mixta de productos:
--   · Una tienda nueva manda sus primeros productos a revisión: al publicarlos
--     quedan pausados con motivo 'revision' hasta que moderación los aprueba.
--   · Con N productos aprobados (configuración 'revision_productos_iniciales')
--     la tienda publica al instante.
--   · Moderación puede fijar la política de cada tienda: 'siempre' revisa todo,
--     'nunca' no revisa nada, 'automatica' sigue la regla anterior.
--   · Un producto rechazado o pausado por moderación vuelve a pasar por
--     revisión cuando el vendedor lo publica de nuevo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Columnas nuevas
-- ----------------------------------------------------------------------------
alter table public.tiendas
  add column motivo_estado      text,
  add column revision_productos text not null default 'automatica'
    constraint tiendas_revision_productos check (revision_productos in ('automatica', 'siempre', 'nunca'));

alter table public.productos
  add column requiere_revision boolean not null default false,
  add column revision_desde    timestamptz,
  add column nota_moderacion   text,
  add column aprobado_en       timestamptz,
  add column aprobado_por      uuid references public.perfiles(id) on delete set null;

create index if not exists productos_aprobado_por_idx on public.productos (aprobado_por);
create index if not exists productos_en_revision_idx on public.productos (revision_desde)
  where motivo_pausa = 'revision';
create index if not exists productos_aprobados_idx on public.productos (tienda_id)
  where aprobado_en is not null;
create index if not exists denuncias_tienda_idx on public.denuncias (tienda_id) where estado = 'abierta';
create index if not exists auditoria_entidad_fila_idx on public.auditoria (entidad, entidad_id, id desc);

-- Moderación revisa productos sin publicar: necesita ver sus variantes, fotos y
-- ficha (productos_control busca la variante activa al aprobar).
create policy "variantes: moderación lee" on public.variantes
  for select to authenticated using (public.es_admin('moderacion'));
create policy "imagenes: moderación lee" on public.imagenes_producto
  for select to authenticated using (public.es_admin('moderacion'));
create policy "producto_atributos: moderación lee" on public.producto_atributos
  for select to authenticated using (public.es_admin('moderacion'));

-- Lo que ya se publicó cuenta como aprobado. Sin auditoría ni fecha de
-- actualización: es un dato inicial, no un cambio de nadie.
alter table public.productos disable trigger auditar;
alter table public.productos disable trigger actualizado_en;
update public.productos set aprobado_en = publicado_en where publicado_en is not null;
alter table public.productos enable trigger auditar;
alter table public.productos enable trigger actualizado_en;

insert into public.configuracion (clave, valor, descripcion, etiqueta, grupo, minimo, maximo) values
  ('revision_productos_habilitada', 'true',
   'Los primeros productos de cada tienda nueva pasan por moderación antes de verse en el sitio',
   'Revisar los productos de tiendas nuevas', 'Moderación', null, null),
  ('revision_productos_iniciales', '3',
   'Cuántos productos aprobados necesita una tienda para publicar sin revisión',
   'Productos a revisar por tienda nueva', 'Moderación', 1, 50)
on conflict (clave) do nothing;

-- ----------------------------------------------------------------------------
-- Reglas
-- ----------------------------------------------------------------------------

-- ¿Lo que publique esta tienda tiene que pasar por moderación?
create or replace function public.tienda_requiere_revision(p_tienda uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case t.revision_productos
           when 'siempre' then true
           when 'nunca'   then false
           else public.config_bool('revision_productos_habilitada')
                and (select count(*) from public.productos p
                     where p.tienda_id = t.id and p.aprobado_en is not null)
                    < coalesce(public.config_int('revision_productos_iniciales'), 3)
         end
  from public.tiendas t
  where t.id = p_tienda
$$;

-- La política de revisión y el motivo del estado solo los cambia moderación.
create or replace function public.tg_tiendas_moderacion()
returns trigger language plpgsql as $$
begin
  if public.es_usuario_final() and not public.es_admin('moderacion') then
    if tg_op = 'INSERT' then
      new.motivo_estado := null;
      new.revision_productos := 'automatica';
    else
      new.motivo_estado := old.motivo_estado;
      new.revision_productos := old.revision_productos;
    end if;
  end if;
  return new;
end $$;

create trigger tiendas_moderacion
  before insert or update on public.tiendas
  for each row execute function public.tg_tiendas_moderacion();

-- Corre después de productos_control (los triggers BEFORE van en orden
-- alfabético): el permiso, el límite del plan y la variante ya están validados.
create or replace function public.tg_productos_revision()
returns trigger language plpgsql as $$
declare
  v_moderador boolean := public.es_admin('moderacion');
  v_vendedor  boolean := public.es_usuario_final() and not v_moderador;
begin
  -- El vendedor no toca los datos de moderación ni saca un producto de un motivo de moderación.
  if v_vendedor then
    if tg_op = 'INSERT' then
      new.requiere_revision := false;
      new.revision_desde := null;
      new.nota_moderacion := null;
      new.aprobado_en := null;
      new.aprobado_por := null;
      if new.motivo_pausa in ('moderacion', 'revision', 'rechazado') then
        new.motivo_pausa := 'manual';
      end if;
    else
      new.requiere_revision := old.requiere_revision;
      new.revision_desde := old.revision_desde;
      new.nota_moderacion := old.nota_moderacion;
      new.aprobado_en := old.aprobado_en;
      new.aprobado_por := old.aprobado_por;
      if new.estado = 'pausado' and old.estado = 'pausado'
         and old.motivo_pausa in ('moderacion', 'revision', 'rechazado') then
        new.motivo_pausa := old.motivo_pausa;
      elsif new.motivo_pausa in ('moderacion', 'revision', 'rechazado')
            and new.motivo_pausa is distinct from old.motivo_pausa then
        new.motivo_pausa := 'manual';
      end if;
    end if;
  end if;

  if new.estado = 'publicado' and (tg_op = 'INSERT' or old.estado <> 'publicado') then
    if v_vendedor and (
         new.requiere_revision
         or (tg_op = 'UPDATE' and old.motivo_pausa in ('revision', 'rechazado'))
         or public.tienda_requiere_revision(new.tienda_id)) then
      new.estado := 'pausado';
      new.motivo_pausa := 'revision';
      new.publicado_en := case when tg_op = 'UPDATE' then old.publicado_en end;
      new.revision_desde := case when tg_op = 'UPDATE' and old.motivo_pausa = 'revision'
                                 then coalesce(old.revision_desde, now()) else now() end;
    else
      if v_moderador and tg_op = 'UPDATE'
         and (old.motivo_pausa in ('revision', 'rechazado', 'moderacion') or old.requiere_revision) then
        new.aprobado_por := auth.uid();
        new.aprobado_en := now();
      end if;
      new.aprobado_en := coalesce(new.aprobado_en, now());
      new.requiere_revision := false;
      new.revision_desde := null;
      new.nota_moderacion := null;
    end if;
  end if;
  return new;
end $$;

create trigger productos_revision
  before insert or update on public.productos
  for each row execute function public.tg_productos_revision();

-- ----------------------------------------------------------------------------
-- Panel del vendedor: el motivo de moderación también le llega a él
-- ----------------------------------------------------------------------------
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
                 'nota_moderacion', p.nota_moderacion,
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
    ),
    'revisionActiva', public.tienda_requiere_revision(p_tienda)
  );
end $$;

create or replace function pkg_productos.detalle(p_tienda uuid, p_producto uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'slug', p.slug,
    'descripcion', p.descripcion,
    'estado', p.estado,
    'motivo_pausa', p.motivo_pausa,
    'nota_moderacion', p.nota_moderacion,
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

create or replace function pkg_tiendas.detalle(p_tienda uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'nombre', t.nombre,
    'slug', t.slug,
    'descripcion', t.descripcion,
    'cuit', t.cuit,
    'razon_social', t.razon_social,
    'telefono', t.telefono,
    'email', t.email,
    'direccion', t.direccion,
    'estado', t.estado,
    'motivo_estado', t.motivo_estado,
    'creado_en', t.creado_en,
    'localidad', jsonb_build_object('id', l.id, 'nombre', l.nombre, 'provincia', pr.nombre),
    'esDuenio', t.propietario_id = auth.uid(),
    'permisos', coalesce((
      select jsonb_agg(pe.codigo order by pe.codigo)
      from public.permisos pe
      where public.tiene_permiso(t.id, pe.codigo)
    ), '[]'::jsonb),
    'plan', (
      select jsonb_build_object(
        'nombre', pl.nombre,
        'es_gratis', pl.es_gratis,
        'max_productos', pl.max_productos,
        'max_empleados', pl.max_empleados,
        'estado', s.estado,
        'fin_periodo', s.fin_periodo
      )
      from public.suscripciones s
      join public.planes pl on pl.id = s.plan_id
      where s.tienda_id = t.id and s.estado in ('activa', 'en_gracia', 'pendiente')
      limit 1
    ),
    'mercadoPago', pkg_tiendas._estado_mp(t.id)
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  where t.id = p_tienda
$$;

-- ----------------------------------------------------------------------------
-- Seguimiento de tiendas (servidor: los correos viven en auth.users)
-- ----------------------------------------------------------------------------

-- Ventas que cuentan: pagadas y no canceladas.
create or replace function pkg_admin._venta_valida(p_estado public.estado_pedido_tienda)
returns boolean language sql immutable set search_path = '' as $$
  select p_estado not in ('pendiente', 'cancelado', 'rechazado')
$$;

-- Listado paginado con las cifras de cada tienda. Busca por nombre, CUIT o
-- correo del dueño.
create or replace function pkg_admin.tiendas(
  p_estado public.estado_tienda default null, p_buscar text default null, p_pagina integer default 1
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_por_pagina constant integer := 20;
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_buscar text := nullif(trim(p_buscar), '');
  v_patron text := '%' || public.f_unaccent(lower(nullif(trim(p_buscar), ''))) || '%';
  v_items  jsonb;
  v_total  integer;
begin
  select count(*) into v_total
  from public.tiendas t
  left join auth.users u on u.id = t.propietario_id
  where (p_estado is null or t.estado = p_estado)
    and (v_buscar is null
         or public.f_unaccent(lower(t.nombre)) like v_patron
         or t.cuit like '%' || v_buscar || '%'
         or lower(u.email) like v_patron);

  select coalesce(jsonb_agg(x.item order by x.creado_en desc), '[]'::jsonb) into v_items
  from (
    select t.creado_en, jsonb_build_object(
             'id', t.id,
             'nombre', t.nombre,
             'slug', t.slug,
             'cuit', t.cuit,
             'estado', t.estado,
             'motivo_estado', t.motivo_estado,
             'revision_productos', t.revision_productos,
             'creado_en', t.creado_en,
             'localidad', l.nombre,
             'duenio', jsonb_build_object('nombre', nullif(concat_ws(' ', p.nombre, p.apellido), ''), 'email', u.email),
             'mercadoPagoVinculada', exists (select 1 from public.cuentas_mp_tienda mp where mp.tienda_id = t.id),
             'plan', (select pl.nombre
                      from public.suscripciones s
                      join public.planes pl on pl.id = s.plan_id
                      where s.tienda_id = t.id and s.estado in ('activa', 'en_gracia', 'pendiente')
                      limit 1),
             'productos', (select jsonb_build_object(
                             'publicados', count(*) filter (where pr.estado = 'publicado'),
                             'enRevision', count(*) filter (where pr.motivo_pausa = 'revision'),
                             'total',      count(*) filter (where pr.estado <> 'archivado'))
                           from public.productos pr where pr.tienda_id = t.id),
             'ventas30', (select jsonb_build_object('pedidos', count(*), 'monto', coalesce(sum(pt.subtotal), 0))
                          from public.pedidos_tienda pt
                          where pt.tienda_id = t.id and pt.creado_en >= now() - interval '30 days'
                            and pkg_admin._venta_valida(pt.estado)),
             'denunciasAbiertas', (select count(*) from public.denuncias d
                                   where d.tienda_id = t.id and d.estado = 'abierta')
           ) as item
    from public.tiendas t
    join public.localidades l on l.id = t.localidad_id
    join public.perfiles p on p.id = t.propietario_id
    left join auth.users u on u.id = t.propietario_id
    where (p_estado is null or t.estado = p_estado)
      and (v_buscar is null
           or public.f_unaccent(lower(t.nombre)) like v_patron
           or t.cuit like '%' || v_buscar || '%'
           or lower(u.email) like v_patron)
    order by t.creado_en desc
    limit v_por_pagina offset (v_pagina - 1) * v_por_pagina
  ) x;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'pagina', v_pagina,
    'porPagina', v_por_pagina,
    'conteos', (select jsonb_object_agg(e.estado, coalesce(c.n, 0))
                from unnest(enum_range(null::public.estado_tienda)) e(estado)
                left join (select estado, count(*) n from public.tiendas group by estado) c using (estado))
  );
end $$;

-- Ficha de una tienda: dueño, equipo, plan, cifras, revisión y su historial.
create or replace function pkg_admin.tienda(p_tienda uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'nombre', t.nombre,
    'slug', t.slug,
    'descripcion', t.descripcion,
    'cuit', t.cuit,
    'razon_social', t.razon_social,
    'telefono', t.telefono,
    'email', t.email,
    'direccion', t.direccion,
    'estado', t.estado,
    'motivo_estado', t.motivo_estado,
    'revision_productos', t.revision_productos,
    'creado_en', t.creado_en,
    'localidad', l.nombre || ', ' || pr.nombre,
    'mercadoPagoVinculada', exists (select 1 from public.cuentas_mp_tienda mp where mp.tienda_id = t.id),
    'duenio', jsonb_build_object(
      'id', p.id,
      'nombre', nullif(concat_ws(' ', p.nombre, p.apellido), ''),
      'email', u.email,
      'telefono', p.telefono,
      'creado_en', p.creado_en,
      'otrasTiendas', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'nombre', o.nombre, 'estado', o.estado) order by o.creado_en)
        from public.tiendas o
        where o.propietario_id = t.propietario_id and o.id <> t.id
      ), '[]'::jsonb)),
    'equipo', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nombre', nullif(concat_ws(' ', mp.nombre, mp.apellido), ''),
               'email', mu.email,
               'rol', r.nombre,
               'estado', m.estado) order by m.creado_en)
      from public.miembros_tienda m
      join public.roles_tienda r on r.id = m.rol_id
      join public.perfiles mp on mp.id = m.usuario_id
      left join auth.users mu on mu.id = m.usuario_id
      where m.tienda_id = t.id and m.estado <> 'retirado'
    ), '[]'::jsonb),
    'suscripcion', (
      select jsonb_build_object(
               'plan', pl.nombre,
               'precio_mensual', pl.precio_mensual,
               'max_productos', pl.max_productos,
               'estado', s.estado,
               'inicio', s.inicio,
               'fin_periodo', s.fin_periodo,
               'gracia_hasta', s.gracia_hasta)
      from public.suscripciones s
      join public.planes pl on pl.id = s.plan_id
      where s.tienda_id = t.id
      order by (s.estado in ('activa', 'en_gracia', 'pendiente')) desc, s.creado_en desc
      limit 1),
    'productos', (
      select jsonb_build_object(
               'borrador',   count(*) filter (where x.estado = 'borrador'),
               'publicado',  count(*) filter (where x.estado = 'publicado'),
               'pausado',    count(*) filter (where x.estado = 'pausado'),
               'enRevision', count(*) filter (where x.motivo_pausa = 'revision'),
               'rechazados', count(*) filter (where x.motivo_pausa = 'rechazado'),
               'moderacion', count(*) filter (where x.motivo_pausa = 'moderacion'),
               'aprobados',  count(*) filter (where x.aprobado_en is not null))
      from public.productos x where x.tienda_id = t.id),
    'revision', jsonb_build_object(
      'activa', public.tienda_requiere_revision(t.id),
      'habilitadaGlobal', public.config_bool('revision_productos_habilitada'),
      'umbral', public.config_int('revision_productos_iniciales')),
    'ventas', (
      select jsonb_build_object(
               'pedidos30', count(*) filter (where pt.creado_en >= now() - interval '30 days'),
               'monto30',   coalesce(sum(pt.subtotal) filter (where pt.creado_en >= now() - interval '30 days'), 0),
               'pedidos',   count(*),
               'monto',     coalesce(sum(pt.subtotal), 0),
               'enCurso',   count(*) filter (where pt.estado in ('pago_confirmado', 'en_preparacion',
                              'listo_para_recoleccion', 'listo_para_retiro', 'recolectado', 'en_camino')))
      from public.pedidos_tienda pt
      where pt.tienda_id = t.id and pkg_admin._venta_valida(pt.estado)),
    'reclamosAbiertos', (
      select count(*) from public.reclamos rc
      join public.pedidos_tienda pt on pt.id = rc.pedido_tienda_id
      where pt.tienda_id = t.id and rc.estado in ('abierto', 'en_revision')),
    'denunciasAbiertas', (
      select count(*) from public.denuncias d where d.tienda_id = t.id and d.estado = 'abierta'),
    'historial', coalesce((
      select jsonb_agg(h.item order by h.id desc)
      from (
        select a.id, jsonb_build_object(
                 'fecha', a.creado_en,
                 'accion', a.accion,
                 'estado', a.despues ->> 'estado',
                 'estadoAnterior', a.antes ->> 'estado',
                 'motivo', a.despues ->> 'motivo_estado',
                 'revision', case when a.antes ->> 'revision_productos' is distinct from a.despues ->> 'revision_productos'
                                  then a.despues ->> 'revision_productos' end,
                 'actor', nullif(concat_ws(' ', ap.nombre, ap.apellido), '')) as item
        from public.auditoria a
        left join public.perfiles ap on ap.id = a.actor_id
        where a.entidad = 'tiendas' and a.entidad_id = t.id::text
          and (a.accion = 'INSERT'
               or a.antes ->> 'estado' is distinct from a.despues ->> 'estado'
               or a.antes ->> 'revision_productos' is distinct from a.despues ->> 'revision_productos')
        order by a.id desc
        limit 20
      ) h
    ), '[]'::jsonb)
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  join public.perfiles p on p.id = t.propietario_id
  left join auth.users u on u.id = t.propietario_id
  where t.id = p_tienda
$$;

-- Corre como moderación: el trigger de tiendas exige Mercado Pago para activar.
-- Suspender o archivar pide un motivo, que ve el vendedor en su panel.
drop function if exists pkg_admin.cambiar_estado_tienda(uuid, public.estado_tienda);
create or replace function pkg_admin.cambiar_estado_tienda(
  p_tienda uuid, p_estado public.estado_tienda, p_motivo text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_motivo text := nullif(trim(p_motivo), '');
  v_actual public.estado_tienda;
  v_tienda jsonb;
begin
  if not public.es_admin('moderacion') then
    raise exception 'Solo moderación cambia el estado de las tiendas' using errcode = 'TC403';
  end if;
  select estado into v_actual from public.tiendas where id = p_tienda for update;
  if not found then
    raise exception 'No encontramos esa tienda' using errcode = 'TC404';
  end if;
  if v_actual = p_estado then
    raise exception 'La tienda ya está en ese estado' using errcode = 'TC409';
  end if;
  if p_estado in ('suspendida', 'archivada') and char_length(coalesce(v_motivo, '')) < 5 then
    raise exception 'Contale a la tienda el motivo (al menos 5 caracteres)' using errcode = 'TC400';
  end if;

  update public.tiendas set estado = p_estado, motivo_estado = v_motivo
  where id = p_tienda
  returning jsonb_build_object('id', id, 'nombre', nombre, 'estado', estado, 'motivo_estado', motivo_estado)
  into v_tienda;
  return v_tienda;
end $$;

create or replace function pkg_admin.politica_revision(p_tienda uuid, p_politica text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_admin('moderacion') then
    raise exception 'Solo moderación cambia la revisión de productos' using errcode = 'TC403';
  end if;
  if p_politica is null or p_politica not in ('automatica', 'siempre', 'nunca') then
    raise exception 'Elegí cómo se revisan los productos de esta tienda' using errcode = 'TC400';
  end if;

  update public.tiendas set revision_productos = p_politica where id = p_tienda;
  if not found then
    raise exception 'No encontramos esa tienda' using errcode = 'TC404';
  end if;
  -- Después del update: una función stable dentro de returning no ve la fila nueva.
  return jsonb_build_object('id', p_tienda, 'revision_productos', p_politica,
                            'revisionActiva', public.tienda_requiere_revision(p_tienda));
end $$;

-- ----------------------------------------------------------------------------
-- Moderación de productos
-- ----------------------------------------------------------------------------

-- Cola de moderación (servidor). Vistas:
--   revision   → esperando aprobación, los más antiguos primero
--   rechazados → rechazados que el vendedor todavía no corrigió
--   moderacion → pausados por moderación
--   publicados → visibles en el sitio
--   todos      → todo menos lo archivado
create or replace function pkg_admin.productos(
  p_vista text default 'revision', p_buscar text default null,
  p_tienda uuid default null, p_pagina integer default 1
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_por_pagina constant integer := 20;
  v_vista  text := coalesce(p_vista, 'revision');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_buscar text := nullif(trim(p_buscar), '');
  v_patron text := '%' || public.f_unaccent(lower(nullif(trim(p_buscar), ''))) || '%';
  v_items  jsonb;
  v_total  integer;
begin
  if v_vista not in ('revision', 'rechazados', 'moderacion', 'publicados', 'todos') then
    raise exception 'Vista inválida' using errcode = 'TC400';
  end if;

  select count(*) into v_total
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id
  where (p_tienda is null or p.tienda_id = p_tienda)
    and case v_vista
          when 'revision'   then p.motivo_pausa = 'revision'
          when 'rechazados' then p.motivo_pausa = 'rechazado'
          when 'moderacion' then p.motivo_pausa = 'moderacion'
          when 'publicados' then p.estado = 'publicado'
          else p.estado <> 'archivado' end
    and (v_buscar is null
         or public.f_unaccent(lower(p.nombre)) like v_patron
         or public.f_unaccent(lower(t.nombre)) like v_patron);

  select coalesce(jsonb_agg(x.item order by x.n), '[]'::jsonb) into v_items
  from (
    select row_number() over (order by
             case when v_vista = 'revision' then p.revision_desde end asc nulls last,
             p.actualizado_en desc) as n,
           jsonb_build_object(
             'id', p.id,
             'nombre', p.nombre,
             'slug', p.slug,
             'estado', p.estado,
             'motivo_pausa', p.motivo_pausa,
             'nota_moderacion', p.nota_moderacion,
             'revision_desde', p.revision_desde,
             'publicado_en', p.publicado_en,
             'actualizado_en', p.actualizado_en,
             'categoria', c.nombre,
             'tienda', jsonb_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug, 'estado', t.estado),
             'imagen', pkg_catalogo.imagen_principal(p.id)
           ) || pkg_catalogo.resumen_precio(p.id) as item
    from public.productos p
    join public.tiendas t on t.id = p.tienda_id
    join public.categorias c on c.id = p.categoria_id
    where (p_tienda is null or p.tienda_id = p_tienda)
      and case v_vista
            when 'revision'   then p.motivo_pausa = 'revision'
            when 'rechazados' then p.motivo_pausa = 'rechazado'
            when 'moderacion' then p.motivo_pausa = 'moderacion'
            when 'publicados' then p.estado = 'publicado'
            else p.estado <> 'archivado' end
      and (v_buscar is null
           or public.f_unaccent(lower(p.nombre)) like v_patron
           or public.f_unaccent(lower(t.nombre)) like v_patron)
    order by n
    limit v_por_pagina offset (v_pagina - 1) * v_por_pagina
  ) x;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'pagina', v_pagina,
    'porPagina', v_por_pagina,
    'tienda', (select jsonb_build_object('id', t.id, 'nombre', t.nombre) from public.tiendas t where t.id = p_tienda),
    'conteos', (select jsonb_build_object(
                  'revision',   count(*) filter (where p.motivo_pausa = 'revision'),
                  'rechazados', count(*) filter (where p.motivo_pausa = 'rechazado'),
                  'moderacion', count(*) filter (where p.motivo_pausa = 'moderacion'))
                from public.productos p
                where p.estado = 'pausado' and (p_tienda is null or p.tienda_id = p_tienda))
  );
end $$;

-- Producto completo para revisarlo (servidor). Null si no existe.
create or replace function pkg_admin.producto(p_producto uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'slug', p.slug,
    'descripcion', p.descripcion,
    'estado', p.estado,
    'motivo_pausa', p.motivo_pausa,
    'nota_moderacion', p.nota_moderacion,
    'requiere_revision', p.requiere_revision,
    'revision_desde', p.revision_desde,
    'publicado_en', p.publicado_en,
    'aprobado_en', p.aprobado_en,
    'aprobadoPor', nullif(concat_ws(' ', ap.nombre, ap.apellido), ''),
    'creado_en', p.creado_en,
    'actualizado_en', p.actualizado_en,
    'categoria', jsonb_build_object('nombre', c.nombre, 'ruta', c.ruta),
    'tienda', jsonb_build_object(
      'id', t.id, 'nombre', t.nombre, 'slug', t.slug, 'estado', t.estado,
      'revision_productos', t.revision_productos,
      'aprobados', (select count(*) from public.productos x where x.tienda_id = t.id and x.aprobado_en is not null)),
    'ficha', coalesce((
      select jsonb_agg(jsonb_build_object(
               'atributo', a.nombre,
               'valor', concat_ws(' ', coalesce(o.valor, pa.valor_texto, pa.valor_numero::text), a.unidad))
             order by a.nombre)
      from public.producto_atributos pa
      join public.atributos a on a.id = pa.atributo_id
      left join public.atributo_opciones o on o.id = pa.opcion_id
      where pa.producto_id = p.id
    ), '[]'::jsonb),
    'variantes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id,
               'sku', v.sku,
               'precio', v.precio,
               'precio_oferta', v.precio_oferta,
               'stock', v.stock,
               'opciones', (select string_agg(a.nombre || ': ' || o.valor, ' · ' order by a.nombre)
                            from public.variante_opciones vo
                            join public.atributos a on a.id = vo.atributo_id
                            join public.atributo_opciones o on o.id = vo.opcion_id
                            where vo.variante_id = v.id)
             ) order by v.creado_en, v.id)
      from public.variantes v
      where v.producto_id = p.id and v.activa
    ), '[]'::jsonb),
    'imagenes', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'ruta', i.ruta_storage) order by i.orden, i.creado_en)
      from public.imagenes_producto i
      where i.producto_id = p.id
    ), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(h.item order by h.id desc)
      from (
        select a.id, jsonb_build_object(
                 'fecha', a.creado_en,
                 'estado', a.despues ->> 'estado',
                 'motivo', a.despues ->> 'motivo_pausa',
                 'nota', a.despues ->> 'nota_moderacion',
                 'actor', nullif(concat_ws(' ', hp.nombre, hp.apellido), '')) as item
        from public.auditoria a
        left join public.perfiles hp on hp.id = a.actor_id
        where a.entidad = 'productos' and a.entidad_id = p.id::text
          and (a.accion = 'INSERT'
               or a.antes ->> 'estado' is distinct from a.despues ->> 'estado'
               or a.antes ->> 'motivo_pausa' is distinct from a.despues ->> 'motivo_pausa')
        order by a.id desc
        limit 15
      ) h
    ), '[]'::jsonb)
  )
  from public.productos p
  join public.tiendas t on t.id = p.tienda_id
  join public.categorias c on c.id = p.categoria_id
  left join public.perfiles ap on ap.id = p.aprobado_por
  where p.id = p_producto
$$;

-- Corre como moderación: el trigger registra quién aprobó y la auditoría, el resto.
-- Rechazar o pausar pide una nota para el vendedor.
create or replace function pkg_admin.moderar_producto(p_producto uuid, p_accion text, p_nota text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nota text := nullif(trim(p_nota), '');
  v      public.productos;
begin
  if not public.es_admin('moderacion') then
    raise exception 'Solo moderación revisa productos' using errcode = 'TC403';
  end if;
  if p_accion is null or p_accion not in ('aprobar', 'rechazar', 'pausar', 'reactivar') then
    raise exception 'Acción inválida' using errcode = 'TC400';
  end if;

  select * into v from public.productos where id = p_producto for update;
  if not found then
    raise exception 'No encontramos ese producto' using errcode = 'TC404';
  end if;
  if p_accion in ('rechazar', 'pausar') and char_length(coalesce(v_nota, '')) < 5 then
    raise exception 'Contale al vendedor qué tiene que corregir (al menos 5 caracteres)' using errcode = 'TC400';
  end if;

  begin
    case p_accion
      when 'aprobar' then
        if v.motivo_pausa is distinct from 'revision' and v.motivo_pausa is distinct from 'rechazado' then
          raise exception 'Este producto ya no está esperando revisión' using errcode = 'TC409';
        end if;
        update public.productos set estado = 'publicado' where id = p_producto;
      when 'rechazar' then
        if v.motivo_pausa is distinct from 'revision' then
          raise exception 'Este producto ya no está esperando revisión' using errcode = 'TC409';
        end if;
        update public.productos
        set estado = 'pausado', motivo_pausa = 'rechazado', nota_moderacion = v_nota, requiere_revision = true
        where id = p_producto;
      when 'pausar' then
        if v.estado <> 'publicado' then
          raise exception 'Solo se pueden pausar productos publicados' using errcode = 'TC409';
        end if;
        update public.productos
        set estado = 'pausado', motivo_pausa = 'moderacion', nota_moderacion = v_nota, requiere_revision = true
        where id = p_producto;
      when 'reactivar' then
        if v.motivo_pausa is distinct from 'moderacion' then
          raise exception 'Este producto no está pausado por moderación' using errcode = 'TC409';
        end if;
        update public.productos set estado = 'publicado' where id = p_producto;
    end case;
  exception
    when raise_exception then
      -- Límite del plan o falta de variantes, validados por productos_control.
      raise exception 'No se puede publicar: %', sqlerrm using errcode = 'TC409';
  end;

  return (select jsonb_build_object('id', id, 'estado', estado, 'motivo_pausa', motivo_pausa,
                                    'nota_moderacion', nota_moderacion)
          from public.productos where id = p_producto);
end $$;

-- ----------------------------------------------------------------------------
-- Tablero: suma los productos esperando revisión
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
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  public.tienda_requiere_revision(uuid),
  pkg_admin._venta_valida(public.estado_pedido_tienda),
  pkg_admin.tiendas(public.estado_tienda, text, integer),
  pkg_admin.tienda(uuid),
  pkg_admin.cambiar_estado_tienda(uuid, public.estado_tienda, text),
  pkg_admin.politica_revision(uuid, text),
  pkg_admin.productos(text, text, uuid, integer),
  pkg_admin.producto(uuid),
  pkg_admin.moderar_producto(uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.tienda_requiere_revision(uuid) to authenticated;
grant execute on function
  pkg_admin.cambiar_estado_tienda(uuid, public.estado_tienda, text),
  pkg_admin.politica_revision(uuid, text),
  pkg_admin.moderar_producto(uuid, text, text)
to authenticated;
