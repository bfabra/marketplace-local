/* ============================================================
   COMPRALOCAL — INICIO MARKETPLACE  (#marketplace)
   ============================================================ */
(function () {
  const { esc, money } = window.Utils;
  const { categories, stores, products, photos } = window.Data;

  Pages.marketplace = {
    layout: 'market',
    title: 'CompraLocal — Marketplace de Comercios Locales · San Juan',

    render() {
      const q = window.Store.state.query;

      // 1. RUBROS / CATEGORÍAS (7 principales + tarjeta 'Más categorías')
      const top7Categories = categories.slice(0, 7);
      const categoriesHtml = top7Categories.map((c) => {
        const count = c.count !== undefined ? c.count : (c.subcategories ? c.subcategories.length : 0);
        return `
          <button data-action="open-category" data-name="${esc(c.name)}">
            <i>${Icon(c.icon || 'grid', 22)}</i>
            <strong>${esc(c.name)}</strong>
            <span>${count} ${count === 1 ? 'tienda' : 'tiendas'}</span>
          </button>`;
      }).join('');

      const moreCategoryHtml = `
        <button data-go="categories">
          <i style="color: var(--primary, #fd6910);">${Icon('grid', 22)}</i>
          <strong style="color: var(--primary, #fd6910);">Más categorías</strong>
          <span>Ver todos (${categories.length})</span>
        </button>`;

      // 2. TIENDAS DESTACADAS (Carrusel)
      const featuredStores = stores.slice(0, 10);
      const storesCardsHtml = featuredStores.map((s) => `
        <div class="store-card-wrapper" data-action="open-store" data-id="${esc(s.id)}" style="min-width: calc(33.333% - 8px); flex: 0 0 auto; cursor: pointer;">
          ${Cards.store(s)}
        </div>
      `).join('');

      // 3. TIENDAS SEPARADAS POR RUBRO (8 tiendas max, de más nuevas a más antiguas, 2 filas x 4 columnas)
      const topRubros = categories.slice(0, 5);
      const storesByRubroHtml = topRubros.map(cat => {
        // Filtramos por rubro y ordenamos de más nuevas a más antiguas (invertimos o usamos id/isNew si aplica)
        const rubroStores = stores
          .filter(s => s.category && s.category.toLowerCase().includes(cat.name.toLowerCase().substring(0, 5)))
          .reverse() // De más nuevas a más antiguas
          .slice(0, 8); // Máximo 8 tiendas

        if (rubroStores.length === 0) return '';

        const rubroCards = rubroStores.map(s => Cards.store(s)).join('');
        return `
          <section class="market-section" style="margin-top: 36px;">
            <div class="market-section-heading">
              <div>
                <span>RUBRO DESTACADO</span>
                <h2>${esc(cat.name)}</h2>
              </div>
              <button data-action="open-category" data-name="${esc(cat.name)}">Ver más ${Icon('arrow', 15)}</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
              ${rubroCards}
            </div>
            <div style="text-align: center; margin-top: 20px;">
              <button data-action="open-category" data-name="${esc(cat.name)}" style="background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'; this.style.color='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text)'">
                Ver más tiendas de ${esc(cat.name)} &rsaquo;
              </button>
            </div>
          </section>
        `;
      }).join('');

      // 4. OFERTAS IMPERDIBLES (Carrusel automático + manual)
      const offerProducts = products.slice(0, 8); // Más productos para el carrusel
      const offersHtml = offerProducts.map(p => {
        const storeObj = stores.find(s => s.id === p.storeId) || stores[0];
        const oldPrice = Math.round(p.price * 1.25);
        return `
          <div class="product-card" data-action="open-product" data-id="${esc(p.id)}" style="min-width: 240px; flex: 0 0 auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 8px; position: relative;">
            <span style="position: absolute; top: 18px; left: 18px; background: #dc2626; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; z-index: 2;">20% OFF</span>
            <div style="width: 100%; height: 160px; border-radius: 8px; overflow: hidden; background: #f1f5f9; pointer-events: none;">
              <img src="${esc(p.image)}" alt="${esc(p.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <strong style="font-size: 14px; color: var(--text); pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(p.name)}</strong>
            <div style="display: flex; align-items: baseline; gap: 8px; pointer-events: none;">
              <span style="font-size: 16px; font-weight: 800; color: var(--primary);">${money(p.price)}</span>
              <span style="font-size: 12px; color: var(--muted); text-decoration: line-through;">${money(oldPrice)}</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 6px; margin-top: 4px; pointer-events: none;">
              <small style="font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px;">${Icon('location', 12)} ${esc(storeObj.location)}</small>
              <small style="font-size: 11px; font-weight: 700; color: #16a34a;">Envío $2.999</small>
            </div>
          </div>
        `;
      }).join('');

      // 6. PRODUCTOS DIFERENCIADOS POR CATEGORÍA (8 productos max, 2 filas x 4 columnas en desktop, adaptable en móvil)
      const popularCategoriesWithProducts = ['Indumentaria y moda', 'Hogar y decoración', 'Salud y cuidado personal'];
      const productsByCategoryHtml = popularCategoriesWithProducts.map((catName) => {
        const catProducts = products.filter(p => {
          if (catName === 'Indumentaria y moda') return p.category === 'Indumentaria' || p.category === 'Calzado' || p.category === 'Accesorios';
          if (catName === 'Hogar y decoración') return p.category === 'Decoración';
          if (catName === 'Salud y cuidado personal') return p.category === 'Belleza';
          return false;
        }).slice(0, 8); // Máximo 8 productos

        if (catProducts.length === 0) return '';

        const cardsHtml = catProducts.map(p => {
          const storeObj = stores.find(s => s.id === p.storeId) || stores[0];
          return `
            <div class="product-card" data-action="open-product" data-id="${esc(p.id)}" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 8px;">
              <div style="width: 100%; height: 160px; border-radius: 8px; overflow: hidden; background: #f1f5f9; pointer-events: none;">
                <img src="${esc(p.image)}" alt="${esc(p.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <strong style="font-size: 14px; color: var(--text); pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(p.name)}</strong>
              <span style="font-size: 16px; font-weight: 800; color: var(--primary); pointer-events: none;">${money(p.price)}</span>
              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 6px; margin-top: 4px; pointer-events: none;">
                <small style="font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px;">${Icon('location', 12)} ${esc(storeObj.location)}</small>
                <small style="font-size: 11px; font-weight: 700; color: #16a34a;">Envío $2.999</small>
              </div>
            </div>
          `;
        }).join('');

        return `
          <section class="market-section" style="margin-top: 36px;">
            <div class="market-section-heading">
              <div><span>DESTACADOS EN SECTOR</span><h2>${esc(catName)}</h2></div>
              <button data-action="open-category" data-name="${esc(catName)}">Ver más ${Icon('arrow', 15)}</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
              ${cardsHtml}
            </div>
          </section>
        `;
      }).join('');

      return `
      <!-- ESTILOS DE ANIMACIÓN Y CARRUSELES -->
      <style>
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .moving-banner-wrapper {
          overflow: hidden;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 12px 0;
          white-space: nowrap;
          position: relative;
          display: flex;
          width: 100%;
        }
        .moving-banner-track {
          display: flex;
          width: max-content;
          animation: marqueeScroll 25s linear infinite;
          will-change: transform;
        }
        .moving-banner-wrapper:hover .moving-banner-track {
          animation-play-state: paused;
        }
        .moving-banner-group {
          display: flex;
          align-items: center;
          gap: 40px;
          padding-right: 40px;
        }
        .moving-banner-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          flex-shrink: 0;
        }
        /* Ocultar barra de scroll en carruseles */
        .auto-scroll-track::-webkit-scrollbar {
          display: none;
        }
      </style>

      <!-- HERO PRINCIPAL -->
      <section class="market-hero" style="background-image:url('${photos.storefront}')">
        <div class="market-hero-overlay"></div>
        <div class="market-hero-content">
          <span>TODO CERCA TUYO · ENVÍO ÚNICO $2.999</span>
          <h1>Descubrí los comercios<br />de tu zona en San Juan</h1>
          <p>Negocios reales de la provincia, con entrega directa a la puerta de tu casa.</p>
          <form data-form="search" role="search">
            ${Icon('search')}
            <input data-input="query" value="${esc(q)}" placeholder="¿Qué comercio, rubro o producto buscás?" aria-label="Buscar comercio, rubro o producto" />
            <button type="submit">Buscar</button>
          </form>
          <small>${Icon('location', 14)} Comercios verificados en San Juan</small>
        </div>
      </section>

      <!-- MINI BANNER CON MOVIMIENTO CONTINUO -->
      <div class="moving-banner-wrapper">
        <div class="moving-banner-track">
          <div class="moving-banner-group">
            <div class="moving-banner-item">🚚 Envío a domicilio en San Juan por solo <strong>$2.999</strong></div>
            <div class="moving-banner-item">📍 Negocios 100% locales y reales</div>
            <div class="moving-banner-item">⚡ Recibí tu compra sin moverte</div>
            <div class="moving-banner-item">🛍️ Apoyá a los emprendedores de la provincia</div>
            <div class="moving-banner-item">🚚 Envío a domicilio en San Juan por solo <strong>$2.999</strong></div>
            <div class="moving-banner-item">📍 Negocios 100% locales y reales</div>
            <div class="moving-banner-item">⚡ Recibí tu compra sin moverte</div>
            <div class="moving-banner-item">🛍️ Apoyá a los emprendedores de la provincia</div>
          </div>
          <div class="moving-banner-group">
            <div class="moving-banner-item">🚚 Envío a domicilio en San Juan por solo <strong>$2.999</strong></div>
            <div class="moving-banner-item">📍 Negocios 100% locales y reales</div>
            <div class="moving-banner-item">⚡ Recibí tu compra sin moverte</div>
            <div class="moving-banner-item">🛍️ Apoyá a los emprendedores de la provincia</div>
            <div class="moving-banner-item">🚚 Envío a domicilio en San Juan por solo <strong>$2.999</strong></div>
            <div class="moving-banner-item">📍 Negocios 100% locales y reales</div>
            <div class="moving-banner-item">⚡ Recibí tu compra sin moverte</div>
            <div class="moving-banner-item">🛍️ Apoyá a los emprendedores de la provincia</div>
          </div>
        </div>
      </div>

      <!-- CONTENEDOR PRINCIPAL -->
      <div class="market-container" style="padding-bottom: 60px;">
        
        <!-- 1. EXPLORÁ POR RUBRO -->
        <section class="market-section">
          <div class="market-section-heading">
            <div><span>EXPLORÁ POR RUBRO</span><h2>Encontrá lo que necesitás</h2></div>
            <button data-go="categories">Ver más ${Icon('arrow', 15)}</button>
          </div>
          <div class="home-category-grid" style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 12px; padding-top: 8px; overflow: visible;">
            ${categoriesHtml}
            ${moreCategoryHtml}
          </div>
        </section>

        <!-- 2. TIENDAS DESTACADAS (Carrusel) -->
        <section class="market-section" style="position: relative; margin-top: 32px;">
          <div class="market-section-heading">
            <div><span>SELECCIÓN LOCAL</span><h2>Tiendas destacadas</h2><p>Conocé los comercios reales que confían en CompraLocal.</p></div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn secondary" data-action="scroll-carousel" data-target="featured-carousel" data-direction="left" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; display: grid; place-items: center; cursor: pointer;" title="Anterior">&lsaquo;</button>
              <button type="button" class="btn secondary" data-action="scroll-carousel" data-target="featured-carousel" data-direction="right" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; display: grid; place-items: center; cursor: pointer;" title="Siguiente">&rsaquo;</button>
            </div>
          </div>
          <div id="featured-carousel" style="display: flex; gap: 12px; overflow-x: auto; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 4px;">
            ${storesCardsHtml}
          </div>
        </section>

        <!-- 3. TIENDAS SEPARADAS POR RUBRO -->
        ${storesByRubroHtml}

        <!-- 4. OFERTAS IMPERDIBLES (Carrusel automático + manual) -->
        <section class="market-section" style="position: relative; margin-top: 36px;">
          <div class="market-section-heading">
            <div><span>⚡ APROVECHÁ HOY</span><h2>Ofertas imperdibles</h2><p>Precios especiales de comercios cercanos con envío rápido.</p></div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn secondary" data-action="scroll-carousel" data-target="offers-carousel" data-direction="left" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; display: grid; place-items: center; cursor: pointer;" title="Anterior">&lsaquo;</button>
              <button type="button" class="btn secondary" data-action="scroll-carousel" data-target="offers-carousel" data-direction="right" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; display: grid; place-items: center; cursor: pointer;" title="Siguiente">&rsaquo;</button>
            </div>
          </div>
          <div id="offers-carousel" class="auto-scroll-track" style="display: flex; gap: 16px; overflow-x: auto; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 4px;">
            ${offersHtml}
          </div>
        </section>

        <!-- 5. BANNER PROMOCIONAL INTERMEDIO (PARA COMERCIANTES) -->
        <section style="margin: 40px 0; background: linear-gradient(135deg, #fd6910 0%, #ff8c42 100%); border-radius: 16px; padding: 32px; color: #fff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
          <div style="max-width: 600px;">
            <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">¿Tenés un negocio en San Juan?</span>
            <h2 style="font-size: 24px; font-weight: 800; margin: 8px 0 6px 0; color: #fff;">Sumá tu comercio a CompraLocal</h2>
            <p style="font-size: 14px; opacity: 0.9; margin: 0;">Llegá a más clientes en toda la provincia con envíos gestionados y cobros seguros. ¡Creá tu tienda en minutos!</p>
          </div>
          <button type="button" data-go="signup" style="background: #fff; color: #fd6910; border: none; font-weight: 800; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            Crear mi comercio gratis &rsaquo;
          </button>
        </section>

        <!-- 6. NUEVOS COMERCIOS -->
        <section class="market-section new-stores-section">
          <div class="market-section-heading"><div><span>RECIÉN LLEGADOS</span><h2>Nuevos comercios</h2></div></div>
          <div class="new-store-grid">${stores.filter((s) => s.isNew).map((s) => Cards.store(s, { compact: true })).join('')}</div>
        </section>

        <!-- 7. PRODUCTOS DIFERENCIADOS POR CATEGORÍA -->
        ${productsByCategoryHtml}
      </div>`;
    },

    mount(root) {
      // 1. Control de scroll manual para los carruseles
      window.Actions = window.Actions || {};
      window.Actions['scroll-carousel'] = (el) => {
        const targetId = el.dataset.target;
        const container = root.querySelector('#' + targetId);
        if (!container) return;
        const direction = el.dataset.direction;
        const scrollAmount = 350;

        if (direction === 'left') {
          container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        } else {
          container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
      };

      // 2. Desplazamiento automático (autoplay) para el carrusel de ofertas imperdibles
      const offersTrack = root.querySelector('#offers-carousel');
      if (offersTrack) {
        let autoScrollInterval = setInterval(() => {
          if (!document.body.contains(offersTrack)) {
            clearInterval(autoScrollInterval);
            return;
          }
          // Si llega al final, vuelve al inicio; sino avanza 280px
          if (offersTrack.scrollLeft + offersTrack.clientWidth >= offersTrack.scrollWidth - 10) {
            offersTrack.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            offersTrack.scrollBy({ left: 280, behavior: 'smooth' });
          }
        }, 3500); // Pasa cada 3.5 segundos

        // Pausar autoplay cuando el cursor esté encima del carrusel de ofertas
        offersTrack.addEventListener('mouseenter', () => clearInterval(autoScrollInterval));
      }
    }
  };
})();