-- ============================================================================
-- Alinea los planes comerciales con #merchant-panel → Suscripción y Planes
-- (docs/diseno/js/pages/merchant.js / store.js):
--   Plan Gratuito $0 · 1 tienda · 3 productos
--   Plan Estándar $10.000 / 31 días · 100 productos
--   Plan Pro Ilimitado $20.000 / 31 días · productos ilimitados
-- ============================================================================

update public.planes
set nombre = 'Plan Gratuito',
    precio_mensual = 0,
    max_productos = 3,
    max_empleados = 0
where es_gratis
   or nombre in ('Starter', 'Gratis');

update public.planes
set nombre = 'Plan Estándar',
    precio_mensual = 10000,
    max_productos = 100,
    max_empleados = coalesce(nullif(max_empleados, 0), 3)
where nombre in ('Premium', 'Plan 1')
   or (orden = 2 and not es_gratis);

update public.planes
set nombre = 'Plan Pro Ilimitado',
    precio_mensual = 20000,
    max_productos = null,
    max_empleados = null
where nombre in ('Gold', 'Plan 2')
   or (orden = 3 and not es_gratis);
