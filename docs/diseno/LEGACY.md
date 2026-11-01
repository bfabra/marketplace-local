# Legacy — no usar como fuente de verdad

Archivos de la maqueta o restos de la app que **no** deben portarse ni confundirse con la referencia vigente.

## Maqueta (`docs/diseno`) — no cargados en `index.html`

| Archivo | Reemplazo vigente |
|---------|-------------------|
| `js/pages/login.js` | `js/pages/auth.js` (`#login`) |
| `js/pages/register.js` | `js/pages/auth.js` (`#signup`) |
| `js/pages/orders.js` | `js/pages/profile.js` (tabs compras / envíos) |
| `js/pages/notfound.js` | — (sin ruta en el router actual) |
| `js/pages/merchant/*.js` (stubs) | `js/pages/merchant.js` (`#merchant-panel`) |

## App (`apps/web`) — preferir el shell actual

| Archivo | Preferir |
|---------|----------|
| `components/layout/cuenta-nav.tsx` (`pt-nav`) | `cuenta-shell.tsx` (`#profile`) |
| Estilos `pt-*` en paneles viejos | Clases `mp-*` / `cuenta-*` alineadas a la maqueta oct 2026 |

## Reglas

1. La tipografía oficial es **Manrope**; el color primario es **`#09305f`**.
2. El envío en producción es **un solo costo por dirección** (no `$2.999 × tienda` del marquee demo).
3. Auth y panel comerciante se contrastan con `#login` / `#signup` / `#merchant-panel` en la maqueta cargada por `index.html`, no con los stubs listados arriba.
