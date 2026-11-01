/* ============================================================
   COMPRALOCAL — INICIAR SESIÓN (#login) Y CREAR CUENTA (#signup)
   ============================================================ */
(function () {
  const { esc } = window.Utils;
  const { photos } = window.Data;

  const LATAM_COUNTRIES = [
    { name: 'Argentina (+54)', code: '+54' },
    { name: 'Bolivia (+591)', code: '+591' },
    { name: 'Brasil (+55)', code: '+55' },
    { name: 'Chile (+56)', code: '+56' },
    { name: 'Colombia (+57)', code: '+57' },
    { name: 'Costa Rica (+506)', code: '+506' },
    { name: 'Cuba (+53)', code: '+53' },
    { name: 'Ecuador (+593)', code: '+593' },
    { name: 'El Salvador (+503)', code: '+503' },
    { name: 'Guatemala (+502)', code: '+502' },
    { name: 'Honduras (+504)', code: '+504' },
    { name: 'México (+52)', code: '+52' },
    { name: 'Nicaragua (+505)', code: '+505' },
    { name: 'Panamá (+507)', code: '+507' },
    { name: 'Paraguay (+595)', code: '+595' },
    { name: 'Perú (+51)', code: '+51' },
    { name: 'Uruguay (+598)', code: '+598' },
    { name: 'Venezuela (+58)', code: '+58' }
  ];

  const SAN_JUAN_DEPARTMENTS = [
    'Capital',
    'Rawson',
    'Rivadavia',
    'Chimbas',
    'Santa Lucía',
    'Pocito',
    'Albardón',
    'Caucete',
    'San Martín',
    'Angaco',
    '25 de Mayo',
    'Sarmiento',
    'Ullum',
    'Zonda',
    'Iglesia',
    'Jáchal',
    'Calingasta',
    'Valle Fértil',
    '9 de Julio'
  ];

  Pages.login = {
    layout: 'bare',
    title: 'Iniciar sesión — CompraLocal',

    render() {
      const s = window.Store.state;
      const ls = s.loginState;
      return `
      <div class="auth-screen">
        <section class="auth-visual" style="background-image:url('${photos.storefront}')">
          <div class="visual-overlay"></div>
          <div class="visual-top">
            <button type="button" class="official-logo auth-brand" data-go="marketplace" aria-label="Ir al inicio" style="background:none;border:none;padding:0;cursor:pointer;">
              ${Brand.img('horizontalWhite')}
            </button>
          </div>
          <div class="visual-copy">
            <span class="local-pill"><i></i> Hecho cerca tuyo</span>
            <h1>Todo lo que buscás,<br /><em>cerca tuyo.</em></h1>
            <p>Descubrí comercios y productos de tu ciudad en un solo lugar.</p>
            <div class="visual-trust"><span>${Icon('shop', 18)} +450 comercios</span><span>${Icon('users', 18)} Comunidad local</span></div>
          </div>
        </section>
        <section class="auth-form-area">
          <button type="button" class="mobile-logo" data-go="marketplace" aria-label="Ir al inicio" style="background:none;border:none;padding:0;cursor:pointer;">
            ${Brand.img('symbol')}
          </button>
          <div class="form-shell">
            ${ls === 'success' ? `<div class="alert success" role="status">${Icon('check', 17)}<div><strong>¡Inicio de sesión exitoso!</strong><span>Te estamos llevando a tu destino.</span></div></div>` : ''}
            ${ls === 'error' ? `<div class="alert error" role="alert">${Icon('info', 17)}<div><strong>No pudimos iniciar sesión</strong><span>Revisá tu correo y contraseña.</span></div></div>` : ''}
            <div class="form-heading"><span>HOLA</span><h2>Bienvenido</h2><p>Iniciá sesión para continuar.</p></div>
            <form data-form="login" novalidate>
              ${UI.field({ label: 'Correo electrónico', placeholder: 'nombre@correo.com', icon: 'mail', name: 'email', type: 'email', value: s.loginEmail || '', autocomplete: 'email', state: ls === 'focus' ? 'focus' : '' })}
              ${UI.field({ label: 'Contraseña', placeholder: 'Ingresá tu contraseña', icon: 'lock', name: 'password', type: 'password', autocomplete: 'current-password', state: ls === 'error' ? 'error' : '', helper: ls === 'error' ? 'La contraseña o correo ingresada es incorrecta.' : '' })}
              <div class="form-options">
                <label class="checkbox"><input type="checkbox" /><span>${Icon('check', 12)}</span>Recordarme</label>
                <button type="button" class="text-link" data-action="social-demo">¿Olvidaste tu contraseña?</button>
              </div>
              ${UI.primaryButton('Iniciar sesión', { type: 'submit', loading: ls === 'loading' })}
            </form>
            <div class="separator"><span>o continuar con</span></div>
            ${UI.socialButton()}
            <p class="switch-copy">¿Todavía no tenés una cuenta? <button type="button" data-go="signup">Crear cuenta</button></p>
          </div>
        </section>
      </div>`;
    },
  };

  Forms.login = (form) => {
    const email = form.elements.email.value.trim();
    const pass = form.elements.password.value;
    const valid = /^\S+@\S+\.\S+$/.test(email) && pass.length > 0;
    window.Store.set({ loginEmail: email });
    if (!valid) { window.Store.set({ loginState: 'error' }); App.render(); return; }
    window.Store.set({ loginState: 'loading' });
    App.render();
    setTimeout(() => {
      if (Router.current() === 'login') { window.Store.set({ loginState: 'success' }); App.render(); }
    }, 900);
    setTimeout(() => {
      if (Router.current() === 'login') {
        const dummyName = email.split('@')[0] || 'Cliente';
        const user = {
          name: dummyName.charAt(0).toUpperCase() + dummyName.slice(1),
          email: email,
          initials: dummyName.substring(0, 2).toUpperCase()
        };
        window.Store.set({ loginState: 'default', user: user });
        
        const cart = window.Store?.state?.cart || [];
        if (cart.length > 0) {
          window.location.hash = 'cart';
        } else {
          window.location.hash = 'marketplace';
        }
      }
    }, 1500);
  };

  Actions['social-demo'] = () => {
    window.alert('Demostración: esta acción todavía no está conectada a un servicio real.');
  };

  /* ─── Crear cuenta (Cliente con Nombre, Apellido, DNI, Teléfono estructurado, Domicilio detallado, Mapa) ─── */
  Pages.signup = {
    layout: 'bare',
    title: 'Crear cuenta — CompraLocal',

    render() {
      const countryOptions = LATAM_COUNTRIES.map(c => 
        `<option value="${c.name}">${c.name}</option>`
      ).join('');

      const typeOptions = ['WhatsApp', 'Celular', 'Fijo'].map(t =>
        `<option value="${t}">${t}</option>`
      ).join('');

      const deptOptions = SAN_JUAN_DEPARTMENTS.map(d =>
        `<option value="${d}">${d}</option>`
      ).join('');

      return `
      <div class="centered-screen signup-screen" style="min-height: 100vh; width: 100%; background: #09305f; padding: 40px 20px; box-sizing: border-box; overflow-x: hidden;">
        <div class="simple-header" style="max-width: 960px; margin: 0 auto 24px; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
          <button type="button" class="official-logo" data-go="marketplace" aria-label="Ir al inicio" style="background:none;border:none;padding:0;cursor:pointer;">
            ${Brand.img('horizontalWhite')}
          </button>
          <span style="color: #fff; font-size: 14px;">¿Ya tenés una cuenta? <button type="button" data-go="login" style="background:none; border:none; color: #fd6910; font-weight: 700; cursor: pointer; padding:0; text-decoration: underline;">Iniciar sesión</button></span>
        </div>
        
        <main class="signup-shell" style="max-width: 960px; width: 100%; margin: 0 auto; background: var(--surface, #fff); padding: 48px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); box-sizing: border-box;">
          <div id="signup-alert-root"></div>

          <div class="form-heading centered" style="margin-bottom: 32px; text-align: center;">
            <span style="font-size: 12px; font-weight: 800; color: #fd6910; letter-spacing: 1.2px; text-transform: uppercase;">Sumate a CompraLocal</span>
            <h2 style="font-size: 28px; font-weight: 800; color: #0f172a; margin: 8px 0;">Creá tu cuenta de cliente</h2>
            <p style="font-size: 14px; color: #64748b; margin: 0;">Es rápido y gratis. Necesitamos tus datos y dirección exacta para coordinar los envíos en San Juan.</p>
          </div>
          
          <form data-form="signup" novalidate style="display: flex; flex-direction: column; gap: 20px;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Nombre *</label>
                <input type="text" name="firstName" class="input" placeholder="Ej. Martina" autocomplete="given-name" oninput="this.value=this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g,'')" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
              </div>
              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Apellido *</label>
                <input type="text" name="lastName" class="input" placeholder="Ej. López" autocomplete="family-name" oninput="this.value=this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g,'')" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">DNI *</label>
                <input type="text" inputmode="numeric" name="dni" class="input" placeholder="Ej. 38123456" oninput="this.value=this.value.replace(/[^0-9]/g,'')" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
              </div>
              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Correo electrónico *</label>
                <input type="email" name="email" class="input" placeholder="nombre@correo.com" autocomplete="email" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
              </div>
            </div>

            <!-- SECCIÓN TELÉFONO ESTRUCTURADO (LATAM + TIPO + NÚMERO) -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px;">
              <div style="font-weight: 800; font-size: 15px; color: var(--text, #0f172a);">Teléfono de Contacto / WhatsApp</div>
              <div style="display: grid; grid-template-columns: 1.5fr 1fr 2fr; gap: 16px;">
                <div>
                  <label class="form-label" style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">País (Característica)</label>
                  <select name="phoneCountry" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;">
                    ${countryOptions}
                  </select>
                </div>
                <div>
                  <label class="form-label" style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Tipo</label>
                  <select name="phoneType" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;">
                    ${typeOptions}
                  </select>
                </div>
                <div>
                  <label class="form-label" style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Número (solo números) *</label>
                  <input type="tel" inputmode="numeric" name="phoneNumber" class="input" placeholder="Ej. 2645123456" oninput="this.value=this.value.replace(/[^0-9]/g,'')" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
                </div>
              </div>
            </div>

            <!-- DOMICILIO DETALLADO PARA EL CADETE -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
              <div style="font-weight: 800; font-size: 15px; color: var(--text, #0f172a);">Domicilio de Entrega (Para el Repartidor / Cadete)</div>

              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                <div>
                  <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Calle / Avenida *</label>
                  <input type="text" name="street" class="input" placeholder="Ej. Av. Libertador Gral. San Martín" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
                </div>
                <div>
                  <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Altura / N° *</label>
                  <input type="text" inputmode="numeric" name="number" class="input" placeholder="Ej. 1200" oninput="this.value=this.value.replace(/[^0-9]/g,'')" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                  <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Barrio / Villa / Loteo</label>
                  <input type="text" name="neighborhood" class="input" placeholder="Ej. B° Copacabana" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
                </div>
                <div>
                  <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Casa / Manzana / Depto</label>
                  <input type="text" name="houseBlock" class="input" placeholder="Ej. Casa 3, Manzana B" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
                </div>
              </div>

              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Departamento (San Juan) *</label>
                <select name="department" class="input" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;">
                  ${deptOptions}
                </select>
              </div>

              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Referencias adicionales para el cadete</label>
                <input type="text" name="references" class="input" placeholder="Ej. Portón negro, timbre rojo, entre calles Gral. Acha y Tucumán" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
              </div>

              <!-- Marcador Interactivo / Mapa simulado -->
              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Ubicación exacta en el mapa (San Juan)</label>
                <div id="signup-interactive-map" style="position: relative; width: 100%; height: 160px; background: #e2e8f0; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; cursor: crosshair;" onclick="SignupMap.pin(event)" title="Hacé clic para marcar tu ubicación exacta">
                  <div style="position: absolute; inset: 0; background: radial-gradient(circle, #f8fafc 10%, #e2e8f0 90%); opacity: 0.9; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #64748b; font-weight: 600; text-align: center; padding: 10px;">
                    Mapa interactivo San Juan<br><span style="font-size:11px; font-weight:400;">Hacé clic para posicionar el marcador de entrega exacto</span>
                  </div>
                  <div id="signup-map-pin" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -100%); font-size: 26px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); pointer-events: none;">
                    📍
                  </div>
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 6px; display: flex; justify-content: space-between;">
                  <span id="signup-map-status">Centro, San Juan (Predeterminado)</span>
                  <button type="button" onclick="SignupMap.reset()" style="background: none; border: none; color: #fd6910; cursor: pointer; font-weight: 700; font-size: 12px;">Centrar pin</button>
                </div>
              </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Contraseña *</label>
                <input type="password" name="password" class="input" placeholder="Mínimo 8 caracteres" autocomplete="new-password" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
              </div>
              <div>
                <label class="form-label" style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Repetir contraseña *</label>
                <input type="password" name="passwordRepeat" class="input" placeholder="Repetirla" autocomplete="new-password" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px;" />
              </div>
            </div>
            
            <div style="margin: 12px 0; display: flex; align-items: center; gap: 10px; font-size: 13px; color: #64748b;">
              <input type="checkbox" name="terms" required style="width: 18px; height: 18px; cursor: pointer; margin: 0;" />
              <label for="terms" style="cursor: pointer; margin: 0; line-height: 1.4;">
                Acepto los <button type="button" onclick="event.preventDefault()" style="background:none; border:none; color:#09305f; font-weight:700; text-decoration:underline; cursor:pointer; padding:0; font-size: inherit;">Términos y Condiciones</button>.
              </label>
            </div>

            ${UI.primaryButton('Crear cuenta y continuar', { type: 'submit' })}
          </form>
        </main>
      </div>`;
    },
  };

  // Helper para el mapa interactivo de registro
  window.SignupMap = {
    coords: { lat: -31.5375, lng: -68.5364 },
    pin(e) {
      const box = document.getElementById('signup-interactive-map');
      const pin = document.getElementById('signup-map-pin');
      const status = document.getElementById('signup-map-status');
      if (!box || !pin) return;
      const rect = box.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const px = (x / rect.width) * 100;
      const py = (y / rect.height) * 100;
      pin.style.left = `${px}%`;
      pin.style.top = `${py}%`;
      const lat = (-31.5300 - (py / 100) * 0.02).toFixed(4);
      const lng = (-68.5250 + (px / 100) * 0.02).toFixed(4);
      this.coords = { lat, lng };
      if (status) status.textContent = `Pin: Lat ${lat}, Lng ${lng}`;
    },
    reset() {
      const pin = document.getElementById('signup-map-pin');
      const status = document.getElementById('signup-map-status');
      if (pin) { pin.style.left = '50%'; pin.style.top = '50%'; }
      this.coords = { lat: -31.5375, lng: -68.5364 };
      if (status) status.textContent = 'Centro, San Juan (Predeterminado)';
    }
  };

  const handleSignup = (form) => {
    form.querySelectorAll('.field').forEach((f) => {
      f.classList.remove('error', 'field-error');
    });

    const fields = ['firstName', 'lastName', 'dni', 'phoneNumber', 'street', 'number', 'department', 'email', 'password', 'passwordRepeat'];
    let hasError = false;

    fields.forEach((fieldName) => {
      const input = form.elements[fieldName];
      const val = input ? input.value.trim() : '';
      const fieldWrapper = input ? input.closest('.field') : null;

      if (!val) {
        hasError = true;
        if (fieldWrapper) fieldWrapper.classList.add('field-error', 'error');
      }
    });

    const passInput = form.elements.password;
    const passRepeatInput = form.elements.passwordRepeat;
    if (passInput && passRepeatInput && passInput.value && passRepeatInput.value && passInput.value !== passRepeatInput.value) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    if (hasError) {
      alert('Por favor completá todos los campos obligatorios del formulario.');
      return;
    }

    const firstName = form.elements.firstName.value.trim();
    const lastName = form.elements.lastName.value.trim();
    const fullName = `${firstName} ${lastName}`;
    const dni = form.elements.dni.value.trim();
    const email = form.elements.email.value.trim();

    const phoneCountry = form.elements.phoneCountry.value;
    const phoneType = form.elements.phoneType.value;
    const rawPhoneNumber = form.elements.phoneNumber.value.trim();

    let formattedPrefix = '+54';
    if (phoneCountry.includes('+54')) {
      formattedPrefix = (phoneType === 'Fijo') ? '+54' : '+54 9';
    } else {
      const match = phoneCountry.match(/\(([^)]+)\)/);
      formattedPrefix = match ? match[1] : '+54';
    }
    const fullDisplayPhone = `${formattedPrefix} ${rawPhoneNumber}`;

    const street = form.elements.street.value.trim();
    const number = form.elements.number.value.trim();
    const neighborhood = form.elements.neighborhood.value.trim();
    const houseBlock = form.elements.houseBlock.value.trim();
    const department = form.elements.department.value;
    const references = form.elements.references.value.trim();

    const fullAddress = `${street} ${number}${neighborhood ? ', ' + neighborhood : ''}${houseBlock ? ', ' + houseBlock : ''}, ${department}, San Juan`;
    const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();

    const newUser = {
      name: fullName,
      firstName: firstName,
      lastName: lastName,
      dni: dni,
      phoneCountry: phoneCountry,
      phoneType: phoneType,
      phoneNumber: rawPhoneNumber,
      phone: fullDisplayPhone,
      email: email,
      street: street,
      number: number,
      neighborhood: neighborhood,
      houseBlock: houseBlock,
      department: department,
      references: references,
      address: fullAddress,
      coordinates: window.SignupMap ? window.SignupMap.coords : { lat: -31.5375, lng: -68.5364 },
      initials: initials
    };

    window.Store.set({ user: newUser });

    const alertContainer = document.getElementById('signup-alert-root');
    if (alertContainer) {
      alertContainer.innerHTML = `
        <div class="alert success" role="status" style="margin-bottom:20px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);">
          ${Icon('check', 18)}
          <div>
            <span>¡Cuenta de cliente creada con éxito! Hola ${esc(firstName)}, volviendo a tu carrito...</span>
          </div>
        </div>
      `;
    }

    setTimeout(() => {
      const cart = window.Store?.state?.cart || [];
      if (cart.length > 0) {
        window.location.hash = 'cart';
      } else {
        window.location.hash = 'marketplace';
      }
    }, 1300);
  };

  Forms.signup = handleSignup;
})();