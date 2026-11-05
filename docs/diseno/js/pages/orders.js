/**
 * COMPRALOCAL — ORDERS PAGE
 * Historial y seguimiento de pedidos del cliente (/mis-pedidos y /pedido/:id)
 */

function renderOrders({ params = {}, query = {} } = {}) {
  const container = document.getElementById('page-content');
  const allOrders = MockData.getOrders();
  const activeFilter = query.status || 'all';

  // Filtrado de pedidos según estado
  const filteredOrders = allOrders.filter(order => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'preparing') return order.status === 'pending' || order.status === 'preparing';
    if (activeFilter === 'in_transit') return order.status === 'in_transit';
    if (activeFilter === 'delivered') return order.status === 'delivered';
    return true;
  });

  container.innerHTML = `
    <div class="page-wrapper page-enter">
      <div class="container" style="max-width:960px">
        <!-- Breadcrumb -->
        <nav class="breadcrumb" aria-label="Navegación de migas" style="margin-bottom:var(--space-4)">
          <div class="breadcrumb-item"><a data-route="/">Inicio</a></div>
          <span class="breadcrumb-sep" aria-hidden="true">›</span>
          <div class="breadcrumb-item"><a data-route="/mi-perfil">Mi Cuenta</a></div>
          <span class="breadcrumb-sep" aria-hidden="true">›</span>
          <div class="breadcrumb-item active" aria-current="page">Mis Pedidos</div>
        </nav>

        <!-- Page Header -->
        <div class="section-header" style="margin-bottom:var(--space-6)">
          <div>
            <div class="section-eyebrow">Historial de compras</div>
            <h1 style="font-size:var(--text-3xl);font-weight:var(--font-extrabold);color:var(--text-primary);letter-spacing:-0.02em">
              Mis Pedidos
            </h1>
            <p style="color:var(--text-muted);font-size:var(--text-sm);margin-top:var(--space-1)">
              Seguí el estado de preparación y entrega de tus compras en comercios de San Juan.
            </p>
          </div>
          <a class="btn btn-primary btn-sm" data-route="/tiendas">
            🏪 Comprar más
          </a>
        </div>

        <!-- Filter Tabs -->
        <div class="tabs" style="margin-bottom:var(--space-6);border-bottom:1px solid var(--border-subtle)">
          <button class="tab-item ${activeFilter === 'all' ? 'active' : ''}" onclick="RouterInstance.navigate('/mis-pedidos')">
            Todos (${allOrders.length})
          </button>
          <button class="tab-item ${activeFilter === 'preparing' ? 'active' : ''}" onclick="RouterInstance.navigate('/mis-pedidos?status=preparing')">
            En preparación (${allOrders.filter(o => o.status === 'pending' || o.status === 'preparing').length})
          </button>
          <button class="tab-item ${activeFilter === 'in_transit' ? 'active' : ''}" onclick="RouterInstance.navigate('/mis-pedidos?status=in_transit')">
            En camino (${allOrders.filter(o => o.status === 'in_transit').length})
          </button>
          <button class="tab-item ${activeFilter === 'delivered' ? 'active' : ''}" onclick="RouterInstance.navigate('/mis-pedidos?status=delivered')">
            Entregados (${allOrders.filter(o => o.status === 'delivered').length})
          </button>
        </div>

        <!-- Orders List -->
        ${filteredOrders.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:var(--space-5)">
            ${filteredOrders.map(order => {
              const statusBadges = {
                pending: '<span class="badge badge-accent badge-dot">En preparación</span>',
                preparing: '<span class="badge badge-accent badge-dot">En preparación</span>',
                in_transit: '<span class="badge badge-primary badge-dot">En camino</span>',
                delivered: '<span class="badge badge-success badge-dot">Entregado</span>',
                cancelled: '<span class="badge badge-error badge-dot">Cancelado</span>'
              };

              return `
                <div class="order-card animate-fade-in-up">
                  <!-- Header -->
                  <div class="order-card-header">
                    <div style="display:flex;align-items:center;gap:var(--space-3)">
                      <span class="order-num">#${order.id}</span>
                      <span style="color:var(--text-muted);font-size:var(--text-xs)">•</span>
                      <span class="order-date">📅 ${Utils.formatDate(order.date, 'long')}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:var(--space-3)">
                      ${statusBadges[order.status] || '<span class="badge badge-neutral">' + order.status + '</span>'}
                    </div>
                  </div>

                  <!-- Body -->
                  <div class="order-card-body">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-4);flex-wrap:wrap;gap:var(--space-2)">
                      <div>
                        <div style="font-weight:var(--font-bold);color:var(--text-primary);font-size:var(--text-sm)">
                          🏪 ${Utils.sanitize(order.storeName)}
                        </div>
                        <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">
                          📍 ${order.deliveryType} · ${Utils.sanitize(order.address || 'San Juan')}
                        </div>
                      </div>
                      <div style="font-size:var(--text-xs);color:var(--text-muted)">
                        💳 ${order.paymentMethod || 'Pago local'}
                      </div>
                    </div>

                    <!-- Items Preview -->
                    <div style="display:flex;flex-direction:column;gap:var(--space-2);background:var(--bg-subtle);border-radius:var(--radius-lg);padding:var(--space-3);margin-bottom:var(--space-4)">
                      ${(order.items || []).map(item => `
                        <div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--text-xs)">
                          <div style="display:flex;align-items:center;gap:var(--space-2)">
                            <span>${item.product.emoji || '📦'}</span>
                            <span style="font-weight:var(--font-medium)">${item.quantity}x ${Utils.sanitize(item.product.name)}</span>
                          </div>
                          <span style="color:var(--text-muted)">${Utils.formatPrice((item.product.price || 0) * item.quantity)}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Footer -->
                  <div class="order-card-footer">
                    <div>
                      <span style="font-size:var(--text-xs);color:var(--text-muted)">Total pagado: </span>
                      <span class="order-total" style="color:var(--cl-green-800)">${Utils.formatPrice(order.total)}</span>
                    </div>

                    <div style="display:flex;gap:var(--space-2)">
                      <button class="btn btn-outline btn-sm" onclick="OrdersPage.showTracking('${order.id}')">
                        🔍 Ver Seguimiento
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="OrdersPage.reorder('${order.id}')">
                        🔁 Volver a pedir
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- Empty State -->
          <div class="card" style="padding:var(--space-16);text-align:center">
            <div style="font-size:3.5rem;margin-bottom:var(--space-4)">📦</div>
            <h3 style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--text-primary);margin-bottom:var(--space-2)">
              No hay pedidos en esta sección
            </h3>
            <p style="color:var(--text-muted);font-size:var(--text-sm);max-width:400px;margin:0 auto var(--space-6)">
              Tus compras en comercios locales aparecerán aquí para que puedas seguir su entrega en todo momento.
            </p>
            <a class="btn btn-primary" data-route="/tiendas">
              Explorar comercios de San Juan
            </a>
          </div>
        `}
      </div>
    </div>
  `;

  // Controlador de Seguimiento y Acciones de Pedido
  window.OrdersPage = {
    showTracking(orderId) {
      const order = MockData.getOrders().find(o => o.id === orderId);
      if (!order) return;

      const isDelivered = order.status === 'delivered';
      const isInTransit = order.status === 'in_transit' || isDelivered;
      const isPreparing = order.status === 'pending' || order.status === 'preparing' || isInTransit;

      Modal.open({
        title: `Seguimiento de Pedido #${order.id}`,
        content: `
          <div style="padding:var(--space-2) 0">
            <div style="margin-bottom:var(--space-6);padding:var(--space-3);background:var(--bg-subtle);border-radius:var(--radius-lg)">
              <div style="font-size:var(--text-xs);color:var(--text-muted)">Comercio vendedor:</div>
              <strong style="font-size:var(--text-sm)">${Utils.sanitize(order.storeName)}</strong>
              <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:4px">
                Entrega: ${order.deliveryType} · ${Utils.sanitize(order.address || 'San Juan')}
              </div>
            </div>

            <!-- Tracking Timeline -->
            <div style="display:flex;flex-direction:column;gap:var(--space-5);position:relative;padding-left:var(--space-6)">
              <div style="position:absolute;left:10px;top:10px;bottom:10px;width:2px;background:var(--border-default)"></div>

              <!-- Step 1 -->
              <div style="position:relative">
                <div style="position:absolute;left:-24px;top:0;width:18px;height:18px;border-radius:50%;background:var(--color-success);color:white;display:flex;align-items:center;justify-content:center;font-size:10px">✓</div>
                <div style="font-weight:var(--font-bold);font-size:var(--text-sm)">1. Pedido Recibido</div>
                <div style="font-size:var(--text-xs);color:var(--text-muted)">Registrado en la plataforma CompraLocal.</div>
              </div>

              <!-- Step 2 -->
              <div style="position:relative">
                <div style="position:absolute;left:-24px;top:0;width:18px;height:18px;border-radius:50%;background:${isPreparing ? 'var(--color-success)' : 'var(--bg-subtle)'};color:white;display:flex;align-items:center;justify-content:center;font-size:10px">
                  ${isPreparing ? '✓' : '•'}
                </div>
                <div style="font-weight:var(--font-bold);font-size:var(--text-sm);color:${isPreparing ? 'var(--text-primary)' : 'var(--text-muted)'}">
                  2. En Preparación en el Local
                </div>
                <div style="font-size:var(--text-xs);color:var(--text-muted)">El comercio de San Juan está empaquetando tus artículos.</div>
              </div>

              <!-- Step 3 -->
              <div style="position:relative">
                <div style="position:absolute;left:-24px;top:0;width:18px;height:18px;border-radius:50%;background:${isInTransit ? 'var(--color-success)' : 'var(--bg-subtle)'};color:white;display:flex;align-items:center;justify-content:center;font-size:10px">
                  ${isInTransit ? '✓' : '•'}
                </div>
                <div style="font-weight:var(--font-bold);font-size:var(--text-sm);color:${isInTransit ? 'var(--text-primary)' : 'var(--text-muted)'}">
                  3. ${order.deliveryType.includes('Retiro') ? 'Listo para Retiro en Sucursal' : 'En Camino al Domicilio'}
                </div>
                <div style="font-size:var(--text-xs);color:var(--text-muted)">Cadete local asignado o listo en mostrador.</div>
              </div>

              <!-- Step 4 -->
              <div style="position:relative">
                <div style="position:absolute;left:-24px;top:0;width:18px;height:18px;border-radius:50%;background:${isDelivered ? 'var(--color-success)' : 'var(--bg-subtle)'};color:white;display:flex;align-items:center;justify-content:center;font-size:10px">
                  ${isDelivered ? '✓' : '•'}
                </div>
                <div style="font-weight:var(--font-bold);font-size:var(--text-sm);color:${isDelivered ? 'var(--text-primary)' : 'var(--text-muted)'}">
                  4. Entregado al Cliente
                </div>
                <div style="font-size:var(--text-xs);color:var(--text-muted)">¡Compra completada con éxito!</div>
              </div>
            </div>
          </div>
        `
      });
    },

    reorder(orderId) {
      const order = MockData.getOrders().find(o => o.id === orderId);
      if (!order) return;
      (order.items || []).forEach(item => {
        CartManager.add(item.product, item.quantity);
      });
      Toast.success('Los productos se agregaron a tu carrito');
      RouterInstance.navigate('/carrito');
    }
  };
}

window.renderOrders = renderOrders;
