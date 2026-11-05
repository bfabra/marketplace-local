/* ============================================================
   COMPRALOCAL — FOOTER DEL MARKETPLACE
   ============================================================ */
(function () {
  window.Footer = {
    render() {
      return `
      <footer class="market-footer">
        <div class="footer-brand">${Brand.img('symbolWhite')}<p>Comprar y vender en los comercios de tu ciudad, de forma simple.</p></div>
        <div><strong>Explorar</strong>
          <button data-go="marketplace">Inicio</button>
          <button data-go="stores">Tiendas</button>
          <button data-go="categories">Rubros</button>
        </div>
        <div><strong>CompraLocal</strong>
          <button data-go="about">Acerca de la plataforma</button>
          <button data-go="merchant">Sumá tu comercio</button>
          <button data-go="faq">Preguntas frecuentes</button>
        </div>
        <div><strong>Ayuda</strong>
          <button data-go="help">Centro de ayuda</button>
          <button data-action="open-contact-modal">Contacto</button>
          <button data-go="terms">Términos y privacidad</button>
        </div>
        <p class="footer-bottom">© 2026 CompraLocal · Contenido demostrativo para prototipo</p>
      </footer>`;
    },
  };
})();