-- ============================================================================
-- Datos de ejemplo SOLO para desarrollo (Supabase lo carga con "supabase db reset").
-- Las categorías y sus atributos no van acá: la lista estándar la cargan las
-- migraciones ..._4200 y ..._4300.
-- ============================================================================

-- Tarifas de envío de ejemplo (las reales las fija el dueño de la plataforma).
insert into public.tarifas_envio (localidad_id, costo)
select id, case slug when 'capital' then 2500 when 'rawson' then 3000 else 3500 end
from public.localidades where slug in ('capital', 'rawson', 'chimbas', 'rivadavia', 'santa-lucia');
