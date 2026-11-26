-- ============================================================================
-- El dueño puede archivar (eliminar del panel) una sucursal si le queda
-- al menos otra no archivada. No puede auto-reactivar ni cambiar a otros estados.
-- ============================================================================

create or replace function public.tg_tiendas_control()
returns trigger language plpgsql as $$
begin
  -- Alta desde la app: siempre pendiente.
  if tg_op = 'INSERT' and public.es_usuario_final() then
    new.propietario_id := coalesce(new.propietario_id, auth.uid());
    new.estado := 'pendiente';
    new.motivo_estado := null;
  elsif public.es_usuario_final() and not public.es_admin() then
    if new.propietario_id is distinct from old.propietario_id then
      raise exception 'El dueño de una tienda no se puede cambiar desde la aplicación';
    end if;
    if new.estado is distinct from old.estado then
      -- Dueño: solo archivar (no reactivar ni suspender).
      if not (
        new.estado = 'archivada'
        and old.estado is distinct from 'archivada'
        and new.propietario_id = auth.uid()
      ) then
        raise exception 'Solo la administración puede cambiar el estado de una tienda';
      end if;
    end if;
  end if;

  -- MP obligatorio salvo cuando aprueba moderación / superadmin.
  if new.estado = 'activa'
     and (tg_op = 'INSERT' or old.estado is distinct from 'activa')
     and not public.tiene_cuenta_mp(new.id)
     and not public.es_admin('moderacion') then
    raise exception 'La tienda debe vincular su cuenta de Mercado Pago antes de activarse';
  end if;
  return new;
end $$;

comment on function public.tg_tiendas_control() is
  'Pendiente al crear; dueño puede archivar; admin cambia estado; MP salvo aprobación de moderación.';

-- Permite que el dueño deje motivo al archivar (sin tocar revision_productos).
create or replace function public.tg_tiendas_moderacion()
returns trigger language plpgsql as $$
begin
  if public.es_usuario_final() and not public.es_admin('moderacion') then
    if tg_op = 'INSERT' then
      new.motivo_estado := null;
      new.revision_productos := 'automatica';
    else
      if not (
        new.estado = 'archivada'
        and old.estado is distinct from 'archivada'
        and new.propietario_id = auth.uid()
      ) then
        new.motivo_estado := old.motivo_estado;
      end if;
      new.revision_productos := old.revision_productos;
    end if;
  end if;
  return new;
end $$;

-- Archiva la tienda del dueño. Requiere otra sucursal vigente (como la maqueta).
create or replace function pkg_tiendas.archivar(p_tienda uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_propietario uuid;
  v_estado public.estado_tienda;
  v_otras int;
begin
  select propietario_id, estado into v_propietario, v_estado
  from public.tiendas where id = p_tienda for update;
  if not found then
    raise exception 'No encontramos esa tienda' using errcode = 'TC404';
  end if;
  if v_propietario is distinct from auth.uid() then
    raise exception 'Solo el dueño puede eliminar esta sucursal' using errcode = 'TC403';
  end if;
  if v_estado = 'archivada' then
    raise exception 'Esta sucursal ya está eliminada' using errcode = 'TC409';
  end if;

  select count(*)::int into v_otras
  from public.tiendas
  where propietario_id = auth.uid()
    and id <> p_tienda
    and estado <> 'archivada';
  if v_otras < 1 then
    raise exception 'No podés eliminar tu única sucursal' using errcode = 'TC400';
  end if;

  update public.tiendas
  set estado = 'archivada',
      motivo_estado = 'Eliminada por el dueño desde el panel'
  where id = p_tienda;
end $$;

comment on function pkg_tiendas.archivar(uuid) is
  'Dueño archiva una sucursal si le queda al menos otra vigente.';

grant execute on function pkg_tiendas.archivar(uuid) to authenticated;
