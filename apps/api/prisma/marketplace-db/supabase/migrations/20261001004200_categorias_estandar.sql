-- ============================================================================
-- Categorías de productos: la lista estándar. Convenciones en ..._1800.
--
--   · 18 categorías con sus subcategorías; Alquileres tiene un tercer nivel
--     (Inmuebles → Casas, Departamentos…).
--   · El producto va siempre en el último nivel: categoría y subcategoría son
--     obligatorias, y en Alquileres también el tercer nivel. La base lo exige
--     al crear el producto o al cambiarle la categoría.
--   · Una categoría puede pedir revisión de moderación (requiere_revision, se
--     hereda a sus subcategorías): todo lo que se publique ahí pasa por
--     moderación, y también cada cambio de nombre, descripción o categoría de
--     un producto ya publicado. Arranca marcada en Productos veterinarios.
--   · Las categorías de ejemplo de desarrollo (Indumentaria, Tecnología, Hogar)
--     se reubican en la lista nueva sin cambiar su id: sus productos y
--     atributos (talle, color, memoria) siguen igual.
-- Moderación sigue pudiendo sumar, renombrar u ocultar categorías desde el panel.
-- ============================================================================

alter table public.categorias
  add column requiere_revision boolean not null default false;

create or replace function pg_temp.slug(p_texto text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(public.f_unaccent(p_texto)), '[^a-z0-9]+', '-', 'g'))
$$;

-- Mueve o renombra una categoría si existe y su lugar nuevo está libre. Las
-- subcategorías actualizan su ruta solas (trigger categoria_ruta_hijas).
create or replace function pg_temp.reubicar(p_ruta text, p_ruta_padre text, p_nombre text)
returns void language plpgsql as $$
declare
  v_padre uuid;
  v_destino text;
begin
  if p_ruta_padre is not null then
    select id into v_padre from public.categorias where ruta = p_ruta_padre;
    if v_padre is null then return; end if;
  end if;
  v_destino := coalesce(p_ruta_padre, '/') || pg_temp.slug(p_nombre) || '/';
  if exists (select 1 from public.categorias where ruta = v_destino) then return; end if;
  update public.categorias
  set padre_id = v_padre, nombre = p_nombre, slug = pg_temp.slug(p_nombre)
  where ruta = p_ruta;
end $$;

-- ----------------------------------------------------------------------------
-- Las categorías de ejemplo pasan a su lugar en la lista nueva
-- ----------------------------------------------------------------------------
select pg_temp.reubicar('/indumentaria/', null, 'Indumentaria y calzado');
select pg_temp.reubicar('/indumentaria-y-calzado/mujer/calzado/', '/indumentaria-y-calzado/', 'Calzado de mujer');
select pg_temp.reubicar('/indumentaria-y-calzado/mujer/', '/indumentaria-y-calzado/', 'Ropa de mujer');
select pg_temp.reubicar('/indumentaria-y-calzado/hombre/', '/indumentaria-y-calzado/', 'Ropa de hombre');
select pg_temp.reubicar('/indumentaria-y-calzado/ninos/', '/indumentaria-y-calzado/', 'Ropa infantil');
select pg_temp.reubicar('/tecnologia/', null, 'Tecnología y electrónica');
select pg_temp.reubicar('/tecnologia-y-electronica/computacion/', '/tecnologia-y-electronica/', 'Computadoras');
select pg_temp.reubicar('/hogar/', null, 'Hogar y decoración');

-- ----------------------------------------------------------------------------
-- Lista estándar. Si ya existe (misma ruta), se actualizan nombre y orden.
-- ----------------------------------------------------------------------------
with lista (categoria, orden, subcategorias) as (values
  ('Alimentos y bebidas', 1, array['Almacén', 'Bebidas', 'Carnes y embutidos', 'Fiambrería', 'Frutas y verduras',
    'Panadería y pastelería', 'Congelados', 'Lácteos y huevos', 'Conservas y enlatados', 'Pastas y harinas',
    'Aceites y condimentos', 'Snacks y golosinas', 'Productos saludables', 'Dietética', 'Productos regionales']),
  ('Indumentaria y calzado', 2, array['Ropa de mujer', 'Ropa de hombre', 'Ropa infantil', 'Ropa deportiva',
    'Calzado', 'Calzado infantil', 'Calzado de temporada', 'Calzado de mujer', 'Calzado de hombre', 'Lencería',
    'Ropa interior', 'Abrigos', 'Accesorios', 'Carteras y bolsos', 'Valijas y mochilas',
    'Uniformes y ropa de trabajo']),
  ('Hogar y decoración', 3, array['Muebles', 'Decoración', 'Iluminación', 'Cocina', 'Baño', 'Dormitorio', 'Living',
    'Textiles', 'Cortinas', 'Organización', 'Limpieza', 'Accesorios para el hogar']),
  ('Tecnología y electrónica', 4, array['Celulares', 'Tablets', 'Computadoras', 'Notebooks', 'Monitores',
    'Accesorios para celulares', 'Accesorios para computación', 'Audio', 'TV y video', 'Gaming', 'Componentes',
    'Redes y conectividad', 'Seguridad electrónica', 'Electrónica general']),
  ('Electrodomésticos', 5, array['Heladeras y freezers', 'Cocinas y hornos', 'Microondas', 'Lavarropas',
    'Secarropas', 'Aspiradoras', 'Pequeños electrodomésticos', 'Climatización', 'Ventilación', 'Calefacción',
    'Electrodomésticos de cocina']),
  ('Ferretería, construcción y herramientas', 6, array['Herramientas manuales', 'Herramientas eléctricas',
    'Ferretería general', 'Electricidad', 'Plomería', 'Pinturas', 'Materiales de construcción',
    'Cerámicos y revestimientos', 'Sanitarios', 'Iluminación', 'Seguridad', 'Tornillería y fijaciones',
    'Maquinaria']),
  ('Automotor y motocicletas', 7, array['Repuestos', 'Accesorios', 'Neumáticos', 'Lubricantes', 'Baterías',
    'Herramientas', 'Audio y multimedia', 'Iluminación', 'Limpieza y cuidado', 'Equipamiento para motos',
    'Indumentaria para motociclistas']),
  ('Salud, belleza y cuidado personal', 8, array['Perfumería', 'Cosmética', 'Maquillaje', 'Cuidado facial',
    'Cuidado capilar', 'Higiene personal', 'Manicuría y pedicuría', 'Productos para barbería',
    'Productos para peluquería', 'Óptica', 'Equipamiento y accesorios']),
  ('Deportes y aire libre', 9, array['Indumentaria deportiva', 'Calzado deportivo', 'Fitness y musculación',
    'Fútbol', 'Ciclismo', 'Running', 'Camping', 'Pesca', 'Montañismo', 'Deportes acuáticos',
    'Accesorios deportivos', 'Juegos y recreación']),
  ('Mascotas y animales', 10, array['Alimentos para perros', 'Alimentos para gatos',
    'Alimentos para otros animales', 'Accesorios', 'Juguetes', 'Higiene', 'Camas y transporte', 'Acuarios',
    'Productos veterinarios']),
  ('Librería, papelería y oficina', 11, array['Librería', 'Papelería', 'Útiles escolares', 'Oficina',
    'Impresión y encuadernación', 'Arte y dibujo', 'Manualidades', 'Libros', 'Agendas y planners']),
  ('Juguetes, bebés y niños', 12, array['Juguetes', 'Juegos de mesa', 'Juguetes educativos', 'Bebés',
    'Primera infancia', 'Ropa infantil', 'Accesorios para bebés', 'Muebles infantiles', 'Seguridad infantil']),
  ('Regalos, artesanías y personalizados', 13, array['Regalos', 'Artesanías', 'Productos personalizados',
    'Souvenirs', 'Decoración artesanal', 'Papelería personalizada', 'Regalos empresariales',
    'Eventos y souvenirs']),
  ('Jardinería, viveros y agricultura', 14, array['Plantas', 'Flores', 'Semillas', 'Macetas', 'Jardinería',
    'Herramientas de jardín', 'Riego', 'Fertilizantes y sustratos', 'Productos agrícolas',
    'Insumos para cultivos', 'Viveros']),
  ('Productos regionales y producción local', 15, array['Vinos', 'Aceites de oliva', 'Aceitunas', 'Frutos secos',
    'Dulces y conservas', 'Alimentos regionales', 'Artesanías regionales', 'Productos elaborados localmente',
    'Otros productos regionales']),
  ('Música, fiestas y recreación', 16, array['Instrumentos musicales', 'Accesorios musicales', 'Arte', 'Pintura',
    'Fotografía', 'Coleccionismo', 'Música', 'Entretenimiento', 'Disfraces y cotillón']),
  ('Turismo y actividades', 17, array['Equipamiento para turismo', 'Camping y aventura', 'Productos para viajeros',
    'Souvenirs', 'Experiencias', 'Actividades recreativas']),
  ('Alquileres', 18, array['Inmuebles', 'Vehículos', 'Herramientas y maquinaria',
    'Instrumentos y equipamiento musical', 'Fiestas y eventos', 'Catering y equipamiento gastronómico',
    'Indumentaria y disfraces', 'Deportes, camping y recreación', 'Fotografía, video y tecnología',
    'Mobiliario y equipamiento comercial', 'Equipamiento médico y profesional', 'Otros alquileres'])
), principales as (
  insert into public.categorias (nombre, slug, orden)
  select categoria, pg_temp.slug(categoria), orden from lista
  on conflict (ruta) do update set nombre = excluded.nombre, orden = excluded.orden
  returning id, nombre
)
insert into public.categorias (padre_id, nombre, slug, orden)
select p.id, s.nombre, pg_temp.slug(s.nombre), s.n
from lista l
join principales p on p.nombre = l.categoria
cross join lateral unnest(l.subcategorias) with ordinality s(nombre, n)
on conflict (ruta) do update set nombre = excluded.nombre, orden = excluded.orden;

-- Tercer nivel de Alquileres.
with lista (subcategoria, tipos) as (values
  ('Inmuebles', array['Casas', 'Departamentos', 'Locales comerciales', 'Oficinas', 'Salones para eventos',
    'Quintas y fincas', 'Galpones y depósitos', 'Cocheras', 'Espacios para reuniones']),
  ('Vehículos', array['Autos', 'Camionetas', 'Utilitarios', 'Motos', 'Bicicletas', 'Camiones', 'Trailers',
    'Remolques', 'Vehículos para eventos']),
  ('Herramientas y maquinaria', array['Herramientas manuales', 'Herramientas eléctricas', 'Herramientas a batería',
    'Herramientas de construcción', 'Maquinaria de construcción', 'Equipos de jardinería', 'Generadores',
    'Compresores', 'Andamios', 'Escaleras', 'Equipos para obras', 'Equipos industriales']),
  ('Instrumentos y equipamiento musical', array['Guitarras y bajos', 'Teclados y pianos', 'Baterías y percusión',
    'Instrumentos de viento', 'Instrumentos de cuerda', 'Amplificadores', 'Micrófonos', 'Consolas',
    'Equipos de sonido', 'Equipos DJ', 'Equipamiento para bandas']),
  ('Fiestas y eventos', array['Juegos para fiestas', 'Inflables', 'Metegoles', 'Castillos inflables',
    'Plazas blandas', 'Mesas y sillas', 'Livings', 'Carpas y gazebos', 'Vajilla', 'Decoración', 'Iluminación',
    'Sonido', 'Máquinas para eventos', 'Equipamiento para eventos']),
  ('Catering y equipamiento gastronómico', array['Servicios de catering', 'Vajilla', 'Cristalería', 'Cubiertos',
    'Mesas gastronómicas', 'Barras', 'Hornos', 'Cocinas', 'Heladeras', 'Freezers', 'Conservadoras',
    'Máquinas gastronómicas', 'Equipamiento para eventos']),
  ('Indumentaria y disfraces', array['Disfraces', 'Trajes', 'Vestidos', 'Ropa para eventos', 'Vestuario teatral',
    'Vestuario infantil', 'Accesorios', 'Vestuario temático']),
  ('Deportes, camping y recreación', array['Bicicletas', 'Carpas', 'Equipamiento de camping',
    'Equipamiento deportivo', 'Equipamiento para actividades al aire libre', 'Kayaks', 'Juegos recreativos',
    'Equipos de aventura']),
  ('Fotografía, video y tecnología', array['Cámaras', 'Lentes', 'Trípodes', 'Iluminación', 'Equipos de video',
    'Proyectores', 'Pantallas', 'Computadoras', 'Notebooks', 'Consolas de videojuegos', 'Equipos de streaming',
    'Equipamiento audiovisual']),
  ('Mobiliario y equipamiento comercial', array['Muebles', 'Escritorios', 'Sillas', 'Estanterías', 'Góndolas',
    'Exhibidores', 'Mostradores', 'Vitrinas', 'Equipamiento para locales', 'Equipamiento para oficinas',
    'Equipamiento para ferias y exposiciones']),
  ('Equipamiento médico y profesional', array['Camas y camillas', 'Sillas de ruedas',
    'Equipamiento de rehabilitación', 'Equipamiento para consultorios', 'Equipamiento profesional',
    'Equipamiento para cuidados']),
  ('Otros alquileres', array['Equipamiento especializado', 'Artículos para producciones',
    'Elementos para exposiciones', 'Equipamiento comercial', 'Otros bienes alquilables'])
)
insert into public.categorias (padre_id, nombre, slug, orden)
select s.id, t.nombre, pg_temp.slug(t.nombre), t.n
from lista l
join public.categorias s on s.ruta = '/alquileres/' || pg_temp.slug(l.subcategoria) || '/'
cross join lateral unnest(l.tipos) with ordinality t(nombre, n)
on conflict (ruta) do update set nombre = excluded.nombre, orden = excluded.orden;

update public.categorias set requiere_revision = true
where ruta = '/mascotas-y-animales/productos-veterinarios/';

-- ----------------------------------------------------------------------------
-- Reglas
-- ----------------------------------------------------------------------------

-- ¿Esta categoría (o una de las que la contienen) pide revisión de moderación?
create or replace function public.categoria_requiere_revision(p_categoria uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.categorias c
    join public.categorias a on c.ruta like a.ruta || '%'
    where c.id = p_categoria and a.requiere_revision)
$$;

-- El producto va en el último nivel: nunca en una categoría principal ni en una
-- que tiene subcategorías visibles. Solo se revisa al crearlo o al cambiarle la
-- categoría, así un producto viejo se sigue pudiendo editar.
create or replace function public.tg_producto_categoria_final()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.categorias;
begin
  if tg_op = 'UPDATE' and new.categoria_id is not distinct from old.categoria_id then
    return new;
  end if;
  select * into v from public.categorias where id = new.categoria_id;
  if not found then
    return new;
  end if;
  if v.padre_id is null then
    raise exception 'Elegí también la subcategoría de «%»', v.nombre using errcode = 'TC400';
  end if;
  if exists (select 1 from public.categorias h where h.padre_id = v.id and h.activa) then
    raise exception 'Elegí qué tipo de «%» es', v.nombre using errcode = 'TC400';
  end if;
  return new;
end $$;

create trigger producto_categoria_final
  before insert or update of categoria_id on public.productos
  for each row execute function public.tg_producto_categoria_final();

-- Igual que en ..._2700, más la revisión por categoría.
create or replace function public.tg_productos_revision()
returns trigger language plpgsql as $$
declare
  v_moderador boolean := public.es_admin('moderacion');
  v_vendedor  boolean := public.es_usuario_final() and not v_moderador;
  v_categoria boolean := false;
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
    v_categoria := public.categoria_requiere_revision(new.categoria_id);
  end if;

  if new.estado = 'publicado' and (
       tg_op = 'INSERT' or old.estado <> 'publicado'
       or (v_categoria and (new.categoria_id is distinct from old.categoria_id
                            or new.nombre is distinct from old.nombre
                            or new.descripcion is distinct from old.descripcion))) then
    if v_vendedor and (
         v_categoria
         or new.requiere_revision
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

-- ----------------------------------------------------------------------------
-- pkg_catalogo: el menú y los formularios saben qué categorías piden revisión
-- ----------------------------------------------------------------------------
create or replace function pkg_catalogo.categorias()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with recursive arbol as (
    select c.id, c.nombre, c.padre_id, c.ruta, c.nombre as etiqueta, c.requiere_revision as revision,
           array[lpad(c.orden::text, 6, '0') || c.nombre] as camino
    from public.categorias c
    where c.padre_id is null and c.activa
    union all
    select c.id, c.nombre, c.padre_id, c.ruta, a.etiqueta || ' › ' || c.nombre, a.revision or c.requiere_revision,
           a.camino || (lpad(c.orden::text, 6, '0') || c.nombre)
    from public.categorias c
    join arbol a on c.padre_id = a.id
    where c.activa
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'nombre', nombre, 'padre_id', padre_id, 'ruta', ruta, 'etiqueta', etiqueta,
           'revision', revision
         ) order by camino), '[]'::jsonb)
  from arbol
$$;

-- ----------------------------------------------------------------------------
-- pkg_admin: moderación marca qué categorías pasan por revisión
-- ----------------------------------------------------------------------------
alter function pkg_admin.categorias() rename to _categorias_sin_revision;
alter function pkg_admin.categoria(uuid) rename to _categoria_sin_revision;

create or replace function pkg_admin.categorias()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(i || jsonb_build_object(
           'requiere_revision', c.requiere_revision,
           'revision', public.categoria_requiere_revision(c.id)
         ) order by n), '[]'::jsonb)
  from jsonb_array_elements(pkg_admin._categorias_sin_revision()) with ordinality x(i, n)
  join public.categorias c on c.id = (i ->> 'id')::uuid
$$;

-- revisionDesde: la categoría de más arriba que le pasa la revisión (null si es propia o no tiene).
create or replace function pkg_admin.categoria(p_categoria uuid)
returns jsonb language sql stable set search_path = '' as $$
  select case when v is not null then v || jsonb_build_object(
           'requiere_revision', c.requiere_revision,
           'revisionDesde', (
             select jsonb_build_object('id', a.id, 'nombre', a.nombre)
             from public.categorias a
             where c.ruta like a.ruta || '%' and a.id <> c.id and a.requiere_revision
             order by length(a.ruta)
             limit 1))
         end
  from (select pkg_admin._categoria_sin_revision(p_categoria) as v) b
  left join public.categorias c on c.id = p_categoria
$$;

create or replace function pkg_admin.revision_categoria(p_categoria uuid, p_requiere boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_admin._exigir_moderacion();
  if p_requiere is null then
    raise exception 'Elegí si la categoría pasa por revisión o no' using errcode = 'TC400';
  end if;
  update public.categorias set requiere_revision = p_requiere where id = p_categoria;
  if not found then
    raise exception 'No encontramos esa categoría' using errcode = 'TC404';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  public.tg_producto_categoria_final(),
  pkg_admin._categorias_sin_revision(),
  pkg_admin._categoria_sin_revision(uuid),
  pkg_admin.categorias(),
  pkg_admin.categoria(uuid),
  pkg_admin.revision_categoria(uuid, boolean)
from public, anon, authenticated, service_role;

-- Corre como moderación: valida el rol adentro y RLS hace el resto.
grant execute on function pkg_admin.revision_categoria(uuid, boolean) to authenticated;
