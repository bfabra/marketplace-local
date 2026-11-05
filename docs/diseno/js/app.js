/* ============================================================
   COMPRALOCAL — BOOTSTRAP (FAVORITOS FLUIDOS SIN RECARGA)
   ============================================================ */
(function () {
  const root = () => document.getElementById('app');

  // Inicializar Store y métodos auxiliares si no existen
  window.Store = window.Store || {};
  window.Store.state = window.Store.state || {};
  window.Store.state.saved = window.Store.state.saved || {};
  window.Store.state.favoriteProducts = window.Store.state.favoriteProducts || [];

  if (typeof window.Store.toggle !== 'function') {
    window.Store.toggle = function(key, id) {
      if (!this.state[key]) this.state[key] = {};
      const current = !!this.state[key][id];
      this.state[key][id] = !current;
      if (typeof this.set === 'function') {
        this.set({ [key]: { ...this.state[key] } });
      }
      return !current;
    };
  }

  /* ─── Render ─── */
  const App = {
    render() {
      const name = Router.current();
      const page = Pages[name];
      if (!page) return;

      const body = page.render();
      document.title = page.title && name !== 'store' ? page.title : document.title;

      if (page.layout === 'market') {
        root().innerHTML = `
          <div class="marketplace-shell">
            ${Header.render(name)}
            <div id="cart-root"></div>
            <main id="page-content" class="page-enter">${body}</main>
            ${Footer.render()}
            <div id="modal-root"></div>
            <div id="support-modal-root"></div>
          </div>`;
        Modals.renderCart();
      } else {
        root().innerHTML = `<div class="page-enter">${body}</div>`;
      }
      if (page.mount) page.mount(root());
    },
  };
  window.App = App;

  /* ─── Navegación ─── */
  function navigate(name) {
    const s = Store.state;
    s.menuOpen = false;
    s.cartOpen = false;
    s.userMenuOpen = false; 
    s.productId = null;
    if (name === 'stores') { s.category = ''; s.location = ''; }
    Router.go(name);
  }

  function openStore(id) {
    Store.set({ storeId: id, productId: null, cartOpen: false, userMenuOpen: false });
    if (Pages.store && Pages.store.reset) Pages.store.reset();
    Router.go('store');
  }

  /* ─── Acciones globales ─── */
  Actions['toggle-menu'] = (el) => {
    const open = !Store.state.menuOpen;
    Store.state.menuOpen = open;
    const nav = document.getElementById('market-nav');
    if (nav) nav.classList.toggle('open', open);
    el.setAttribute('aria-expanded', open);
  };

  Actions['toggle-cart'] = () => { Store.state.cartOpen = !Store.state.cartOpen; Modals.renderCart(); };
  Actions['close-cart'] = () => { Store.state.cartOpen = false; Modals.renderCart(); };
  Actions['cart-continue'] = () => navigate('marketplace');

  Actions['add-to-cart'] = (el, event) => {
    let p = null;
    const targetWithId = event?.target ? event.target.closest('[data-id]') : null;
    const productId = el?.dataset?.id || el?.getAttribute?.('data-id') || targetWithId?.dataset?.id;
    
    if (productId && window.Data && window.Data.products) {
      p = window.Data.products.find(prod => prod.id === productId);
    }
    
    if (!p && window.Store?.state?.productId && window.Data?.products) {
      p = window.Data.products.find(prod => prod.id === window.Store.state.productId);
    }

    if (!p && typeof window.Store?.product === 'function') {
      p = window.Store.product();
    }

    if (p && window.CartManager) {
      window.CartManager.add(p, 1);
    }
  };

  Actions['toggle-user-menu'] = (el, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    Store.state.userMenuOpen = !Store.state.userMenuOpen;
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) {
      menu.classList.toggle('open', Store.state.userMenuOpen);
    } else {
      const headerContainer = document.querySelector('.market-header');
      if (headerContainer) {
        const currentRoute = Router.current();
        headerContainer.outerHTML = Header.render(currentRoute);
        const newMenu = document.getElementById('user-dropdown-menu');
        if (newMenu) newMenu.classList.toggle('open', Store.state.userMenuOpen);
      }
    }
  };

  Actions['go-merchant-tab'] = (el) => {
    const tab = el.dataset.tab || 'profile';
    window.Store.set({ merchantTab: tab, userMenuOpen: false });
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.remove('open');
    window.Router.go('merchant-panel');
  };

  Actions['logout'] = () => {
    Store.set({ user: null, userMenuOpen: false });
    Router.go('marketplace');
    App.render();
  };

  Actions['open-fav-stores'] = () => {
    Store.state.userMenuOpen = false;
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.remove('open');
    window.Store.set({ profileTab: 'fav-stores' });
    Router.go('profile');
  };

  Actions['open-saved'] = () => {
    Store.state.userMenuOpen = false;
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.remove('open');
    window.Store.set({ profileTab: 'fav-products' });
    Router.go('profile');
  };

  Actions['open-purchases'] = () => {
    Store.state.userMenuOpen = false;
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.remove('open');
    window.Store.set({ profileTab: 'purchases', activePurchaseId: null });
    Router.go('profile');
  };

  Actions['open-orders'] = () => {
    Store.state.userMenuOpen = false;
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.remove('open');
    window.Store.set({ profileTab: 'shipments' });
    Router.go('profile');
  };

  Actions['open-questions'] = () => {
    Store.state.userMenuOpen = false;
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.remove('open');
    Router.go('faq');
  };

  /* ─── Acciones de los Botones del Footer y Centro de Ayuda ─── */
  Actions['open-about-platform'] = () => {
    window.Router.go('about');
  };

  Actions['open-help-center'] = () => {
    window.Router.go('help');
  };

  Actions['open-contact'] = () => {
    window.Actions['open-contact-modal']();
  };

  Actions['open-terms'] = () => {
    window.Router.go('terms');
  };

  /* Modal global de contacto y generación de tickets de reclamo */
  Actions['open-contact-modal'] = () => {
    let modal = document.getElementById('help-contact-modal');
    if (!modal) {
      const supportRoot = document.getElementById('support-modal-root') || document.body;
      const modalHTML = `
        <div id="help-contact-modal" style="display: flex; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <h3 style="font-size: 17px; font-weight: 800; color: #09305f; margin: 0;">Centro de Contacto & Reclamos</h3>
              <button type="button" onclick="window.Actions['close-contact-modal']()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>
            
            <div style="padding: 24px; overflow-y: auto; flex: 1;">
              <form id="help-ticket-form" onsubmit="event.preventDefault(); window.Forms['submit-help-ticket'](this);" style="display: flex; flex-direction: column; gap: 16px;" novalidate>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;">Tipo de Solicitud *</label>
                  <select name="ticketType" required style="height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 13px; background: #fff; cursor: pointer;">
                    <option value="Consulta general">Consulta general / Ayuda</option>
                    <option value="Reclamo por producto">Reclamo por producto defectuoso / no recibido</option>
                    <option value="Devolución">Solicitud de Devolución</option>
                    <option value="Problema con envío">Problema con el envío</option>
                    <option value="Soporte Comercio">Soporte para Comercios</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;">Asunto *</label>
                  <input type="text" name="ticketSubject" required placeholder="Ej. Mi pedido no ha llegado" style="height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;">Mensaje o Detalle del Reclamo *</label>
                  <textarea name="ticketMessage" required rows="4" placeholder="Describí detalladamente tu inconveniente..." style="border-radius: 8px; border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; background: #fff; resize: vertical;"></textarea>
                </div>
              </form>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <button type="button" onclick="window.Actions['close-contact-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; color: #475569;">Cancelar</button>
              <button type="button" onclick="document.getElementById('help-ticket-form').requestSubmit ? document.getElementById('help-ticket-form').requestSubmit() : document.getElementById('help-ticket-form').dispatchEvent(new Event('submit', {cancelable: true}));" style="background: #fd6910; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">Enviar Reclamo / Ticket</button>
            </div>
          </div>
        </div>
      `;
      supportRoot.insertAdjacentHTML('beforeend', modalHTML);
    } else {
      modal.style.display = 'flex';
    }
  };

  window.Actions['close-contact-modal'] = () => {
    const modal = document.getElementById('help-contact-modal');
    if (modal) modal.style.display = 'none';
  };

  Actions['open-category'] = (el) => {
    Store.state.category = el.dataset.name;
    Store.state.location = '';
    Router.go('stores');
  };
  Actions['open-location'] = (el) => {
    Store.state.location = el.dataset.name;
    Store.state.category = '';
    Router.go('stores');
  };
  Actions['open-store'] = (el) => openStore(el.dataset.id);

  // Acción fluida para guardar Tiendas Favoritas (Sin recargar página)
  Actions['toggle-save'] = (el, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const id = el.dataset.id;
    if (!id) return;

    const on = Store.toggle('saved', id);
    const orangeColor = '#fd6910';

    document.querySelectorAll(`[data-action="toggle-save"][data-id="${id}"]`).forEach((b) => {
      b.classList.toggle('saved', on);
      b.setAttribute('aria-pressed', on);
      
      const span = b.querySelector('span');
      if (span) {
        span.style.color = on ? orangeColor : '';
      }
      const svg = b.querySelector('svg');
      if (svg) {
        svg.setAttribute('fill', on ? orangeColor : 'none');
        svg.setAttribute('stroke', on ? orangeColor : 'currentColor');
      }
    });
  };

  // Acción fluida para guardar Productos Favoritos (Sin recargar página)
  Actions['toggle-product-save'] = (el, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const id = el.dataset.id;
    if (!id) return;

    Store.state.favoriteProducts = Store.state.favoriteProducts || [];
    const index = Store.state.favoriteProducts.indexOf(id);
    const on = index === -1;

    if (on) {
      Store.state.favoriteProducts.push(id);
    } else {
      Store.state.favoriteProducts.splice(index, 1);
    }

    if (typeof Store.set === 'function') {
      Store.set({ favoriteProducts: [...Store.state.favoriteProducts] });
    }

    const orangeColor = '#fd6910';

    document.querySelectorAll(`[data-action="toggle-product-save"][data-id="${id}"]`).forEach((b) => {
      b.classList.toggle('saved', on);
      b.setAttribute('aria-pressed', on);

      const span = b.querySelector('span');
      if (span) {
        span.style.color = on ? orangeColor : '';
      }
      const svg = b.querySelector('svg');
      if (svg) {
        svg.setAttribute('fill', on ? orangeColor : 'none');
        svg.setAttribute('stroke', on ? orangeColor : 'currentColor');
      }
    });
  };

  Actions['open-product'] = (el, e) => {
    const target = e.target.closest('[data-id]');
    const productId = el.dataset.id || (target ? target.dataset.id : null);
    if (!productId) return;

    Store.set({ productId: productId, cartOpen: false });

    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) modalRoot.innerHTML = '';

    Router.go('product');
  };

  /* ─── Formularios ─── */
  Forms.search = (form) => {
    const input = form.querySelector('[data-input="query"]');
    Store.state.query = input ? input.value : '';
    Store.state.menuOpen = false;
    Router.go('search');
  };

  Inputs.query = (el) => {
    Store.state.query = el.value;
    document.querySelectorAll('[data-input="query"]').forEach((i) => { if (i !== el) i.value = el.value; });
    if (Router.current() === 'search') Pages.search.onQuery();
  };

  /* ─── Oyente directo en Fase de Captura para Favoritos (Prioridad Absoluta) ─── */
  document.addEventListener('click', (e) => {
    const favStoreBtn = e.target.closest('[data-action="toggle-save"]');
    if (favStoreBtn) {
      e.preventDefault();
      e.stopPropagation();
      Actions['toggle-save'](favStoreBtn, e);
      return;
    }

    const favProdBtn = e.target.closest('[data-action="toggle-product-save"]');
    if (favProdBtn) {
      e.preventDefault();
      e.stopPropagation();
      Actions['toggle-product-save'](favProdBtn, e);
      return;
    }
  }, true);

  /* ─── Delegación de eventos general ─── */
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown-menu');
    if (Store.state.userMenuOpen && dropdown && !e.target.closest('.user-dropdown-wrapper')) {
      Store.state.userMenuOpen = false;
      dropdown.classList.remove('open');
      return;
    }

    const goEl = e.target.closest('[data-go]');
    if (goEl) { e.preventDefault(); navigate(goEl.dataset.go); return; }

    const actEl = e.target.closest('[data-action]');
    if (actEl) {
      const actionName = actEl.dataset.action;
      if (Actions[actionName]) {
        Actions[actionName][actionName] ? Actions[actionName](actEl, e) : Actions[actionName](actEl, e);
      }
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    if (Forms[form.dataset.form]) Forms[form.dataset.form](form, e);
  });

  const onField = (e) => {
    const el = e.target.closest('[data-input]');
    if (el && Inputs[el.dataset.input]) Inputs[el.dataset.input](el, e);
  };
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const dropdown = document.getElementById('user-dropdown-menu');
    if (Store.state.productId) { Store.state.productId = null; }
    else if (Store.state.cartOpen) { Store.state.cartOpen = false; Modals.renderCart(); }
    else if (Store.state.userMenuOpen && dropdown) {
      Store.state.userMenuOpen = false;
      dropdown.classList.remove('open');
    }
  });

  /* ─── Arranque ─── */
  window.addEventListener('hashchange', () => {
    Store.state.menuOpen = false;
    Store.state.cartOpen = false;
    Store.state.userMenuOpen = false;
    Store.state.productId = null;
    App.render();
    window.scrollTo(0, 0);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash.replace('#', '');
    if (!Router.routes.includes(hash)) {
      window.history.replaceState(null, '', '#' + Router.current());
    }
    App.render();
    const loading = document.getElementById('loading-screen');
    if (loading) {
      loading.classList.add('fade-out');
      setTimeout(() => loading.remove(), 350);
    }
  });
})();