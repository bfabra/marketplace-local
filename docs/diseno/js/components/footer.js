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
          <a href="#styleguide">Acerca de la plataforma</a>
          <a href="#signup">Sumá tu comercio</a>
          <a href="#styleguide">Preguntas frecuentes</a>
        </div>
        <div><strong>Ayuda</strong>
          <a href="mailto:ayuda@compralocal.demo">Centro de ayuda</a>
          <a href="mailto:hola@compralocal.demo">Contacto</a>
          <a href="#styleguide">Términos y privacidad</a>
        </div>
        <p class="footer-bottom">© 2026 CompraLocal · Contenido demostrativo para prototipo</p>
      </footer>`;
    },
  };
})();
