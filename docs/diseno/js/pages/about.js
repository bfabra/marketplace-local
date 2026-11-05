/* ============================================================
   COMPRALOCAL — ACERCA DE LA PLATAFORMA
   ============================================================ */
(function () {
  const { esc } = window.Utils;

  window.Pages = window.Pages || {};

  window.Pages['about'] = {
    layout: 'market',
    title: 'Acerca de CompraLocal — San Juan',

    render() {
      return `
        <div style="background: #f8fafc; min-height: 80vh; padding: 40px 16px;">
          <div class="market-container" style="max-width: 900px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #cbd5e1; padding: 40px 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            
            <!-- Encabezado principal -->
            <header style="border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 32px; text-align: center;">
              <span style="font-size: 12px; font-weight: 800; color: #fd6910; text-transform: uppercase; letter-spacing: 0.8px;">Nuestra Misión</span>
              <h1 style="font-size: 30px; font-weight: 800; color: #09305f; margin: 8px 0 12px 0;">¿Qué es CompraLocal?</h1>
              <p style="font-size: 15px; color: #64748b; max-width: 650px; margin: 0 auto; line-height: 1.5;">
                El marketplace oficial que conecta de forma directa, simple y rápida a los vecinos con los comercios de cercanía y emprendedores de la provincia de <strong>San Juan</strong>.
              </p>
            </header>

            <!-- Cuerpo explicativo / Ventajas -->
            <div style="display: flex; flex-direction: column; gap: 32px; font-size: 14px; color: #334155; line-height: 1.6;">
              
              <section>
                <h2 style="font-size: 18px; font-weight: 800; color: #09305f; margin-bottom: 10px;">Comercio 100% Sanjuanino</h2>
                <p>
                  CompraLocal nació con un propósito claro: potenciar la economía local de San Juan. Creemos firmemente que detrás de cada negocio de barrio hay familias, esfuerzo y productos de excelente calidad. Nuestra plataforma elimina intermediarios innecesarios y acerca el almacén, la feria, la ferretería o la tienda de indumentaria directamente a la pantalla de tu celular o computadora.
                </p>
              </section>

              <!-- Tarjetas de ventajas -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 10px;">
                
                <!-- Ventajas para Clientes -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                  <div style="width: 40px; height: 40px; background: #e0f2fe; color: #0284c7; border-radius: 10px; display: grid; place-items: center; font-size: 18px; font-weight: 800; margin-bottom: 14px;">🛍️</div>
                  <h3 style="font-size: 16px; font-weight: 800; color: #09305f; margin-bottom: 10px;">Ventajas para los Clientes</h3>
                  <ul style="padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 8px; color: #475569;">
                    <li><strong>Todo cerca tuyo:</strong> Encontrá una gran variedad de rubros en San Juan sin moverte de tu casa.</li>
                    <li><strong>Envío unificado y rápido:</strong> Recibí tus compras de forma directa con tarifas claras y accesibles ($2.999 base).</li>
                    <li><strong>Chat directo:</strong> Comunicate en tiempo real con los comerciantes para resolver dudas o coordinar detalles.</li>
                    <li><strong>Seguridad y confianza:</strong> Historial de compras, favoritos y un sistema de soporte y tickets transparente.</li>
                  </ul>
                </div>

                <!-- Ventajas para Comerciantes -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                  <div style="width: 40px; height: 40px; background: #ffedd5; color: #fd6910; border-radius: 10px; display: grid; place-items: center; font-size: 18px; font-weight: 800; margin-bottom: 14px;">🏪</div>
                  <h3 style="font-size: 16px; font-weight: 800; color: #09305f; margin-bottom: 10px;">Ventajas para los Comerciantes</h3>
                  <ul style="padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 8px; color: #475569;">
                    <li><strong>Tu propia vidriera digital:</strong> Digitalizá tu negocio y exponé tu catálogo ante miles de vecinos sanjuaninos.</li>
                    <li><strong>Panel de gestión completo:</strong> Administrá tus ventas, métricas, stock y carga masiva de productos de forma intuitiva.</li>
                    <li><strong>Roles y empleados:</strong> Delegá tareas operativas asignando permisos específicos a tu equipo de trabajo.</li>
                    <li><strong>Atención prioritaria:</strong> Soporte dedicado y canales de comunicación directos con la administración de la plataforma.</li>
                  </ul>
                </div>

              </div>

              <section style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px 24px; margin-top: 10px;">
                <h3 style="font-size: 15px; font-weight: 800; color: #166534; margin-bottom: 6px;">🌱 Proyección y Crecimiento</h3>
                <p style="font-size: 13px; color: #15803d; margin: 0; line-height: 1.5;">
                  Actualmente operamos con orgullo en toda la provincia de <strong>San Juan</strong>. Nuestra infraestructura modular está diseñada para escalar progresivamente a nuevas regiones y ciudades conservando el mismo compromiso con el desarrollo local.
                </p>
              </section>

            </div>

            <!-- Botones de navegación inferior -->
            <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <button data-go="marketplace" style="background: #09305f; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">Ir al Marketplace</button>
              <button data-go="merchant" style="background: #fd6910; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">Sumá tu Comercio</button>
            </div>

          </div>
        </div>
      `;
    }
  };

})();