/* ============================================================
   COMPRALOCAL — MÓDULO VISUAL DE RESEÑAS Y PRESTIGIO
   Componentes modulares de reputación para productos y comercios.
   ============================================================ */
(function () {
  const { esc } = window.Utils || { esc: (s) => s || '' };

  /**
   * Helper de representación de estrellas SVG
   */
  function renderStarsHtml(rating = 0, size = 16, color = '#f59e0b') {
    const fullStars = Math.floor(rating);
    const hasHalf = (rating - fullStars) >= 0.5;
    let html = '<div class="star-rating-display" style="display: inline-flex; align-items: center; gap: 2px;">';
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>`;
      } else if (i === fullStars + 1 && hasHalf) {
        html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5">
          <defs>
            <linearGradient id="half-star-${rating}-${i}">
              <stop offset="50%" stop-color="${color}" />
              <stop offset="50%" stop-color="#cbd5e1" stop-opacity="1" />
            </linearGradient>
          </defs>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#half-star-${rating}-${i})" stroke="${color}" />
        </svg>`;
      } else {
        html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>`;
      }
    }
    html += '</div>';
    return html;
  }

  // ============================================================
  // COMPONENTE DE PRESTIGIO DE COMERCIO
  // ============================================================
  window.Reputation = {
    renderStars: renderStarsHtml,

    /**
     * Renderiza la insignia de reputación del comercio en cualquier contexto:
     * - Tarjetas de directorio y home
     * - Cabecera de la ficha de tienda
     * - Bloque "Vendido por" dentro de la ficha de producto
     * - Panel comercial
     */
    renderBadge(store, { showLink = false, size = 'sm' } = {}) {
      if (!store) return '';
      const rating = typeof store.rating === 'number' && store.rating > 0 ? store.rating : null;
      const count = typeof store.ratingCount === 'number' ? store.ratingCount : 0;
      const fontSize = size === 'lg' ? '15px' : size === 'md' ? '13px' : '12px';
      const starSize = size === 'lg' ? 18 : size === 'md' ? 15 : 13;

      if (!rating || count === 0) {
        return `
          <div class="store-reputation-badge unrated" style="display: inline-flex; align-items: center; gap: 6px; font-size: ${fontSize}; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 6px;" title="Comercio nuevo o sin valoraciones aún">
            ${renderStarsHtml(0, starSize)}
            <span style="font-weight: 600; color: #64748b;">Sin valoraciones</span>
          </div>`;
      }

      return `
        <div class="store-reputation-badge rated" style="display: inline-flex; align-items: center; gap: 6px; font-size: ${fontSize}; color: #0f172a; background: #fffbeb; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 6px;" title="Puntuación promedio basada en compradores verificados">
          ${renderStarsHtml(rating, starSize)}
          <strong style="color: #92400e; font-weight: 800;">${rating.toFixed(1)}</strong>
          <span style="color: #78350f; font-weight: 500;">(${count} ${count === 1 ? 'opinión' : 'opiniones'})</span>
        </div>`;
    },

    /**
     * Renderiza el bloque interactivo de valoración de la tienda (para clientes)
     */
    renderStoreRatingModal(store) {
      if (!store) return '';
      return `
        <div class="modal-card" style="max-width: 480px; width: 100%; padding: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <h3 style="font-size: 18px; font-weight: 800; color: var(--text); margin: 0;">Valorar atención de ${esc(store.name)}</h3>
            <button type="button" class="modal-close" data-action="close-modal" aria-label="Cerrar">&times;</button>
          </div>
          
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
            Tu calificación ayuda a otros vecinos a comprar con confianza en comercios de San Juan.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; text-align: center;">
            <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px;">CALIFICACIÓN GENERAL</div>
            <div style="display: flex; justify-content: center; gap: 8px; font-size: 28px; color: #cbd5e1; cursor: not-allowed;">
              <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
            </div>
            <small style="display: block; font-size: 11px; color: #64748b; margin-top: 6px;">Seleccioná de 1 a 5 estrellas</small>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 6px;">
              Comentario sobre tu experiencia (opcional)
            </label>
            <textarea disabled placeholder="Contá cómo fue la atención, puntualidad o entrega del comercio..." style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 13px; background: #f8fafc; resize: none;"></textarea>
          </div>

          <!-- Aviso de verificación de compra -->
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; gap: 10px; align-items: flex-start;">
            <span style="color: #2563eb; font-size: 16px; line-height: 1;">ℹ</span>
            <div style="font-size: 12px; color: #1e40af; line-height: 1.4;">
              <strong>Verificación de compra requerida:</strong> Solo los compradores con un pedido efectivamente entregado o retirado pueden calificar este comercio. La votación se habilitará automáticamente cuando la base de datos de pedidos esté conectada.
            </div>
          </div>

          <button type="button" disabled class="btn" style="width: 100%; height: 42px; background: #94a3b8; color: #fff; border: none; border-radius: 8px; font-weight: 800; cursor: not-allowed;">
            Guardar valoración (Deshabilitado temporalmente)
          </button>
        </div>
      `;
    }
  };

  // ============================================================
  // COMPONENTE DE RESEÑAS VERIFICADAS DE PRODUCTO
  // ============================================================
  window.Reviews = {
    renderStars: renderStarsHtml,

    /**
     * Renderiza la sección completa de opiniones y formulario en la ficha de producto.
     * Siempre se muestra, con o sin comentarios existentes.
     */
    renderProductReviewsSection(product) {
      if (!product) return '';
      
      // Consultamos si existen reseñas en el producto (por ahora colección vacía real)
      const reviews = Array.isArray(product.reviews) ? product.reviews : [];
      const totalReviews = reviews.length;
      
      // Cálculo de promedios reales (sin datos inventados)
      const avgRating = totalReviews > 0
        ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / totalReviews)
        : 0;

      return `
        <section class="product-reviews-section" style="margin-top: 48px; border-top: 2px solid var(--border); padding-top: 36px;">
          
          <!-- Encabezado de la sección -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
            <div>
              <span style="font-size: 12px; font-weight: 800; color: #fd6910; text-transform: uppercase; letter-spacing: 0.5px;">Opiniones reales de la comunidad</span>
              <h2 style="font-size: 22px; font-weight: 800; color: var(--text); margin: 4px 0 0 0;">Opiniones y reseñas de compradores</h2>
            </div>
            
            ${totalReviews > 0 ? `
              <div style="display: flex; align-items: center; gap: 12px; background: #fffbeb; border: 1px solid #fde68a; padding: 8px 16px; border-radius: 8px;">
                <span style="font-size: 28px; font-weight: 900; color: #92400e; line-height: 1;">${avgRating.toFixed(1)}</span>
                <div>
                  ${renderStarsHtml(avgRating, 18)}
                  <small style="display: block; font-size: 11px; color: #78350f; font-weight: 600; margin-top: 2px;">Promedio entre ${totalReviews} ${totalReviews === 1 ? 'opinión' : 'opiniones'}</small>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Cuerpo: Lista de comentarios o Estado Vacío Real -->
          <div class="product-reviews-container" style="margin-bottom: 40px;">
            ${totalReviews === 0 ? `
              <!-- Estado vacío obligatorio -->
              <div style="background: var(--surface, #ffffff); border: 1px dashed var(--border, #cbd5e1); border-radius: 12px; padding: 36px 24px; text-align: center; color: var(--text-secondary);">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: #f8fafc; border-radius: 50%; color: #94a3b8; margin-bottom: 12px;">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                </div>
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text); margin: 0 0 8px 0;">Este producto todavía no tiene reseñas</h3>
                <p style="font-size: 14px; color: #64748b; max-width: 520px; margin: 0 auto; line-height: 1.5;">
                  Este producto todavía no tiene reseñas. Cuando los compradores compartan sus experiencias, aparecerán aquí.
                </p>
              </div>
            ` : `
              <!-- Listado de reseñas publicadas -->
              <div style="display: flex; flex-direction: column; gap: 16px;">
                ${reviews.map(r => `
                  <article class="review-item" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #e2e8f0; display: grid; place-items: center; font-weight: 800; font-size: 13px; color: #475569;">
                          ${esc(r.buyerName ? r.buyerName.substring(0, 2).toUpperCase() : 'CO')}
                        </div>
                        <div>
                          <strong style="font-size: 14px; color: var(--text);">${esc(r.buyerName || 'Comprador verificado')}</strong>
                          <span style="display: block; font-size: 11px; color: var(--muted);">${esc(r.date || 'Reciente')}</span>
                        </div>
                      </div>
                      <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #15803d; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 12px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Compra verificada
                      </span>
                    </div>

                    <div style="margin: 8px 0;">
                      ${renderStarsHtml(r.rating || 5, 14)}
                    </div>

                    ${r.title ? `<h4 style="font-size: 14px; font-weight: 700; color: var(--text); margin: 6px 0;">${esc(r.title)}</h4>` : ''}
                    <p style="font-size: 13px; line-height: 1.6; color: #334155; margin: 6px 0;">${esc(r.comment)}</p>

                    <!-- Galería de fotos adjuntas (si existen) -->
                    ${Array.isArray(r.photos) && r.photos.length > 0 ? `
                      <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
                        ${r.photos.map(p => `
                          <div style="width: 72px; height: 72px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: #f1f5f9;">
                            <img src="${esc(p)}" alt="Foto del comprador" style="width: 100%; height: 100%; object-fit: cover;" />
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}

                    <!-- Reproductor de video (si existe) -->
                    ${r.videoUrl ? `
                      <div style="margin-top: 12px; max-width: 320px;">
                        <video controls style="width: 100%; border-radius: 8px; background: #000;" preload="metadata">
                          <source src="${esc(r.videoUrl)}" type="video/mp4" />
                          Tu navegador no soporta reproducción de video.
                        </video>
                      </div>
                    ` : ''}

                    <!-- Respuesta del comercio -->
                    ${r.storeReply ? `
                      <div style="margin-top: 16px; background: #f8fafc; border-left: 3px solid #09305f; padding: 12px 16px; border-radius: 0 8px 8px 0;">
                        <div style="font-size: 11px; font-weight: 800; color: #09305f; text-transform: uppercase;">Respuesta del comercio</div>
                        <p style="font-size: 12px; color: #475569; margin: 4px 0 0 0; line-height: 1.5;">${esc(r.storeReply)}</p>
                      </div>
                    ` : ''}
                  </article>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Formulario para comentar productos -->
          <div class="product-review-form-card" style="background: var(--surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 12px; padding: 24px;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
              <div>
                <h3 style="font-size: 17px; font-weight: 800; color: var(--text); margin: 0 0 4px 0;">Dejá tu opinión sobre este producto</h3>
                <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                  Compartí tu experiencia con otros compradores locales de San Juan.
                </p>
              </div>
              <span style="font-size: 11px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 6px;">
                1 opinión por compra
              </span>
            </div>

            <!-- Selector de 1 a 5 estrellas -->
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 6px;">
                TU CALIFICACIÓN (1 A 5 ESTRELLAS)
              </label>
              <div class="star-rating-selector" style="display: flex; align-items: center; gap: 6px;">
                ${[1, 2, 3, 4, 5].map(star => `
                  <button type="button" disabled style="background: none; border: none; padding: 4px; cursor: not-allowed; color: #cbd5e1; font-size: 24px; line-height: 1;" title="${star} estrellas">
                    ★
                  </button>
                `).join('')}
                <span style="font-size: 12px; color: var(--muted); margin-left: 8px;">Seleccioná las estrellas que merece el producto</span>
              </div>
            </div>

            <!-- Campo de reseña -->
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 6px;">
                TU OPINIÓN
              </label>
              <textarea disabled placeholder="Contá qué te pareció la calidad del producto, el tamaño, los detalles o cómo te sirvió..." style="width: 100%; min-height: 100px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 13px; background: #f8fafc; resize: vertical;"></textarea>
            </div>

            <!-- Botones multimedia -->
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;">
              <button type="button" disabled class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 6px; background: #f8fafc; border: 1px solid #cbd5e1; color: #64748b; cursor: not-allowed;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Adjuntar fotos (hasta 5)
              </button>

              <button type="button" disabled class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 6px; background: #f8fafc; border: 1px solid #cbd5e1; color: #64748b; cursor: not-allowed;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                Adjuntar video (máx 30 seg)
              </button>
            </div>

            <!-- Explicación de compra verificada y desconexión -->
            <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; display: flex; gap: 12px; align-items: flex-start;">
              <span style="font-size: 18px; line-height: 1; color: #09305f;">🔒</span>
              <div style="font-size: 12px; line-height: 1.5; color: #475569;">
                <strong style="color: #09305f;">Compra verificada obligatoria:</strong> Para asegurar opiniones 100% auténticas, solo los usuarios con pedidos efectivamente entregados o retirados de este producto pueden calificar. La publicación se habilitará automáticamente al completarse la conexión con la base de datos real de Supabase.
              </div>
            </div>

            <!-- Botón de publicar -->
            <button type="button" disabled class="btn btn-primary" style="height: 44px; padding: 0 24px; font-weight: 800; font-size: 14px; background: #94a3b8; color: #fff; border: none; border-radius: 8px; cursor: not-allowed;">
              Publicar reseña (Deshabilitado sin compra verificada)
            </button>
          </div>

        </section>
      `;
    }
  };

})();
