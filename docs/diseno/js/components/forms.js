/* ============================================================
   COMPRALOCAL — COMPONENTES DE FORMULARIO DE COMERCIO
   ============================================================ */
(function () {
  const { esc } = window.Utils;

  const UI = {
    field({ label, placeholder = '', icon = '', type = 'text', state = '', helper = '', name = '', value = '', draft = '', autocomplete = '' }) {
      const id = name ? `f-${name}` : '';
      return `
      <label class="field ${state}">
        <span>${esc(label)}</span>
        <div>
          ${icon ? Icon(icon, 18) : ''}
          <input ${id ? `id="${id}" name="${name}"` : ''} type="${type}" placeholder="${esc(placeholder)}" value="${esc(value)}"
            ${draft ? `data-input="draft" data-key="${draft}"` : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''}
            ${state === 'error' ? 'aria-invalid="true"' : ''} />
          ${type === 'password' ? `<button type="button" class="pass-toggle" data-action="toggle-pass" aria-label="Mostrar contraseña">${Icon('eye', 18)}</button>` : ''}
        </div>
        ${helper ? `<small role="alert">${esc(helper)}</small>` : ''}
      </label>`;
    },

    select({ label, placeholder, options, draft = '', value = '' }) {
      return `
      <label class="field">
        <span>${esc(label)}</span>
        <select data-input="draft" data-key="${draft}">
          <option value="" disabled${value ? '' : ' selected'}>${esc(placeholder)}</option>
          ${options.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}
        </select>
      </label>`;
    },

    primaryButton(label, { action = '', loading = false, type = 'button' } = {}) {
      return `<button class="btn primary" type="${type}" ${action ? `data-action="${action}"` : ''} ${loading ? 'disabled' : ''}>
        ${loading ? '<span class="spinner"></span>' : ''}${loading ? 'Ingresando...' : esc(label)}${loading ? '' : Icon('arrow', 17)}</button>`;
    },

    socialButton() {
      return `<button class="btn social" type="button" data-action="social-demo">${Icon('google', 19)} Continuar con Google</button>`;
    },

    progress(step) {
      const labels = ['Cuenta', 'Mi comercio', 'Finalizar'];
      return `<div class="stepper" role="list" aria-label="Progreso">${labels.map((label, i) => {
        const n = i + 1;
        const completed = n < step;
        const active = n === step;
        return `<div class="step ${completed ? 'completed' : ''} ${active ? 'active' : ''}" role="listitem"${active ? ' aria-current="step"' : ''}>
          <span>${completed ? Icon('check', 13) : n}</span><small>${label}</small>${i < 2 ? '<i></i>' : ''}</div>`;
      }).join('')}</div>`;
    },

    /** Marco de las pantallas de alta de comercio (fondo azul con logo clicable hacia el inicio). */
    flowFrame(inner, { wide = false } = {}) {
      return `
      <div class="flow-screen">
        <div class="simple-header">
          <button type="button" class="official-logo" data-go="marketplace" aria-label="Volver al inicio" style="background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center;">
            ${Brand.img('horizontalWhite')}
          </button>
          <span>¿Necesitás ayuda? <a href="mailto:ayuda@compralocal.demo" style="color:var(--accent);font-weight:700">Contactanos</a></span>
        </div>
        <main class="flow-card${wide ? ' wide' : ''}">${inner}</main>
        <p class="legal-footer">© 2026 CompraLocal · Privacidad · Términos</p>
      </div>`;
    },
  };

  window.UI = UI;
})();