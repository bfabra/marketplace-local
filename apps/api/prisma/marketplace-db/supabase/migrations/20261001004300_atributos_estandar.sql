-- ============================================================================
-- Atributos de productos: la ficha estándar de cada categoría. Convenciones en ..._1800.
--
--   · Todos los productos comparten nombre, descripción, precio, imágenes,
--     stock y SKU (columnas propias) y, como atributos, Marca y Condición
--     (nuevo, usado, reacondicionado) donde tienen sentido.
--   · Cada categoría suma su ficha y cada subcategoría la suya; se heredan
--     hacia abajo. Todos son opcionales: moderación marca como obligatorio el
--     que quiera desde el panel.
--   · El nombre del atributo es único en todo el catálogo, así que los que se
--     repiten con sentidos distintos («Tipo», «Tamaño», «Capacidad») son texto
--     libre. Los que tienen valores conocidos son listas, sí/no o números.
--   · Variantes (precio y stock propios): Talle y Color en ropa, calzado e
--     indumentaria deportiva; Memoria y Color en celulares; Unidad de cobro
--     (hora, día, semana…) en todos los alquileres. Talle y Color dejan de
--     colgar de Indumentaria y calzado entera: así Accesorios o Carteras no
--     piden talle.
--   · Se suman la categoría Industria y empresas y la subcategoría Vinos en
--     Alimentos y bebidas.
--   · El formulario muestra la ficha en el orden de la lista: primero lo de la
--     categoría, después lo de la subcategoría.
-- ============================================================================

create or replace function pg_temp.slug(p_texto text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(public.f_unaccent(p_texto)), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function pg_temp.categoria(p_categoria text, p_sub text) returns uuid language plpgsql as $$
declare
  v_ruta text := '/' || pg_temp.slug(p_categoria) || '/' || coalesce(pg_temp.slug(p_sub) || '/', '');
  v_id uuid;
begin
  select id into v_id from public.categorias where ruta = v_ruta;
  if v_id is null then
    raise exception 'No existe la categoría %', v_ruta;
  end if;
  return v_id;
end $$;

-- Crea el atributo si no existe (no toca los que ya cargó moderación) y suma sus opciones.
create or replace function pg_temp.atributo(
  p_nombre text, p_tipo public.tipo_atributo, p_unidad text, p_filtrable boolean, p_opciones text[]
) returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.atributos (nombre, tipo, unidad, filtrable)
  values (p_nombre, p_tipo, p_unidad, p_filtrable)
  on conflict (nombre) do nothing;
  select id into v_id from public.atributos where nombre = p_nombre and tipo = 'lista';
  if v_id is not null and p_opciones is not null then
    insert into public.atributo_opciones (atributo_id, valor, orden)
    select v_id, o.valor, o.n from unnest(p_opciones) with ordinality o(valor, n)
    on conflict (atributo_id, valor) do update set orden = excluded.orden;
  end if;
end $$;

-- Suma atributos opcionales a una categoría, en orden. Los que no existen nacen
-- como texto libre; los que ya hereda de una categoría de más arriba se saltean.
create or replace function pg_temp.asignar(p_categoria text, p_sub text, p_atributos text[])
returns void language plpgsql as $$
declare
  v_categoria uuid := pg_temp.categoria(p_categoria, p_sub);
  v_ruta text;
  v_nombre text;
  v_orden bigint;
  v_atributo uuid;
begin
  select ruta into v_ruta from public.categorias where id = v_categoria;
  for v_nombre, v_orden in select * from unnest(p_atributos) with ordinality loop
    insert into public.atributos (nombre, tipo) values (v_nombre, 'texto') on conflict (nombre) do nothing;
    select id into v_atributo from public.atributos where nombre = v_nombre;
    continue when exists (
      select 1 from public.categorias_atributos ca
      join public.categorias a on a.id = ca.categoria_id
      where ca.atributo_id = v_atributo and v_ruta like a.ruta || '%');
    insert into public.categorias_atributos (categoria_id, atributo_id, obligatorio, define_variante, orden)
    values (v_categoria, v_atributo, false, false, v_orden);
  end loop;
end $$;

-- Atributos que generan variantes: siempre obligatorios.
create or replace function pg_temp.variante(p_categoria text, p_sub text, p_atributos text[])
returns void language sql as $$
  insert into public.categorias_atributos (categoria_id, atributo_id, obligatorio, define_variante, orden)
  select pg_temp.categoria(p_categoria, p_sub), a.id, true, true, x.n
  from unnest(p_atributos) with ordinality x(nombre, n)
  join public.atributos a on a.nombre = x.nombre
  on conflict (categoria_id, atributo_id) do update set obligatorio = true, define_variante = true
$$;

-- ----------------------------------------------------------------------------
-- Categorías nuevas
-- ----------------------------------------------------------------------------
do $$
declare v_padre uuid;
begin
  if not exists (select 1 from public.categorias where ruta = '/industria-y-empresas/') then
    update public.categorias set orden = orden + 1 where padre_id is null and orden >= 16;
    insert into public.categorias (nombre, slug, orden) values ('Industria y empresas', 'industria-y-empresas', 16);
  end if;
  select id into v_padre from public.categorias where ruta = '/industria-y-empresas/';
  insert into public.categorias (padre_id, nombre, slug, orden)
  select v_padre, s.nombre, pg_temp.slug(s.nombre), s.n
  from unnest(array['Equipamiento gastronómico', 'Elementos de protección personal', 'Otros productos industriales'])
    with ordinality s(nombre, n)
  on conflict (ruta) do nothing;

  select id into v_padre from public.categorias where ruta = '/alimentos-y-bebidas/';
  if v_padre is not null and not exists (select 1 from public.categorias where ruta = '/alimentos-y-bebidas/vinos/') then
    update public.categorias set orden = orden + 1 where padre_id = v_padre and orden >= 3;
    insert into public.categorias (padre_id, nombre, slug, orden) values (v_padre, 'Vinos', 'vinos', 3);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Atributos con valores conocidos. El resto nace como texto libre al asignarlo.
-- ----------------------------------------------------------------------------
select pg_temp.atributo(nombre, tipo::public.tipo_atributo, unidad, filtrable, opciones)
from (values
  ('Talle', 'lista', null, true,
    array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2', '4', '6', '8', '10', '12', '14', '16']
      || array(select g::text from generate_series(17, 46) g)),
  ('Color', 'lista', null, true, array['Negro', 'Blanco', 'Gris', 'Beige', 'Marrón', 'Rojo', 'Bordó', 'Rosa',
    'Violeta', 'Azul', 'Celeste', 'Verde', 'Amarillo', 'Naranja', 'Dorado', 'Plateado', 'Multicolor', 'Transparente']),
  ('Memoria', 'lista', 'GB', true, array['16', '32', '64', '128', '256', '512', '1024']),
  ('Material', 'texto', null, false, null),
  ('Condición', 'lista', null, true, array['Nuevo', 'Usado', 'Reacondicionado']),
  ('Género', 'lista', null, true, array['Mujer', 'Hombre', 'Unisex', 'Niña', 'Niño']),
  ('Temporada', 'lista', null, true, array['Primavera-verano', 'Otoño-invierno', 'Verano', 'Otoño', 'Invierno',
    'Primavera', 'Todo el año']),
  ('Fresco/congelado', 'lista', null, true, array['Fresco', 'Congelado']),
  ('Interior/exterior', 'lista', null, true, array['Interior', 'Exterior', 'Interior y exterior']),
  ('Elaboración', 'lista', null, true, array['Artesanal', 'Industrial']),
  ('Original/reproducción', 'lista', null, true, array['Original', 'Reproducción']),
  ('Red móvil', 'lista', null, true, array['4G', '5G']),
  ('Eficiencia energética', 'lista', null, true, array['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D']),
  ('Tipo de carga', 'lista', null, true, array['Frontal', 'Superior']),
  ('Tipo de almacenamiento', 'lista', null, true, array['SSD', 'HDD', 'eMMC']),
  ('Combustible', 'lista', null, true, array['Nafta', 'Diésel', 'GNC', 'Eléctrico', 'Híbrido']),
  ('Transmisión', 'lista', null, true, array['Manual', 'Automática']),
  ('Tracción', 'lista', null, true, array['Delantera', 'Trasera', '4x4']),
  ('Nivel de dificultad', 'lista', null, true, array['Baja', 'Media', 'Alta']),
  ('Unidad de cobro', 'lista', null, true, array['Hora', 'Día', 'Semana', 'Mes', 'Evento', 'Temporada',
    'Período personalizado']),
  ('Volumen', 'texto', null, false, null),
  ('Graduación alcohólica', 'numero', '%', false, null),
  ('Acidez', 'numero', '%', false, null),
  ('Cosecha', 'numero', null, true, null),
  ('Año de publicación', 'numero', null, false, null),
  ('Cantidad de páginas', 'numero', null, false, null),
  ('Superficie cubierta', 'numero', 'm²', true, null),
  ('Superficie total', 'numero', 'm²', true, null),
  ('Ambientes', 'numero', null, true, null),
  ('Dormitorios', 'numero', null, true, null),
  ('Baños', 'numero', null, true, null),
  ('Capacidad de personas', 'numero', null, true, null),
  ('Capacidad máxima', 'numero', 'personas', false, null),
  ('Cantidad de personas', 'numero', null, false, null),
  ('Cantidad de comensales', 'numero', null, false, null),
  ('Pasajeros', 'numero', null, true, null),
  ('Puertas', 'numero', null, false, null),
  ('Cantidad de puertas', 'numero', null, false, null),
  ('Cantidad de plazas', 'numero', null, false, null),
  ('Cantidad de velocidades', 'numero', null, false, null),
  ('Número de cuerdas', 'numero', null, false, null),
  ('Número de teclas', 'numero', null, false, null),
  ('Kilometraje', 'numero', 'km', false, null),
  ('Cilindrada', 'numero', 'cc', false, null),
  ('RAM', 'numero', 'GB', true, null),
  ('Tamaño de pantalla', 'numero', 'pulgadas', true, null),
  ('Velocidad de centrifugado', 'numero', 'rpm', false, null),
  ('RPM', 'numero', 'rpm', false, null),
  ('Voltaje', 'numero', 'V', false, null),
  ('Edad mínima', 'numero', 'años', false, null),
  ('Edad máxima', 'numero', 'años', false, null),
  ('Porcentaje de seña', 'numero', '%', false, null),
  ('Monto de garantía', 'numero', '$', false, null),
  ('Horas de uso', 'numero', 'h', false, null),
  ('Capacidad total', 'numero', 'L', false, null),
  ('Capacidad freezer', 'numero', 'L', false, null),
  ('Alto', 'numero', 'cm', false, null),
  ('Ancho', 'numero', 'cm', false, null),
  ('Profundidad', 'numero', 'cm', false, null),
  ('Ancho de neumático', 'numero', 'mm', true, null),
  ('Perfil', 'numero', null, true, null),
  ('Rodado', 'numero', 'pulgadas', true, null)
) as t(nombre, tipo, unidad, filtrable, opciones);

select pg_temp.atributo(nombre, 'si_no', null, filtrable, null)
from (values
  ('Sin TACC', true), ('Sin azúcar', true), ('Orgánico', true), ('Requiere armado', false),
  ('Incluye accesorios', false), ('Lavable', false), ('No Frost', true), ('Dual SIM', true), ('Bluetooth', true),
  ('Resistencia al agua', false), ('Personalizable', true), ('Requiere baterías', false),
  ('Incluye baterías', false), ('Uso profesional', false), ('Desmontable', false), ('Plegable', false),
  ('Amoblado', true), ('Cocina equipada', false), ('Patio', false), ('Jardín', false), ('Pileta', true),
  ('Aire acondicionado', true), ('Calefacción', false), ('Wi-Fi', true), ('Cochera', true), ('GPS', false),
  ('Seguro incluido', false), ('Reserva previa', false), ('Seña requerida', false), ('Depósito/garantía', false),
  ('Entrega a domicilio', true), ('Retiro en local', false), ('Instalación', false), ('Armado', false),
  ('Desarmado', false), ('Servicio técnico/asistencia', false), ('Manual incluido', false),
  ('Estuche/funda', false), ('Soporte incluido', false), ('Cableado incluido', false),
  ('Requiere electricidad', false), ('Instalación incluida', false), ('Traslado incluido', false),
  ('Personal incluido', false), ('Montaje incluido', false), ('Limpieza incluida', false),
  ('Requiere instalación', false), ('Calzado incluido', false), ('Transporte incluido', false)
) as t(nombre, filtrable);

-- ----------------------------------------------------------------------------
-- Variantes. Talle y Color pasan de Indumentaria y calzado a las subcategorías
-- de ropa y calzado; las otras subcategorías que ya tienen productos con talle
-- o color los conservan, para que esos productos se sigan pudiendo editar.
-- ----------------------------------------------------------------------------
select pg_temp.variante('Indumentaria y calzado', s, array['Talle', 'Color'])
from unnest(array['Ropa de mujer', 'Ropa de hombre', 'Ropa infantil', 'Ropa deportiva', 'Calzado',
  'Calzado infantil', 'Calzado de temporada', 'Calzado de mujer', 'Calzado de hombre', 'Lencería', 'Ropa interior',
  'Abrigos', 'Uniformes y ropa de trabajo']) s;

insert into public.categorias_atributos (categoria_id, atributo_id, obligatorio, define_variante)
select distinct c.id, vo.atributo_id, true, true
from public.productos p
join public.categorias c on c.id = p.categoria_id
join public.variantes v on v.producto_id = p.id
join public.variante_opciones vo on vo.variante_id = v.id
join public.atributos a on a.id = vo.atributo_id
where c.ruta like '/indumentaria-y-calzado/_%' and a.nombre in ('Talle', 'Color')
on conflict (categoria_id, atributo_id) do update set obligatorio = true, define_variante = true;

delete from public.categorias_atributos ca
using public.categorias c, public.atributos a
where c.id = ca.categoria_id and a.id = ca.atributo_id
  and c.ruta = '/indumentaria-y-calzado/' and a.nombre in ('Talle', 'Color');

select pg_temp.variante('Deportes y aire libre', 'Indumentaria deportiva', array['Talle', 'Color']);
select pg_temp.variante('Deportes y aire libre', 'Calzado deportivo', array['Talle', 'Color']);
select pg_temp.variante('Juguetes, bebés y niños', 'Ropa infantil', array['Talle', 'Color']);
select pg_temp.variante('Tecnología y electrónica', 'Celulares', array['Memoria', 'Color']);
select pg_temp.variante('Alquileres', null, array['Unidad de cobro']);

-- ----------------------------------------------------------------------------
-- Fichas por categoría y subcategoría
-- ----------------------------------------------------------------------------

-- 1. Alimentos y bebidas
select pg_temp.asignar('Alimentos y bebidas', null, array['Marca', 'Tipo de producto', 'Presentación', 'Peso',
  'Volumen', 'Unidad de venta', 'Sabor', 'Variedad', 'Ingredientes', 'Información nutricional', 'Alérgenos',
  'Origen', 'Fecha de vencimiento', 'Condiciones de conservación']);
select pg_temp.asignar('Alimentos y bebidas', 'Carnes y embutidos', array['Tipo de carne', 'Corte',
  'Fresco/congelado']);
select pg_temp.asignar('Alimentos y bebidas', 'Bebidas', array['Tipo de bebida', 'Graduación alcohólica']);
select pg_temp.asignar('Alimentos y bebidas', 'Vinos', array['Bodega', 'Varietal', 'Tipo de vino', 'Cosecha',
  'Graduación alcohólica', 'Región de origen']);
select pg_temp.asignar('Alimentos y bebidas', 'Panadería y pastelería', array['Tipo', 'Relleno', 'Sin TACC',
  'Sin azúcar', 'Tipo de elaboración']);
select pg_temp.asignar('Alimentos y bebidas', 'Frutas y verduras', array['Tipo', 'Peso aproximado', 'Orgánico']);

-- 2. Indumentaria y calzado
select pg_temp.asignar('Indumentaria y calzado', null, array['Marca', 'Condición', 'Género', 'Material',
  'Composición', 'Estilo', 'Temporada', 'Modelo', 'Corte', 'Tipo de prenda', 'Estampado', 'Edad recomendada',
  'País de fabricación']);
select pg_temp.asignar('Indumentaria y calzado', s, array['Tipo de calzado', 'Tipo de suela', 'Uso'])
from unnest(array['Calzado', 'Calzado infantil', 'Calzado de temporada', 'Calzado de mujer', 'Calzado de hombre']) s;
select pg_temp.asignar('Indumentaria y calzado', s, array['Tipo', 'Color', 'Tamaño'])
from unnest(array['Accesorios', 'Carteras y bolsos', 'Valijas y mochilas']) s;

-- 3. Hogar y decoración
select pg_temp.asignar('Hogar y decoración', null, array['Marca', 'Condición', 'Material', 'Color', 'Dimensiones',
  'Peso', 'Estilo', 'Ambiente', 'Forma', 'Capacidad', 'Tipo de producto', 'Requiere armado', 'Incluye accesorios',
  'País de fabricación']);
select pg_temp.asignar('Hogar y decoración', 'Muebles', array['Tipo', 'Alto', 'Ancho', 'Profundidad',
  'Cantidad de plazas', 'Capacidad de peso']);
select pg_temp.asignar('Hogar y decoración', 'Textiles', array['Tipo', 'Medidas', 'Diseño', 'Composición',
  'Lavable']);

-- 4. Tecnología y electrónica
select pg_temp.asignar('Tecnología y electrónica', null, array['Marca', 'Modelo', 'Tipo', 'Color', 'Condición',
  'Garantía', 'Compatibilidad', 'Conectividad', 'Sistema operativo', 'Alimentación']);
select pg_temp.asignar('Tecnología y electrónica', 'Celulares', array['RAM', 'Tamaño de pantalla', 'Resolución',
  'Cámara', 'Cámara frontal', 'Batería', 'Red móvil', 'Dual SIM']);
select pg_temp.asignar('Tecnología y electrónica', s, array['Procesador', 'RAM', 'Almacenamiento',
  'Tipo de almacenamiento', 'Placa gráfica', 'Pantalla', 'Tamaño de pantalla', 'Resolución'])
from unnest(array['Computadoras', 'Notebooks']) s;
select pg_temp.asignar('Tecnología y electrónica', 'Audio', array['Potencia', 'Bluetooth', 'Autonomía',
  'Resistencia al agua']);

-- 5. Electrodomésticos
select pg_temp.asignar('Electrodomésticos', null, array['Marca', 'Modelo', 'Tipo', 'Color', 'Condición',
  'Capacidad', 'Potencia', 'Consumo energético', 'Dimensiones', 'Peso', 'Garantía', 'Funciones',
  'Eficiencia energética', 'Voltaje']);
select pg_temp.asignar('Electrodomésticos', 'Heladeras y freezers', array['Capacidad total', 'Capacidad freezer',
  'Sistema de frío', 'No Frost', 'Cantidad de puertas']);
select pg_temp.asignar('Electrodomésticos', 'Lavarropas', array['Tipo de carga', 'Velocidad de centrifugado',
  'Programas']);

-- 6. Ferretería, construcción y herramientas
select pg_temp.asignar('Ferretería, construcción y herramientas', null, array['Marca', 'Modelo', 'Tipo',
  'Condición', 'Material', 'Medidas', 'Peso', 'Color', 'Uso', 'Aplicación', 'Compatibilidad', 'Garantía']);
select pg_temp.asignar('Ferretería, construcción y herramientas', 'Herramientas eléctricas', array['Potencia',
  'Voltaje', 'Velocidad', 'Tipo de alimentación', 'Batería', 'Capacidad de batería', 'RPM',
  'Accesorios incluidos']);
select pg_temp.asignar('Ferretería, construcción y herramientas', 'Pinturas', array['Terminación', 'Rendimiento',
  'Volumen', 'Interior/exterior', 'Superficie de aplicación']);
select pg_temp.asignar('Ferretería, construcción y herramientas', 'Materiales de construcción', array['Espesor',
  'Unidad de venta', 'Rendimiento']);

-- 7. Automotor y motocicletas
select pg_temp.asignar('Automotor y motocicletas', null, array['Marca', 'Modelo', 'Condición', 'Tipo de producto',
  'Vehículo compatible', 'Año', 'Motor', 'Código/OEM', 'Material', 'Dimensiones', 'Garantía']);
select pg_temp.asignar('Automotor y motocicletas', 'Neumáticos', array['Medida', 'Ancho de neumático', 'Perfil',
  'Rodado', 'Índice de carga', 'Índice de velocidad', 'Tipo']);
select pg_temp.asignar('Automotor y motocicletas', 'Lubricantes', array['Tipo', 'Viscosidad', 'Volumen',
  'Aplicación', 'Norma', 'Motor compatible']);
select pg_temp.asignar('Automotor y motocicletas', 'Accesorios', array['Tipo', 'Compatibilidad', 'Color']);

-- 8. Salud, belleza y cuidado personal
select pg_temp.asignar('Salud, belleza y cuidado personal', null, array['Marca', 'Tipo', 'Presentación',
  'Contenido', 'Fragancia', 'Tipo de piel', 'Tipo de cabello', 'Ingredientes', 'Uso', 'Edad recomendada',
  'Características especiales']);
select pg_temp.asignar('Salud, belleza y cuidado personal', s, array['Tipo de producto', 'Tono', 'Color', 'Acabado'])
from unnest(array['Cosmética', 'Maquillaje']) s;
select pg_temp.asignar('Salud, belleza y cuidado personal', 'Cuidado capilar', array['Tipo de producto',
  'Función']);
select pg_temp.asignar('Salud, belleza y cuidado personal', 'Perfumería', array['Género', 'Concentración',
  'Volumen', 'Familia olfativa']);

-- 9. Deportes y aire libre
select pg_temp.asignar('Deportes y aire libre', null, array['Marca', 'Condición', 'Tipo', 'Disciplina', 'Género',
  'Talle', 'Material', 'Color', 'Tamaño', 'Peso', 'Nivel de uso', 'Edad recomendada']);
select pg_temp.asignar('Deportes y aire libre', 'Ciclismo', array['Modelo', 'Rodado', 'Talle de cuadro',
  'Material del cuadro', 'Cantidad de velocidades', 'Tipo de freno', 'Suspensión']);
select pg_temp.asignar('Deportes y aire libre', 'Camping', array['Capacidad', 'Dimensiones', 'Impermeabilidad',
  'Temporada', 'Accesorios incluidos']);

-- 10. Mascotas y animales
select pg_temp.asignar('Mascotas y animales', null, array['Marca', 'Tipo', 'Especie', 'Edad', 'Tamaño de mascota',
  'Peso', 'Sabor', 'Presentación', 'Ingredientes', 'Material', 'Color', 'Uso']);
select pg_temp.asignar('Mascotas y animales', s, array['Tipo de alimento', 'Necesidades específicas'])
from unnest(array['Alimentos para perros', 'Alimentos para gatos', 'Alimentos para otros animales']) s;
select pg_temp.asignar('Mascotas y animales', 'Accesorios', array['Medidas']);

-- 11. Librería, papelería y oficina
select pg_temp.asignar('Librería, papelería y oficina', null, array['Marca', 'Condición', 'Tipo', 'Material',
  'Color', 'Tamaño', 'Formato', 'Cantidad', 'Tema', 'Uso', 'Edad recomendada']);
select pg_temp.asignar('Librería, papelería y oficina', 'Libros', array['Título', 'Autor', 'Editorial', 'ISBN',
  'Género literario', 'Idioma', 'Año de publicación', 'Cantidad de páginas']);

-- 12. Juguetes, bebés y niños
select pg_temp.asignar('Juguetes, bebés y niños', null, array['Marca', 'Condición', 'Tipo', 'Edad recomendada',
  'Género', 'Material', 'Color', 'Tamaño', 'Peso', 'Personaje', 'Función', 'Requiere baterías', 'Incluye baterías',
  'Advertencias de seguridad']);
select pg_temp.asignar('Juguetes, bebés y niños', 'Bebés', array['Etapa', 'Peso máximo',
  'Características de seguridad']);

-- 13. Regalos, artesanías y personalizados
select pg_temp.asignar('Regalos, artesanías y personalizados', null, array['Marca', 'Condición', 'Tipo',
  'Material', 'Color', 'Tamaño', 'Diseño', 'Personalizable', 'Texto personalizado', 'Imagen personalizada',
  'Tiempo de producción', 'Ocasión', 'Tema', 'Presentación']);
select pg_temp.asignar('Regalos, artesanías y personalizados', 'Productos personalizados',
  array['Tipo de personalización']);

-- 14. Jardinería, viveros y agricultura
select pg_temp.asignar('Jardinería, viveros y agricultura', null, array['Marca', 'Condición', 'Tipo', 'Especie',
  'Variedad', 'Tamaño', 'Presentación', 'Material', 'Uso', 'Época de plantación', 'Exposición solar',
  'Frecuencia de riego', 'Resistencia', 'Origen']);
select pg_temp.asignar('Jardinería, viveros y agricultura', 'Plantas', array['Interior/exterior', 'Luz',
  'Tipo de suelo']);
select pg_temp.asignar('Jardinería, viveros y agricultura', 'Semillas', array['Cantidad', 'Época de siembra',
  'Tiempo de germinación', 'Ciclo']);

-- 15. Productos regionales y producción local
select pg_temp.asignar('Productos regionales y producción local', null, array['Productor/marca',
  'Tipo de producto', 'Región de origen', 'Localidad', 'Elaboración', 'Ingredientes', 'Presentación', 'Peso',
  'Volumen', 'Variedad', 'Fecha de elaboración', 'Fecha de vencimiento', 'Certificaciones',
  'Características regionales']);
select pg_temp.asignar('Productos regionales y producción local', 'Vinos', array['Bodega', 'Varietal', 'Cosecha',
  'Graduación alcohólica']);
select pg_temp.asignar('Productos regionales y producción local', 'Aceites de oliva', array['Tipo',
  'Variedad de aceituna', 'Acidez']);

-- 16. Industria y empresas
select pg_temp.asignar('Industria y empresas', null, array['Marca', 'Modelo', 'Condición', 'Tipo', 'Aplicación',
  'Material', 'Capacidad', 'Potencia', 'Voltaje', 'Dimensiones', 'Peso', 'Rendimiento', 'Compatibilidad',
  'Garantía', 'Normas/certificaciones']);
select pg_temp.asignar('Industria y empresas', 'Equipamiento gastronómico', array['Alimentación',
  'Uso profesional']);
select pg_temp.asignar('Industria y empresas', 'Elementos de protección personal', array['Talle',
  'Nivel de protección', 'Uso']);

-- 17. Música, fiestas y recreación
select pg_temp.asignar('Música, fiestas y recreación', null, array['Artista/marca', 'Condición', 'Tipo',
  'Material', 'Técnica', 'Dimensiones', 'Peso', 'Año', 'Estilo', 'Tema', 'Edición', 'Original/reproducción']);
select pg_temp.asignar('Música, fiestas y recreación', 'Instrumentos musicales', array['Marca', 'Modelo', 'Color',
  'Tamaño', 'Número de cuerdas', 'Número de teclas', 'Accesorios incluidos']);

-- 18. Turismo y actividades: las experiencias no son productos físicos.
select pg_temp.asignar('Turismo y actividades', s, array['Tipo de experiencia', 'Ubicación', 'Localidad',
  'Duración', 'Capacidad', 'Edad mínima', 'Edad máxima', 'Fecha', 'Horario', 'Temporada', 'Incluye', 'No incluye',
  'Requisitos', 'Punto de encuentro', 'Idioma', 'Nivel de dificultad', 'Cancelación'])
from unnest(array['Experiencias', 'Actividades recreativas']) s;
select pg_temp.asignar('Turismo y actividades', s, array['Marca', 'Condición'])
from unnest(array['Equipamiento para turismo', 'Camping y aventura', 'Productos para viajeros', 'Souvenirs']) s;

-- 19. Alquileres: lo general vale para todo lo que se alquila.
select pg_temp.asignar('Alquileres', null, array['Modalidad de alquiler', 'Duración mínima', 'Duración máxima',
  'Disponibilidad', 'Reserva previa', 'Anticipación mínima para reservar', 'Seña requerida', 'Porcentaje de seña',
  'Depósito/garantía', 'Monto de garantía', 'Requisitos para alquilar', 'Documentación requerida', 'Edad mínima',
  'Entrega a domicilio', 'Retiro en local', 'Costo de traslado', 'Instalación', 'Armado', 'Desarmado',
  'Servicio técnico/asistencia', 'Condiciones de devolución', 'Penalización por demora', 'Penalización por daños',
  'Términos y condiciones']);
select pg_temp.asignar('Alquileres', 'Inmuebles', array['Tipo de inmueble', 'Superficie cubierta',
  'Superficie total', 'Ambientes', 'Dormitorios', 'Baños', 'Capacidad de personas', 'Ubicación', 'Barrio/zona',
  'Dirección', 'Cochera', 'Amoblado', 'Cocina equipada', 'Patio', 'Jardín', 'Pileta', 'Aire acondicionado',
  'Calefacción', 'Wi-Fi', 'Accesibilidad', 'Servicios incluidos', 'Uso permitido', 'Capacidad máxima',
  'Reglas/condiciones']);
select pg_temp.asignar('Alquileres', 'Vehículos', array['Marca', 'Modelo', 'Año', 'Versión', 'Tipo de vehículo',
  'Combustible', 'Transmisión', 'Pasajeros', 'Puertas', 'Capacidad de carga', 'Kilometraje', 'Cilindrada',
  'Potencia', 'Tracción', 'Color', 'Equipamiento', 'Aire acondicionado', 'GPS', 'Seguro incluido', 'Documentación',
  'Licencia requerida', 'Límite de kilometraje', 'Zona permitida de circulación']);
select pg_temp.asignar('Alquileres', 'Herramientas y maquinaria', array['Marca', 'Modelo', 'Tipo', 'Condición',
  'Potencia', 'Voltaje', 'Alimentación', 'Capacidad', 'Peso', 'Dimensiones', 'Rendimiento', 'Aplicación',
  'Material de trabajo', 'Accesorios incluidos', 'Combustible', 'Horas de uso', 'Requisitos de operación',
  'Elementos de seguridad', 'Manual incluido']);
select pg_temp.asignar('Alquileres', 'Instrumentos y equipamiento musical', array['Marca', 'Modelo', 'Tipo',
  'Material', 'Color', 'Tamaño', 'Condición', 'Número de cuerdas', 'Número de teclas', 'Potencia', 'Impedancia',
  'Conectividad', 'Entradas', 'Salidas', 'Compatibilidad', 'Accesorios incluidos', 'Estuche/funda',
  'Soporte incluido', 'Cableado incluido']);
select pg_temp.asignar('Alquileres', 'Fiestas y eventos', array['Tipo', 'Marca', 'Modelo', 'Capacidad',
  'Cantidad de personas', 'Edad recomendada', 'Dimensiones', 'Material', 'Color', 'Temática', 'Interior/exterior',
  'Requiere electricidad', 'Potencia', 'Accesorios incluidos', 'Instalación incluida', 'Traslado incluido',
  'Tiempo de armado', 'Requisitos del espacio', 'Requisitos de seguridad']);
select pg_temp.asignar('Alquileres', 'Catering y equipamiento gastronómico', array['Tipo', 'Marca', 'Modelo',
  'Capacidad', 'Cantidad', 'Material', 'Dimensiones', 'Potencia', 'Voltaje', 'Temperatura de funcionamiento',
  'Cantidad de comensales', 'Equipamiento incluido', 'Personal incluido', 'Montaje incluido', 'Traslado incluido',
  'Limpieza incluida', 'Requiere instalación', 'Requisitos del espacio']);
select pg_temp.asignar('Alquileres', 'Indumentaria y disfraces', array['Tipo', 'Talle', 'Edad', 'Género',
  'Personaje', 'Temática', 'Color', 'Material', 'Condición', 'Accesorios incluidos', 'Calzado incluido',
  'Personalización', 'Ocasión de uso', 'Requisitos de devolución']);
select pg_temp.asignar('Alquileres', 'Deportes, camping y recreación', array['Marca', 'Modelo', 'Tipo',
  'Disciplina', 'Material', 'Tamaño', 'Capacidad', 'Peso', 'Dimensiones', 'Edad recomendada', 'Nivel de uso',
  'Accesorios incluidos', 'Interior/exterior', 'Temporada', 'Requisitos de seguridad']);
select pg_temp.asignar('Alquileres', 'Fotografía, video y tecnología', array['Marca', 'Modelo', 'Tipo',
  'Condición', 'Resolución', 'Capacidad', 'Memoria', 'Almacenamiento', 'Conectividad', 'Wi-Fi', 'Bluetooth',
  'Entradas', 'Salidas', 'Compatibilidad', 'Accesorios incluidos', 'Batería', 'Duración de batería',
  'Software incluido', 'Requisitos técnicos']);
select pg_temp.asignar('Alquileres', 'Mobiliario y equipamiento comercial', array['Tipo', 'Material', 'Color',
  'Dimensiones', 'Peso', 'Capacidad', 'Cantidad', 'Condición', 'Uso', 'Desmontable', 'Plegable',
  'Accesorios incluidos', 'Requiere armado', 'Instalación incluida', 'Transporte incluido']);
select pg_temp.asignar('Alquileres', 'Equipamiento médico y profesional', array['Marca', 'Modelo', 'Tipo',
  'Condición', 'Capacidad', 'Peso soportado', 'Dimensiones', 'Material', 'Ajustes', 'Accesorios incluidos',
  'Requisitos de uso', 'Requisitos de seguridad', 'Certificaciones']);
select pg_temp.asignar('Alquileres', 'Otros alquileres', array['Tipo', 'Marca', 'Modelo', 'Condición', 'Material',
  'Color', 'Dimensiones', 'Peso', 'Capacidad', 'Cantidad', 'Uso', 'Accesorios incluidos',
  'Requisitos de utilización', 'Condiciones especiales']);

-- ----------------------------------------------------------------------------
-- La ficha se muestra en el orden de la lista: variantes, después lo heredado
-- de más arriba y al final lo propio de la subcategoría.
-- ----------------------------------------------------------------------------
create or replace function pkg_catalogo.atributos_categoria(p_categoria uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', ac.atributo_id,
           'nombre', ac.nombre,
           'tipo', ac.tipo,
           'unidad', a.unidad,
           'obligatorio', ac.obligatorio,
           'define_variante', ac.define_variante,
           'opciones', coalesce((
             select jsonb_agg(jsonb_build_object('id', o.id, 'valor', o.valor) order by o.orden, o.valor)
             from public.atributo_opciones o
             where o.atributo_id = ac.atributo_id
           ), '[]'::jsonb)
         ) order by ac.define_variante desc, pos.profundidad, pos.orden, ac.nombre), '[]'::jsonb)
  from public.atributos_de_categoria(p_categoria) ac
  join public.atributos a on a.id = ac.atributo_id
  cross join lateral (
    select length(padre.ruta) as profundidad, ca.orden
    from public.categorias c
    join public.categorias padre on c.ruta like padre.ruta || '%'
    join public.categorias_atributos ca on ca.categoria_id = padre.id and ca.atributo_id = ac.atributo_id
    where c.id = p_categoria
    order by length(padre.ruta) desc
    limit 1
  ) pos
$$;
