-- ============================================================================
-- Nombres comerciales de los planes y precios de los pagos.
-- Gratis pasa a Starter; Plan 1 y Plan 2, que estaban en 0, pasan a Premium y
-- Gold con precio. Los precios nuevos rigen desde la próxima renovación de
-- cada suscripción; finanzas los puede ajustar después desde el panel.
-- ============================================================================

update public.planes set nombre = 'Starter' where nombre = 'Gratis' and es_gratis;
update public.planes set nombre = 'Premium', precio_mensual = 15000 where nombre = 'Plan 1';
update public.planes set nombre = 'Gold', precio_mensual = 35000 where nombre = 'Plan 2';
