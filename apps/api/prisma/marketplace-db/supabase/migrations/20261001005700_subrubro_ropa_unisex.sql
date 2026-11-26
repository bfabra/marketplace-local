-- ============================================================================
-- Subrubro faltante de Indumentaria y moda (maqueta merchant.js: "Ropa unisex").
-- ============================================================================

do $$
declare
  v_padre uuid;
begin
  select id into v_padre
  from public.rubros
  where slug = 'indumentaria-y-moda' and padre_id is null;

  if v_padre is null then
    raise exception 'No está el rubro Indumentaria y moda';
  end if;

  -- Si ya existe (reinstalación / seed actualizado), no tocar el orden.
  if exists (
    select 1 from public.rubros
    where padre_id = v_padre and lower(nombre) = 'ropa unisex'
  ) then
    return;
  end if;

  -- Dejar hueco después de "Ropa de hombre" (orden 2).
  update public.rubros
  set orden = orden + 1
  where padre_id = v_padre and orden >= 3;

  insert into public.rubros (padre_id, nombre, slug, orden)
  values (v_padre, 'Ropa unisex', 'ropa-unisex', 3);
end $$;
