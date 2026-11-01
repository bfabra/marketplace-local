-- ============================================================================
-- Seguridad por filas (RLS): qué filas puede ver y cambiar cada usuario.
-- Con RLS activado, si ninguna política lo permite, la base no devuelve nada.
-- El servidor (service_role) no pasa por estas reglas: por eso su clave
-- nunca debe llegar al navegador.
-- ============================================================================

-- Activa RLS en todas las tablas del esquema public.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Tablas que solo usa el servidor: ni lectura desde el navegador.
revoke all on public.cuentas_mp_tienda from anon, authenticated;
revoke all on public.reservas_stock    from anon, authenticated;

-- ----------------------------------------------------------------------------
-- MÓDULO 1 · Identidad y ubicación
-- ----------------------------------------------------------------------------
create policy "ubicacion: lectura pública" on public.provincias
  for select to anon, authenticated using (activa or public.es_admin());
create policy "ubicacion: admin edita" on public.provincias
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "localidades: lectura pública" on public.localidades
  for select to anon, authenticated using (activa or public.es_admin());
create policy "localidades: admin edita" on public.localidades
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "perfiles: el propio" on public.perfiles
  for select to authenticated using (id = auth.uid());
create policy "perfiles: el propio edita" on public.perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "perfiles: admin y soporte ven" on public.perfiles
  for select to authenticated using (public.es_admin('soporte'));
create policy "perfiles: el dueño ve a sus empleados" on public.perfiles
  for select to authenticated using (exists (
    select 1 from public.miembros_tienda m
    where m.usuario_id = perfiles.id and public.es_duenio(m.tienda_id)));
create policy "perfiles: el comercio ve a sus compradores" on public.perfiles
  for select to authenticated using (exists (
    select 1 from public.pedidos p join public.pedidos_tienda pt on pt.pedido_id = p.id
    where p.comprador_id = perfiles.id and public.tiene_permiso(pt.tienda_id, 'clientes.ver')));
create policy "perfiles: el repartidor ve al cliente de su entrega" on public.perfiles
  for select to authenticated using (exists (
    select 1 from public.pedidos p
    where p.comprador_id = perfiles.id and public.es_repartidor_de_pedido(p.id)));

create policy "direcciones: las propias" on public.direcciones
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy "roles_plataforma: el propio o superadmin" on public.roles_plataforma
  for select to authenticated using (usuario_id = auth.uid() or public.es_admin('superadmin'));
create policy "roles_plataforma: solo superadmin asigna" on public.roles_plataforma
  for all to authenticated
  using (public.es_admin('superadmin')) with check (public.es_admin('superadmin'));

-- ----------------------------------------------------------------------------
-- MÓDULO 2 · Tiendas y planes
-- ----------------------------------------------------------------------------
create policy "planes: lectura pública" on public.planes
  for select to anon, authenticated using (activo or public.es_admin());
create policy "planes: admin edita" on public.planes
  for all to authenticated using (public.es_admin('finanzas')) with check (public.es_admin('finanzas'));

create policy "tiendas: las activas son públicas" on public.tiendas
  for select to anon, authenticated using (estado = 'activa');
create policy "tiendas: dueño y empleados ven la suya" on public.tiendas
  for select to authenticated
  using (propietario_id = auth.uid() or public.es_miembro(id) or public.es_admin());
create policy "tiendas: cualquiera con cuenta crea" on public.tiendas
  for insert to authenticated with check (propietario_id = auth.uid());
create policy "tiendas: editar con permiso de configuración" on public.tiendas
  for update to authenticated
  using (public.tiene_permiso(id, 'configuracion.editar') or public.es_admin())
  with check (public.tiene_permiso(id, 'configuracion.editar') or public.es_admin());

create policy "suscripciones: el dueño ve las suyas" on public.suscripciones
  for select to authenticated using (public.es_duenio(tienda_id) or public.es_admin('finanzas'));
create policy "suscripciones: finanzas edita" on public.suscripciones
  for all to authenticated using (public.es_admin('finanzas')) with check (public.es_admin('finanzas'));

create policy "pagos_suscripcion: el dueño ve los suyos" on public.pagos_suscripcion
  for select to authenticated using (
    public.es_admin('finanzas') or exists (
      select 1 from public.suscripciones s
      where s.id = suscripcion_id and public.es_duenio(s.tienda_id)));

-- cuentas_mp_tienda: sin políticas → solo el servidor.

-- ----------------------------------------------------------------------------
-- MÓDULO 3 · Equipo y permisos
-- ----------------------------------------------------------------------------
create policy "permisos: lectura" on public.permisos
  for select to authenticated using (true);

create policy "roles_tienda: ver predefinidos y los de mi tienda" on public.roles_tienda
  for select to authenticated using (tienda_id is null or public.es_miembro(tienda_id));
create policy "roles_tienda: el dueño crea los suyos" on public.roles_tienda
  for all to authenticated using (public.es_duenio(tienda_id)) with check (public.es_duenio(tienda_id));

create policy "roles_permisos: ver" on public.roles_permisos
  for select to authenticated using (exists (
    select 1 from public.roles_tienda r
    where r.id = rol_id and (r.tienda_id is null or public.es_miembro(r.tienda_id))));
create policy "roles_permisos: el dueño edita sus roles" on public.roles_permisos
  for all to authenticated
  using (exists (select 1 from public.roles_tienda r where r.id = rol_id and public.es_duenio(r.tienda_id)))
  with check (exists (select 1 from public.roles_tienda r where r.id = rol_id and public.es_duenio(r.tienda_id)));

create policy "miembros: ver" on public.miembros_tienda
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_duenio(tienda_id) or public.es_admin('soporte'));
create policy "miembros: el dueño gestiona" on public.miembros_tienda
  for update to authenticated using (public.es_duenio(tienda_id)) with check (public.es_duenio(tienda_id));
create policy "miembros: el dueño retira" on public.miembros_tienda
  for delete to authenticated using (public.es_duenio(tienda_id));
-- El alta de empleados se hace con aceptar_invitacion().

create policy "invitaciones: el dueño ve y anula" on public.invitaciones
  for select to authenticated using (public.es_duenio(tienda_id));
create policy "invitaciones: el dueño anula" on public.invitaciones
  for update to authenticated using (public.es_duenio(tienda_id)) with check (public.es_duenio(tienda_id));
-- El alta se hace con crear_invitacion().

-- ----------------------------------------------------------------------------
-- MÓDULO 4 · Catálogo
-- ----------------------------------------------------------------------------
create policy "categorias: lectura pública" on public.categorias
  for select to anon, authenticated using (activa or public.es_admin());
create policy "categorias: moderación edita" on public.categorias
  for all to authenticated using (public.es_admin('moderacion')) with check (public.es_admin('moderacion'));

create policy "atributos: lectura pública" on public.atributos
  for select to anon, authenticated using (true);
create policy "atributos: moderación edita" on public.atributos
  for all to authenticated using (public.es_admin('moderacion')) with check (public.es_admin('moderacion'));

create policy "atributo_opciones: lectura pública" on public.atributo_opciones
  for select to anon, authenticated using (true);
create policy "atributo_opciones: moderación edita" on public.atributo_opciones
  for all to authenticated using (public.es_admin('moderacion')) with check (public.es_admin('moderacion'));

create policy "categorias_atributos: lectura pública" on public.categorias_atributos
  for select to anon, authenticated using (true);
create policy "categorias_atributos: moderación edita" on public.categorias_atributos
  for all to authenticated using (public.es_admin('moderacion')) with check (public.es_admin('moderacion'));

create policy "productos: publicados de tiendas activas" on public.productos
  for select to anon, authenticated using (estado = 'publicado' and public.tienda_activa(tienda_id));
create policy "productos: la tienda ve todos los suyos" on public.productos
  for select to authenticated
  using (public.tiene_permiso(tienda_id, 'productos.ver') or public.es_admin('moderacion'));
create policy "productos: crear con permiso" on public.productos
  for insert to authenticated with check (public.tiene_permiso(tienda_id, 'productos.editar'));
create policy "productos: editar con permiso" on public.productos
  for update to authenticated
  using (public.tiene_permiso(tienda_id, 'productos.editar')
         or public.tiene_permiso(tienda_id, 'productos.publicar')
         or public.es_admin('moderacion'))
  with check (public.tiene_permiso(tienda_id, 'productos.editar')
              or public.tiene_permiso(tienda_id, 'productos.publicar')
              or public.es_admin('moderacion'));
create policy "productos: borrar con permiso" on public.productos
  for delete to authenticated using (public.tiene_permiso(tienda_id, 'productos.editar'));

-- Tablas hijas del producto: se ven si el producto se ve; se editan con productos.editar.
create policy "producto_atributos: lectura" on public.producto_atributos
  for select to anon, authenticated
  using (public.producto_visible(producto_id) or public.tiene_permiso(tienda_id, 'productos.ver'));
create policy "producto_atributos: edita la tienda" on public.producto_atributos
  for all to authenticated
  using (public.tiene_permiso(tienda_id, 'productos.editar'))
  with check (public.tiene_permiso(public.tienda_de_producto(producto_id), 'productos.editar'));

create policy "variantes: lectura" on public.variantes
  for select to anon, authenticated
  using (public.producto_visible(producto_id) or public.tiene_permiso(tienda_id, 'productos.ver')
         or public.tiene_permiso(tienda_id, 'stock.editar'));
create policy "variantes: crear y borrar con productos.editar" on public.variantes
  for insert to authenticated
  with check (public.tiene_permiso(public.tienda_de_producto(producto_id), 'productos.editar'));
create policy "variantes: borrar con productos.editar" on public.variantes
  for delete to authenticated using (public.tiene_permiso(tienda_id, 'productos.editar'));
create policy "variantes: editar precio o stock" on public.variantes
  for update to authenticated
  using (public.tiene_permiso(tienda_id, 'productos.editar') or public.tiene_permiso(tienda_id, 'stock.editar'))
  with check (public.tiene_permiso(tienda_id, 'productos.editar') or public.tiene_permiso(tienda_id, 'stock.editar'));

create policy "variante_opciones: lectura" on public.variante_opciones
  for select to anon, authenticated using (exists (
    select 1 from public.variantes v where v.id = variante_id));  -- hereda lo que se ve de variantes
create policy "variante_opciones: edita la tienda" on public.variante_opciones
  for all to authenticated
  using (exists (select 1 from public.variantes v
                 where v.id = variante_id and public.tiene_permiso(v.tienda_id, 'productos.editar')))
  with check (exists (select 1 from public.variantes v
                      where v.id = variante_id and public.tiene_permiso(v.tienda_id, 'productos.editar')));

create policy "imagenes: lectura" on public.imagenes_producto
  for select to anon, authenticated
  using (public.producto_visible(producto_id) or public.tiene_permiso(tienda_id, 'productos.ver'));
create policy "imagenes: edita la tienda" on public.imagenes_producto
  for all to authenticated
  using (public.tiene_permiso(tienda_id, 'productos.editar'))
  with check (public.tiene_permiso(public.tienda_de_producto(producto_id), 'productos.editar'));

-- ----------------------------------------------------------------------------
-- MÓDULO 5 · Compras y pedidos
-- ----------------------------------------------------------------------------
create policy "carritos: el propio" on public.carritos
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy "carrito_items: los propios" on public.carrito_items
  for all to authenticated
  using (exists (select 1 from public.carritos c where c.id = carrito_id and c.usuario_id = auth.uid()))
  with check (exists (select 1 from public.carritos c where c.id = carrito_id and c.usuario_id = auth.uid()));

-- Pendiente de decisión: hoy el comercio ve la compra general (incluida la
-- dirección). Ver "Qué datos del comprador ve cada comercio".
create policy "pedidos: comprador, comercio, repartidor y admin" on public.pedidos
  for select to authenticated using (
       comprador_id = auth.uid()
    or public.es_repartidor_de_pedido(id)
    or public.es_admin('logistica') or public.es_admin('soporte') or public.es_admin('finanzas')
    or exists (select 1 from public.pedidos_tienda pt
               where pt.pedido_id = pedidos.id and public.tiene_permiso(pt.tienda_id, 'pedidos.ver')));

create policy "pedidos_tienda: ver" on public.pedidos_tienda
  for select to authenticated using (
       public.es_comprador(pedido_id)
    or public.tiene_permiso(tienda_id, 'pedidos.ver')
    or public.es_repartidor_de_pedido(pedido_id)
    or public.es_admin('logistica') or public.es_admin('soporte') or public.es_admin('finanzas'));
create policy "pedidos_tienda: el comercio gestiona su parte" on public.pedidos_tienda
  for update to authenticated
  using (public.tiene_permiso(tienda_id, 'pedidos.gestionar') or public.es_admin('logistica') or public.es_admin('soporte'))
  with check (public.tiene_permiso(tienda_id, 'pedidos.gestionar') or public.es_admin('logistica') or public.es_admin('soporte'));

create policy "pedido_items: ver" on public.pedido_items
  for select to authenticated using (public.puede_ver_pedido_tienda(pedido_tienda_id));

create policy "historial_estados: ver" on public.historial_estados
  for select to authenticated using (public.puede_ver_pedido_tienda(pedido_tienda_id));

-- ----------------------------------------------------------------------------
-- MÓDULO 6 · Pagos de ventas
-- ----------------------------------------------------------------------------
create policy "pagos: solo finanzas" on public.pagos
  for select to authenticated using (public.es_admin('finanzas'));

create policy "reembolsos: comprador, comercio con ventas.ver y finanzas" on public.reembolsos
  for select to authenticated using (
       public.es_comprador(public.pedido_de_pedido_tienda(pedido_tienda_id))
    or public.tiene_permiso(public.tienda_de_pedido_tienda(pedido_tienda_id), 'ventas.ver')
    or public.es_admin('finanzas'));

-- ----------------------------------------------------------------------------
-- MÓDULO 7 · Logística
-- ----------------------------------------------------------------------------
create policy "tarifas: lectura pública" on public.tarifas_envio
  for select to anon, authenticated using (activa or public.es_admin());
create policy "tarifas: logística edita" on public.tarifas_envio
  for all to authenticated using (public.es_admin('logistica')) with check (public.es_admin('logistica'));

create policy "repartidores: el propio y logística" on public.repartidores
  for select to authenticated using (usuario_id = auth.uid() or public.es_admin('logistica'));
create policy "repartidores: logística edita" on public.repartidores
  for all to authenticated using (public.es_admin('logistica')) with check (public.es_admin('logistica'));

create policy "envios: comprador, repartidor y logística" on public.envios
  for select to authenticated using (
       public.es_comprador(pedido_id)
    or repartidor_id = public.mi_repartidor_id()
    or public.es_admin('logistica') or public.es_admin('soporte'));
create policy "envios: repartidor marca entrega, logística asigna" on public.envios
  for update to authenticated
  using (repartidor_id = public.mi_repartidor_id() or public.es_admin('logistica'))
  with check (repartidor_id = public.mi_repartidor_id() or public.es_admin('logistica'));

create policy "recolecciones: repartidor, comercio y logística" on public.recolecciones
  for select to authenticated using (
       repartidor_id = public.mi_repartidor_id()
    or public.tiene_permiso(tienda_id, 'pedidos.ver')
    or public.es_admin('logistica'));
create policy "recolecciones: repartidor y logística actualizan" on public.recolecciones
  for update to authenticated
  using (repartidor_id = public.mi_repartidor_id() or public.es_admin('logistica'))
  with check (repartidor_id = public.mi_repartidor_id() or public.es_admin('logistica'));

-- ----------------------------------------------------------------------------
-- MÓDULO 8 · Comunicación
-- ----------------------------------------------------------------------------
create policy "preguntas: las visibles son públicas" on public.preguntas
  for select to anon, authenticated using (visible and public.producto_visible(producto_id));
create policy "preguntas: autor, comercio y moderación ven todas" on public.preguntas
  for select to authenticated using (
    usuario_id = auth.uid() or public.tiene_permiso(tienda_id, 'preguntas.responder')
    or public.es_admin('moderacion'));
create policy "preguntas: cualquiera con cuenta pregunta" on public.preguntas
  for insert to authenticated with check (public.producto_visible(producto_id));
create policy "preguntas: el comercio responde" on public.preguntas
  for update to authenticated
  using (public.tiene_permiso(tienda_id, 'preguntas.responder') or public.es_admin('moderacion'))
  with check (public.tiene_permiso(tienda_id, 'preguntas.responder') or public.es_admin('moderacion'));

create policy "mensajes: las partes del pedido" on public.mensajes_pedido
  for select to authenticated using (public.puede_ver_pedido_tienda(pedido_tienda_id));
create policy "mensajes: comprador o comercio escriben" on public.mensajes_pedido
  for insert to authenticated with check (
       public.es_comprador(public.pedido_de_pedido_tienda(pedido_tienda_id))
    or public.tiene_permiso(public.tienda_de_pedido_tienda(pedido_tienda_id), 'pedidos.ver'));

create policy "reclamos: comprador, comercio y soporte ven" on public.reclamos
  for select to authenticated using (
       usuario_id = auth.uid()
    or public.tiene_permiso(public.tienda_de_pedido_tienda(pedido_tienda_id), 'pedidos.ver')
    or public.es_admin('soporte'));
create policy "reclamos: el comprador reclama" on public.reclamos
  for insert to authenticated
  with check (public.es_comprador(public.pedido_de_pedido_tienda(pedido_tienda_id)));
create policy "reclamos: soporte gestiona" on public.reclamos
  for update to authenticated using (public.es_admin('soporte')) with check (public.es_admin('soporte'));

create policy "denuncias: cualquiera con cuenta denuncia" on public.denuncias
  for insert to authenticated with check (true);
create policy "denuncias: autor y moderación ven" on public.denuncias
  for select to authenticated using (usuario_id = auth.uid() or public.es_admin('moderacion'));
create policy "denuncias: moderación gestiona" on public.denuncias
  for update to authenticated using (public.es_admin('moderacion')) with check (public.es_admin('moderacion'));

create policy "notificaciones: las propias" on public.notificaciones
  for select to authenticated using (usuario_id = auth.uid());
create policy "notificaciones: marcar como leída" on public.notificaciones
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Botón de Arrepentimiento y de Baja: se envían con enviar_solicitud_consumidor(),
-- que funciona sin iniciar sesión y devuelve el código de gestión.
create policy "solicitudes: soporte y el comercio involucrado ven" on public.solicitudes_consumidor
  for select to authenticated using (
       public.es_admin('soporte')
    or (pedido_tienda_id is not null
        and public.tiene_permiso(public.tienda_de_pedido_tienda(pedido_tienda_id), 'pedidos.ver')));
create policy "solicitudes: soporte gestiona" on public.solicitudes_consumidor
  for update to authenticated using (public.es_admin('soporte')) with check (public.es_admin('soporte'));

-- ----------------------------------------------------------------------------
-- MÓDULO 9 · Administración
-- ----------------------------------------------------------------------------
create policy "auditoria: superadmin ve todo, el dueño ve su tienda" on public.auditoria
  for select to authenticated using (
    public.es_admin('superadmin') or (tienda_id is not null and public.es_duenio(tienda_id)));

create policy "configuracion: lectura pública" on public.configuracion
  for select to anon, authenticated using (true);
create policy "configuracion: superadmin edita" on public.configuracion
  for all to authenticated using (public.es_admin('superadmin')) with check (public.es_admin('superadmin'));
