/* ============================================================
   COMPRALOCAL — ROUTER (hash) + registros de eventos
   ============================================================ */
(function () {
  const ROUTES = [
    'login', 'signup', 'merchant', 'merchant-panel', 'review', 'success', 'styleguide',
    'marketplace', 'categories', 'stores', 'store', 'search', 'product', 'cart', 'checkout', 'profile', 'faq', 'help', 'terms', 'about'
  ];
  const DEFAULT_ROUTE = 'marketplace';

  window.Pages = window.Pages || {};
  window.Actions = window.Actions || {};
  window.Forms = window.Forms || {};
  window.Inputs = window.Inputs || {};

  window.Router = {
    routes: ROUTES,

    current() {
      const name = window.location.hash.replace('#', '');
      return ROUTES.includes(name) ? name : DEFAULT_ROUTE;
    },

    go(name) {
      if (!ROUTES.includes(name)) name = DEFAULT_ROUTE;
      if (window.location.hash === '#' + name) {
        window.App.render();
      } else {
        window.location.hash = name;
      }
    },
  };
})();