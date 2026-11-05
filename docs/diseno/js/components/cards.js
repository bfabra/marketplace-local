/* ============================================================
   COMPRALOCAL — TARJETAS Y ESTADOS VACÍOS (CORREGIDO)
   ============================================================ */
(function () {
  const { esc, money } = window.Utils;

  window.Cards = {
    store(store, { compact = false } = {}) {
      const saved = !!window.Store?.state?.saved?.[store.id];
      const activeColor = 'var(--primary, #fd6910)';
      const defaultColor = '#64748b';

      return `
        <article class="market-store-card${compact ? ' compact' : ''}" data-action="open-store" data-id="${store.id}" style="cursor: pointer; transition: transform 0.25s ease, box-shadow 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
          <div class="market-store-image" style="position: relative; overflow: hidden; border-radius: 8px;">
            <img src="${esc(store.image)}" alt="Interior de ${esc(store.name)}" loading="lazy" style="transition: transform 0.3s ease; width: 100%; height: 100%; object-fit: cover;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" />
            ${store.isNew ? '<span>NUEVO</span>' : ''}
            <button type="button" class="${saved ? 'saved' : ''}" data-action="toggle-save" data-id="${store.id}"
              aria-pressed="${saved}" aria-label="${saved ? 'Quitar de guardados' : 'Guardar'} ${esc(store.name)}" onclick="event.stopPropagation();" style="position: absolute; top: 8px; right: 8px; background: #fff; border: 1px solid var(--border, #cbd5e1); width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: ${saved ? activeColor : defaultColor}; z-index: 5; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <span style="display: flex; align-items: center; justify-content: center; ${saved ? 'color: ' + activeColor + ';' : ''}">
                ${window.Icon('heart', 15)}
              </span>
            </button>
          </div>
          <div class="market-store-copy">
            <small>${esc(store.category)}</small>
            <h3>${esc(store.name)}</h3>
            <p>${window.Icon('location', 13)} ${esc(store.location)}</p>
            <button data-action="open-store" data-id="${store.id}">Ver tienda ${window.Icon('arrow', 14)}</button>
          </div>
        </article>`;
    },

    product(product) {
      const s = window.Store?.state || {};
      const favoriteProducts = s.favoriteProducts || [];
      const saved = favoriteProducts.includes(product.id);
      const activeColor = 'var(--primary, #fd6910)';
      const defaultColor = '#64748b';

      return `
        <article class="market-product-card" data-action="open-product" data-id="${product.id}" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; transition: transform 0.25s ease, box-shadow 0.25s ease;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
          <div style="position: relative; width: 100%; overflow: hidden; border-radius: 8px;">
            <div style="width: 100%; height: 160px; background: #f1f5f9; border-radius: 8px; overflow: hidden;">
              <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" />
            </div>
            <button type="button" class="${saved ? 'saved' : ''}" data-action="toggle-product-save" data-id="${product.id}"
              aria-pressed="${saved}" aria-label="${saved ? 'Quitar de favoritos' : 'Agregar a favoritos'} ${esc(product.name)}" onclick="event.stopPropagation();" style="position: absolute; top: 8px; right: 8px; background: #fff; border: 1px solid var(--border, #cbd5e1); width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: ${saved ? activeColor : defaultColor}; z-index: 5; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <span style="display: flex; align-items: center; justify-content: center; ${saved ? 'color: ' + activeColor + '; fill: ' + activeColor + ';' : ''}">
                ${window.Icon('heart', 15)}
              </span>
            </button>
          </div>
          <small style="font-size: 11px; color: var(--muted);">${esc(product.category)}</small>
          <h3 style="font-size: 14px; font-weight: 700; color: var(--text); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(product.name)}</h3>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 4px;">
            <strong style="font-size: 16px; font-weight: 800; color: var(--primary);">${money(product.price)}</strong>
          </div>
        </article>`;
    },

    empty(title, copy, clearAction) {
      return `
        <div class="market-empty">
          <i>${window.Icon('search', 28)}</i>
          <h2>${esc(title)}</h2>
          <p>${copy}</p>
          ${clearAction ? `<button data-action="${clearAction}">Limpiar filtros</button>` : ''}
        </div>`;
    },
  };
})();