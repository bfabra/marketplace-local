/* ============================================================
   COMPRALOCAL — MINI CARRITO Y MODAL DE PRODUCTO
   ============================================================ */
(function () {
  const { esc, money } = window.Utils;

  const Modals = {
    /* ─── Renderizado inicial del mini carrito ─── */
    renderCart() {
      const root = document.getElementById('cart-root');
      if (!root) return;
      const s = window.Store.state;
      
      if (!s.cartOpen) {
        root.innerHTML = '';
        return;
      }

      // Si ya existe el mini-cart renderizado, solo actualizamos sus datos para evitar pestañeo
      if (root.querySelector('.mini-cart')) {
        this.updateCartDOM();
        return;
      }

      const cartItems = s.cart || [];
      const totalCount = cartItems.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0);
      const subtotalProducts = cartItems.reduce((acc, item) => {
        const prod = item.product || item;
        const qty = item.quantity || item.qty || 1;
        return acc + (prod.price * qty);
      }, 0);

      root.innerHTML = `
        <aside class="mini-cart" role="dialog" aria-label="Tu carrito" style="position: fixed; right: 20px; top: 75px; background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 20px; width: 340px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 9999;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border, #e2e8f0); padding-bottom: 8px;">
            <strong class="cart-total-title" style="font-size: 16px; font-weight: 800; color: var(--text, #0f172a);">Tu carrito (${totalCount})</strong>
            <button type="button" data-action="close-cart" aria-label="Cerrar carrito" style="background: none; border: none; font-size: 18px; cursor: pointer; color: var(--muted, #64748b);">✕</button>
          </div>

          ${cartItems.length === 0 ? `
            <div class="cart-empty-msg" style="text-align: center; padding: 20px 0; color: var(--muted, #64748b); font-size: 13px;">
              Tu carrito está vacío.
            </div>
          ` : `
            <div class="cart-items-container" style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; padding-right: 4px;">
              ${cartItems.map(item => {
                const prod = item.product || item;
                const qty = item.quantity || item.qty || 1;
                const itemKey = item.key || prod.id;
                return `
                  <div class="cart-item-row" data-key="${itemKey}" style="display: flex; align-items: center; gap: 10px; font-size: 12px; border-bottom: 1px dashed var(--border, #e2e8f0); padding-bottom: 8px;">
                    <img src="${esc(prod.image)}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border, #e2e8f0);" />
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-weight: 700; color: var(--text, #0f172a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(prod.name)}</div>
                      <div style="color: var(--muted, #64748b); margin-top: 2px;">${money(prod.price)} c/u</div>
                      <!-- Controles de cantidad con data-key y data-action -->
                      <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px;">
                        <button type="button" data-action="cart-decrease" data-key="${itemKey}" style="background: var(--bg, #f1f5f9); border: 1px solid var(--border, #cbd5e1); border-radius: 4px; width: 22px; height: 22px; font-weight: bold; cursor: pointer; display: grid; place-items: center;">-</button>
                        <span class="cart-item-qty" style="font-weight: 700; min-width: 16px; text-align: center;">${qty}</span>
                        <button type="button" data-action="cart-increase" data-key="${itemKey}" style="background: var(--bg, #f1f5f9); border: 1px solid var(--border, #cbd5e1); border-radius: 4px; width: 22px; height: 22px; font-weight: bold; cursor: pointer; display: grid; place-items: center;">+</button>
                        <button type="button" data-action="cart-remove-item" data-key="${itemKey}" style="background: none; border: none; color: #dc2626; font-size: 11px; cursor: pointer; margin-left: auto; text-decoration: underline;">Eliminar</button>
                      </div>
                    </div>
                    <div class="cart-item-subtotal" style="font-weight: 800; color: var(--text, #0f172a); align-self: flex-start;">
                      ${money(prod.price * qty)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div style="border-top: 1px solid var(--border, #e2e8f0); padding-top: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 800;">
              <span>Subtotal productos:</span>
              <span class="cart-subtotal-val" style="color: var(--primary, #fd6910);">${money(subtotalProducts)}</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button type="button" onclick="window.Store.set({cartOpen: false}); window.location.hash = 'cart';" style="text-align: center; background: var(--primary, #fd6910); color: #fff; padding: 10px; border-radius: 8px; font-weight: 800; border: none; cursor: pointer; font-size: 13px; width: 100%;">
                Ver carrito completo y pagar
              </button>
              <button type="button" data-action="cart-explore" style="text-align: center; width: 100%; padding: 8px; border-radius: 8px; font-size: 12px; cursor: pointer; background: var(--bg, #f1f5f9); border: 1px solid var(--border, #cbd5e1); font-weight: 700; color: var(--text, #0f172a);">
                Seguir explorando
              </button>
            </div>
          `}
        </aside>
      `;
    },

    /* ─── Actualización fluida sin recrear el DOM (elimina el parpadeo) ─── */
    updateCartDOM() {
      const root = document.getElementById('cart-root');
      if (!root) return;
      const s = window.Store.state;

      if (!s.cartOpen) {
        root.innerHTML = '';
        return;
      }

      // Si el panel no existía, lo renderizamos completo por primera vez
      if (!root.querySelector('.mini-cart')) {
        this.renderCart();
        return;
      }

      const cartItems = s.cart || [];
      const totalCount = cartItems.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0);
      const subtotalProducts = cartItems.reduce((acc, item) => {
        const prod = item.product || item;
        const qty = item.quantity || item.qty || 1;
        return acc + (prod.price * qty);
      }, 0);

      // Actualizar título general con cantidad total
      const titleEl = root.querySelector('.cart-total-title');
      if (titleEl) titleEl.textContent = `Tu carrito (${totalCount})`;

      // Actualizar subtotal general
      const subtotalEl = root.querySelector('.cart-subtotal-val');
      if (subtotalEl) subtotalEl.textContent = money(subtotalProducts);

      const container = root.querySelector('.cart-items-container');
      if (!container) {
        // Si se vació completamente, re-renderizamos para mostrar el mensaje de vacío
        this.renderCart();
        return;
      }

      // Si el carrito está vacío ahora
      if (cartItems.length === 0) {
        this.renderCart();
        return;
      }

      // Actualizar o reconstruir únicamente la lista interna de productos de forma optimizada
      container.innerHTML = cartItems.map(item => {
        const prod = item.product || item;
        const qty = item.quantity || item.qty || 1;
        const itemKey = item.key || prod.id;
        return `
          <div class="cart-item-row" data-key="${itemKey}" style="display: flex; align-items: center; gap: 10px; font-size: 12px; border-bottom: 1px dashed var(--border, #e2e8f0); padding-bottom: 8px;">
            <img src="${esc(prod.image)}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border, #e2e8f0);" />
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 700; color: var(--text, #0f172a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(prod.name)}</div>
              <div style="color: var(--muted, #64748b); margin-top: 2px;">${money(prod.price)} c/u</div>
              <!-- Controles de cantidad -->
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px;">
                <button type="button" data-action="cart-decrease" data-key="${itemKey}" style="background: var(--bg, #f1f5f9); border: 1px solid var(--border, #cbd5e1); border-radius: 4px; width: 22px; height: 22px; font-weight: bold; cursor: pointer; display: grid; place-items: center;">-</button>
                <span class="cart-item-qty" style="font-weight: 700; min-width: 16px; text-align: center;">${qty}</span>
                <button type="button" data-action="cart-increase" data-key="${itemKey}" style="background: var(--bg, #f1f5f9); border: 1px solid var(--border, #cbd5e1); border-radius: 4px; width: 22px; height: 22px; font-weight: bold; cursor: pointer; display: grid; place-items: center;">+</button>
                <button type="button" data-action="cart-remove-item" data-key="${itemKey}" style="background: none; border: none; color: #dc2626; font-size: 11px; cursor: pointer; margin-left: auto; text-decoration: underline;">Eliminar</button>
              </div>
            </div>
            <div class="cart-item-subtotal" style="font-weight: 800; color: var(--text, #0f172a); align-self: flex-start;">
              ${money(prod.price * qty)}
            </div>
          </div>
        `;
      }).join('');
    },

    updateCartCount() {
      const el = document.getElementById('cart-count');
      if (el) el.textContent = window.Store.state.cartCount;
    },

    renderProduct() {},
  };

  window.Modals = Modals;
})();