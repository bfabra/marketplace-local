/* ============================================================
   COMPRALOCAL — PÁGINA DE PREGUNTAS FRECUENTES (#faq)
   ============================================================ */
(function () {
  const { esc } = window.Utils;

  Pages.faq = {
    layout: 'market',
    title: 'Preguntas Frecuentes — CompraLocal San Juan',

    render() {
      const faqs = [
        {
          q: '¿Cómo funcionan los envíos a domicilio en CompraLocal?',
          a: 'Los envíos son coordinados directamente con los comercios locales de San Juan a través de cadetes y repartidores de la red. Una vez que realizas tu pedido, puedes hacer el seguimiento en tiempo real desde la sección "Mis pedidos" en tu cuenta.'
        },
        {
          q: '¿Cuáles son los medios de pago aceptados?',
          a: 'Puedes abonar mediante Tarjetas de Crédito y Débito, Transferencia Bancaria, Mercado Pago (Alias o QR) o efectivo al recibir (según disponga el comercio).'
        },
        {
          q: '¿Cómo puedo convertir mi cuenta en Cuenta Comercio?',
          a: 'Es muy sencillo. Haz clic en tu perfil en la esquina superior derecha y selecciona la opción "Convertirme en Comercio". Completa los datos de tu local y podrás empezar a vender en la plataforma.'
        },
        {
          q: '¿Qué validez tienen los tickets y comprobantes de compra?',
          a: 'Los comprobantes de tus compras quedan guardados en tu historial dentro de "Mis compras". Puedes configurar el tiempo de retención (desde 3 meses hasta sin expiración) según tus necesidades.'
        },
        {
          q: '¿Cómo se garantiza la seguridad de mis datos y compras?',
          a: 'CompraLocal utiliza pasarelas de pago seguras y comercios 100% verificados de la provincia de San Juan. Además, cuentas con soporte local ante cualquier consulta o inconveniente con tu pedido.'
        }
      ];

      return `
        <div class="market-container" style="max-width: 900px; margin: 32px auto; padding: 0 16px;">
          <nav aria-label="Navegación" style="margin-bottom: 20px; font-size: 13px; color: var(--muted, #64748b);">
            <button data-go="marketplace" style="background:none; border:none; color:var(--primary, #fd6910); cursor:pointer; padding:0; font-weight:700;">Inicio</button>
            <span style="margin: 0 6px;">›</span>
            <span>Preguntas Frecuentes</span>
          </nav>

          <div style="background: linear-gradient(135deg, #09305f, #1e40af); color: white; border-radius: 16px; padding: 36px 32px; margin-bottom: 28px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); text-align: center;">
            <h1 style="font-size: 28px; font-weight: 800; margin: 0 0 10px 0;">Preguntas Frecuentes</h1>
            <p style="font-size: 15px; color: rgba(255,255,255,0.85); margin: 0; max-width: 600px; margin-left: auto; margin-right: auto;">
              Resolvé todas tus dudas sobre envíos, pagos, compras y cuentas en CompraLocal San Juan.
            </p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${faqs.map((item, idx) => `
              <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 12px; padding: 22px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                <h3 style="font-size: 16px; font-weight: 800; color: var(--text, #0f172a); margin: 0 0 8px 0; display: flex; align-items: center; gap: 10px;">
                  <span style="color: var(--primary, #fd6910); font-weight: 800;">${idx + 1}.</span> ${esc(item.q)}
                </h3>
                <p style="font-size: 14px; color: var(--muted, #64748b); margin: 0; line-height: 1.5; padding-left: 24px;">
                  ${esc(item.a)}
                </p>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 36px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center;">
            <h3 style="font-size: 16px; font-weight: 800; color: var(--text, #0f172a); margin: 0 0 6px 0;">¿Tenés otra consulta?</h3>
            <p style="font-size: 13px; color: var(--muted, #64748b); margin: 0 0 16px 0;">Nuestro equipo de soporte en San Juan está disponible para ayudarte.</p>
            <button type="button" onclick="alert('Soporte CompraLocal: Escribinos a soporte@compralocal.sj o por WhatsApp al 264 500-0000.');" style="background: var(--primary, #fd6910); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
              Contactar Soporte
            </button>
          </div>
        </div>
      `;
    }
  };
})();