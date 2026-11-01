/**
 * COMPRALOCAL — MOBILE NAVIGATION
 */

const MobileNav = {
  isOpen: false,
  overlay: null,
  drawer: null,

  open() {
    if (this.isOpen) return;
    const user = store.get('user');
    this.isOpen = true;

    const overlay = document.createElement('div');
    overlay.className = 'mobile-nav-overlay';
    overlay.style.display = 'block';
    overlay.id = 'mobile-nav-overlay';
    overlay.addEventListener('click', () => this.close());

    const drawer = document.createElement('div');
    drawer.className = 'mobile-nav';
    drawer.id = 'mobile-nav';
    drawer.setAttribute('role', 'navigation');
    drawer.setAttribute('aria-label', 'Menú principal');
    drawer.innerHTML = `
      <div class="mobile-nav-header">
        <div style="display:flex;align-items:center">
          ${Brand.render({ format: 'horizontal', theme: 'white', height: 26 })}
        </div>
        <button class="mobile-nav-close" onclick="MobileNav.close()" aria-label="Cerrar menú">✕</button>
      </div>

      ${user ? `
        <div class="mobile-nav-user">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div class="avatar avatar-md" style="background:var(--cl-orange-100);color:var(--cl-orange-600)">
              ${user.initials}
            </div>
            <div>
              <div style="font-weight:var(--font-semibold);font-size:var(--text-sm)">${Utils.sanitize(user.name)}</div>
              <div style="font-size:var(--text-xs);color:var(--text-muted)">${Utils.sanitize(user.email)}</div>
            </div>
          </div>
        </div>
      ` : `
        <div class="mobile-nav-user">
          <div style="display:flex;gap:var(--space-2)">
            <a data-route="/login" class="btn btn-primary btn-sm flex-1" onclick="MobileNav.close()">Ingresar</a>
            <a data-route="/registro" class="btn btn-outline btn-sm flex-1" onclick="MobileNav.close()">Registrarse</a>
          </div>
        </div>
      `}

      <div class="mobile-nav-section">
        <div class="mobile-nav-section-label">Principal</div>
        <a class="mobile-nav-item" data-route="/" onclick="MobileNav.close()">
          <span class="item-icon">🏠</span> Inicio
        </a>
        <a class="mobile-nav-item" data-route="/tiendas" onclick="MobileNav.close()">
          <span class="item-icon">🏪</span> Tiendas locales
        </a>
        <a class="mobile-nav-item" data-route="/categorias" onclick="MobileNav.close()">
          <span class="item-icon">📂</span> Categorías
        </a>
        <a class="mobile-nav-item" data-route="/ofertas" onclick="MobileNav.close()">
          <span class="item-icon">🏷️</span> Ofertas
        </a>
      </div>

      <div class="mobile-nav-section" style="border-top:1px solid var(--border-subtle)">
        <div class="mobile-nav-section-label">Categorías destacadas</div>
        ${MockData.categories.slice(0, 6).map(cat => `
          <a class="mobile-nav-item" data-route="/categoria/${cat.id}" onclick="MobileNav.close()">
            <span class="item-icon">${cat.icon}</span> ${cat.label}
          </a>
        `).join('')}
      </div>

      ${user ? `
        <div class="mobile-nav-section" style="border-top:1px solid var(--border-subtle)">
          <div class="mobile-nav-section-label">Mi cuenta</div>
          <a class="mobile-nav-item" data-route="/mi-cuenta" onclick="MobileNav.close()">
            <span class="item-icon">👤</span> Mi perfil
          </a>
          <a class="mobile-nav-item" data-route="/mis-pedidos" onclick="MobileNav.close()">
            <span class="item-icon">📦</span> Mis pedidos
          </a>
          <a class="mobile-nav-item" data-route="/favoritos" onclick="MobileNav.close()">
            <span class="item-icon">♡</span> Favoritos
          </a>
        </div>
        <div class="mobile-nav-section" style="border-top:1px solid var(--border-subtle)">
          <div class="mobile-nav-section-label">Comerciante</div>
          <a class="mobile-nav-item" data-route="/comerciante/dashboard" onclick="MobileNav.close()">
            <span class="item-icon">📊</span> Panel de gestión
          </a>
          <a class="mobile-nav-item" data-route="/comerciante/productos" onclick="MobileNav.close()">
            <span class="item-icon">📋</span> Mis productos
          </a>
        </div>
        <div class="mobile-nav-section" style="border-top:1px solid var(--border-subtle)">
          <button class="mobile-nav-item" style="color:var(--color-error)" onclick="Header.logout();MobileNav.close()">
            <span class="item-icon">↩</span> Cerrar sesión
          </button>
        </div>
      ` : ''}
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.body.style.overflow = 'hidden';

    // ESC key
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    // Update toggle button
    const toggle = document.getElementById('mobile-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');

    this.overlay = overlay;
    this.drawer = drawer;
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.overlay) this.overlay.remove();
    if (this.drawer) this.drawer.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', this._escHandler);

    const toggle = document.getElementById('mobile-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }
};

/**
 * MERCHANT SIDEBAR
 */
const MerchantSidebar = {
  render() {
    const merchant = MockData.merchantUser;
    const currentRoute = window.location.hash.slice(1) || '/';

    const navItems = [
      { route: '/comerciante/dashboard', icon: '📊', label: 'Dashboard' },
      { route: '/comerciante/productos', icon: '📋', label: 'Productos', badge: null },
      { route: '/comerciante/pedidos', icon: '📦', label: 'Pedidos', badge: '3' },
      { route: '/comerciante/clientes', icon: '👥', label: 'Clientes' },
      { route: '/comerciante/estadisticas', icon: '📈', label: 'Estadísticas' },
      { route: '/comerciante/configuracion', icon: '⚙️', label: 'Configuración' },
    ];

    return `
      <aside id="merchant-sidebar" role="navigation" aria-label="Panel del comerciante">
        <!-- Store Info -->
        <div class="merchant-sidebar-logo">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div class="avatar avatar-lg avatar-square" style="background:var(--cl-orange-100);color:var(--cl-orange-500);font-size:1.5rem">
              🥖
            </div>
            <div>
              <div class="merchant-sidebar-store-name">${merchant.storeName}</div>
              <div class="merchant-sidebar-store-plan">${merchant.planLabel}</div>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="merchant-nav-section">
          <div class="merchant-nav-section-label">Gestión</div>
          ${navItems.map(item => `
            <a class="merchant-nav-item ${currentRoute.startsWith(item.route) ? 'active' : ''}"
               data-route="${item.route}"
               aria-current="${currentRoute.startsWith(item.route) ? 'page' : 'false'}">
              <span class="nav-icon">${item.icon}</span>
              ${item.label}
              ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
            </a>
          `).join('')}
        </div>

        <div class="merchant-nav-section" style="border-top:1px solid rgba(255,255,255,0.06);margin-top:auto;padding-top:var(--space-4)">
          <div class="merchant-nav-section-label">Tienda</div>
          <a class="merchant-nav-item" data-route="/tienda/${merchant.storeId}">
            <span class="nav-icon">🌐</span> Ver mi tienda
          </a>
          <a class="merchant-nav-item" data-route="/">
            <span class="nav-icon">🛒</span> Marketplace
          </a>
        </div>

        <!-- Plan info -->
        <div style="padding:var(--space-4) var(--space-3);margin:var(--space-3)">
          <div style="background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:var(--radius-lg);padding:var(--space-4)">
            <div style="font-size:var(--text-xs);font-weight:var(--font-semibold);color:var(--cl-orange-300);margin-bottom:var(--space-1)">${merchant.planLabel}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.5)">Renovación: 15 nov 2025</div>
            <a data-route="/planes" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--cl-orange-300);margin-top:var(--space-2);font-weight:var(--font-semibold)">
              Actualizar plan →
            </a>
          </div>
        </div>
      </aside>
    `;
  }
};

window.MobileNav = MobileNav;
window.MerchantSidebar = MerchantSidebar;
