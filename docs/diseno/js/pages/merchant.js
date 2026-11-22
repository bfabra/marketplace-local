/* ============================================================
   COMPRALOCAL — PANEL DE ADMINISTRACIÓN / PERFIL COMERCIANTE
   ============================================================ */
(function () {
  const { esc, money } = window.Utils || { esc: (s) => s || '', money: (n) => `$${n}` };

  const storeCategories = {
    "Alimentos y bebidas": {
      subcategories: [
        "Almacén", "Bebidas", "Carnes y embutidos", "Fiambrería", "Frutas y verduras",
        "Panadería y pastelería", "Congelados", "Lácteos y huevos", "Conservas y enlatados",
        "Pastas y harinas", "Aceites y condimentos", "Snacks y golosinas", "Productos saludables",
        "Dietética", "Productos regionales"
      ],
      attributes: ["Tipo de producto", "Presentación", "Peso", "Volumen", "Unidad de venta", "Sabor", "Variedad", "Ingredientes", "Información nutricional", "Alérgenos", "Origen", "Fecha de vencimiento", "Condiciones de conservación"]
    },
    "Indumentaria y calzado": {
      subcategories: [
        "Ropa de mujer", "Ropa de hombre", "Ropa unisex", "Ropa infantil", "Ropa deportiva", "Calzado",
        "Calzado infantil", "Calzado de Temporada", "Calzado de Mujer", "Calzado de Hombre",
        "Lencería", "Ropa interior", "Abrigos", "Accesorios", "Carteras y bolsos",
        "Valijas y mochilas", "Uniformes y ropa de trabajo"
      ],
      attributes: ["Género", "Talle", "Color", "Material", "Composición", "Estilo", "Temporada", "Modelo", "Corte", "Tipo de prenda", "Estampado", "Edad recomendada", "País de fabricación"]
    },
    "Hogar y decoración": {
      subcategories: ["Muebles", "Decoración", "Iluminación", "Cocina", "Baño", "Dormitorio", "Living", "Textiles", "Cortinas", "Organización", "Limpieza", "Accesorios para el hogar"],
      attributes: ["Material", "Color", "Dimensiones", "Peso", "Estilo", "Ambiente", "Forma", "Capacidad", "Tipo de producto", "Requiere armado", "Incluye accesorios", "País de fabricación"]
    },
    "Tecnología y electrónica": {
      subcategories: ["Celulares", "Tablets", "Computadoras", "Notebooks", "Monitores", "Accesorios para celulares", "Accesorios para computación", "Audio", "TV y video", "Gaming", "Componentes", "Redes y conectividad", "Seguridad electrónica", "Electrónica general"],
      attributes: ["Garantía", "Compatibilidad", "Conectividad", "Sistema operativo", "Alimentación"]
    },
    "Electrodomésticos": {
      subcategories: ["Heladeras y freezers", "Cocinas y hornos", "Microondas", "Lavarropas", "Secarropas", "Aspiradoras", "Pequeños electrodomésticos", "Climatización", "Ventilación", "Calefacción", "Electrodomésticos de cocina"],
      attributes: ["Capacidad", "Potencia", "Consumo energético", "Dimensiones", "Peso", "Garantía", "Funciones", "Eficiencia energética", "Voltaje"]
    },
    "Ferretería, construcción y herramientas": {
      subcategories: ["Herramientas manuales", "Herramientas eléctricas", "Ferretería general", "Electricidad", "Plomería", "Pinturas", "Materiales de construcción", "Cerámicos y revestimientos", "Sanitarios", "Iluminación", "Seguridad", "Tornillería y fijaciones", "Maquinaria"],
      attributes: ["Medidas", "Peso", "Uso", "Aplicación", "Compatibilidad", "Garantía"]
    },
    "Automotor y motocicletas": {
      subcategories: ["Repuestos", "Accesorios", "Neumáticos", "Lubricantes", "Baterías", "Herramientas", "Audio y multimedia", "Iluminación", "Limpieza y cuidado", "Equipamiento para motos", "Indumentaria para motociclistas"],
      attributes: ["Vehículo compatible", "Año", "Motor", "Código/OEM", "Material", "Dimensiones", "Garantía"]
    },
    "Salud, belleza y cuidado personal": {
      subcategories: ["Perfumería", "Cosmética", "Maquillaje", "Cuidado facial", "Cuidado capilar", "Higiene personal", "Manicuría y pedicuría", "Productos para barbería", "Productos para peluquería", "Óptica", "Equipamiento y accesorios"],
      attributes: ["Presentación", "Contenido", "Fragancia", "Tipo de piel", "Tipo de cabello", "Ingredientes", "Uso", "Edad recomendada", "Características especiales"]
    },
    "Deportes y aire libre": {
      subcategories: ["Indumentaria deportiva", "Calzado deportivo", "Fitness y musculación", "Fútbol", "Ciclismo", "Running", "Camping", "Pesca", "Montañismo", "Deportes acuáticos", "Accesorios deportivos", "Juegos y recreación"],
      attributes: ["Disciplina", "Género", "Talle", "Material", "Color", "Tamaño", "Peso", "Nivel de uso", "Edad recomendada"]
    },
    "Mascotas y animales": {
      subcategories: ["Alimentos para perros", "Alimentos para gatos", "Alimentos para otros animales", "Accesorios", "Juguetes", "Higiene", "Camas y transporte", "Acuarios", "Productos veterinarios"],
      attributes: ["Especie", "Edad", "Tamaño de mascota", "Peso", "Sabor", "Presentación", "Ingredientes", "Material", "Color", "Uso"]
    },
    "Librería, papelería y oficina": {
      subcategories: ["Librería", "Papelería", "Útiles escolares", "Oficina", "Impresión y encuadernación", "Arte y dibujo", "Manualidades", "Libros", "Agendas y planners"],
      attributes: ["Material", "Color", "Tamaño", "Formato", "Cantidad", "Tema", "Uso", "Edad recomendada"]
    },
    "Juguetes, bebés y niños": {
      subcategories: ["Juguetes", "Juegos de mesa", "Juguetes educativos", "Bebés", "Primera infancia", "Ropa infantil", "Accesorios para bebés", "Muebles infantiles", "Seguridad infantil"],
      attributes: ["Edad recomendada", "Género", "Material", "Color", "Tamaño", "Peso", "Personaje", "Función", "Requiere baterías", "Incluye baterías", "Advertencias de seguridad"]
    },
    "Regalos, artesanías y personalizados": {
      subcategories: ["Regalos", "Artesanías", "Productos personalizados", "Souvenirs", "Decoración artesanal", "Papelería personalizada", "Regalos empresariales", "Eventos y souvenirs"],
      attributes: ["Diseño", "Personalizable", "Texto personalizado", "Imagen personalizada", "Tiempo de producción", "Ocasión", "Tema", "Presentación"]
    },
    "Jardinería, viveros y agricultura": {
      subcategories: ["Plantas", "Flores", "Semillas", "Macetas", "Jardinería", "Herramientas de jardín", "Riego", "Fertilizantes y sustratos", "Productos agrícolas", "Insumos para cultivos", "Viveros"],
      attributes: ["Especie", "Variedad", "Tamaño", "Presentación", "Material", "Uso", "Época de plantación", "Exposición solar", "Frecuencia de riego", "Resistencia", "Origen"]
    },
    "Productos regionales y producción local": {
      subcategories: ["Vinos", "Aceites de oliva", "Aceitunas", "Frutos secos", "Dulces y conservas", "Alimentos regionales", "Artesanías regionales", "Productos elaborados localmente", "Otros productos regionales"],
      attributes: ["Productor/marca", "Región de origen", "Localidad", "Elaboración artesanal/industrial", "Ingredientes", "Presentación", "Peso", "Volumen", "Variedad", "Fecha de elaboración", "Vencimiento", "Certificaciones", "Características regionales"]
    },
    "Música, fiestas y recreación": {
      subcategories: ["Instrumentos musicales", "Accesorios musicales", "Arte", "Pintura", "Fotografía", "Coleccionismo", "Música", "Entretenimiento", "Disfraces y cotillón"],
      attributes: ["Artista/marca", "Material", "Técnica", "Dimensiones", "Peso", "Año", "Estilo", "Tema", "Edición", "Original/reproducción"]
    },
    "Turismo y actividades": {
      subcategories: ["Equipamiento para turismo", "Camping y aventura", "Productos para viajeros", "Souvenirs", "Experiencias", "Actividades recreativas"],
      attributes: ["Tipo de experiencia", "Ubicación", "Localidad", "Duración", "Capacidad", "Edad mínima", "Edad máxima", "Fecha", "Horario", "Temporada", "Incluye", "No incluye", "Requisitos", "Punto de encuentro", "Idioma", "Nivel de dificultad", "Política de cancelación"]
    },
    "Alquileres": {
      isRental: true,
      subcategories: {
        "Inmuebles": ["Casas", "Departamentos", "Locales comerciales", "Oficinas", "Salones para eventos", "Quintas y fincas", "Galpones y depósitos", "Cocheras", "Espacios para reuniones"],
        "Vehículos": ["Autos", "Camionetas", "Utilitarios", "Motos", "Bicicletas", "Camiones", "Trailers", "Remolques", "Vehículos para eventos"],
        "Herramientas y maquinaria": ["Herramientas manuales", "Herramientas eléctricas", "Herramientas a batería", "Herramientas de construcción", "Maquinaria de construcción", "Equipos de jardinería", "Generadores", "Compresores", "Andamios", "Escaleras", "Equipos para obras", "Equipos industriales"]
      },
      rentalAttributes: ["Modalidad de alquiler", "Unidad de cobro (Hora/Día/Semana/Mes/Evento)", "Duración mínima", "Duración máxima", "Depósito / Garantía ($)"]
    }
  };

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

  const countries = [
    'Argentina (+54)', 'Bolivia (+591)', 'Brasil (+55)', 'Chile (+56)',
    'Colombia (+57)', 'Costa Rica (+506)', 'Cuba (+53)', 'Ecuador (+593)',
    'El Salvador (+503)', 'Guatemala (+502)', 'Honduras (+504)', 'México (+52)',
    'Nicaragua (+505)', 'Panamá (+507)', 'Paraguay (+595)', 'Perú (+51)',
    'Uruguay (+598)', 'Venezuela (+58)'
  ];

  const phoneTypes = ['WhatsApp', 'Celular', 'Fijo'];

  const getPhonePrefix = (country, type) => {
    if (country && country.includes('+54')) {
      return type === 'Fijo' ? '+54' : '+54 9';
    }
    const match = country ? country.match(/\(([^)]+)\)/) : null;
    return match ? match[1] : '+54';
  };

  let storeModalDraft = {
    id: '',
    name: '',
    cuit: '',
    phones: [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '' }],
    rubro: '',
    subrubro: '',
    description: '',
    province: 'San Juan',
    department: 'Capital',
    locality: '',
    address: '',
    logo: ''
  };

  let productPhotosList = [];

  const checkAndExpirePlan = () => {
    const s = window.Store.state;
    if (s.merchantPlan && s.merchantPlan !== 'free' && s.merchantPlanExpiresAt) {
      const now = new Date().getTime();
      if (now > s.merchantPlanExpiresAt) {
        s.merchantPlan = 'free';
        s.merchantPlanExpiresAt = null;
        if (s.merchantStores && s.merchantStores.length > 1) {
          s.merchantStores = [s.merchantStores[0]];
          s.activeStoreId = s.merchantStores[0].id;
        }
        showToast('Tu plan pago ha expirado (31 días). Se ha aplicado el Plan Gratuito y conservado 1 tienda.', 'warning');
      }
    }
  };

  const getMerchantProfile = () => {
    const s = window.Store.state;
    checkAndExpirePlan();
    if (!s.merchantProfile) {
      s.merchantProfile = {
        firstName: 'Carlos',
        lastName: 'Mendoza',
        cuit: '20-32114455-8',
        personalAddress: 'Av. Libertador 2100 Oeste, San Juan',
        personalPhone: '+54 9 264 5891234'
      };
    }
    if (!s.user) s.user = {};
    s.user.firstName = s.merchantProfile.firstName;
    s.user.lastName = s.merchantProfile.lastName;
    s.user.name = `${s.merchantProfile.firstName} ${s.merchantProfile.lastName}`;
    return s.merchantProfile;
  };

  const getMerchantStores = () => {
    const s = window.Store.state;
    if (!s.merchantPlan) {
      s.merchantPlan = 'standard';
      s.merchantPlanExpiresAt = new Date().getTime() + (31 * 24 * 60 * 60 * 1000);
    }

    if (!s.merchantStores || s.merchantStores.length === 0) {
      s.merchantStores = [
        {
          id: 'store-1',
          name: 'Ferretería y Construcción San Juan',
          rubro: 'Ferretería, construcción y herramientas',
          subrubro: 'Herramientas eléctricas',
          description: 'Todo para la construcción, refacción y herramientas profesionales en San Juan.',
          address: 'Av. Rioja 450 Sur',
          department: 'Capital',
          locality: 'San Juan',
          cuit: '20-32114455-8',
          registrationYear: 2026,
          phones: [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '2644123456' }],
          socials: { instagram: '@ferreteriasj', facebook: 'ferreteria.sanjuan', web: 'www.ferreteriasanjuan.com' },
          logo: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=200&auto=format&fit=crop&q=60'
        },
        {
          id: 'store-2',
          name: 'Mueblería y Diseño Cuyo',
          rubro: 'Hogar y decoración',
          subrubro: 'Muebles',
          description: 'Fabricación y venta de muebles de diseño para el hogar y oficina.',
          address: 'Calle Mitre 890 Este',
          department: 'Santa Lucía',
          locality: 'Santa Lucía',
          cuit: '20-32114455-8',
          registrationYear: 2026,
          phones: [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '2644789123' }],
          socials: { instagram: '@muebleriacuyo', facebook: 'muebleria.cuyo', web: 'www.muebleriacuyo.com' },
          logo: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&auto=format&fit=crop&q=60'
        }
      ];
      s.activeStoreId = 'store-1';
    }
    return s.merchantStores;
  };

  const getActiveStore = () => {
    const stores = getMerchantStores();
    const activeId = window.Store.state.activeStoreId || stores[0].id;
    return stores.find(st => st.id === activeId) || stores[0];
  };

  const ensureDefaultProducts = () => {
    window.Data = window.Data || {};
    if (!window.Data.products || window.Data.products.length === 0) {
      window.Data.products = [
        { id: 'p1', storeId: 'store-1', name: 'Taladro Percutor Profesional 650W', price: 45000, brand: 'Bosch', category: 'Ferretería, construcción y herramientas', subcategory: 'Herramientas eléctricas', stock: 12, sku: 'TAL-001', condition: 'Nuevo', description: 'Taladro percutor de alta potencia con velocidad variable.', photos: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?w=200&auto=format&fit=crop&q=60'] },
        { id: 'p2', storeId: 'store-1', name: 'Amoladora Angular 4 1/2"', price: 38900, brand: 'Makita', category: 'Ferretería, construcción y herramientas', subcategory: 'Herramientas eléctricas', stock: 8, sku: 'AMO-002', condition: 'Nuevo', description: 'Amoladora compacta de excelente rendimiento.', photos: ['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=200&auto=format&fit=crop&q=60'] },
        { id: 'p3', storeId: 'store-1', name: 'Juego de Llaves Combinadas x 12', price: 22500, brand: 'Crossmaster', category: 'Ferretería, construcción y herramientas', subcategory: 'Herramientas manuales', stock: 15, sku: 'LCA-003', condition: 'Nuevo', description: 'Llaves de acero cromo vanadio en soporte organizador.', photos: ['https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=200&auto=format&fit=crop&q=60'] },
        { id: 'p4', storeId: 'store-1', name: 'Pintura Látex Interior Blanca 20L', price: 54000, brand: 'Sherwin', category: 'Ferretería, construcción y herramientas', subcategory: 'Pinturas', stock: 10, sku: 'PIN-004', condition: 'Nuevo', description: 'Pintura lavable de alto poder cubritivo.', photos: ['https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=200&auto=format&fit=crop&q=60'] },
        { id: 'p5', storeId: 'store-1', name: 'Juego de Destornilladores Aislados x 6', price: 14200, brand: 'Bahco', category: 'Ferretería, construcción y herramientas', subcategory: 'Herramientas manuales', stock: 20, sku: 'DES-005', condition: 'Nuevo', description: 'Destornilladores certificados para electricistas.', photos: ['https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=200&auto=format&fit=crop&q=60'] },

        { id: 'p6', storeId: 'store-2', name: 'Mesa de Comedor Estilo Industrial 1.60m', price: 125000, brand: 'CuyoDeco', category: 'Hogar y decoración', subcategory: 'Muebles', stock: 5, sku: 'MES-101', condition: 'Nuevo', description: 'Tapa de madera maciza paraíso y estructura de hierro.', photos: ['https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=200&auto=format&fit=crop&q=60'] },
        { id: 'p7', storeId: 'store-2', name: 'Silla Eames Ergonómica Tapizada', price: 29900, brand: 'DesignStudio', category: 'Hogar y decoración', subcategory: 'Muebles', stock: 18, sku: 'SIL-102', condition: 'Nuevo', description: 'Silla moderna ideal para comedor o escritorio.', photos: ['https://images.unsplash.com/photo-1580481077494-e3299ac25e94?w=200&auto=format&fit=crop&q=60'] },
        { id: 'p8', storeId: 'store-2', name: 'Sillón 3 Cuerpos Chenille Gris', price: 185000, brand: 'ComfortHome', category: 'Hogar y decoración', subcategory: 'Living', stock: 3, sku: 'SIL-103', condition: 'Nuevo', description: 'Sillón esquinero tapizado en tela chenille anti-manchas.', photos: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&auto=format&fit=crop&q=60'] },
        { id: 'p9', storeId: 'store-2', name: 'Rack de TV Minimalista Melamina', price: 68000, brand: 'MueblesSanJuan', category: 'Hogar y decoración', subcategory: 'Muebles', stock: 7, sku: 'RAC-104', condition: 'Nuevo', description: 'Mueble para TV con espacio de almacenamiento y pasacables.', photos: ['https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=200&auto=format&fit=crop&q=60'] },
        { id: 'p10', storeId: 'store-2', name: 'Respaldo de Cama Sommier 2 Plazas', price: 45000, brand: 'CuyoDeco', category: 'Hogar y decoración', subcategory: 'Dormitorio', stock: 6, sku: 'RES-105', condition: 'Nuevo', description: 'Respaldo flotante con detalles en madera natural.', photos: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=200&auto=format&fit=crop&q=60'] }
      ];
    }
  };

  const getMerchantOrders = (storeId) => {
    const s = window.Store.state;
    if (!s.merchantOrdersMap) s.merchantOrdersMap = {};
    if (!s.merchantOrdersMap[storeId]) {
      s.merchantOrdersMap[storeId] = [
        {
          id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          date: '20/10/2026',
          time: '10:45 hs',
          customerName: storeId === 'store-1' ? 'Mariana Gómez' : 'Esteban Carrizo',
          customerPhone: '+54 9 264 5123984',
          paymentMethod: 'Mercado Pago / Transferencia',
          deliveryType: 'Envío a domicilio',
          address: 'Calle Mendoza 1420 Sur, San Juan',
          status: 'Por preparar',
          total: storeId === 'store-1' ? 45900 : 125000,
          items: [{ name: storeId === 'store-1' ? 'Taladro Percutor Profesional 650W' : 'Mesa de Comedor Estilo Industrial', qty: 1, price: storeId === 'store-1' ? 45900 : 125000 }]
        }
      ];
    }
    return s.merchantOrdersMap[storeId];
  };

  const getMerchantSalesHistory = (storeId) => {
    const s = window.Store.state;
    if (!s.merchantSalesMap) s.merchantSalesMap = {};
    if (!s.merchantSalesMap[storeId]) {
      s.merchantSalesMap[storeId] = [
        {
          id: `VENTA-${Math.floor(4000 + Math.random() * 900)}`,
          date: '20/10/2026',
          time: '15:20 hs',
          customerName: storeId === 'store-1' ? 'Lucas Ruarte' : 'Valeria Benegas',
          paymentMethod: 'Efectivo en local',
          deliveryType: 'Retiro en sucursal',
          total: storeId === 'store-1' ? 38900 : 29900,
          items: [{ name: storeId === 'store-1' ? 'Amoladora Angular 4 1/2"' : 'Silla Eames Ergonómica', qty: 1, price: storeId === 'store-1' ? 38900 : 29900 }]
        }
      ];
    }
    return s.merchantSalesMap[storeId];
  };

  const getStoreEmployees = (storeId) => {
    const s = window.Store.state;
    if (!s.storeEmployeesMap) s.storeEmployeesMap = {};
    if (!s.storeEmployeesMap[storeId]) {
      s.storeEmployeesMap[storeId] = [
        { email: storeId === 'store-1' ? 'ferretero@comercio.com' : 'muebleria@comercio.com', name: 'Colaborador Principal', roles: ['Atención', 'Pedidos'], status: 'Activo' }
      ];
    }
    return s.storeEmployeesMap[storeId];
  };

  const merchantPanelConfig = {
    layout: 'market',
    title: 'Perfil Comerciante — CompraLocal San Juan',

    render() {
      ensureDefaultProducts();
      const s = window.Store.state;
      const activeTab = s.merchantTab || 'profile';
      const merchantProfile = getMerchantProfile();
      const stores = getMerchantStores();
      const activeStore = getActiveStore();
      const orders = getMerchantOrders(activeStore.id);
      const pendingOrdersCount = orders.filter(o => o.status !== 'Entregado').length;

      setTimeout(() => {
        const topUserLabel = document.getElementById('top-user-fullname');
        if (topUserLabel) {
          topUserLabel.textContent = `${merchantProfile.firstName} ${merchantProfile.lastName}`;
        }
      }, 50);

      return `
        <div class="market-container" style="max-width: 1150px; margin: 24px auto; padding: 0 16px;">
          
          <!-- Encabezado del Comercio -->
          <div style="padding: 24px 32px; background: linear-gradient(135deg, #09305f, #1e3a8a); color: white; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 4px 14px rgba(0,0,0,0.12);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
              <div style="display: flex; align-items: center; gap: 18px;">
                <div style="width: 68px; height: 68px; border-radius: 12px; background: #fff; overflow: hidden; display: grid; place-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); flex-shrink: 0;">
                  <img src="${esc(activeStore.logo)}" alt="${esc(activeStore.name)}" style="width:100%; height:100%; object-fit:cover;" />
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: white;">${esc(activeStore.name)}</h1>
                    <span style="background: #22c55e; color: #fff; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">Tienda Activa</span>
                  </div>
                  <div style="color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 6px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <span>${esc(activeStore.rubro)} ${activeStore.subrubro ? '· ' + esc(activeStore.subrubro) : ''}</span>
                    <span>${esc(activeStore.address)}, ${esc(activeStore.department)}</span>
                    <div style="margin-top: 4px;">
                      ${window.Reputation ? window.Reputation.renderBadge(activeStore, { size: 'sm' }) : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Selector visual -->
            <div style="display: inline-flex; align-items: center; gap: 10px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 10px; padding: 6px 14px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
              <span style="font-size: 13px; font-weight: 700; color: #ffffff;">Gestionar:</span>
              <select onchange="window.Actions['switch-active-store'](this)" style="height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.4); padding: 0 28px 0 10px; font-size: 13px; font-weight: 700; background: #ffffff !important; color: #0f172a !important; cursor: pointer; outline: none;">
                ${stores.map(st => `<option value="${st.id}" ${st.id === activeStore.id ? 'selected' : ''} style="background: #ffffff; color: #0f172a;">${esc(st.name)}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Estructura Principal -->
          <div style="display: grid; grid-template-columns: 260px 1fr; gap: 24px; align-items: start;">

            <aside style="background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <nav style="display: flex; flex-direction: column; gap: 6px;">
                <button type="button" data-action="set-merchant-tab" data-tab="profile" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s; ${activeTab === 'profile' ? 'background: #09305f; color: #fff;' : 'background: #fff; color: #0f172a;'}">
                  <span>Perfil Comerciante</span>
                </button>
                <button type="button" data-action="set-merchant-tab" data-tab="subscription" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s; ${activeTab === 'subscription' ? 'background: #09305f; color: #fff;' : 'background: #fff; color: #0f172a;'}">
                  <span>Suscripción y Planes</span>
                </button>
                <button type="button" data-action="set-merchant-tab" data-tab="orders" style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s; ${activeTab === 'orders' ? 'background: #09305f; color: #fff;' : 'background: #fff; color: #0f172a;'}">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span>Pedidos Vigentes</span>
                  </div>
                  ${pendingOrdersCount > 0 ? `<span style="background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px;">${pendingOrdersCount}</span>` : ''}
                </button>
                <button type="button" data-action="set-merchant-tab" data-tab="sales" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s; ${activeTab === 'sales' ? 'background: #09305f; color: #fff;' : 'background: #fff; color: #0f172a;'}">
                  <span>Mis Ventas y Métricas</span>
                </button>
                <button type="button" data-action="set-merchant-tab" data-tab="products" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s; ${activeTab === 'products' ? 'background: #09305f; color: #fff;' : 'background: #fff; color: #0f172a;'}">
                  <span>Mis Productos</span>
                </button>
                <button type="button" data-action="set-merchant-tab" data-tab="chat" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s; ${activeTab === 'chat' ? 'background: #09305f; color: #fff;' : 'background: #fff; color: #0f172a;'}">
                  <span>Mensajes y Consultas</span>
                </button>
                <button type="button" data-action="set-merchant-tab" data-tab="roles" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s; ${activeTab === 'roles' ? 'background: #09305f; color: #fff;' : 'background: #fff; color: #0f172a;'}">
                  <span>Roles y Empleados</span>
                </button>
                <button type="button" data-action="set-merchant-tab" data-tab="security" style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; transition: all 0.2s; ${activeTab === 'security' ? 'background: #09305f; color: #fff;' : 'background: #fff; color: #0f172a;'}">
                  <span>Seguridad y Cuenta</span>
                </button>
              </nav>
            </aside>

            <main id="merchant-main-content">
              ${activeTab === 'profile' ? this.renderProfileTab(stores, activeStore) : ''}
              ${activeTab === 'subscription' ? this.renderSubscriptionTab(stores) : ''}
              ${activeTab === 'orders' ? this.renderOrdersTab(activeStore) : ''}
              ${activeTab === 'sales' ? this.renderSalesTab(activeStore) : ''}
              ${activeTab === 'products' ? this.renderProductsTab(stores, activeStore) : ''}
              ${activeTab === 'chat' ? this.renderChatTab(activeStore) : ''}
              ${activeTab === 'roles' ? this.renderRolesTab(activeStore) : ''}
              ${activeTab === 'security' ? this.renderSecurityTab() : ''}
            </main>

          </div>
        </div>

        <!-- MODAL DE PAGO / PRORRATEO (MERCADO PAGO O TRANSFERENCIA BANCARIA) -->
        <div id="checkout-payment-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 480px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <h3 id="checkout-modal-title" style="font-size: 17px; font-weight: 800; color: #09305f; margin: 0;">Contratación de Plan (31 días)</h3>
              <button type="button" onclick="window.Actions['close-checkout-modal']()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>
            <div style="padding: 24px; display: flex; flex-direction: column; gap: 18px;" id="checkout-modal-body">
              <!-- Dinámico -->
            </div>
          </div>
        </div>

        <!-- MODAL: FORMULARIO NUEVO / EDITAR PRODUCTO O SERVICIO + CARGA MASIVA EXCEL -->
        <div id="add-product-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 800px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <div>
                <h3 id="product-modal-main-title" style="font-size: 17px; font-weight: 800; color: #09305f; margin: 0;">Publicar Producto o Carga Masiva</h3>
                <span style="font-size: 11px; color: #64748b;">Sucursal: <strong>${esc(activeStore.name)}</strong></span>
              </div>
              <button type="button" onclick="window.Actions['close-add-product-modal']()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>

            <div style="padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px;">
              <div id="bulk-upload-section-box" style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <h4 style="font-size: 13px; font-weight: 800; color: #166534; margin: 0 0 2px 0;">Carga Masiva Automática (Excel / CSV)</h4>
                    <p style="font-size: 11px; color: #14532d; margin: 0;">Subí el archivo de inventario de tu comercio para importar todos tus productos juntos en segundos.</p>
                  </div>
                  <label style="background: #166534; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                    Seleccionar Archivo Excel (.xlsx / .csv)
                    <input type="file" accept=".xlsx, .xls, .csv" onchange="window.Actions['handle-bulk-excel'](this)" style="display: none;" />
                  </label>
                </div>
              </div>

              <div id="bulk-separator-box" style="display: flex; align-items: center; gap: 12px; color: #64748b; font-size: 12px; font-weight: 700;">
                <hr style="flex: 1; border: none; border-top: 1px solid #cbd5e1;" />
                <span>O CARGAR / EDITAR PRODUCTO INDIVIDUAL</span>
                <hr style="flex: 1; border: none; border-top: 1px solid #cbd5e1;" />
              </div>

              <form id="create-product-form" onsubmit="event.preventDefault(); window.Forms['create-product'](this);" style="display: flex; flex-direction: column; gap: 20px;" novalidate>
                <input type="hidden" id="edit-product-id" name="editProductId" value="" />
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                    Nombre del Producto / Pack / Servicio *
                    <input type="text" id="input-product-name" name="productName" required placeholder="Ej. Zapatillas Urbanas Pro" style="height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                  </label>
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                    Precio ($ARS) *
                    <div style="position: relative; display: flex; align-items: center;">
                      <span style="position: absolute; left: 12px; font-size: 13px; font-weight: 700; color: #64748b;">$</span>
                      <input type="text" id="product-price-input" name="productPrice" required placeholder="0,00" oninput="window.Actions['format-price-input'](this)" style="width: 100%; height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px 0 28px; font-size: 13px;" />
                    </div>
                  </label>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                    SKU / Código
                    <input type="text" id="input-product-sku" name="productSku" placeholder="Ej. ZAP-001" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 12px;" />
                  </label>
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                    Marca *
                    <input type="text" id="input-product-brand" name="productBrand" required placeholder="Ej. Nike / Local" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 12px;" />
                  </label>
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                    Estado *
                    <select id="input-product-condition" name="productCondition" required style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 12px; background: #fff; cursor: pointer;">
                      <option value="Nuevo">Nuevo</option>
                      <option value="Usado">Usado</option>
                      <option value="Reacondicionado">Reacondicionado</option>
                    </select>
                  </label>
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                    Stock *
                    <input type="number" id="input-product-stock" name="productStock" required min="0" value="10" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 12px;" />
                  </label>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                    Categoría Principal *
                    <select id="prod-category-select" name="productCategory" required onchange="window.Actions['update-category-schema'](this.value)" style="height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 13px; background: #fff; cursor: pointer;">
                      <option value="">Seleccione una categoría...</option>
                      ${Object.keys(storeCategories).map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('')}
                    </select>
                  </label>
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                    Subcategoría *
                    <select id="prod-subcategory-select" name="productSubcategory" required style="height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 13px; background: #fff; cursor: pointer;">
                      <option value="">Primero seleccione una categoría</option>
                    </select>
                  </label>
                </div>

                <div id="dynamic-attributes-section" style="display: none; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                  <h4 style="font-size: 13px; font-weight: 800; color: #09305f; margin: 0 0 12px 0;">Atributos Específicos de la Categoría</h4>
                  <div id="dynamic-attributes-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;"></div>
                </div>

                <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 6px;">
                  Descripción Detallada
                  <textarea id="input-product-desc" name="productDescription" rows="3" placeholder="Detalles, materiales, tamaños, condiciones..." style="border-radius: 8px; border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; background: #fff; resize: vertical;"></textarea>
                </label>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 13px; font-weight: 800; color: #09305f;">Fotografías del Producto (Hasta 10)</label>
                    <span style="font-size: 11px; color: #64748b;" id="photo-counter-label">0 de 10 añadidas</span>
                  </div>
                  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <label style="background: #09305f; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                      Subir desde Computadora
                      <input type="file" id="local-image-file-input" accept="image/*" multiple onchange="window.Actions['handle-local-files'](this)" style="display: none;" />
                    </label>
                    <button type="button" onclick="window.Actions['add-photo-url-input']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #09305f; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                      Agregar por URL de Imagen
                    </button>
                  </div>
                  <div id="product-photos-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-top: 6px;"></div>
                </div>
              </form>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <button type="button" onclick="window.Actions['close-add-product-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; color: #475569;">Cancelar</button>
              <button type="button" id="product-submit-btn-label" onclick="document.getElementById('create-product-form').requestSubmit ? document.getElementById('create-product-form').requestSubmit() : document.getElementById('create-product-form').dispatchEvent(new Event('submit', {cancelable: true}));" style="background: var(--primary, #fd6910); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">Publicar Producto / Servicio</button>
            </div>
          </div>
        </div>

        <!-- MODAL DETALLE DE TICKET CON FORMATO IMPRIMIBLE -->
        <div id="metric-detail-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 520px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <h3 id="metric-modal-title" style="font-size: 17px; font-weight: 800; color: #09305f; margin: 0;">Comprobante de Operación</h3>
              <button type="button" onclick="window.Actions['close-metric-modal']()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>
            <div id="metric-modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #f8fafc;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <button type="button" onclick="window.print()" style="background: #09305f; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir Ticket
              </button>
              <button type="button" onclick="window.Actions['close-metric-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 9px 16px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; color: #475569;">Cerrar</button>
            </div>
          </div>
        </div>

        <!-- MODAL DE CONFIRMACIÓN PARA ARCHIVAR PEDIDO ENTREGADO -->
        <div id="confirm-archive-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 420px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; text-align: center; padding: 24px; margin: auto;">
            <div style="width: 52px; height: 52px; background: #dcfce7; color: #166534; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 14px auto;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h3 style="font-size: 18px; font-weight: 800; color: #09305f; margin: 0 0 8px 0;">¿Confirmar Entrega y Archivar?</h3>
            <p style="font-size: 13px; color: #64748b; margin: 0 0 20px 0; line-height: 1.4;">
              ¿Estás seguro de marcar este pedido como <strong>Entregado</strong>? Al hacerlo, se removerá de los pedidos vigentes y se registrará permanentemente en el <strong>Historial de Ventas</strong>.
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button type="button" onclick="window.Actions['close-confirm-archive']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; color: #475569; flex: 1;">Cancelar</button>
              <button type="button" id="confirm-archive-btn" style="background: #166534; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; flex: 1;">Sí, Entregado y Archivar</button>
            </div>
          </div>
        </div>

        <!-- MODAL PARA EDITAR DATOS PERSONALES DEL COMERCIANTE -->
        <div id="edit-merchant-profile-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 500px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <h3 style="font-size: 17px; font-weight: 800; color: #09305f; margin: 0;">Editar Datos Personales del Comerciante</h3>
              <button type="button" onclick="window.Actions['close-edit-merchant-profile-modal']()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>
            <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
              <form id="edit-merchant-profile-form" onsubmit="event.preventDefault(); window.Forms['edit-merchant-profile'](this);" style="display: flex; flex-direction: column; gap: 14px;" novalidate>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                    Nombre *
                    <input type="text" id="edit-merchant-firstname" name="firstName" required style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                  </label>
                  <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                    Apellido *
                    <input type="text" id="edit-merchant-lastname" name="lastName" required style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                  </label>
                </div>
                <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                  Número de CUIT / CUIL *
                  <input type="text" id="edit-merchant-cuit" name="cuit" required placeholder="Ej. 20-32114455-8" maxlength="13" oninput="window.Actions['format-cuit-input'](this)" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                </label>
                <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                  Dirección Personal *
                  <input type="text" id="edit-merchant-address" name="personalAddress" required style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                </label>
                <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                  Teléfono Personal *
                  <input type="tel" id="edit-merchant-phone" name="personalPhone" required placeholder="Ej. +54 9 264 5891234" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                </label>
              </form>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <button type="button" onclick="window.Actions['close-edit-merchant-profile-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 9px 16px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; color: #475569;">Cancelar</button>
              <button type="button" onclick="document.getElementById('edit-merchant-profile-form').requestSubmit ? document.getElementById('edit-merchant-profile-form').requestSubmit() : document.getElementById('edit-merchant-profile-form').dispatchEvent(new Event('submit', {cancelable: true}));" style="background: var(--primary, #fd6910); color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;">Guardar Cambios</button>
            </div>
          </div>
        </div>

        <!-- MODAL PARA AGREGAR / EDITAR TIENDA -->
        <div id="add-store-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999999; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;">
          <div style="background: #fff; border-radius: 16px; width: 100%; max-width: 720px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <h3 id="store-modal-title" style="font-size: 18px; font-weight: 800; color: #09305f; margin: 0;">Registrar Nueva Tienda / Sucursal</h3>
              <button type="button" onclick="window.Actions['close-add-store-modal']()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
            </div>
            
            <div style="padding: 24px; overflow-y: auto; flex: 1;" id="store-modal-body-container"></div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
              <button type="button" onclick="window.Actions['close-add-store-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; color: #475569;">Cancelar</button>
              <button type="button" onclick="window.Forms['create-store']()" style="background: var(--primary, #fd6910); color: #fff; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;" id="store-submit-btn-label">Registrar Tienda</button>
            </div>
          </div>
        </div>

        <!-- POP-UP PERSONALIZADO DE ÉXITO O ADVERTENCIA (TOAST FLOTANTE) -->
        <div id="merchant-toast-popup" style="display: none; position: fixed; bottom: 30px; right: 30px; background: #0f172a; color: #fff; padding: 14px 20px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 99999999; align-items: center; gap: 12px; border-left: 4px solid #22c55e;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <div>
            <strong style="font-size: 13px; display: block; color: #fff;" id="merchant-toast-title">¡Actualización exitosa!</strong>
            <span style="font-size: 12px; color: #94a3b8;" id="merchant-toast-msg">Los datos han sido guardados correctamente.</span>
          </div>
        </div>
      `;
    },

    renderProfileTab(stores, activeStore) {
      const merchantProfile = getMerchantProfile();

      return `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
              <div>
                <h2 style="font-size: 18px; font-weight: 800; color: var(--text, #0f172a); margin: 0 0 4px 0;">Datos Personales del Comerciante</h2>
                <p style="font-size: 13px; color: var(--muted, #64748b); margin: 0;">Información legal y de contacto del titular responsable de las tiendas.</p>
              </div>
              <button type="button" onclick="window.Actions['open-edit-merchant-profile-modal']()" style="background: #09305f; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Editar Datos Personales
              </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Nombre</span>
                <strong style="font-size: 14px; color: #0f172a;">${esc(merchantProfile.firstName)}</strong>
              </div>
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Apellido</span>
                <strong style="font-size: 14px; color: #0f172a;">${esc(merchantProfile.lastName)}</strong>
              </div>
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">CUIT / CUIL</span>
                <strong style="font-size: 14px; color: #0f172a;">${esc(merchantProfile.cuit)}</strong>
              </div>
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Dirección Personal</span>
                <strong style="font-size: 14px; color: #0f172a;">${esc(merchantProfile.personalAddress)}</strong>
              </div>
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Teléfono Personal</span>
                <strong style="font-size: 14px; color: #0f172a;">${esc(merchantProfile.personalPhone)}</strong>
              </div>
            </div>
          </div>

          <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
              <div>
                <h2 style="font-size: 18px; font-weight: 800; color: var(--text, #0f172a); margin: 0 0 4px 0;">Mis Tiendas y Sucursales Registradas</h2>
                <p style="font-size: 13px; color: var(--muted, #64748b); margin: 0;">Administrá tus locales, puntos de venta o agregá nuevas sucursales en San Juan.</p>
              </div>
              <button type="button" onclick="window.Actions['open-add-store-modal']()" style="background: var(--primary, #fd6910); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                + Registrar Nueva Tienda
              </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
              ${stores.map(st => {
                const isActive = st.id === activeStore.id;
                const phoneStr = st.phones && st.phones[0] ? `${getPhonePrefix(st.phones[0].country, st.phones[0].type)} ${st.phones[0].number}` : (st.phone || 'N/D');
                return `
                  <div style="border: 1px solid ${isActive ? '#09305f' : '#e2e8f0'}; border-radius: 12px; padding: 16px; background: ${isActive ? '#f0fdf4' : '#f8fafc'}; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; position: relative;">
                    ${isActive ? '<span style="position: absolute; top: 12px; right: 12px; background: #22c55e; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">Activa</span>' : ''}
                    <div style="display: flex; gap: 12px; align-items: center;">
                      <img src="${esc(st.logo)}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 1px solid #cbd5e1;" />
                      <div>
                        <strong style="font-size: 14px; color: #09305f; display: block;">${esc(st.name)}</strong>
                        <span style="font-size: 11px; color: #64748b; display: block;">CUIT: ${esc(st.cuit || 'N/D')}</span>
                      </div>
                    </div>
                    <div style="font-size: 12px; color: #334155; display: flex; flex-direction: column; gap: 2px;">
                      <span>${esc(st.rubro)} ${st.subrubro ? '· ' + esc(st.subrubro) : ''}</span>
                      <span>${esc(st.address)}, ${esc(st.department)} (${esc(st.locality)})</span>
                      <span>Tel: ${esc(phoneStr)}</span>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 4px;">
                      <button type="button" onclick="window.Actions['open-edit-store-modal']('${st.id}')" style="flex: 1; background: #f1f5f9; border: 1px solid #cbd5e1; color: #09305f; padding: 6px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Editar</button>
                      ${stores.length > 1 ? `<button type="button" onclick="window.Actions['delete-store']('${st.id}')" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Eliminar</button>` : ''}
                    </div>
                    <div>
                      ${!isActive ? `<button type="button" onclick="window.Actions['switch-active-store']('${st.id}')" style="width: 100%; background: #09305f; color: #fff; border: none; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">Seleccionar como Activa</button>` : `<span style="display: block; text-align: center; font-size: 12px; font-weight: 700; color: #166534; padding: 6px;">Tienda actualmente en gestión</span>`}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    },

    renderSubscriptionTab(stores) {
      const currentPlanKey = window.Store.state.merchantPlan || 'standard';
      const plans = {
        free: { id: 'free', name: 'Plan Gratuito', price: 0, maxStores: 1, maxProducts: 3 },
        standard: { id: 'standard', name: 'Plan Estándar', price: 10000, maxStores: Infinity, maxProducts: 100 },
        pro: { id: 'pro', name: 'Plan Pro Ilimitado', price: 20000, maxStores: Infinity, maxProducts: Infinity }
      };
      const activePlan = plans[currentPlanKey] || plans.standard;

      const currentStoresCount = stores.length;
      const allProducts = window.Data?.products || [];
      const merchantStoreIds = stores.map(st => st.id);
      const currentProductsCount = allProducts.filter(p => merchantStoreIds.includes(p.storeId)).length;

      let expiresLabel = 'Sin vencimiento (Plan Permanente)';
      if (currentPlanKey !== 'free' && window.Store.state.merchantPlanExpiresAt) {
        const daysLeft = Math.ceil((window.Store.state.merchantPlanExpiresAt - new Date().getTime()) / (1000 * 60 * 60 * 24));
        expiresLabel = `Vence en ${daysLeft > 0 ? daysLeft : 0} días (Duración: 31 días)`;
      }

      return `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div style="background: var(--surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
              <div>
                <span style="font-size: 11px; font-weight: 800; color: var(--primary, #fd6910); text-transform: uppercase; letter-spacing: 0.5px;">Estado de tu Cuenta</span>
                <h2 style="font-size: 20px; font-weight: 800; color: var(--text, #0f172a); margin: 4px 0 0 0;">Plan Actual: ${esc(activePlan.name)}</h2>
                <span style="font-size: 12px; color: #64748b; display: block; margin-top: 4px;">${expiresLabel}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                ${currentPlanKey === 'standard' ? `
                  <button type="button" onclick="window.Actions['open-prorate-checkout-modal']('pro', 20000, 'Plan Pro Ilimitado')" style="background: #166534; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                    🚀 Pasar a Plan Pro ($20.000)
                  </button>
                ` : ''}
                <span style="background: #22c55e; color: #fff; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px;">Activo y al día</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <div>
                <span style="font-size: 12px; font-weight: 700; color: #64748b; display: block; margin-bottom: 6px;">Tiendas Registradas</span>
                <div style="font-size: 18px; font-weight: 800; color: #09305f;">
                  ${currentStoresCount} <span style="font-size: 13px; font-weight: 600; color: #64748b;">/ ${activePlan.maxStores === Infinity ? 'Ilimitadas' : activePlan.maxStores}</span>
                </div>
              </div>
              <div>
                <span style="font-size: 12px; font-weight: 700; color: #64748b; display: block; margin-bottom: 6px;">Productos Publicados</span>
                <div style="font-size: 18px; font-weight: 800; color: #09305f;">
                  ${currentProductsCount} <span style="font-size: 13px; font-weight: 600; color: #64748b;">/ ${activePlan.maxProducts === Infinity ? 'Ilimitados' : activePlan.maxProducts}</span>
                </div>
              </div>
            </div>

            <h3 style="font-size: 16px; font-weight: 800; color: #09305f; margin: 0 0 16px 0;">Planes Disponibles en CompraLocal San Juan (Vigencia: 31 días)</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
              
              <div style="border: 2px solid ${currentPlanKey === 'free' ? '#09305f' : '#e2e8f0'}; border-radius: 14px; padding: 20px; background: #fff; display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
                <div>
                  <h4 style="font-size: 16px; font-weight: 800; color: #09305f; margin: 0 0 6px 0;">Plan Gratuito</h4>
                  <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">$0 <span style="font-size: 12px; font-weight: 600; color: #64748b;">/ permanente</span></div>
                  <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
                    <li>1 Tienda en San Juan</li>
                    <li>Hasta 3 productos en total</li>
                    <li>Soporte estándar</li>
                  </ul>
                </div>
                <div>
                  ${currentPlanKey === 'free' ? '<span style="display: block; text-align: center; background: #f1f5f9; color: #09305f; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 800;">Tu Plan Actual</span>' : '<button type="button" onclick="window.Actions[\'change-merchant-plan\'](\'free\')" style="width: 100%; background: #f1f5f9; border: 1px solid #cbd5e1; color: #09305f; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">Cambiar a Gratuito</button>'}
                </div>
              </div>

              <div style="border: 2px solid ${currentPlanKey === 'standard' ? '#09305f' : '#e2e8f0'}; border-radius: 14px; padding: 20px; background: #fff; display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
                <div>
                  <h4 style="font-size: 16px; font-weight: 800; color: #09305f; margin: 0 0 6px 0;">Plan Estándar</h4>
                  <div style="font-size: 22px; font-weight: 800; color: #fd6910; margin-bottom: 12px;">$10.000 <span style="font-size: 12px; font-weight: 600; color: #64748b;">/ 31 días</span></div>
                  <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
                    <li>Tiendas ilimitadas</li>
                    <li>Hasta 100 productos en total</li>
                    <li>Prioridad en listados</li>
                  </ul>
                </div>
                <div>
                  ${currentPlanKey === 'standard' ? '<span style="display: block; text-align: center; background: #f1f5f9; color: #09305f; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 800;">Tu Plan Actual</span>' : '<button type="button" onclick="window.Actions[\'open-checkout-modal\'](\'standard\', 10000, \'Plan Estándar\')" style="width: 100%; background: #fd6910; color: #fff; border: none; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">Contratar Estándar</button>'}
                </div>
              </div>

              <div style="border: 2px solid ${currentPlanKey === 'pro' ? '#09305f' : '#e2e8f0'}; border-radius: 14px; padding: 20px; background: #fff; display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
                <div>
                  <h4 style="font-size: 16px; font-weight: 800; color: #09305f; margin: 0 0 6px 0;">Plan Pro Ilimitado</h4>
                  <div style="font-size: 22px; font-weight: 800; color: #166534; margin-bottom: 12px;">$20.000 <span style="font-size: 12px; font-weight: 600; color: #64748b;">/ 31 días</span></div>
                  <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
                    <li>Tiendas ilimitadas</li>
                    <li>Carga ilimitada de productos</li>
                    <li>Atención y soporte prioritario</li>
                  </ul>
                </div>
                <div>
                  ${currentPlanKey === 'pro' ? '<span style="display: block; text-align: center; background: #f1f5f9; color: #09305f; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 800;">Tu Plan Actual</span>' : '<button type="button" onclick="window.Actions[\'open-prorate-checkout-modal\'](\'pro\', 20000, \'Plan Pro Ilimitado\')" style="width: 100%; background: #09305f; color: #fff; border: none; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">Pasar a Plan Pro</button>'}
                </div>
              </div>

            </div>

            <!-- Botón obligatorio de Cancelación de Suscripción / Cobro Automático -->
            ${currentPlanKey !== 'free' ? `
              <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                  <strong style="font-size: 13px; color: #0f172a; display: block;">Gestión de Renovación Automática</strong>
                  <span style="font-size: 12px; color: #64748b;">Podés dar de baja el cobro automático de tu pasarela en cualquier momento.</span>
                </div>
                <button type="button" onclick="window.Actions['open-cancel-subscription-modal']()" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                  Cancelar Suscripción y Cobro Automático
                </button>
              </div>
            ` : ''}

          </div>
        </div>
      `;
    },

    renderOrdersTab(activeStore) {
      const orders = getMerchantOrders(activeStore.id);
      const activeOrders = orders.filter(ord => ord.status !== 'Entregado');

      const ordersHtml = activeOrders.length > 0 ? activeOrders.map(ord => {
        const statusColors = {
          'Por preparar': { bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
          'Listo para retirar / enviar': { bg: '#e0f2fe', color: '#0284c7', border: '#bae6fd' },
          'Entregado': { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
        };
        const currentStColor = statusColors[ord.status] || statusColors['Por preparar'];

        return `
          <div style="border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; background: #ffffff; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <strong style="font-size: 16px; font-weight: 800; color: #09305f;">${esc(ord.id)}</strong>
                <span style="font-size: 12px; color: #64748b; display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  ${esc(ord.date)} a las ${esc(ord.time)}
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <button type="button" onclick="window.Actions['view-order-ticket']('${ord.id}')" style="background: #09305f; color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  Ver Ticket
                </button>
                <span style="background: ${currentStColor.bg}; color: ${currentStColor.color}; border: 1px solid ${currentStColor.border}; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 8px;">${esc(ord.status)}</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
              <div>
                <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Cliente</span>
                <strong style="font-size: 13px; color: #0f172a; display: block;">${esc(ord.customerName)}</strong>
                <span style="font-size: 12px; color: #475569; display: inline-flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  ${esc(ord.customerPhone)}
                </span>
              </div>
              <div>
                <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Modalidad de Entrega</span>
                <strong style="font-size: 13px; color: #0f172a; display: block;">${esc(ord.deliveryType)}</strong>
                <span style="font-size: 12px; color: #475569; display: inline-flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#09305f" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  ${esc(ord.address)}
                </span>
              </div>
              <div>
                <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Productos</span>
                <strong style="font-size: 13px; color: #0f172a; display: block;">${ord.items.map(i => `${i.qty}x${esc(i.name)}`).join(', ')}</strong>
                <span style="font-size: 13px; font-weight: 800; color: #fd6910; display: block; margin-top: 2px;">Total: ${money(ord.total)}</span>
              </div>
            </div>

            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
              <span style="font-size: 12px; font-weight: 800; color: #334155;">Cambiar Estado del Pedido:</span>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" onclick="window.Actions['update-order-status']('${ord.id}', 'Por preparar')" style="background: ${ord.status === 'Por preparar' ? '#09305f' : '#ffffff'}; color: ${ord.status === 'Por preparar' ? '#ffffff' : '#334155'}; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Por preparar</button>
                <button type="button" onclick="window.Actions['update-order-status']('${ord.id}', 'Listo para retirar / enviar')" style="background: ${ord.status === 'Listo para retirar / enviar' ? '#0284c7' : '#ffffff'}; color: ${ord.status === 'Listo para retirar / enviar' ? '#ffffff' : '#334155'}; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Listo para retirar / enviar</button>
                <button type="button" onclick="window.Actions['open-confirm-archive']('${ord.id}')" style="background: ${ord.status === 'Entregado' ? '#166534' : '#ffffff'}; color: ${ord.status === 'Entregado' ? '#ffffff' : '#166534'}; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Entregado (Archivar)</button>
              </div>
            </div>
          </div>
        `;
      }).join('') : '<p style="color: #64748b; text-align: center; padding: 30px;">No hay pedidos vigentes en este momento para esta sucursal.</p>';

      return `
        <div style="background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #cbd5e1;">
          <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Pedidos Vigentes y Compras Entrantes</h2>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">Gestioná en tiempo real las compras activas en <strong>${esc(activeStore.name)}</strong>.</p>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${ordersHtml}
          </div>
        </div>`;
    },

    renderSalesTab(activeStore) {
      const salesHistory = getMerchantSalesHistory(activeStore.id);
      const totalRevenueYear = salesHistory.reduce((acc, v) => acc + v.total, 0) + (activeStore.id === 'store-1' ? 450000 : 320000);
      
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const currentMonthOps = salesHistory.filter(s => {
        const [d, m, y] = s.date.split('/');
        return Number(m) === currentMonth && Number(y) === currentYear;
      }).length + 5;

      const followingState = window.Store?.state?.following || {};
      const totalFollowers = Object.entries(followingState).filter(([storeId, isFollowed]) => isFollowed && storeId === activeStore.id).length || (activeStore.id === 'store-1' ? 4 : 2);
      
      const favoriteProducts = window.Store?.state?.favoriteProducts || [];
      const savedProductsCount = favoriteProducts.length;

      return `
        <div style="background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; gap: 24px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Mis Ventas y Métricas — ${esc(activeStore.name)}</h2>
            <p style="font-size: 13px; color: #64748b; margin: 0;">Panel independiente de rendimiento y operaciones de esta sucursal.</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
            <div style="background: linear-gradient(135deg, #09305f, #1e3a8a); color: #fff; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: rgba(255,255,255,0.8);">Ventas Totales del Año</span>
              <strong style="font-size: 24px; font-weight: 800;">${money(totalRevenueYear)}</strong>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Operaciones (Mes Actual)</span>
              <strong style="font-size: 24px; font-weight: 800; color: #09305f;">${currentMonthOps} ventas</strong>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Prestigio de la Tienda</span>
              <div style="margin-top: 2px;">
                ${window.Reputation ? window.Reputation.renderBadge(activeStore, { size: 'md' }) : '<span style="font-weight: 700; color: #64748b;">Sin valoraciones aún</span>'}
              </div>
              <small style="font-size: 11px; color: #64748b; margin-top: auto;">Basado exclusivamente en compras verificadas</small>
            </div>
            <div onclick="window.Actions['open-followers-modal']('${activeStore.id}')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 8px; cursor: pointer;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Seguidores de Tienda</span>
              <strong style="font-size: 24px; font-weight: 800; color: #fd6910;">${totalFollowers} usuarios</strong>
              <span style="font-size: 11px; color: #09305f; text-decoration: underline; font-weight: 700;">Ver listado →</span>
            </div>
            <div onclick="window.Actions['open-saved-products-modal']('${activeStore.id}')" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 8px; cursor: pointer;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Productos en Favoritos</span>
              <strong style="font-size: 24px; font-weight: 800; color: #2563eb;">${savedProductsCount} guardados</strong>
              <span style="font-size: 11px; color: #09305f; text-decoration: underline; font-weight: 700;">Ver favoritos →</span>
            </div>
          </div>

          <div>
            <h3 style="font-size: 15px; font-weight: 800; color: #09305f; margin: 0 0 12px 0;">Historial de Ventas y Tickets Archivados (${esc(activeStore.name)})</h3>
            <div id="sales-tickets-list-container" style="display: flex; flex-direction: column; gap: 10px;">
              ${salesHistory.length > 0 ? salesHistory.map(sale => `
                <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; background: #f8fafc; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <strong style="font-size: 13px; color: #0f172a;">Venta #${esc(sale.id)}</strong>
                    <span style="font-size: 11px; color: #64748b; display: block;">${esc(sale.date)} · ${esc(sale.customerName)} (${esc(sale.paymentMethod)})</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <strong style="font-size: 14px; font-weight: 800; color: #166534;">${money(sale.total)}</strong>
                    <button type="button" onclick="window.Actions['view-sale-ticket']('${sale.id}')" style="background: #09305f; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Ver Ticket</button>
                  </div>
                </div>
              `).join('') : '<p style="font-size: 13px; color: #64748b;">No hay ventas registradas en esta sucursal.</p>'}
            </div>
          </div>
        </div>`;
    },

    renderProductsTab(stores, activeStore) {
      ensureDefaultProducts();
      const allProducts = window.Data?.products || [];
      const storeProducts = allProducts.filter(p => p.storeId === activeStore.id);

      const s = window.Store.state;
      const viewMode = s.merchantProductsViewMode || 'grid';
      const searchQuery = (s.merchantProductsSearchQuery || '').toLowerCase();

      const filteredProducts = storeProducts.filter(prod => {
        const name = (prod.name || '').toLowerCase();
        const sku = (prod.sku || '').toLowerCase();
        const brand = (prod.brand || '').toLowerCase();
        const cat = (prod.category || '').toLowerCase();
        const subcat = (prod.subcategory || '').toLowerCase();
        return name.includes(searchQuery) || sku.includes(searchQuery) || brand.includes(searchQuery) || cat.includes(searchQuery) || subcat.includes(searchQuery);
      });

      let productsContentHtml = '';

      if (filteredProducts.length > 0) {
        if (viewMode === 'grid') {
          productsContentHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 16px;">
              ${filteredProducts.map(prod => {
                const fallbackImg = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=60';
                const prodImg = esc(prod.image || (prod.photos && prod.photos[0]) || fallbackImg);
                return `
                  <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                      <img src="${prodImg}" style="width: 100%; height: 130px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
                      <strong style="font-size: 13px; color: #0f172a; display: block; margin-bottom: 2px;">${esc(prod.name)}</strong>
                      <span style="font-size: 11px; color: #64748b; display: block;">SKU: ${esc(prod.sku || 'N/D')}</span>
                      <span style="font-size: 11px; color: #64748b; display: block;">Stock: <strong>${prod.stock ?? 10}</strong> un.</span>
                    </div>
                    <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                      <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 15px; font-weight: 800; color: var(--primary, #fd6910);">${money(prod.price)}</span>
                        <span style="font-size: 10px; font-weight: 700; background: #e2e8f0; color: #334155; padding: 2px 6px; border-radius: 4px;">${esc(prod.condition || 'Nuevo')}</span>
                      </div>
                      <div style="display: flex; gap: 6px;">
                        <button type="button" onclick="window.Actions['open-edit-product-modal']('${prod.id}')" style="flex: 1; background: #f1f5f9; border: 1px solid #cbd5e1; color: #09305f; padding: 6px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Editar</button>
                        <button type="button" onclick="window.Actions['delete-merchant-product']('${prod.id}')" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Eliminar</button>
                      </div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          `;
        } else {
          productsContentHtml = `
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
              ${filteredProducts.map(prod => {
                const fallbackImg = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=60';
                const prodImg = esc(prod.image || (prod.photos && prod.photos[0]) || fallbackImg);
                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 16px; background: #f8fafc; gap: 16px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <img src="${prodImg}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />
                      <div>
                        <strong style="font-size: 13px; color: #0f172a; display: block;">${esc(prod.name)}</strong>
                        <span style="font-size: 11px; color: #64748b;">SKU: ${esc(prod.sku || 'N/D')} · Categoría: ${esc(prod.category || 'N/D')}</span>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                      <div style="text-align: right;">
                        <span style="font-size: 11px; color: #64748b; display: block;">Stock: <strong>${prod.stock ?? 10}</strong></span>
                        <strong style="font-size: 14px; font-weight: 800; color: var(--primary, #fd6910);">${money(prod.price)}</strong>
                      </div>
                      <span style="font-size: 11px; font-weight: 700; background: #e2e8f0; color: #334155; padding: 4px 8px; border-radius: 6px;">${esc(prod.condition || 'Nuevo')}</span>
                      <div style="display: flex; gap: 6px;">
                        <button type="button" onclick="window.Actions['open-edit-product-modal']('${prod.id}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #09305f; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Editar</button>
                        <button type="button" onclick="window.Actions['delete-merchant-product']('${prod.id}')" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Eliminar</button>
                      </div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          `;
        }
      } else {
        productsContentHtml = `<p style="grid-column: 1/-1; color:#64748b; text-align:center; padding: 30px;">No se encontraron productos con el filtro ingresado.</p>`;
      }

      return `
        <div style="background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #cbd5e1;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Mis Productos (${storeProducts.length}/100) — ${esc(activeStore.name)}</h2>
              <p style="font-size: 13px; color: #64748b; margin: 0;">Gestioná, buscá y alterná la vista de tu inventario.</p>
            </div>
            <button type="button" onclick="window.Actions['open-add-product-modal']()" style="background: var(--primary, #fd6910); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
              + Publicar Producto / Carga Masiva
            </button>
          </div>

          <!-- BARRA DE BÚSQUEDA Y SELECTOR DE VISTA -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; flex-wrap: wrap; margin-bottom: 16px;">
            <div style="flex: 1; min-width: 240px; position: relative; display: flex; align-items: center;">
              <span style="position: absolute; left: 12px; color: #64748b; display: flex; align-items: center;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input type="text" id="merchant-product-search-input" value="${esc(s.merchantProductsSearchQuery || '')}" placeholder="Buscá por nombre, ID / SKU o categoría..." oninput="window.Actions['filter-merchant-products'](this.value)" style="width: 100%; height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px 0 36px; font-size: 13px; background: #fff; outline: none;" />
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #334155;">Vista:</span>
              <button type="button" onclick="window.Actions['set-products-view-mode']('grid')" style="background: ${viewMode === 'grid' ? '#09305f' : '#fff'}; color: ${viewMode === 'grid' ? '#fff' : '#09305f'}; border: 1px solid #cbd5e1; padding: 7px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                Grilla
              </button>
              <button type="button" onclick="window.Actions['set-products-view-mode']('list')" style="background: ${viewMode === 'list' ? '#09305f' : '#fff'}; color: ${viewMode === 'list' ? '#fff' : '#09305f'}; border: 1px solid #cbd5e1; padding: 7px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                Lista
              </button>
            </div>
          </div>

          ${productsContentHtml}
        </div>`;
    },

    renderChatTab(activeStore) {
      window.Store.state.chatsMap = window.Store.state.chatsMap || {};
      if (!window.Store.state.chatsMap[activeStore.id]) {
        window.Store.state.chatsMap[activeStore.id] = {
          'chat-1': {
            clientName: 'Mariana Gómez',
            lastMsg: 'Hola, ¿tienen stock del taladro?',
            time: '10:45 hs',
            unread: 2,
            messages: [
              { sender: 'client', text: 'Hola, ¿tienen stock del taladro percutor?' },
              { sender: 'store', text: `¡Hola Mariana! Sí, tenemos stock disponible en ${activeStore.name}.` }
            ]
          },
          'chat-2': {
            clientName: 'Esteban Carrizo',
            lastMsg: '¿Hacen envíos a domicilio?',
            time: 'Ayer',
            unread: 0,
            messages: [
              { sender: 'client', text: 'Buenas tardes, ¿hacen envíos a domicilio en Capital?' },
              { sender: 'store', text: '¡Hola Esteban! Sí, realizamos envíos a todo San Juan.' }
            ]
          },
          'chat-3': {
            clientName: 'Valeria Benegas',
            lastMsg: 'Quisiera consultar por presupuestos...',
            time: '20/10',
            unread: 0,
            messages: [
              { sender: 'client', text: 'Hola, quisiera consultar por presupuestos para obras.' },
              { sender: 'store', text: '¡Hola Valeria! Claro que sí, pasanos el detalle por aquí.' }
            ]
          }
        };
      }

      const storeChatsObj = window.Store.state.chatsMap[activeStore.id];
      const activeChatId = window.Store.state.activeChatId || Object.keys(storeChatsObj)[0];
      const currentChat = storeChatsObj[activeChatId] || storeChatsObj[Object.keys(storeChatsObj)[0]];
      
      const isMobileChatOpen = window.Store.state.merchantMobileChatOpen || false;

      return `
        <div style="background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; gap: 16px; min-height: 520px; box-sizing: border-box; width: 100%; max-width: 100%; overflow: hidden;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Mensajes y Consultas de Clientes — ${esc(activeStore.name)}</h2>
            <p style="font-size: 13px; color: #64748b; margin: 0;">Respondé en tiempo real a las consultas enviadas por los usuarios desde su perfil de tienda.</p>
          </div>

          <style>
            @media (max-width: 768px) {
              .merchant-chat-responsive-container {
                flex-direction: column !important;
                height: 480px !important;
              }
              .merchant-chat-conversations-list {
                width: 100% !important;
                max-width: 100% !important;
                height: ${isMobileChatOpen ? '0px !important' : '100% !important'};
                display: ${isMobileChatOpen ? 'none !important' : 'flex !important'};
                border-right: none !important;
              }
              .merchant-chat-active-pane {
                display: ${isMobileChatOpen ? 'flex !important' : 'none !important'};
                width: 100% !important;
                height: 100% !important;
              }
            }
          </style>

          <div class="merchant-chat-responsive-container" style="display: flex; flex: 1; height: 460px; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #f8fafc; width: 100%; box-sizing: border-box;">
            
            <!-- Lista lateral de chats apilados -->
            <div class="merchant-chat-conversations-list" style="width: 280px; min-width: 220px; border-right: 1px solid #cbd5e1; background: #fff; display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto;">
              <div style="padding: 14px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #09305f; background: #f8fafc; position: sticky; top: 0; z-index: 2;">
                CONVERSACIONES ACTIVAS (${Object.keys(storeChatsObj).length})
              </div>
              <div style="display: flex; flex-direction: column;">
                ${Object.entries(storeChatsObj).map(([cId, chatData]) => {
                  const isSelected = cId === activeChatId;
                  return `
                    <div onclick="window.Actions['select-merchant-chat']('${cId}')" style="padding: 12px 14px; border-bottom: 1px solid #f1f5f9; background: ${isSelected ? '#e0f2fe' : '#fff'}; border-left: 4px solid ${isSelected ? '#0284c7' : 'transparent'}; cursor: pointer; transition: background 0.15s;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <strong style="font-size: 13px; color: #0f172a;">${esc(chatData.clientName)}</strong>
                        <span style="font-size: 10px; color: #64748b;">${esc(chatData.time)}</span>
                      </div>
                      <span style="font-size: 11px; color: #475569; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(chatData.lastMsg)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Panel derecho / móvil del chat activo -->
            <div class="merchant-chat-active-pane" style="flex: 1; min-width: 0; display: flex; flex-direction: column; background: #f8fafc; overflow: hidden;">
              <div onclick="window.Actions['back-to-merchant-chats-list']()" style="padding: 12px 16px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="display: none; font-size: 12px; font-weight: 800; color: #0284c7;" class="mobile-back-indicator">← CONVERSACIONES ACTIVAS</span>
                  <span style="font-size: 13px; font-weight: 800; color: #09305f;" class="desktop-title-indicator">Chat con: ${esc(currentChat.clientName)}</span>
                </div>
                <span style="font-size: 11px; color: #166534; font-weight: 700; background: #dcfce7; padding: 2px 8px; border-radius: 6px;">En línea</span>
              </div>

              <style>
                @media (max-width: 768px) {
                  .mobile-back-indicator { display: inline-block !important; }
                  .desktop-title-indicator { display: none !important; }
                }
              </style>

              <div id="merchant-chat-msgs-box" style="flex: 1; padding: 16px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 10px; word-break: break-word;">
                ${currentChat.messages.map(m => `
                  <div style="max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.4; word-break: break-word; ${m.sender === 'store' ? 'background: #09305f; color: #fff; align-self: flex-end; border-bottom-right-radius: 2px;' : 'background: #fff; color: #0f172a; border: 1px solid #cbd5e1; align-self: flex-start; border-bottom-left-radius: 2px;'}">
                    ${esc(m.text)}
                  </div>
                `).join('')}
              </div>

              <form onsubmit="event.preventDefault(); window.Forms['merchant-send-chat'](this, '${activeStore.id}', '${activeChatId}')" style="padding: 12px; background: #fff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px;">
                <input type="text" name="message" placeholder="Escribí tu respuesta como comerciante..." autocomplete="off" style="flex: 1; min-width: 0; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none;" />
                <button type="submit" style="background: #09305f; color: #fff; border: none; padding: 0 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; flex-shrink: 0;">Responder</button>
              </form>
            </div>
          </div>
        </div>`;
    },

    renderRolesTab(activeStore) {
      const employees = getStoreEmployees(activeStore.id);

      // Función auxiliar para formatear de forma dinámica quién posee el rol
      const getRoleAssigneeLabel = (roleNameVariants) => {
        const assigned = employees.filter(emp => emp.roles && emp.roles.some(r => roleNameVariants.includes(r)));
        if (assigned.length === 0) return 'Nadie lo tiene todavía';
        return assigned.map(emp => `${esc(emp.name || emp.email.split('@')[0])} (${esc(emp.email)})`).join(', ');
      };

      const atencionLabel = getRoleAssigneeLabel(['Atención', 'Atención al cliente']);
      const catalogoLabel = getRoleAssigneeLabel(['Catálogo']);
      const pedidosLabel = getRoleAssigneeLabel(['Pedidos']);

      return `
        <div style="background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; gap: 24px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Roles y Empleados — ${esc(activeStore.name)}</h2>
            <p style="font-size: 13px; color: #64748b; margin: 0;">Invitá colaboradores por correo y asigná múltiples roles de gestión.</p>
          </div>

          <!-- Invitación y Equipo Autorizado -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
            <h3 style="font-size: 14px; font-weight: 800; color: #09305f; margin: 0 0 12px 0;">Invitar Nuevo Colaborador</h3>
            <form onsubmit="event.preventDefault(); window.Forms['invite-employee'](this);" style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center;">
                <input type="email" name="employeeEmail" required placeholder="correo@ejemplo.com" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 13px;" />
                <button type="submit" style="background: #09305f; color: #fff; border: none; padding: 0 18px; height: 38px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;">Enviar Invitación</button>
              </div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px;">
                <label style="font-size: 12px; font-weight: 600; color: #334155; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" name="role" value="Atención al cliente" /> Atención al cliente
                </label>
                <label style="font-size: 12px; font-weight: 600; color: #334155; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" name="role" value="Catálogo" /> Catálogo
                </label>
                <label style="font-size: 12px; font-weight: 600; color: #334155; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" name="role" value="Pedidos" /> Pedidos
                </label>
              </div>
            </form>
          </div>

          <div>
            <h3 style="font-size: 14px; font-weight: 800; color: #09305f; margin: 0 0 10px 0;">Equipo Autorizado</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${employees.length > 0 ? employees.map((emp, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #fff;">
                  <div>
                    <strong style="font-size: 13px; color: #0f172a; display: block;">${esc(emp.email)}</strong>
                    <span style="font-size: 11px; color: #64748b;">Roles: ${emp.roles.join(', ')}</span>
                  </div>
                  <button type="button" onclick="window.Actions['remove-employee'](${idx})" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Revocar</button>
                </div>
              `).join('') : '<p style="font-size: 13px; color: #64748b; text-align: center; padding: 16px;">Todavía no sumaste a nadie. Vos, como dueño, ya tenés todos los permisos.</p>'}
            </div>
          </div>

          <!-- SECCIÓN: Roles disponibles (DINÁMICO) -->
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; flex-direction: column; gap: 14px;">
            <div>
              <h3 style="font-size: 15px; font-weight: 800; color: #09305f; margin: 0 0 4px 0;">Roles disponibles</h3>
              <p style="font-size: 13px; color: #64748b; margin: 0;">Cada rol define qué puede hacer la persona. Los define CompraLocal; el equipo queda en tus manos.</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
              
              <!-- Rol 1: Atención -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                <div>
                  <strong style="font-size: 14px; font-weight: 800; color: #0f172a; display: block;">Atención</strong>
                  <span style="font-size: 11px; color: #64748b;">${atencionLabel}</span>
                </div>
                <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
                  <li>Ver los pedidos de la tienda</li>
                  <li>Ver y responder preguntas de clientes</li>
                  <li>Ver todos los productos de la tienda, incluidos borradores</li>
                </ul>
              </div>

              <!-- Rol 2: Catálogo -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                <div>
                  <strong style="font-size: 14px; font-weight: 800; color: #0f172a; display: block;">Catálogo</strong>
                  <span style="font-size: 11px; color: #64748b;">${catalogoLabel}</span>
                </div>
                <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
                  <li>Crear, editar y borrar productos, variantes e imágenes</li>
                  <li>Publicar y pausar productos</li>
                  <li>Ver todos los productos de la tienda, incluidos borradores</li>
                  <li>Modificar existencias</li>
                </ul>
              </div>

              <!-- Rol 3: Pedidos -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                <div>
                  <strong style="font-size: 14px; font-weight: 800; color: #0f172a; display: block;">Pedidos</strong>
                  <span style="font-size: 11px; color: #64748b;">${pedidosLabel}</span>
                </div>
                <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
                  <li>Ver nombre y teléfono de quienes compraron</li>
                  <li>Cambiar el estado de los pedidos (preparación, listo, cancelación)</li>
                  <li>Ver los pedidos de la tienda</li>
                </ul>
              </div>

            </div>
          </div>

        </div>`;
    },

    renderSecurityTab() {
      return `
        <div style="background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; gap: 20px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Seguridad y Cuenta</h2>
            <p style="font-size: 13px; color: #64748b; margin: 0;">Modificá tu contraseña de acceso con autenticación de doble factor (2FA).</p>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <h3 style="font-size: 14px; font-weight: 800; color: #09305f; margin: 0 0 14px 0;">Cambiar Contraseña con Doble Autenticación (2FA)</h3>
            <form id="change-password-form" onsubmit="event.preventDefault(); window.Forms['change-password-2fa'](this);" style="display: flex; flex-direction: column; gap: 14px;" novalidate>
              <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                Contraseña Actual *
                <input type="password" name="currentPassword" required style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px;" />
              </label>
              <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                Nueva Contraseña *
                <input type="password" name="newPassword" required style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px;" />
              </label>
              <label style="font-size: 12px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                Código de Doble Autenticación (2FA - SMS / Email) *
                <div style="display: flex; gap: 10px;">
                  <input type="text" name="twoFactorCode" required placeholder="Ej. 482910" maxlength="6" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 12px; flex: 1;" />
                  <button type="button" onclick="showToast('Código 2FA enviado a tu teléfono y correo registrado.')" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 0 14px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; color: #09305f;">Solicitar Código</button>
                </div>
              </label>
              <button type="submit" style="background: #09305f; color: #fff; border: none; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 6px;">Actualizar Contraseña de Forma Segura</button>
            </form>
          </div>
        </div>`;
    }
  };

  window.Pages = window.Pages || {};
  window.Pages['merchant-panel'] = merchantPanelConfig;

  window.Actions = window.Actions || {};

  window.Actions['set-merchant-tab'] = (el) => {
    window.Store.set({ merchantTab: el.dataset.tab }, { silent: true });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['switch-active-store'] = (elOrVal) => {
    const storeId = typeof elOrVal === 'string' ? elOrVal : elOrVal.value;
    window.Store.set({ activeStoreId: storeId }, { silent: true });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['filter-merchant-products'] = (query) => {
    window.Store.set({ merchantProductsSearchQuery: query }, { silent: true });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['set-products-view-mode'] = (mode) => {
    window.Store.set({ merchantProductsViewMode: mode }, { silent: true });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['select-merchant-chat'] = (chatId) => {
    window.Store.set({ activeChatId: chatId, merchantMobileChatOpen: true }, { silent: true });
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Actions['back-to-merchant-chats-list'] = () => {
    if (window.innerWidth <= 768) {
      window.Store.set({ merchantMobileChatOpen: false }, { silent: true });
      if (window.App && typeof window.App.render === 'function') window.App.render();
    }
  };

  window.Actions['change-merchant-plan'] = (planKey) => {
    window.Store.set({ merchantPlan: planKey, merchantPlanExpiresAt: null }, { silent: true });
    if (planKey === 'free' && window.Store.state.merchantStores && window.Store.state.merchantStores.length > 1) {
      window.Store.state.merchantStores = [window.Store.state.merchantStores[0]];
      window.Store.state.activeStoreId = window.Store.state.merchantStores[0].id;
    }
    if (window.App && typeof window.App.render === 'function') {
      window.App.render();
    }
    showToast(`Has cambiado de plan correctamente.`);
  };

  window.Actions['open-checkout-modal'] = (planKey, price, planName) => {
    const modal = document.getElementById('checkout-payment-modal');
    const body = document.getElementById('checkout-modal-body');
    const title = document.getElementById('checkout-modal-title');
    if (!modal || !body) return;

    if (title) title.textContent = `Contratación de ${planName} ($${price.toLocaleString()} / 31 días)`;

    body.innerHTML = `
      <div style="font-size: 13px; color: #334155; line-height: 1.5;">
        <strong style="color: #09305f; display: block; margin-bottom: 6px;">Seleccioná tu método de pago:</strong>
        <p style="margin: 0 0 16px 0; color: #64748b;">Tu plan se activará automáticamente por el plazo de <strong>31 días corridos</strong>.</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button type="button" onclick="window.Actions['pay-with-mercadopago']('${planKey}')" style="display: flex; align-items: center; justify-content: space-between; background: #009ee3; color: #fff; border: none; padding: 14px 18px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,158,227,0.2);">
          <span style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>
            Pagar con Mercado Pago (API Oficial)
          </span>
          <span>$${price.toLocaleString()}</span>
        </button>

        <button type="button" onclick="window.Actions['pay-with-bank-transfer']('${planKey}')" style="display: flex; align-items: center; justify-content: space-between; background: #09305f; color: #fff; border: none; padding: 14px 18px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer;">
          <span style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Transferencia Bancaria / CBU
          </span>
          <span>$${price.toLocaleString()}</span>
        </button>
      </div>

      <button type="button" onclick="window.Actions['close-checkout-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; margin-top: 4px;">Cancelar</button>
    `;

    modal.style.display = 'flex';
  };

  window.Actions['open-prorate-checkout-modal'] = (planKey, price, planName) => {
    const modal = document.getElementById('checkout-payment-modal');
    const body = document.getElementById('checkout-modal-body');
    const title = document.getElementById('checkout-modal-title');
    if (!modal || !body) return;

    if (title) title.textContent = `Mejora de Plan con Prorrateo (${planName})`;

    let daysLeft = 15;
    if (window.Store.state.merchantPlanExpiresAt) {
      daysLeft = Math.ceil((window.Store.state.merchantPlanExpiresAt - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) daysLeft = 0;
    }
    const prorateDiscount = Math.round((10000 / 31) * daysLeft);
    const finalProratePrice = price - prorateDiscount > 0 ? price - prorateDiscount : 5000;

    body.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 6px;">
        <strong style="font-size: 13px; color: #166534;">Desglose de Prorrateo Automático:</strong>
        <p style="font-size: 12px; color: #14532d; margin: 0; line-height: 1.4;">
          Como te quedan <strong>${daysLeft} días</strong> de tu plan actual, hoy abonarás solo la diferencia proporcional descontando el saldo a favor.
        </p>
      </div>

      <div style="font-size: 13px; color: #334155; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between;"><span>Precio Plan Pro:</span> <strong>$${price.toLocaleString()}</strong></div>
        <div style="display: flex; justify-content: space-between; color: #166534;"><span>Saldo a favor (${daysLeft} días):</span> <strong>-$${prorateDiscount.toLocaleString()}</strong></div>
        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 4px 0;" />
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #09305f;"><span>Total a abonar hoy:</span> <span style="color: #fd6910;">$${finalProratePrice.toLocaleString()}</span></div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px;">
        <button type="button" onclick="window.Actions['pay-with-mercadopago']('${planKey}')" style="background: #009ee3; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
          Confirmar y Pagar Diferencia ($${finalProratePrice.toLocaleString()})
        </button>
        <button type="button" onclick="window.Actions['close-checkout-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;">Cancelar</button>
      </div>
    `;

    modal.style.display = 'flex';
  };

  window.Actions['open-cancel-subscription-modal'] = () => {
    const modal = document.getElementById('checkout-payment-modal');
    const body = document.getElementById('checkout-modal-body');
    const title = document.getElementById('checkout-modal-title');
    if (!modal || !body) return;

    if (title) title.textContent = 'Cancelar Suscripción y Cobro Automático';

    body.innerHTML = `
      <div style="font-size: 13px; color: #334155; line-height: 1.5; display: flex; flex-direction: column; gap: 12px;">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; color: #dc2626;">
          <strong>Aviso importante:</strong> Al dar de baja la suscripción, se desactivarán los cobros automáticos recurrentes en tu tarjeta o pasarela. Tu plan actual se mantendrá activo hasta la fecha de su vencimiento.
        </div>
        <p style="margin: 0; color: #64748b;">¿Confirmás que querés dar de baja el cobro automático?</p>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button type="button" onclick="window.Actions['confirm-cancel-subscription']()" style="background: #dc2626; color: #fff; border: none; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; flex: 1;">Sí, Cancelar Cobro Automático</button>
        <button type="button" onclick="window.Actions['close-checkout-modal']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; flex: 1;">Volver</button>
      </div>
    `;

    modal.style.display = 'flex';
  };

  window.Actions['confirm-cancel-subscription'] = () => {
    window.Store.set({ merchantPlan: 'free', merchantPlanExpiresAt: null }, { silent: true });
    window.Actions['close-checkout-modal']();
    if (window.App && typeof window.App.render === 'function') window.App.render();
    showToast('Suscripción y cobro automático cancelados con éxito. Se aplicó el Plan Gratuito.');
  };

  window.Actions['close-checkout-modal'] = () => {
    const modal = document.getElementById('checkout-payment-modal');
    if (modal) modal.style.display = 'none';
  };

  window.Actions['pay-with-mercadopago'] = (planKey) => {
    const expiresAt = new Date().getTime() + (31 * 24 * 60 * 60 * 1000);
    window.Store.set({ merchantPlan: planKey, merchantPlanExpiresAt: expiresAt }, { silent: true });
    window.Actions['close-checkout-modal']();
    if (window.App && typeof window.App.render === 'function') window.App.render();
    showToast('¡Pago aprobado mediante Mercado Pago! Suscripción activada por 31 días.');
  };

  window.Actions['pay-with-bank-transfer'] = (planKey) => {
    const expiresAt = new Date().getTime() + (31 * 24 * 60 * 60 * 1000);
    window.Store.set({ merchantPlan: planKey, merchantPlanExpiresAt: expiresAt }, { silent: true });
    window.Actions['close-checkout-modal']();
    if (window.App && typeof window.App.render === 'function') window.App.render();
    showToast('¡Comprobante registrado! Se ha activado tu suscripción por 31 días.');
  };

  window.Actions['update-order-status'] = (orderId, newStatus) => {
    const activeStore = getActiveStore();
    const orders = getMerchantOrders(activeStore.id);
    const ord = orders.find(o => o.id === orderId);
    if (ord) {
      ord.status = newStatus;
      if (window.App && typeof window.App.render === 'function') window.App.render();
      showToast(`Estado del pedido #${orderId} actualizado a: ${newStatus}`);
    }
  };

  window.Actions['view-order-ticket'] = (orderId) => {
    const activeStore = getActiveStore();
    const orders = getMerchantOrders(activeStore.id);
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;
    const titleEl = document.getElementById('metric-modal-title');
    const bodyEl = document.getElementById('metric-modal-body');
    if (titleEl) titleEl.textContent = `Ticket de Pedido #${ord.id}`;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; font-family: monospace; color: #0f172a; display: flex; flex-direction: column; gap: 12px;">
          <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 12px;">
            <strong style="font-size: 16px; color: #09305f; display: block;">COMPRALOCAL SAN JUAN (${esc(activeStore.name)})</strong>
            <span style="font-size: 12px; color: #64748b;">Comprobante de Orden de Compra</span>
          </div>
          <div style="font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
            <div><strong>Nº de Orden:</strong> ${esc(ord.id)}</div>
            <div><strong>Fecha y Hora:</strong> ${esc(ord.date)} - ${esc(ord.time)}</div>
            <div><strong>Cliente:</strong> ${esc(ord.customerName)} (${esc(ord.customerPhone)})</div>
            <div><strong>Método de Pago:</strong> ${esc(ord.paymentMethod)}</div>
            <div><strong>Entrega:</strong> ${esc(ord.deliveryType)}</div>
            <div><strong>Dirección:</strong> ${esc(ord.address)}</div>
            <div><strong>Estado:</strong> ${esc(ord.status)}</div>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 10px;">
            <strong style="font-size: 12px; display: block; margin-bottom: 6px;">Detalle de Productos:</strong>
            ${ord.items.map(i => `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>${i.qty}x ${esc(i.name)}</span>
                <span>${money(i.price * i.qty)}</span>
              </div>
            `).join('')}
          </div>
          <div style="border-top: 2px dashed #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 800;">
            <span>TOTAL:</span>
            <span style="color: #fd6910;">${money(ord.total)}</span>
          </div>
        </div>
      `;
    }
    const modal = document.getElementById('metric-detail-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.Actions['view-sale-ticket'] = (saleId) => {
    const activeStore = getActiveStore();
    const sales = getMerchantSalesHistory(activeStore.id);
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    const titleEl = document.getElementById('metric-modal-title');
    const bodyEl = document.getElementById('metric-modal-body');
    if (titleEl) titleEl.textContent = `Comprobante de Venta #${sale.id}`;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; font-family: monospace; color: #0f172a; display: flex; flex-direction: column; gap: 12px;">
          <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 12px;">
            <strong style="font-size: 16px; color: #09305f; display: block;">COMPRALOCAL SAN JUAN (${esc(activeStore.name)})</strong>
            <span style="font-size: 12px; color: #64748b;">Ticket de Venta Archivada</span>
          </div>
          <div style="font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
            <div><strong>Nº de Venta:</strong> ${esc(sale.id)}</div>
            <div><strong>Fecha y Hora:</strong> ${esc(sale.date)} - ${esc(sale.time || 'N/D')}</div>
            <div><strong>Cliente:</strong> ${esc(sale.customerName)}</div>
            <div><strong>Método de Pago:</strong> ${esc(sale.paymentMethod)}</div>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 10px;">
            <strong style="font-size: 12px; display: block; margin-bottom: 6px;">Productos Vendidos:</strong>
            ${sale.items.map(i => `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>${i.qty}x ${esc(i.name)}</span>
                <span>${money(i.price * i.qty)}</span>
              </div>
            `).join('')}
          </div>
          <div style="border-top: 2px dashed #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 800;">
            <span>TOTAL COBRADO:</span>
            <span style="color: #166534;">${money(sale.total)}</span>
          </div>
        </div>
      `;
    }
    const modal = document.getElementById('metric-detail-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.Actions['open-followers-modal'] = (storeId) => {
    const titleEl = document.getElementById('metric-modal-title');
    const bodyEl = document.getElementById('metric-modal-body');
    if (titleEl) titleEl.textContent = 'Seguidores de la Tienda';
    
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Usuarios que siguen actualmente a esta tienda:</p>
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #09305f; color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 12px;">CM</div>
            <div>
              <strong style="font-size: 13px; color: #0f172a; display: block;">Carlos Mendoza (Comerciante)</strong>
              <small style="font-size: 11px; color: #166534; font-weight: 700;">Titular de la cuenta</small>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #2563eb; color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 12px;">MG</div>
            <div>
              <strong style="font-size: 13px; color: #0f172a; display: block;">Mariana Gómez</strong>
              <small style="font-size: 11px; color: #166534; font-weight: 700;">Cliente frecuente</small>
            </div>
          </div>
        </div>
      `;
    }
    const modal = document.getElementById('metric-detail-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.Actions['open-saved-products-modal'] = (storeId) => {
    const titleEl = document.getElementById('metric-modal-title');
    const bodyEl = document.getElementById('metric-modal-body');
    if (titleEl) titleEl.textContent = 'Productos Guardados en Favoritos';

    const favoriteIds = window.Store?.state?.favoriteProducts || [];
    const allProducts = window.Data?.products || [];
    const savedItems = allProducts.filter(p => favoriteIds.includes(p.id));

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <p style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Artículos guardados por los clientes en sus listas de deseos:</p>
          ${savedItems.length > 0 ? savedItems.map(item => `
            <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;">
              <img src="${esc(item.image || (item.photos && item.photos[0]) || '')}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;" />
              <div style="flex: 1;">
                <strong style="font-size: 13px; color: #0f172a; display: block;">${esc(item.name)}</strong>
                <span style="font-size: 12px; font-weight: 800; color: #fd6910;">${money(item.price)}</span>
              </div>
            </div>
          `).join('') : '<p style="font-size: 13px; color: #64748b; text-align: center; padding: 20px;">No hay productos guardados actualmente en favoritos.</p>'}
        </div>
      `;
    }
    const modal = document.getElementById('metric-detail-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.Actions['close-metric-modal'] = () => {
    const modal = document.getElementById('metric-detail-modal');
    if (modal) modal.style.display = 'none';
  };

  let pendingArchiveOrderId = null;
  window.Actions['open-confirm-archive'] = (orderId) => {
    pendingArchiveOrderId = orderId;
    const modal = document.getElementById('confirm-archive-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.Actions['close-confirm-archive'] = () => {
    pendingArchiveOrderId = null;
    const modal = document.getElementById('confirm-archive-modal');
    if (modal) modal.style.display = 'none';
  };

  setTimeout(() => {
    const btnConfirm = document.getElementById('confirm-archive-btn');
    if (btnConfirm) {
      btnConfirm.onclick = () => {
        if (!pendingArchiveOrderId) return;
        const activeStore = getActiveStore();
        const orders = getMerchantOrders(activeStore.id);
        const idx = orders.findIndex(o => o.id === pendingArchiveOrderId);
        if (idx !== -1) {
          const completedOrder = orders.splice(idx, 1)[0];
          completedOrder.status = 'Entregado';
          const salesHistory = getMerchantSalesHistory(activeStore.id);
          salesHistory.unshift(completedOrder);
        }
        window.Actions['close-confirm-archive']();
        if (window.App && typeof window.App.render === 'function') window.App.render();
        showToast('Pedido marcado como Entregado y archivado en Ventas.');
      };
    }
  }, 400);

  window.Actions['open-add-product-modal'] = () => {
    const modal = document.getElementById('add-product-modal');
    if (modal) {
      document.getElementById('product-modal-main-title').textContent = 'Publicar Producto o Carga Masiva';
      document.getElementById('product-submit-btn-label').textContent = 'Publicar Producto / Servicio';
      document.getElementById('edit-product-id').value = '';
      document.getElementById('bulk-upload-section-box').style.display = 'flex';
      document.getElementById('bulk-separator-box').style.display = 'flex';
      
      const form = document.getElementById('create-product-form');
      if (form) form.reset();
      
      productPhotosList = [];
      const container = document.getElementById('product-photos-container');
      if (container) container.innerHTML = '';
      window.Actions['update-photo-counter']();

      modal.style.display = 'flex';
    }
  };

  window.Actions['open-edit-product-modal'] = (productId) => {
    const allProducts = window.Data?.products || [];
    const prod = allProducts.find(p => p.id === productId);
    if (!prod) return;

    const modal = document.getElementById('add-product-modal');
    if (modal) {
      document.getElementById('product-modal-main-title').textContent = `Editar Producto: ${prod.name}`;
      document.getElementById('product-submit-btn-label').textContent = 'Guardar Cambios';
      document.getElementById('edit-product-id').value = prod.id;
      
      document.getElementById('bulk-upload-section-box').style.display = 'none';
      document.getElementById('bulk-separator-box').style.display = 'none';

      document.getElementById('input-product-name').value = prod.name || '';
      
      const priceInput = document.getElementById('product-price-input');
      if (priceInput) {
        let num = (prod.price || 0);
        priceInput.value = num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      document.getElementById('input-product-sku').value = prod.sku === 'N/D' ? '' : (prod.sku || '');
      document.getElementById('input-product-brand').value = prod.brand || '';
      document.getElementById('input-product-condition').value = prod.condition || 'Nuevo';
      document.getElementById('input-product-stock').value = prod.stock ?? 10;
      document.getElementById('input-product-desc').value = prod.description || '';

      const catSelect = document.getElementById('prod-category-select');
      if (catSelect) {
        catSelect.value = prod.category || '';
        window.Actions['update-category-schema'](prod.category || '');
      }

      setTimeout(() => {
        const subSelect = document.getElementById('prod-subcategory-select');
        if (subSelect && prod.subcategory) {
          subSelect.value = prod.subcategory;
        }
      }, 50);

      productPhotosList = prod.photos && prod.photos.length > 0 ? [...prod.photos] : (prod.image ? [prod.image] : []);
      renderProductPhotos();

      modal.style.display = 'flex';
    }
  };

  window.Actions['delete-merchant-product'] = (productId) => {
    if (!confirm('¿Estás seguro de eliminar este producto de tu inventario?')) return;
    if (!window.Data || !window.Data.products) return;
    const idx = window.Data.products.findIndex(p => p.id === productId);
    if (idx !== -1) {
      window.Data.products.splice(idx, 1);
      if (window.App && typeof window.App.render === 'function') window.App.render();
      showToast('Producto eliminado exitosamente del inventario.');
    }
  };

  window.Actions['close-add-product-modal'] = () => {
    const modal = document.getElementById('add-product-modal');
    if (modal) modal.style.display = 'none';
  };

  window.Actions['format-price-input'] = (el) => {
    let raw = el.value.replace(/\D/g, '');
    if (!raw) {
      el.value = '';
      return;
    }
    let num = Number(raw) / 100;
    el.value = num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  window.Actions['update-category-schema'] = (categoryName) => {
    const subSelect = document.getElementById('prod-subcategory-select');
    const attrSection = document.getElementById('dynamic-attributes-section');
    const attrContainer = document.getElementById('dynamic-attributes-container');

    if (!subSelect) return;

    const catData = storeCategories[categoryName];
    if (!catData) {
      subSelect.innerHTML = '<option value="">Primero seleccione una categoría</option>';
      if (attrSection) attrSection.style.display = 'none';
      return;
    }

    let subs = catData.subcategories;
    if (Array.isArray(subs)) {
      subSelect.innerHTML = '<option value="">Seleccione una subcategoría...</option>' + subs.map(sub => `<option value="${esc(sub)}">${esc(sub)}</option>`).join('');
    } else if (typeof subs === 'object') {
      let html = '<option value="">Seleccione una subcategoría...</option>';
      for (const group in subs) {
        html += `<optgroup label="${esc(group)}">` + subs[group].map(sub => `<option value="${esc(sub)}">${esc(sub)}</option>`).join('') + `</optgroup>`;
      }
      subSelect.innerHTML = html;
    }

    if (attrContainer && attrSection) {
      const attrs = catData.attributes || catData.rentalAttributes || [];
      if (attrs.length > 0) {
        attrSection.style.display = 'block';
        attrContainer.innerHTML = attrs.map(attr => `
          <label style="font-size: 11px; font-weight: 700; color: #334155; display: flex; flex-direction: column; gap: 4px;">
            ${esc(attr)}
            <input type="text" name="attr_${esc(attr)}" placeholder="Completar ${esc(attr).toLowerCase()}..." style="height: 34px; border-radius: 6px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 12px; background: #fff;" />
          </label>
        `).join('');
      } else {
        attrSection.style.display = 'none';
      }
    }
  };

  window.Actions['update-photo-counter'] = () => {
    const counter = document.getElementById('photo-counter-label');
    if (counter) counter.textContent = `${productPhotosList.length} de 10 añadidas`;
  };

  window.Actions['handle-local-files'] = (input) => {
    const files = input.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (productPhotosList.length >= 10) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        productPhotosList.push(e.target.result);
        renderProductPhotos();
      };
      reader.readAsDataURL(file);
    });
  };

  window.Actions['add-photo-url-input'] = () => {
    const url = prompt('Ingrese la URL de la imagen del producto:');
    if (url && url.trim() !== '') {
      if (productPhotosList.length >= 10) return;
      productPhotosList.push(url.trim());
      renderProductPhotos();
    }
  };

  window.Actions['remove-product-photo'] = (index) => {
    productPhotosList.splice(index, 1);
    renderProductPhotos();
  };

  function renderProductPhotos() {
    const container = document.getElementById('product-photos-container');
    if (!container) return;
    container.innerHTML = productPhotosList.map((photo, idx) => `
      <div style="position: relative; width: 100%; height: 100px; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; background: #fff;">
        <img src="${esc(photo)}" style="width: 100%; height: 100%; object-fit: cover;" />
        <button type="button" onclick="window.Actions['remove-product-photo'](${idx})" style="position: absolute; top: 4px; right: 4px; background: rgba(220,38,38,0.8); color: #fff; border: none; width: 20px; height: 20px; border-radius: 50%; font-size: 11px; cursor: pointer; display: grid; place-items: center;">&times;</button>
      </div>
    `).join('');
    window.Actions['update-photo-counter']();
  }

  window.Forms['create-product'] = (form) => {
    const formData = new FormData(form);
    const activeStore = getActiveStore();
    const editId = formData.get('editProductId');

    const name = formData.get('productName');
    const priceStr = formData.get('productPrice');
    const brand = formData.get('productBrand');
    const category = formData.get('productCategory');
    const subcategory = formData.get('productSubcategory');
    const stock = formData.get('productStock');

    if (!name || !priceStr || !brand || !category || !subcategory) {
      showToast('Por favor completa todos los campos obligatorios del producto.', 'warning');
      return;
    }

    const price = Number(priceStr.replace(/\./g, '').replace(',', '.'));

    if (!window.Data) window.Data = {};
    if (!window.Data.products) window.Data.products = [];

    if (editId && editId !== '') {
      const prod = window.Data.products.find(p => p.id === editId);
      if (prod) {
        prod.name = name.trim();
        prod.price = price;
        prod.brand = brand.trim();
        prod.category = category;
        prod.subcategory = subcategory;
        prod.stock = Number(stock) || 10;
        prod.sku = formData.get('productSku') || 'N/D';
        prod.condition = formData.get('productCondition');
        prod.description = formData.get('productDescription') || '';
        prod.photos = [...productPhotosList];
        if (productPhotosList.length > 0) prod.image = productPhotosList[0];
      }
      showToast(`¡Producto actualizado exitosamente!`);
    } else {
      window.Data.products.push({
        id: `prod-${Date.now()}`,
        storeId: activeStore.id,
        name: name.trim(),
        price: price,
        brand: brand.trim(),
        category: category,
        subcategory: subcategory,
        stock: Number(stock) || 10,
        sku: formData.get('productSku') || 'N/D',
        condition: formData.get('productCondition'),
        description: formData.get('productDescription') || '',
        photos: [...productPhotosList],
        image: productPhotosList[0] || ''
      });
      showToast(`¡Producto publicado exitosamente en ${activeStore.name}!`);
    }

    productPhotosList = [];
    window.Actions['close-add-product-modal']();
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Forms['merchant-send-chat'] = (form, storeId, chatId) => {
    const input = form.querySelector('input[name="message"]');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    window.Store.state.chatsMap = window.Store.state.chatsMap || {};
    if (window.Store.state.chatsMap[storeId] && window.Store.state.chatsMap[storeId][chatId]) {
      const chatObj = window.Store.state.chatsMap[storeId][chatId];
      chatObj.messages.push({ sender: 'store', text });
      chatObj.lastMsg = text;
      chatObj.time = 'Recién';
    }
    input.value = '';
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  function renderStoreModalBody() {
    const container = document.getElementById('store-modal-body-container');
    if (!container) return;

    const catKeys = Object.keys(storeCategories);
    const selectedCat = storeModalDraft.rubro || catKeys[0];
    const catData = storeCategories[selectedCat] || {};
    const subcategories = Array.isArray(catData.subcategories) ? catData.subcategories : [];

    const departments = Object.keys(sanJuanDepartments);
    const currentDept = storeModalDraft.department || departments[0];
    const localities = sanJuanDepartments[currentDept] || ['San Juan'];

    const phones = storeModalDraft.phones || [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '' }];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <label style="display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:13px; font-weight:700; color:#334155;">Nombre del comercio *</span>
          <input type="text" id="modal-store-name" value="${esc(storeModalDraft.name)}" placeholder="Ej. Almacén Libertador" oninput="storeModalDraft.name=this.value" style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;" />
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:13px; font-weight:700; color:#334155;">CUIT / CUIL *</span>
          <input type="text" id="modal-store-cuit" value="${esc(storeModalDraft.cuit)}" placeholder="Ej. 20-32114455-8" maxlength="13" oninput="window.Actions['format-modal-cuit'](this)" style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;" />
        </label>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <span style="font-size:13px; font-weight:700; color:#334155;">Teléfono(s) de contacto * (Hasta 3)</span>
          <div id="modal-phones-list" style="display:flex; flex-direction:column; gap:8px;">
            ${phones.map((p, idx) => `
              <div style="display:grid; grid-template-columns: 140px 110px 1fr auto; gap:8px; align-items:center;">
                <select onchange="window.Actions['update-store-phone-country'](${idx}, this.value)" style="height:38px; border-radius:8px; border:1px solid #cbd5e1; padding:0 8px; font-size:12px; background:#fff;">
                  ${countries.map(c => `<option value="${esc(c)}" ${p.country === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                </select>
                <select onchange="window.Actions['update-store-phone-type'](${idx}, this.value)" style="height:38px; border-radius:8px; border:1px solid #cbd5e1; padding:0 8px; font-size:12px; background:#fff;">
                  ${phoneTypes.map(t => `<option value="${esc(t)}" ${p.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
                </select>
                <input type="tel" value="${esc(p.number)}" placeholder="Ej. 2644123456" maxlength="12" oninput="window.Actions['update-store-phone-number'](${idx}, this)" style="height:38px; border-radius:8px; border:1px solid #cbd5e1; padding:0 10px; font-size:12px;" />
                ${phones.length > 1 ? `<button type="button" onclick="window.Actions['remove-store-phone'](${idx})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:16px; padding:4px;" title="Eliminar">&times;</button>` : '<div style="width:20px;"></div>'}
              </div>
            `).join('')}
          </div>
          ${phones.length < 3 ? `<button type="button" onclick="window.Actions['add-store-phone']()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#09305f; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; align-self:flex-start;">+ Agregar otro teléfono (máx. 3)</button>` : ''}
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
          <span style="font-size: 13px; font-weight: 700; color: #334155;">Logotipo de la Tienda</span>
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <label style="background: #09305f; color: #fff; padding: 7px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              Subir Archivo Local
              <input type="file" accept="image/*" onchange="window.Actions['handle-store-logo-file'](this)" style="display: none;" />
            </label>
            <button type="button" onclick="window.Actions['add-store-logo-url']()" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #09305f; padding: 7px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
              Agregar por URL
            </button>
          </div>
          ${storeModalDraft.logo ? `<div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;"><img src="${esc(storeModalDraft.logo)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1;" /><span style="font-size: 12px; color: #166534; font-weight: 700;">Logo cargado correctamente</span></div>` : ''}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:13px; font-weight:700; color:#334155;">Rubro principal *</span>
            <select id="modal-store-rubro" onchange="window.Actions['change-modal-rubro'](this.value)" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 13px; background: #fff;">
              <option value="">Seleccioná un rubro</option>
              ${catKeys.map(cat => `<option value="${esc(cat)}" ${storeModalDraft.rubro === cat ? 'selected' : ''}>${esc(cat)}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:13px; font-weight:700; color:#334155;">Subrubro (Opcional)</span>
            <select id="modal-store-subrubro" onchange="window.Actions['change-modal-subrubro'](this.value)" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 13px; background: #fff;">
              <option value="">Seleccioná un subrubro</option>
              ${subcategories.map(sub => `<option value="${esc(sub)}" ${storeModalDraft.subrubro === sub ? 'selected' : ''}>${esc(sub)}</option>`).join('')}
            </select>
          </label>
        </div>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:13px; font-weight:700; color:#334155;">Descripción (Opcional)</span>
          <textarea id="modal-store-desc" rows="2" placeholder="Contanos brevemente qué ofrecés y qué hace especial a tu comercio..." oninput="storeModalDraft.description=this.value" style="border-radius:8px; border:1px solid #cbd5e1; padding:10px 12px; font-size:13px; background:#fff; resize:vertical;">${esc(storeModalDraft.description || '')}</textarea>
        </label>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:13px; font-weight:700; color:#334155;">Provincia *</span>
            <input type="text" value="San Juan" disabled style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 13px; background: #f1f5f9; color: #475569;" />
          </label>
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:13px; font-weight:700; color:#334155;">Departamento en San Juan *</span>
            <select id="modal-store-dept" onchange="window.Actions['change-modal-department'](this.value)" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 13px; background: #fff;">
              ${departments.map(d => `<option value="${esc(d)}" ${storeModalDraft.department === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
            </select>
          </label>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:13px; font-weight:700; color:#334155;">Localidad / Villa / Zona *</span>
            <select id="modal-store-locality" onchange="window.Actions['change-modal-locality'](this.value)" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 13px; background: #fff;">
              ${localities.map(l => `<option value="${esc(l)}" ${storeModalDraft.locality === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:13px; font-weight:700; color:#334155;">Calle, Altura y Detalles *</span>
            <input type="text" id="modal-store-address" value="${esc(storeModalDraft.address)}" placeholder="Ej. Av. Libertador 1240 (O)" oninput="storeModalDraft.address=this.value" style="height: 38px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 10px; font-size: 13px;" />
          </label>
        </div>
      </div>
    `;
  }

  function syncDraftFromDOM() {
    const nameInput = document.getElementById('modal-store-name');
    if (nameInput) storeModalDraft.name = nameInput.value;
    const cuitInput = document.getElementById('modal-store-cuit');
    if (cuitInput) storeModalDraft.cuit = cuitInput.value;
    const descInput = document.getElementById('modal-store-desc');
    if (descInput) storeModalDraft.description = descInput.value;
    const addrInput = document.getElementById('modal-store-address');
    if (addrInput) storeModalDraft.address = addrInput.value;
    const subrubroInput = document.getElementById('modal-store-subrubro');
    if (subrubroInput) storeModalDraft.subrubro = subrubroInput.value;
    const deptInput = document.getElementById('modal-store-dept');
    if (deptInput) storeModalDraft.department = deptInput.value;
    const locInput = document.getElementById('modal-store-locality');
    if (locInput) storeModalDraft.locality = locInput.value;
  }

  window.Actions['format-modal-cuit'] = (el) => {
    let val = el.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    let formatted = val;
    if (val.length > 2 && val.length <= 10) {
      formatted = `${val.substring(0, 2)}-${val.substring(2)}`;
    } else if (val.length > 10) {
      formatted = `${val.substring(0, 2)}-${val.substring(2, 10)}-${val.substring(10, 11)}`;
    }
    el.value = formatted;
    storeModalDraft.cuit = formatted;
  };

  window.Actions['add-store-phone'] = () => {
    syncDraftFromDOM();
    if (!storeModalDraft.phones) storeModalDraft.phones = [];
    if (storeModalDraft.phones.length < 3) {
      storeModalDraft.phones.push({ country: 'Argentina (+54)', type: 'WhatsApp', number: '' });
      renderStoreModalBody();
    }
  };

  window.Actions['remove-store-phone'] = (idx) => {
    syncDraftFromDOM();
    if (storeModalDraft.phones && storeModalDraft.phones.length > 1) {
      storeModalDraft.phones.splice(idx, 1);
      renderStoreModalBody();
    }
  };

  window.Actions['update-store-phone-country'] = (idx, val) => {
    if (storeModalDraft.phones && storeModalDraft.phones[idx]) {
      storeModalDraft.phones[idx].country = val;
    }
  };

  window.Actions['update-store-phone-type'] = (idx, val) => {
    if (storeModalDraft.phones && storeModalDraft.phones[idx]) {
      storeModalDraft.phones[idx].type = val;
    }
  };

  window.Actions['update-store-phone-number'] = (idx, inputEl) => {
    let cleanVal = inputEl.value.replace(/\D/g, '');
    if (cleanVal.length > 10) cleanVal = cleanVal.substring(0, 10);
    inputEl.value = cleanVal;
    if (storeModalDraft.phones && storeModalDraft.phones[idx]) {
      storeModalDraft.phones[idx].number = cleanVal;
    }
  };

  window.Actions['handle-store-logo-file'] = (input) => {
    syncDraftFromDOM();
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      storeModalDraft.logo = e.target.result;
      renderStoreModalBody();
    };
    reader.readAsDataURL(file);
  };

  window.Actions['add-store-logo-url'] = () => {
    syncDraftFromDOM();
    const url = prompt('Ingrese la URL del logotipo de la tienda:');
    if (url && url.trim() !== '') {
      storeModalDraft.logo = url.trim();
      renderStoreModalBody();
    }
  };

  window.Actions['change-modal-rubro'] = (val) => {
    syncDraftFromDOM();
    storeModalDraft.rubro = val;
    storeModalDraft.subrubro = '';
    renderStoreModalBody();
  };

  window.Actions['change-modal-subrubro'] = (val) => {
    storeModalDraft.subrubro = val;
  };

  window.Actions['change-modal-department'] = (val) => {
    syncDraftFromDOM();
    storeModalDraft.department = val;
    const locs = sanJuanDepartments[val] || ['San Juan'];
    storeModalDraft.locality = locs[0];
    renderStoreModalBody();
  };

  window.Actions['change-modal-locality'] = (val) => {
    storeModalDraft.locality = val;
  };

  window.Actions['open-add-store-modal'] = () => {
    const stores = getMerchantStores();
    const currentPlan = window.Store.state.merchantPlan || 'standard';

    if (currentPlan === 'free' && stores.length >= 1) {
      showToast('⚠️ Límite alcanzado: El Plan Gratuito solo permite 1 tienda. ¡Pasate a Estándar o Pro para registrar más!', 'warning');
      return;
    }

    const defaultRubro = Object.keys(storeCategories)[0];
    storeModalDraft = {
      id: '', name: '', cuit: getMerchantProfile().cuit || '',
      phones: [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '' }],
      rubro: defaultRubro, subrubro: '', description: '',
      province: 'San Juan', department: 'Capital', locality: 'Capital', address: '', logo: ''
    };
    const modal = document.getElementById('add-store-modal');
    if (modal) {
      document.getElementById('store-modal-title').textContent = 'Registrar Nueva Tienda / Sucursal';
      document.getElementById('store-submit-btn-label').textContent = 'Registrar Tienda';
      renderStoreModalBody();
      modal.style.display = 'flex';
    }
  };

  window.Actions['open-edit-store-modal'] = (storeId) => {
    const stores = getMerchantStores();
    const st = stores.find(s => s.id === storeId);
    if (!st) return;
    storeModalDraft = { 
      ...st,
      phones: st.phones && st.phones.length > 0 ? [...st.phones] : [{ country: 'Argentina (+54)', type: 'WhatsApp', number: st.phone || '' }]
    };
    const modal = document.getElementById('add-store-modal');
    if (modal) {
      document.getElementById('store-modal-title').textContent = `Editar Sucursal: ${st.name}`;
      document.getElementById('store-submit-btn-label').textContent = 'Guardar Cambios';
      renderStoreModalBody();
      modal.style.display = 'flex';
    }
  };

  window.Actions['close-add-store-modal'] = () => {
    const modal = document.getElementById('add-store-modal');
    if (modal) modal.style.display = 'none';
  };

  window.Forms['create-store'] = () => {
    syncDraftFromDOM();
    const nameEl = document.getElementById('modal-store-name');
    const cuitEl = document.getElementById('modal-store-cuit');
    const rubroEl = document.getElementById('modal-store-rubro');
    const addressEl = document.getElementById('modal-store-address');

    if (!nameEl || !nameEl.value.trim() || !cuitEl || !cuitEl.value.trim() || !rubroEl || !rubroEl.value || !addressEl || !addressEl.value.trim()) {
      showToast('Por favor completa todos los campos obligatorios (*).', 'warning');
      return;
    }

    const stores = getMerchantStores();
    const currentPlan = window.Store.state.merchantPlan || 'standard';

    if (currentPlan === 'free' && stores.length >= 1 && !storeModalDraft.id) {
      showToast('⚠️ Límite alcanzado: No puedes registrar más de 1 tienda en el Plan Gratuito.', 'warning');
      return;
    }

    const defaultLogo = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=200&auto=format&fit=crop&q=60';
    const storeLogo = storeModalDraft.logo && storeModalDraft.logo.trim() !== '' ? storeModalDraft.logo : defaultLogo;

    if (storeModalDraft.id && storeModalDraft.id !== '') {
      const st = stores.find(s => s.id === storeModalDraft.id);
      if (st) {
        st.name = nameEl.value.trim();
        st.cuit = cuitEl.value.trim();
        st.rubro = rubroEl.value;
        st.subrubro = storeModalDraft.subrubro || '';
        st.description = storeModalDraft.description || '';
        st.department = storeModalDraft.department || 'Capital';
        st.locality = storeModalDraft.locality || 'Capital';
        st.address = addressEl.value.trim();
        st.phones = storeModalDraft.phones;
        st.logo = storeLogo;
      }
      showToast('Sucursal actualizada con éxito.');
    } else {
      const newStoreId = `store-${Date.now()}`;
      stores.push({
        id: newStoreId,
        name: nameEl.value.trim(),
        cuit: cuitEl.value.trim(),
        rubro: rubroEl.value,
        subrubro: storeModalDraft.subrubro || '',
        description: storeModalDraft.description || '',
        province: 'San Juan',
        department: storeModalDraft.department || 'Capital',
        locality: storeModalDraft.locality || 'Capital',
        address: addressEl.value.trim(),
        logo: storeLogo,
        phones: storeModalDraft.phones || [{ country: 'Argentina (+54)', type: 'WhatsApp', number: '' }]
      });
      window.Store.set({ activeStoreId: newStoreId }, { silent: true });
      showToast('¡Nueva tienda registrada y seleccionada como activa!');
    }

    window.Store.set({ merchantStores: stores }, { silent: true });
    window.Actions['close-add-store-modal']();
    if (window.App && typeof window.App.render === 'function') window.App.render();
  };

  window.Forms['invite-employee'] = (form) => {
    const formData = new FormData(form);
    const email = formData.get('employeeEmail');
    const checkboxes = form.querySelectorAll('input[name="role"]:checked');
    const roles = Array.from(checkboxes).map(cb => cb.value);

    if (!email || roles.length === 0) {
      showToast('Ingresa un correo válido y selecciona al menos un rol.', 'warning');
      return;
    }

    const activeStore = getActiveStore();
    const employees = getStoreEmployees(activeStore.id);
    const namePart = email.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    
    employees.push({ email, name: formattedName, roles, status: 'Pendiente de aceptación' });
    
    form.reset();
    if (window.App && typeof window.App.render === 'function') window.App.render();
    showToast(`Invitación enviada a ${email} correctamente.`);
  };

  window.Actions['remove-employee'] = (index) => {
    const activeStore = getActiveStore();
    const employees = getStoreEmployees(activeStore.id);
    employees.splice(index, 1);
    if (window.App && typeof window.App.render === 'function') window.App.render();
    showToast('Colaborador revocado.');
  };

  window.Forms['change-password-2fa'] = (form) => {
    const formData = new FormData(form);
    const current = formData.get('currentPassword');
    const newPass = formData.get('newPassword');
    const code2fa = formData.get('twoFactorCode');

    if (!current || !newPass || !code2fa) {
      showToast('Completa todos los campos y el código 2FA.', 'warning');
      return;
    }

    if (code2fa.length < 6) {
      showToast('El código de doble autenticación (2FA) es inválido.', 'warning');
      return;
    }

    form.reset();
    showToast('¡Contraseña actualizada con éxito mediante doble autenticación!');
  };

  function showToast(message, type = 'success') {
    const toast = document.getElementById('merchant-toast-popup');
    const titleEl = document.getElementById('merchant-toast-title');
    const msgEl = document.getElementById('merchant-toast-msg');
    if (!toast || !msgEl || !titleEl) return;

    msgEl.textContent = message;

    if (type === 'warning') {
      toast.style.borderLeft = '4px solid #f59e0b';
      titleEl.textContent = 'Operación no exitosa';
      titleEl.style.color = '#f59e0b';
      toast.querySelector('svg').outerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      `;
    } else {
      toast.style.borderLeft = '4px solid #22c55e';
      titleEl.textContent = '¡Actualización exitosa!';
      titleEl.style.color = '#fff';
      toast.querySelector('svg').outerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
      `;
    }

    toast.style.display = 'flex';
    setTimeout(() => { toast.style.display = 'none'; }, 4500);
  }

  window.Actions['open-edit-merchant-profile-modal'] = () => {
    const profile = getMerchantProfile();
    const modal = document.getElementById('edit-merchant-profile-modal');
    if (!modal) return;
    document.getElementById('edit-merchant-firstname').value = profile.firstName || '';
    document.getElementById('edit-merchant-lastname').value = profile.lastName || '';
    document.getElementById('edit-merchant-cuit').value = profile.cuit || '';
    document.getElementById('edit-merchant-address').value = profile.personalAddress || '';
    document.getElementById('edit-merchant-phone').value = profile.personalPhone || '';
    modal.style.display = 'flex';
  };

  window.Actions['close-edit-merchant-profile-modal'] = () => {
    const modal = document.getElementById('edit-merchant-profile-modal');
    if (modal) modal.style.display = 'none';
  };

  window.Forms['edit-merchant-profile'] = (form) => {
    const formData = new FormData(form);
    window.Store.state.merchantProfile = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      cuit: formData.get('cuit'),
      personalAddress: formData.get('personalAddress'),
      personalPhone: formData.get('personalPhone')
    };
    window.Actions['close-edit-merchant-profile-modal']();
    if (window.App && typeof window.App.render === 'function') window.App.render();
    showToast('Datos personales actualizados con éxito.');
  };

})();

/* ─── Scroll automático hacia arriba al cambiar de pestaña en el Panel Comerciante ─── */
document.addEventListener('click', (e) => {
  const merchantTabBtn = e.target.closest('aside button[data-action="set-merchant-tab"]');
  if (merchantTabBtn) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});