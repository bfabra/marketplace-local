/* ============================================================
   COMPRALOCAL — TARJETAS Y ESTADOS VACÍOS
   ============================================================ */
(function () {
  const { esc, money } = window.Utils;

  window.Cards = {
    store(store, { compact = false } = {}) {
      const saved = !!window.Store.state.saved[store.id];
      return `
        <article class="market-store-card${compact ? ' compact' : ''}" data-action="open-store" data-id="${store.id}" style="cursor: pointer;">
          <div class="market-store-image" style="position: relative;">
            <img src="${esc(store.image)}" alt="Interior de ${esc(store.name)}" loading="lazy" />
            ${store.isNew ? '<span>NUEVO</span>' : ''}
            <button class="${saved ? 'saved' : ''}" data-action="toggle-save" data-id="${store.id}"
              aria-pressed="${saved}" aria-label="${saved ? 'Quitar de guardados' : 'Guardar'} ${esc(store.name)}" onclick="event.stopPropagation();">${Icon('heart', 15)}</button>
          </div>
          <div class="market-store-copy">
            <small>${esc(store.category)}</small>
            <h3>${esc(store.name)}</h3>
            <p>${Icon('location', 13)} ${esc(store.location)}</p>
            <button data-action="open-store" data-id="${store.id}">Ver tienda ${Icon('arrow', 14)}</button>
          </div>
        </article>`;
    },

    product(product) {
      return `
        <article class="market-product-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <button class="product-image-button" data-action="open-product" data-id="${product.id}" aria-label="Ver detalle de ${esc(product.name)}" style="background: none; border: none; padding: 0; cursor: pointer; width: 100%;">
            <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px;" />
          </button>
          <small style="font-size: 11px; color: var(--muted);">${esc(product.category)}</small>
          <h3 style="font-size: 14px; font-weight: 700; color: var(--text); margin: 0;">${esc(product.name)}</h3>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 8px;">
            <strong style="font-size: 16px; font-weight: 800; color: var(--primary);">${money(product.price)}</strong>
            <button type="button" data-action="add-to-cart" data-id="${product.id}" class="btn primary" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; cursor: pointer; font-weight: 700;">
              + Agregar
            </button>
          </div>
        </article>`;
    },

    empty(title, copy, clearAction) {
      return `
        <div class="market-empty">
          <i>${Icon('search', 28)}</i>
          <h2>${esc(title)}</h2>
          <p>${copy}</p>
          ${clearAction ? `<button data-action="${clearAction}">Limpiar filtros</button>` : ''}
        </div>`;
    },
  };
})();