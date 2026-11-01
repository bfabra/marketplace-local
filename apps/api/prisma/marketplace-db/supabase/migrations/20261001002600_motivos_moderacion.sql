-- ============================================================================
-- Motivos de pausa para la moderación de productos:
--   revision  → el vendedor lo publicó y espera que moderación lo apruebe
--   rechazado → moderación lo rechazó; el vendedor lo corrige y lo vuelve a enviar
-- Van solos en esta migración: PostgreSQL no deja usar un valor nuevo de un
-- enum en la misma transacción que lo crea (se usan en ..._2700).
-- ============================================================================

alter type public.motivo_pausa add value if not exists 'revision';
alter type public.motivo_pausa add value if not exists 'rechazado';
