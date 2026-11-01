-- Crea el usuario y la base de datos para desarrollo local.
--
-- Ejecutar desde apps/api con el superusuario de PostgreSQL:
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -v ON_ERROR_STOP=1 -f prisma/setup/create-database.sql
--
-- marketplace_dev no es superusuario: es dueño de la base y puede usar los
-- roles de Supabase (ver roles-supabase.sql).
--
-- Después, desde apps/api: npm run db:local

\prompt 'Contraseña para el nuevo usuario marketplace_dev: ' app_password

CREATE ROLE marketplace_dev WITH LOGIN PASSWORD :'app_password';

CREATE DATABASE marketplace_db
    OWNER marketplace_dev
    ENCODING 'UTF8'
    TEMPLATE template0;

\ir roles-supabase.sql

\echo 'Listo: base marketplace_db creada con el usuario marketplace_dev.'
