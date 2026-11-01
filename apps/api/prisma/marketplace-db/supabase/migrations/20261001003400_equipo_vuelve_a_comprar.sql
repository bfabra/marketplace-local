-- ============================================================================
-- Se deshace 3300: las cuentas del equipo de la plataforma vuelven a poder
-- comprar, guardar favoritos y tener o integrar tiendas, como cualquier cuenta.
-- ============================================================================

drop trigger zz_equipo_no_compra on public.pedidos;
drop trigger zz_equipo_no_compra on public.carrito_items;
drop trigger zz_equipo_no_compra on public.favoritos;
drop trigger zz_equipo_no_vende on public.tiendas;
drop trigger equipo_no_vende on public.miembros_tienda;
drop trigger zz_rol_plataforma_control on public.roles_plataforma;
drop trigger rol_plataforma_limpiar on public.roles_plataforma;

drop function public.equipo_no_compra();
drop function public.equipo_no_vende();
drop function public.rol_plataforma_control();
drop function public.rol_plataforma_limpiar();
drop function public.es_equipo(uuid);
