/* ============================================================
   COMPRALOCAL — HEADER DEL MARKETPLACE CON MENÚ DE CLIENTE Y COMERCIO
   ============================================================ */
(function () {
  const { esc } = window.Utils;

  window.Header = {
    render(page) {
      const s = window.Store.state;
      const user = s.user; 
      const on = (names) => (names.includes(page) ? 'active' : '');

      const cart = s.cart || [];
      const totalCount = cart.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0);
      const subtotalProducts = cart.reduce((acc, item) => acc + ((item.product?.price || item.price || 0) * (item.quantity || item.qty || 1)), 0);

      const isMerchant = user && (user.isMerchant || user.role === 'merchant');

      return `
      <header class="market-header clean-header">
        <div class="container header-inner" style="display: flex; justify-content: space-between; align-items: center; width: min(var(--container), calc(100% - 32px)); margin: 0 auto; height: 100%;">
          
          <!-- IZQUIERDA: Logo y Enlaces de navegación -->
          <div style="display: flex; align-items: center; gap: 20px;">
            <button class="market-logo" data-go="marketplace" aria-label="Ir al inicio" style="background:none; border:none; cursor:pointer; display:flex; align-items:center;">
              <img src="public/brand/logos/Logo.svg" alt="Logo" class="mobile-logo-svg" style="display: none; height: 34px; object-fit: contain;" />
              <span class="desktop-logo-brand">${Brand.img('horizontal')}</span>
            </button>

            <nav id="market-nav" aria-label="Principal" style="display: flex; gap: 20px; align-items: center;">
              <button class="${on(['stores', 'store'])}" data-go="stores" style="background:none; border:none; cursor:pointer; font-weight:700; font-size:15px; color:var(--text);">Tiendas</button>
              <button class="${on(['categories'])}" data-go="categories" style="background:none; border:none; cursor:pointer; font-weight:700; font-size:15px; color:var(--text);">Rubros</button>
            </nav>
          </div>

          <!-- DERECHA: Usuario y Carrito -->
          <div class="market-actions" style="display: flex; align-items: center; gap: 14px;">
            ${user ? `
              <!-- USUARIO AUTENTICADO -->
              <div class="user-dropdown-wrapper" style="position:relative;">
                <button type="button" class="btn-user-profile" data-action="toggle-user-menu" style="display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;font-weight:700;color:var(--primary);">
                  <div class="avatar-circle" style="width:34px;height:34px;border-radius:50%;background:${user.avatar ? 'none' : '#fd6910'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;overflow:hidden;">
                    ${user.avatar ? `<img src="${esc(user.avatar)}" style="width:100%;height:100%;object-fit:cover;" />` : (user.initials || 'CL')}
                  </div>
                  <span class="hide-mobile" style="font-size: 13px;">${esc(user.name ? user.name.split(' ')[0] : 'Mi Cuenta')}</span>
                </button>

                <!-- MENÚ FLOTANTE -->
                <div id="user-dropdown-menu" class="dropdown-menu-card ${s.userMenuOpen ? 'open' : ''}">
                  <div style="padding:0 16px 10px;border-bottom:1px solid #f1f5f9;">
                    <div style="font-weight:700;font-size:14px;color:#0f172a;">${esc(user.storeName || user.name)}</div>
                    <div style="font-size:11px;color:#64748b;">${esc(user.email)}</div>
                  </div>

                  ${isMerchant ? `
                    <div style="padding:6px 0;">
                      <button type="button" class="dropdown-item" data-action="go-merchant-tab" data-tab="profile" style="font-weight:700;color:var(--primary, #fd6910);">Perfil Comerciante</button>
                      <button type="button" class="dropdown-item" data-action="go-merchant-tab" data-tab="sales">Mis Ventas</button>
                      <button type="button" class="dropdown-item" data-action="go-merchant-tab" data-tab="products">Mis Productos</button>
                    </div>
                  ` : `
                    <div style="padding:6px 0;">
                      <button type="button" class="dropdown-item" data-go="profile" onclick="window.Store.set({userMenuOpen: false});" style="font-weight:700;color:var(--primary, #fd6910);">Mi perfil</button>
                      <button type="button" class="dropdown-item" data-action="open-fav-stores" onclick="window.Store.set({userMenuOpen: false});">Tiendas favoritas</button>
                      <button type="button" class="dropdown-item" data-action="open-saved" onclick="window.Store.set({userMenuOpen: false});">Productos guardados</button>
                      <button type="button" class="dropdown-item" data-action="open-purchases" onclick="window.Store.set({userMenuOpen: false});">Mis compras</button>
                    </div>
                    <div style="border-top:1px solid #f1f5f9;padding:6px 0;">
                      <button type="button" class="dropdown-item highlight-merchant" data-go="merchant" onclick="window.Store.set({userMenuOpen: false});">Convertirme en Comercio</button>
                    </div>
                  `}

                  <div style="border-top:1px solid #f1f5f9;padding-top:6px;">
                    <button type="button" class="dropdown-item danger" data-action="logout">Cerrar sesión</button>
                  </div>
                </div>
              </div>
            ` : `
              <!-- INVITADO -->
              <button data-go="login" style="cursor:pointer;background:none;border:none;display:flex;align-items:center;gap:6px; font-size:13px; font-weight:700; color:var(--text);">
                ${Icon('user', 18)}
                <span class="hide-mobile">Mi cuenta</span>
              </button>
            `}

            <!-- CARRITO CON NOTIFICACIÓN CIRCULAR AISLADA Y PEQUEÑA -->
            <div style="position:relative; display:flex; align-items:center;">
              <button class="cart-action" data-action="toggle-cart" aria-label="Carrito" style="cursor:pointer;background:none;border:none;position:relative; display:flex; align-items:center; justify-content:center; width:36px; height:36px; padding:0;">
                ${Icon('cart', 22)}
                <b id="cart-count" style="position:absolute; top:0px; right:0px; background:var(--accent); color:#fff; font-size:9px; width:16px !important; height:16px !important; min-width:16px !important; max-width:16px !important; border-radius:50% !important; display:flex !important; align-items:center; justify-content:center; border:2px solid #fff; box-sizing:border-box; line-height:1; font-weight:700;">${totalCount}</b>
              </button>

              <!-- MODAL DEL CARRITO -->
              <div id="cart-dropdown-modal" class="${s.cartOpen ? 'open' : ''}" style="display: ${s.cartOpen ? 'block' : 'none'}; position: fixed; right: 15px; top: 65px; background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 16px; width: 300px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 9999;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border, #e2e8f0); padding-bottom: 8px;">
                  <h3 style="font-size: 15px; font-weight: 800; color: var(--text, #0f172a); margin: 0;">Tu carrito</h3>
                  <button type="button" data-action="toggle-cart" style="background: none; border: none; font-size: 18px; cursor: pointer; color: var(--muted, #64748b);">&times;</button>
                </div>

                ${totalCount === 0 ? `
                  <div style="text-align: center; padding: 15px 0; color: var(--muted, #64748b); font-size: 13px;">
                    Tu carrito está vacío.
                  </div>
                ` : `
                  <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
                    ${cart.map(item => {
                      const prod = item.product || item;
                      const qty = item.quantity || item.qty || 1;
                      return `
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; border-bottom: 1px dashed var(--border, #e2e8f0); padding-bottom: 6px;">
                          <img src="${esc(prod.image)}" style="width: 35px; height: 35px; object-fit: cover; border-radius: 6px;" />
                          <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(prod.name)}</div>
                            <div style="color: var(--muted);">${qty}x ${window.Utils.money(prod.price)}</div>
                          </div>
                          <div style="font-weight: 800;">${window.Utils.money(prod.price * qty)}</div>
                        </div>
                      `;
                    }).join('')}
                  </div>

                  <div style="border-top: 1px solid var(--border); padding-top: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; font-size: 13px; font-weight: 800;">
                    <span>Subtotal:</span>
                    <span style="color: var(--primary);">${window.Utils.money(subtotalProducts)}</span>
                  </div>

                  <button type="button" onclick="window.Store.set({cartOpen: false}); window.location.hash = 'cart';" style="text-align: center; background: var(--primary, #fd6910); color: #fff; padding: 9px; border-radius: 8px; font-weight: 800; border: none; cursor: pointer; font-size: 12px; width: 100%;">
                    Ver carrito completo y pagar
                  </button>
                `}
              </div>
            </div>

          </div>
        </div>
      </header>`;
    },
  };
})();