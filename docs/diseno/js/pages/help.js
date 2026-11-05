/* ============================================================
   COMPRALOCAL — CENTRO DE AYUDA (Estilo Mercado Libre)
   ============================================================ */
(function () {
  const { esc } = window.Utils;

  window.Pages = window.Pages || {};

  window.Pages['help'] = {
    layout: 'market',
    title: 'Centro de Ayuda — CompraLocal San Juan',

    render() {
      const s = window.Store.state;
      const user = s.user;

      // Restricción de acceso: Solo usuarios con sesión (cliente o comerciante)
      if (!user) {
        return `
          <div class="market-container" style="max-width: 600px; margin: 60px auto; padding: 32px; background: #fff; border-radius: 16px; border: 1px solid #cbd5e1; text-align: center;">
            <div style="width: 64px; height: 64px; background: #fef3c7; color: #d97706; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 16px auto; font-size: 28px;">🔒</div>
            <h2 style="font-size: 20px; font-weight: 800; color: #09305f; margin: 0 0 8px 0;">Acceso Restringido</h2>
            <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">Para ingresar al Centro de Ayuda y gestionar tus reclamos o tickets, debes iniciar sesión como cliente o comerciante.</p>
            <button data-go="login" style="background: #fd6910; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Iniciar Sesión / Registrarse</button>
          </div>
        `;
      }

      return `
        <div style="background: #f1f5f9; min-height: 80vh; padding: 40px 16px;">
          <div class="market-container" style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;">
            
            <!-- Título principal -->
            <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; text-align: center; margin: 0 0 10px 0;">¿Con qué te ayudamos?</h1>

            <!-- Atajos personalizados tipo Mercado Libre -->
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-weight: 800; color: #09305f;">
                Atajos personalizados
              </div>
              <div style="display: flex; flex-direction: column;">
                
                <button type="button" onclick="window.Actions['help-shortcut']('return')" style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: none; border: none; border-bottom: 1px solid #f1f5f9; cursor: pointer; text-align: left; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#09305f" stroke-width="2"><path d="M9 14L4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"></path></svg>
                    <span style="font-size: 14px; font-weight: 700; color: #0f172a;">Devolver una compra</span>
                  </div>
                  <span style="color: #64748b; font-weight: 800; font-size: 18px;">›</span>
                </button>

                <button type="button" onclick="window.Actions['help-shortcut']('claim')" style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: none; border: none; border-bottom: 1px solid #f1f5f9; cursor: pointer; text-align: left; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#09305f" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span style="font-size: 14px; font-weight: 700; color: #0f172a;">Iniciar o seguir un reclamo (Generar Ticket)</span>
                  </div>
                  <span style="color: #64748b; font-weight: 800; font-size: 18px;">›</span>
                </button>

                <button type="button" onclick="window.Actions['help-shortcut']('shipping')" style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: none; border: none; border-bottom: 1px solid #f1f5f9; cursor: pointer; text-align: left; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#09305f" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    <span style="font-size: 14px; font-weight: 700; color: #0f172a;">¿Cuándo llegan mis compras?</span>
                  </div>
                  <span style="color: #64748b; font-weight: 800; font-size: 18px;">›</span>
                </button>

                <button type="button" onclick="window.Actions['help-shortcut']('coupons')" style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: none; border: none; border-bottom: 1px solid #f1f5f9; cursor: pointer; text-align: left; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#09305f" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    <span style="font-size: 14px; font-weight: 700; color: #0f172a;">Ayuda con cupones y descuentos</span>
                  </div>
                  <span style="color: #64748b; font-weight: 800; font-size: 18px;">›</span>
                </button>

                <button type="button" onclick="window.Router.go('faq')" style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: none; border: none; cursor: pointer; text-align: left; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#09305f" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span style="font-size: 14px; font-weight: 700; color: #0f172a;">Explorá las preguntas frecuentes</span>
                  </div>
                  <span style="color: #64748b; font-weight: 800; font-size: 18px;">›</span>
                </button>

              </div>
            </div>

            <!-- Sección inferior: ¿Necesitás más ayuda? / Contactanos -->
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div>
                <h3 style="font-size: 16px; font-weight: 800; color: #09305f; margin: 0 0 4px 0;">¿Necesitás más ayuda?</h3>
                <p style="font-size: 13px; color: #64748b; margin: 0;">Envianos un mensaje directo y crearemos un ticket de atención personalizado.</p>
              </div>
              <button type="button" onclick="window.Actions['open-contact-modal']()" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 10px 20px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Contactanos (Generar Ticket)
              </button>
            </div>

          </div>
        </div>

        <!-- MODAL DE CONTACTO Y GENERACIÓN DE TICKETS DE RECLAMO -->
        <div id="help-contact-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <h3 style="font-size: 17px; font-weight: 800; color: #09305f; margin: 0;">Centro de Contacto & Reclamos</h3>
              <button type="button" onclick="window.Actions['close-contact-modal']()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>
            
            <div style="padding: 24px; overflow-y: auto; flex: 1;">
              <form id="help-ticket-form" onsubmit="event.preventDefault(); window.Forms['submit-help-ticket'](this);" style="display: flex; flex-direction: column; gap: 16px;" novalidate>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;">Tipo de Solicitud *</label>
                  <select name="ticketType" required style="height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 13px; background: #fff; cursor: pointer;">
                    <option value="Consulta general">Consulta general / Ayuda</option>
                    <option value="Reclamo por producto">Reclamo por producto defectuoso / no recibido</option>
                    <option value="Devolución">Solicitud de Devolución</option>
                    <option value="Problema con envío">Problema con el envío</option>
                    <option value="Soporte Comercio">Soporte para Comercios</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;">Asunto *</label>
                  <input type="text" name="ticketSubject" required placeholder="Ej. Mi pedido #ORD-1234 no ha llegado" style="height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;">Mensaje o Detalle del Reclamo *</label>
                  <textarea name="ticketMessage" required rows="4" placeholder="Describí detalladamente tu inconveniente..." style="border-radius: 8px; border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; background: #fff; resize: vertical;"></textarea>
                </div>

                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; font-size: 12px; color: #166534; line-height: 1.4;">
                  ℹ️ Al enviar este formulario se generará un <strong>Ticket de Reclamo oficial</strong> que quedará guardado en tu cuenta y en el panel del Superadmin para su resolución prioritaria.
                </div>
              </form>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <button type="button" onclick="window.Actions['close-contact-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; color: #475569;">Cancelar</button>
              <button type="button" onclick="document.getElementById('help-ticket-form').requestSubmit ? document.getElementById('help-ticket-form').requestSubmit() : document.getElementById('help-ticket-form').dispatchEvent(new Event('submit', {cancelable: true}));" style="background: #fd6910; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">Enviar Reclamo / Ticket</button>
            </div>
          </div>
        </div>

        <!-- MODAL DE ÉXITO DE TICKET GENERADO -->
        <div id="ticket-success-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 440px; text-align: center; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); margin: auto;">
            <div style="width: 56px; height: 56px; background: #dcfce7; color: #166534; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 16px auto; font-size: 24px;">✓</div>
            <h3 style="font-size: 18px; font-weight: 800; color: #09305f; margin: 0 0 8px 0;">¡Ticket de Reclamo Creado!</h3>
            <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Tu solicitud ha sido registrada con éxito en el sistema. El Superadmin y nuestro equipo ya la tienen en seguimiento.</p>
            <div id="generated-ticket-badge" style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 12px; font-family: monospace; font-size: 14px; font-weight: 800; color: #09305f; margin-bottom: 20px;"></div>
            <button type="button" onclick="window.Actions['close-ticket-success']()" style="background: #09305f; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; width: 100%;">Entendido</button>
          </div>
        </div>
      `;
    }
  };

  /* --- ACCIONES Y FORMULARIOS DE SOPORTE Y TICKETS --- */
  window.Actions = window.Actions || {};
  window.Forms = window.Forms || {};

  window.Actions['help-shortcut'] = (type) => {
    if (type === 'return') {
      alert("Para devolver una compra, ingresa a 'Mi Perfil' > 'Mis Compras' y selecciona la opción de devolución en el producto correspondiente dentro de los 30 días de recibido.");
    } else if (type === 'claim') {
      window.Actions['open-contact-modal']();
    } else if (type === 'shipping') {
      alert("Los envíos en San Juan se procesan y entregan en un plazo de 24 a 48 horas hábiles por una tarifa única de $2.999.");
    } else if (type === 'coupons') {
      alert("Los cupones de descuento se aplican directamente en el resumen del carrito antes de confirmar el pago.");
    }
  };

  window.Actions['open-contact-modal'] = () => {
    const modal = document.getElementById('help-contact-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.Actions['close-contact-modal'] = () => {
    const modal = document.getElementById('help-contact-modal');
    if (modal) modal.style.display = 'none';
  };

  window.Actions['close-ticket-success'] = () => {
    const modal = document.getElementById('ticket-success-modal');
    if (modal) modal.style.display = 'none';
  };

  window.Forms['submit-help-ticket'] = (form) => {
    const formData = new FormData(form);
    const type = formData.get('ticketType');
    const subject = formData.get('ticketSubject');
    const message = formData.get('ticketMessage');

    if (!subject || !message) {
      alert('Por favor completa el asunto y el mensaje.');
      return;
    }

    const s = window.Store.state;
    s.supportTickets = s.supportTickets || [];

    const newTicket = {
      id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('es-AR'),
      time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      userEmail: s.user?.email || 'usuario@compralocal.demo',
      userName: s.user?.name || s.user?.firstName || 'Usuario',
      type: type,
      subject: subject.trim(),
      message: message.trim(),
      status: 'Abierto'
    };

    s.supportTickets.unshift(newTicket);

    form.reset();
    window.Actions['close-contact-modal']();

    const badge = document.getElementById('generated-ticket-badge');
    if (badge) {
      badge.textContent = `Nº de Ticket: ${newTicket.id} (${newTicket.type})`;
    }
    const successModal = document.getElementById('ticket-success-modal');
    if (successModal) successModal.style.display = 'flex';
  };

})();