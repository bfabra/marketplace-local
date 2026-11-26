-- ============================================================================
-- Moderación / superadmin puede aprobar (activar) una tienda aunque el dueño
-- todavía no vinculó Mercado Pago. El dueño no puede auto-activarse sin MP.
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
      raise exception 'Solo la administración puede cambiar el estado de una tienda';
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
  'Pendiente al crear; solo admin cambia estado; MP obligatorio salvo aprobación de moderación.';
