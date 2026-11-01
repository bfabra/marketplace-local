/**
 * COMPRALOCAL — TOAST COMPONENT
 */

const Toast = {
  container: null,

  _getContainer() {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  },

  show({ type = 'info', title = '', message = '', duration = 4000 }) {
    const container = this._getContainer();
    const id = Utils.uid('toast-');

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    const el = document.createElement('div');
    el.id = id;
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-body">
        ${title ? `<div class="toast-title">${Utils.sanitize(title)}</div>` : ''}
        ${message ? `<div class="toast-message">${Utils.sanitize(message)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Cerrar">✕</button>
    `;

    // Close button
    el.querySelector('.toast-close').addEventListener('click', () => this.dismiss(id));

    container.appendChild(el);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  },

  dismiss(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('dismissing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 300); // Fallback
  },

  success(message, title = '¡Listo!') {
    return this.show({ type: 'success', title, message });
  },

  error(message, title = 'Error') {
    return this.show({ type: 'error', title, message });
  },

  warning(message, title = 'Atención') {
    return this.show({ type: 'warning', title, message });
  },

  info(message, title = '') {
    return this.show({ type: 'info', title, message });
  },
};

window.Toast = Toast;
