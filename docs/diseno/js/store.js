/* ============================================================
   COMPRALOCAL — STORE (estado liviano + localStorage)
   ============================================================ */
(function () {
  const KEY = 'compralocal:v1';

  const state = {
    query: '',
    category: '',
    location: '',
    storeId: 'la-boutique',
    productId: null,
    cart: [],
    cartCount: 0,
    cartOpen: false,
    menuOpen: false,
    loginState: 'default',
    saved: {},
    following: {},
    draft: {},
    user: null,
  };

  const PERSISTED = ['cart', 'cartCount', 'saved', 'following', 'user'];

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      PERSISTED.forEach((k) => { if (parsed[k] !== undefined) state[k] = parsed[k]; });
    } catch (_) {}
  }

  function persist() {
    try {
      const out = {};
      PERSISTED.forEach((k) => { out[k] = state[k]; });
      window.localStorage.setItem(KEY, JSON.stringify(out));
    } catch (_) {}
  }

  load();

  window.Store = {
    state,
    set(patch) {
      Object.assign(state, patch);
      persist();
    },
    toggle(map, id) {
      state[map][id] = !state[map][id];
      persist();
      return state[map][id];
    },
    store() { return window.Data?.stores.find((s) => s.id === state.storeId) || window.Data?.stores[0]; },
    product() { return window.Data?.products.find((p) => p.id === state.productId) || null; },
  };

  let cartCloseTimer = null;

  window.CartManager = {
    add(product, qty = 1) {
      if (!state.cart) state.cart = [];
      const existing = state.cart.find(i => (i.product?.id === product.id || i.id === product.id || i.key === product.id));

      if (existing) {
        existing.quantity = (existing.quantity || existing.qty || 1) + qty;
        if (existing.qty) existing.qty = existing.quantity;
      } else {
        state.cart.push({
          key: product.id,
          product: product,
          quantity: qty,
          qty: qty
        });
      }
      this.updateTotals();

      // Abrimos el carrito al agregar un producto
      window.Store.set({ cartOpen: true });
      if (window.Modals && typeof window.Modals.renderCart === 'function') {
        window.Modals.renderCart();
      }

      // Cierre automático a los 1.5 segundos SIN refrescar la página entera
      if (cartCloseTimer) clearTimeout(cartCloseTimer);
      cartCloseTimer = setTimeout(() => {
        if (window.Store.state.cartOpen) {
          window.Store.set({ cartOpen: false });
          if (window.Modals && typeof window.Modals.renderCart === 'function') {
            window.Modals.renderCart();
          }
        }
      }, 1500);
    },

    updateQuantity(key, newQty) {
      if (!state.cart) return;
      if (newQty <= 0) {
        this.remove(key);
        return;
      }
      const item = state.cart.find(i => i.key === key || i.product?.id === key || i.id === key);
      if (item) {
        item.quantity = newQty;
        item.qty = newQty;
      }
      this.updateTotals();
    },

    remove(key) {
      if (!state.cart) return;
      state.cart = state.cart.filter(i => i.key !== key && i.product?.id !== key && i.id !== key);
      this.updateTotals();
    },

    clear() {
      state.cart = [];
      this.updateTotals();
    },

    updateTotals() {
      const totalCount = state.cart.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0);
      window.Store.set({ cartCount: totalCount, cart: state.cart });
      
      // Actualización fluida sin parpadeo si el mini carrito ya está abierto
      if (window.Store.state.cartOpen && window.Modals && typeof window.Modals.updateCartDOM === 'function') {
        window.Modals.updateCartDOM();
      } else if (window.Modals && typeof window.Modals.renderCart === 'function') {
        window.Modals.renderCart();
      }
    },

    getItemsByStore() {
      const cart = state.cart || [];
      const map = {};

      cart.forEach(item => {
        const prod = item.product || item;
        const storeId = prod.storeId || 'la-boutique';
        const storeObj = window.Data?.stores.find(s => s.id === storeId) || { name: 'Comercio local' };

        if (!map[storeId]) {
          map[storeId] = {
            storeId: storeId,
            storeName: storeObj.name,
            deliveryCost: 2999,
            deliveryTime: '24 a 48 hs',
            items: []
          };
        }
        map[storeId].items.push({
          ...item,
          product: prod
        });
      });

      return Object.values(map);
    }
  };

  window.Actions = window.Actions || {};
  
  window.Actions['add-to-cart'] = (el, event) => {
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

  /* Acciones para sumar, restar y eliminar desde el panel flotante */
  window.Actions['cart-increase'] = (el) => {
    if (cartCloseTimer) clearTimeout(cartCloseTimer);
    const targetBtn = el.closest('[data-key]');
    const key = targetBtn?.dataset?.key || el.dataset.key;
    const item = state.cart.find(i => i.key === key || i.product?.id === key || i.id === key);
    if (item) {
      const currentQty = item.quantity || item.qty || 1;
      window.CartManager.updateQuantity(key, currentQty + 1);
    }
  };

  window.Actions['cart-decrease'] = (el) => {
    if (cartCloseTimer) clearTimeout(cartCloseTimer);
    const targetBtn = el.closest('[data-key]');
    const key = targetBtn?.dataset?.key || el.dataset.key;
    const item = state.cart.find(i => i.key === key || i.product?.id === key || i.id === key);
    if (item) {
      const currentQty = item.quantity || item.qty || 1;
      window.CartManager.updateQuantity(key, currentQty - 1);
    }
  };

  window.Actions['cart-remove-item'] = (el) => {
    if (cartCloseTimer) clearTimeout(cartCloseTimer);
    const targetBtn = el.closest('[data-key]');
    const key = targetBtn?.dataset?.key || el.dataset.key;
    window.CartManager.remove(key);
  };

  window.Actions['toggle-cart'] = () => {
    if (cartCloseTimer) clearTimeout(cartCloseTimer);
    window.Store.set({ cartOpen: !window.Store.state.cartOpen });
    if (window.Modals && typeof window.Modals.renderCart === 'function') {
      window.Modals.renderCart();
    }
  };

  window.Actions['close-cart'] = () => {
    if (cartCloseTimer) clearTimeout(cartCloseTimer);
    window.Store.set({ cartOpen: false });
    if (window.Modals && typeof window.Modals.renderCart === 'function') {
      window.Modals.renderCart();
    }
  };

  window.Actions['cart-continue'] = () => {
    if (cartCloseTimer) clearTimeout(cartCloseTimer);
    window.Store.set({ cartOpen: false });
    if (window.Modals && typeof window.Modals.renderCart === 'function') {
      window.Modals.renderCart();
    }
    window.location.hash = 'cart';
  };

  window.Actions['cart-explore'] = () => {
    if (cartCloseTimer) clearTimeout(cartCloseTimer);
    window.Store.set({ cartOpen: false });
    if (window.Modals && typeof window.Modals.renderCart === 'function') {
      window.Modals.renderCart();
    }
    // Forzamos la navegación limpia a tiendas
    if (typeof window.Router?.go === 'function') {
      window.Router.go('stores');
    } else {
      window.location.hash = 'stores';
      if (typeof window.App?.render === 'function') {
        window.App.render();
      }
    }
  };
})();