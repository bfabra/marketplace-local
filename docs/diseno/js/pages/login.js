/**
 * LEGACY — no cargar en index.html.
 * Fuente de verdad de auth: js/pages/auth.js (#login / #signup).
 * Ver docs/diseno/LEGACY.md.
 *
 * COMPRALOCAL — LOGIN & PASSWORD RECOVERY PAGE (obsoleto)
 */

function renderLogin() {
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
            Comprá cerca, apoyá tu comunidad sanjuanina.
          </h2>
          <p class="auth-visual-subtitle">
            Accedé a tu cuenta para consultar el estado de tus compras, repetir pedidos frecuentes y gestionar tus direcciones de entrega.
          </p>

          <div class="auth-features" style="margin-top:var(--space-8)">
            <div class="auth-feature">
              <div class="auth-feature-icon">🚚</div>
              <div class="auth-feature-text">
                <div class="auth-feature-label">Envíos locales rápidos</div>
                <div class="auth-feature-desc">Coordinación directa con los comercios de tu departamento.</div>
              </div>
            </div>
            <div class="auth-feature">
              <div class="auth-feature-icon">🏪</div>
              <div class="auth-feature-text">
                <div class="auth-feature-label">Retiro sin costo</div>
                <div class="auth-feature-desc">Elegí la opción de retiro en mostrador y ahorrá en el envío.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Form Side -->
      <div class="auth-form-container">
        <div class="auth-form-card">
          <div style="text-align:center;margin-bottom:var(--space-6)">
            ${Brand.render({ format: 'vertical', theme: 'color', height: 64 })}
          </div>

          <h1 class="auth-form-title text-center" style="font-size:var(--text-2xl);text-align:center">
            Iniciar Sesión
          </h1>
          <p class="auth-form-subtitle text-center" style="text-align:center">
            Ingresá a tu cuenta de CompraLocal
          </p>

          <!-- Honest Demo Notice -->
          <div style="background:var(--cl-green-50);border:1px solid var(--cl-green-200);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-5);font-size:var(--text-xs);color:var(--cl-green-800);line-height:var(--leading-relaxed)">
            ℹ️ <strong>Entorno demostrativo:</strong> Interfaz conectada al estado local. Podés usar tus credenciales o el botón de acceso rápido para probar el flujo.
          </div>

          <form class="auth-form" onsubmit="LoginPage.handleLogin(event)">
            <div class="form-group">
              <label class="form-label" for="login-email">Correo Electrónico</label>
              <input type="email" id="login-email" class="input" placeholder="ejemplo@email.com" required value="maria.gonzalez@gmail.com" />
            </div>

            <div class="form-group">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-1)">
                <label class="form-label" for="login-password" style="margin:0">Contraseña</label>
                <a data-route="/recuperar-password" style="font-size:var(--text-xs);color:var(--cl-green-700);text-decoration:none">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <input type="password" id="login-password" class="input" placeholder="••••••••" required value="12345678" />
            </div>

            <div style="display:flex;align-items:center;gap:var(--space-2);margin:var(--space-1) 0">
              <input type="checkbox" id="login-remember" checked />
              <label for="login-remember" style="font-size:var(--text-xs);color:var(--text-muted);cursor:pointer">
                Recordar mi sesión en este dispositivo
              </label>
            </div>

            <button type="submit" class="btn btn-primary btn-lg w-full" style="justify-content:center;margin-top:var(--space-2)">
              Ingresar a mi Cuenta
            </button>

            <!-- Quick Demo Login Button -->
            <button type="button" class="btn btn-secondary w-full" style="justify-content:center" onclick="LoginPage.quickDemoLogin()">
              ⚡ Acceso Rápido: Cliente Demo (María G.)
            </button>
          </form>

          <div class="auth-form-footer">
            ¿No tenés una cuenta todavía? <a data-route="/registro">Registrate gratis</a>
          </div>
        </div>
      </div>
    </div>
  `;

  window.LoginPage = {
    handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      
      const user = {
        ...(MockData.user || {}),
        name: 'María González',
        email: email,
        initials: 'MG',
        address: 'Calle Aberastain 456 Sur'
      };

      // Guardar usuario en el Store global
      if (window.Store && typeof window.Store.set === 'function') {
        window.Store.set({ user: user });
      } else if (typeof store !== 'undefined' && store.set) {
        store.set('user', user);
      }

      Toast.success(`¡Bienvenida/o, ${user.name}!`);

      // Redirección inteligente: si hay carrito con productos, vuelve al carrito; sino al perfil/marketplace
      const cart = window.Store?.state?.cart || [];
      if (cart.length > 0) {
        window.location.hash = 'cart';
      } else if (typeof RouterInstance !== 'undefined' && RouterInstance.navigate) {
        RouterInstance.navigate('/mi-perfil');
      } else {
        window.location.hash = 'marketplace';
      }
    },

    quickDemoLogin() {
      const user = {
        ...(MockData.user || {}),
        name: 'María González',
        email: 'maria.gonzalez@gmail.com',
        initials: 'MG',
        address: 'Calle Aberastain 456 Sur'
      };

      if (window.Store && typeof window.Store.set === 'function') {
        window.Store.set({ user: user });
      } else if (typeof store !== 'undefined' && store.set) {
        store.set('user', user);
      }

      Toast.success('Sesión iniciada como María González (Cliente San Juan)');

      // Redirección inteligente al carrito si tiene productos
      const cart = window.Store?.state?.cart || [];
      if (cart.length > 0) {
        window.location.hash = 'cart';
      } else if (typeof RouterInstance !== 'undefined' && RouterInstance.navigate) {
        RouterInstance.navigate('/mis-pedidos');
      } else {
        window.location.hash = 'marketplace';
      }
    }
  };
}

/**
 * Pantalla de recuperación de contraseña (/recuperar-password)
 */
function renderForgotPassword() {
  const container = document.getElementById('page-content');

  container.innerHTML = `
    <div class="auth-layout page-enter">
      <div class="auth-form-container" style="grid-column:1 / -1;max-width:520px;margin:0 auto">
        <div class="auth-form-card">
          <div style="text-align:center;margin-bottom:var(--space-6)">
            ${Brand.render({ format: 'vertical', theme: 'color', height: 60 })}
          </div>

          <h1 class="auth-form-title text-center" style="font-size:var(--text-2xl);text-align:center">
            Recuperar Contraseña
          </h1>
          <p class="auth-form-subtitle text-center" style="text-align:center">
            Ingresá tu correo electrónico para recibir un enlace de restablecimiento.
          </p>

          <form class="auth-form" onsubmit="event.preventDefault();Toast.success('Instrucciones enviadas a tu correo (Simulación)');RouterInstance.navigate('/login')">
            <div class="form-group">
              <label class="form-label" for="recovery-email">Correo Electrónico Registrado</label>
              <input type="email" id="recovery-email" class="input" placeholder="tu@email.com" required value="maria.gonzalez@gmail.com" />
            </div>

            <button type="submit" class="btn btn-primary btn-lg w-full" style="justify-content:center">
              Enviar Instrucciones
            </button>

            <a class="btn btn-ghost w-full" data-route="/login" style="text-align:center">
              ← Volver al Inicio de Sesión
            </a>
          </form>
        </div>
      </div>
    </div>
  `;
}

window.renderLogin = renderLogin;
window.renderForgotPassword = renderForgotPassword;