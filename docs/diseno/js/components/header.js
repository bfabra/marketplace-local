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
        <div class="container header-inner">
          <button class="market-logo" data-go="marketplace" aria-label="Ir al inicio">
            ${Brand.img('horizontal')}
          </button>

          <button class="market-menu" data-action="toggle-menu" aria-label="Abrir navegación" aria-expanded="${s.menuOpen}" aria-controls="market-nav">
            ${Icon('menu')}
          </button>

          <nav id="market-nav" class="${s.menuOpen ? 'open' : ''}" aria-label="Principal">
            <button class="${on(['marketplace'])}" data-go="marketplace">Inicio</button>
            <button class="${on(['stores', 'store'])}" data-go="stores">Tiendas</button>
            <button class="${on(['categories'])}" data-go="categories">Rubros</button>
          </nav>

          <form class="market-header-search" data-form="search" role="search">
            ${Icon('search', 17)}
            <input id="header-query" data-input="query" value="${esc(s.query || '')}" placeholder="Buscar tiendas, rubros o productos" aria-label="Buscar tiendas, rubros o productos" />
            <button aria-label="Buscar" type="submit">${Icon('arrow', 15)}</button>
          </form>

          <div class="market-actions">
            ${user ? `
              <!-- USUARIO AUTENTICADO: MENÚ DESPLEGABLE -->
              <div class="user-dropdown-wrapper" style="position:relative;">
                <button type="button" class="btn-user-profile" data-action="toggle-user-menu" style="display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;font-weight:700;color:var(--primary);">
                  <div class="avatar-circle" style="width:34px;height:34px;border-radius:50%;background:${user.avatar ? 'none' : '#fd6910'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;overflow:hidden;">
                    ${user.avatar ? `<img src="${esc(user.avatar)}" style="width:100%;height:100%;object-fit:cover;" />` : (user.initials || 'CL')}
                  </div>
                  <span class="hide-mobile">${esc(user.name ? user.name.split(' ')[0] : 'Mi Cuenta')}</span>
                  ${Icon('arrow-down', 12) || '▾'}
                </button>

                <!-- MENÚ FLOTANTE DINÁMICO (CLIENTE VS COMERCIO) -->
                <div id="user-dropdown-menu" class="dropdown-menu-card ${s.userMenuOpen ? 'open' : ''}">
                  <div style="padding:0 16px 10px;border-bottom:1px solid #f1f5f9;">
                    <div style="font-weight:700;font-size:14px;color:#0f172a;">${esc(user.storeName || user.name)}</div>
                    <div style="font-size:11px;color:#64748b;">${esc(user.email)}</div>
                  </div>

                  ${isMerchant ? `
                    <!-- MENÚ DE COMERCIANTE -->
                    <div style="padding:6px 0;">
                      <button type="button" class="dropdown-item" data-action="go-merchant-tab" data-tab="profile" style="font-weight:700;color:var(--primary, #fd6910);">
                        ${window.Icon('shop', 16) || '🏪'} Perfil Comerciante
                      </button>
                      <button type="button" class="dropdown-item" data-action="go-merchant-tab" data-tab="sales">
                        ${window.Icon('chart', 16) || '📊'} Mis Ventas
                      </button>
                      <button type="button" class="dropdown-item" data-action="go-merchant-tab" data-tab="products">
                        ${window.Icon('package', 16) || '📦'} Mis Productos
                      </button>
                      <button type="button" class="dropdown-item" data-action="go-merchant-tab" data-tab="roles">
                        ${window.Icon('users', 16) || '👥'} Roles y Permisos
                      </button>
                      <button type="button" class="dropdown-item" data-action="go-merchant-tab" data-tab="security">
                        ${window.Icon('lock', 16) || '🔒'} Seguridad y Cuenta
                      </button>
                    </div>
                  ` : `
                    <!-- MENÚ DE CLIENTE -->
                    <div style="padding:6px 0;">
                      <button type="button" class="dropdown-item" data-go="profile" onclick="window.Store.set({userMenuOpen: false});" style="font-weight:700;color:var(--primary, #fd6910);">
                        ${Icon('user', 16) || '👤'} Mi perfil
                      </button>
                      <button type="button" class="dropdown-item" data-action="open-fav-stores" onclick="window.Store.set({userMenuOpen: false});">
                        ${Icon('shop', 16)} Tiendas favoritas
                      </button>
                      <button type="button" class="dropdown-item" data-action="open-saved" onclick="window.Store.set({userMenuOpen: false});">
                        ${Icon('heart', 16)} Productos guardados
                      </button>
                      <button type="button" class="dropdown-item" data-action="open-purchases" onclick="window.Store.set({userMenuOpen: false});">
                        ${Icon('shopping', 16)} Mis compras
                      </button>
                      <button type="button" class="dropdown-item" data-action="open-orders" onclick="window.Store.set({userMenuOpen: false});">
                        ${Icon('box', 16)} Mis pedidos
                      </button>
                      <button type="button" class="dropdown-item" data-action="open-questions" onclick="window.Store.set({userMenuOpen: false});">
                        ${Icon('message', 16)} Preguntas
                      </button>
                    </div>

                    <div style="border-top:1px solid #f1f5f9;padding:6px 0;">
                      <button type="button" class="dropdown-item highlight-merchant" data-go="merchant" onclick="window.Store.set({userMenuOpen: false});">
                        Convertirme en Comercio
                      </button>
                    </div>
                  `}

                  <div style="border-top:1px solid #f1f5f9;padding-top:6px;">
                    <button type="button" class="dropdown-item danger" data-action="logout">
                      ${Icon('back', 16)} Cerrar sesión
                    </button>
                  </div>
                </div>
              </div>
            ` : `
              <!-- INVITADO: USUARIO NO CREADO -->
              <button data-go="login" style="cursor:pointer;background:none;border:none;display:flex;align-items:center;gap:6px;">
                ${Icon('user', 18)}
                <span>Mi cuenta</span>
              </button>
            `}

            <!-- CARRITO CON POPOVER DINÁMICO -->
            <div style="position:relative;">
              <button class="cart-action" data-action="toggle-cart" aria-label="Carrito, ${totalCount} productos" style="cursor:pointer;background:none;border:none;position:relative;">
                ${Icon('cart', 19)}<b id="cart-count">${totalCount}</b>
              </button>

              <!-- MODAL / POPOVER DEL CARRITO -->
              <div id="cart-dropdown-modal" class="${s.cartOpen ? 'open' : ''}" style="display: ${s.cartOpen ? 'block' : 'none'}; position: fixed; right: 20px; top: 75px; background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 20px; width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 9999;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border, #e2e8f0); padding-bottom: 8px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: var(--text, #0f172a); margin: 0;">Tu carrito</h3>
                  <button type="button" data-action="toggle-cart" style="background: none; border: none; font-size: 18px; cursor: pointer; color: var(--muted, #64748b);">&times;</button>
                </div>

                ${totalCount === 0 ? `
                  <div style="text-align: center; padding: 20px 0; color: var(--muted, #64748b); font-size: 13px;">
                    Tu carrito está vacío.
                  </div>
                ` : `
                  <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; padding-right: 4px;">
                    ${cart.map(item => {
                      const prod = item.product || item;
                      const qty = item.quantity || item.qty || 1;
                      return `
                        <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; border-bottom: 1px dashed var(--border, #e2e8f0); padding-bottom: 8px;">
                          <img src="${esc(prod.image)}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border, #e2e8f0);" />
                          <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; color: var(--text, #0f172a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(prod.name)}</div>
                            <div style="color: var(--muted, #64748b);">${qty}x ${window.Utils.money(prod.price)}</div>
                          </div>
                          <div style="font-weight: 800; color: var(--text, #0f172a);">
                            ${window.Utils.money(prod.price * qty)}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>

                  <div style="border-top: 1px solid var(--border, #e2e8f0); padding-top: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 800;">
                    <span>Subtotal productos:</span>
                    <span style="color: var(--primary, #fd6910);">${window.Utils.money(subtotalProducts)}</span>
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
              </div>
            </div>

          </div>
        </div>
      </header>`;
    },
  };
})();