-- ============================================================================
-- Índices para todas las llaves foráneas que no tenían uno.
-- PostgreSQL no indexa solo las llaves foráneas: sin índice, cada unión por esa
-- columna y cada borrado en la tabla referenciada (on delete cascade / restrict)
-- recorre la tabla completa.
-- Además, índices para los listados que hacen los paquetes pkg_*.
-- ============================================================================

-- Catálogo
create index if not exists categorias_atributos_atributo_id_idx on public.categorias_atributos (atributo_id);
create index if not exists producto_atributos_tienda_id_idx    on public.producto_atributos (tienda_id);
create index if not exists producto_atributos_atributo_id_idx  on public.producto_atributos (atributo_id);
create index if not exists producto_atributos_opcion_id_idx    on public.producto_atributos (opcion_id);
create index if not exists variante_opciones_atributo_id_idx   on public.variante_opciones (atributo_id);
create index if not exists variante_opciones_opcion_id_idx     on public.variante_opciones (opcion_id);
create index if not exists imagenes_producto_tienda_id_idx     on public.imagenes_producto (tienda_id);
create index if not exists imagenes_producto_variante_id_idx   on public.imagenes_producto (variante_id);

-- Tiendas, planes y equipo
create index if not exists suscripciones_plan_id_idx        on public.suscripciones (plan_id);
create index if not exists roles_tienda_tienda_id_idx       on public.roles_tienda (tienda_id);
create index if not exists roles_permisos_permiso_codigo_idx on public.roles_permisos (permiso_codigo);
create index if not exists miembros_tienda_rol_id_idx       on public.miembros_tienda (rol_id);
create index if not exists miembros_tienda_invitado_por_idx on public.miembros_tienda (invitado_por);
create index if not exists invitaciones_rol_id_idx          on public.invitaciones (rol_id);
create index if not exists invitaciones_invitado_por_idx    on public.invitaciones (invitado_por);

-- Clientes, compras y pagos
create index if not exists direcciones_localidad_id_idx   on public.direcciones (localidad_id);
create index if not exists carrito_items_variante_id_idx  on public.carrito_items (variante_id);
create index if not exists pedido_items_tienda_id_idx     on public.pedido_items (tienda_id);
create index if not exists pedido_items_variante_id_idx   on public.pedido_items (variante_id);
create index if not exists pagos_pedido_tienda_id_idx     on public.pagos (pedido_tienda_id);
create index if not exists historial_estados_usuario_id_idx on public.historial_estados (usuario_id);

-- Comunicación y administración
create index if not exists mensajes_pedido_autor_id_idx     on public.mensajes_pedido (autor_id);
create index if not exists preguntas_usuario_id_idx         on public.preguntas (usuario_id);
create index if not exists preguntas_respondida_por_idx     on public.preguntas (respondida_por);
create index if not exists reclamos_usuario_id_idx          on public.reclamos (usuario_id);
create index if not exists denuncias_tienda_id_idx          on public.denuncias (tienda_id);
create index if not exists denuncias_producto_id_idx        on public.denuncias (producto_id);
create index if not exists denuncias_usuario_id_idx         on public.denuncias (usuario_id);
create index if not exists solicitudes_consumidor_suscripcion_id_idx   on public.solicitudes_consumidor (suscripcion_id);
create index if not exists solicitudes_consumidor_pedido_tienda_id_idx on public.solicitudes_consumidor (pedido_tienda_id);

-- Listados de los paquetes
-- Panel de administración: tiendas por estado, las más nuevas primero.
create index if not exists tiendas_estado_creado_en_idx on public.tiendas (estado, creado_en desc);
-- Portada: tiendas activas por nombre.
create index if not exists tiendas_activas_nombre_idx on public.tiendas (nombre) where estado = 'activa';
-- Página de la tienda: productos publicados, los más recientes primero.
create index if not exists productos_publicados_tienda_idx
  on public.productos (tienda_id, publicado_en desc) where estado = 'publicado';
