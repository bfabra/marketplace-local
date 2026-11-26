-- ============================================================================
-- Alta de tienda: siempre nace "pendiente" hasta que moderación/superadmin
-- la aprueba. Antes, si quien creaba era admin de plataforma, el trigger no
-- forzaba el estado (quedaba el default, pero podía confundirse el flujo).
-- ============================================================================

create or replace function public.tg_tiendas_control()
returns trigger language plpgsql as $$
begin
  -- Cualquier alta desde la app (rol authenticated/anon) queda pendiente.
  -- Solo pkg_admin.cambiar_estado_tienda (u otra vía con rol de servicio)
  -- puede pasar a activa / suspendida / etc.
  if tg_op = 'INSERT' and public.es_usuario_final() then
    new.propietario_id := coalesce(new.propietario_id, auth.uid());
    new.estado := 'pendiente';
    new.motivo_estado := null;
  elsif public.es_usuario_final() and not public.es_admin() then
    if new.propietario_id is distinct from old.propietario_id then
      raise exception 'El dueño de una tienda no se puede cambiar desde la aplicación';
    end if;
    if new.estado is distinct from old.estado then
      raise exception 'Solo la administración puede cambiar el estado de una tienda';
    end if;
  end if;

  if new.estado = 'activa' and (tg_op = 'INSERT' or old.estado is distinct from 'activa')
     and not public.tiene_cuenta_mp(new.id) then
    raise exception 'La tienda debe vincular su cuenta de Mercado Pago antes de activarse';
  end if;
  return new;
end $$;

comment on function public.tg_tiendas_control() is
  'Dueño y estado pendiente al crear; solo admin cambia estado; MP obligatorio para activar.';
