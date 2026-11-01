/* ============================================================
   COMPRALOCAL — UTILS
   ============================================================ */
(function () {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const Utils = {
    /** Escapa texto para insertarlo de forma segura en HTML. */
    esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);
    },

    /** Normaliza texto (minúsculas, sin tildes) para búsquedas. */
    norm(value) {
      return String(value ?? '')
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    },

    /** Precio en pesos argentinos: $24.900 */
    money(value) {
      return '$' + Number(value).toLocaleString('es-AR');
    },

    /** "1,2 km" -> 1.2 */
    km(text) {
      return Number(String(text).replace(',', '.').replace(/[^\d.]/g, ''));
    },

    /** Iniciales de un nombre (máx. 2). */
    initials(name) {
      return String(name).split(' ').map((part) => part[0]).slice(0, 2).join('');
    },
  };

  window.Utils = Utils;
})();
