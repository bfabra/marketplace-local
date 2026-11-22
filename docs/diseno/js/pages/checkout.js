/* ============================================================
   COMPRALOCAL — CHECKOUT & ORDER CONFIRMATION (#checkout)
   ============================================================ */
(function () {
  const Pages = window.Pages || {};
  const { esc, money } = window.Utils;

  const sanJuanDepartments = {
    'Capital': ['San Juan'],
    'Rivadavia': ['Rivadavia', 'La Bebida', 'Marquesado', 'Villa San Martín', 'Villa Tacú'],
    'Santa Lucía': ['Santa Lucía', 'Alto de Sierra', 'Colonia Gutiérrez', 'La Legua', 'Villa Don Bosco', 'Villa Hipódromo'],
    'Rawson': ['Villa Krause', 'Rawson', 'El Medanito', 'Médano de Oro', 'Villa Bolaños', 'Colonia Rodas', 'Colonia Fiorito'],
    'Pocito': ['Villa Aberastain', 'Carpintería', 'La Rinconada', 'Quinto Cuartel', 'Villa Independencia'],
    'Zonda': ['Villa Basilio Nievas', 'Zonda'],
    'Ullum': ['Villa Ibáñez', 'Ullum'],
    'Chimbas': ['Chimbas', 'Villa Paula Albarracín de Sarmiento', 'El Mogote', 'Villa Obrera', 'Barrio Andacollo'],
    '9 de Julio': ['9 de Julio', 'Las Chacritas', 'Alto de Sierra', 'Villa Fiorito'],
    'Albardón': ['Villa General San Martín', 'Campo Afuera', 'El Rincón', 'El Topón', 'La Cañada', 'Las Tapias', 'Las Lomitas', 'Las Tierritas', 'Las Piedritas'],
    'Angaco': ['Villa El Salvador', 'Las Tapias', 'Villa Sefair', 'Villa Sefair-Talacasto'],
    'San Martín': ['Villa San Martín', 'San Isidro', 'Dos Acequias', 'Villa Dominguito', 'Villa del Salvador', 'La Puntilla', 'Pie de Palo'],
    'Caucete': ['Caucete', 'Villa Independencia', 'Bermejo', 'El Rincón', 'Las Talas', 'Los Médanos', 'Vallecito', 'Pie de Palo'],
    '25 de Mayo': ['Santa Rosa', 'Villa Santa Rosa', 'Casuarinas', 'Las Casuarinas', 'La Chimbera', 'El Encón', 'Tupelí', 'Villa Borjas', 'Punta del Médano'],
    'Sarmiento': ['Villa Media Agua', 'Los Berros', 'Cochagual', 'Cañada Honda', 'Cienaguita', 'Colonia Fiscal', 'Divisadero', 'Guanacache', 'Pedernal', 'Las Lagunas'],
    'Calingasta': ['Barreal', 'Villa Calingasta', 'Tamberías', 'Sorocayense', 'Villa Pituil', 'Villa Nueva', 'Hilario', 'Puchuzum', 'Alto Verde'],
    'Iglesia': ['Rodeo', 'Villa Iglesia', 'Bella Vista', 'Las Flores', 'Tudcum', 'Angualasto', 'Colola', 'Pismanta', 'Malimán', 'Colangüil', 'Achango', 'El Llano', 'Tocota', 'Maipirinque', 'Campanario-Zonda', 'El Chinquillo'],
    'Jáchal': ['San José de Jáchal', 'Huaco', 'Mogna', 'Niquivil', 'La Falda', 'El Médano', 'Gran China', 'San Isidro', 'Pampa Vieja', 'Tamberías'],
    'Valle Fértil': ['San Agustín del Valle Fértil', 'Astica', 'Usno', 'Baldes del Rosario', 'Chucuma', 'Los Baldecitos', 'La Majadita', 'La Mesada', 'Las Casuarinas']
  };

  Pages.checkout = {
    layout: 'market',
    title: 'Finalizar Compra — Tu Comercio Local',

    render() {
      const cart = window.Store?.state?.cart || [];
      const subtotalProducts = cart.reduce((acc, item) => acc + ((item.product?.price || item.price || 0) * (item.quantity || item.qty || 1)), 0);

      // Agrupación por tienda y cálculo de envío ($2.999 por tienda)
      const storesMap = {};
      cart.forEach(item => {
        const prod = item.product || item;
        const storeId = prod.storeId || 'la-boutique';
        const storeObj = window.Data?.stores.find(s => s.id === storeId) || { name: 'Comercio local', location: 'San Juan' };
        if (!storesMap[storeId]) {
          storesMap[storeId] = {
            storeId: storeId,
            storeName: storeObj.name,
            items: []
          };
        }
        storesMap[storeId].items.push({
          product: prod,
          quantity: item.quantity || item.qty || 1
        });
      });

      const storeGroups = Object.values(storesMap);
      const totalCount = cart.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0);
      const totalShipping = storeGroups.length * 2999;
      const orderTotal = subtotalProducts + totalShipping;

      if (totalCount === 0) {
        return `
          <div class="page-wrapper page-enter" style="padding-top: 40px; padding-bottom: 60px;">
            <div class="market-container" style="max-width: 600px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 48px 20px;">
              <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px; color: var(--text);">No tenés productos para comprar</h2>
              <p style="color: var(--muted); font-size: 14px; margin-bottom: 24px;">Agregá productos de tus comercios locales favoritos antes de pasar por el checkout.</p>
              <a href="#stores" class="btn primary" style="text-decoration: none; padding: 10px 20px;">Explorar tiendas locales</a>
            </div>
          </div>
        `;
      }

      const currentUser = window.Store?.state?.user || { 
        name: 'Eleesdg', 
        phoneType: 'WhatsApp',
        phoneNumber: '2645123456', 
        email: 'eleesdg@gmail.com', 
        street: 'Av. Libertador General San Martín',
        number: '1200',
        neighborhood: 'Centro',
        department: 'Capital',
        locality: 'San Juan',
        references: 'Portón negro, Puerta roja'
      };

      // Construcción de la dirección legible del perfil
      const profileAddressFormatted = `${currentUser.street || 'Libertador'} ${currentUser.number || '1200'}${currentUser.neighborhood ? ' (' + currentUser.neighborhood + ')' : ''}, ${currentUser.locality || 'San Juan'}, ${currentUser.department || 'Capital'}, San Juan${currentUser.references ? ' — Ref: ' + currentUser.references : ''}`;

      const checkoutState = window.Store?.state?.checkoutState || {
        step: 1, 
        deliveryMode: 'profile', // 'profile' o 'custom'
        customStreet: '',
        customNumber: '',
        customNeighborhood: '',
        customHouseBlock: '',
        customDepartment: 'Capital',
        customLocality: 'San Juan',
        customReferences: '',
        paymentMethod: 'mercado-pago'
      };

      const deptKeys = Object.keys(sanJuanDepartments);
      const currentCustomDept = checkoutState.customDepartment || 'Capital';
      const deptOptions = deptKeys.map(d =>
        `<option value="${d}" ${currentCustomDept === d ? 'selected' : ''}>${d}</option>`
      ).join('');

      const localities = sanJuanDepartments[currentCustomDept] || ['San Juan'];
      const currentCustomLocality = checkoutState.customLocality || localities[0];
      const localityOptions = localities.map(l =>
        `<option value="${l}" ${currentCustomLocality === l ? 'selected' : ''}>${l}</option>`
      ).join('');

      return `
        <div class="page-wrapper page-enter" style="padding-top: 24px; padding-bottom: 60px;">
          <div class="market-container" style="max-width: 1000px; margin: 0 auto;">
            
            <!-- Breadcrumb -->
            <nav class="breadcrumb" aria-label="Navegación de migas" style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px;">
              <a href="#marketplace" style="color: var(--primary); text-decoration: none;">Inicio</a>
              <span style="color: var(--muted);">›</span>
              <a href="#cart" style="color: var(--text-secondary); text-decoration: none;">Carrito</a>
              <span style="color: var(--muted);">›</span>
              <span style="color: var(--muted); font-weight: 600;">Finalizar Compra</span>
            </nav>

            <!-- Stepper (Línea de pasos superior) -->
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 32px; gap: 12px;">
              <div onclick="CheckoutPage.setStep(1)" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <span style="width: 28px; height: 28px; border-radius: 50%; background: ${checkoutState.step >= 1 ? 'var(--primary)' : '#cbd5e1'}; color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 800;">1</span>
                <span style="font-size: 13px; font-weight: ${checkoutState.step === 1 ? '800' : '600'}; color: ${checkoutState.step >= 1 ? 'var(--text)' : 'var(--muted)'};">Carrito</span>
              </div>
              <div style="width: 60px; height: 2px; background: ${checkoutState.step >= 2 ? 'var(--primary)' : '#cbd5e1'};"></div>
              
              <div onclick="CheckoutPage.setStep(2)" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <span style="width: 28px; height: 28px; border-radius: 50%; background: ${checkoutState.step >= 2 ? 'var(--primary)' : '#cbd5e1'}; color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 800;">2</span>
                <span style="font-size: 13px; font-weight: ${checkoutState.step === 2 ? '800' : '600'}; color: ${checkoutState.step >= 2 ? 'var(--text)' : 'var(--muted)'};">Entrega</span>
              </div>
              <div style="width: 60px; height: 2px; background: ${checkoutState.step >= 3 ? 'var(--primary)' : '#cbd5e1'};"></div>
              
              <div onclick="CheckoutPage.setStep(3)" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <span style="width: 28px; height: 28px; border-radius: 50%; background: ${checkoutState.step >= 3 ? 'var(--primary)' : '#cbd5e1'}; color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 800;">3</span>
                <span style="font-size: 13px; font-weight: ${checkoutState.step === 3 ? '800' : '600'}; color: ${checkoutState.step >= 3 ? 'var(--text)' : 'var(--muted)'};">Pago</span>
              </div>
            </div>

            <!-- Page Header -->
            <div class="section-header" style="margin-bottom: 24px;">
              <h1 style="font-size: 24px; font-weight: 800; color: var(--text);">Finalizar Compra</h1>
              <p style="color: var(--muted); font-size: 13px; margin-top: 4px;">Completá los pasos de entrega y pago en San Juan.</p>
            </div>

            <form id="checkout-form" onsubmit="CheckoutPage.handleSubmit(event)">
              <div style="display: grid; grid-template-columns: 1fr 380px; gap: 32px; align-items: start;">
                
                <!-- Left Content -->
                <div style="display: flex; flex-direction: column; gap: 24px;">
                  
                  <!-- PASO 1: CARRITO -->
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                      <h2 style="font-size: 16px; font-weight: 800; color: var(--text); margin: 0;">
                        1. Revisión de Productos en el Carrito
                      </h2>
                      <a href="#cart" style="font-size: 12px; color: var(--primary); font-weight: 700; text-decoration: none;">Modificar carrito ›</a>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                      ${storeGroups.map(g => `
                        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
                          <div style="font-weight: 800; font-size: 13px; color: var(--primary); margin-bottom: 6px;">🏪 ${esc(g.storeName)}</div>
                          ${g.items.map(i => `
                            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text); margin-top: 4px;">
                              <span>${i.quantity}x ${esc(i.product.name)}</span>
                              <span style="font-weight: 700;">${money(i.product.price * i.quantity)}</span>
                            </div>
                          `).join('')}
                        </div>
                      `).join('')}
                    </div>

                    ${checkoutState.step === 1 ? `
                      <button type="button" onclick="CheckoutPage.setStep(2)" class="btn primary" style="margin-top: 16px; width: 100%; padding: 10px; font-weight: 800; border-radius: 8px; cursor: pointer;">
                        Continuar a Datos de Entrega ›
                      </button>
                    ` : ''}
                  </div>

                  <!-- PASO 2: ENTREGA -->
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; opacity: ${checkoutState.step >= 2 ? '1' : '0.6'};">
                    <h2 style="font-size: 16px; font-weight: 800; color: var(--text); margin-bottom: 16px;">
                      2. Dirección de Entrega en San Juan
                    </h2>

                    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
                      
                      <!-- Opción 1: Dirección del Perfil con detalle visible -->
                      <label onclick="CheckoutPage.selectDeliveryOption('profile')" style="cursor: pointer; border: 2px solid ${checkoutState.deliveryMode === 'profile' ? 'var(--primary)' : 'var(--border)'}; border-radius: 8px; padding: 14px; background: ${checkoutState.deliveryMode === 'profile' ? '#f0fdf4' : 'var(--bg)'}; display: flex; align-items: flex-start; gap: 12px;">
                        <input type="radio" name="delivery-opt" ${checkoutState.deliveryMode === 'profile' ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--primary);" />
                        <div>
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">Dirección guardada en tu perfil</div>
                          <div style="font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.4;">${esc(profileAddressFormatted)}</div>
                        </div>
                      </label>

                      <!-- Opción 2: Agregar otra dirección -->
                      <label onclick="CheckoutPage.selectDeliveryOption('custom')" style="cursor: pointer; border: 2px solid ${checkoutState.deliveryMode === 'custom' ? 'var(--primary)' : 'var(--border)'}; border-radius: 8px; padding: 14px; background: ${checkoutState.deliveryMode === 'custom' ? '#f0fdf4' : 'var(--bg)'}; display: flex; align-items: flex-start; gap: 12px;">
                        <input type="radio" name="delivery-opt" ${checkoutState.deliveryMode === 'custom' ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--primary);" />
                        <div style="width: 100%;">
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">+ Agregar otra dirección de entrega</div>
                          <div style="font-size: 11px; color: var(--muted);">Indicá una ubicación alternativa para este pedido en San Juan.</div>
                        </div>
                      </label>

                    </div>

                    <!-- Formulario completo de dirección alternativa -->
                    ${checkoutState.deliveryMode === 'custom' ? `
                      <div style="background: var(--bg); padding: 16px; border-radius: 10px; border: 1px solid var(--border); display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div style="grid-column: 1 / span 1;">
                          <label style="display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Calle / Avenida *</label>
                          <input type="text" id="custom-street" value="${esc(checkoutState.customStreet || '')}" placeholder="Ej: Av. Libertador" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" oninput="CheckoutPage.updateCustomField('customStreet', this.value)" />
                        </div>
                        <div>
                          <label style="display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Altura / Número *</label>
                          <input type="text" id="custom-number" value="${esc(checkoutState.customNumber || '')}" placeholder="Ej: 1200 Oeste" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" oninput="CheckoutPage.updateCustomField('customNumber', this.value)" />
                        </div>
                        <div>
                          <label style="display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Barrio / Villa / Loteo</label>
                          <input type="text" id="custom-neighborhood" value="${esc(checkoutState.customNeighborhood || '')}" placeholder="Ej: B° Copacabana" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" oninput="CheckoutPage.updateCustomField('customNeighborhood', this.value)" />
                        </div>
                        <div>
                          <label style="display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Casa / Manzana / Depto</label>
                          <input type="text" id="custom-houseBlock" value="${esc(checkoutState.customHouseBlock || '')}" placeholder="Ej: Casa 3, Mza B" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" oninput="CheckoutPage.updateCustomField('customHouseBlock', this.value)" />
                        </div>
                        <div>
                          <label style="display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Departamento (San Juan)</label>
                          <select id="custom-department" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" onchange="CheckoutPage.updateDept(this.value)">
                            ${deptOptions}
                          </select>
                        </div>
                        <div>
                          <label style="display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Localidad / Villa / Zona</label>
                          <select id="custom-locality" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" onchange="CheckoutPage.updateCustomField('customLocality', this.value)">
                            ${localityOptions}
                          </select>
                        </div>
                        <div style="grid-column: 1 / -1;">
                          <label style="display: block; font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Referencias adicionales para el cadete</label>
                          <input type="text" id="custom-references" value="${esc(checkoutState.customReferences || '')}" placeholder="Ej: Portón negro, Puerta roja" style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" oninput="CheckoutPage.updateCustomField('customReferences', this.value)" />
                        </div>
                      </div>
                    ` : ''}

                    ${checkoutState.step === 2 ? `
                      <button type="button" onclick="CheckoutPage.setStep(3)" class="btn primary" style="width: 100%; padding: 10px; font-weight: 800; border-radius: 8px; cursor: pointer;">
                        Continuar a Forma de Pago ›
                      </button>
                    ` : ''}
                  </div>

                  <!-- PASO 3: PAGO -->
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; opacity: ${checkoutState.step >= 3 ? '1' : '0.6'};">
                    <h2 style="font-size: 16px; font-weight: 800; color: var(--text); margin-bottom: 16px;">
                      3. Forma de Pago
                    </h2>

                    ${storeGroups.length > 1 ? `
                      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 14px; font-size: 12px; color: #b45309; line-height: 1.4;">
                        <strong>Compra multi-tienda (${storeGroups.length} comercios):</strong> Se procesará mediante pasarela unificada para simplificar la acreditación.
                      </div>
                    ` : ''}

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                      <label onclick="CheckoutPage.selectPaymentMethod('mercado-pago')" style="cursor: pointer; border: 2px solid ${checkoutState.paymentMethod === 'mercado-pago' ? 'var(--primary)' : 'var(--border)'}; border-radius: 8px; padding: 12px; background: ${checkoutState.paymentMethod === 'mercado-pago' ? '#f0fdf4' : 'var(--bg)'}; display: flex; align-items: center; gap: 12px;">
                        <input type="radio" name="pay-method" ${checkoutState.paymentMethod === 'mercado-pago' ? 'checked' : ''} style="accent-color: var(--primary);" />
                        <div>
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">Mercado Pago (Simulado)</div>
                          <div style="font-size: 11px; color: var(--muted);">Tarjetas de débito, crédito o dinero en cuenta</div>
                        </div>
                      </label>

                      <label onclick="CheckoutPage.selectPaymentMethod('transferencia')" style="cursor: pointer; border: 2px solid ${checkoutState.paymentMethod === 'transferencia' ? 'var(--primary)' : 'var(--border)'}; border-radius: 8px; padding: 12px; background: ${checkoutState.paymentMethod === 'transferencia' ? '#f0fdf4' : 'var(--bg)'}; display: flex; align-items: center; gap: 12px;">
                        <input type="radio" name="pay-method" ${checkoutState.paymentMethod === 'transferencia' ? 'checked' : ''} style="accent-color: var(--primary);" />
                        <div>
                          <div style="font-weight: 800; font-size: 13px; color: var(--text);">Transferencia Bancaria</div>
                          <div style="font-size: 11px; color: var(--muted);">Alias / CBU directo del comercio en San Juan</div>
                        </div>
                      </label>
                    </div>
                  </div>

                </div>

                <!-- Right: Summary Sidebar -->
                <div>
                  <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; position: sticky; top: 90px; display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-size: 18px; font-weight: 800; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                      Resumen del pedido
                    </h3>

                    <div style="display: flex; justify-content: space-between; font-size: 14px; color: var(--muted);">
                      <span>Subtotal productos</span>
                      <span style="color: var(--text); font-weight: 600;">${money(subtotalProducts)}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 14px; color: var(--muted);">
                      <span>Envío (${storeGroups.length} ${storeGroups.length === 1 ? 'tienda' : 'tiendas'})</span>
                      <span style="color: var(--text); font-weight: 600;">${money(totalShipping)}</span>
                    </div>

                    <div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; color: var(--text);">
                      <span>Total a abonar</span>
                      <span style="color: var(--primary);">${money(orderTotal)}</span>
                    </div>

                    <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
                      ${checkoutState.step === 3 ? `
                        <button type="submit" class="btn primary" style="width: 100%; height: 46px; font-weight: 800; border-radius: 8px; cursor: pointer;">
                          ✓ Confirmar y Pagar
                        </button>
                      ` : `
                        <button type="button" disabled style="width: 100%; height: 46px; font-weight: 800; border-radius: 8px; background: #cbd5e1; color: #64748b; border: none; cursor: not-allowed; display: flex; align-items: center; justify-content: center; gap: 6px;">
                          🔒 Completá los pasos 1 y 2
                        </button>
                      `}

                      <a href="#cart" class="btn secondary" style="text-align: center; width: 100%; height: 38px; font-size: 13px; font-weight: 700; border-radius: 8px; text-decoration: none; display: grid; place-items: center;">
                        ← Volver al carrito
                      </a>
                    </div>

                    <div style="font-size: 11px; color: var(--muted); text-align: center;">
                      🔒 Operación segura · CompraLocal San Juan
                    </div>

                  </div>
                </div>

              </div>
            </form>
          </div>
        </div>
      `;
    },
  };

  window.CheckoutPage = {
    setStep(stepNum) {
      const s = window.Store.state.checkoutState || { step: 1 };
      s.step = stepNum;
      window.Store.set({ checkoutState: s });
      if (window.App && typeof window.App.render === 'function') {
        window.App.render();
      }
    },

    selectDeliveryOption(mode) {
      const s = window.Store.state.checkoutState || { step: 2 };
      s.deliveryMode = mode;
      window.Store.set({ checkoutState: s });
      if (window.App && typeof window.App.render === 'function') {
        window.App.render();
      }
    },

    updateCustomField(field, val) {
      const s = window.Store.state.checkoutState || {};
      s[field] = val;
      window.Store.set({ checkoutState: s });
    },

    updateDept(deptValue) {
      const s = window.Store.state.checkoutState || {};
      const localities = sanJuanDepartments[deptValue] || ['San Juan'];
      s.customDepartment = deptValue;
      s.customLocality = localities[0];
      window.Store.set({ checkoutState: s });
      if (window.App && typeof window.App.render === 'function') {
        window.App.render();
      }
    },

    selectPaymentMethod(method) {
      const s = window.Store.state.checkoutState || { step: 3 };
      s.paymentMethod = method;
      window.Store.set({ checkoutState: s });
      if (window.App && typeof window.App.render === 'function') {
        window.App.render();
      }
    },

    handleSubmit(e) {
      e.preventDefault();

      const cart = window.Store?.state?.cart || [];
      if (cart.length === 0) {
        alert('El carrito está vacío.');
        return;
      }

      const orderId = `CL-SJ-${Math.floor(10000 + Math.random() * 90000)}`;
      
      window.Store.set({ cart: [], cartCount: 0, checkoutState: { step: 1, deliveryMode: 'profile', paymentMethod: 'mercado-pago' } });

      alert(`¡Pedido ${orderId} confirmado con éxito! Gracias por comprar en CompraLocal San Juan.`);
      window.Router.go('marketplace');
    }
  };
})();