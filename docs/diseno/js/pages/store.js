/* ============================================================
   COMPRALOCAL — PERFIL DE TIENDA  (#store)
   ============================================================ */
(function () {
  const { esc, norm, initials } = window.Utils;
  const { products } = window.Data;

  const P = { tab: 'products', query: '', category: 'Todos' };

  // Igual que la maqueta: La Boutique muestra sus productos; las demás
  // tiendas reutilizan el catálogo de demostración completo.
  function storeProducts(store) {
    return products.filter((p) => p.storeId === store.id || store.id !== 'la-boutique');
  }

  function catalog(store) {
    const list = storeProducts(store).filter((p) =>
      (P.category === 'Todos' || p.category === P.category) && norm(p.name).includes(norm(P.query)));
    return list.length
      ? `<div class="product-grid">${list.map((p) => Cards.product(p)).join('')}</div>`
      : Cards.empty('Sin productos coincidentes', 'Probá otra búsqueda o elegí una categoría diferente.', 'profile-clear');
  }

  function chips(store) {
    const cats = ['Todos', ...new Set(storeProducts(store).map((p) => p.category))];
    return cats.map((c) => `<button type="button" class="${P.category === c ? 'active' : ''}" data-action="profile-cat" data-name="${esc(c)}">${esc(c)}</button>`).join('');
  }

  function tabBody(store) {
    if (P.tab === 'info') {
      return `
      <section class="about-store">
        <div><span>SOBRE NOSOTROS</span><h2>Una tienda con identidad local</h2>
          <p>${esc(store.description)} Seleccionamos cada propuesta con atención y creemos en una forma más cercana de comprar.</p></div>
        <div><span>INFORMACIÓN</span>
          <p>${Icon('location', 16)} Av. Libertador San Martín 1240 (O)</p>
          <p>${Icon('phone', 16)} Contacto disponible en la tienda</p></div>
      </section>`;
    }
    if (P.tab === 'contact') {
      return `
      <section class="profile-contact">
        <div>${Icon('location', 21)}<span><strong>Visitanos</strong>Av. Libertador San Martín 1240 (O), ${esc(store.location)}</span></div>
        <a href="mailto:tienda@compralocal.demo">${Icon('phone', 21)}<span><strong>Contactá al comercio</strong>Respuesta coordinada directamente por la tienda</span></a>
      </section>`;
    }
    return `
      <section class="catalog-section">
        <div class="market-section-heading"><div><span>CATÁLOGO DE DEMOSTRACIÓN</span><h2>Productos de ${esc(store.name)}</h2></div></div>
        <div class="catalog-tools">
          <label class="market-filter-search">${Icon('search', 17)}<input id="profile-query" data-input="profile-query" value="${esc(P.query)}" placeholder="Buscar dentro de esta tienda" aria-label="Buscar dentro de esta tienda" /></label>
          <div id="profile-chips">${chips(store)}</div>
        </div>
        <div id="profile-catalog">${catalog(store)}</div>
      </section>`;
  }

  function full(store) {
    const following = !!window.Store.state.following[store.id];
    const tabs = [['products', 'Productos'], ['info', 'Información'], ['contact', 'Contacto']];
    return `
      <section class="profile-cover"><img src="${esc(store.image)}" alt="Portada de ${esc(store.name)}" /></section>
      <div class="market-container store-profile">
        <section class="store-profile-header">
          <div class="profile-mark" aria-hidden="true">${esc(initials(store.name))}</div>
          <div class="profile-title"><span>${esc(store.category)}</span><h1>${esc(store.name)}</h1>
            <p>${Icon('location', 14)} ${esc(store.location)} · A ${esc(store.distance)}</p></div>
          <button type="button" class="follow-button" data-action="toggle-follow" aria-pressed="${following}">${Icon('heart', 16)} <span id="follow-label">${following ? 'Siguiendo' : 'Seguir tienda'}</span></button>
        </section>
        <nav class="profile-tabs" aria-label="Secciones de la tienda">
          ${tabs.map(([id, label]) => `<button type="button" class="${P.tab === id ? 'active' : ''}" data-action="profile-tab" data-tab="${id}">${label}</button>`).join('')}
        </nav>
        <div id="profile-body">${tabBody(store)}</div>
      </div>`;
  }

  Pages.store = {
    layout: 'market',
    title: 'Tienda — CompraLocal',
    render() {
      const store = window.Store.store();
      document.title = `${store.name} — CompraLocal`;
      return full(store);
    },
    // Reinicia pestaña y filtros al abrir otra tienda
    reset() { Object.assign(P, { tab: 'products', query: '', category: 'Todos' }); },
  };

  Actions['profile-tab'] = (el) => {
    P.tab = el.dataset.tab;
    const store = window.Store.store();
    document.getElementById('profile-body').innerHTML = tabBody(store);
    document.querySelectorAll('.profile-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === P.tab));
  };

  Actions['profile-cat'] = (el) => {
    P.category = el.dataset.name;
    const store = window.Store.store();
    const chipsEl = document.getElementById('profile-chips');
    const catalogEl = document.getElementById('profile-catalog');
    if (chipsEl) chipsEl.innerHTML = chips(store);
    if (catalogEl) catalogEl.innerHTML = catalog(store);
  };

  Actions['profile-clear'] = () => {
    P.query = ''; P.category = 'Todos';
    const store = window.Store.store();
    const bodyEl = document.getElementById('profile-body');
    if (bodyEl) bodyEl.innerHTML = tabBody(store);
  };

  Inputs['profile-query'] = (el) => {
    P.query = el.value;
    const catalogEl = document.getElementById('profile-catalog');
    if (catalogEl) catalogEl.innerHTML = catalog(window.Store.store());
  };

  Actions['toggle-follow'] = (el) => {
    const id = window.Store.state.storeId;
    const on = window.Store.toggle('following', id);
    el.setAttribute('aria-pressed', on);
    const labelEl = document.getElementById('follow-label');
    if (labelEl) labelEl.textContent = on ? 'Siguiendo' : 'Seguir tienda';
  };
})();