/* ============================================================
   COMPRALOCAL — PERFIL DE TIENDA  (#store con Chat Interno)
   ============================================================ */
(function () {
  const { esc, norm, initials } = window.Utils;
  const { products } = window.Data;

  const P = { tab: 'products', query: '', category: 'Todos' };

  // Estado temporal de los chats por tienda
  window.Store.state.chats = window.Store.state.chats || {};

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
      <section class="profile-contact" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; display: flex; align-items: center; gap: 16px;">
          ${Icon('location', 24)}
          <div>
            <strong style="display: block; font-size: 15px; color: var(--text);">Visitanos</strong>
            <span style="font-size: 13px; color: var(--muted);">Av. Libertador San Martín 1240 (O), ${esc(store.location)}</span>
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
      </div>
      <div id="store-chat-modal-root"></div>`;
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