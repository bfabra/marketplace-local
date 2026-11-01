-- ============================================================================
-- Portada y logo de la tienda. Las columnas portada_url y logo_url existen
-- desde ..._0200; guardan la ruta del archivo en el storage (como las fotos de
-- productos) y el API arma la URL. El listado y la página pública las
-- muestran; el listado suma "nueva" (alta de los últimos 30 días).
-- Convenciones en ..._1800.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pkg_tiendas.cambiar_imagen
-- ----------------------------------------------------------------------------

-- p_tipo: 'portada' o 'logo'. p_ruta null quita la imagen. Devuelve la ruta
-- anterior (o null) para que el API borre el archivo.
create or replace function pkg_tiendas.cambiar_imagen(p_tienda uuid, p_tipo text, p_ruta text)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_anterior text;
begin
  if not public.tiene_permiso(p_tienda, 'configuracion.editar') then
    raise exception 'No tenés permiso para modificar los datos de esta tienda' using errcode = 'TC403';
  end if;
  if p_tipo not in ('portada', 'logo') then
    raise exception 'Tipo de imagen inválido' using errcode = 'TC400';
  end if;
  if p_ruta is not null and p_ruta not like 'tiendas/' || p_tienda || '/%' then
    raise exception 'La imagen no pertenece a esta tienda' using errcode = 'TC400';
  end if;

  select case p_tipo when 'portada' then portada_url else logo_url end
    into v_anterior
    from public.tiendas where id = p_tienda;

  update public.tiendas set
    portada_url = case when p_tipo = 'portada' then p_ruta else portada_url end,
    logo_url    = case when p_tipo = 'logo'    then p_ruta else logo_url end
  where id = p_tienda;
  return v_anterior;
end $$;

-- Panel de la tienda: suma portada y logo.
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
    'portada', t.portada_url,
    'logo', t.logo_url,
    'localidad', jsonb_build_object('id', l.id, 'nombre', l.nombre, 'provincia', pr.nombre),
    'rubro', case when r.id is not null then jsonb_build_object('id', r.id, 'nombre', r.nombre, 'slug', r.slug) end,
    'subrubro', case when s.id is not null then jsonb_build_object('id', s.id, 'nombre', s.nombre) end,
    'especialidades', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre) order by e.orden, e.nombre)
      from public.tienda_especialidades te
      join public.rubros e on e.id = te.rubro_id
      where te.tienda_id = t.id
    ), '[]'::jsonb),
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
        'estado', s2.estado,
        'fin_periodo', s2.fin_periodo
      )
      from public.suscripciones s2
      join public.planes pl on pl.id = s2.plan_id
      where s2.tienda_id = t.id and s2.estado in ('activa', 'en_gracia', 'pendiente')
      limit 1
    ),
    'mercadoPago', pkg_tiendas._estado_mp(t.id)
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  left join public.rubros r on r.id = t.rubro_id
  left join public.rubros s on s.id = t.subrubro_id
  where t.id = p_tienda
$$;

-- ----------------------------------------------------------------------------
-- pkg_catalogo: listado y página pública con portada y logo
-- ----------------------------------------------------------------------------
create or replace function pkg_catalogo.tiendas()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'nombre', t.nombre,
           'slug', t.slug,
           'descripcion', t.descripcion,
           'localidad', l.nombre,
           'localidad_id', l.id,
           'portada', t.portada_url,
           'logo', t.logo_url,
           'nueva', t.creado_en > now() - interval '30 days',
           'productos', (select count(*) from public.productos p
                         where p.tienda_id = t.id and p.estado = 'publicado'),
           'rubro', pkg_catalogo.rubro(t.id)
         ) order by t.nombre), '[]'::jsonb)
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  where t.estado = 'activa'
$$;

create or replace function pkg_catalogo.tienda(p_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'nombre', t.nombre,
    'slug', t.slug,
    'descripcion', t.descripcion,
    'telefono', t.telefono,
    'direccion', t.direccion,
    'localidad', l.nombre || ', ' || pr.nombre,
    'localidad_id', l.id,
    'desde', t.creado_en,
    'portada', t.portada_url,
    'logo', t.logo_url,
    'rubro', pkg_catalogo.rubro(t.id),
    'seguidores', pkg_catalogo._seguidores(t.id),
    'productos', pkg_catalogo.tarjetas(array(
      select p.id from public.productos p
      where p.tienda_id = t.id and p.estado = 'publicado'
      order by p.publicado_en desc))
  )
  from public.tiendas t
  join public.localidades l on l.id = t.localidad_id
  join public.provincias pr on pr.id = l.provincia_id
  where t.slug = p_slug and t.estado = 'activa'
$$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function pkg_tiendas.cambiar_imagen(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function pkg_tiendas.cambiar_imagen(uuid, text, text) to authenticated;
