/* ============================================================
   COMPRALOCAL — PRODUCT DETAIL PAGE (#product)
   ============================================================ */
(function () {
  const Pages = window.Pages || {};

  Pages.product = {
    layout: 'market',
    title: 'Detalle de Producto — CompraLocal',

    render() {
      const productId = window.Store?.state?.productId || 'remera-basica';
      const product = window.Data?.products.find(p => p.id === productId) || window.Data?.products[0] || {
        id: productId, name: 'Producto local', price: 15000, category: 'General', storeId: 'la-boutique', image: ''
      };
      
      const store_data = window.Data?.stores.find(s => s.id === product.storeId) || window.Data?.stores[0];
      
      // Productos de la misma tienda (excluyendo el producto actual)
      const storeProducts = window.Data?.products.filter(p => p.storeId === product.storeId && p.id !== product.id).slice(0, 4) || [];
      
      // Productos de la misma categoría
      const categoryProducts = window.Data?.products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4) || [];

      const price = window.Utils.money(product.price);
      const originalPrice = product.priceOriginal ? window.Utils.money(product.priceOriginal) : null;
      const discount = product.priceOriginal
        ? Math.round((1 - product.price / product.priceOriginal) * 100)
        : null;

      const stockStatus = (product.stock || 15) > 10 ? 'in-stock'
        : (product.stock || 15) > 0 ? 'low-stock'
        : 'out-of-stock';

      const stockLabel = stockStatus === 'in-stock' ? '✓ En stock'
        : stockStatus === 'low-stock' ? `⚠ Últimas ${product.stock} unidades`
        : '✕ Sin stock';

      // Verificar si el producto está en favoritos del usuario
      const s = window.Store?.state || {};
      const favoriteProducts = s.favoriteProducts || [];
      const isFavorite = favoriteProducts.includes(product.id);
      const orangeColor = '#fd6910';

      // Recopilar atributos específicos/dinámicos si existen
      const attributesHtml = product.attributes && typeof product.attributes === 'object' && Object.keys(product.attributes).length > 0
        ? Object.entries(product.attributes).map(([key, val]) => `<li><strong>${window.Utils.esc(key)}:</strong> ${window.Utils.esc(val)}</li>`).join('')
        : '';

      return `
        <div class="page-wrapper page-enter" style="padding-top: 24px; padding-bottom: 60px;">
          <div class="market-container">
            <!-- Breadcrumb en línea horizontal -->
            <nav class="breadcrumb" aria-label="Navegación de migas" style="margin-bottom: var(--space-5); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px;">
              <a href="#marketplace" style="color: var(--primary); text-decoration: none;">Volver</a>
              <span style="color: var(--border);">|</span>
              <a href="#marketplace" style="color: var(--text-secondary); text-decoration: none;">Inicio</a>
              <span style="color: var(--muted);" aria-hidden="true">›</span>
              <a data-action="open-category" data-name="${window.Utils.esc(product.category)}" style="color: var(--text-secondary); text-decoration: none; cursor: pointer;">
                ${window.Utils.esc(product.category)}
              </a>
              <span style="color: var(--muted);" aria-hidden="true">›</span>
              <span style="color: var(--muted); font-weight: 600;" aria-current="page">${window.Utils.esc(product.name)}</span>
            </nav>

            <!-- Product Grid Estilo MercadoLibre -->
            <div class="product-detail-grid" style="display: grid; grid-template-columns: 1fr 380px; gap: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
              
              <!-- Galería e Información Izquierda -->
              <div>
                <div style="width:100%; height: 400px; border-radius: 12px; overflow:hidden; background: #f8fafc; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                  <img src="${window.Utils.esc(product.image)}" alt="${window.Utils.esc(product.name)}" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>

                <!-- Atributos / Lo que tenés que saber -->
                <div style="margin-top: 32px; border-top: 1px solid var(--border); padding-top: 24px;">
                  <h3 style="font-size: 18px; font-weight: 800; color: var(--text); margin-bottom: 16px;">Características del producto</h3>
                  <ul style="padding-left: 20px; font-size: 14px; line-height: 1.8; color: #334155;">
                    <li>Cantidad: 1 unidad.</li>
                    <li>Comercio certificado de ${store_data ? store_data.location : 'San Juan'}.</li>
                    <li>Envío unificado a domicilio en toda la provincia por $2.999.</li>
                    <li>Garantía directa del vendedor.</li>
                    ${product.brand ? `<li>Marca: ${window.Utils.esc(product.brand)}</li>` : ''}
                    ${product.sku ? `<li>SKU / Código: ${window.Utils.esc(product.sku)}</li>` : ''}
                    ${product.condition ? `<li>Estado: ${window.Utils.esc(product.condition)}</li>` : ''}
                    ${attributesHtml}
                  </ul>
                </div>

                <!-- Descripción -->
                <div style="margin-top: 32px; border-top: 1px solid var(--border); padding-top: 24px;">
                  <h3 style="font-size: 18px; font-weight: 800; color: var(--text); margin-bottom: 12px;">Descripción</h3>
                  <p style="color: var(--text-secondary); line-height: var(--leading-relaxed); font-size: 14px;">
                    ${window.Utils.esc(product.description || 'Producto elaborado y comercializado por comercios locales de San Juan, verificados en la plataforma CompraLocal.')}
                  </p>
                </div>
              </div>

              <!-- Panel Derecho (Compra / Vendedor) -->
              <div>
                <div style="border: 1px solid var(--border); border-radius: 12px; padding: 20px; background: var(--bg); position: sticky; top: 90px; display: flex; flex-direction: column; gap: 16px;">
                  
                  <div>
                    <span style="font-size: 11px; color: var(--muted); font-weight: 600;">Nuevo | +50 vendidos</span>
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin: 6px 0 12px 0;">
                      <h1 style="font-size: 22px; font-weight: 800; color: var(--text); margin: 0; line-height: 1.2;">${window.Utils.esc(product.name)}</h1>
                      <!-- Icono de favorito al lado del nombre -->
                      <button type="button" class="${isFavorite ? 'saved' : ''}" data-action="toggle-product-save" data-id="${product.id}" aria-pressed="${isFavorite}" aria-label="${isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; color: ${isFavorite ? orangeColor : '#64748b'}; flex-shrink: 0;" title="${isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="${isFavorite ? orangeColor : 'none'}" stroke="${isFavorite ? orangeColor : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                      </button>
                    </div>
                  </div>

                  <!-- Price -->
                  <div class="product-price-block">
                    <span class="product-price-main" style="font-size: 32px; font-weight: 900; color: var(--primary);">${price}</span>
                    ${originalPrice ? `<span class="product-price-original" style="text-decoration: line-through; color: var(--muted); margin-left: 8px;">${originalPrice}</span>` : ''}
                    ${discount ? `<span class="product-price-discount" style="background: #dc2626; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800; margin-left: 6px;">-${discount}% OFF</span>` : ''}
                  </div>

                  <!-- Stock -->
                  <div class="product-stock ${stockStatus}" style="font-size: 13px; font-weight: 700; color: #16a34a;">
                    ${stockLabel}
                  </div>

                  <!-- Banner Envío San Juan -->
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px;">
                    <div style="font-weight: 800; font-size: 13px; color: #15803d;">Envío a domicilio por $2.999</div>
                    <p style="font-size: 11px; color: #166534; margin: 4px 0 0 0;">Entrega directa a la puerta de tu casa en San Juan.</p>
                  </div>

                  <!-- Acciones de compra -->
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <!-- Botón 1: Comprar ahora (Color azul, sin emojis) -->
                    <button type="button" class="btn" style="width: 100%; height: 44px; font-weight: 800; cursor: pointer; background: #09305f; color: #fff; border: none; border-radius: 8px;" data-action="buy-now-redirect" data-id="${product.id}">
                      Comprar ahora
                    </button>

                    <!-- Botón 2: Agregar al carrito (Mismo color del fondo / superficie) -->
                    <button type="button" class="btn" style="width: 100%; height: 44px; font-weight: 800; cursor: pointer; background: var(--surface, #fff); color: var(--text); border: 1px solid var(--border, #cbd5e1); border-radius: 8px;" data-action="add-to-cart" data-id="${product.id}">
                      Agregar al carrito
                    </button>
                  </div>

                  <!-- Store card mini (Nombre de la tienda como enlace directo) -->
                  ${store_data ? `
                    <div style="border-top: 1px solid var(--border); padding-top: 16px;">
                      <span style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase;">Vendido por</span>
                      <div style="margin-top: 6px;">
                        <a data-action="open-store" data-id="${store_data.id}" style="font-weight: 800; font-size: 14px; color: var(--primary); text-decoration: none; cursor: pointer; display: block;">${window.Utils.esc(store_data.name)}</a>
                        <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${window.Utils.esc(store_data.location)}</div>
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>

            </div>

            <!-- Fila 1: Más productos de la misma tienda -->
            ${storeProducts.length > 0 ? `
              <div style="margin-top: 48px;">
                <div class="market-section-heading">
                  <div><span>DEL MISMO COMERCIO</span><h2>Más productos de ${window.Utils.esc(store_data ? store_data.name : 'esta tienda')}</h2></div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 16px;">
                  ${storeProducts.map(p => `
                    <div class="product-card" data-action="open-product" data-id="${window.Utils.esc(p.id)}" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 8px;">
                      <div style="width: 100%; height: 150px; border-radius: 8px; overflow: hidden; background: #f1f5f9;">
                        <img src="${window.Utils.esc(p.image)}" alt="${window.Utils.esc(p.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
                      </div>
                      <strong style="font-size: 14px; color: var(--text);">${window.Utils.esc(p.name)}</strong>
                      <span style="font-size: 16px; font-weight: 800; color: var(--primary);">${window.Utils.money(p.price)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Fila 2: Productos relacionados a la misma categoría -->
            ${categoryProducts.length > 0 ? `
              <div style="margin-top: 48px;">
                <div class="market-section-heading">
                  <div><span>MISMA CATEGORÍA</span><h2>Productos relacionados en ${window.Utils.esc(product.category)}</h2></div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 16px;">
                  ${categoryProducts.map(p => `
                    <div class="product-card" data-action="open-product" data-id="${window.Utils.esc(p.id)}" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 8px;">
                      <div style="width: 100%; height: 150px; border-radius: 8px; overflow: hidden; background: #f1f5f9;">
                        <img src="${window.Utils.esc(p.image)}" alt="${window.Utils.esc(p.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
                      </div>
                      <strong style="font-size: 14px; color: var(--text);">${window.Utils.esc(p.name)}</strong>
                      <span style="font-size: 16px; font-weight: 800; color: var(--primary);">${window.Utils.money(p.price)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    },
  };

  window.Actions = window.Actions || {};

  // Acción exclusiva para "Comprar ahora"
  window.Actions['buy-now-redirect'] = (el) => {
    let p = null;
    const productId = el?.dataset?.id || window.Store?.state?.productId;
    if (productId && window.Data && window.Data.products) {
      p = window.Data.products.find(prod => prod.id === productId);
    }
    if (!p && typeof window.Store?.product === 'function') {
      p = window.Store.product();
    }

    if (p && window.CartManager) {
      window.CartManager.add(p, 1);
      window.Store.set({ cartOpen: false });
      window.location.hash = 'cart';
    }
  };
})();