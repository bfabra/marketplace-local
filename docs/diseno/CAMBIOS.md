# Cambios de maqueta · inventario vs `apps/web`

Última validación: **2026-11-22** (carpeta actualizada + chequeo de integridad).

Comparación del working tree de `docs/diseno` contra **`apps/web`**.

## Validación de la carpeta (esta pasada)

| Chequeo | Resultado |
|---------|-----------|
| Tokens marca (`css/tokens.css`) | OK — Manrope, `#09305f`, `#fd6910` |
| `index.html` carga `reviews.js` + páginas vigentes | OK |
| Auth de referencia | OK — usar `js/pages/auth.js` (siguen en disco `login.js` / `register.js` = legacy) |
| Panel comerciante | OK — `js/pages/merchant.js` monolítico |
| **Rotura al actualizar** | La actualización **había borrado** `AGENTS.md`, `LEGACY.md`, `public/brand/logos/*` y `public/images/banner.jpg` → maqueta sin logos ni hero |
| **Reparación** | Restaurados desde Git: `AGENTS.md`, `LEGACY.md`, logos y `banner.jpg` |
| Opcional aún borrado | `Leemeee.txt`, `Mapa de Navegación.txt` (no bloquean la maqueta) |
| `README.md` | Corregido: app = `apps/web` (antes decía `frontend/`) |

**Importante:** al reemplazar `docs/diseno` desde un zip/export, **no pises** `public/brand/`, `public/images/`, `AGENTS.md` ni `LEGACY.md` (o volvé a copiarlos desde el repo).

Diff aproximado de UX nueva: **~+2000 / −620** en JS/CSS + `reviews.js` / `serve.js`.

---

## Marca (no negociable)

| Token | Valor |
|-------|--------|
| Tipografía | **Manrope** |
| Primario / navy | **`#09305f`** |
| Acento | **`#fd6910`** |

Fuente: `css/tokens.css` + `AGENTS.md`.

---

## Inventario por área

| # | Área (maqueta) | Qué cambió | Estado en `apps/web` | Acción |
|---|----------------|------------|----------------------|--------|
| 1 | **Reseñas** `js/components/reviews.js` **NUEVO** | Badge reputación tienda; opiniones en producto; modal valorar (UI off hasta pedidos) | `Rating` solo con datos; **sin** API de reseñas | **Diferir backend**. Portar **UI vacía** (“sin reseñas” / “Sin valoraciones”) si querés paridad |
| 2 | **Merchant** `merchant.js` (~+870) | Tab suscripción; **inbox chat**; Reputation; stock; carga masiva más visible | Rutas vendor OK (`plan`, productos, lote, equipo…). **Sin** chat | **Alinear UX** plan/productos/carga masiva. **Diferir chat** |
| 3 | **Checkout** `checkout.js` | Stepper 1→2→3; form SJ; MP multi-tienda | `/checkout` + `CheckoutSteps`; envío = **1 costo/dirección** | **Paridad visual**; no copiar tarifa × tienda demo |
| 4 | **Producto** `product.js` | `Reviews` + badge en “Vendido por” | Modal con Comprar ahora + favorito | Portar sección reseñas vacía + badge |
| 5 | **Tienda** `store.js` | Reputation; **chat** modal; valorar | Sin chat / valorar | Badge empty OK. **Diferir chat** |
| 6 | **Home** `home.js` | Une data demo + panel; ofertas; grillas | Home con API | Solo CSS/layout; no inventar datos |
| 7 | **Header** `header.js` | Menú comerciante/cuenta; badge carrito | Header + `UserMenu` | Micro-diff visual |
| 8 | **Carrito / perfil / auth** | Qty, detalle compra, ojito password | Login OK | Ver `#signup` abajo |
| 8b | **Signup** `#signup` (`auth.js`) | Tel país/tipo/nº; domicilio barrio + refs; dpto SJ; mapa pin demo | `/registro` alineado (mapa UX soft, coords no persisten) | Migración `052` refs en `registrar_cliente` |
| 9 | **Search / cards / data** | Une merchant+static; badge en card | API real | Badge cuando haya dato |
| 10 | **CSS** `layout` + `pages` | Responsive hero, grids, auth, product-detail | `marketplace.css` | Pasada mobile |
| 11 | **Tooling** `serve.js` | Preview local | — | OK |
| 12 | **Alta comercio** `onboarding.js` (#merchant) | Ver tabla debajo | `/vendor/nueva-tienda` | Alinear ubicación (dpto) |

### Alta “Configurá tu tienda” — campos maqueta vs app

| Campo | Maqueta (`onboarding.js`) | App (`/vendor/nueva-tienda`) |
|-------|---------------------------|------------------------------|
| Nombre | ✔ obligatorio | ✔ |
| CUIT | ✔ | ✔ |
| Razón social | — | ✔ opcional (**extra en app**) |
| Teléfonos (país/tipo/nº + prefijo, máx. 3) | ✔ cabecera simétrica + grilla 140/100/1fr | ✔ (`TelefonosTienda`) |
| Correo comercio | — | ✔ opcional (**extra en app**) |
| Rubro / subrubro | ✔ / opcional | ✔ |
| Especialidades | — | ✔ chips (**extra en app**) |
| Descripción | ✔ (máx. 240) | ✔ (máx. 500) |
| **Provincia** | ✔ select fijo SJ | ✔ (`TerritorioTienda`) |
| **Departamento** | ✔ **obligatorio** | ✔ (`TerritorioTienda` → `localidad_id`) |
| Localidad / villa | ✔ (demo en maqueta) | ✔ texto libre → se guarda en `direccion` |
| Calle y mapa | ✔ mapa demo + import Maps | ✔ mapa soft + Google si hay API key |
| Logo | ✔ | ✔ |

**Conclusión:** la maqueta pide **más pasos de territorio** (Provincia + Departamento + Localidad). La app pide **más datos comerciales** (razón social, email, especialidades) pero aplana el domicilio a una sola localidad. El modal rápido del panel (`ModalRegistrarTienda`) es aún más corto (sin razón social / email / especialidades / mapa).

---

## Prioridad

### Portar ya (sin API nueva)

1. UI vacía de reseñas en ficha/modal producto  
2. Badge “Sin valoraciones” (card / ficha / vendido por)  
3. Paridad panel: plan, listado productos, CTA carga masiva  
4. Checkout stepper / copy MP (sin cambiar reglas de envío)  
5. CSS mobile home + product-detail  
6. ~~**Alta tienda:** Provincia + Departamento~~ **Hecho** (`TerritorioTienda`; en DB el dpto = `localidad_id`). Teléfonos máx. 3.
7. ~~**Signup `#signup`:**~~ **Hecho** — teléfono estructurado, barrio/refs, departamento, mapa soft; API guarda `referencias`.

### Diferir

| Feature | Motivo |
|---------|--------|
| Chat tienda + inbox merchant | Sin backend |
| Reseñas / valoraciones persistentes | Sin tablas/API (maqueta ya deja UI disabled) |
| Tickets de ayuda | Sin backend |
| `$2.990 × tienda` | Choca con **un costo por dirección** |

### Ya OK / no portar

Favoritos, Comprar ahora, `/acerca`, `/ayuda`, footer, ojito auth, Excel masivo, `/vendor/.../plan`, datos quemados de `data.js`.

---

## Checklist

- [x] Restaurar logos + banner + `AGENTS.md` + `LEGACY.md`
- [x] `README.md` apunta a `apps/web`
- [ ] UI vacía reseñas en producto
- [ ] Badge reputación (empty)
- [x] Alta tienda: Provincia + Departamento (+ tel. máx. 3)
- [x] Signup `#signup` → `/registro` (tel + domicilio + mapa soft)
- [ ] Panel comerciante vs `#merchant-panel` (sin chat)
- [ ] Checkout visual
- [ ] CSS responsive
- [ ] **No** chat / **no** reseñas API aún

## Comandos

```powershell
git status --short docs/diseno
git diff --stat HEAD -- docs/diseno
cd docs/diseno; node serve.js
```

Rutas útiles: `#marketplace` · `#checkout` · `#merchant-panel` · `#store` · `#profile` · `#cart` · `#login` · `#signup`.
