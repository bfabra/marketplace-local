# AGENTS.md — COMPRALOCAL (Instrucciones Permanentes del Proyecto)

Este documento establece las directrices permanentes de diseño, identidad visual, arquitectura técnica y estándares de desarrollo para todos los agentes de IA y desarrolladores que colaboren en el proyecto **CompraLocal**. Debe consultarse obligatoriamente antes de iniciar cualquier tarea.

---

## 1. Identidad y Propósito del Proyecto

- **Nombre del producto**: CompraLocal (Tu Comercio Local).
- **Misión**: Marketplace digital para comercios locales y de cercanía que inicia su operación en **San Juan, Argentina**, diseñado con capacidad de escalabilidad y expansión posterior a otras provincias de la República Argentina.
- **Flujos prioritarios**:
  1. **Cliente / Comprador**: Descubrimiento de comercios de cercanía, navegación por categorías y rubros, catálogo de productos, carrito de compras unificado o por tienda, checkout optimizado para envíos locales/retiro en tienda y seguimiento de pedidos.
  2. **Comerciante / Propietario de tienda(s)**: Panel de gestión de comercio (onboarding, catálogo de productos, control de stock, gestión de pedidos entrantes, configuración de sucursal, horarios, métodos de pago y zonas de entrega).
- **Fase posterior**: El panel de Superadministración de la plataforma se desarrollará en una fase futura; no debe implementarse de forma anticipada sin indicación explícita.

---

## 2. Referencias Permanentes

Todo desarrollo de interfaces y flujos debe contrastarse rigurosamente con las siguientes referencias oficiales:

### 2.1. Mockup Interactivo
- **URL**: [https://import-loud-85754595.figma.site/#marketplace](https://import-loud-85754595.figma.site/#marketplace)
- **Instrucciones**: Consultar este prototipo interactivo al desarrollar las pantallas asociadas. Explorar las interacciones, componentes y jerarquías visuales disponibles.
- **Nota técnica de acceso**: Dicha URL aloja una Single Page Application (Figma Make App / Vite React) que renderiza su contenido del lado del cliente vía JavaScript (`<div id="root"></div>`). Los agentes que operen sin renderizado headless de navegador no obtendrán el DOM completo mediante un fetch HTTP estático simple; debe documentarse esta limitación si no se dispone de subagente de navegación con soporte DOM completo.

### 2.2. Referencias Locales en el Repositorio
Ubicadas en la carpeta principal del proyecto (`../` respecto al workspace o en la raíz de documentación):
- **Mapa de navegación / Flujo de pantallas**:
  - `Mapa de Navegación.png` / `Arbol-de-navegacion.png` / `Arbol-B.png`
  - *Uso obligatorio*: Verificar siempre los recorridos, transiciones entre pantallas, jerarquía de subpáginas y relaciones entre el marketplace, la cuenta de usuario y el panel de comercio.
- **Ecosistema visual general**:
  - `CompraLocal_ ecosistema.png`
  - `Mockup de onboarding CompraLocal.png`, `cliente.png`, `Comercio.jpg`, `comercio02.jpg`, `comercio03.jpg`
  - *Uso obligatorio*: Mantener la coherencia estética con las pantallas de referencia allí plasmadas.
- **Especificaciones de negocio y datos**:
  - `Marketplace local - Modelo de datos.docx`
  - `Marketplace_comercios_locales_funcionamiento.docx`
  - `Marketplace_modelo_comisiones_envios_cobros.docx`
  - `Rubros-Categorias.docx`
- **Regla ante discrepancias**: En caso de diferencias entre documentos o prototipos, priorizar las decisiones funcionales acordadas explícitamente y nunca inventar reglas de negocio arbitrarias. Si una referencia no está accesible, declararlo con honestidad y no afirmar que fue inspeccionada.

---

## 3. Identidad Visual y Marca

### 3.1. Filosofía Estética
- Estética **moderna, profesional, cercana y accesible**.
- Debe evocar el comercio de barrio y de cercanía con la sofisticación, agilidad y confianza de las mejores aplicaciones de comercio electrónico contemporáneas.
- Evitar diseños genéricos, layouts planos sin contraste o imitaciones de marketplaces masivos sin calidez local.

### 3.2. Paleta Cromática Oficial
Fuente de verdad: `css/tokens.css` (maqueta Figma Make vigente).
- **Azul marino / Primario**:
  - Base: `#09305f` (`--primary`)
  - Hover: `#06264c` · Soft: `#e9f0f7` · Deep: `#061f3b`
- **Naranja Vibrante / Acento Comercial**:
  - Acento: `#fd6910` (`--accent`) · Soft: `#fff0e7` · Light: `#ffc49c`
- **Neutros y Fondos**:
  - Superficie: `#ffffff` · Canvas: `#f7f9fb` · Canvas deep: `#edf1f5`
  - Texto: `#14283e` · Muted: `#687788` · Borde: `#dbe3eb`

### 3.3. Tipografía
- **UI completa (titulares y cuerpo)**: `Manrope` (`--font-sans` en `css/tokens.css`), pesos 400–800.
- Tamaños e interlineados: variables `--fs-*` en `css/tokens.css`.

### 3.4. Regla de negocio — envío (app real vs maqueta demo)
- En la **app** (`apps/web` + API) el envío a domicilio es **un solo costo por dirección/localidad** al finalizar la compra, aunque el pedido incluya varias tiendas.
- La maqueta demo a veces muestra `$2.999 × tienda` o un precio fijo promocional: **no copiar esa regla a la UI de producción**.
- Copy permitido: “envío único / un solo costo por dirección”, “se calcula al finalizar”, o el monto real de la tarifa de la localidad del comprador.

### 3.5. CTA “Convertirme en Comercio”
Decisión (open point de `Leemeee.txt`):
- El alta de comercio **no** obliga desde el registro: la cuenta nace como comprador.
- CTA visible en: menú de usuario (clientes), sidebar de Mi cuenta, pie “Sumá tu comercio”, y pantalla de éxito de registro (opción secundaria).
- Destino: `/vendor/nueva-tienda`.

---

## 4. Recursos Oficiales de Marca (Catálogo de Logotipos SVG)

### 4.1. Ubicación de Almacenamiento
Todos los archivos vectoriales SVG oficiales están centralizados en la siguiente ruta pública del proyecto:
```
public/brand/logos/
```
*(Ruta física relativa a la raíz de Pantallas: `c:/Users/luks_/Documents/Marckeplace/Pantallas/public/brand/logos/`)*

### 4.2. Variantes Verificadas y Reglas de Uso

Se verificó el 100% de los archivos originales sin alteración de sus vectores ni atributos internos. Las 9 variantes oficiales registradas son:

| Archivo SVG | Tipo / Formato | Dimensiones / ViewBox | Colores Identificados | Contexto y Regla de Uso Recomendado |
| :--- | :--- | :--- | :--- | :--- |
| `Logo.svg` | **Isotipo principal (Color)** | `0 0 718.64 665.36` (Aprox. 1:1) | `#09305f`, `#fd6910`, `#ffffff` | Símbolo oficial (bolsa de compras + pin de ubicación). Uso en avatares, favicon, app icon, navbar mobile y cabeceras con poco espacio sobre fondos claros. |
| `Logo_h.svg` | **Logotipo horizontal (Color)** | `0 0 5348.23 665.36` (Panorámico ~8:1) | `#09305f`, `#fd6910`, `#ffffff` | Isotipo + texto completo horizontal. Variante primaria recomendada para el header principal del marketplace y barras de navegación sobre fondo claro. |
| `Logo_nombre.svg` | **Logotipo apilado / vertical (Color)** | `0 0 1049.22 978.33` (Vertical ~1:1) | `#09305f`, `#fd6910`, `#ffffff` | Isotipo centrado con texto abajo. Uso en pantallas de onboarding, login, registro, splash screen y portadas. |
| `Negativo_iso.svg` | **Isotipo monocromático (Negro)** | `0 0 718.64 665.36` | Silueta monocromo negra | Isotipo a 1 tinta oscura. Uso en impresiones monocromáticas, tickets, remitos y documentos formales en papel blanco. |
| `Negativo_iso_w.svg` | **Isotipo monocromático (Blanco)** | `0 0 718.64 665.36` | `#ffffff` | Isotipo en blanco puro (`_w`). Obligatorio cuando se coloque sobre fondos oscuros (verde petróleo, azul marino o negro). |
| `Negativo_logo.svg` | **Logotipo apilado (Negro)** | `0 0 1049.22 978.33` | Silueta monocromo negra | Logotipo vertical a 1 tinta negra sobre fondo claro. Para remitos, recibos o documentación técnica impresa. |
| `Negativo_logo_w.svg` | **Logotipo apilado (Blanco)** | `0 0 1049.22 978.33` | `#ffffff` | Logotipo vertical blanco (`_w`). Uso en pantallas de bienvenida oscuras o fondos fotográficos con superposición profunda. |
| `Negativo_logo_h.svg` | **Logotipo horizontal (Negro)** | `0 0 5348.23 665.36` | Silueta monocromo negra | Logotipo horizontal a 1 tinta negra para reportes, encabezados de factura y papelería. |
| `Negativo_logo_h_w.svg` | **Logotipo horizontal (Blanco)** | `0 0 5348.23 665.36` | `#ffffff` | Logotipo horizontal en blanco puro (`_w`). Ideal para encabezados con fondo oscuro (verde petróleo `#1c4f4f` o panel comercial con tema oscuro). |

### 4.3. Reglas Críticas sobre el Logotipo
1. **No redibujar ni simular con texto**: Jamás sustituir el logotipo por una composición improvisada de etiquetas `<span>` o texto plano si existe un archivo SVG oficial aplicable.
2. **Inalterabilidad**: No modificar los archivos SVG originales en `public/brand/logos/`. No alterar sus paths, viewports ni proporciones.
3. **Contraste estricto**: No colocar las versiones con texto oscuro sobre fondos oscuros ni las variantes `_w` sobre fondos claros.
4. **Componente de presentación**: Para renderizar el logo, invocar el SVG mediante etiquetas `<img>` con `src="public/brand/logos/<nombre>.svg"` o componentes dedicados que respeten las proporciones nativas.

---

## 5. Arquitectura Técnica y Buenas Prácticas

### 5.0. Dos capas (no confundir)
1. **App de producción**: monorepo Next.js 14 (`apps/web`) + API Express/Prisma (`apps/api`). Tipografía **Manrope**, primario **`#09305f`**, acento **`#fd6910`** (tokens en `apps/web/src/app/globals.css`).
2. **Maqueta de diseño** (esta carpeta `docs/diseno`): SPA vanilla cargada por `index.html`. Sirve de **referencia visual y de flujos**; no es el runtime de producción.

### 5.1. Estructura de la maqueta (referencia)
SPA **Vanilla HTML5 + CSS3 + JS ES6** solo como mockup interactivo:
- `index.html`: Shell y scripts vigentes (ver lista de `<script>` — **no** incluye login.js / register.js / merchant/*).
- `css/tokens.css`: Design System — Manrope, `#09305f`, `#fd6910`.
- `css/animations.css`: `page-enter`, `fadeInUp`, `scaleIn`.
- `js/pages/auth.js`: `#login` / `#signup` (vigente).
- `js/pages/merchant.js`: `#merchant-panel` (vigente).
- `js/pages/profile.js`: `#profile` (vigente).
- **Legacy**: ver `LEGACY.md` (login.js, register.js, orders.js, merchant/*.js, etc.).

### 5.2. Separación de Dominios
Mantener estricta separación de responsabilidades y layouts entre:
1. **Marketplace público**: Orientado a la conversión, navegación fluida, búsqueda y descubrimiento.
2. **Cuenta y pedidos del cliente**: Historial personal, direcciones, checkout y perfil.
3. **Panel comercial**: Layout con sidebar lateral, métricas, tablas de administración de inventario y pedidos con acciones rápidas de cambio de estado.

### 5.3. Calidad, Accesibilidad y Datos
- **Responsive**: Diseño totalmente adaptado para dispositivos móviles, tablets y monitores de escritorio.
- **Accesibilidad**: Uso de etiquetas semánticas (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`), atributos ARIA (`aria-label`, `aria-expanded`, `role`), y foco visible para teclado.
- **Honestidad funcional**: No simular conexiones a APIs o bases de datos como si fueran servicios reales cuando son datos simulados (mock). Mantener los mocks transparentes y claramente documentados.
- **Seguridad**: Si se conecta Supabase u otro backend en fases posteriores, no modificar esquemas de base de datos ni políticas RLS sin requerimiento explícito.
- **Verificación previa a la entrega**: Antes de cerrar cualquier tarea, comprobar que no existan errores de consola, rutas rotas ni discrepancias visuales.
