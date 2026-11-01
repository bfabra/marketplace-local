-- ============================================================================
-- Seguir tiendas (tabla + pkg_seguidos). Con sesión, el cliente sigue las
-- tiendas que le gustan y recibe sugerencias con sus novedades. La página
-- pública de la tienda muestra cuántas personas la siguen.
-- Convenciones en ..._1800.
-- ============================================================================

create table public.seguidores_tienda (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  tienda_id  uuid not null references public.tiendas(id) on delete cascade,
  creado_en  timestamptz not null default now(),
  primary key (usuario_id, tienda_id)
);
create index seguidores_tienda_tienda_id_idx on public.seguidores_tienda (tienda_id);
create index seguidores_tienda_usuario_creado_idx on public.seguidores_tienda (usuario_id, creado_en desc);

alter table public.seguidores_tienda enable row level security;
revoke all on public.seguidores_tienda from anon;
create policy "seguidores_tienda: los propios" on public.seguidores_tienda
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- ----------------------------------------------------------------------------
-- pkg_catalogo: cuántos siguen a una tienda
-- ----------------------------------------------------------------------------

-- security definer: cada persona solo ve lo que sigue ella; acá se cuenta a todos.
create or replace function pkg_catalogo._seguidores(p_tienda uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.seguidores_tienda where tienda_id = p_tienda
$$;

-- Página pública de la tienda: suma la cantidad de seguidores.
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
-- pkg_seguidos
-- ----------------------------------------------------------------------------
create schema if not exists pkg_seguidos;
comment on schema pkg_seguidos is 'Tiendas que sigue cada cliente y sugerencias con sus novedades. Solo lo llama el API.';

create or replace function pkg_seguidos._exigir_sesion()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para seguir tiendas' using errcode = 'TC403';
  end if;
end $$;

create or replace function pkg_seguidos._ids()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(s.tienda_id order by s.creado_en desc), '[]'::jsonb)
  from public.seguidores_tienda s
  where s.usuario_id = auth.uid()
$$;

create or replace function pkg_seguidos._estado(p_tienda uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('ids', pkg_seguidos._ids(), 'seguidores', pkg_catalogo._seguidores(p_tienda))
$$;

create or replace function pkg_seguidos.ids()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  perform pkg_seguidos._exigir_sesion();
  return pkg_seguidos._ids();
end $$;

create or replace function pkg_seguidos.seguir(p_tienda uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_seguidos._exigir_sesion();
  if not exists (select 1 from public.tiendas where id = p_tienda and estado = 'activa') then
    raise exception 'Esta tienda no está disponible' using errcode = 'TC404';
  end if;
  if exists (select 1 from public.tiendas where id = p_tienda and propietario_id = auth.uid()) then
    raise exception 'Es tu tienda: no hace falta que la sigas' using errcode = 'TC400';
  end if;
  if (select count(*) from public.seguidores_tienda where usuario_id = auth.uid()) >= 500 then
    raise exception 'Llegaste al máximo de 500 tiendas seguidas' using errcode = 'TC409';
  end if;

  insert into public.seguidores_tienda (usuario_id, tienda_id)
  values (auth.uid(), p_tienda)
  on conflict do nothing;
  return pkg_seguidos._estado(p_tienda);
end $$;

create or replace function pkg_seguidos.dejar(p_tienda uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform pkg_seguidos._exigir_sesion();
  delete from public.seguidores_tienda where usuario_id = auth.uid() and tienda_id = p_tienda;
  return pkg_seguidos._estado(p_tienda);
end $$;

-- Tiendas seguidas (las activas) y hasta 12 productos sugeridos: lo más nuevo de
-- cada tienda, alternando entre ellas; lo que ya está en favoritos va al final.
create or replace function pkg_seguidos.sugerencias()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  perform pkg_seguidos._exigir_sesion();
  return jsonb_build_object(
    'tiendas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.id, 'nombre', t.nombre, 'slug', t.slug, 'localidad', l.nombre,
               'rubro', pkg_catalogo.rubro(t.id),
               'novedades', (select count(*)::integer from public.productos p
                             where p.tienda_id = t.id and p.estado = 'publicado'
                               and p.publicado_en > now() - interval '14 days')
             ) order by s.creado_en desc), '[]'::jsonb)
      from public.seguidores_tienda s
      join public.tiendas t on t.id = s.tienda_id and t.estado = 'activa'
      join public.localidades l on l.id = t.localidad_id
      where s.usuario_id = auth.uid()),
    'productos', pkg_catalogo.tarjetas(array(
      select x.id from (
        select p.id, p.publicado_en,
               exists (select 1 from public.favoritos f
                       where f.usuario_id = auth.uid() and f.producto_id = p.id) as favorito,
               row_number() over (partition by p.tienda_id order by p.publicado_en desc) as n
        from public.seguidores_tienda s
        join public.tiendas t on t.id = s.tienda_id and t.estado = 'activa'
        join public.productos p on p.tienda_id = t.id and p.estado = 'publicado'
        where s.usuario_id = auth.uid()
      ) x
      order by x.favorito, x.n, x.publicado_en desc
      limit 12))
  );
end $$;

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function pkg_catalogo._seguidores(uuid) from public, anon, authenticated, service_role;
grant execute on function pkg_catalogo._seguidores(uuid) to anon, authenticated;

revoke all on schema pkg_seguidos from public;
revoke execute on all functions in schema pkg_seguidos from public, anon, authenticated, service_role;
grant usage on schema pkg_seguidos to authenticated;
grant execute on all functions in schema pkg_seguidos to authenticated;
