/* ============================================================
   COMPRALOCAL — CHECKOUT & ORDER CONFIRMATION (#checkout)
   ============================================================ */
(function () {
  const Pages = window.Pages || {};

  Pages.checkout = {
    layout: 'market',
    title: 'Finalizar Compra — CompraLocal',

    render() {
      const cart = window.Store?.state?.cart || [];
      const subtotalProducts = cart.reduce((acc, item) => acc + ((item.product?.price || item.price || 0) * (item.quantity || item.qty || 1)), 0);

      // Agrupación por tienda y cálculo de envío ($2.999 por tienda única)
      const storesMap = {};
      cart.forEach(item => {
        const prod = item.product || item;
        const storeId = prod.storeId || 'la-boutique';
        const storeObj = window.Data?.stores.find(s => s.id === storeId) || { name: 'Comercio local', location: 'San Juan' };
        if (!storesMap[storeId]) {
          storesMap[storeId] = {
            storeId: storeId,
            storeName: storeObj.name,
            items: []
          };
        }
        storesMap[storeId].items.push({
          product: prod,
          quantity: item.quantity || item.qty || 1
        });
      });

      const storeGroups = Object.values(storesMap);
      const totalCount = cart.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0);
      const totalShipping = storeGroups.length * 2999;
      const orderTotal = subtotalProducts + totalShipping;

      if (totalCount === 0) {
        return `
          <div class="page-wrapper page-enter" style="padding-top: 40px; padding-bottom: 60px;">
            <div class="market-container" style="max-width: 600px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 48px 20px;">
              <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px; color: var(--text);">No tenés productos para comprar</h2>
              <p style="color: var(--muted); font-size: 14px; margin-bottom: 24px;">Agregá productos de tus comercios locales favoritos antes de pasar por el checkout.</p>
              <a href="#stores" class="btn primary" style="text-decoration: none; padding: 10px 20px;">Explorar tiendas locales</a>
            </div>
          </div>
        `;
      }

      const currentUser = window.Store?.state?.user || { name: 'María González', phone: '+54 264 421-9876', email: 'maria@email.com', address: 'Calle Aberastain 456 Sur' };

      return `
        <div class="page-wrapper page-enter" style="padding-top: 24px; padding-bottom: 60px;">
          <div class="market-container">
            <!-- Breadcrumb -->
            <nav class="breadcrumb" aria-label="Navegación de migas" style="margin-bottom: var(--space-4); display: flex; align-items: center; gap: 8px; font-size: 13px;">
              <a href="#marketplace" style="color: var(--primary); text-decoration: none;">Inicio</a>
              <span style="color: var(--muted);" aria-hidden="true">›</span>
              <a href="#cart" style="color: var(--text-secondary); text-decoration: none;">Carrito</a>
              <span style="color: var(--muted);" aria-hidden="true">›</span>
              <span style="color: var(--muted); font-weight: 600;" aria-current="page">Finalizar Compra</span>
            </nav>

            <!-- Page Header -->
            <div class="section-header" style="margin-bottom: 24px;">
              <h1 style="font-size: 24px; font-weight: 800; color: var(--text);">
                Finalizar Compra
              </h1>
              <p style="color: var(--muted); font-size: 13px; margin-top: 4px;">
                Completá tus datos de entrega en San Juan y elegí cómo abonar.
              </p>
            </div>

            <!-- Simulation Warning Banner -->
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 12px;">
              <span style="font-size: 1.4rem;">ℹ️</span>
              <div>
                <div style="font-weight: 800; color: #c2410c; font-size: 13px; margin-bottom: 2px;">
                  Modo Demostración — CompraLocal San Juan
                </div>
                <div style="font-size: 12px; color: #9a3412; line-height: 1.4;">
                  Esta es una simulación de checkout frontend. No se realizarán cargos monetarios reales ni se solicitan datos confidenciales de tarjetas.
                </div>
              </div>
            </div>

            <form id="checkout-form" onsubmit="CheckoutPage.handleSubmit(event)">
              <div style="display: grid; grid-template-columns: 1fr 380px; gap: 32px; align-items: start;">
                
                <!-- Left: Forms -->
                <div style="display: flex; flex-direction: column; gap: 24px;">
                  
                  <!-- 1. Contact Info -->
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                    <h2 style="font-size: 16px; font-weight: 800; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                      <span>👤</span> 1. Datos de Contacto
                    </h2>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                      <div>
                        <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 6px;" for="checkout-name">Nombre y Apellido *</label>
                        <input type="text" id="checkout-name" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);" required value="${window.Utils.sanitize(currentUser.name || '')}" placeholder="Ej: María González" />
                      </div>
                      <div>
                        <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 6px;" for="checkout-phone">Teléfono / WhatsApp *</label>
                        <input type="tel" id="checkout-phone" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);" required value="${window.Utils.sanitize(currentUser.phone || '')}" placeholder="Ej: +54 264 421-9876" />
                      </div>
                    </div>
                    <div style="margin-top: 16px;">
                      <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 6px;" for="checkout-email">Correo Electrónico *</label>
                      <input type="email" id="checkout-email" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);" required value="${window.Utils.sanitize(currentUser.email || '')}" placeholder="tu@email.com" />
                    </div>
                  </div>

                  <!-- 2. Delivery Options -->
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                    <h2 style="font-size: 16px; font-weight: 800; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                      <span>📍</span> 2. Modalidad de Entrega en San Juan
                    </h2>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                      <label id="option-delivery" style="cursor: pointer; border: 2px solid var(--primary); border-radius: 8px; padding: 12px; background: #f0fdf4; display: flex; align-items: center; gap: 10px;" onclick="CheckoutPage.selectDeliveryMode('delivery')">
                        <input type="radio" name="delivery-mode" value="delivery" checked style="accent-color: var(--primary);" />
                        <div>
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">🚚 Envío a Domicilio</div>
                          <div style="font-size: 11px; color: var(--muted);">Directo a tu casa en San Juan ($2.999/tienda)</div>
                        </div>
                      </label>

                      <label id="option-pickup" style="cursor: pointer; border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--bg); display: flex; align-items: center; gap: 10px;" onclick="CheckoutPage.selectDeliveryMode('pickup')">
                        <input type="radio" name="delivery-mode" value="pickup" style="accent-color: var(--primary);" />
                        <div>
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">🏪 Retiro en Tienda</div>
                          <div style="font-size: 11px; color: var(--muted);">Sin costo de envío</div>
                        </div>
                      </label>
                    </div>

                    <!-- Delivery Address Fields -->
                    <div id="delivery-fields">
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 6px;" for="checkout-address">Calle y Número *</label>
                          <input type="text" id="checkout-address" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);" value="${window.Utils.sanitize(currentUser.address || '')}" placeholder="Ej: Calle Aberastain 456" />
                        </div>
                        <div>
                          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 6px;" for="checkout-department">Departamento / Zona *</label>
                          <select id="checkout-department" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text);">
                            <option value="Capital">Capital, San Juan</option>
                            <option value="Rivadavia">Rivadavia, San Juan</option>
                            <option value="Rawson">Rawson, San Juan</option>
                            <option value="Chimbas">Chimbas, San Juan</option>
                            <option value="Santa Lucía">Santa Lucía, San Juan</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <!-- Pickup Notice -->
                    <div id="pickup-fields" style="display: none; padding: 12px; background: var(--bg); border-radius: 8px; border: 1px solid var(--border); font-size: 12px; color: var(--muted);">
                      <strong>Puntos de retiro en San Juan:</strong> Coordinado de forma directa con cada comercio participante una vez confirmado el pedido.
                    </div>
                  </div>

                  <!-- 3. Payment Method -->
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                    <h2 style="font-size: 16px; font-weight: 800; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                      <span>💳</span> 3. Forma de Pago (Demostración)
                    </h2>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                      <label id="pay-mp" style="cursor: pointer; border: 2px solid var(--primary); border-radius: 8px; padding: 12px; background: #f0fdf4; display: flex; align-items: center; gap: 12px;" onclick="CheckoutPage.selectPayment('mp')">
                        <input type="radio" name="payment-method" checked style="accent-color: var(--primary);" />
                        <span style="font-size: 1.2rem;">💙</span>
                        <div>
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">Mercado Pago (Simulado)</div>
                          <div style="font-size: 11px; color: var(--muted);">Dinero en cuenta, tarjeta de débito o crédito</div>
                        </div>
                      </label>

                      <label id="pay-transf" style="cursor: pointer; border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--bg); display: flex; align-items: center; gap: 12px;" onclick="CheckoutPage.selectPayment('transf')">
                        <input type="radio" name="payment-method" style="accent-color: var(--primary);" />
                        <span style="font-size: 1.2rem;">🏦</span>
                        <div>
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">Transferencia Bancaria</div>
                          <div style="font-size: 11px; color: var(--muted);">Alias / CBU directo del comercio en San Juan</div>
                        </div>
                      </label>

                      <label id="pay-cash" style="cursor: pointer; border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--bg); display: flex; align-items: center; gap: 12px;" onclick="CheckoutPage.selectPayment('cash')">
                        <input type="radio" name="payment-method" style="accent-color: var(--primary);" />
                        <span style="font-size: 1.2rem;">💵</span>
                        <div>
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">Efectivo contra entrega</div>
                          <div style="font-size: 11px; color: var(--muted);">Abonás al recibir en tu domicilio</div>
                        </div>
                      </label>
                    </div>
                  </div>

                </div>

                <!-- Right: Order Summary Sidebar -->
                <div>
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; position: sticky; top: 90px; display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-size: 18px; font-weight: 800; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                      Resumen de tu Pedido
                    </h3>

                    <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
                      ${storeGroups.map(g => `
                        <div style="font-size: 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">
                          <strong style="color: var(--primary);">🏪 ${window.Utils.esc(g.storeName)}</strong>${g.items.map(i => `
                            <div style="display: flex; justify-content: space-between; color: var(--muted); margin-top: 2px;">
                              <span>${i.quantity}x ${window.Utils.esc(i.product.name)}</span>
                              <span>${window.Utils.money(i.product.price * i.quantity)}</span>
                            </div>
                          `).join('')}
                        </div>
                      `).join('')}
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 14px; color: var(--muted);">
                      <span>Subtotal productos</span>
                      <span style="color: var(--text); font-weight: 600;">${window.Utils.money(subtotalProducts)}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 14px; color: var(--muted);">
                      <span>Envíos locales (${storeGroups.length} ${storeGroups.length === 1 ? 'tienda' : 'tiendas'})</span>
                      <span id="checkout-shipping-val" style="color: var(--text); font-weight: 600;">${window.Utils.money(totalShipping)}</span>
                    </div>

                    <div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; color: var(--text);">
                      <span>Total a abonar</span>
                      <span id="checkout-total-val" style="color: var(--primary);">${window.Utils.money(orderTotal)}</span>
                    </div>

                    <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
                      <button type="submit" class="btn primary" style="width: 100%; height: 44px; font-weight: 800; border-radius: 8px;">
                        ✓ Confirmar Compra
                      </button>
                      <a href="#cart" class="btn secondary" style="text-align: center; width: 100%; height: 38px; font-size: 13px; font-weight: 700; border-radius: 8px; text-decoration: none; display: grid; place-items: center;">
                        ← Volver al carrito
                      </a>
                    </div>

                    <div style="font-size: 11px; color: var(--muted); text-align: center;">
                      🔒 Operación segura · CompraLocal San Juan
                    </div>

                  </div>
                </div>

              </div>
            </form>
          </div>
        </div>
      `;
    },
  };

  // Controlador de acciones y eventos del Checkout
  window.CheckoutPage = {
    currentMode: 'delivery',
    selectedPaymentMethod: 'Mercado Pago (Simulado)',

    selectDeliveryMode(mode) {
      this.currentMode = mode;
      const delFields = document.getElementById('delivery-fields');
      const pickFields = document.getElementById('pickup-fields');
      const optDel = document.getElementById('option-delivery');
      const optPick = document.getElementById('option-pickup');
      const shippingVal = document.getElementById('checkout-shipping-val');
      const totalVal = document.getElementById('checkout-total-val');

      const cart = window.Store?.state?.cart || [];
      const subtotalProducts = cart.reduce((acc, item) => acc + ((item.product?.price || item.price || 0) * (item.quantity || item.qty || 1)), 0);
      
      const storesMap = {};
      cart.forEach(item => {
        const prod = item.product || item;
        storesMap[prod.storeId || 'la-boutique'] = true;
      });
      const totalShipping = Object.keys(storesMap).length * 2999;

      if (mode === 'delivery') {
        if (delFields) delFields.style.display = 'block';
        if (pickFields) pickFields.style.display = 'none';
        if (optDel) { optDel.style.border = '2px solid var(--primary)'; optDel.style.background = '#f0fdf4'; }
        if (optPick) { optPick.style.border = '1px solid var(--border)'; optPick.style.background = 'var(--bg)'; }
        if (shippingVal) shippingVal.textContent = window.Utils.money(totalShipping);
        if (totalVal) totalVal.textContent = window.Utils.money(subtotalProducts + totalShipping);
      } else {
        if (delFields) delFields.style.display = 'none';
        if (pickFields) pickFields.style.display = 'block';
        if (optDel) { optDel.style.border = '1px solid var(--border)'; optDel.style.background = 'var(--bg)'; }
        if (optPick) { optPick.style.border = '2px solid var(--primary)'; optPick.style.background = '#f0fdf4'; }
        if (shippingVal) shippingVal.textContent = window.Utils.money(0);
        if (totalVal) totalVal.textContent = window.Utils.money(subtotalProducts);
      }
    },

    selectPayment(type) {
      const pMap = {
        mp: 'Mercado Pago (Simulado)',
        transf: 'Transferencia Bancaria (Alias / CBU)',
        cash: 'Efectivo contra entrega'
      };
      this.selectedPaymentMethod = pMap[type];
      ['mp', 'transf', 'cash'].forEach(id => {
        const el = document.getElementById(`pay-${id}`);
        if (el) {
          const match = (id === type);
          el.style.border = match ? '2px solid var(--primary)' : '1px solid var(--border)';
          el.style.background = match ? '#f0fdf4' : 'var(--bg)';
        }
      });
    },

    handleSubmit(e) {
      e.preventDefault();

      const cart = window.Store?.state?.cart || [];
      if (cart.length === 0) {
        alert('El carrito está vacío.');
        return;
      }

      const subtotalProducts = cart.reduce((acc, item) => acc + ((item.product?.price || item.price || 0) * (item.quantity || item.qty || 1)), 0);
      const storesMap = {};
      cart.forEach(item => {
        const prod = item.product || item;
        storesMap[prod.storeId || 'la-boutique'] = true;
      });
      const totalShipping = Object.keys(storesMap).length * 2999;
      const shippingCost = this.currentMode === 'delivery' ? totalShipping : 0;
      const finalTotal = subtotalProducts + shippingCost;
      const orderId = `CL-SJ-${Math.floor(10000 + Math.random() * 90000)}`;

      const newOrder = {
        id: orderId,
        date: new Date().toISOString(),
        total: finalTotal,
        subtotal: subtotalProducts,
        shippingCost: shippingCost,
        deliveryType: this.currentMode === 'delivery' ? 'Envío a domicilio' : 'Retiro en sucursal',
        paymentMethod: this.selectedPaymentMethod,
        storeCount: Object.keys(storesMap).length
      };

      // Vaciamos el carrito y actualizamos contador
      window.Store.set({ cart: [], cartCount: 0 });

      alert(`¡Pedido ${orderId} confirmado con éxito! Total abonado: ${window.Utils.money(finalTotal)}`);
      window.Router.go('marketplace');
    }
  };
})();