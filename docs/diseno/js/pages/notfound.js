/**
 * COMPRALOCAL — NOT FOUND (404) PAGE
 */

function renderNotFound() {
  const container = document.getElementById('page-content');

  container.innerHTML = `
    <div class="page-wrapper page-enter">
      <div class="container" style="max-width:600px;text-align:center;padding:var(--space-16) var(--space-4)">
        <div style="font-size:4.5rem;font-weight:var(--font-extrabold);color:var(--cl-green-700);line-height:1;margin-bottom:var(--space-2);font-family:var(--font-display)">
          404
        </div>
        <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--text-primary);margin-bottom:var(--space-3)">
          Página no encontrada
        </h1>
        <p style="color:var(--text-muted);font-size:var(--text-base);line-height:var(--leading-relaxed);margin-bottom:var(--space-8)">
          La sección que estás buscando no existe o fue trasladada. Podés regresar a la página principal o descubrir comercios locales en San Juan.
        </p>
        <div style="display:flex;gap:var(--space-3);justify-content:center;flex-wrap:wrap">
          <a class="btn btn-primary btn-lg" data-route="/">
            Ir al Inicio
          </a>
          <a class="btn btn-secondary btn-lg" data-route="/tiendas">
            Explorar Comercios
          </a>
        </div>
      </div>
    </div>
  `;
}

window.renderNotFound = renderNotFound;
