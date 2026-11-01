-- ============================================================================
-- Imágenes en Supabase Storage.
-- Bucket "productos", carpeta por tienda: tiendas/<tienda_id>/...
-- Cualquiera puede verlas; solo sube o borra quien tiene productos.editar.
-- (En las pruebas locales no existe Storage, por eso el bloque se salta.)
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Storage no disponible (entorno de prueba): se omite';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('productos', 'productos', true)
  on conflict (id) do nothing;

  execute $p$
    create policy "imagenes: la tienda sube" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'productos'
                  and (storage.foldername(name))[1] = 'tiendas'
                  and public.tiene_permiso(((storage.foldername(name))[2])::uuid, 'productos.editar'))
  $p$;
  execute $p$
    create policy "imagenes: la tienda reemplaza" on storage.objects
      for update to authenticated
      using (bucket_id = 'productos'
             and (storage.foldername(name))[1] = 'tiendas'
             and public.tiene_permiso(((storage.foldername(name))[2])::uuid, 'productos.editar'))
  $p$;
  execute $p$
    create policy "imagenes: la tienda borra" on storage.objects
      for delete to authenticated
      using (bucket_id = 'productos'
             and (storage.foldername(name))[1] = 'tiendas'
             and public.tiene_permiso(((storage.foldername(name))[2])::uuid, 'productos.editar'))
  $p$;
end $$;
