/* ============================================================
   COMPRALOCAL — PÁGINA DE CARRITO COMPLETO (#cart)
   ============================================================ */
(function () {
  const Pages = window.Pages || {};
  const { esc, money } = window.Utils;

  Pages.cart = {
    layout: 'market',
    title: 'Carrito de Compras — Tu Comercio Local',

    render() {
      const s = window.Store.state;
      const cartItems = s.cart || [];
      const storesInCart = window.CartManager ? window.CartManager.getItemsByStore() : [];

      if (cartItems.length === 0) {
        return `
          <div class="page-wrapper page-enter" style="padding: 40px 20px 80px; max-width: 800px; margin: 0 auto; text-align: center; box-sizing: border-box;">
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
              <h1 style="font-size: 24px; font-weight: 800; color: var(--text); margin: 0;">Tu carrito está vacío</h1>
              <p style="color: var(--muted); font-size: 14px; max-width: 400px; margin: 0;">Explorá los comercios de San Juan, descubrí ofertas imperdibles y armá tu pedido con envío unificado.</p>
              <a href="#marketplace" class="btn primary" style="padding: 12px 24px; font-weight: 800; text-decoration: none; margin-top: 10px; display: inline-block;">
                Explorar marketplace
              </a>
            </div>
          </div>
        `;
      }

      // Cálculos totales
      const productsSubtotal = cartItems.reduce((acc, item) => {
        const prod = item.product || item;
        const qty = item.quantity || item.qty || 1;
        return acc + (prod.price * qty);
      }, 0);

      const totalStoresCount = storesInCart.length;
      const totalShipping = totalStoresCount * 2999;
      const grandTotal = productsSubtotal + totalShipping;

      return `
        <div class="page-wrapper page-enter" style="padding: 32px 16px 80px; max-width: 1100px; margin: 0 auto; box-sizing: border-box;">
          <h1 style="font-size: 26px; font-weight: 900; color: var(--text); margin-bottom: 24px;">Carrito de Compras</h1>

          <div class="cart-layout-grid" style="display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start;">
            
            <!-- Columna Izquierda: Listado por Comercio -->
            <div style="display: flex; flex-direction: column; gap: 20px; min-width: 0;">
              ${storesInCart.map(storeGroup => `
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); box-sizing: border-box;">
                  
                  <!-- Cabecera de la Tienda -->
                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 14px; gap: 8px;">
                    <div style="min-width: 0;">
                      <span style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase;">Comercio local</span>
                      <h3 style="font-size: 15px; font-weight: 800; color: var(--text); margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(storeGroup.storeName)}</h3>
                    </div>
                    <span style="font-size: 11px; font-weight: 700; background: #f0fdf4; color: #15803d; padding: 4px 8px; border-radius: 6px; white-space: nowrap;">
                      Envío: ${money(storeGroup.deliveryCost)}
                    </span>
                  </div>

                  <!-- Lista de Productos de este comercio -->
                  <div style="display: flex; flex-direction: column; gap: 14px;">
                    ${storeGroup.items.map(item => {
                      const prod = item.product || item;
                      const qty = item.quantity || item.qty || 1;
                      const uniqueKey = prod.id;
                      return `
                        <div class="cart-item-row" style="display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px dashed var(--border);">
                          <img src="${esc(prod.image)}" alt="${esc(prod.name)}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); flex-shrink: 0;" />
                          
                          <div style="flex: 1; min-width: 0;">
                            <h4 style="font-size: 13px; font-weight: 700; color: var(--text); margin: 0 0 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(prod.name)}</h4>
                            <div style="font-size: 12px; color: var(--muted);">${money(prod.price)} c/u</div>
                          </div>

                          <!-- Controles y Subtotal (Agrupados para adaptarse en móvil) -->
                          <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 2px;">
                              <button type="button" data-action="decrease-qty" data-id="${uniqueKey}" style="background: none; border: none; width: 22px; height: 22px; font-weight: 800; cursor: pointer; display: grid; place-items: center; color: var(--text);">-</button>
                              <span style="font-size: 12px; font-weight: 800; min-width: 16px; text-align: center;">${qty}</span>
                              <button type="button" data-action="increase-qty" data-id="${uniqueKey}" style="background: none; border: none; width: 22px; height: 22px; font-weight: 800; cursor: pointer; display: grid; place-items: center; color: var(--text);">+</button>
                            </div>

                            <div style="font-size: 14px; font-weight: 800; color: var(--text); min-width: 75px; text-align: right;">
                              ${money(prod.price * qty)}
                            </div>

                            <button type="button" data-action="remove-item" data-id="${uniqueKey}" title="Eliminar producto" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 16px; padding: 2px; font-weight: 900;">
                              &times;
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>

                  <div style="margin-top: 10px; font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 6px;">
                    <span>⏱️ Tiempo estimado de entrega: ${storeGroup.deliveryTime}</span>
                  </div>

                </div>
              `).join('')}
            </div>

            <!-- Columna Derecha: Resumen de Compra y Checkout -->
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; position: sticky; top: 90px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box;">
              <h3 style="font-size: 16px; font-weight: 800; color: var(--text); margin: 0; border-bottom: 1px solid var(--border); padding-bottom: 10px;">Resumen del pedido</h3>

              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                <div style="display: flex; justify-content: space-between; gap: 10px;">
                  <span>Subtotal productos (${cartItems.reduce((a, b) => a + (b.quantity || b.qty || 1), 0)} ítems):</span>
                  <span style="font-weight: 700; color: var(--text); white-space: nowrap;">${money(productsSubtotal)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 10px;">
                  <span>Envío unificado (${totalStoresCount} ${totalStoresCount === 1 ? 'comercio' : 'comercios'}):</span>
                  <span style="font-weight: 700; color: var(--text); white-space: nowrap;">${money(totalShipping)}</span>
                </div>
              </div>

              <div style="border-top: 1px solid var(--border); padding-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <span style="font-size: 15px; font-weight: 800; color: var(--text);">Total a pagar:</span>
                <span style="font-size: 20px; font-weight: 900; color: var(--primary); white-space: nowrap;">${money(grandTotal)}</span>
              </div>

              <!-- Botón Finalizar Compra con Validación de Sesión -->
              <button type="button" data-action="proceed-checkout" class="btn primary" style="width: 100%; height: 46px; font-size: 14px; font-weight: 800; cursor: pointer; border-radius: 10px; margin-top: 6px;">
                Finalizar compra
              </button>

              <div style="background: var(--bg); border-radius: 8px; padding: 10px; font-size: 11px; color: var(--muted); line-height: 1.4;">
                🔒 Compra protegida. Al finalizar, coordinaremos la entrega a domicilio en San Juan.
              </div>
            </div>

          </div>
        </div>
      `;
    },
  };

  /* ── Acciones interactivas del Carrito Completo ── */
  window.Actions = window.Actions || {};

  window.Actions['increase-qty'] = (el) => {
    const id = el.dataset.id;
    const cart = window.Store.state.cart || [];
    const item = cart.find(i => (i.product?.id === id || i.id === id || i.key === id));
    if (item) {
      const currentQty = item.quantity || item.qty || 1;
      window.CartManager.updateQuantity(id, currentQty + 1);
      if (typeof window.App?.render === 'function') {
        window.App.render();
      }
    }
  };

  window.Actions['decrease-qty'] = (el) => {
    const id = el.dataset.id;
    const cart = window.Store.state.cart || [];
    const item = cart.find(i => (i.product?.id === id || i.id === id || i.key === id));
    if (item) {
      const currentQty = item.quantity || item.qty || 1;
      window.CartManager.updateQuantity(id, currentQty - 1);
      if (typeof window.App?.render === 'function') {
        window.App.render();
      }
    }
  };

  window.Actions['remove-item'] = (el) => {
    const id = el.dataset.id;
    if (window.CartManager) {
      window.CartManager.remove(id);
      if (typeof window.App?.render === 'function') {
        window.App.render();
      }
    }
  };

  /* ── Validación de Autenticación para Finalizar Compra ── */
  window.Actions['proceed-checkout'] = () => {
    const user = window.Store.state.user;
    
    if (!user) {
      window.Store.set({ returnTo: 'cart' });
      alert('Para finalizar tu compra, por favor iniciá sesión o registrate en la plataforma.');
      window.location.hash = 'login';
    } else {
      window.location.hash = 'checkout';
    }
  };
})();