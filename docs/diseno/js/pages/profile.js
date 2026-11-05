/* ============================================================
   COMPRALOCAL — PANEL DE PERFIL DE CLIENTE (#profile)
   ============================================================ */
(function () {
  const { esc, money } = window.Utils;

  const DEFAULT_AVATARS = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Juan'
  ];

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

  Pages.profile = {
    layout: 'market',
    title: 'Mi Cuenta — CompraLocal San Juan',

    render() {
      const s = window.Store.state;
      const activeTab = s.profileTab || 'personal-data';
      const isEditing = !!s.profileEditing; 
      const toastMessage = s.profileToast || null; 
      const activePurchaseId = s.activePurchaseId || null;
      const expirationMonths = s.purchaseExpirationMonths || '12';

      const user = s.user || {
        firstName: 'Nombre',
        lastName: 'Apellido',
        name: 'Nombre y Apellido',
        email: 'tucorreo@gmail.com',
        phoneType: 'WhatsApp',
        phoneCountry: 'Argentina (+54)',
        phoneNumber: '2645123456',
        street: 'Av. Libertador General San Martín',
        number: '1200',
        neighborhood: 'Centro',
        houseBlock: '',
        floorApt: '',
        department: 'Capital',
        locality: 'San Juan',
        references: 'Portón negro, timbre roto',
        avatar: null
      };

      const firstName = user.firstName || (user.name ? user.name.split(' ')[0] : 'Eleesdg');
      const lastName = user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : '');
      const initials = (firstName[0] || 'U') + (lastName[0] || '');

      const purchases = window.Data?.orders || [
        { 
          id: 'ORD-8821', 
          date: '12/10/2026', 
          store: 'La Boutique', 
          items: [
            { name: 'Remera básica oversize', qty: 1, price: 24900 },
            { name: 'Bolso camel', qty: 1, price: 32700 }
          ], 
          subtotal: 57600,
          shippingCost: 2999,
          total: 60599, 
          status: 'Entregado',
          paymentMethod: 'Tarjeta de Crédito (Visa •••• 4821)',
          shippingAddress: `${user.street || 'Libertador'} ${user.number || '1200'}, ${user.department || 'Capital'}, San Juan`,
          expiresOn: '12/10/2027'
        },
        { 
          id: 'ORD-7512', 
          date: '01/09/2026', 
          store: 'TecniStore', 
          items: [
            { name: 'Auriculares Inalámbricos Bluetooth', qty: 1, price: 18500 }
          ], 
          subtotal: 18500,
          shippingCost: 2999,
          total: 21499, 
          status: 'Entregado',
          paymentMethod: 'Mercado Pago (Alias: compralocal.sj)',
          shippingAddress: `${user.street || 'Libertador'} ${user.number || '1200'}, ${user.department || 'Capital'}, San Juan`,
          expiresOn: '01/09/2027'
        }
      ];

      const activeShipment = {
        id: 'ORD-9942',
        storeId: 'store-tecno-san-juan',
        store: 'TecnoLocal San Juan',
        date: '15 de Octubre',
        product: 'Auriculares Inalámbricos Bluetooth',
        productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&auto=format&fit=crop&q=60',
        price: 18500,
        units: 1,
        currentStep: 3, 
        shippingStatusTitle: 'Envío en camino hacia tu domicilio',
        shippingStatusDesc: 'El repartidor se encuentra en ruta por San Juan.',
        trackingLogs: [
          { time: '15 oct 08:30 hs', desc: 'Envío en camino. El cadete salió del centro de distribución.' },
          { time: '14 oct 19:15 hs', desc: 'Entregado al repartidor local.' },
          { time: '14 oct 16:00 hs', desc: 'Procesando compra y empaquetado en tienda.' },
          { time: '14 oct 14:00 hs', desc: 'Pago aprobado y acreditado.' }
        ],
        address: `${user.street || 'Libertador'} ${user.number || '1200'}${user.neighborhood ? ' (' + user.neighborhood + ')' : ''}, ${user.department || 'Capital'}, San Juan`,
        addressDetails: `${user.houseBlock ? user.houseBlock : ''} ${user.references ? '— Ref: ' + user.references : ''}`
      };

      const favoriteStores = window.Data?.stores ? window.Data.stores.slice(0, 3) : [
        { id: 'la-boutique', name: 'La Boutique', category: 'INDUMENTARIA Y MODA', location: 'Capital, San Juan', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop&q=60' },
        { id: 'tecnistore', name: 'TecniStore', category: 'ELECTRÓNICA', location: 'Capital, San Juan', image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=500&auto=format&fit=crop&q=60' }
      ];

      const favoriteProducts = window.Data?.products ? window.Data.products.slice(0, 3) : [];

      const avatarHtml = user.avatar 
        ? '<img src="' + esc(user.avatar) + '" alt="' + esc(firstName) + '" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />'
        : '<div style="font-size: 32px; font-weight: 800; color: #fd6910;">' + initials.toUpperCase() + '</div>';

      const heroAvatarHtml = user.avatar 
        ? '<img src="' + esc(user.avatar) + '" alt="' + esc(firstName) + '" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />'
        : initials.toUpperCase();

      const rawPhone = user.phoneNumber || '2645123456';
      const pType = user.phoneType || 'WhatsApp';
      const pCountry = user.phoneCountry || 'Argentina (+54)';
      
      let formattedPrefix = '+54';
      if (pCountry.includes('+54')) {
        formattedPrefix = (pType === 'Fijo') ? '+54' : '+54 9';
      } else {
        const match = pCountry.match(/\(([^)]+)\)/);
        formattedPrefix = match ? match[1] : '+54';
      }
      const fullDisplayPhone = `${formattedPrefix} ${rawPhone}`;

      return `
        <div class="market-container" style="max-width: 1100px; margin: 24px auto; padding: 0 16px;">
          
          ${toastMessage ? `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 14px 20px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(22,101,52,0.08); animation: fadeIn 0.3s ease;">
              <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px;">
                <span style="background: #22c55e; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px;">✓</span>
                ${esc(toastMessage)}
              </div>
              <button type="button" data-action="close-profile-toast" style="background: none; border: none; color: #166534; font-weight: 800; cursor: pointer; font-size: 16px;" aria-label="Cerrar notificación">&times;</button>
            </div>
          ` : ''}

          <nav aria-label="Navegación" style="margin-bottom: 16px; font-size: 13px; color: var(--muted, #64748b);">
            <button data-go="marketplace" style="background:none; border:none; color:var(--primary, #fd6910); cursor:pointer; padding:0; font-weight:700;">Inicio</button>
            <span style="margin: 0 6px;">›</span>
            <span>Mi Cuenta</span>
          </nav>

          <div style="padding: 24px 32px; background: linear-gradient(135deg, #09305f, #1e40af); color: white; border-radius: 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 14px rgba(0,0,0,0.12);">
            <div style="display: flex; align-items: center; gap: 18px;">
              <div style="width: 68px; height: 68px; border-radius: 50%; background: white; color: #09305f; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; box-shadow: 0 2px 8px rgba(0,0,0,0.2); overflow: hidden;">
                ${heroAvatarHtml}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: white;">${esc(firstName)} ${esc(lastName)}</h1>
                  <span style="background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">Cliente San Juan</span>
                </div>
                <div style="color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 6px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                  <span style="display: flex; align-items: center; gap: 6px;">${window.Icon('mail', 15)} ${esc(user.email)}</span>
                  <span style="display: flex; align-items: center; gap: 6px;">${window.Icon('phone', 15)} ${esc(fullDisplayPhone)} (${esc(pType)})</span>
                </div>
              </div>
            </div>

            <div>
              <button type="button" data-action="logout" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
                Cerrar sesión
              </button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 290px 1fr; gap: 24px; align-items: start;">

            <aside style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
              
              <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid var(--border, #e2e8f0); margin-bottom: 16px;">
                <div style="position: relative; width: 120px; height: 120px; margin: 0 auto 16px; border-radius: 50%; background: #fff0e7; display: flex; align-items: center; justify-content: center; border: 4px solid var(--primary, #fd6910); box-shadow: 0 6px 16px rgba(253,105,16,0.25);">
                  ${avatarHtml}
                  <label title="Subir foto de perfil" style="position: absolute; bottom: 2px; right: 2px; background: var(--primary, #fd6910); color: #fff; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    ${window.Icon('camera', 18)}
                    <input type="file" id="avatar-input" accept="image/*" style="display:none;" onchange="window.Actions['upload-avatar'](this)" />
                  </label>
                </div>

                <h3 style="font-size: 17px; font-weight: 800; color: var(--text, #0f172a); margin: 0;">${esc(firstName)} ${esc(lastName)}</h3>
                <p style="font-size: 12px; color: var(--muted, #64748b); margin: 2px 0 10px;">${esc(user.email)}</p>
                
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border, #e2e8f0);">
                  <span style="display: block; font-size: 11px; font-weight: 700; color: var(--muted, #64748b); margin-bottom: 8px;">O elegí un avatar vectorial:</span>
                  <div style="display: flex; justify-content: center; gap: 8px;">
                    ${DEFAULT_AVATARS.map(url => '<img src="' + url + '" onclick="window.Actions[\'select-default-avatar\'](\'' + url + '\')" style="width: 32px; height: 32px; border-radius: 50%; cursor: pointer; border: 1px solid #cbd5e1; background: #f8fafc;" title="Seleccionar avatar" />').join('')}
                  </div>
                </div>
              </div>

              <nav style="display: flex; flex-direction: column; gap: 6px;">
                <button type="button" data-action="set-profile-tab" data-tab="personal-data" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; ${activeTab === 'personal-data' ? 'background: var(--primary, #09305f); color: #fff;' : 'background: none; color: var(--text, #0f172a);'}">
                  ${window.Icon('user', 18)} <span>Datos del perfil</span>
                </button>

                <button type="button" data-action="set-profile-tab" data-tab="purchases" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; ${activeTab === 'purchases' ? 'background: var(--primary, #09305f); color: #fff;' : 'background: none; color: var(--text, #0f172a);'}">
                  ${window.Icon('shopping', 18)} <span>Mis compras</span>
                </button>

                <button type="button" data-action="set-profile-tab" data-tab="shipments" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; ${activeTab === 'shipments' ? 'background: var(--primary, #09305f); color: #fff;' : 'background: none; color: var(--text, #0f172a);'}">
                  ${window.Icon('truck', 18)} <span>Estado de envíos</span>
                </button>

                <button type="button" data-action="set-profile-tab" data-tab="fav-stores" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; ${activeTab === 'fav-stores' ? 'background: var(--primary, #09305f); color: #fff;' : 'background: none; color: var(--text, #0f172a);'}">
                  ${window.Icon('shop', 18)} <span>Tiendas favoritas</span>
                </button>

                <button type="button" data-action="set-profile-tab" data-tab="fav-products" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; ${activeTab === 'fav-products' ? 'background: var(--primary, #09305f); color: #fff;' : 'background: none; color: var(--text, #0f172a);'}">
                  ${window.Icon('heart', 18)} <span>Productos favoritos</span>
                </button>

                <div style="border-top: 1px solid var(--border, #e2e8f0); margin-top: 10px; padding-top: 10px;">
                  <button type="button" data-action="logout" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; background: #fef2f2; color: #dc2626;">
                    ${window.Icon('logout', 18)} <span>Cerrar sesión</span>
                  </button>
                </div>
              </nav>
            </aside>

            <main>
              ${activeTab === 'personal-data' ? this.renderPersonalData(user, firstName, lastName, isEditing) : ''}
              ${activeTab === 'purchases' ? (activePurchaseId ? this.renderPurchaseDetail(purchases.find(p => p.id === activePurchaseId) || purchases[0]) : this.renderPurchasesList(purchases, expirationMonths)) : ''}
              ${activeTab === 'shipments' ? this.renderShipmentStatus(activeShipment) : ''}
              ${activeTab === 'fav-stores' ? this.renderFavoriteStores(favoriteStores) : ''}
              ${activeTab === 'fav-products' ? this.renderFavoriteProducts(favoriteProducts) : ''}
            </main>

          </div>
        </div>
      `;
    },

    renderPersonalData(user, firstName, lastName, isEditing) {
      const countryOptions = LATAM_COUNTRIES.map(c => 
        `<option value="${c.name}" ${user.phoneCountry === c.name ? 'selected' : ''}>${c.name}</option>`
      ).join('');

      const typeOptions = ['WhatsApp', 'Celular', 'Fijo'].map(t =>
        `<option value="${t}" ${user.phoneType === t ? 'selected' : ''}>${t}</option>`
      ).join('');

      const deptKeys = Object.keys(sanJuanDepartments);
      const currentDept = user.department || 'Capital';
      const deptOptions = deptKeys.map(d =>
        `<option value="${d}" ${currentDept === d ? 'selected' : ''}>${d}</option>`
      ).join('');

      const localities = sanJuanDepartments[currentDept] || ['San Juan'];
      const currentLocality = user.locality || localities[0];
      const localityOptions = localities.map(l =>
        `<option value="${l}" ${currentLocality === l ? 'selected' : ''}>${l}</option>`
      ).join('');

      const disabledAttr = isEditing ? '' : 'disabled';
      const bgStyle = isEditing ? 'background: #fff;' : 'background: #f8fafc; color: #475569; cursor: not-allowed;';

      return `
        <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border, #e2e8f0);">
            <h2 style="font-size: 18px; font-weight: 800; color: var(--text, #0f172a); margin: 0;">
              Datos Personales y Domicilio de Envío
            </h2>
            <span style="font-size: 12px; color: var(--muted, #64748b);">${isEditing ? 'Modo edición activo' : 'Modo lectura'}</span>
          </div>

          <form onsubmit="event.preventDefault(); window.Actions['save-user-profile'](this);" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            
            <!-- Datos Personales -->
            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Nombre</label>
              <input type="text" id="profile-firstname" value="${esc(firstName)}" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}" required />
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Apellido</label>
              <input type="text" id="profile-lastname" value="${esc(lastName)}" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}" required />
            </div>

            <div style="grid-column: 1 / -1;">
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Correo Electrónico (No modificable)</label>
              <input type="email" id="profile-email" value="${esc(user.email)}" disabled style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; background: #f1f5f9; color: #64748b; cursor: not-allowed;" />
            </div>

            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">País (Característica)</label>
              <select id="profile-phone-country" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}">
                ${countryOptions}
              </select>
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Tipo de Teléfono</label>
              <select id="profile-phone-type" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}">
                ${typeOptions}
              </select>
            </div>

            <div style="grid-column: 1 / -1;">
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Número de Teléfono (sin 0 ni 15, ej: 2645123456)</label>
              <input type="tel" id="profile-phone-number" value="${esc(user.phoneNumber || '')}" placeholder="2645123456" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}" />
            </div>

            <!-- SECCIÓN DOMICILIO DETALLADO PARA EL CADETE -->
            <div style="grid-column: 1 / -1; margin-top: 8px; padding-top: 14px; border-top: 1px dashed #e2e8f0;">
              <h3 style="font-size: 14px; font-weight: 800; color: var(--text, #0f172a); margin: 0 0 12px 0;">Domicilio de Entrega para el Repartidor / Cadete</h3>
            </div>

            <div style="grid-column: 1 / span 1;">
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Calle / Avenida</label>
              <input type="text" id="profile-street" value="${esc(user.street || '')}" placeholder="Ej: Av. Libertador Gral. San Martín" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}" />
            </div>

            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Altura / Número</label>
              <input type="text" id="profile-number" value="${esc(user.number || '')}" placeholder="Ej: 1200 Oeste" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}" />
            </div>

            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Barrio / Villa / Loteo</label>
              <input type="text" id="profile-neighborhood" value="${esc(user.neighborhood || '')}" placeholder="Ej: B° Copacabana / Villa Del Carril" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}" />
            </div>

            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Casa / Manzana / Depto (Opcional)</label>
              <input type="text" id="profile-house-block" value="${esc(user.houseBlock || '')}" placeholder="Ej: Casa 3, Manzana B, Depto 2B" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}" />
            </div>

            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Departamento (San Juan)</label>
              <select id="profile-department" onchange="window.Actions['change-profile-department'](this.value)" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}">
                ${deptOptions}
              </select>
            </div>

            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Localidad / Villa / Zona</label>
              <select id="profile-locality" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}">
                ${localityOptions}
              </select>
            </div>

            <div style="grid-column: 1 / -1;">
              <label style="display:block; font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Referencias adicionales para el cadete</label>
              <input type="text" id="profile-references" value="${esc(user.references || '')}" placeholder="Ej: Portón negro, timbre rojo, entre calles Gral. Acha y Tucumán" ${disabledAttr} style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; ${bgStyle}" />
            </div>

            <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
              ${isEditing ? `
                <button type="button" data-action="toggle-profile-edit" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer;">Cancelar</button>
                <button type="submit" style="background: var(--primary, #fd6910); color: white; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 800; cursor: pointer;">Guardar Cambios</button>
              ` : `
                <button type="button" data-action="toggle-profile-edit" style="background: #09305f; color: white; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 800; cursor: pointer;">Editar</button>
              `}
            </div>
          </form>
        </div>
      `;
    },

    renderPurchasesList(purchases, expirationMonths) {
      const rows = purchases.map(p => `
        <div style="border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; background: #fff; gap: 12px; flex-wrap: wrap;">
          <div>
            <div style="font-weight: 800; font-size: 14px; color: var(--text, #0f172a);">${p.id} — ${esc(p.store)}</div>
            <div style="font-size: 12px; color: var(--muted, #64748b); margin-top: 2px;">Fecha de compra: ${p.date} · Expira el: ${p.expiresOn || '12/10/2027'}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="font-weight: 800; font-size: 15px; color: var(--primary, #fd6910);">${money(p.total)}</div>
            <button type="button" data-action="view-purchase-detail" data-id="${p.id}" style="background: #09305f; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;">Ver Ticket ›</button>
          </div>
        </div>
      `).join('');

      return `
        <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border, #e2e8f0); flex-wrap: wrap; gap: 12px;">
            <div>
              <h2 style="font-size: 18px; font-weight: 800; color: var(--text, #0f172a); margin: 0;">Mis Compras (Historial)</h2>
              <p style="font-size: 12px; color: var(--muted, #64748b); margin: 2px 0 0 0;">Historial detallado de tickets y comprobantes en CompraLocal San Juan.</p>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
              <label for="purchase-expiration-select" style="font-size: 12px; font-weight: 700; color: #64748b;">Retención:</label>
              <select id="purchase-expiration-select" data-action="change-expiration" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; background: #fff; font-weight: 600;">
                <option value="3" ${expirationMonths === '3' ? 'selected' : ''}>3 meses</option>
                <option value="6" ${expirationMonths === '6' ? 'selected' : ''}>6 meses</option>
                <option value="12" ${expirationMonths === '12' ? 'selected' : ''}>1 año</option>
                <option value="24" ${expirationMonths === '24' ? 'selected' : ''}>2 años</option>
                <option value="unlimited" ${expirationMonths === 'unlimited' ? 'selected' : ''}>Sin expiración</option>
              </select>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${rows.length ? rows : '<p style="color: var(--muted); font-size: 13px; text-align: center; padding: 20px;">No hay compras registradas en este período.</p>'}
          </div>
        </div>
      `;
    },

    renderPurchaseDetail(purchase) {
      const itemsList = purchase.items.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px;">
          <div>
            <span style="font-weight: 700; color: var(--text);">${esc(item.name)}</span>
            <span style="color: var(--muted); font-size: 12px; display: block;">Cantidad: ${item.qty}</span>
          </div>
          <span style="font-weight: 700; color: var(--text);">${money(item.price * item.qty)}</span>
        </div>
      `).join('');

      return `
        <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border, #e2e8f0);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <button type="button" data-action="back-to-purchases-history" style="background: none; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-weight: 700; font-size: 12px; cursor: pointer; color: var(--text);">‹ Volver</button>
              <h2 style="font-size: 18px; font-weight: 800; color: var(--text, #0f172a); margin: 0;">Detalle del Ticket #${purchase.id}</h2>
            </div>
            <span style="background: #22c55e; color: #fff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 6px;">${esc(purchase.status)}</span>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
              <div>
                <span style="color: var(--muted); display: block; font-size: 11px; font-weight: 700;">COMERCIO VENDEDOR</span>
                <strong style="font-size: 15px; color: var(--text);">${esc(purchase.store)}</strong>
              </div>
              <div>
                <span style="color: var(--muted); display: block; font-size: 11px; font-weight: 700;">FECHA DE EMISIÓN</span>
                <strong style="color: var(--text);">${purchase.date}</strong>
              </div>
              <div>
                <span style="color: var(--muted); display: block; font-size: 11px; font-weight: 700;">EXPIRACIÓN DEL TICKET</span>
                <strong style="color: var(--text);">${purchase.expiresOn}</strong>
              </div>
            </div>

            <div>
              <span style="color: var(--muted); display: block; font-size: 11px; font-weight: 700; margin-bottom: 8px;">PRODUCTOS ADQUIRIDOS</span>
              ${itemsList}
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              <div style="display: flex; justify-content: space-between; color: var(--muted);">
                <span>Subtotal productos:</span>
                <span>${money(purchase.subtotal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: var(--muted);">
                <span>Costo de envío local:</span>
                <span>${money(purchase.shippingCost)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 16px; color: var(--primary, #fd6910); margin-top: 4px;">
                <span>Total abonado:</span>
                <span>${money(purchase.total)}</span>
              </div>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px;">
              <div><strong>Método de pago:</strong> ${esc(purchase.paymentMethod)}</div>
              <div><strong>Dirección de entrega:</strong> ${esc(purchase.shippingAddress)}</div>
            </div>
          </div>
        </div>
      `;
    },

    renderShipmentStatus(shipment) {
      const steps = [
        { label: 'Procesando compra', desc: 'Pago acreditado y tienda preparando el pedido' },
        { label: 'Entregado al repartidor', desc: 'Paquete retirado por el cadete' },
        { label: 'Envío en camino', desc: 'En viaje hacia tu domicilio en San Juan' },
        { label: 'Entregado', desc: 'Recibido conforme en destino' }
      ];

      const current = shipment.currentStep || 3;

      const timelineHtml = steps.map((s, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        
        let circleBg = '#e2e8f0';
        let circleColor = '#64748b';
        let borderColor = '#cbd5e1';
        let fontWeight = '600';

        if (isCompleted) {
          circleBg = '#22c55e';
          circleColor = '#fff';
          borderColor = '#22c55e';
        } else if (isCurrent) {
          circleBg = 'var(--primary, #fd6910)';
          circleColor = '#fff';
          borderColor = 'var(--primary, #fd6910)';
          fontWeight = '800';
        }

        const isLast = idx === steps.length - 1;

        return `
          <div style="display: flex; align-items: flex-start; gap: 14px; position: relative; ${!isLast ? 'padding-bottom: 24px;' : ''}">
            ${!isLast ? `<div style="position: absolute; left: 15px; top: 32px; bottom: 0; width: 2px; background: ${stepNum < current ? '#22c55e' : '#e2e8f0'};"></div>` : ''}
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${circleBg}; color: ${circleColor}; border: 2px solid ${borderColor}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0; z-index: 1; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
              ${isCompleted ? '✓' : stepNum}
            </div>
            <div>
              <div style="font-size: 14px; font-weight: ${fontWeight}; color: ${isCurrent ? 'var(--primary, #fd6910)' : 'var(--text, #0f172a)'};">${s.label}</div>
              <div style="font-size: 12px; color: var(--muted, #64748b); margin-top: 2px;">${isCurrent ? shipment.shippingStatusDesc : s.desc}</div>
            </div>
          </div>
        `;
      }).join('');

      const logsHtml = shipment.trackingLogs.map(log => `
        <div style="display: flex; gap: 12px; font-size: 12px; padding: 6px 0; border-bottom: 1px dashed #f1f5f9;">
          <span style="color: var(--muted); font-weight: 700; min-width: 110px;">${log.time}</span>
          <span style="color: var(--text);">${esc(log.desc)}</span>
        </div>
      `).join('');

      return `
        <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <div style="margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border, #e2e8f0);">
            <h2 style="font-size: 18px; font-weight: 800; color: var(--text, #0f172a); margin: 0;">Estado de Envíos y Trazabilidad</h2>
            <p style="font-size: 12px; color: var(--muted, #64748b); margin: 2px 0 0 0;">Seguimiento en tiempo real de tus envíos locales en San Juan.</p>
          </div>

          <div style="border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 20px; background: #fff; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
              <div>
                <div style="font-weight: 800; font-size: 15px; color: var(--text);">Pedido #${shipment.id} — ${esc(shipment.store)}</div>
                <div style="font-size: 12px; color: var(--muted, #64748b); margin-top: 2px;">Producto: ${esc(shipment.product)}</div>
              </div>
              <div style="font-weight: 800; font-size: 16px; color: var(--primary, #fd6910);">${money(shipment.price)}</div>
            </div>

            <div style="padding: 10px 0 20px 10px;">
              ${timelineHtml}
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 10px;">
              <div style="font-size: 12px; font-weight: 800; color: var(--text); margin-bottom: 8px; text-transform: uppercase;">Historial de seguimiento</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${logsHtml}
              </div>
            </div>

            <div style="margin-top: 14px; font-size: 12px; color: var(--muted); display: flex; gap: 6px; align-items: center;">
              <strong>Dirección de destino:</strong> ${esc(shipment.address)} (${esc(shipment.addressDetails)})
            </div>
          </div>
        </div>
      `;
    },

    renderFavoriteStores(stores) {
      const cards = stores.map(s => `
        <div style="background: #fff; border: 1px solid var(--border, #cbd5e1); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.04); display: flex; flex-direction: column;">
          <div style="position: relative; height: 160px; width: 100%; background: #f1f5f9; cursor: pointer;" data-action="open-store" data-id="${esc(s.id)}">
            <img src="${esc(s.image || s.logo)}" alt="${esc(s.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="padding: 16px; display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
            <div>
              <span style="font-size: 10px; font-weight: 800; color: var(--primary, #fd6910); text-transform: uppercase;">${esc(s.category || 'Comercio local')}</span>
              <h3 style="font-size: 16px; font-weight: 800; color: var(--text, #0f172a); margin: 4px 0 8px 0; cursor: pointer;" data-action="open-store" data-id="${esc(s.id)}">${esc(s.name)}</h3>
              <div style="font-size: 12px; color: var(--muted, #64748b);">${esc(s.location || 'Capital, San Juan')}</div>
            </div>
            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border, #f1f5f9); display: flex; justify-content: flex-end;">
              <button type="button" data-action="open-store" data-id="${esc(s.id)}" style="background: none; border: none; color: var(--primary, #fd6910); font-weight: 800; font-size: 13px; cursor: pointer;">Ver tienda</button>
            </div>
          </div>
        </div>
      `).join('');

      return `
        <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <div style="margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border, #e2e8f0);">
            <h2 style="font-size: 18px; font-weight: 800; color: var(--text, #0f172a); margin: 0;">Mis Tiendas Favoritas</h2>
            <p style="font-size: 12px; color: var(--muted, #64748b); margin: 4px 0 0 0;">Acceso rápido a tus comercios preferidos en CompraLocal.</p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
            ${cards}
          </div>
        </div>
      `;
    },

    renderFavoriteProducts(products) {
      const items = products.map(p => `
        <div data-action="open-product" data-id="${esc(p.id)}" style="border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 12px; cursor: pointer; background: #fff;">
          <img src="${esc(p.image)}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
          <div style="font-weight: 700; font-size: 13px;">${esc(p.name)}</div>
          <div style="font-weight: 800; font-size: 14px; color: var(--primary, #fd6910); margin-top: 4px;">${money(p.price)}</div>
        </div>
      `).join('');

      return `
        <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--text, #0f172a); margin: 0 0 18px 0; padding-bottom: 10px; border-bottom: 1px solid var(--border, #e2e8f0);">Productos Guardados</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">
            ${items}
          </div>
        </div>
      `;
    }
  };

  window.Actions = window.Actions || {};
  
  window.Actions['set-profile-tab'] = (el) => {
    const tab = el.dataset.tab;
    window.Store.set({ profileTab: tab, activePurchaseId: null });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['upload-avatar'] = (input) => {
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const currentUser = window.Store.state.user || {};
        window.Store.set({ user: { ...currentUser, avatar: e.target.result } });
        if (window.App && typeof window.App.render === 'function') window.App.render();
      };
      reader.readAsDataURL(input.files[0]);
    }
  };

  window.Actions['select-default-avatar'] = (url) => {
    const currentUser = window.Store.state.user || {};
    window.Store.set({ user: { ...currentUser, avatar: url } });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['toggle-profile-edit'] = () => {
    const current = !!window.Store.state.profileEditing;
    window.Store.set({ profileEditing: !current, profileToast: null });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['close-profile-toast'] = () => {
    window.Store.set({ profileToast: null });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['view-purchase-detail'] = (el) => {
    const pId = el.dataset.id;
    window.Store.set({ activePurchaseId: pId });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['back-to-purchases-history'] = () => {
    window.Store.set({ activePurchaseId: null });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['change-expiration'] = (el) => {
    const val = el.value;
    window.Store.set({ purchaseExpirationMonths: val, profileToast: `Tiempo de retención del historial actualizado a: ${el.options[el.selectedIndex].text}` });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['change-profile-department'] = (deptValue) => {
    const currentUser = window.Store.state.user || {};
    const localities = sanJuanDepartments[deptValue] || ['San Juan'];
    window.Store.set({
      user: {
        ...currentUser,
        department: deptValue,
        locality: localities[0]
      }
    });
    if (window.App && typeof window.App.render === 'function') {
      window.App.render();
    }
  };

  window.Actions['save-user-profile'] = (formEl) => {
    const fName = document.getElementById('profile-firstname').value.trim();
    const lName = document.getElementById('profile-lastname').value.trim();
    const phoneCountry = document.getElementById('profile-phone-country').value;
    const phoneType = document.getElementById('profile-phone-type').value;
    const phoneNumber = document.getElementById('profile-phone-number').value.trim();
    
    // Nuevos campos de domicilio detallado
    const street = document.getElementById('profile-street').value.trim();
    const number = document.getElementById('profile-number').value.trim();
    const neighborhood = document.getElementById('profile-neighborhood').value.trim();
    const houseBlock = document.getElementById('profile-house-block').value.trim();
    const department = document.getElementById('profile-department').value;
    const locality = document.getElementById('profile-locality').value;
    const references = document.getElementById('profile-references').value.trim();

    const currentUser = window.Store.state.user || {};
    const fullName = `${fName} ${lName}`.trim();
    const fullAddressString = `${street} ${number}${neighborhood ? ', ' + neighborhood : ''}${locality ? ', ' + locality : ''}${department ? ', ' + department : ''}, San Juan`;

    window.Store.set({
      user: {
        ...currentUser,
        firstName: fName,
        lastName: lName,
        name: fullName,
        phoneCountry,
        phoneType,
        phoneNumber,
        street,
        number,
        neighborhood,
        houseBlock,
        department,
        locality,
        references,
        address: fullAddressString
      },
      profileEditing: false, 
      profileToast: '¡Domicilio y datos de perfil actualizados correctamente!' 
    });

    if (window.App && typeof window.App.render === 'function') {
      window.App.render();
    }
  };
})();