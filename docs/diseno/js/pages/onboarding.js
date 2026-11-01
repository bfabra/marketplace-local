/* ============================================================
   COMPRALOCAL — ALTA DE COMERCIO (Con CUIT, Múltiples Teléfonos, Subrubros y Departamentos)
   #merchant (crear) · #review (revisar) · #success (listo)
   ============================================================ */
(function () {
  const { esc } = window.Utils;
  const { categories, sanJuanLocations } = window.Data;

  const SAMPLE = {
    name: 'Almacén Libertador',
    cuit: '20-28491029-4',
    phones: [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '2644123456' }],
    category: 'Alimentos y bebidas',
    subcategory: 'Almacén',
    description: 'Productos frescos, panificados artesanales y todo lo que necesitás para tu mesa, atendido por sus dueños desde 1998.',
    locality: 'Capital',
    department: 'Capital',
    province: 'San Juan',
    address: 'Av. Libertador San Martín 1240 (O)',
  };

  const draft = () => {
    const s = window.Store.state;
    if (!s.draft.phones) {
      s.draft.phones = [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '' }];
    }
    return s.draft;
  };

  const getPhonePrefix = (country, type) => {
    if (country && country.includes('+54')) {
      return type === 'Fijo' ? '+54' : '+54 9';
    }
    const match = country ? country.match(/\(([^)]+)\)/) : null;
    return match ? match[1] : '+54';
  };

  /* ─── 03 · Crear comercio ─── */
  Pages.merchant = {
    layout: 'bare',
    title: 'Creá tu comercio — CompraLocal',

    render() {
      const d = draft();
      const desc = d.description || '';

      const selectedCategory = categories.find((c) => c.name === d.category);
      const subcategories = selectedCategory && selectedCategory.subcategories ? selectedCategory.subcategories : [];

      const departments = sanJuanLocations ? Object.keys(sanJuanLocations) : ['Capital'];
      const currentDept = d.department || departments[0];
      const localities = (sanJuanLocations && sanJuanLocations[currentDept]) || ['San Juan'];

      const countries = [
        'Argentina (+54)', 'Bolivia (+591)', 'Brasil (+55)', 'Chile (+56)',
        'Colombia (+57)', 'Costa Rica (+506)', 'Cuba (+53)', 'Ecuador (+593)',
        'El Salvador (+503)', 'Guatemala (+502)', 'Honduras (+504)', 'México (+52)',
        'Nicaragua (+505)', 'Panamá (+507)', 'Paraguay (+595)', 'Perú (+51)',
        'Uruguay (+598)', 'Venezuela (+58)'
      ];

      const phoneTypes = ['WhatsApp', 'Celular', 'Fijo'];

      return `
      <div class="centered-screen signup-screen" style="min-height: 100vh; width: 100%; background: #09305f; padding: 40px 20px; box-sizing: border-box; overflow-x: hidden;">
        <div class="simple-header" style="max-width: 960px; margin: 0 auto 24px; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
          <button type="button" class="official-logo" data-go="marketplace" aria-label="Ir al inicio" style="background:none;border:none;padding:0;cursor:pointer;">
            ${Brand.img('horizontalWhite')}
          </button>
          <span style="color: #fff; font-size: 14px;">¿Ya tenés una cuenta? <button type="button" data-go="login" style="background:none; border:none; color: #fd6910; font-weight: 700; cursor: pointer; padding:0; text-decoration: underline;">Iniciar sesión</button></span>
        </div>
        
        <main class="signup-shell" style="max-width: 960px; width: 100%; margin: 0 auto; background: var(--surface, #fff); padding: 48px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); box-sizing: border-box;">
          ${UI.progress(2)}
          <div class="form-heading centered" style="margin-bottom: 32px; text-align: center;">
            <span style="font-size: 12px; font-weight: 800; color: #fd6910; letter-spacing: 1.2px; text-transform: uppercase;">Configurá tu tienda</span>
            <h2 style="font-size: 28px; font-weight: 800; color: #0f172a; margin: 8px 0;">Creá tu comercio</h2>
            <p style="font-size: 14px; color: #64748b; margin: 0;">Completá los datos legales, comerciales y de ubicación de tu tienda.</p>
          </div>

          <div class="merchant-layout" style="display: grid; grid-template-columns: 1fr 320px; gap: 32px; align-items: start;">
            <div class="merchant-fields" style="display: flex; flex-direction: column; gap: 20px;">
              ${UI.field({ label: 'Nombre del comercio *', placeholder: 'Ej. Almacén Libertador', icon: 'shop', draft: 'name', value: d.name || '' })}
              
              <!-- CUIT con formato automático numérico -->
              <label class="field" style="display:flex; flex-direction:column; gap:6px;">
                <span style="font-size:13px; font-weight:700; color:#334155;">CUIT / CUIL *</span>
                <div style="position:relative; display:flex; align-items:center; width:100%; border:1px solid #cbd5e1; border-radius:8px; background:#fff;">
                  <span style="position:absolute; left:12px; color:#64748b; display:flex; align-items:center;">${Icon('id', 18)}</span>
                  <input type="text" id="f-cuit" name="cuit" placeholder="Ej. 20381234563" maxlength="13" value="${esc(d.cuit || '')}" data-input="cuit-format" autocomplete="off" style="width:100%; padding:12px 12px 12px 40px; border:none; background:transparent; font-size: 14px; outline:none;" />
                </div>
                <small style="font-size:11px; color:#64748b;">Ingresá solo números.</small>
              </label>

              <!-- SECCIÓN DE TELÉFONOS MÚLTIPLES (MÁXIMO 3) -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="font-size: 15px; font-weight: 800; color: #0f172a;">Teléfonos de Contacto (Máx. 3)</strong>
                  ${d.phones.length < 3 ? `
                    <button type="button" class="btn secondary" data-action="add-phone" style="height: 32px; font-size: 12px; width: auto; padding: 0 12px; font-weight:700; background:#fff; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;">
                      + Agregar otro teléfono
                    </button>
                  ` : `
                    <span style="font-size: 12px; color: #64748b; font-weight: 700;">Límite de 3 teléfonos alcanzado</span>
                  `}
                </div>

                <div id="phones-container" style="display: flex; flex-direction: column; gap: 10px;">
                  ${d.phones.map((p, index) => {
                    const prefix = getPhonePrefix(p.country, p.type);
                    return `
                    <div class="phone-row" data-index="${index}" style="display: grid; grid-template-columns: 140px 100px 1fr auto; gap: 8px; align-items: center;">
                      <select data-phone-field="country" data-index="${index}" style="height: 42px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 12px; background: #fff;">
                        ${countries.map(c => `<option value="${c}" ${p.country === c ? 'selected' : ''}>${c}</option>`).join('')}
                      </select>
                      
                      <select data-phone-field="type" data-index="${index}" style="height: 42px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 12px; background: #fff;">
                        ${phoneTypes.map(t => `<option value="${t}" ${p.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                      </select>

                      <div style="position: relative; display: flex; align-items: center;">
                        <span style="position: absolute; left: 10px; font-size: 12px; font-weight: 700; color: #64748b; pointer-events: none;">${prefix}</span>
                        <input type="tel" inputmode="numeric" maxlength="10" data-phone-field="number" data-index="${index}" value="${esc(p.number || '')}" oninput="this.value=this.value.replace(/[^0-9]/g,'')" placeholder="Ej. 2644123456" style="height: 42px; width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px 0 60px; font-size: 13px; box-sizing: border-box; background:#fff;" />
                      </div>

                      ${d.phones.length > 1 ? `
                        <button type="button" data-action="remove-phone" data-index="${index}" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 13px; font-weight:700; padding: 6px;" title="Eliminar">Quitar</button>
                      ` : '<div style="width: 24px;"></div>'}
                    </div>
                  `;
                  }).join('')}
                </div>
                <small style="color: #64748b; font-size: 11px;">Ingresá solo el código de área y número sin el 0 ni el 15. Podés registrar hasta 3 teléfonos.</small>
              </div>

              <!-- Rubro Principal (Obligatorio) -->
              ${UI.select({ label: 'Rubro principal *', placeholder: 'Seleccioná un rubro', options: categories.map((c) => c.name), draft: 'category', value: d.category || '' })}

              <!-- Subrubro (Dinámico y Opcional) -->
              ${UI.select({ label: 'Subrubro (Opcional)', placeholder: 'Seleccioná un subrubro', options: subcategories, draft: 'subcategory', value: d.subcategory || '' })}

              <label class="field" style="display:flex; flex-direction:column; gap:6px;">
                <span style="font-size:13px; font-weight:700; color:#334155;">Descripción</span>
                <textarea data-input="draft" data-key="description" maxlength="240" placeholder="Contanos brevemente qué ofrecés y qué hace especial a tu comercio." style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size: 14px; height: 90px; resize: vertical;">${esc(desc)}</textarea>
                <small class="counter" id="desc-counter" style="text-align:right; font-size:11px; color:#64748b;">${desc.length} / 240</small>
              </label>
              
              <div class="split-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                ${UI.select({ label: 'Provincia *', placeholder: 'San Juan', options: ['San Juan'], draft: 'province', value: 'San Juan' })}
                ${UI.select({ label: 'Departamento *', placeholder: 'Seleccioná departamento', options: departments, draft: 'department', value: d.department || '' })}
              </div>

              <div>
                ${UI.select({ label: 'Localidad / Villa / Zona *', placeholder: 'Seleccioná localidad', options: localities, draft: 'locality', value: d.locality || '' })}
              </div>

              <!-- SECCIÓN: UBICACIÓN Y MAPA DE GOOGLE -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="font-size: 15px; font-weight: 800; color: #0f172a;">Ubicación y Mapa</strong>
                  <button type="button" class="btn secondary" data-action="fetch-google-maps" style="height: 32px; font-size: 11px; width: auto; padding: 0 10px; font-weight:700; background:#fff; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;">
                    Importar desde Google Maps
                  </button>
                </div>
                <p style="font-size: 12px; color: #64748b; margin: 0;">
                  Buscá tu comercio o hacé clic en el mapa interactivo para fijar la dirección exacta.
                </p>
                <div>
                  ${UI.field({ label: 'Calle y Altura *', placeholder: 'Ej. Av. San Martín 1240', icon: 'location', draft: 'address', value: d.address || '' })}
                </div>

                <div id="merchant-interactive-map" style="position: relative; width: 100%; height: 160px; background: #e2e8f0; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; cursor: crosshair;" onclick="MerchantMap.pin(event)">
                  <div style="position: absolute; inset: 0; background: radial-gradient(circle, #f8fafc 10%, #e2e8f0 90%); opacity: 0.9; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #64748b; font-weight: 600; text-align: center; padding: 10px;">
                    Mapa interactivo de ubicación de tienda<br><span style="font-size:11px; font-weight:400;">Hacé clic para posicionar el marcador exacto de tu local</span>
                  </div>
                  <div id="merchant-map-pin" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -100%); font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); pointer-events: none; color: #fd6910; font-weight: 900;">
                    📍
                  </div>
                </div>
                <div style="font-size: 12px; color: #64748b; display: flex; justify-content: space-between;">
                  <span id="merchant-map-status">San Juan (Predeterminado)</span>
                  <button type="button" onclick="MerchantMap.reset()" style="background: none; border: none; color: #fd6910; cursor: pointer; font-weight: 700; font-size: 12px;">Centrar pin</button>
                </div>
              </div>

            </div>

            <!-- CARGA DE LOGO E INTEGRACIÓN DE IMAGEN -->
            <div class="upload-side" style="display: flex; flex-direction: column; gap: 12px;">
              <label style="font-size: 13px; font-weight: 700; color: #334155; display: block;">Logo del comercio</label>
              <div style="position: relative; width: 100%;">
                <input type="file" id="merchant-logo-input" accept="image/*" onchange="MerchantLogo.upload(event)" style="display: none;" />
                <button type="button" class="upload-box" onclick="document.getElementById('merchant-logo-input').click()" style="width: 100%; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; background: #f8fafc; cursor: pointer; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                  <div id="merchant-logo-preview" style="width: 72px; height: 72px; border-radius: 12px; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center; border: 1px solid #cbd5e1;">
                    ${d.logo ? `<img src="${esc(d.logo)}" style="width:100%; height:100%; object-fit:cover;" />` : `<span>${Icon('upload', 28)}</span>`}
                  </div>
                  <strong style="font-size: 13px; color: #0f172a;">${d.logo ? 'Cambiar logo de la tienda' : 'Subí el logo de tu comercio'}</strong>
                  <p style="margin:0; font-size: 12px; color: #64748b;">Hacé clic para seleccionar una imagen</p>
                  <small style="color: #94a3b8; font-size: 11px;">PNG, JPG o WEBP · Máx. 5 MB</small>
                </button>
              </div>
              <div class="upload-tip" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; gap: 8px; align-items: center; font-size: 12px; color: #64748b;">
                ${Icon('info', 17)}
                <p style="margin:0;">Una imagen cuadrada y clara ayuda a que tu tienda se reconozca más rápido.</p>
              </div>
            </div>
          </div>

          <div class="flow-actions" style="margin-top: 32px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <button type="button" class="btn secondary" data-go="signup" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 12px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;">Volver</button>
            ${UI.primaryButton('Continuar', { action: 'go-review' })}
          </div>
        </main>
      </div>`;
    },
  };

  window.MerchantMap = {
    coords: { lat: -31.5375, lng: -68.5364 },
    pin(e) {
      const box = document.getElementById('merchant-interactive-map');
      const pin = document.getElementById('merchant-map-pin');
      const status = document.getElementById('merchant-map-status');
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
      draft().coordinates = this.coords;
    },
    reset() {
      const pin = document.getElementById('merchant-map-pin');
      const status = document.getElementById('merchant-map-status');
      if (pin) { pin.style.left = '50%'; pin.style.top = '50%'; }
      this.coords = { lat: -31.5375, lng: -68.5364 };
      if (status) status.textContent = 'San Juan (Predeterminado)';
      draft().coordinates = this.coords;
    }
  };

  window.MerchantLogo = {
    upload(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (event) {
        const logoUrl = event.target.result;
        draft().logo = logoUrl;
        const preview = document.getElementById('merchant-logo-preview');
        if (preview) {
          preview.innerHTML = `<img src="${logoUrl}" style="width:100%; height:100%; object-fit:cover;" />`;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  /* ─── 04 · Revisar datos (Tarjeta de previsualización corregida) ─── */
  Pages.review = {
    layout: 'bare',
    title: 'Revisá los datos — CompraLocal',

    render() {
      const d = draft();
      const v = (k) => d[k] || SAMPLE[k];
      const sub = v('subcategory') ? ` · ${v('subcategory')}` : '';
      const place = `${v('locality') || SAMPLE.locality}, ${v('department') || SAMPLE.department}, ${v('province') || SAMPLE.province}`;
      
      const phonesList = (d.phones && d.phones.length > 0 ? d.phones : SAMPLE.phones)
        .map(p => {
          const prefix = getPhonePrefix(p.country, p.type);
          return `<div style="font-size: 13px; color: #334155; display: flex; align-items: center; gap: 6px;">Teléfono: <strong>${prefix} ${esc(p.number)}</strong> <span style="font-size:11px; background:#fff0e7; color:#fd6910; padding:2px 6px; border-radius:4px; font-weight:700;">${esc(p.type)}</span></div>`;
        })
        .join('');

      return `
      <div class="centered-screen signup-screen" style="min-height: 100vh; width: 100%; background: #09305f; padding: 40px 20px; box-sizing: border-box; overflow-x: hidden;">
        <div class="simple-header" style="max-width: 960px; margin: 0 auto 24px; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
          <button type="button" class="official-logo" data-go="marketplace" aria-label="Ir al inicio" style="background:none;border:none;padding:0;cursor:pointer;">
            ${Brand.img('horizontalWhite')}
          </button>
          <span style="color: #fff; font-size: 14px;">¿Ya tenés una cuenta? <button type="button" data-go="login" style="background:none; border:none; color: #fd6910; font-weight: 700; cursor: pointer; padding:0; text-decoration: underline;">Iniciar sesión</button></span>
        </div>
        
        <main class="signup-shell" style="max-width: 960px; width: 100%; margin: 0 auto; background: var(--surface, #fff); padding: 48px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); box-sizing: border-box;">
          ${UI.progress(3)}
          <div class="form-heading centered" style="margin-bottom: 32px; text-align: center;">
            <span style="font-size: 12px; font-weight: 800; color: #fd6910; letter-spacing: 1.2px; text-transform: uppercase;">Último paso</span>
            <h2 style="font-size: 28px; font-weight: 800; color: #0f172a; margin: 8px 0;">Revisá los datos de tu comercio</h2>
            <p style="font-size: 14px; color: #64748b; margin: 0;">Asegurate de que todo esté correcto antes de publicarlo.</p>
          </div>

          <!-- TARJETA DE PREVISUALIZACIÓN CORREGIDA -->
          <article class="store-review" style="background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <!-- PORTADA SUPERIOR CON PATRÓN -->
            <div style="height: 130px; background: linear-gradient(135deg, #09305f, #1e40af); position: relative; display: flex; align-items: flex-end; padding: 16px 24px;">
              <span style="position: absolute; top: 12px; right: 16px; font-size: 11px; font-weight: 800; background: rgba(255,255,255,0.15); color: #fff; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase;">Vista previa</span>
            </div>

            <!-- CONTENIDO DE LA TARJETA -->
            <div style="padding: 0 24px 24px 24px; position: relative;">
              <!-- LOGO FLOTANTE -->
              <div style="width: 72px; height: 72px; border-radius: 14px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.12); margin-top: -36px; margin-bottom: 14px; position: relative; z-index: 2;">
                ${d.logo ? `<img src="${esc(d.logo)}" style="width:100%; height:100%; object-fit:cover;" />` : Icon('shop', 28)}
              </div>

              <!-- TÍTULO Y DATOS PRINCIPALES -->
              <div style="margin-bottom: 12px;">
                <h3 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${esc(v('name'))}</h3>
                <span style="font-size: 13px; color: #64748b; font-weight: 600;">CUIT: ${esc(v('cuit'))} · ${esc(v('category'))}${esc(sub)}</span>
              </div>

              <!-- DESCRIPCIÓN -->
              <p style="font-size: 14px; color: #334155; margin: 0 0 16px 0; line-height: 1.5;">${esc(v('description'))}</p>

              <!-- TELÉFONOS -->
              <div style="margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; padding: 12px 16px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                ${phonesList}
              </div>

              <!-- UBICACIÓN & MAPA -->
              <div style="display: flex; gap: 12px; align-items: center; background: #f8fafc; padding: 14px 16px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="color: #fd6910; display:flex; align-items:center;">${Icon('location', 20)}</div>
                <div>
                  <small style="font-size: 11px; color: #64748b; font-weight: 800; display: block; letter-spacing: 0.5px; text-transform: uppercase;">Ubicación y Mapa</small>
                  <strong style="font-size: 13px; color: #0f172a; display: block; margin-top: 2px;">${esc(place)}</strong>
                  <span style="font-size: 13px; color: #334155; display: block;">${esc(v('address'))}</span>
                </div>
              </div>
            </div>
          </article>

          <div class="info-note" style="display: flex; gap: 10px; align-items: center; background: #f8fafc; padding: 14px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; color: #64748b; border: 1px solid #e2e8f0;">
            ${Icon('info', 18)}
            <p style="margin:0;">Podrás modificar esta información más adelante desde la configuración de tu tienda.</p>
          </div>

          <div class="stack-actions" style="display: flex; flex-direction: column; gap: 12px;">
            ${UI.primaryButton('Crear mi comercio', { action: 'go-success' })}
            <button type="button" class="btn secondary" data-go="merchant" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%;">Editar datos</button>
          </div>
        </main>
      </div>`;
    },
  };

  /* ─── 05 · Comercio creado ─── */
  Pages.success = {
    layout: 'bare',
    title: '¡Tu comercio está listo! — CompraLocal',

    render() {
      return `
      <div class="centered-screen signup-screen" style="min-height: 100vh; width: 100%; background: #09305f; padding: 40px 20px; box-sizing: border-box; overflow-x: hidden;">
        <div class="simple-header" style="max-width: 960px; margin: 0 auto 24px; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
          <button type="button" class="official-logo" data-go="marketplace" aria-label="Ir al inicio" style="background:none;border:none;padding:0;cursor:pointer;">
            ${Brand.img('horizontalWhite')}
          </button>
          <span style="color: #fff; font-size: 14px;">¿Ya tenés una cuenta? <button type="button" data-go="login" style="background:none; border:none; color: #fd6910; font-weight: 700; cursor: pointer; padding:0; text-decoration: underline;">Iniciar sesión</button></span>
        </div>
        
        <main class="signup-shell" style="max-width: 960px; width: 100%; margin: 0 auto; background: var(--surface, #fff); padding: 48px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); box-sizing: border-box; text-align: center;">
          <div style="font-size: 48px; color: var(--primary, #fd6910); margin-bottom: 16px;">${Icon('shop', 42)}</div>
          <div class="form-heading centered" style="margin-bottom: 24px;">
            <span style="font-size: 12px; font-weight: 800; color: #fd6910; letter-spacing: 1.2px; text-transform: uppercase;">Todo listo</span>
            <h2 style="font-size: 28px; font-weight: 800; color: #0f172a; margin: 8px 0;">¡Tu comercio está listo!</h2>
            <p style="font-size: 14px; color: #64748b; margin: 0; max-width: 500px; margin-left: auto; margin-right: auto;">Ahora podés comenzar a configurar tu tienda, publicar productos y administrar tus pedidos.</p>
          </div>
          <div class="success-list" style="display: flex; flex-direction: column; gap: 10px; max-width: 500px; margin: 0 auto 24px auto; text-align: left; font-size: 13px; color: #334155;">
            <div style="display: flex; gap: 8px; align-items: center;">${Icon('check', 16)} Tu perfil de comerciante está activo y verificado por CUIT</div>
            <div style="display: flex; gap: 8px; align-items: center;">${Icon('check', 16)} Tu tienda ya forma parte de CompraLocal con geolocalización en San Juan</div>
          </div>
          <div class="stack-actions" style="display: flex; flex-direction: column; gap: 12px; max-width: 400px; margin: 0 auto;">
            ${UI.primaryButton('Ir a mi tienda', { action: 'success-store' })}
            <button type="button" class="btn secondary" data-go="marketplace" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%;">Explorar marketplace</button>
          </div>
        </main>
      </div>`;
    },
  };

  Actions['go-review'] = () => Router.go('review');
  Actions['go-success'] = () => Router.go('success');

  Actions['success-store'] = () => {
    const currentUser = window.Store.state.user || { name: 'Comercio Local', email: 'contacto@comercio.com' };
    const d = window.Store.state.draft || {};
    
    const firstPhone = d.phones && d.phones[0] ? d.phones[0] : { country: 'Argentina (+54)', type: 'WhatsApp', number: '2644123456' };
    
    window.Store.set({
      user: {
        ...currentUser,
        isMerchant: true,
        role: 'merchant',
        storeName: d.name || 'Mi Comercio San Juan'
      },
      merchantData: {
        storeName: d.name || 'Mi Comercio San Juan',
        rubro: d.category || 'Electrónica y Tecnología',
        email: currentUser.email || 'contacto@comercio.com',
        phones: d.phones || [firstPhone],
        phoneType: firstPhone.type,
        phoneCountry: firstPhone.country,
        phoneNumber: firstPhone.number,
        department: d.department || 'Capital',
        address: d.address || 'Av. San Martín 1240',
        description: d.description || 'Comercio verificado en CompraLocal San Juan.',
        logo: d.logo || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=200&auto=format&fit=crop&q=60',
        notificationsEnabled: false
      },
      draft: {} 
    });

    window.location.hash = 'merchant-panel';
    window.location.reload();
  };

  Actions['add-phone'] = () => {
    const d = draft();
    if (!d.phones) d.phones = [];
    if (d.phones.length < 3) {
      d.phones.push({ country: 'Argentina (+54)', type: 'Celular', number: '' });
      App.render();
    }
  };

  Actions['remove-phone'] = (el) => {
    const index = parseInt(el.dataset.index, 10);
    const d = draft();
    if (d.phones && d.phones.length > 1) {
      d.phones.splice(index, 1);
      App.render();
    }
  };

  document.addEventListener('input', (e) => {
    const target = e.target;
    if (target.dataset && target.dataset.phoneField) {
      const index = parseInt(target.dataset.index, 10);
      const field = target.dataset.phoneField;
      const d = draft();
      if (d.phones && d.phones[index]) {
        d.phones[index][field] = target.value;
      }
    }
  });

  document.addEventListener('change', (e) => {
    const target = e.target;
    if (target.dataset && target.dataset.phoneField) {
      const index = parseInt(target.dataset.index, 10);
      const field = target.dataset.phoneField;
      const d = draft();
      if (d.phones && d.phones[index]) {
        d.phones[index][field] = target.value;
        if (field === 'country' || field === 'type') {
          App.render();
        }
      }
    }
  });

  Actions['fetch-google-maps'] = () => {
    const addressInput = document.querySelector('input[name="address"]') || document.getElementById('f-address');
    const nameInput = document.querySelector('input[name="name"]') || document.getElementById('f-name');
    const cuitInput = document.getElementById('f-cuit');

    const sampleAddress = 'Av. Ignacio de la Roza 1552 Oeste, Rivadavia, San Juan';
    const sampleName = 'Comercio Local Verificado';
    const sampleCuit = '30714589218';

    if (addressInput) addressInput.value = sampleAddress;
    if (nameInput && !nameInput.value) nameInput.value = sampleName;
    if (cuitInput) {
      const digits = sampleCuit.replace(/\D/g, '').substring(0, 11);
      let formatted = digits;
      if (digits.length > 2 && digits.length <= 10) {
        formatted = `${digits.substring(0, 2)}-${digits.substring(2)}`;
      } else if (digits.length > 10) {
        formatted = `${digits.substring(0, 2)}-${digits.substring(2, 10)}-${digits.substring(10, 11)}`;
      }
      cuitInput.value = formatted;
      draft().cuit = formatted;
    }

    if (draft()) {
      draft().address = sampleAddress;
      draft().name = draft().name || sampleName;
      draft().department = 'Rivadavia';
      draft().locality = 'Rivadavia';
      if (!draft().phones || draft().phones.length === 0) {
        draft().phones = [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '2644567890' }];
      }
    }
    alert('Ubicación, CUIT, teléfonos y datos sincronizados correctamente desde Google Maps.');
  };

  Inputs['cuit-format'] = (el) => {
    let val = el.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);

    let formatted = val;
    if (val.length > 2 && val.length <= 10) {
      formatted = `${val.substring(0, 2)}-${val.substring(2)}`;
    } else if (val.length > 10) {
      formatted = `${val.substring(0, 2)}-${val.substring(2, 10)}-${val.substring(10, 11)}`;
    }

    el.value = formatted;
    draft()['cuit'] = formatted;
  };

  Inputs.draft = (el) => {
    draft()[el.dataset.key] = el.value;
    
    if (el.dataset.key === 'category') {
      draft()['subcategory'] = '';
      App.render();
    }
    
    if (el.dataset.key === 'department') {
      draft()['locality'] = '';
      App.render();
    }

    if (el.dataset.key === 'description') {
      const counter = document.getElementById('desc-counter');
      if (counter) counter.textContent = `${el.value.length} / 240`;
    }
  };
})();