-- ============================================================================
-- Funciones de seguridad que usan las políticas RLS.
-- Son "security definer" para poder consultar permisos sin chocar con las
-- propias reglas RLS (evita bucles y mantiene las políticas simples).
-- ============================================================================

-- ¿El usuario tiene un rol de plataforma? El superadmin cuenta como todos.
create or replace function public.es_admin(p_rol public.rol_plataforma default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.roles_plataforma r
    where r.usuario_id = auth.uid()
      and (r.rol = 'superadmin' or p_rol is null or r.rol = p_rol)
  )
$$;

-- ¿Es el dueño de la tienda?
create or replace function public.es_duenio(p_tienda uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tiendas t
    where t.id = p_tienda and t.propietario_id = auth.uid()
  )
$$;

-- ¿Es el dueño o un empleado activo de la tienda?
create or replace function public.es_miembro(p_tienda uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_duenio(p_tienda) or exists (
    select 1 from public.miembros_tienda m
    where m.tienda_id = p_tienda and m.usuario_id = auth.uid() and m.estado = 'activo'
  )
$$;

-- La función central: ¿puede este usuario hacer X en esta tienda?
-- El dueño puede todo. Un empleado, solo lo que incluye su rol.
create or replace function public.tiene_permiso(p_tienda uuid, p_permiso text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_duenio(p_tienda) or exists (
    select 1
    from public.miembros_tienda m
    join public.roles_permisos rp on rp.rol_id = m.rol_id
    where m.tienda_id = p_tienda
      and m.usuario_id = auth.uid()
      and m.estado = 'activo'
      and rp.permiso_codigo = p_permiso
  )
$$;

-- Id del repartidor de la plataforma que tiene sesión iniciada (o null).
create or replace function public.mi_repartidor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select r.id from public.repartidores r
  where r.usuario_id = auth.uid() and r.activo
$$;

-- ¿Quién hace el cambio? Los usuarios del navegador entran como
-- "authenticated" o "anon"; el servidor y las funciones internas no.
create or replace function public.es_usuario_final()
returns boolean language sql stable as $$
  select current_user in ('authenticated', 'anon')
$$;

-- ¿Es el comprador de este pedido?
create or replace function public.es_comprador(p_pedido uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pedidos p where p.id = p_pedido and p.comprador_id = auth.uid())
$$;

-- ¿La parte del pedido le corresponde al repartidor con sesión iniciada?
create or replace function public.es_repartidor_de_pedido(p_pedido uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.envios e
    where e.pedido_id = p_pedido and e.repartidor_id = public.mi_repartidor_id()
  )
$$;

-- ¿La tienda está visible al público?
create or replace function public.tienda_activa(p_tienda uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tiendas t where t.id = p_tienda and t.estado = 'activa')
$$;

-- ¿El producto se ve en el marketplace?
create or replace function public.producto_visible(p_producto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.productos p
    join public.tiendas t on t.id = p.tienda_id
    where p.id = p_producto and p.estado = 'publicado' and t.estado = 'activa'
  )
$$;

-- Tienda de un producto (para validar altas en tablas hijas).
create or replace function public.tienda_de_producto(p_producto uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select tienda_id from public.productos where id = p_producto
$$;

-- Tienda y pedido de una parte, para las políticas de tablas hijas.
create or replace function public.tienda_de_pedido_tienda(p_pt uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select tienda_id from public.pedidos_tienda where id = p_pt
$$;

create or replace function public.pedido_de_pedido_tienda(p_pt uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select pedido_id from public.pedidos_tienda where id = p_pt
$$;

-- ¿Puede ver esta parte del pedido? Comprador, comercio con permiso,
-- repartidor asignado o logística.
create or replace function public.puede_ver_pedido_tienda(p_pt uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pedidos_tienda pt
    where pt.id = p_pt
      and (   public.es_comprador(pt.pedido_id)
           or public.tiene_permiso(pt.tienda_id, 'pedidos.ver')
           or public.es_repartidor_de_pedido(pt.pedido_id)
           or public.es_admin('logistica')
           or public.es_admin('soporte'))
  )
$$;

-- Plan vigente de una tienda (suscripción activa o en período de gracia).
create or replace function public.plan_vigente(p_tienda uuid)
returns public.planes language sql stable security definer set search_path = '' as $$
  select pl.*
  from public.suscripciones s
  join public.planes pl on pl.id = s.plan_id
  where s.tienda_id = p_tienda and s.estado in ('activa', 'en_gracia')
  order by s.inicio desc
  limit 1
$$;

-- Stock disponible = stock − reservas vigentes de otros carritos que están pagando.
create or replace function public.stock_disponible(p_variante uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select v.stock - coalesce((
    select sum(r.cantidad)::integer from public.reservas_stock r
    where r.variante_id = v.id and r.expira_en > now()
  ), 0)
  from public.variantes v where v.id = p_variante
$$;
