/**
 * COMPRALOCAL — REGISTER PAGE
 * Registro de nuevos clientes y acceso a comerciantes (/registro)
 */

function renderRegister() {
  const container = document.getElementById('page-content');

  container.innerHTML = `
    <div class="auth-layout page-enter">
      <!-- Left Visual Side -->
      <div class="auth-visual hide-mobile">
        <div class="auth-visual-content">
          <div style="margin-bottom:var(--space-6)">
            ${Brand.render({ format: 'horizontal', theme: 'white', height: 42 })}
          </div>
          <h2 class="auth-visual-title">
            Unite a la red de comercio local de San Juan.
          </h2>
          <p class="auth-visual-subtitle">
            Creá tu cuenta gratuita para acceder a ofertas exclusivas, envíos rápidos en tu departamento y seguimiento en vivo de cada pedido.
          </p>

          <div class="auth-features" style="margin-top:var(--space-8)">
            <div class="auth-feature">
              <div class="auth-feature-icon">🛍️</div>
              <div class="auth-feature-text">
                <div class="auth-feature-label">Cientos de tiendas en un solo lugar</div>
                <div class="auth-feature-desc">Panaderías, indumentaria, tecnología y más de tu ciudad.</div>
              </div>
            </div>
            <div class="auth-feature">
              <div class="auth-feature-icon">🛡️</div>
              <div class="auth-feature-text">
                <div class="auth-feature-label">Comercio 100% verificado</div>
                <div class="auth-feature-desc">Locales comerciales de San Juan con atención personalizada.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Form Side -->
      <div class="auth-form-container">
        <div class="auth-form-card" style="max-width:460px">
          <div style="text-align:center;margin-bottom:var(--space-4)">
            ${Brand.render({ format: 'vertical', theme: 'color', height: 56 })}
          </div>

          <h1 class="auth-form-title text-center" style="font-size:var(--text-2xl);text-align:center">
            Crear Cuenta de Cliente
          </h1>
          <p class="auth-form-subtitle text-center" style="text-align:center">
            Comprá en comercios locales de San Juan
          </p>

          <form class="auth-form" onsubmit="RegisterPage.handleSubmit(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="reg-name">Nombre y Apellido *</label>
                <input type="text" id="reg-name" class="input" placeholder="Ej: Lucas Castro" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-phone">Teléfono / WhatsApp *</label>
                <input type="tel" id="reg-phone" class="input" placeholder="Ej: 264 456-7890" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-email">Correo Electrónico *</label>
              <input type="email" id="reg-email" class="input" placeholder="tu@email.com" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-dept">Departamento en San Juan *</label>
              <select id="reg-dept" class="input" required>
                ${MockData.zones.map(z => `
                  <option value="${z}">${z}, San Juan</option>
                `).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="reg-pass">Contraseña *</label>
                <input type="password" id="reg-pass" class="input" placeholder="Mínimo 8 caracteres" required minlength="6" />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-pass2">Confirmar *</label>
                <input type="password" id="reg-pass2" class="input" placeholder="Repetir contraseña" required minlength="6" />
              </div>
            </div>

            <div style="display:flex;align-items:flex-start;gap:var(--space-2);margin:var(--space-2) 0">
              <input type="checkbox" id="reg-terms" required style="margin-top:3px" />
              <label for="reg-terms" style="font-size:var(--text-xs);color:var(--text-muted);cursor:pointer;line-height:var(--leading-snug)">
                Acepto los términos de servicio y las políticas de privacidad de CompraLocal.
              </label>
            </div>

            <button type="submit" class="btn btn-primary btn-lg w-full" style="justify-content:center;margin-top:var(--space-2)">
              Registrarme como Cliente
            </button>
          </form>

          <div class="auth-form-footer">
            ¿Ya tenés una cuenta? <a data-route="/login">Iniciá sesión aquí</a>
          </div>

          <div style="margin-top:var(--space-6);padding:var(--space-4);background:var(--bg-subtle);border-radius:var(--radius-lg);text-align:center;border:1px solid var(--border-subtle)">
            <span style="font-size:var(--text-xs);color:var(--text-muted)">¿Sos dueño de un comercio?</span>
            <div style="font-size:var(--text-xs);color:var(--cl-green-800);font-weight:var(--font-bold);margin-top:2px">
              El panel de gestión comercial estará disponible en la Fase 3.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  window.RegisterPage = {
    handleSubmit(e) {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const phone = document.getElementById('reg-phone').value.trim();
      const dept = document.getElementById('reg-dept').value;

      const newUser = {
        id: `usr_${Date.now()}`,
        name: name,
        email: email,
        phone: phone,
        department: dept,
        address: `${dept}, San Juan`,
        notes: '',
        initials: Utils.initials(name),
        orderCount: 0
      };

      store.set('user', newUser);
      Toast.success(`¡Cuenta creada con éxito! Bienvenido a CompraLocal, ${name}.`);
      RouterInstance.navigate('/tiendas');
    }
  };
}

window.renderRegister = renderRegister;
