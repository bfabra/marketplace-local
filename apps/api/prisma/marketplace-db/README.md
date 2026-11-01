# Base de datos del marketplace

Esta carpeta es el **modelo de datos convertido en código**: 45 tablas, sus reglas y su seguridad, listas para aplicar en Supabase. Todo se probó en una base PostgreSQL real con una simulación completa (88 pruebas, todas correctas).

---

## 1. Del documento al SQL: cómo se traduce

El documento del modelo describe cada tabla en lenguaje de negocio. El SQL dice lo mismo en el idioma de la base de datos. La traducción siempre sigue estas reglas:

| En el documento | En SQL | Ejemplo |
|---|---|---|
| Una entidad | `create table` | `create table public.tiendas (...)` |
| Un campo | una columna con su tipo | `nombre text not null` |
| "FK" (referencia a otra tabla) | `references` | `localidad_id uuid references public.localidades(id)` |
| Una lista de estados | un tipo `enum` | `create type estado_tienda as enum ('pendiente', 'activa', ...)` |
| "Único", "uno por..." | `unique` o índice único | una sola suscripción vigente por tienda |
| Una regla ("máximo 10 productos") | un disparador (*trigger*) | `tg_productos_control` |
| Quién puede ver o cambiar | una política RLS | "Beto no ve los borradores de Ana" |

**Ejemplo completo con la tabla `tiendas`.** En el documento:

> `tiendas` · propietario_id FK, nombre, slug, cuit, localidad_id FK, estado… · Un único dueño.

En SQL (archivo `20261001000200_tiendas_planes.sql`):

```sql
create type public.estado_tienda as enum
  ('pendiente', 'activa', 'suspendida', 'vencida', 'archivada');   -- la lista de estados

create table public.tiendas (
  id             uuid primary key default gen_random_uuid(),     -- identificador único
  propietario_id uuid not null references public.perfiles(id),   -- el dueño (FK)
  nombre         text not null,                                  -- obligatorio
  slug           text not null unique,                           -- para la URL /tienda/mi-tienda
  cuit           text not null,
  localidad_id   uuid not null references public.localidades(id),
  estado         public.estado_tienda not null default 'pendiente',
  ...
);
```

La regla "el dueño es quien crea la tienda y el estado solo lo cambia el admin" está en `tg_tiendas_control` (archivo `..._reglas_negocio.sql`). La regla "el público solo ve tiendas activas" está en la política `tiendas: las activas son públicas` (archivo `..._politicas_rls.sql`).

### Relaciones principales

```mermaid
erDiagram
  perfiles ||--o{ tiendas : "es dueño de"
  tiendas ||--o{ suscripciones : tiene
  planes ||--o{ suscripciones : define
  tiendas ||--o{ miembros_tienda : "emplea a"
  tiendas ||--o{ productos : vende
  categorias ||--o{ productos : clasifica
  productos ||--|{ variantes : "tiene (min. 1)"
  perfiles ||--o{ pedidos : compra
  pedidos ||--|{ pedidos_tienda : "se divide en"
  tiendas ||--o{ pedidos_tienda : prepara
  pedidos_tienda ||--|{ pedido_items : contiene
  pedidos ||--o| envios : "una entrega"
  envios ||--|{ recolecciones : "una por tienda"
  repartidores ||--o{ envios : reparte
```

---

## 2. Qué hay en la carpeta

| Archivo | Qué contiene |
|---|---|
| `supabase/migrations/..._0100` a `..._0900` | Las 45 tablas, módulo por módulo (mismo orden que el documento) |
| `..._1000_funciones_seguridad.sql` | `tiene_permiso()`, `es_duenio()`, `es_admin()`… las usan las reglas de seguridad |
| `..._1100_reglas_negocio.sql` | Límites de plan, estados de pedidos, logística, historial, auditoría |
| `..._1200_operaciones.sql` | Funciones que llama la app: crear pedido, confirmar pago, invitar empleados, buscar |
| `..._1300_politicas_rls.sql` | Quién ve y cambia qué, tabla por tabla |
| `..._1400_datos_iniciales.sql` | San Juan y sus departamentos, los 3 planes, permisos, roles y parámetros |
| `..._1500_storage_imagenes.sql` | Carpeta de imágenes por tienda en Supabase Storage |
| `..._1600_correcciones.sql` | Correcciones de la revisión: monto del pago, pagos tardíos, devolución del envío, rutas de categorías, vencimiento por suscripción cancelada, pedidos sin pago |
| `..._1700_indices_llaves_foraneas.sql` | Índices en las 30 llaves foráneas que no tenían, y 3 índices para los listados más usados |
| `..._1800` a `..._2500` | Los paquetes `pkg_*` que llama el API (ver 2.2) |
| `..._2600_motivos_moderacion.sql` | Motivos de pausa `revision` y `rechazado` (solos: un valor nuevo de enum no se puede usar en la misma migración) |
| `..._2700_moderacion_tiendas_productos.sql` | Revisión mixta de productos, motivo del estado de cada tienda y el paquete `pkg_admin` de la etapa 2 (ver 2.2) |
| `..._2800_catalogo_territorio.sql` | Categorías ocultas que ocultan sus productos, localidades disponibles solo si están activas, auditoría del catálogo y del territorio y el paquete `pkg_admin` de la etapa 3 (ver 2.2) |
| `..._2900_usuarios_bloqueos.sql` | Último ingreso de cada cuenta, tabla `bloqueos_cuenta` (un bloqueo vigente por usuario, con las tiendas que suspendió) y el paquete `pkg_admin` de usuarios (ver 2.2) |
| `..._3000_pedidos_reembolsos.sql` | Reembolsos con estado, quién los cargó y quién los procesó; el estado del pago del pedido pasa a reembolsado parcial o total; la cancelación de una parte devuelve solo lo que queda por devolver, y el paquete `pkg_admin` de pedidos (ver 2.2) |
| `..._3100_planes_suscripciones.sql` | Motivo de cancelación y nota del admin en suscripciones, pagos de suscripción cargados por finanzas y el paquete `pkg_admin` de planes y suscripciones (ver 2.2) |
| `..._3200_pedido_solo_retiro.sql` | Corrige `crear_pedido` cuando todas las tiendas se retiran en el local (fallaba al leer una dirección que no hacía falta) |
| `..._3300_equipo_no_compra_ni_vende.sql` | Las cuentas del equipo de la plataforma no compran, no guardan favoritos y no tienen ni integran tiendas (triggers en `pedidos`, `carrito_items`, `favoritos`, `tiendas` y `miembros_tienda`, error TC403). No se suma al equipo a quien tiene una tienda o trabaja en una (TC409); al sumarse, se vacían su carrito y sus favoritos |
| `..._3400_equipo_vuelve_a_comprar.sql` | Deshace 3300: el equipo de la plataforma vuelve a comprar, guardar favoritos y tener o integrar tiendas como cualquier cuenta |
| `..._3500_planes_starter_premium_gold.sql` | Los planes pasan a llamarse Starter (gratis), Premium ($ 15.000/mes) y Gold ($ 35.000/mes) |
| `..._3600_roles_tienda_los_define_la_plataforma.sql` | El dueño ya no crea, edita ni borra roles de su tienda: elige entre los predefinidos. Solo el superadmin los define (`pkg_admin.roles_tienda`, `guardar_rol_tienda`, `borrar_rol_tienda`) |
| `..._3700_seguir_tiendas.sql` | Tabla `seguidores_tienda` y paquete `pkg_seguidos`: el cliente sigue tiendas y recibe sugerencias con sus novedades; la página pública de la tienda muestra cuántos la siguen |
| `..._3800_seguidores_en_panel.sql` | `pkg_tiendas.seguidores`: el panel de la tienda muestra cuántos la siguen y cuántos se sumaron en los últimos 7 días (solo el dueño y sus empleados; nunca quiénes son) |
| `..._3900_actividad_filtros.sql` | Registro de actividad, etapa 2: `pkg_admin.actividad` filtra por período, tipo de acción, origen (personas o sistema) y búsqueda libre, y la primera página trae el resumen del filtro; `exportar_actividad` devuelve hasta 5.000 movimientos para el CSV. Índices por fecha y por autor |
| `..._4000_rubros.sql` | Rubros, el estándar para clasificar las tiendas: tabla `rubros` en tres niveles (rubro, subrubro y especialidad) con la lista estándar de 17 rubros, `tiendas.rubro_id` (obligatorio al crear o editar una tienda) y `subrubro_id` (opcional), tabla `tienda_especialidades` (hasta 20, del subrubro elegido) y rubro inicial de las tiendas existentes deducido de sus productos. `pkg_catalogo.rubro` devuelve el rubro declarado (antes se deducía de la categoría con más productos) |
| `..._4100_rubro_en_listado_tiendas.sql` | El listado público de tiendas (`pkg_catalogo.tiendas`) trae el rubro declarado |
| `..._4200_categorias_estandar.sql` | Lista estándar de categorías de productos (Alquileres con un tercer nivel obligatorio). El producto va siempre en el último nivel (trigger `producto_categoria_final`, TC400). `categorias.requiere_revision` (se hereda): todo lo que se publica ahí pasa por moderación, y también cada cambio de nombre, descripción o categoría de un producto ya publicado; arranca marcada en Productos veterinarios. Las categorías de ejemplo se reubican sin cambiar su id |
| `..._4300_atributos_estandar.sql` | Ficha estándar de cada categoría y subcategoría (todos los atributos opcionales; Marca y Condición donde tienen sentido). Variantes: Talle y Color en ropa, calzado e indumentaria deportiva (dejan de colgar de Indumentaria y calzado entera), Memoria y Color en celulares y Unidad de cobro en todos los alquileres. Suma la categoría Industria y empresas y Vinos en Alimentos y bebidas. `pkg_catalogo.atributos_categoria` devuelve la ficha en el orden de la lista |
| `..._4400_categorias_con_productos.sql` | `pkg_catalogo.categorias` suma `productos`: los publicados de tiendas activas en la categoría y todas sus subcategorías. Lo usan el menú «Categorías» de la cabecera y la página «Todas las categorías» |
| `..._4500_importar_productos.sql` | `pkg_productos.importar`: guarda los productos de la plantilla de Excel del panel con `pkg_productos.guardar` (mismas reglas que el formulario), todo o nada y con los errores de cada producto. Si se pide publicar, el que no entra en el plan queda en borrador con un aviso. Con `p_probar` hace todo y lo deshace: es la vista previa |
| `supabase/seed.sql` | Tarifas de envío **de ejemplo**, solo para desarrollo (las categorías y sus atributos vienen de las migraciones) |
| `supabase/tareas_programadas.sql` | Tareas automáticas (liberar stock, vencer suscripciones) |
| `pruebas/` | La simulación completa que verifica todo lo anterior |
| `local/cargar_local.mjs` | Aplica las migraciones en un PostgreSQL local (ver 2.1) |

Los números al principio de cada archivo son la fecha y el orden: Supabase los aplica de menor a mayor.

---

## 2.1 Desarrollo con PostgreSQL local (sin Supabase)

Mientras no se despliega, la base corre en el PostgreSQL de la computadora. `pruebas/supabase_simulado.sql` recrea lo que Supabase trae de fábrica (`auth.users`, `auth.uid()`, roles `anon`/`authenticated`/`service_role`), así que las migraciones son **exactamente las mismas** que después van a Supabase.

1. Crear el usuario y la base (una sola vez), desde `apps/api`, en PowerShell:

   ```powershell
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -v ON_ERROR_STOP=1 -f prisma/setup/create-database.sql
   ```

   Si el usuario y la base ya existían, alcanza con dar acceso a los roles de Supabase (también como `postgres`):

   ```powershell
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -v ON_ERROR_STOP=1 -f prisma/setup/roles-supabase.sql
   ```

2. Poner en `apps/api/.env` la conexión: `DATABASE_URL="postgresql://marketplace_dev:CONTRASEÑA@localhost:5432/marketplace_db"`.
3. Cargar la base, desde `apps/api`:

   ```powershell
   npm run db:local             # primera vez: migraciones + datos de ejemplo; después, solo migraciones nuevas
   npm run db:local:reiniciar   # borra todo y carga desde cero
   ```

El script se niega a correr si `DATABASE_URL` no apunta a `localhost`. Lo aplicado queda en `supabase_migrations.schema_migrations`, la misma tabla que usa Supabase CLI.

El API (Express + Prisma) **no crea tablas**: después de cada migración nueva se corre `npm run db:pull` en `apps/api`, que lee la base y regenera `prisma/schema/marketplace.prisma` y el cliente. Las llamadas en nombre de un usuario van con `withUser(userId, tx => ...)` (`src/config/db.ts`), que activa el rol `authenticated` y `auth.uid()` para que apliquen las mismas políticas RLS que en Supabase.

El diccionario de datos (`docs/MODELO_DATOS.md` y `docs/modelo_datos.csv` en la raíz del repo) se genera leyendo la base con `npm run db:docs`. Conviene regenerarlo después de cada migración.

La plataforma tiene un único superadmin, que después reparte los demás roles desde la web. Para asignarlo, registrate desde la web y corré en `apps/api`: `npm run db:superadmin -- tu@correo.com` (con `--reemplazar` si ya había otro).

Para tener datos de prueba, con el API levantado corré en `apps/api` `npm run db:demo`. Crea 3 comercios activos en Capital, Rawson y Chimbas, con 12 productos y fotos, cuentas del equipo de moderación (`demo_moderacion@prueba.com`), logística (`demo_logistica@prueba.com`), soporte (`demo_soporte@prueba.com`) y finanzas (`demo_finanzas@prueba.com`), y una de comprador (`demo_comprador@prueba.com`). Si los datos ya estaban cargados, `npm run db:demo` solo agrega las cuentas del equipo que falten. Los dueños son `demo_raices`, `demo_tejidos` y `demo_tecnosur`, todos `@prueba.com`. Todas las cuentas usan la contraseña `Demo1234`. `npm run db:demo:limpiar` borra todo eso (incluidos los pedidos de esas cuentas y las fotos) y deja la base como estaba. Es solo para desarrollo.

## 2.2 Paquetes del API (`pkg_*`)

**El API no lee ni escribe tablas directamente: solo llama a funciones de los paquetes.** Nada de `select`, `insert` o `prisma.tabla.findMany()` en el código del API; Prisma se usa únicamente como conexión.

| Paquete | Archivo | Qué resuelve |
|---|---|---|
| `pkg_auth` | `..._1800` | Registro, credenciales, cambio de contraseña, sesión y perfil |
| `pkg_ubicacion` | `..._1800` | Localidades para los formularios |
| `pkg_admin` | `..._1800` | Roles de plataforma, listado y estado de tiendas, superadmin |
| `pkg_sistema` | `..._1800` | Chequeo de salud |
| `pkg_tiendas` | `..._1900` | Alta con plan Starter (gratis), panel, datos y Mercado Pago de prueba |
| `pkg_catalogo` | `..._2000` | Categorías, atributos, tiendas y productos públicos |
| `pkg_productos` | `..._2100` | Productos, variantes y fotos del panel (alta y edición en una sola llamada) |
| `pkg_equipo` | `..._2200` | Equipo de la tienda: invitaciones dentro del límite del plan, miembros y roles (desde `..._3600` el dueño solo elige entre los predefinidos). La misma migración suma a `pkg_tiendas` los planes y el cambio de plan, y a `pkg_admin` la asignación de roles de plataforma |
| `pkg_carrito` | `..._2300` | Carrito del comprador, vista previa del carrito sin sesión y unión al iniciar sesión |
| `pkg_compras` | `..._2300` | Direcciones, checkout, creación del pedido, mis compras y pago simulado (solo servidor) |
| `pkg_ventas` | `..._2300` | Pedidos de la tienda y cambios de estado según permisos |
| `pkg_favoritos` | `..._2400` | Favoritos del comprador (tabla `favoritos`, máximo 500), vista previa sin sesión y unión al iniciar sesión. La misma migración suma a `pkg_catalogo` la portada (`inicio`), el autocompletado (`sugerencias`), la búsqueda paginada con filtros y orden (`buscar`) y las tarjetas de producto con su tienda |
| `pkg_admin` | `..._2500` | Panel de administración, etapa 1: tablero con las cifras que ve cada rol de plataforma (`tablero`), configuración general con rangos permitidos (`configuracion`, `guardar_configuracion`) y registro de actividad paginado sobre la auditoría (`actividad`) |
| `pkg_admin` | `..._2700` | Etapa 2: seguimiento de tiendas (`tiendas` paginado con búsqueda y cifras, `tienda` con dueño, equipo, plan, ventas e historial), estado con motivo (`cambiar_estado_tienda`), política de revisión por tienda (`politica_revision`) y moderación de productos (`productos`, `producto`, `moderar_producto`). Revisión mixta: los primeros productos de una tienda nueva (configuración `revision_productos_iniciales`) quedan pausados con motivo `revision` hasta que moderación los aprueba; el trigger `productos_revision` lo aplica y protege los datos de moderación |
| `pkg_admin` | `..._2800` | Etapa 3, catálogo (moderación): árbol de categorías con cifras (`categorias`, `categoria`), alta, edición y movimiento (`guardar_categoria`), mostrar u ocultar en cascada (`activar_categoria`, saca los productos de los carritos), orden del menú (`ordenar_categoria`), borrado sin productos (`eliminar_categoria`), atributos por categoría (`guardar_atributo_categoria`, `quitar_atributo_categoria`) y catálogo de atributos y opciones (`atributos`, `guardar_atributo`, `eliminar_atributo`, `guardar_opcion`, `eliminar_opcion`). Territorio (logística): `territorio`, provincias y localidades (`guardar_*`, `activar_*`, `eliminar_localidad`) y tarifas de envío (`tarifa_envio`). Las variantes de una categoría quedan fijas cuando ya tiene productos y la dirección web (slug) se fija al crearla |
| `pkg_admin` | `..._2900` | Etapa 4, usuarios (soporte): listado con filtros y búsqueda (`usuarios`), ficha con roles, tiendas, equipos y compras (`usuario`), `bloquear_usuario` y `desbloquear_usuario`. Bloquear suspende las tiendas activas o pendientes del dueño; desbloquear restaura solo las que siguen suspendidas por ese motivo. Soporte no puede bloquearse a sí mismo, al superadmin ni a otros del equipo (eso solo el superadmin). `pkg_auth.ingreso` rechaza el login de una cuenta bloqueada y anota el último ingreso |
| `pkg_admin` | `..._3000` | Etapa 4, pedidos (soporte, finanzas y logística): vista global paginada (`pedidos`) y ficha con partes, historial, envío, reembolsos y pagos (`pedido`; los pagos solo para finanzas). Soporte y logística cancelan una parte (`cancelar_parte`), lo que deja un reembolso pendiente; finanzas lo procesa o lo rechaza con nota (`procesar_reembolso`) o devuelve un monto en el acto (`reembolsar`), nunca más de lo que queda de esa parte |
| `pkg_admin` | `..._3100` | Etapa 4, planes y suscripciones (finanzas): `planes` con tiendas e ingreso mensual, `guardar_plan` (bajar un límite pausa en el acto lo que sobra en sus tiendas; un precio nuevo rige desde la próxima renovación), `ordenar_plan`, `suscripciones` por vista y plan, ficha `suscripcion` con uso, pagos e historial, `extender_suscripcion` (1 a 90 días), `registrar_pago_suscripcion` (corre un mes) y `cancelar_suscripcion` (el plan gratis no se cancela) |
| `pkg_seguidos` | `..._3700` | Tiendas que sigue cada cliente: `ids`, `seguir` (solo tiendas activas, no la propia, hasta 500), `dejar` y `sugerencias` (las tiendas seguidas con sus productos nuevos de los últimos 14 días y hasta 12 productos, alternando entre tiendas y dejando al final lo que ya está en favoritos). `pkg_catalogo.tienda` suma `seguidores` |
| `pkg_admin` | `..._4000` | Rubros (superadmin): `rubros` (todos, con cuántas tiendas usan cada uno y cuántas no tienen rubro), `guardar_rubro` (crear o renombrar; el lugar y el slug se fijan al crearlo), `activar_rubro` (en cascada; las tiendas que lo tienen lo conservan), `ordenar_rubro` y `eliminar_rubro` (solo sin nada adentro y sin tiendas). `tiendas` y `tienda` suman el rubro de cada tienda. La misma migración suma `pkg_catalogo.rubros` (la lista activa para los formularios) y el rubro, subrubro y especialidades en `pkg_tiendas.crear`, `actualizar` y `detalle` |
| `pkg_admin` | `..._4200` | Revisión por categoría (moderación): `revision_categoria` la activa o la quita; `categorias` suma `requiere_revision` (propia) y `revision` (propia o heredada) y `categoria` suma `revisionDesde` (la categoría de más arriba que se la pasa). `pkg_catalogo.categorias` suma `revision` para avisarle al comercio |
| `pkg_admin` | `..._3600` | Roles de las tiendas (superadmin): `roles_tienda` con personas, tiendas e invitaciones de cada rol predefinido, `guardar_rol_tienda` y `borrar_rol_tienda` (no se borra un rol en uso ni el último que queda; los retirados y las invitaciones viejas pasan a otro rol) |

Convenciones (detalladas al principio de `..._1800`):

- Cada módulo es un esquema propio. Supabase solo publica `public` en su API REST, así que el navegador no puede llamar a los paquetes.
- Las funciones corren con el rol de quien llama (`security invoker`): RLS y los triggers de reglas de negocio siguen aplicando. Las que solo usa el servidor (login, registro) no tienen permiso para `anon` ni `authenticated`.
- Cada respuesta compuesta vuelve como `jsonb` en un solo viaje a la base.
- Los errores usan códigos propios que el API traduce a HTTP: `TC400`, `TC403`, `TC404`, `TC409`. El mensaje ya está escrito para el usuario.
- Desde Node se llaman con `llamar(tx, Prisma.sql\`select pkg_x.funcion(...) as r\`)` o, si no devuelven nada, con `ejecutar(...)` (`src/config/db.ts`).
- Las fotos se devuelven con su ruta de almacenamiento; el API arma la URL (`src/common/utils/images.ts`).
- **Contratos** (`packages/contratos`, en la raíz del repo): esquemas zod con la forma de cada respuesta `jsonb`. La web toma de ahí sus tipos, el API los verifica fuera de producción (`conContrato` en `src/common/utils/contrato.ts`; si no coinciden responde 500 y el log dice qué campo falla) y `db:probar` comprueba las respuestas reales. Si una migración cambia la forma de una respuesta que tiene contrato, se actualiza el contrato en el mismo cambio. Por ahora cubren rubros, tiendas y categorías (`pkg_catalogo.rubros`, `rubro`, `tiendas`, `categorias`, `pkg_tiendas.detalle`, `pkg_admin.rubros`); el resto se suma de a un módulo. `npm run dev`, `build` y `db:probar` compilan el paquete solos.
- **Workspaces**: el repo se instala una sola vez con `npm install` en la raíz (un solo `package-lock.json` y un solo `node_modules`; las apps no tienen el suyo). Desde la raíz: `npm run dev:api`, `npm run dev:web`, `npm run typecheck`, `npm run build`, `npm run db:local` y `npm run db:probar`. Los comandos de siempre dentro de `apps/api` y `apps/web` siguen funcionando. Para agregar una dependencia a una app: `npm install paquete -w api` (o `-w web`), desde la raíz. `prisma generate` deja el cliente en el `node_modules` de la raíz.

Todas las tablas tienen llave primaria (`uuid` en casi todas) y todas las llaves foráneas tienen índice.

Diferencias con Supabase: no hay Storage (la migración de imágenes se salta sola) ni pg_cron (las funciones de `tareas_programadas.sql` se llaman a mano cuando se necesitan, por ejemplo `select public.cerrar_pedidos_sin_pago();`).

---

## 3. Cómo aplicarlo en Supabase, paso a paso

Necesitás [Node.js](https://nodejs.org) instalado. Los comandos se escriben en la terminal, dentro de la carpeta `apps/api/prisma/marketplace-db/`.

**Paso 1 · Carpeta de Supabase (ya hecho)**

`supabase/config.toml` ya está creado (`npx supabase init`), junto con `migrations/`, `seed.sql` y `tareas_programadas.sql`. No hace falta copiar nada.

**Paso 2 (opcional, recomendado) · Probar en tu computadora**

Requiere [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.

```bash
npx supabase start       # levanta un Supabase local
npx supabase db reset    # aplica todas las migraciones + los datos de ejemplo
```

Abrí `http://localhost:54323` y vas a ver las 45 tablas en el panel.

**Paso 3 · Subirlo al proyecto real**

1. Creá el proyecto en [supabase.com](https://supabase.com) (región São Paulo, la más cercana).
2. Copiá el "Reference ID" (Project Settings → General).
3. En la terminal:

```bash
npx supabase login
npx supabase link --project-ref TU_REFERENCE_ID
npx supabase db push     # aplica las migraciones (no carga los datos de ejemplo)
```

Si es un proyecto **de desarrollo** y querés los datos de ejemplo, usá `npx supabase db push --include-seed`. En el proyecto de producción, nunca.

**Paso 4 · Tareas automáticas**

En el panel de Supabase: Database → Extensions → activá **pg_cron**. Después, en SQL Editor, pegá y ejecutá `tareas_programadas.sql`.

**Paso 5 · Tipos para TypeScript**

```bash
npx supabase gen types typescript --linked > src/types/supabase.ts
```

Así el editor autocompleta nombres de tablas y columnas, y avisa si alguno está mal escrito.

> **Sin terminal:** también se puede pegar cada archivo de `migrations/`, en orden, en el SQL Editor de Supabase. Funciona, pero Supabase no queda registrando qué migraciones se aplicaron. Conviene usar la terminal.

---

## 4. Cómo verificar que todo funciona

```bash
npm install        # una sola vez, en la raíz del repo (instala API, web, base y contratos)
npm run db:probar  # desde la raíz; en apps/api también funciona npm run db:probar
```

Crea una base de prueba en memoria y simula el negocio completo: Ana y Beto con una tienda cada uno, Carla como empleada, Diego comprando a las dos tiendas y Rita repartiendo. Verifica, entre otras cosas:

- Beto no ve ni modifica nada de la tienda de Ana.
- El plan gratis admite 10 productos y 0 empleados; al bajar de plan se pausan los sobrantes, sin borrar nada.
- La compra se divide por tienda, congela los precios y reserva el stock.
- Un aviso de pago repetido no cobra dos veces.
- En las entregas a domicilio, el comercio no puede marcar "entregado", y nunca puede cambiar montos.
- El repartidor no puede retirar un pedido que la tienda no marcó como listo, y queda registrado cuánto esperó.
- Cancelar la parte de una tienda devuelve el stock y genera el reembolso solo de esa parte.

El detalle está en `pruebas/resultado_pruebas.txt`. **Correlo cada vez que cambies la base.**

---

## 5. Cómo lo usa la aplicación (Next.js)

La app nunca tiene que filtrar "lo que le corresponde a cada usuario": la base ya lo hace sola.

```ts
// Marketplace: solo trae productos publicados de tiendas activas (lo filtra la base).
const { data } = await supabase.from('productos').select('id, nombre, variantes(precio, stock)');

// Búsqueda con errores de tipeo, sin acentos, por localidad y talle.
const { data } = await supabase.rpc('buscar_productos', {
  p_texto: 'zapatila', p_localidad: localidadId, p_opciones: [talleM],
});

// Comprar: arma la compra con el carrito, divide por tienda y reserva stock.
const { data: pedidoId } = await supabase.rpc('crear_pedido', { p_direccion_id: direccionId });

// El comercio marca su parte como lista (la base valida el paso y guarda el historial).
await supabase.from('pedidos_tienda')
  .update({ estado: 'listo_para_recoleccion' }).eq('id', parteId);

// Invitar y aceptar empleados.
const { data: codigo } = await supabase.rpc('crear_invitacion', { p_tienda, p_email, p_rol });
await supabase.rpc('aceptar_invitacion', { p_token: codigo });

// Botón de Arrepentimiento (funciona sin iniciar sesión).
const { data: codigoGestion } = await supabase.rpc('enviar_solicitud_consumidor', {
  p_tipo: 'arrepentimiento', p_nombre, p_email, p_numero_pedido,
});
```

**Solo en el servidor** (ruta `/api/webhooks/mercadopago`), con la clave `service_role`:

```ts
// Después de validar la firma del aviso de Mercado Pago:
const supabaseAdmin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
await supabaseAdmin.rpc('confirmar_pago', {
  p_pedido: pedidoId, p_mp_payment_id: pago.id, p_monto: pago.transaction_amount,
});
```

Si `transaction_amount` no coincide con el total del pedido, `confirmar_pago` devuelve un error y **no** confirma la compra. El webhook tiene que registrar ese error y avisar a finanzas: el dinero entró, pero hay que revisarlo a mano.

---

## 6. Reglas para quien programe (y para Antigravity)

1. **Nunca cambiar la base a mano en el panel.** Cada cambio es una migración nueva: `npx supabase migration new nombre_del_cambio`, se escribe el SQL y se aplica con `db push`.
2. **La clave `service_role` nunca va al navegador.** En `.env` va sin el prefijo `NEXT_PUBLIC_`.
3. **Los permisos viven en la base.** Ocultar un botón es comodidad, no seguridad.
4. **Correr `npm run probar` antes de subir un cambio de base**, y sumar una prueba por cada regla nueva.
5. Para crear pedidos, confirmar pagos o invitar empleados, usar las funciones de `..._1200_operaciones.sql`. No insertar filas a mano, porque se saltearían las validaciones.
6. **Toda tabla nueva necesita, en su misma migración:** `alter table ... enable row level security`, sus políticas y, si tiene `actualizado_en`, el trigger `actualizado_en`. Las migraciones `1100` y `1300` solo los aplicaron a las tablas que existían en ese momento. Sin RLS, Supabase expone la tabla completa a cualquiera; la simulación falla si alguna tabla queda sin estas dos cosas.
7. **El API solo llama a funciones `pkg_*`.** Cada pantalla nueva suma su función al paquete del módulo (o un paquete nuevo), en una migración nueva, con sus `grant` explícitos al final. Toda llave foránea nueva lleva su índice.

---

## 7. Ajustes respecto del documento del modelo

Al escribir el SQL se tomaron algunas decisiones chicas:

- `producto_atributos` e `imagenes_producto` también llevan `tienda_id` (la completa la base), igual que `variantes`, para que la seguridad sea uniforme.
- `productos` tiene `publicado_en`, para saber cuáles son los más recientes al aplicar límites de plan.
- `solicitudes_consumidor` tiene `numero_pedido` y `detalle`, para quien la envía sin iniciar sesión. Se carga con la función `enviar_solicitud_consumidor()`, que devuelve el código de gestión.
- Los tokens de Mercado Pago se llaman `access_token_cifrado` y `refresh_token_cifrado`: el servidor los cifra antes de guardarlos.

### Correcciones posteriores (`..._1600_correcciones.sql`)

| Problema | Corrección |
|---|---|
| `confirmar_pago` aceptaba cualquier monto (la prueba pagaba $1 por un pedido de más de $100.000) | Exige que el monto sea igual al total del pedido |
| Si Mercado Pago aprobaba un reintento después de un rechazo, el pago se ignoraba | El pedido se reabre y se confirma |
| Si se cancelaban todas las partes con entrega, el envío no se devolvía | Se genera un reembolso del envío, una sola vez (`reembolsos.es_envio`) |
| Renombrar o mover una categoría dejaba a sus subcategorías con la ruta vieja (rompía búsqueda y herencia de atributos) | La ruta de todo el subárbol se actualiza; no se permite mover una categoría dentro de sí misma |
| Cancelar la suscripción dejaba la tienda activa sin plan | Sin otra suscripción vigente, la tienda queda "vencida" |
| Los pedidos que nunca se pagaban quedaban "pendiente" para siempre | `cerrar_pedidos_sin_pago()` los cierra a las 24 h (tarea programada) |
| Las pruebas no corrían en Windows | Rutas de archivo corregidas en `pruebas/cargar.mjs` |

## 8. Pendientes que tocan la base

- **Precios definitivos de Premium y Gold:** hoy son provisorios ($ 15.000 y $ 35.000 por mes). Finanzas los ajusta desde el panel, en "Suscripciones y planes"; rigen desde la próxima renovación.
- **Medicamentos y productos sanitarios:** hoy solo Productos veterinarios pasa por revisión. Si se venden medicamentos o productos sanitarios para personas, conviene crear su subcategoría en Salud, belleza y cuidado personal y marcarla con revisión desde el panel (o definir reglas propias).
- **Reservas de alquileres y experiencias:** fechas, cupos, seña y garantía hoy son datos informativos de la ficha. Un sistema de reservas con disponibilidad real es otra etapa.
- **Qué datos del comprador ve el comercio:** hoy ve la compra general, incluida la dirección. Si se decide ocultarla, se ajusta la política `pedidos: comprador, comercio, repartidor y admin`.
- **Multa por espera del repartidor:** la base ya guarda llegada y retiro. Si se aprueba, se agrega la tabla `penalizaciones` en una migración nueva.
- **Pago 1:N de Mercado Pago:** si no se habilita, `pagos.pedido_tienda_id` ya está previsto para el plan B (un pago por tienda).
- **Comisión por categoría:** `categorias.comision_pct` es 0 por defecto, así que la plataforma no cobra comisión hasta que se cargue en cada categoría. Si el negocio vive solo de los planes, está bien así.
- **Funciones auxiliares visibles:** funciones como `plan_vigente()` o `contar_empleados_activos()` se pueden llamar desde la API pública. Revelan datos menores de cualquier tienda (su plan, cuántos empleados tiene). Moverlas a un esquema privado es más seguro, pero obliga a reescribir triggers y políticas; conviene hacerlo antes de lanzar.
