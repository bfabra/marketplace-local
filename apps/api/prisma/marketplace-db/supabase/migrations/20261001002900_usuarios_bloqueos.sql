-- ============================================================================
-- Panel de administración, etapa 4: usuarios. Convenciones en ..._1800.
--
-- Soporte (y el superadmin) busca cuentas, ve su ficha (roles, tiendas,
-- equipos y compras) y bloquea o desbloquea.
--
-- Cuenta bloqueada:
--   * no puede iniciar sesión y las sesiones abiertas se cortan (lo controla la API);
--   * sus tiendas pendientes o activas quedan suspendidas, con un motivo que
--     ve en su panel. Al desbloquear vuelven al estado que tenían, salvo las que
--     moderación haya cambiado mientras tanto.
-- Nadie se bloquea a sí mismo ni al superadmin. A alguien del equipo de la
-- plataforma solo lo bloquea el superadmin.
-- ============================================================================

alter table public.perfiles add column ultimo_ingreso timestamptz;

-- Un registro por bloqueo: el vigente es el que no tiene desbloqueado_en.
create table public.bloqueos_cuenta (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references public.perfiles (id) on delete cascade,
  motivo            text not null check (char_length(motivo) between 5 and 500),
  -- Tiendas suspendidas por el bloqueo y el estado que tenían: [{id, estado}].
  tiendas           jsonb not null default '[]'::jsonb,
  bloqueado_por     uuid references public.perfiles (id) on delete set null,
  bloqueado_en      timestamptz not null default now(),
  desbloqueado_por  uuid references public.perfiles (id) on delete set null,
  desbloqueado_en   timestamptz,
  nota_desbloqueo   text check (char_length(nota_desbloqueo) <= 500)
);
comment on table public.bloqueos_cuenta is 'Bloqueos de cuentas por soporte, con su historial';

create unique index bloqueos_cuenta_vigente on public.bloqueos_cuenta (usuario_id) where desbloqueado_en is null;
create index bloqueos_cuenta_usuario_idx on public.bloqueos_cuenta (usuario_id, bloqueado_en desc);
create index bloqueos_cuenta_bloqueado_por_idx on public.bloqueos_cuenta (bloqueado_por);
create index bloqueos_cuenta_desbloqueado_por_idx on public.bloqueos_cuenta (desbloqueado_por);

alter table public.bloqueos_cuenta enable row level security;
create policy "bloqueos_cuenta: soporte ve" on public.bloqueos_cuenta
  for select to authenticated using (public.es_admin('soporte'));
create policy "bloqueos_cuenta: soporte bloquea" on public.bloqueos_cuenta
  for insert to authenticated with check (public.es_admin('soporte'));
create policy "bloqueos_cuenta: soporte desbloquea" on public.bloqueos_cuenta
  for update to authenticated using (public.es_admin('soporte')) with check (public.es_admin('soporte'));

create trigger auditar after insert or update or delete on public.bloqueos_cuenta
  for each row execute function public.tg_auditar();

-- Índices para los filtros del listado.
create index if not exists pedidos_comprador_estado_pago_idx on public.pedidos (comprador_id, estado_pago);

-- ----------------------------------------------------------------------------
-- Ingreso (servidor)
-- ----------------------------------------------------------------------------

-- Motivo del bloqueo vigente, o null si la cuenta puede entrar. Usa el índice único parcial.
create or replace function pkg_auth.bloqueo(p_usuario uuid)
returns text language sql stable set search_path = '' as $$
  select b.motivo from public.bloqueos_cuenta b
  where b.usuario_id = p_usuario and b.desbloqueado_en is null
$$;

-- Al iniciar sesión: si está bloqueada devuelve el motivo; si no, anota el ingreso.
create or replace function pkg_auth.ingreso(p_usuario uuid)
returns text language plpgsql set search_path = '' as $$
declare v_motivo text := pkg_auth.bloqueo(p_usuario);
begin
  if v_motivo is null then
    update public.perfiles set ultimo_ingreso = now() where id = p_usuario;
  end if;
  return v_motivo;
end $$;

-- El dueño no puede tocarse el último ingreso ni otras columnas que no son suyas.
create or replace function public.tg_perfiles_control()
returns trigger language plpgsql as $$
begin
  if public.es_usuario_final() then
    new.ultimo_ingreso := old.ultimo_ingreso;
  end if;
  return new;
end $$;

create trigger perfiles_control
  before update on public.perfiles
  for each row execute function public.tg_perfiles_control();

-- ----------------------------------------------------------------------------
-- Listado y ficha (servidor: los correos viven en auth.users)
-- ----------------------------------------------------------------------------

-- Filtros: todos, vendedores (dueños de tiendas), compradores (con al menos una
-- compra pagada), equipo (con rol de plataforma) y bloqueados. Busca por nombre,
-- correo o teléfono.
create or replace function pkg_admin.usuarios(
  p_filtro text default 'todos', p_buscar text default null, p_pagina integer default 1
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_por_pagina constant integer := 20;
  v_filtro text := coalesce(p_filtro, 'todos');
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_buscar text := nullif(trim(p_buscar), '');
  v_patron text := '%' || public.f_unaccent(lower(nullif(trim(p_buscar), ''))) || '%';
  v_items  jsonb;
  v_total  integer;
begin
  if v_filtro not in ('todos', 'vendedores', 'compradores', 'equipo', 'bloqueados') then
    raise exception 'Filtro inválido' using errcode = 'TC400';
  end if;

  with filtrados as (
    select p.id, p.creado_en
    from public.perfiles p
    left join auth.users u on u.id = p.id
    where (v_buscar is null
           or public.f_unaccent(lower(concat_ws(' ', p.nombre, p.apellido))) like v_patron
           or lower(u.email) like v_patron
           or p.telefono like '%' || v_buscar || '%')
      and case v_filtro
            when 'vendedores' then exists (select 1 from public.tiendas t where t.propietario_id = p.id)
            when 'compradores' then exists (
              select 1 from public.pedidos pe
              where pe.comprador_id = p.id and pe.estado_pago in ('aprobado', 'reembolsado_parcial', 'reembolsado'))
            when 'equipo' then exists (select 1 from public.roles_plataforma r where r.usuario_id = p.id)
            when 'bloqueados' then exists (
              select 1 from public.bloqueos_cuenta b where b.usuario_id = p.id and b.desbloqueado_en is null)
            else true
          end
  ), pagina as (
    select id, creado_en from filtrados order by creado_en desc
    limit v_por_pagina offset (v_pagina - 1) * v_por_pagina
  )
  select (select count(*) from filtrados),
         coalesce(jsonb_agg(x.item order by x.creado_en desc), '[]'::jsonb)
  into v_total, v_items
  from (
    select p.creado_en, jsonb_build_object(
             'id', p.id,
             'nombre', nullif(concat_ws(' ', p.nombre, p.apellido), ''),
             'email', u.email,
             'telefono', p.telefono,
             'creado_en', p.creado_en,
             'ultimo_ingreso', p.ultimo_ingreso,
             'roles', coalesce((select jsonb_agg(r.rol order by r.rol)
                                from public.roles_plataforma r where r.usuario_id = p.id), '[]'::jsonb),
             'tiendas', (select count(*) from public.tiendas t
                         where t.propietario_id = p.id and t.estado <> 'archivada'),
             'compras', (select count(*) from public.pedidos pe
                         where pe.comprador_id = p.id
                           and pe.estado_pago in ('aprobado', 'reembolsado_parcial', 'reembolsado')),
             'bloqueo', (select jsonb_build_object('motivo', b.motivo, 'desde', b.bloqueado_en)
                         from public.bloqueos_cuenta b
                         where b.usuario_id = p.id and b.desbloqueado_en is null)
           ) as item
    from pagina f
    join public.perfiles p on p.id = f.id
    left join auth.users u on u.id = p.id
  ) x;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'pagina', v_pagina,
    'porPagina', v_por_pagina,
    'conteos', jsonb_build_object(
      'todos',       (select count(*) from public.perfiles),
      'vendedores',  (select count(distinct t.propietario_id) from public.tiendas t),
      'compradores', (select count(distinct pe.comprador_id) from public.pedidos pe
                      where pe.estado_pago in ('aprobado', 'reembolsado_parcial', 'reembolsado')),
      'equipo',      (select count(distinct r.usuario_id) from public.roles_plataforma r),
      'bloqueados',  (select count(*) from public.bloqueos_cuenta b where b.desbloqueado_en is null))
  );
end $$;

-- Ficha de una cuenta: datos, roles, tiendas propias, equipos donde trabaja,
-- compras y el historial de bloqueos.
create or replace function pkg_admin.usuario(p_usuario uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'apellido', p.apellido,
    'email', u.email,
    'telefono', p.telefono,
    'creado_en', p.creado_en,
    'ultimo_ingreso', p.ultimo_ingreso,
    'roles', coalesce((select jsonb_agg(r.rol order by r.rol)
                       from public.roles_plataforma r where r.usuario_id = p.id), '[]'::jsonb),
    'bloqueo', (
      select jsonb_build_object(
               'motivo', b.motivo,
               'desde', b.bloqueado_en,
               'por', nullif(concat_ws(' ', bp.nombre, bp.apellido), ''),
               'tiendas', jsonb_array_length(b.tiendas))
      from public.bloqueos_cuenta b
      left join public.perfiles bp on bp.id = b.bloqueado_por
      where b.usuario_id = p.id and b.desbloqueado_en is null),
    'historialBloqueos', coalesce((
      select jsonb_agg(h.item order by h.bloqueado_en desc)
      from (
        select b.bloqueado_en, jsonb_build_object(
                 'motivo', b.motivo,
                 'bloqueado_en', b.bloqueado_en,
                 'bloqueadoPor', nullif(concat_ws(' ', bp.nombre, bp.apellido), ''),
                 'desbloqueado_en', b.desbloqueado_en,
                 'desbloqueadoPor', nullif(concat_ws(' ', dp.nombre, dp.apellido), ''),
                 'nota', b.nota_desbloqueo) as item
        from public.bloqueos_cuenta b
        left join public.perfiles bp on bp.id = b.bloqueado_por
        left join public.perfiles dp on dp.id = b.desbloqueado_por
        where b.usuario_id = p.id
        order by b.bloqueado_en desc
        limit 20
      ) h
    ), '[]'::jsonb),
    'tiendas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id,
               'nombre', t.nombre,
               'estado', t.estado,
               'motivo_estado', t.motivo_estado,
               'creado_en', t.creado_en,
               'plan', (select pl.nombre from public.suscripciones s
                        join public.planes pl on pl.id = s.plan_id
                        where s.tienda_id = t.id and s.estado in ('activa', 'en_gracia', 'pendiente')
                        limit 1)) order by t.creado_en)
      from public.tiendas t where t.propietario_id = p.id
    ), '[]'::jsonb),
    'equipos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tienda', jsonb_build_object('id', t.id, 'nombre', t.nombre),
               'rol', r.nombre,
               'estado', m.estado) order by m.creado_en)
      from public.miembros_tienda m
      join public.tiendas t on t.id = m.tienda_id
      join public.roles_tienda r on r.id = m.rol_id
      where m.usuario_id = p.id and m.estado <> 'retirado'
    ), '[]'::jsonb),
    'compras', (
      select jsonb_build_object(
               'pagadas', count(*) filter (where pe.estado_pago in ('aprobado', 'reembolsado_parcial', 'reembolsado')),
               'monto', coalesce(sum(pe.total) filter (where pe.estado_pago in ('aprobado', 'reembolsado_parcial')), 0),
               'ultima', max(pe.creado_en))
      from public.pedidos pe where pe.comprador_id = p.id),
    'ultimasCompras', coalesce((
      select jsonb_agg(c.item order by c.creado_en desc)
      from (
        select pe.creado_en, jsonb_build_object(
                 'id', pe.id,
                 'numero', pe.numero,
                 'creado_en', pe.creado_en,
                 'total', pe.total,
                 'estado_pago', pe.estado_pago,
                 'tiendas', (select jsonb_agg(t.nombre order by t.nombre)
                             from public.pedidos_tienda pt
                             join public.tiendas t on t.id = pt.tienda_id
                             where pt.pedido_id = pe.id)) as item
        from public.pedidos pe
        where pe.comprador_id = p.id
        order by pe.creado_en desc
        limit 10
      ) c
    ), '[]'::jsonb),
    'direcciones', (select count(*) from public.direcciones d where d.usuario_id = p.id),
    'reclamosAbiertos', (select count(*) from public.reclamos rc
                         where rc.usuario_id = p.id and rc.estado in ('abierto', 'en_revision'))
  )
  from public.perfiles p
  left join auth.users u on u.id = p.id
  where p.id = p_usuario
$$;

-- ----------------------------------------------------------------------------
-- Bloqueo y desbloqueo (corren como soporte; RLS y la auditoría registran quién fue)
-- ----------------------------------------------------------------------------

-- Valida quién puede bloquear o desbloquear a quién. security definer: soporte
-- no lee los roles de plataforma de los demás.
create or replace function pkg_admin._exigir_soporte_sobre(p_usuario uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin('soporte') then
    raise exception 'Solo soporte bloquea y desbloquea cuentas' using errcode = 'TC403';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No podés bloquear ni desbloquear tu propia cuenta' using errcode = 'TC409';
  end if;
  if not exists (select 1 from public.perfiles where id = p_usuario) then
    raise exception 'No encontramos esa cuenta' using errcode = 'TC404';
  end if;
  if exists (select 1 from public.roles_plataforma r where r.usuario_id = p_usuario and r.rol = 'superadmin') then
    raise exception 'La cuenta del superadmin no se puede bloquear' using errcode = 'TC403';
  end if;
  if exists (select 1 from public.roles_plataforma r where r.usuario_id = p_usuario)
     and not public.es_admin('superadmin') then
    raise exception 'A alguien del equipo de la plataforma solo lo bloquea el superadmin' using errcode = 'TC403';
  end if;
end $$;

-- security definer: el trigger de tiendas solo deja a moderación escribir el
-- motivo. Devuelve las tiendas suspendidas con el estado que tenían.
create or replace function pkg_admin._suspender_tiendas_de(p_usuario uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tiendas jsonb;
begin
  if not public.es_admin('soporte') then
    raise exception 'Solo soporte bloquea cuentas' using errcode = 'TC403';
  end if;
  with previas as (
    select t.id, t.estado from public.tiendas t
    where t.propietario_id = p_usuario and t.estado in ('pendiente', 'activa')
    for update
  ), cambiadas as (
    update public.tiendas t
    set estado = 'suspendida', motivo_estado = p_motivo
    from previas
    where t.id = previas.id
    returning t.id, previas.estado
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'estado', estado)), '[]'::jsonb)
  into v_tiendas from cambiadas;
  return v_tiendas;
end $$;

-- Devuelve cada tienda a su estado anterior si sigue suspendida por el bloqueo.
create or replace function pkg_admin._restaurar_tiendas(p_tiendas jsonb, p_motivo text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_restauradas integer;
begin
  if not public.es_admin('soporte') then
    raise exception 'Solo soporte desbloquea cuentas' using errcode = 'TC403';
  end if;
  update public.tiendas t
  set estado = (x ->> 'estado')::public.estado_tienda, motivo_estado = null
  from jsonb_array_elements(p_tiendas) x
  where t.id = (x ->> 'id')::uuid and t.estado = 'suspendida' and t.motivo_estado = p_motivo;
  get diagnostics v_restauradas = row_count;
  return v_restauradas;
end $$;

create or replace function pkg_admin._motivo_bloqueo_tienda()
returns text language sql immutable set search_path = '' as $$
  select 'La cuenta del dueño está bloqueada. Escribinos a soporte para resolverlo.'::text
$$;

create or replace function pkg_admin.bloquear_usuario(p_usuario uuid, p_motivo text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_motivo  text := nullif(trim(p_motivo), '');
  v_tiendas jsonb;
begin
  perform pkg_admin._exigir_soporte_sobre(p_usuario);
  if char_length(coalesce(v_motivo, '')) not between 5 and 500 then
    raise exception 'Contá el motivo del bloqueo (entre 5 y 500 caracteres)' using errcode = 'TC400';
  end if;
  if pkg_auth.bloqueo(p_usuario) is not null then
    raise exception 'Esa cuenta ya está bloqueada' using errcode = 'TC409';
  end if;

  v_tiendas := pkg_admin._suspender_tiendas_de(p_usuario, pkg_admin._motivo_bloqueo_tienda());
  insert into public.bloqueos_cuenta (usuario_id, motivo, tiendas, bloqueado_por)
  values (p_usuario, v_motivo, v_tiendas, auth.uid());

  return jsonb_build_object('bloqueado', true, 'tiendasSuspendidas', jsonb_array_length(v_tiendas));
end $$;

create or replace function pkg_admin.desbloquear_usuario(p_usuario uuid, p_nota text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_nota    text := nullif(trim(p_nota), '');
  v_bloqueo public.bloqueos_cuenta;
  v_restauradas integer;
begin
  perform pkg_admin._exigir_soporte_sobre(p_usuario);
  if char_length(coalesce(v_nota, '')) > 500 then
    raise exception 'La nota puede tener hasta 500 caracteres' using errcode = 'TC400';
  end if;

  update public.bloqueos_cuenta
  set desbloqueado_en = now(), desbloqueado_por = auth.uid(), nota_desbloqueo = v_nota
  where usuario_id = p_usuario and desbloqueado_en is null
  returning * into v_bloqueo;
  if not found then
    raise exception 'Esa cuenta no está bloqueada' using errcode = 'TC409';
  end if;

  v_restauradas := pkg_admin._restaurar_tiendas(v_bloqueo.tiendas, pkg_admin._motivo_bloqueo_tienda());
  return jsonb_build_object('bloqueado', false, 'tiendasRestauradas', v_restauradas,
                            'tiendasSuspendidas', jsonb_array_length(v_bloqueo.tiendas));
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function
  pkg_auth.bloqueo(uuid),
  pkg_auth.ingreso(uuid),
  pkg_admin.usuarios(text, text, integer),
  pkg_admin.usuario(uuid),
  pkg_admin._exigir_soporte_sobre(uuid),
  pkg_admin._suspender_tiendas_de(uuid, text),
  pkg_admin._restaurar_tiendas(jsonb, text),
  pkg_admin._motivo_bloqueo_tienda(),
  pkg_admin.bloquear_usuario(uuid, text),
  pkg_admin.desbloquear_usuario(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function
  pkg_auth.bloqueo(uuid),
  pkg_admin._exigir_soporte_sobre(uuid),
  pkg_admin._suspender_tiendas_de(uuid, text),
  pkg_admin._restaurar_tiendas(jsonb, text),
  pkg_admin._motivo_bloqueo_tienda(),
  pkg_admin.bloquear_usuario(uuid, text),
  pkg_admin.desbloquear_usuario(uuid, text)
to authenticated;
