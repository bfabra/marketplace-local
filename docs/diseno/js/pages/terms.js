/* ============================================================
   COMPRALOCAL — TÉRMINOS, CONDICIONES Y POLÍTICAS DE PRIVACIDAD
   ============================================================ */
(function () {
  const { esc } = window.Utils;

  window.Pages = window.Pages || {};

  window.Pages['terms'] = {
    layout: 'market',
    title: 'Términos y Condiciones — CompraLocal San Juan',

    render() {
      return `
        <div style="background: #f8fafc; min-height: 80vh; padding: 40px 16px;">
          <div class="market-container" style="max-width: 900px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #cbd5e1; padding: 36px 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            
            <header style="border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 28px;">
              <span style="font-size: 12px; font-weight: 800; color: #fd6910; text-transform: uppercase; letter-spacing: 0.5px;">Información Legal</span>
              <h1 style="font-size: 26px; font-weight: 800; color: #09305f; margin: 6px 0 4px 0;">Términos, Condiciones y Políticas del Servicio</h1>
              <small style="color: #64748b; font-size: 13px;">CompraLocal San Juan · Vigente desde 06/10/2026</small>
            </header>

            <article style="display: flex; flex-direction: column; gap: 24px; font-size: 14px; color: #334155; line-height: 1.6;">
              
              <section>
                <h2 style="font-size: 17px; font-weight: 800; color: #09305f; margin-bottom: 8px;">1. Aspectos Generales y Aceptación</h2>
                <p>El presente documento regula el acceso y uso de la plataforma <strong>CompraLocal</strong> en la provincia de San Juan. Al registrarse o realizar compras/ventas en la plataforma, el usuario (cliente o comercio) acepta de forma plena y sin reservas todos los términos aquí expuestos.</p>
              </section>

              <section>
                <h2 style="font-size: 17px; font-weight: 800; color: #09305f; margin-bottom: 8px;">2. Tarifario del Servicio de Entregas y Envíos</h2>
                <p>El costo del servicio de entrega dentro de San Juan varía según la cantidad, peso y volumen de los productos comprados:</p>
                
                <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">2.1. Tarifa Base (Productos Estándar)</h3>
                <ul style="padding-left: 20px; margin: 0 0 10px 0;">
                  <li><strong>$2.990</strong> → Hasta 3 productos de un mismo comercio, de tamaño y peso habitual (ropa, calzado, artículos chicos livianos).</li>
                  <li><strong>+$1.500</strong> por cada producto adicional superando los 3 artículos iniciales.</li>
                </ul>

                <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">2.2. Envíos por Peso y Volumen (Mueblería, Ferretería, Materiales)</h3>
                <p>Los productos de volumen o peso especial se cobran según las siguientes categorías asignadas por el comerciante al cargar el producto:</p>

                <div style="overflow-x: auto; margin: 12px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                    <thead>
                      <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #09305f;">
                        <th style="padding: 10px 12px;">Categoría</th>
                        <th style="padding: 10px 12px;">Peso / Medida</th>
                        <th style="padding: 10px 12px;">Costo de Envío</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px;">Chico</td><td style="padding: 8px 12px;">Hasta 5 kg · hasta 40 cm</td><td style="padding: 8px 12px; font-weight: 700;">$2.990 (tarifa base)</td></tr>
                      <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px;">Mediano</td><td style="padding: 8px 12px;">5 a 15 kg · 40 a 80 cm</td><td style="padding: 8px 12px; font-weight: 700;">$4.990</td></tr>
                      <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px;">Pesado</td><td style="padding: 8px 12px;">15 a 25 kg · 60 cm a 1 m</td><td style="padding: 8px 12px; font-weight: 700;">$7.990</td></tr>
                      <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px;">Grande / Voluminoso</td><td style="padding: 8px 12px;">25 a 40 kg · 1 m a 1,50 m</td><td style="padding: 8px 12px; font-weight: 700;">$11.990</td></tr>
                      <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px;">Muy grande / Especial</td><td style="padding: 8px 12px;">+40 kg · +1,50 m · muebles armados</td><td style="padding: 8px 12px; font-weight: 700;">A cotizar previamente</td></tr>
                      <tr><td style="padding: 8px 12px;">Materiales por mayor</td><td style="padding: 8px 12px;">Cajas de cerámica, bolsas, equipos</td><td style="padding: 8px 12px; font-weight: 700;">Acuerdo previo al retiro</td></tr>
                    </tbody>
                  </table>
                </div>

                <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 12px 0 6px 0;">2.3. Aplicación y Compras Multitienda</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  <li>Si el cliente compra en diferentes comercios en un mismo pedido, cada comercio aplica su envío correspondiente.</li>
                  <li>Si un pedido no entra en un solo viaje por cuestiones de volumen, cada traslado adicional se cobrará según el tarifario.</li>
                </ul>
              </section>

              <section>
                <h2 style="font-size: 17px; font-weight: 800; color: #09305f; margin-bottom: 8px;">3. Comisiones de Comercio</h2>
                <p>Por cada producto vendido y despachado con éxito a través del marketplace, el comercio abonará una comisión fija de <strong>$1.499 por unidad</strong>. Dicho monto es independiente del costo de envío y se detalla de forma transparente en el panel de comerciante.</p>
              </section>

              <section>
                <h2 style="font-size: 17px; font-weight: 800; color: #09305f; margin-bottom: 8px;">4. Devoluciones, Reclamos y Soporte</h2>
                <p>En caso de recibir un producto defectuoso o no corresponder con lo solicitado, el usuario podrá abrir un <strong>Ticket de Reclamo</strong> a través del Centro de Ayuda dentro de los plazos estipulados de garantía legal. El equipo administrativo intermediará para su pronta resolución.</p>
              </section>

              <section>
                <h2 style="font-size: 17px; font-weight: 800; color: #09305f; margin-bottom: 8px;">5. Políticas de Privacidad y Tratamiento de Datos</h2>
                <p>CompraLocal resguarda la privacidad de los usuarios. Los datos personales (nombre, dirección de entrega, email y teléfono) se recopilan únicamente con el fin de procesar los pedidos, gestionar envíos y brindar soporte. En ningún caso se transferirán datos a terceros no involucrados en la logística.</p>
              </section>

            </article>

            <div style="margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <button data-go="marketplace" style="background: #09305f; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">Volver al Inicio</button>
              <button data-go="help" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">Ir al Centro de Ayuda</button>
            </div>

          </div>
        </div>
      `;
    }
  };

})();