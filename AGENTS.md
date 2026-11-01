# AGENTS.md — CompraLocal / Tu Comercio Local

Instrucciones permanentes para agentes y desarrolladores del monorepo.

## Identidad visual (obligatoria)

| Token | Valor |
|-------|--------|
| Tipografía UI | **Manrope** (pesos 400–800) |
| Primario / navy | **`#09305f`** |
| Acento | **`#fd6910`** |

Fuente de verdad de la maqueta: `docs/diseno/css/tokens.css` y `docs/diseno/AGENTS.md` §3.  
En la app: `apps/web/src/app/layout.tsx` (Manrope) + `apps/web/src/app/globals.css` (`--navy` / `--primary`).

## Dónde mirar

| Qué | Dónde |
|-----|--------|
| Guía de diseño completa | [`docs/diseno/AGENTS.md`](docs/diseno/AGENTS.md) |
| Legacy / no portar | [`docs/diseno/LEGACY.md`](docs/diseno/LEGACY.md) |
| Maqueta interactiva | `docs/diseno/index.html` (rutas `#marketplace`, `#login`, `#signup`, `#profile`, `#merchant-panel`, …) |
| App | `apps/web` (Next.js 14) · API `apps/api` |

## Reglas rápidas

- Envío en producción: **un solo costo por dirección** (no copiar `$2.999 × tienda` del marquee demo).
- Auth de referencia: `docs/diseno/js/pages/auth.js` — **no** `login.js` / `register.js`.
- Panel comerciante: `docs/diseno/js/pages/merchant.js` — **no** `js/pages/merchant/*.js`.
- Cuenta cliente: `CuentaShell` — no ampliar `cuenta-nav.tsx` (legacy).
