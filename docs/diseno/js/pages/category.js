/* ============================================================
   COMPRALOCAL — RUBROS  (#categories)
   ============================================================ */
(function () {
  const { esc, norm } = window.Utils;
  const { categories, stores } = window.Data;

  function grid(filter) {
    const list = categories.filter((c) => norm(c.name + c.description).includes(norm(filter)));
    if (!list.length) {
      return Cards.empty('No encontramos ese rubro', 'Probá con otra palabra o revisá todos los rubros disponibles.', 'clear-categories');
    }

    return `<div class="category-page-grid">${list.map((c) => {
      // Contar de forma dinámica las tiendas que pertenecen a este rubro
      const storeCount = stores ? stores.filter(s => s.category && s.category.toLowerCase().trim() === c.name.toLowerCase().trim()).length : (c.count || 0);

      return `
      <button data-action="open-category" data-name="${esc(c.name)}">
        <i>${Icon(c.icon || 'grid', 28)}</i>
        <div>
          <h2>${esc(c.name)}</h2>
          <p>${esc(c.description)}</p>
          <span>${storeCount} ${storeCount === 1 ? 'comercio' : 'comercios'} ${Icon('arrow', 14)}</span>
        </div>
      </button>`;
    }).join('')}</div>`;
  }

  Pages.categories = {
    layout: 'market',
    title: 'Rubros — CompraLocal',

    render() {
      return `
      <div class="market-container market-page">
        <div class="market-page-heading">
          <span>RUBROS LOCALES</span>
          <h1>Explorá todos los rubros</h1>
          <p>Encontrá comercios por categoría y conocé las propuestas disponibles en tu ciudad.</p>
        </div>
        <label class="market-filter-search">${Icon('search', 18)}<input id="category-filter" data-input="category-filter" placeholder="Buscar un rubro" aria-label="Buscar un rubro" /></label>
        <div id="category-results">${grid('')}</div>
      </div>`;
    },
  };

  Inputs['category-filter'] = (el) => {
    document.getElementById('category-results').innerHTML = grid(el.value);
  };

  Actions['clear-categories'] = () => {
    const input = document.getElementById('category-filter');
    if (input) input.value = '';
    document.getElementById('category-results').innerHTML = grid('');
  };
})();