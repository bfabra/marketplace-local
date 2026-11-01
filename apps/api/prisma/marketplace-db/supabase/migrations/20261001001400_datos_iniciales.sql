-- ============================================================================
-- Datos iniciales que necesita producción: ubicación, planes, permisos,
-- roles predefinidos y parámetros. Todo se puede cambiar después desde el
-- panel admin (son filas, no código).
-- ============================================================================

-- Provincias: San Juan activa; las demás listas para activar.
insert into public.provincias (nombre, slug, activa) values
  ('San Juan', 'san-juan', true),
  ('Mendoza', 'mendoza', false),
  ('Córdoba', 'cordoba', false),
  ('Buenos Aires', 'buenos-aires', false);

-- Departamentos de San Juan.
insert into public.localidades (provincia_id, nombre, slug)
select p.id, l.nombre, l.slug
from public.provincias p,
  (values ('Capital', 'capital'), ('Rawson', 'rawson'), ('Chimbas', 'chimbas'),
          ('Rivadavia', 'rivadavia'), ('Santa Lucía', 'santa-lucia'), ('Pocito', 'pocito'),
          ('Albardón', 'albardon'), ('Angaco', 'angaco'),
          ('Calingasta', 'calingasta'), ('Caucete', 'caucete'), ('Iglesia', 'iglesia'),
          ('Jáchal', 'jachal'), ('9 de Julio', '9-de-julio'), ('San Martín', 'san-martin'),
          ('Sarmiento', 'sarmiento'), ('Ullum', 'ullum'), ('Valle Fértil', 'valle-fertil'),
          ('25 de Mayo', '25-de-mayo'), ('Zonda', 'zonda')) as l(nombre, slug)
where p.slug = 'san-juan';

-- Planes acordados. PENDIENTE: precios del Plan 1 y del Plan 2 (hoy en 0).
insert into public.planes (nombre, precio_mensual, max_productos, max_empleados, es_gratis, orden) values
  ('Gratis', 0, 10,   0,    true,  1),
  ('Plan 1', 0, 100,  3,    false, 2),
  ('Plan 2', 0, null, null, false, 3);

-- Permisos que se pueden dar a los empleados.
insert into public.permisos (codigo, area, descripcion) values
  ('productos.ver',        'Productos',     'Ver todos los productos de la tienda, incluidos borradores'),
  ('productos.editar',     'Productos',     'Crear, editar y borrar productos, variantes e imágenes'),
  ('productos.publicar',   'Productos',     'Publicar y pausar productos'),
  ('stock.editar',         'Stock',         'Modificar existencias'),
  ('pedidos.ver',          'Pedidos',       'Ver los pedidos de la tienda'),
  ('pedidos.gestionar',    'Pedidos',       'Cambiar el estado de los pedidos (preparación, listo, cancelación)'),
  ('preguntas.responder',  'Atención',      'Ver y responder preguntas de clientes'),
  ('clientes.ver',         'Clientes',      'Ver nombre y teléfono de quienes compraron'),
  ('ventas.ver',           'Ventas',        'Ver ventas, comisiones y reembolsos'),
  ('configuracion.editar', 'Configuración', 'Modificar los datos de la tienda');
-- Suscripción y empleados quedan reservados al dueño (no son permisos delegables).

-- Roles predefinidos para cualquier tienda.
with r as (
  insert into public.roles_tienda (tienda_id, nombre) values
    (null, 'Catálogo'), (null, 'Pedidos'), (null, 'Atención')
  returning id, nombre
)
insert into public.roles_permisos (rol_id, permiso_codigo)
select r.id, p.codigo from r join (values
  ('Catálogo', 'productos.ver'), ('Catálogo', 'productos.editar'),
  ('Catálogo', 'productos.publicar'), ('Catálogo', 'stock.editar'),
  ('Pedidos', 'pedidos.ver'), ('Pedidos', 'pedidos.gestionar'), ('Pedidos', 'clientes.ver'),
  ('Atención', 'productos.ver'), ('Atención', 'preguntas.responder'), ('Atención', 'pedidos.ver')
) as p(rol, codigo) on p.rol = r.nombre;

-- Parámetros de la plataforma.
insert into public.configuracion (clave, valor, descripcion) values
  ('retiro_en_local_habilitado', 'true', 'Si el cliente puede elegir retirar en el local'),
  ('dias_gracia',                '7',    'Días de gracia cuando falla el cobro de la suscripción'),
  ('minutos_reserva_stock',      '15',   'Minutos que se reserva el stock mientras el cliente paga'),
  ('dias_conservacion_datos',    '90',   'Días que se conservan los datos de una tienda vencida'),
  ('dias_vencimiento_invitacion','7',    'Días de validez de una invitación a empleado');
