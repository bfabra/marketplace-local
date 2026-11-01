/* ============================================================
   COMPRALOCAL — LISTADO DE TIENDAS  (#stores)
   ============================================================ */
(function () {
  const { esc, norm } = window.Utils;
  const { categories, stores } = window.Data;

  // Filtros locales de la pantalla (se reinician al entrar)
  const F = { query: '', category: '' };

  function filtered() {
    return stores.filter((s) =>
      (!F.query || norm(s.name + s.description).includes(norm(F.query))) &&
      (!F.category || s.category === F.category)
    ).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  function results() {
    const list = filtered();
    return `
      <div class="result-summary"><strong>${list.length} comercios</strong><span>Contenido demostrativo</span></div>
      ${list.length
        ? `<div class="stores-page-grid">${list.map((s) => Cards.store(s)).join('')}</div>`
        : Cards.empty('No encontramos comercios', 'No hay coincidencias para los filtros seleccionados. Probá ampliando la búsqueda.', 'clear-stores')}`;
  }

  const options = (items, selected) => items
    .map((i) => `<option${i === selected ? ' selected' : ''}>${esc(i)}</option>`).join('');

  Pages.stores = {
    layout: 'market',
    title: 'Tiendas — CompraLocal',

    render() {
      const s = window.Store.state;
      Object.assign(F, { query: '', category: s.category });
      return `
      <div class="market-container market-page">
        <div class="market-page-heading">
          <span>COMERCIOS LOCALES</span>
          <h1>Tiendas</h1>
          <p>Explorá comercios registrados y entrá a cada tienda para conocer su historia y sus productos.</p>
        </div>
        <div class="store-tools">
          <label class="market-filter-search">${Icon('search', 18)}<input id="stores-query" data-input="stores-query" placeholder="Buscar por nombre de tienda" aria-label="Buscar por nombre de tienda" /></label>
          <select id="stores-category" data-input="stores-category" aria-label="Rubro"><option value="">Todos los rubros</option>${options(categories.slice(0, -1).map((c) => c.name), F.category)}</select>
        </div>
        <div id="stores-results">${results()}</div>
      </div>`;
    },
  };

  const refresh = () => { document.getElementById('stores-results').innerHTML = results(); };

  Inputs['stores-query'] = (el) => { F.query = el.value; refresh(); };
  Inputs['stores-category'] = (el) => { F.category = el.value; window.Store.state.category = el.value; refresh(); };

  Actions['clear-stores'] = () => {
    Object.assign(F, { query: '', category: '' });
    window.Store.state.category = '';
    document.getElementById('stores-query').value = '';
    document.getElementById('stores-category').value = '';
    refresh();
  };
})();