-- ============================================================================
-- Importación de productos desde la plantilla de Excel del panel de la tienda.
-- El API lee el archivo y arma cada producto igual que el formulario; acá se
-- guardan todos juntos con pkg_productos.guardar, así valen las mismas reglas
-- (ficha de la categoría, variantes, último nivel, permisos, plan y revisión).
--
-- Todo o nada: si un producto falla no se guarda ninguno y se devuelven los
-- errores de cada uno. Con p_probar se hace todo y se deshace al final: la
-- vista previa del panel ve exactamente lo que va a pasar al confirmar.
-- ============================================================================

-- p_productos: [{ codigo, slug, datos: <lo mismo que recibe pkg_productos.guardar> }]
-- Devuelve: { guardado, productos: [{ codigo, nombre, id, estado, motivo_pausa, aviso }],
--             errores: [{ codigo, nombre, mensaje }] }
-- aviso: por qué no se pudo publicar (por ejemplo, el límite del plan); queda en borrador.
create or replace function pkg_productos.importar(
  p_tienda uuid, p_productos jsonb, p_publicar boolean, p_probar boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_p         jsonb;
  v_id        uuid;
  v_fila      jsonb;
  v_estado    jsonb;
  v_productos jsonb := '[]'::jsonb;
  v_errores   jsonb := '[]'::jsonb;
  v_guardado  boolean := false;
begin
  if not public.tiene_permiso(p_tienda, 'productos.editar') then
    raise exception 'No tenés permiso para cargar productos en esta tienda' using errcode = 'TC403';
  end if;
  if p_publicar and not public.tiene_permiso(p_tienda, 'productos.publicar') then
    raise exception 'No tenés permiso para publicar: importalos como borrador' using errcode = 'TC403';
  end if;
  if jsonb_typeof(p_productos) is distinct from 'array' or jsonb_array_length(p_productos) = 0 then
    raise exception 'El archivo no tiene productos para importar' using errcode = 'TC400';
  end if;
  if jsonb_array_length(p_productos) > 500 then
    raise exception 'Se pueden importar hasta 500 productos por archivo' using errcode = 'TC400';
  end if;

  begin
    for v_p in select value from jsonb_array_elements(p_productos) loop
      v_fila := jsonb_build_object('codigo', v_p ->> 'codigo', 'nombre', v_p -> 'datos' ->> 'nombre');
      begin
        v_id := pkg_productos.guardar(p_tienda, null, v_p -> 'datos', v_p ->> 'slug');
      exception when others then
        v_errores := v_errores || (v_fila || jsonb_build_object('mensaje', sqlerrm));
        continue;
      end;

      v_fila := v_fila || jsonb_build_object('id', v_id, 'estado', 'borrador', 'motivo_pausa', null, 'aviso', null);
      if p_publicar then
        begin
          v_estado := pkg_productos.cambiar_estado(p_tienda, v_id, 'publicado');
          v_fila := v_fila || jsonb_build_object('estado', v_estado -> 'estado', 'motivo_pausa', v_estado -> 'motivo_pausa');
        exception when others then
          v_fila := v_fila || jsonb_build_object('aviso', sqlerrm);
        end;
      end if;
      v_productos := v_productos || v_fila;
    end loop;

    if p_probar or jsonb_array_length(v_errores) > 0 then
      raise exception 'deshacer' using errcode = 'TC499';
    end if;
    v_guardado := true;
  exception when sqlstate 'TC499' then
    -- Se deshace lo creado: los id de la prueba no existen.
    select coalesce(jsonb_agg(x - 'id'), '[]'::jsonb) into v_productos from jsonb_array_elements(v_productos) x;
  end;

  return jsonb_build_object('guardado', v_guardado, 'productos', v_productos, 'errores', v_errores);
end $$;

comment on function pkg_productos.importar(uuid, jsonb, boolean, boolean) is
  'Importa productos de la plantilla del panel (todo o nada). Con p_probar valida y deshace.';

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
revoke execute on function pkg_productos.importar(uuid, jsonb, boolean, boolean)
  from public, anon, authenticated, service_role;
grant execute on function pkg_productos.importar(uuid, jsonb, boolean, boolean) to authenticated;
