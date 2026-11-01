/* ============================================================
   COMPRALOCAL — BOOTSTRAP
   Render por ruta + delegación de eventos (data-go / data-action /
   data-form / data-input).
   ============================================================ */
(function () {
  const root = () => document.getElementById('app');

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

  // Acción global unificada para agregar al carrito desde cualquier tarjeta, modal o detalle
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

  /* ── Acciones del Menú de Usuario Cliente y Comercio ── */
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

  /* Manejo de pestañas del Panel Comerciante desde el header */
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

  Actions['toggle-save'] = (el) => {
    const id = el.dataset.id;
    const on = Store.toggle('saved', id);
    const name = Data.stores.find((s) => s.id === id)?.name || '';
    document.querySelectorAll(`[data-action="toggle-save"][data-id="${id}"]`).forEach((b) => {
      b.classList.toggle('saved', on);
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', `${on ? 'Quitar de guardados' : 'Guardar'} ${name}`);
    });
  };

  /* Redirección robusta a la vista detallada del producto */
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

  /* ─── Delegación de eventos ─── */
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
        Actions[actionName](actEl, e);
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