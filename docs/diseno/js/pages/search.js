/* ============================================================
   COMPRALOCAL — RESULTADOS  (#search)
   ============================================================ */
(function () {
  const { esc, norm } = window.Utils;
  const { stores, products } = window.Data;

  const S = { type: 'all' };

  function matches(query) {
    return {
      stores: stores.filter((s) => norm(s.name + s.category + s.description).includes(norm(query))),
      products: products.filter((p) => norm(p.name + p.category).includes(norm(query))),
    };
  }

  function tabs(m) {
    const t = (id, label) => `<button class="${S.type === id ? 'active' : ''}" data-action="search-type" data-type="${id}">${label}</button>`;
    return t('all', 'Todo') + t('stores', `Tiendas (${m.stores.length})`) + t('products', `Productos (${m.products.length})`);
  }

  function body(query, m) {
    if (!query) return Cards.empty('¿Qué estás buscando?', 'Escribí el nombre de una tienda, un rubro o un producto para comenzar.');
    if (!m.stores.length && !m.products.length) {
      return Cards.empty('No encontramos coincidencias', `No hay resultados para “${esc(query)}”. Probá con un término más general.`, 'search-clear');
    }
    const showStores = (S.type === 'all' || S.type === 'stores') && m.stores.length;
    const showProducts = (S.type === 'all' || S.type === 'products') && m.products.length;
    return `
      ${showStores ? `<section class="search-result-section">
        <div class="market-section-heading"><div><span>PRIMERO, LOS COMERCIOS</span><h2>Tiendas encontradas</h2></div></div>
        <div class="stores-page-grid">${m.stores.map((s) => Cards.store(s)).join('')}</div></section>` : ''}
      ${showProducts ? `<section class="search-result-section">
        <div class="market-section-heading"><div><span>PRODUCTOS RELACIONADOS</span><h2>Productos encontrados</h2></div></div>
        <div class="product-grid">${m.products.map((p) => Cards.product(p)).join('')}</div></section>` : ''}`;
  }

  function heading(query) {
    return query ? `Resultados para “${esc(query)}”` : 'Buscá en CompraLocal';
  }

  function refresh() {
    const query = window.Store.state.query;
    const m = matches(query);
    document.getElementById('search-heading').innerHTML = heading(query);
    document.getElementById('search-tabs').innerHTML = tabs(m);
    document.getElementById('search-body').innerHTML = body(query, m);
  }

  Pages.search = {
    layout: 'market',
    title: 'Resultados — CompraLocal',
    render() {
      S.type = 'all';
      const query = window.Store.state.query;
      const m = matches(query);
      return `
      <div class="market-container market-page search-page">
        <div class="market-page-heading">
          <span>RESULTADOS</span>
          <h1 id="search-heading">${heading(query)}</h1>
          <p>Priorizamos comercios para que puedas conocer quién vende cerca tuyo.</p>
        </div>
        <label class="market-filter-search search-large">${Icon('search', 20)}<input id="search-page-query" data-input="query" value="${esc(query)}" placeholder="Buscar tiendas, rubros o productos" aria-label="Buscar tiendas, rubros o productos" /></label>
        <div class="search-type-tabs" id="search-tabs">${tabs(m)}</div>
        <div id="search-body">${body(query, m)}</div>
      </div>`;
    },
  };

  Actions['search-type'] = (el) => { S.type = el.dataset.type; refresh(); };

  Actions['search-clear'] = () => {
    window.Store.state.query = '';
    document.querySelectorAll('[data-input="query"]').forEach((i) => { i.value = ''; });
    refresh();
  };

  // Si se escribe estando en #search, se actualizan los resultados en vivo
  Pages.search.onQuery = refresh;
})();
