-- ============================================================================
-- Tareas automáticas (se ejecuta UNA vez, a mano, en el SQL Editor de Supabase,
-- después de activar la extensión pg_cron en Database → Extensions).
-- ============================================================================

-- Cada 5 minutos: libera el stock reservado por compras que no se pagaron.
select cron.schedule('liberar-reservas', '*/5 * * * *',
  $$ select public.liberar_reservas_vencidas() $$);

-- Cada hora: cierra los pedidos que pasaron más de 24 h sin pago
-- (el plazo está en configuracion.horas_vencimiento_pedido).
select cron.schedule('cerrar-pedidos-sin-pago', '15 * * * *',
  $$ select public.cerrar_pedidos_sin_pago() $$);

-- Todos los días a las 3:05 (hora UTC): pasa suscripciones impagas a "en gracia"
-- y, terminada la gracia, a "vencida" (la tienda deja de verse).
select cron.schedule('vencimientos-suscripciones', '5 6 * * *',
  $$ select public.procesar_vencimientos_suscripciones() $$);

-- Para ver las tareas:   select * from cron.job;
-- Para borrar una:       select cron.unschedule('liberar-reservas');
