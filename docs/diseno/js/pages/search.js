/* ============================================================
   COMPRALOCAL — RESULTADOS  (#search)
   ============================================================ */
(function () {
  const { esc, norm, money } = window.Utils;
  const { stores, products } = window.Data;

  const S = { type: 'all' };

  function getAllProducts() {
    const staticProducts = window.Data?.products || [];
    const merchantProducts = window.Store?.state?.merchantProducts || [];
    const map = new Map();
    [...merchantProducts, ...staticProducts].forEach(p => map.set(p.id, p));
    return Array.from(map.values());
  }

  function getAllStores() {
    const merchantStores = window.Store?.state?.merchantStores || [];
    const staticStores = window.Data?.stores || [];
    const map = new Map();
    [...merchantStores, ...staticStores].forEach(s => map.set(s.id, s));
    return Array.from(map.values());
  }

  function matches(query) {
    const allStores = getAllStores();
    const allProducts = getAllProducts();
    return {
      stores: allStores.filter((s) => norm(s.name + (s.category || '') + (s.description || '')).includes(norm(query))),
      products: allProducts.filter((p) => norm(p.name + (p.category || '')).includes(norm(query))),
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
        <div class="product-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
          ${m.products.map((p) => `
            <div class="product-card" data-action="open-product" data-id="${esc(p.id)}" style="cursor: pointer; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div style="width: 100%; height: 160px; border-radius: 8px; overflow: hidden; background: #f1f5f9;">
                <img src="${esc(p.image)}" alt="${esc(p.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <strong style="font-size: 14px; color: var(--text);">${esc(p.name)}</strong>
              <span style="font-size: 16px; font-weight: 800; color: var(--primary);">${money(p.price)}</span>
            </div>
          `).join('')}
        </div></section>` : ''}`;
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