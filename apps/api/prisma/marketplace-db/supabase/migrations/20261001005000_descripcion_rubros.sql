-- ============================================================================
-- Descripción de los rubros principales. Convenciones en ..._1800.
--
--   * Una frase corta que acompaña al rubro en el listado público
--     («Deco, muebles y bazar»). Solo la llevan los rubros principales; si no
--     tiene, la web la arma con los primeros subrubros.
--   * Se cargan los textos de la maqueta del diseñador y el superadmin los
--     edita desde el panel (pkg_admin.describir_rubro).
--   * Juguetes y niños: «Juguetes» vuelve a ir antes que «Juegos de mesa».
-- ============================================================================

alter table public.rubros
  add column descripcion text check (descripcion is null or char_length(descripcion) between 2 and 120);
comment on column public.rubros.descripcion is 'Frase corta para el listado público. Solo rubros principales; sin valor, la web la arma con los subrubros.';

update public.rubros r set descripcion = d.texto
from (values
  ('alimentos-y-bebidas', 'Almacén, carnicería, panadería y más'),
  ('indumentaria-y-moda', 'Moda, calzado y accesorios'),
  ('hogar-y-decoracion', 'Deco, muebles y bazar'),
  ('electronica-y-tecnologia', 'Equipos, accesorios y servicio'),
  ('ferreteria-construccion-y-herramientas', 'Herramientas y materiales'),
  ('automotor', 'Repuestos, accesorios y movilidad'),
  ('salud-y-cuidado-personal', 'Perfumería, cosmética y óptica'),
  ('deportes-y-recreacion', 'Indumentaria y equipamiento deportivo'),
  ('mascotas', 'Alimentos y accesorios'),
  ('libreria-educacion-y-oficina', 'Útiles, papelería y libros'),
  ('juguetes-y-ninos', 'Juguetes y primera infancia'),
  ('regalos-y-artesanias', 'Regalería y productos regionales'),
  ('servicios', 'Profesionales, técnicos y reparaciones'),
  ('industria-y-comercio', 'Insumos y equipamiento comercial'),
  ('turismo-y-experiencias', 'Alojamientos y excursiones'),
  ('musica-fiestas-y-recreacion', 'Instrumentos, cotillón y eventos'),
  ('alquileres', 'Inmuebles, vehículos, herramientas y más')
) d(slug, texto)
where r.slug = d.slug and r.padre_id is null and r.descripcion is null;

-- Se intercambian los lugares de los dos, sin tocar a los demás hermanos.
with dos as (
  select s.id, s.slug, min(s.orden) over () as primero, max(s.orden) over () as segundo
  from public.rubros s
  join public.rubros p on p.id = s.padre_id
  where p.slug = 'juguetes-y-ninos' and p.padre_id is null
    and s.slug in ('juguetes', 'juegos-de-mesa')
)
update public.rubros r
set orden = case when dos.slug = 'juguetes' then dos.primero else greatest(dos.segundo, dos.primero + 1) end
from dos
where r.id = dos.id;

-- ----------------------------------------------------------------------------
-- pkg_catalogo.rubros: suma la descripción
-- ----------------------------------------------------------------------------
create or replace function pkg_catalogo.rubros()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'nombre', r.nombre, 'slug', r.slug, 'descripcion', r.descripcion,
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

-- ----------------------------------------------------------------------------
-- pkg_admin: la descripción en la lista y su edición
-- ----------------------------------------------------------------------------
create or replace function pkg_admin.rubros()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'rubros', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'padre_id', r.padre_id,
               'nombre', r.nombre,
               'slug', r.slug,
               'descripcion', r.descripcion,
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

-- Cambia la descripción de un rubro principal. Vacía (o null) la quita.
create or replace function pkg_admin.describir_rubro(p_rubro uuid, p_descripcion text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_texto text := nullif(regexp_replace(trim(coalesce(p_descripcion, '')), '\s+', ' ', 'g'), '');
  v       public.rubros;
begin
  perform pkg_admin._exigir_superadmin_rubros();
  select * into v from public.rubros where id = p_rubro for update;
  if not found then
    raise exception 'No encontramos ese rubro' using errcode = 'TC404';
  end if;
  if v.nivel <> 1 then
    raise exception 'Solo los rubros principales llevan descripción' using errcode = 'TC400';
  end if;
  if v_texto is not null and char_length(v_texto) not between 2 and 120 then
    raise exception 'La descripción tiene que tener entre 2 y 120 caracteres' using errcode = 'TC400';
  end if;
  update public.rubros set descripcion = v_texto where id = p_rubro;
  return jsonb_build_object('id', v.id, 'descripcion', v_texto);
end $$;

revoke execute on function pkg_admin.describir_rubro(uuid, text) from public, anon, authenticated, service_role;
grant execute on function pkg_admin.describir_rubro(uuid, text) to authenticated;
