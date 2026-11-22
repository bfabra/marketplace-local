/* ============================================================
   COMPRALOCAL — PERFIL DE TIENDA  (#store con Chat Interno)
   ============================================================ */
(function () {
  const { esc, norm, money, initials } = window.Utils;

  const P = { tab: 'products', query: '', category: 'Todos' };

  // Estado temporal de los chats por tienda
  window.Store.state.chats = window.Store.state.chats || {};

  function getAllProducts() {
    return window.Data?.products || [];
  }

  function storeProducts(store) {
    const allProducts = getAllProducts();
    return allProducts.filter((p) => p.storeId === store.id);
  }

  function catalog(store) {
    const list = storeProducts(store).filter((p) =>
      (P.category === 'Todos' || p.category === P.category) && norm(p.name).includes(norm(P.query)));
    
    return list.length
      ? `<div class="product-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
          ${list.map((p) => `
            <div class="product-card" data-action="open-product" data-id="${esc(p.id)}" style="cursor: pointer; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div style="width: 100%; height: 160px; border-radius: 8px; overflow: hidden; background: #f1f5f9;">
                <img src="${esc(p.image)}" alt="${esc(p.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <strong style="font-size: 14px; color: var(--text);">${esc(p.name)}</strong>
              <span style="font-size: 16px; font-weight: 800; color: var(--primary);">${money(p.price)}</span>
            </div>
          `).join('')}
        </div>`
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
          <p>${Icon('location', 16)} ${esc(store.address || 'Av. Libertador San Martín 1240 (O)')}, ${esc(store.department || store.location || '')}</p>
          <p>${Icon('phone', 16)} ${store.phones && store.phones[0] ? store.phones[0].number : 'Contacto disponible en la tienda'}</p></div>
      </section>`;
    }
    if (P.tab === 'contact') {
      return `
      <section class="profile-contact" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; display: flex; align-items: center; gap: 16px;">
          ${Icon('location', 24)}
          <div>
            <strong style="display: block; font-size: 15px; color: var(--text);">Visitanos</strong>
            <span style="font-size: 13px; color: var(--muted);">${esc(store.address || 'Av. Libertador')}, ${esc(store.department || store.location || '')}</span>
          </div>
        </div>
        <button type="button" data-action="open-store-chat" data-store-id="${store.id}" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; display: flex; align-items: center; gap: 16px; cursor: pointer; text-align: left; width: 100%; transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <span style="color: var(--primary); display: flex; align-items: center;">${Icon('phone', 24)}</span>
          <div>
            <strong style="display: block; font-size: 15px; color: var(--text);">Contactá al comercio</strong>
            <span style="font-size: 13px; color: var(--muted);">Abrir chat interno y conversar con ${esc(store.name)}</span>
          </div>
        </button>
      </section>`;
    }
    return `
      <section class="catalog-section">
        <div class="market-section-heading"><div><span>CATÁLOGO DE PRODUCTOS</span><h2>Productos de ${esc(store.name)}</h2></div></div>
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
      <section class="profile-cover"><img src="${esc(store.image || store.logo)}" alt="Portada de ${esc(store.name)}" /></section>
      <div class="market-container store-profile">
        <section class="store-profile-header">
          <div class="profile-mark" aria-hidden="true">${esc(initials(store.name))}</div>
          <div class="profile-title">
            <span>${esc(store.rubro || store.category)}</span>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <h1 style="margin: 0;">${esc(store.name)}</h1>
              ${window.Reputation ? window.Reputation.renderBadge(store, { size: 'md' }) : ''}
            </div>
            <p>${Icon('location', 14)} ${esc(store.address ? store.address + ', ' : '')}${esc(store.department || store.location || '')}</p>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" data-action="open-store-rating-modal" data-id="${store.id}" style="height: 38px; padding: 0 14px; font-size: 13px; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); cursor: pointer;">
              <span style="color: #f59e0b;">★</span> Valorar atención
            </button>
            <button type="button" class="follow-button" data-action="toggle-follow" aria-pressed="${following}">${Icon('heart', 16)} <span id="follow-label">${following ? 'Siguiendo' : 'Seguir tienda'}</span></button>
          </div>
        </section>
        <nav class="profile-tabs" aria-label="Secciones de la tienda">
          ${tabs.map(([id, label]) => `<button type="button" class="${P.tab === id ? 'active' : ''}" data-action="profile-tab" data-tab="${id}">${label}</button>`).join('')}
        </nav>
        <div id="profile-body">${tabBody(store)}</div>
      </div>
      <div id="store-chat-modal-root"></div>
      <div id="store-rating-modal-root"></div>`;
  }

  function renderChatModal(store) {
    const root = document.getElementById('store-chat-modal-root');
    if (!root) return;

    const chatKey = store.id;
    window.Store.state.chats[chatKey] = window.Store.state.chats[chatKey] || [
      { sender: 'store', text: `¡Hola! Gracias por comunicarte con ${store.name}. ¿En qué podemos ayudarte hoy?` }
    ];
    const messages = window.Store.state.chats[chatKey];

    root.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; width: 340px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 1000; display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s ease;">
        <div style="background: var(--primary); color: #fff; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #fff; color: var(--primary); display: grid; place-items: center; font-weight: 800; font-size: 12px;">${initials(store.name)}</div>
            <div>
              <strong style="font-size: 14px; display: block; line-height: 1.2;">${esc(store.name)}</strong>
              <small style="font-size: 11px; opacity: 0.9;">Chat interno en línea</small>
            </div>
          </div>
          <button type="button" data-action="close-store-chat" style="background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; padding: 4px;">&times;</button>
        </div>
        <div id="chat-messages-container" style="padding: 16px; height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: var(--bg);">
          ${messages.map(m => `
            <div style="max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.4; ${m.sender === 'user' ? 'background: var(--primary); color: #fff; align-self: flex-end; border-bottom-right-radius: 2px;' : 'background: var(--surface); color: var(--text); border: 1px solid var(--border); align-self: flex-start; border-bottom-left-radius: 2px;'}">
              ${esc(m.text)}
            </div>
          `).join('')}
        </div>
        <form data-form="send-store-chat" data-store-id="${store.id}" style="padding: 12px; background: var(--surface); border-top: 1px solid var(--border); display: flex; gap: 8px;">
          <input type="text" name="message" placeholder="Escribí un mensaje..." autocomplete="off" style="flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; outline: none; background: var(--bg); color: var(--text);" />
          <button type="submit" style="background: var(--primary); color: #fff; border: none; padding: 0 16px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px;">Enviar</button>
        </form>
      </div>
    `;

    const msgContainer = document.getElementById('chat-messages-container');
    if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  Pages.store = {
    layout: 'market',
    title: 'Tienda — CompraLocal',
    render() {
      const store = window.Store.store();
      document.title = `${store.name} — CompraLocal`;
      return full(store);
    },
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

  // Acciones de valoración de tienda
  Actions['open-store-rating-modal'] = () => {
    const store = window.Store.store();
    const root = document.getElementById('store-rating-modal-root');
    if (root && window.Reputation) {
      root.innerHTML = `
        <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: grid; place-items: center; z-index: 1000; padding: 16px; animation: fadeIn 0.2s ease;" onclick="if(event.target === this) { const r = document.getElementById('store-rating-modal-root'); if(r) r.innerHTML = ''; }">
          ${window.Reputation.renderStoreRatingModal(store)}
        </div>
      `;
      // Listener para botón de cerrar
      const closeBtn = root.querySelector('[data-action="close-modal"]');
      if (closeBtn) {
        closeBtn.onclick = () => { root.innerHTML = ''; };
      }
    }
  };

  Actions['close-store-rating-modal'] = () => {
    const root = document.getElementById('store-rating-modal-root');
    if (root) root.innerHTML = '';
  };

  // Acciones del chat interno
  Actions['open-store-chat'] = (el) => {
    const store = window.Store.store();
    renderChatModal(store);
  };

  Actions['close-store-chat'] = () => {
    const root = document.getElementById('store-chat-modal-root');
    if (root) root.innerHTML = '';
  };

  window.Forms = window.Forms || {};
  Forms['send-store-chat'] = (form) => {
    const input = form.querySelector('input[name="message"]');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    const storeId = form.dataset.storeId;
    window.Store.state.chats[storeId] = window.Store.state.chats[storeId] || [];
    
    // Agregar mensaje del usuario
    window.Store.state.chats[storeId].push({ sender: 'user', text });
    input.value = '';

    const store = window.Store.store();
    renderChatModal(store);

    // Simular respuesta automática del comercio
    setTimeout(() => {
      window.Store.state.chats[storeId].push({ 
        sender: 'store', 
        text: `¡Gracias por tu mensaje! Hemos recibido tu consulta y te responderemos a la brevedad desde ${store.name}.` 
      });
      renderChatModal(store);
    }, 1200);
  };
})();