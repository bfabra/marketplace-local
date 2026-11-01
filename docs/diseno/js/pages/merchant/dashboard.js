/**
 * LEGACY — stub; no cargar. Panel real: js/pages/merchant.js (#merchant-panel).
 * Ver docs/diseno/LEGACY.md.
 */
function renderMerchantDashboard() {
  const container = document.getElementById('page-content');
  container.innerHTML = `
    <div class="page-wrapper page-enter">
      <div class="container" style="max-width:700px;text-align:center;padding:var(--space-16) 0">
        <div style="font-size:3rem;margin-bottom:var(--space-3)">🏪</div>
        <h2 style="font-size:var(--text-2xl);font-weight:var(--font-bold)">Panel de Comerciante</h2>
        <p style="color:var(--text-muted);margin:var(--space-2) 0 var(--space-6)">Este panel se implementará en la Fase 3 del proyecto según la planificación.</p>
        <a class="btn btn-primary" data-route="/">Volver al Marketplace</a>
      </div>
    </div>
  `;
}
window.renderMerchantDashboard = renderMerchantDashboard;
