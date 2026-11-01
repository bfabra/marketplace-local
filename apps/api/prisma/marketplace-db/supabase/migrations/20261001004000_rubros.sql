-- ============================================================================
-- Rubros: el estándar para clasificar las tiendas. Convenciones en ..._1800.
--
--   nivel 1  rubro principal   obligatorio para la tienda (uno)
--   nivel 2  subrubro          opcional (uno, del rubro elegido)
--   nivel 3  especialidad      opcional (varias, del subrubro elegido). Hoy solo
--                              las tiene Alquileres: Inmuebles → Casas, Departamentos…
--
-- No reemplaza a las categorías de productos: el rubro describe al negocio.
-- El superadmin mantiene la lista. Un rubro inactivo no se ofrece para elegir,
-- pero las tiendas que ya lo tienen lo conservan. El padre de un rubro no cambia
-- (movido de lugar dejaría tiendas con combinaciones que no existen).
-- La tienda que no lo tiene cargado sigue funcionando: el dueño lo completa
-- cuando edita sus datos. Desde acá, pkg_catalogo.rubro devuelve el declarado
-- (antes se deducía de la categoría con más productos).
-- ============================================================================

create table public.rubros (
  id             uuid primary key default gen_random_uuid(),
  padre_id       uuid references public.rubros(id),
  nombre         text not null,
  slug           text not null,
  nivel          smallint not null default 1 check (nivel between 1 and 3),  -- lo calcula la base
  orden          integer not null default 0,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (padre_id is distinct from id)
);
create unique index rubros_slug_unico
  on public.rubros (coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create unique index rubros_nombre_unico
  on public.rubros (coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
create index rubros_padre_id_idx on public.rubros (padre_id, orden);

create or replace function public.tg_rubro_nivel()
returns trigger language plpgsql set search_path = '' as $$
declare v_nivel smallint;
begin
  if tg_op = 'UPDATE' and new.padre_id is distinct from old.padre_id then
    raise exception 'Un rubro no se puede mover de lugar' using errcode = 'TC409';
  end if;
  if new.padre_id is null then
    new.nivel := 1;
  else
    select nivel + 1 into v_nivel from public.rubros where id = new.padre_id;
    if v_nivel is null or v_nivel > 3 then
      raise exception 'Los rubros tienen hasta tres niveles' using errcode = 'TC400';
    end if;
    new.nivel := v_nivel;
  end if;
  return new;
end $$;

create trigger rubro_nivel before insert or update of padre_id on public.rubros
  for each row execute function public.tg_rubro_nivel();
create trigger actualizado_en before update on public.rubros
  for each row execute function public.tg_actualizado_en();
create trigger auditar after insert or update or delete on public.rubros
  for each row execute function public.tg_auditar();

alter table public.rubros enable row level security;
create policy "rubros: lectura pública" on public.rubros
  for select to anon, authenticated using (true);
create policy "rubros: el superadmin edita" on public.rubros
  for all to authenticated using (public.es_admin('superadmin')) with check (public.es_admin('superadmin'));

-- ----------------------------------------------------------------------------
-- Rubro de cada tienda
-- ----------------------------------------------------------------------------
alter table public.tiendas
  add column rubro_id    uuid references public.rubros(id),
  add column subrubro_id uuid references public.rubros(id);
create index tiendas_rubro_id_idx on public.tiendas (rubro_id);
create index tiendas_subrubro_id_idx on public.tiendas (subrubro_id);

create table public.tienda_especialidades (
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  rubro_id  uuid not null references public.rubros(id),
  primary key (tienda_id, rubro_id)
);
create index tienda_especialidades_rubro_id_idx on public.tienda_especialidades (rubro_id);

alter table public.tienda_especialidades enable row level security;
create policy "tienda_especialidades: las de tiendas visibles" on public.tienda_especialidades
  for select to anon, authenticated
  using (public.tienda_activa(tienda_id) or public.es_miembro(tienda_id) or public.es_admin());
create policy "tienda_especialidades: editar con permiso de configuración" on public.tienda_especialidades
  for all to authenticated
  using (public.tiene_permiso(tienda_id, 'configuracion.editar') or public.es_admin())
  with check (public.tiene_permiso(tienda_id, 'configuracion.editar') or public.es_admin());

-- El rubro es obligatorio para quien crea o edita su tienda; el subrubro tiene
-- que ser del rubro. Solo se eligen rubros activos (los que ya tenía, se quedan).
-- security invoker: es_usuario_final mira el rol de quien hace el cambio.
create or replace function public.tg_tienda_rubro()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_rubro public.rubros;
  v_sub   public.rubros;
  v_final boolean := public.es_usuario_final();
begin
  if new.rubro_id is null then
    if v_final and (tg_op = 'INSERT' or old.rubro_id is not null) then
      raise exception 'Elegí el rubro principal de tu negocio' using errcode = 'TC400';
    end if;
    new.subrubro_id := null;
    return new;
  end if;

  select * into v_rubro from public.rubros where id = new.rubro_id;
  if v_rubro.nivel is distinct from 1 then
    raise exception 'Elegí un rubro principal de la lista' using errcode = 'TC400';
  end if;
  if v_final and not v_rubro.activo
     and (tg_op = 'INSERT' or new.rubro_id is distinct from old.rubro_id) then
    raise exception 'El rubro «%» ya no está disponible: elegí otro', v_rubro.nombre using errcode = 'TC400';
  end if;

  if new.subrubro_id is not null then
    select * into v_sub from public.rubros where id = new.subrubro_id;
    if v_sub.padre_id is distinct from new.rubro_id then
      raise exception 'El subrubro no corresponde al rubro elegido' using errcode = 'TC400';
    end if;
    if v_final and not v_sub.activo
       and (tg_op = 'INSERT' or new.subrubro_id is distinct from old.subrubro_id) then
      raise exception 'El subrubro «%» ya no está disponible: elegí otro', v_sub.nombre using errcode = 'TC400';
    end if;
  end if;
  return new;
end $$;

create trigger tienda_rubro before insert or update of rubro_id, subrubro_id on public.tiendas
  for each row execute function public.tg_tienda_rubro();

-- Si cambia el subrubro, se van las especialidades que eran del anterior.
create or replace function public.tg_tienda_quitar_especialidades()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.tienda_especialidades te
  using public.rubros r
  where te.tienda_id = new.id and r.id = te.rubro_id
    and r.padre_id is distinct from new.subrubro_id;
  return null;
end $$;

create trigger tienda_quitar_especialidades after update of subrubro_id on public.tiendas
  for each row when (new.subrubro_id is distinct from old.subrubro_id)
  execute function public.tg_tienda_quitar_especialidades();

create or replace function public.tg_especialidad_valida()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_esp public.rubros;
  v_sub uuid;
begin
  select * into v_esp from public.rubros where id = new.rubro_id;
  select subrubro_id into v_sub from public.tiendas where id = new.tienda_id;
  if v_esp.nivel is distinct from 3 or v_esp.padre_id is distinct from v_sub then
    raise exception 'Las especialidades tienen que ser del subrubro elegido' using errcode = 'TC400';
  end if;
  if public.es_usuario_final() and not v_esp.activo then
    raise exception 'La especialidad «%» ya no está disponible', v_esp.nombre using errcode = 'TC400';
  end if;
  return new;
end $$;

create trigger especialidad_valida before insert or update on public.tienda_especialidades
  for each row execute function public.tg_especialidad_valida();

-- ----------------------------------------------------------------------------
-- La lista estándar
-- ----------------------------------------------------------------------------
create function pg_temp.slug(p_texto text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(public.f_unaccent(p_texto)), '[^a-z0-9]+', '-', 'g'))
$$;

with lista(orden, rubro, subrubros) as (values
  (1, 'Alimentos y bebidas', array['Almacén', 'Carnicería', 'Fiambrería', 'Panadería y pastelería',
      'Verdulería y frutería', 'Bebidas', 'Dietética', 'Productos naturales', 'Comida elaborada / gastronomía']),
  (2, 'Indumentaria y moda', array['Ropa de mujer', 'Ropa de hombre', 'Ropa infantil', 'Calzado',
      'Ropa deportiva', 'Lencería', 'Accesorios y bijouterie', 'Bolsos y carteras']),
  (3, 'Hogar y decoración', array['Muebles', 'Decoración', 'Iluminación', 'Cocina', 'Baño',
      'Textiles para el hogar', 'Jardinería', 'Organización y almacenamiento']),
  (4, 'Electrónica y tecnología', array['Celulares', 'Computación', 'Accesorios tecnológicos', 'Audio',
      'Video', 'Gaming', 'Electrónica general']),
  (5, 'Ferretería, construcción y herramientas', array['Ferretería', 'Herramientas',
      'Materiales de construcción', 'Pinturería', 'Electricidad', 'Plomería', 'Seguridad']),
  (6, 'Automotor', array['Repuestos', 'Accesorios', 'Neumáticos', 'Lubricantes', 'Audio y electrónica',
      'Equipamiento']),
  (7, 'Salud y cuidado personal', array['Perfumería', 'Cosmética', 'Higiene personal', 'Óptica',
      'Productos para bebés', 'Ortopedia']),
  (8, 'Deportes y recreación', array['Indumentaria deportiva', 'Equipamiento deportivo', 'Fitness',
      'Camping y aire libre', 'Bicicletas', 'Juegos y recreación']),
  (9, 'Mascotas', array['Alimentos', 'Accesorios', 'Higiene', 'Juguetes', 'Veterinaria']),
  (10, 'Librería, educación y oficina', array['Librería', 'Papelería', 'Útiles escolares', 'Oficina',
      'Arte y dibujo', 'Libros']),
  (11, 'Juguetes y niños', array['Juguetes', 'Juegos de mesa', 'Bebés', 'Primera infancia',
      'Productos infantiles']),
  (12, 'Regalos y artesanías', array['Regalería', 'Artesanías', 'Personalizados', 'Souvenirs',
      'Productos regionales']),
  (13, 'Servicios', array['Servicios profesionales', 'Servicios técnicos', 'Reparaciones',
      'Belleza y estética', 'Gastronomía / catering', 'Servicios para eventos', 'Servicios para el hogar']),
  (14, 'Industria y comercio', array['Insumos industriales', 'Equipamiento comercial', 'Maquinaria',
      'Elementos de seguridad', 'Insumos para empresas']),
  (15, 'Turismo y experiencias', array['Alojamientos', 'Excursiones', 'Turismo', 'Actividades recreativas',
      'Experiencias']),
  (16, 'Música, fiestas y recreación', array['Instrumentos musicales', 'Accesorios musicales',
      'Audio profesional', 'Equipamiento para músicos', 'Cotillón', 'Artículos para fiestas',
      'Globos y decoración para eventos', 'Disfraces', 'Piñatas', 'Juegos y recreación',
      'Artículos para eventos', 'Accesorios para espectáculos']),
  (17, 'Alquileres', array['Inmuebles', 'Vehículos', 'Herramientas y maquinaria',
      'Instrumentos y equipamiento musical', 'Fiestas y eventos', 'Catering y gastronomía',
      'Indumentaria y disfraces', 'Equipamiento deportivo y recreativo', 'Fotografía, video y tecnología',
      'Otros alquileres'])
), principales as (
  insert into public.rubros (nombre, slug, orden)
  select rubro, pg_temp.slug(rubro), orden from lista
  returning id, nombre
)
insert into public.rubros (padre_id, nombre, slug, orden)
select p.id, s.nombre, pg_temp.slug(s.nombre), s.n
from lista l
join principales p on p.nombre = l.rubro
cross join lateral unnest(l.subrubros) with ordinality s(nombre, n);

with lista(subrubro, especialidades) as (values
  ('Inmuebles', array['Casas', 'Departamentos', 'Locales comerciales', 'Oficinas', 'Salones para eventos',
      'Quintas y fincas', 'Galpones y depósitos', 'Cocheras y estacionamientos', 'Espacios para reuniones']),
  ('Vehículos', array['Autos', 'Camionetas', 'Utilitarios', 'Motos', 'Bicicletas', 'Vehículos para eventos',
      'Remolques y trailers']),
  ('Herramientas y maquinaria', array['Herramientas manuales', 'Herramientas eléctricas',
      'Herramientas a batería', 'Maquinaria de construcción', 'Equipos de jardinería', 'Generadores',
      'Compresores', 'Andamios y escaleras', 'Equipos para obras']),
  ('Instrumentos y equipamiento musical', array['Guitarras y bajos', 'Teclados y pianos',
      'Baterías y percusión', 'Instrumentos de viento', 'Equipos de amplificación', 'Micrófonos',
      'Consolas de sonido', 'Equipos DJ', 'Equipamiento para bandas']),
  ('Fiestas y eventos', array['Juegos para fiestas', 'Inflables', 'Metegoles', 'Castillos y plazas blandas',
      'Vajilla', 'Mesas y sillas', 'Livings y mobiliario', 'Gazebos y carpas', 'Decoración', 'Iluminación',
      'Equipamiento de sonido', 'Máquinas de humo / burbujas', 'Máquinas de pochoclo, copos de azúcar y otras']),
  ('Catering y gastronomía', array['Servicio de catering', 'Vajilla y cristalería', 'Equipamiento gastronómico',
      'Hornos y cocinas', 'Heladeras y freezers', 'Conservadoras', 'Barras y mobiliario gastronómico',
      'Máquinas para eventos']),
  ('Indumentaria y disfraces', array['Disfraces', 'Trajes', 'Vestidos', 'Ropa para eventos',
      'Vestuario teatral', 'Accesorios y complementos']),
  ('Equipamiento deportivo y recreativo', array['Equipos deportivos', 'Bicicletas', 'Equipos de camping',
      'Carpas', 'Kayaks', 'Elementos recreativos', 'Equipamiento para actividades al aire libre']),
  ('Fotografía, video y tecnología', array['Cámaras', 'Lentes', 'Trípodes', 'Iluminación', 'Proyectores',
      'Pantallas', 'Equipos audiovisuales', 'Computadoras y notebooks', 'Consolas de videojuegos',
      'Equipamiento para streaming']),
  ('Otros alquileres', array['Equipamiento especializado', 'Artículos para producciones',
      'Elementos para exposiciones', 'Equipamiento comercial', 'Otros bienes alquilables'])
)
insert into public.rubros (padre_id, nombre, slug, orden)
select s.id, e.nombre, pg_temp.slug(e.nombre), e.n
from lista l
join public.rubros a on a.slug = 'alquileres' and a.padre_id is null
join public.rubros s on s.padre_id = a.id and s.nombre = l.subrubro
cross join lateral unnest(l.especialidades) with ordinality e(nombre, n);

-- ----------------------------------------------------------------------------
-- Rubro inicial de las tiendas que ya existen: se deduce de la categoría de
-- productos que más usan (sin archivados). Las que no tienen productos o no
-- encajan quedan sin rubro y el dueño lo completa.
-- ----------------------------------------------------------------------------
with equivalencias(categoria, subcategoria, rubro, subrubro) as (values
  ('indumentaria', null,          'indumentaria-y-moda',      null),
  ('indumentaria', 'mujer',       'indumentaria-y-moda',      'ropa-de-mujer'),
  ('indumentaria', 'hombre',      'indumentaria-y-moda',      'ropa-de-hombre'),
  ('indumentaria', 'ninos',       'indumentaria-y-moda',      'ropa-infantil'),
  ('indumentaria', 'calzado',     'indumentaria-y-moda',      'calzado'),
  ('tecnologia',   null,          'electronica-y-tecnologia', null),
  ('tecnologia',   'celulares',   'electronica-y-tecnologia', 'celulares'),
  ('tecnologia',   'computacion', 'electronica-y-tecnologia', 'computacion'),
  ('hogar',        null,          'hogar-y-decoracion',       null),
  ('hogar',        'muebles',     'hogar-y-decoracion',       'muebles'),
  ('hogar',        'decoracion',  'hogar-y-decoracion',       'decoracion'),
  ('alimentos',    null,          'alimentos-y-bebidas',      null),
  ('almacen',      null,          'alimentos-y-bebidas',      'almacen'),
  ('artesanias',   null,          'regalos-y-artesanias',     'artesanias'),
  ('regionales',   null,          'regalos-y-artesanias',     'productos-regionales'),
  ('belleza',      null,          'salud-y-cuidado-personal', null),
  ('deportes',     null,          'deportes-y-recreacion',    null)
), principal as (
  select distinct on (p.tienda_id)
         p.tienda_id,
         split_part(c.ruta, '/', 2) as categoria,
         nullif(split_part(c.ruta, '/', 3), '') as subcategoria
  from public.productos p
  join public.categorias c on c.id = p.categoria_id
  where p.estado <> 'archivado'
  group by p.tienda_id, c.ruta
  order by p.tienda_id, count(*) desc, c.ruta
), elegido as (
  select distinct on (pr.tienda_id) pr.tienda_id, r.id as rubro_id, s.id as subrubro_id
  from principal pr
  join equivalencias e on e.categoria = pr.categoria
                      and (e.subcategoria is null or e.subcategoria = pr.subcategoria)
  join public.rubros r on r.slug = e.rubro and r.padre_id is null
  left join public.rubros s on s.slug = e.subrubro and s.padre_id = r.id
  order by pr.tienda_id, (e.subcategoria is not null) desc
)
update public.tiendas t
set rubro_id = e.rubro_id, subrubro_id = e.subrubro_id
from elegido e
where t.id = e.tienda_id and t.rubro_id is null;

-- ----------------------------------------------------------------------------
-- pkg_catalogo: la lista para los formularios y el rubro de cada tienda
-- ----------------------------------------------------------------------------

-- Rubros activos en árbol (rubro → subrubros → especialidades), en el orden fijado.
create or replace function pkg_catalogo.rubros()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'nombre', r.nombre, 'slug', r.slug,
           'subrubros', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', s.id, 'nombre', s.nombre, 'slug', s.slug,
                      'especialidades', coalesce((
                        select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre)
                                         order by e.orden, e.nombre)
                        from public.rubros e
                        where e.padre_id = s.id and e.activo
                      ), '[]'::jsonb)
                    ) order by s.orden, s.nombre)
             from public.rubros s
             where s.padre_id = r.id and s.activo
           ), '[]'::jsonb)
         ) order by r.orden, r.nombre), '[]'::jsonb)
  from public.rubros r
  where r.padre_id is null and r.activo
$$;

-- Rubro declarado de la tienda (null si todavía no lo cargó).
create or replace function pkg_catalogo.rubro(p_tienda uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'nombre', r.nombre,
    'slug', r.slug,
    'subrubro', s.nombre,
    'especialidades', coalesce((
      select jsonb_agg(e.nombre order by e.orden, e.nombre)
      from public.tienda_especialidades te
      join public.rubros e on e.id = te.rubro_id
      where te.tienda_id = t.id
    ), '[]'::jsonb))
  from public.tiendas t
  join public.rubros r on r.id = t.rubro_id
  left join public.rubros s on s.id = t.subrubro_id
  where t.id = p_tienda
$$;

-- ----------------------------------------------------------------------------
-- pkg_tiendas: alta, datos y panel con rubro
-- ----------------------------------------------------------------------------

-- Reemplaza las especialidades por las de p_ids (array de ids). Hasta 20.
create or replace function pkg_tiendas._guardar_especialidades(p_tienda uuid, p_ids jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_ids uuid[];
begin
  if p_ids is null or jsonb_typeof(p_ids) = 'null' then
    v_ids := '{}';
  elsif jsonb_typeof(p_ids) <> 'array' then
    raise exception 'Las especialidades tienen que ser una lista' using errcode = 'TC400';
  else
    select coalesce(array_agg(distinct x::uuid), '{}') into v_ids from jsonb_array_elements_text(p_ids) x;
  end if;
  if cardinality(v_ids) > 20 then
    raise exception 'Podés marcar hasta 20 especialidades' using errcode = 'TC400';
  end if;

  delete from public.tienda_especialidades where tienda_id = p_tienda and rubro_id <> all(v_ids);
  insert into public.tienda_especialidades (tienda_id, rubro_id)
  select p_tienda, x from unnest(v_ids) x
  on conflict do nothing;
end $$;

-- La tienda nace "pendiente", con el plan gratis y su rubro (obligatorio).
create or replace function pkg_tiendas.crear(p_datos jsonb, p_slug_base text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if nullif(p_datos ->> 'rubro_id', '') is null then
    raise exception 'Elegí el rubro principal de tu negocio' using errcode = 'TC400';
  end if;

  insert into public.tiendas
    (propietario_id, nombre, slug, descripcion, cuit, razon_social, telefono, email, localidad_id, direccion,
     rubro_id, subrubro_id)
  values (
    auth.uid(),
    p_datos ->> 'nombre',
    pkg_tiendas._slug_libre(p_slug_base),
    p_datos ->> 'descripcion',
    p_datos ->> 'cuit',
    p_datos ->> 'razon_social',
    p_datos ->> 'telefono',
    p_datos ->> 'email',
    (p_datos ->> 'localidad_id')::uuid,
    p_datos ->> 'direccion',
    (p_datos ->> 'rubro_id')::uuid,
    nullif(p_datos ->> 'subrubro_id', '')::uuid
  )
  returning id into v_id;

  perform pkg_tiendas._asignar_plan_gratis(v_id);
  if p_datos ? 'especialidades' then
    perform pkg_tiendas._guardar_especialidades(v_id, p_datos -> 'especialidades');
  end if;
  return v_id;
end $$;

-- Datos de la tienda. Solo cambia las claves presentes en p_cambios. Si cambia
-- el rubro y no viene subrubro, el subrubro se borra (era del rubro anterior).
create or replace function pkg_tiendas.actualizar(p_tienda uuid, p_cambios jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_actual public.tiendas;
begin
  if not public.tiene_permiso(p_tienda, 'configuracion.editar') then
    raise exception 'No tenés permiso para modificar los datos de esta tienda' using errcode = 'TC403';
  end if;
  select * into v_actual from public.tiendas where id = p_tienda;

  update public.tiendas set
    nombre       = case when p_cambios ? 'nombre'       then p_cambios ->> 'nombre'       else nombre end,
    descripcion  = case when p_cambios ? 'descripcion'  then p_cambios ->> 'descripcion'  else descripcion end,
    cuit         = case when p_cambios ? 'cuit'         then p_cambios ->> 'cuit'         else cuit end,
    razon_social = case when p_cambios ? 'razon_social' then p_cambios ->> 'razon_social' else razon_social end,
    telefono     = case when p_cambios ? 'telefono'     then p_cambios ->> 'telefono'     else telefono end,
    email        = case when p_cambios ? 'email'        then p_cambios ->> 'email'        else email end,
    localidad_id = case when p_cambios ? 'localidad_id' then (p_cambios ->> 'localidad_id')::uuid else localidad_id end,
    direccion    = case when p_cambios ? 'direccion'    then p_cambios ->> 'direccion'    else direccion end,
    rubro_id     = case when p_cambios ? 'rubro_id'     then nullif(p_cambios ->> 'rubro_id', '')::uuid else rubro_id end,
    subrubro_id  = case when p_cambios ? 'subrubro_id'  then nullif(p_cambios ->> 'subrubro_id', '')::uuid
                        when p_cambios ? 'rubro_id'
                             and nullif(p_cambios ->> 'rubro_id', '')::uuid is distinct from v_actual.rubro_id
                        then null
                        else subrubro_id end
  where id = p_tienda;

  if p_cambios ? 'especialidades' then
    perform pkg_tiendas._guardar_especialidades(p_tienda, p_cambios -> 'especialidades');
  end if;
end $$;

-- Panel de la tienda: suma rubro, subrubro y especialidades.
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
-- pkg_admin: el rubro en el listado y la ficha de tiendas
-- ----------------------------------------------------------------------------
create or replace function pkg_admin._rubro_de(p_tienda uuid)
returns jsonb language sql stable set search_path = '' as $$
  select case when r.id is not null
              then jsonb_build_object('nombre', r.nombre, 'subrubro', s.nombre) end
  from public.tiendas t
  left join public.rubros r on r.id = t.rubro_id
  left join public.rubros s on s.id = t.subrubro_id
  where t.id = p_tienda
$$;

alter function pkg_admin.tiendas(public.estado_tienda, text, integer) rename to _tiendas_sin_rubro;
alter function pkg_admin.tienda(uuid) rename to _tienda_sin_rubro;

create or replace function pkg_admin.tiendas(
  p_estado public.estado_tienda default null, p_buscar text default null, p_pagina integer default 1
) returns jsonb language sql stable set search_path = '' as $$
  select v || jsonb_build_object('items', coalesce((
           select jsonb_agg(i || jsonb_build_object('rubro', pkg_admin._rubro_de((i ->> 'id')::uuid)) order by n)
           from jsonb_array_elements(v -> 'items') with ordinality x(i, n)
         ), '[]'::jsonb))
  from (select pkg_admin._tiendas_sin_rubro(p_estado, p_buscar, p_pagina) as v) b
$$;

create or replace function pkg_admin.tienda(p_tienda uuid)
returns jsonb language sql stable set search_path = '' as $$
  select case when v is not null then v || jsonb_build_object('rubro', pkg_admin._rubro_de(p_tienda)) end
  from (select pkg_admin._tienda_sin_rubro(p_tienda) as v) b
$$;

-- ----------------------------------------------------------------------------
-- pkg_admin: mantenimiento de la lista (solo superadmin)
-- ----------------------------------------------------------------------------
create or replace function pkg_admin._exigir_superadmin_rubros()
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.es_admin('superadmin') then
    raise exception 'Solo el superadmin edita los rubros' using errcode = 'TC403';
  end if;
end $$;

-- Todos los rubros (también los inactivos) con cuántas tiendas los usan.
-- La web arma el árbol con padre_id y orden. Servidor: cuenta todas las tiendas.
create or replace function pkg_admin.rubros()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'rubros', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'padre_id', r.padre_id,
               'nombre', r.nombre,
               'slug', r.slug,
               'nivel', r.nivel,
               'orden', r.orden,
               'activo', r.activo,
               'tiendas', case r.nivel
                 when 1 then (select count(*) from public.tiendas t where t.rubro_id = r.id and t.estado <> 'archivada')
                 when 2 then (select count(*) from public.tiendas t where t.subrubro_id = r.id and t.estado <> 'archivada')
                 else (select count(*) from public.tienda_especialidades te
                       join public.tiendas t on t.id = te.tienda_id
                       where te.rubro_id = r.id and t.estado <> 'archivada') end
             ) order by r.nivel, r.orden, r.nombre)
      from public.rubros r
    ), '[]'::jsonb),
    'sinRubro', (select count(*) from public.tiendas where rubro_id is null and estado <> 'archivada')
  )
$$;

-- Crea (p_rubro null; p_padre null = rubro principal) o renombra. El slug solo
-- se fija al crearlo y el padre no cambia.
create or replace function pkg_admin.guardar_rubro(p_rubro uuid, p_nombre text, p_slug text, p_padre uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nombre text := trim(p_nombre);
  v_padre  public.rubros;
  v_id     uuid;
begin
  perform pkg_admin._exigir_superadmin_rubros();
  if p_rubro is null then
    if p_padre is not null then
      select * into v_padre from public.rubros where id = p_padre;
      if not found then
        raise exception 'No encontramos el rubro donde va' using errcode = 'TC404';
      end if;
      if v_padre.nivel >= 3 then
        raise exception 'Las especialidades no llevan otro nivel adentro' using errcode = 'TC400';
      end if;
    end if;
    perform pkg_admin._validar_nombre(v_nombre, p_slug, 80);
    insert into public.rubros (padre_id, nombre, slug, activo, orden)
    values (p_padre, v_nombre, p_slug, coalesce(v_padre.activo, true),
            (select coalesce(max(orden), 0) + 1 from public.rubros where padre_id is not distinct from p_padre))
    returning id into v_id;
  else
    perform pkg_admin._validar_nombre(v_nombre, 'x', 80);
    update public.rubros set nombre = v_nombre where id = p_rubro returning id into v_id;
    if v_id is null then
      raise exception 'No encontramos ese rubro' using errcode = 'TC404';
    end if;
  end if;
  return (select jsonb_build_object('id', id, 'padre_id', padre_id, 'nombre', nombre, 'nivel', nivel, 'activo', activo)
          from public.rubros where id = v_id);
exception
  when unique_violation then
    raise exception 'Ya existe «%» en ese lugar', v_nombre using errcode = 'TC409';
end $$;

-- Activar o desactivar, siempre con lo que tiene adentro. Para activar uno,
-- el de arriba tiene que estar activo.
create or replace function pkg_admin.activar_rubro(p_rubro uuid, p_activo boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v         public.rubros;
  v_padre   public.rubros;
  v_cambios integer;
begin
  perform pkg_admin._exigir_superadmin_rubros();
  if p_activo is null then
    raise exception 'Elegí si el rubro está activo o no' using errcode = 'TC400';
  end if;
  select * into v from public.rubros where id = p_rubro for update;
  if not found then
    raise exception 'No encontramos ese rubro' using errcode = 'TC404';
  end if;
  if p_activo and v.padre_id is not null then
    select * into v_padre from public.rubros where id = v.padre_id;
    if not v_padre.activo then
      raise exception 'Primero activá «%», el rubro que lo contiene', v_padre.nombre using errcode = 'TC409';
    end if;
  end if;

  with recursive rama as (
    select id from public.rubros where id = p_rubro
    union all
    select r.id from public.rubros r join rama on r.padre_id = rama.id
  )
  update public.rubros r set activo = p_activo
  from rama where r.id = rama.id and r.activo is distinct from p_activo;
  get diagnostics v_cambios = row_count;

  return jsonb_build_object('id', v.id, 'activo', p_activo, 'rubros', v_cambios);
end $$;

-- Sube o baja un rubro entre sus hermanos (el orden de los formularios).
create or replace function pkg_admin.ordenar_rubro(p_rubro uuid, p_direccion text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v     public.rubros;
  v_ids uuid[];
  i     integer;
begin
  perform pkg_admin._exigir_superadmin_rubros();
  if p_direccion is null or p_direccion not in ('subir', 'bajar') then
    raise exception 'Dirección inválida' using errcode = 'TC400';
  end if;
  select * into v from public.rubros where id = p_rubro;
  if not found then
    raise exception 'No encontramos ese rubro' using errcode = 'TC404';
  end if;

  select array_agg(r.id order by r.orden, r.nombre) into v_ids
  from public.rubros r
  where r.padre_id is not distinct from v.padre_id;
  i := array_position(v_ids, v.id);

  if p_direccion = 'subir' and i > 1 then
    v_ids[i] := v_ids[i - 1];
    v_ids[i - 1] := v.id;
  elsif p_direccion = 'bajar' and i < cardinality(v_ids) then
    v_ids[i] := v_ids[i + 1];
    v_ids[i + 1] := v.id;
  end if;

  update public.rubros r set orden = x.n
  from unnest(v_ids) with ordinality x(id, n)
  where r.id = x.id and r.orden <> x.n;
end $$;

-- ¿Alguna tienda (de cualquier estado) usa este rubro?
create or replace function pkg_admin._rubro_en_uso(p_rubro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_admin() and (
    exists (select 1 from public.tiendas where rubro_id = p_rubro or subrubro_id = p_rubro)
    or exists (select 1 from public.tienda_especialidades where rubro_id = p_rubro))
$$;

-- Solo se borra un rubro sin nada adentro y que ninguna tienda usa (sirve para
-- corregir una carga equivocada). Si no, se desactiva.
create or replace function pkg_admin.eliminar_rubro(p_rubro uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_admin._exigir_superadmin_rubros();
  perform 1 from public.rubros where id = p_rubro for update;
  if not found then
    raise exception 'No encontramos ese rubro' using errcode = 'TC404';
  end if;
  if exists (select 1 from public.rubros where padre_id = p_rubro) then
    raise exception 'Tiene rubros adentro: borralos primero o desactivalo' using errcode = 'TC409';
  end if;
  if pkg_admin._rubro_en_uso(p_rubro) then
    raise exception 'Hay tiendas que lo usan: desactivalo en lugar de borrarlo' using errcode = 'TC409';
  end if;
  delete from public.rubros where id = p_rubro;
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  public.tg_tienda_rubro(),
  public.tg_tienda_quitar_especialidades(),
  public.tg_especialidad_valida(),
  pkg_catalogo.rubros(),
  pkg_tiendas._guardar_especialidades(uuid, jsonb),
  pkg_admin._rubro_de(uuid),
  pkg_admin._tiendas_sin_rubro(public.estado_tienda, text, integer),
  pkg_admin._tienda_sin_rubro(uuid),
  pkg_admin.tiendas(public.estado_tienda, text, integer),
  pkg_admin.tienda(uuid),
  pkg_admin._exigir_superadmin_rubros(),
  pkg_admin.rubros(),
  pkg_admin.guardar_rubro(uuid, text, text, uuid),
  pkg_admin.activar_rubro(uuid, boolean),
  pkg_admin.ordenar_rubro(uuid, text),
  pkg_admin._rubro_en_uso(uuid),
  pkg_admin.eliminar_rubro(uuid)
from public, anon, authenticated, service_role;

grant execute on function pkg_catalogo.rubros() to anon, authenticated;
grant execute on function pkg_tiendas._guardar_especialidades(uuid, jsonb) to authenticated;

-- Los cambios corren como el superadmin: validan el rol adentro y RLS hace el resto.
grant execute on function
  pkg_admin._exigir_superadmin_rubros(),
  pkg_admin.guardar_rubro(uuid, text, text, uuid),
  pkg_admin.activar_rubro(uuid, boolean),
  pkg_admin.ordenar_rubro(uuid, text),
  pkg_admin._rubro_en_uso(uuid),
  pkg_admin.eliminar_rubro(uuid)
to authenticated;
