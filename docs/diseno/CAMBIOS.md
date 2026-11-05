# Cambios de maqueta (nov 2026) · inventario vs app

Comparación de `docs/diseno` (working tree) contra la app `apps/web` **antes del despliegue**.

## Fuente de verdad de marca (no negociable)

| Token | Valor vigente |
|-------|----------------|
| Tipografía | **Manrope** (`css/tokens.css`) |
| Primario | **`#09305f`** |
| Acento | **`#fd6910`** |

> El `AGENTS.md` de la maqueta llegó con texto erróneo (verde `#1c4f4f` + Inter/Jakarta). Se **restauró** al HEAD alineado con `tokens.css` y el `AGENTS.md` de la raíz. **No** migrar la app a verde/Inter.

## Qué cambió en la maqueta

| Área | Cambio en maqueta | Estado en app | Acción pre-despliegue |
|------|-------------------|---------------|------------------------|
| Pie | Enlaces reales: Acerca (`#about`), Ayuda (`#help`), Contacto (modal), Términos (`#terms`), FAQ | Pie incompleto / mailto | **Alinear footer + páginas** |
| Páginas nuevas | `about.js`, `help.js`, `terms.js` | `/terminos`, `/privacidad`, `/preguntas` (sin `/acerca` ni `/ayuda`) | **Agregar `/acerca` y `/ayuda`** |
| Producto | Favorito junto al título; **Comprar ahora** navy + **Agregar** outline; relacionados por tienda/categoría | Modal con un CTA + favorito abajo | **Ajustar modal** |
| Tarjetas | Heart overlay en producto/tienda; hover lift | Producto sin heart en `MarketProductCard` | **Heart en tarjeta** |
| Tienda | Chat interno comprador↔comercio | No existe | **Diferir** (feature + API) |
| Panel comerciante | Inbox de chat demo | No existe | **Diferir** |
| Perfil | Localidades por departamento SJ | API ya trae localidades | OK / revisar UX luego |
| Home | Ajustes menores Icon/`window.Icon`, ofertas | Home ya portada | Bajo impacto |
| Banner | `public/images/banner.jpg` | Hero propio | Opcional luego |
| Auth stubs | Siguen en disco; vigentes = `auth.js` | OK vía LEGACY | Sin cambio |

## Fuera de alcance ahora (post-despliegue)

1. **Chat interno** tienda (modal + estado en merchant panel).
2. **Tickets de reclamo** del Centro de Ayuda (necesitan backend).
3. Copiar tarifas `$2.990` del `terms.js` demo → la app usa **un costo por dirección** (regla de negocio vigente).
4. Rediseño completo del home con el banner nuevo.

## Checklist pre-despliegue (esta pasada)

- [x] Restaurar `docs/diseno/AGENTS.md` (marca correcta)
- [x] Footer alineado a la maqueta
- [x] Página `/acerca`
- [x] Página `/ayuda` (atajos; sin tickets de API aún)
- [x] Heart en `MarketProductCard`
- [x] CTAs del modal de producto como en maqueta
