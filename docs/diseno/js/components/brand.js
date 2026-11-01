/* ============================================================
   COMPRALOCAL — LOGOS OFICIALES
   Solo se usan los SVG originales de public/brand/logos/ (AGENTS.md §4).
   Nunca se redibuja ni se simula el logo con texto.
   ============================================================ */
(function () {
  const BASE = 'public/brand/logos/';

  const FILES = {
    symbol: 'Logo.svg',                      // isotipo color (fondos claros)
    horizontal: 'Logo_h.svg',                // horizontal color (fondos claros)
    stacked: 'Logo_nombre.svg',              // apilado color (carga / splash)
    horizontalWhite: 'Negativo_logo_h_w.svg', // horizontal blanco (fondos azules)
    symbolWhite: 'Negativo_iso_w.svg',                 // isotipo blanco (fondos azules)
  };

  window.Brand = {
    src(variant) { return BASE + FILES[variant]; },
    img(variant, { alt = 'CompraLocal', cls = '', style = '' } = {}) {
      return `<img src="${BASE + FILES[variant]}" alt="${alt}"${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''} />`;
    },
  };
})();
