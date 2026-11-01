/* ============================================================
   COMPRALOCAL — GUÍA DE IMPLEMENTACIÓN UI  (#styleguide)
   ============================================================ */
(function () {
  const { esc } = window.Utils;

  const COLORS = [
    ['Primary', '--primary', '#09305F', 'Acciones, fondos de marca y estados activos'],
    ['Primary hover', '--primary-hover', '#06264C', 'Hover de acciones principales'],
    ['Primary soft', '--primary-soft', '#E9F0F7', 'Selecciones y fondos informativos'],
    ['Accent', '--accent', '#FD6910', 'Llamadas de atención y enlaces destacados'],
    ['Accent soft', '--accent-soft', '#FFF0E7', 'Fondos cálidos y avisos suaves'],
    ['Surface', '--surface', '#FFFFFF', 'Cards, formularios y texto sobre fondos oscuros'],
    ['Canvas', '--canvas', '#F7F9FB', 'Fondo general de pantallas'],
    ['Text', '--text', '#14283E', 'Títulos y contenido principal'],
    ['Muted', '--muted', '#687788', 'Ayudas y contenido secundario'],
    ['Border', '--border', '#DBE3EB', 'Contornos, divisores e inputs'],
  ];

  const SPACING = [4, 8, 12, 16, 24, 32, 40, 48];

  Pages.styleguide = {
    layout: 'bare',
    title: 'Guía UI — CompraLocal',

    render() {
      return `
      <div class="guide-screen">
        <header class="guide-header">
          <div class="guide-logo">${Brand.img('horizontalWhite')}</div>
          <div><span>SISTEMA DE DISEÑO · V1.0</span><h1>Guía de implementación UI</h1>
            <p>Referencia visual y técnica para reproducir la experiencia de CompraLocal de forma consistente.</p>
            <p style="margin-top:14px"><button type="button" class="text-link" style="color:var(--accent-light)" data-go="marketplace">← Volver al marketplace</button></p></div>
        </header>

        <main class="guide-content">
          <section class="guide-section">
            <div class="guide-section-title"><span>01</span><div><h2>Identidad y tipografía</h2><p>Fundamentos de marca y jerarquía editorial.</p></div></div>
            <div class="guide-two-columns">
              <article class="guide-card type-card">
                <small>TIPOGRAFÍA PRINCIPAL</small>
                <div class="type-sample">Aa</div>
                <h3>Manrope</h3>
                <p>Sans-serif geométrica, cercana y altamente legible. Se carga desde Google Fonts.</p>
                <code>font-family: "Manrope", sans-serif;</code>
                <div class="weight-row"><span><b>400</b> Regular</span><span><b>500</b> Medium</span><span><b>600</b> Semibold</span><span><b>700–800</b> Bold</span></div>
              </article>
              <article class="guide-card logo-guide">
                <small>USO DE MARCA</small>
                <div class="logo-examples">
                  <div>${Brand.img('horizontal', { alt: 'Logo horizontal sobre fondo claro' })}</div>
                  <div>${Brand.img('horizontalWhite', { alt: 'Logo horizontal blanco sobre fondo azul' })}</div>
                </div>
                <p>Usar la versión positiva en superficies claras y la negativa blanca sobre el azul primario. No modificar proporciones, colores ni área de seguridad.</p>
                <code>Assets: public/brand/logos</code>
              </article>
            </div>
            <article class="guide-card hierarchy-card">
              <small>ESCALA TIPOGRÁFICA</small>
              <div><span>Display · 40/48 · 800</span><strong>Comprar cerca se siente mejor.</strong></div>
              <div><span>H1 · 27/32 · 700</span><h3>Creá tu comercio</h3></div>
              <div><span>H2 · 18/24 · 700</span><h4>Datos de la tienda</h4></div>
              <div><span>Body · 14/22 · 400</span><p>Texto de lectura y descripciones de producto.</p></div>
              <div><span>Caption · 11/16 · 600</span><small>AYUDA, ETIQUETAS Y METADATOS</small></div>
            </article>
          </section>

          <section class="guide-section">
            <div class="guide-section-title"><span>02</span><div><h2>Colores y tokens</h2><p>Valores listos para trasladar a CSS, Figma o variables de tema.</p></div></div>
            <div class="color-grid">
              ${COLORS.map(([name, variable, value, usage]) => `
                <article class="color-token"><i style="background-color:${value}"></i>
                  <div><strong>${name}</strong><code>${value}</code><span>${variable}</span><p>${usage}</p></div></article>`).join('')}
            </div>
            <div class="accessibility-note">${Icon('info', 18)}<p><strong>Accesibilidad:</strong> usar texto blanco sobre Primary y texto Primary/Text sobre Surface. El naranja se reserva para acentos y no debe usarse como color de texto pequeño sobre blanco.</p></div>
          </section>

          <section class="guide-section">
            <div class="guide-section-title"><span>03</span><div><h2>Espaciado y geometría</h2><p>Sistema basado en múltiplos de 4 para mantener ritmo y alineación.</p></div></div>
            <div class="guide-two-columns">
              <article class="guide-card"><small>ESCALA DE ESPACIADO</small>
                <div class="spacing-list">${SPACING.map((n) => `<div><code>${n}</code><i style="width:${n * 2}px"></i><span>${n} px</span></div>`).join('')}</div></article>
              <article class="guide-card geometry-card"><small>RADIOS Y ELEVACIÓN</small>
                <div><i class="radius-small"></i><span><b>8 px</b> Inputs y botones</span></div>
                <div><i class="radius-medium"></i><span><b>12 px</b> Cards y modales</span></div>
                <div><i class="radius-round"></i><span><b>999 px</b> Pills e indicadores</span></div>
                <p>Sombras: usar únicamente para separar superficies elevadas. Base recomendada:</p>
                <code>0 8px 25px rgba(43, 65, 53, 0.05)</code></article>
            </div>
          </section>

          <section class="guide-section">
            <div class="guide-section-title"><span>04</span><div><h2>Componentes y estados</h2><p>Patrones funcionales que deben mantenerse en todas las pantallas.</p></div></div>
            <article class="guide-card component-showcase">
              <div class="component-group"><small>BOTONES</small>
                <div><button class="btn primary" type="button">Acción principal ${Icon('arrow', 17)}</button><button class="btn secondary" type="button">Acción secundaria</button><button class="btn primary" type="button" disabled>Deshabilitado</button></div></div>
              <div class="component-group"><small>INPUTS</small>
                <div class="guide-fields">
                  ${UI.field({ label: 'Estado normal', placeholder: 'Ingresá un valor' })}
                  ${UI.field({ label: 'Estado focus', placeholder: 'Valor activo', state: 'focus' })}
                  ${UI.field({ label: 'Estado error', placeholder: 'Valor incorrecto', state: 'error', helper: 'Revisá este campo.' })}
                </div></div>
              <div class="component-group"><small>FEEDBACK</small>
                <div class="guide-alerts">
                  <div class="alert success">${Icon('check', 17)}<div><strong>Operación exitosa</strong><span>Los cambios se guardaron correctamente.</span></div></div>
                  <div class="alert error">${Icon('info', 17)}<div><strong>Ocurrió un error</strong><span>Revisá los datos e intentá nuevamente.</span></div></div>
                </div></div>
            </article>
          </section>

          <section class="guide-section">
            <div class="guide-section-title"><span>05</span><div><h2>Implementación responsive</h2><p>Reglas para adaptar el sistema sin perder jerarquía ni legibilidad.</p></div></div>
            <div class="breakpoint-grid">
              <article>${Icon('shop', 22)}<strong>Desktop</strong><code>≥ 1000 px</code><p>Layouts divididos, panel lateral y formularios de hasta dos columnas.</p></article>
              <article>${Icon('image', 22)}<strong>Tablet</strong><code>721–999 px</code><p>Navegación horizontal, márgenes reducidos y cards flexibles.</p></article>
              <article>${Icon('user', 22)}<strong>Mobile</strong><code>≤ 720 px</code><p>Una columna, controles a ancho completo y mínimo táctil de 44 px.</p></article>
            </div>
            <div class="developer-checklist">
              <strong>Checklist de entrega</strong>
              ${['Usar variables CSS, no colores aislados', 'Mantener foco visible y contraste AA', 'Conservar proporciones de los logos', 'Validar estados loading, error, success y disabled', 'Probar a 360, 768, 1024 y 1440 px'].map((t) => `<span>${Icon('check', 14)}${esc(t)}</span>`).join('')}
            </div>
          </section>
        </main>
      </div>`;
    },
  };
})();
