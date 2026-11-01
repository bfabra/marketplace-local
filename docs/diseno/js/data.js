/* ============================================================
   COMPRALOCAL — DATOS DE DEMOSTRACIÓN Y GEOGRAFÍA DE SAN JUAN
   ============================================================ */
(function () {
  const U = (id, w) =>
    `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=${w}`;

  const photos = {
    storefront: U('photo-1768180316485-2c7306ab38ff', 1600),
    boutique: U('photo-1770992255795-95993012028b', 1200),
    cafe: U('photo-1761897526055-cd1df45f49ad', 1200),
    street: U('photo-1783275463499-995361d01289', 1200),
    flower: U('photo-1783282627922-23f235eac33a', 1200),
    tech: U('photo-1785788681696-d69b9f554f79', 1200),
    restaurant: U('photo-1785785041210-8c31c0b1ccc5', 1200),
    home: U('photo-1565382073974-9d123c621ea8', 1200),
  };

  const productPhotos = [
    'photo-1586940069830-04cdba740ba5',
    'photo-1551176693-79c3c1931579',
    'photo-1511556820780-d912e42b4980',
    'photo-1585545558198-6b443f90f2d0',
    'photo-1685527645763-2cd1b47a2cd2',
    'photo-1739384879592-79903b12b2a6',
  ].map((id) => U(id, 800));

  const categories = [
    {
      id: 'alimentos',
      name: 'Alimentos y bebidas',
      icon: 'food',
      description: 'Almacén, carnicería, panadería y más',
      subcategories: [
        'Almacén', 'Carnicería', 'Fiambrería', 'Panadería y pastelería', 
        'Verdulería y frutería', 'Bebidas', 'Dietética', 'Productos naturales', 'Comida elaborada / gastronomía'
      ]
    },
    {
      id: 'indumentaria',
      name: 'Indumentaria y moda',
      icon: 'shirt',
      description: 'Moda, calzado y accesorios',
      subcategories: [
        'Ropa de mujer', 'Ropa de hombre', 'Ropa unisex', 'Ropa infantil', 'Calzado', 
        'Ropa deportiva', 'Lencería', 'Accesorios y bijouterie', 'Bolsos y carteras'
      ]
    },
    {
      id: 'hogar',
      name: 'Hogar y decoración',
      icon: 'home',
      description: 'Deco, muebles y bazar',
      subcategories: [
        'Muebles', 'Decoración', 'Iluminación', 'Cocina', 
        'Baño', 'Textiles para el hogar', 'Jardinería', 'Organización y almacenamiento'
      ]
    },
    {
      id: 'tecnologia',
      name: 'Electrónica y tecnología',
      icon: 'laptop',
      description: 'Equipos, accesorios y servicio',
      subcategories: [
        'Celulares', 'Computación', 'Accesorios tecnológicos', 'Audio', 'Video', 'Gaming', 'Electrónica general'
      ]
    },
    {
      id: 'ferreteria',
      name: 'Ferretería, construcción y herramientas',
      icon: 'tools',
      description: 'Herramientas y materiales',
      subcategories: [
        'Ferretería', 'Herramientas', 'Materiales de construcción', 'Pinturería', 'Electricidad', 'Plomería', 'Seguridad'
      ]
    },
    {
      id: 'automotor',
      name: 'Automotor',
      icon: 'car',
      description: 'Repuestos, accesorios y movilidad',
      subcategories: [
        'Repuestos', 'Accesorios', 'Neumáticos', 'Lubricantes', 'Audio y electrónica', 'Equipamiento'
      ]
    },
    {
      id: 'salud',
      name: 'Salud y cuidado personal',
      icon: 'sparkle',
      description: 'Perfumería, cosmética y óptica',
      subcategories: [
        'Perfumería', 'Cosmética', 'Higiene personal', 'Óptica', 'Productos para bebés', 'Ortopedia'
      ]
    },
    {
      id: 'deportes',
      name: 'Deportes y recreación',
      icon: 'ball',
      description: 'Indumentaria y equipamiento deportivo',
      subcategories: [
        'Indumentaria deportiva', 'Equipamiento deportivo', 'Fitness', 'Camping y aire libre', 'Bicicletas', 'Juegos y recreación'
      ]
    },
    {
      id: 'mascotas',
      name: 'Mascotas',
      icon: 'pet',
      description: 'Alimentos y accesorios',
      subcategories: [
        'Alimentos', 'Accesorios', 'Higiene', 'Juguetes', 'Veterinaria'
      ]
    },
    {
      id: 'libreria',
      name: 'Librería, educación y oficina',
      icon: 'book',
      description: 'Útiles, papelería y libros',
      subcategories: [
        'Librería', 'Papelería', 'Útiles escolares', 'Oficina', 'Arte y dibujo', 'Libros'
      ]
    },
    {
      id: 'juguetes',
      name: 'Juguetes y niños',
      icon: 'appliances',
      description: 'Juguetes y primera infancia',
      subcategories: [
        'Juguetes', 'Juegos de mesa', 'Bebés', 'Primera infancia', 'Productos infantiles'
      ]
    },
    {
      id: 'regalos',
      name: 'Regalos y artesanías',
      icon: 'sparkle',
      description: 'Regalería y productos regionales',
      subcategories: [
        'Regalería', 'Artesanías', 'Personalizados', 'Souvenirs', 'Productos regionales'
      ]
    },
    {
      id: 'servicios',
      name: 'Servicios',
      icon: 'users',
      description: 'Profesionales, técnicos y reparaciones',
      subcategories: [
        'Servicios profesionales', 'Servicios técnicos', 'Reparaciones', 'Belleza y estética', 'Gastronomía/catering', 'Servicios para eventos', 'Servicios para el hogar'
      ]
    },
    {
      id: 'industria',
      name: 'Industria y comercio',
      icon: 'box',
      description: 'Insumos y equipamiento comercial',
      subcategories: [
        'Insumos industriales', 'Equipamiento comercial', 'Maquinaria', 'Elementos de seguridad', 'Insumos para empresas'
      ]
    },
    {
      id: 'turismo',
      name: 'Turismo y experiencias',
      icon: 'map',
      description: 'Alojamientos y excursiones',
      subcategories: [
        'Alojamientos', 'Excursiones', 'Turismo', 'Actividades recreativas', 'Experiencias'
      ]
    },
    {
      id: 'musica',
      name: 'Música, fiestas y recreación',
      icon: 'music',
      description: 'Instrumentos, cotillón y eventos',
      subcategories: [
        'Instrumentos musicales', 'Accesorios musicales', 'Audio profesional', 'Equipamiento para músicos', 'Cotillón', 'Artículos para fiestas', 'Globos y decoración para eventos', 'Disfraces', 'Piñatas', 'Juegos y recreación', 'Artículos para eventos', 'Accesorios para espectáculos'
      ]
    },
    {
      id: 'alquileres',
      name: 'Alquileres',
      icon: 'shopping',
      description: 'Inmuebles, vehículos, herramientas y más',
      subcategories: [
        'Casas', 'Departamentos', 'Locales comerciales', 'Oficinas', 'Salones para eventos', 'Quintas y fincas', 'Galpones y depósitos', 'Cocheras y estacionamientos', 'Espacios para reuniones',
        'Autos', 'Camionetas', 'Utilitarios', 'Motos', 'Bicicletas', 'Vehículos para eventos', 'Remolques y trailers',
        'Herramientas manuales', 'Herramientas eléctricas', 'Herramientas a batería', 'Maquinaria de construcción', 'Equipos de jardinería', 'Generadores', 'Compresores', 'Andamios y escaleras', 'Equipos para obras',
        'Guitarras y bajos', 'Teclados y pianos', 'Baterías y percusión', 'Instrumentos de viento', 'Equipos de amplificación', 'Micrófonos', 'Consolas de sonido', 'Equipos DJ', 'Equipamiento para bandas',
        'Juegos para fiestas', 'Inflables', 'Metegoles', 'Castillos y plazas blandas', 'Vajilla', 'Mesas y sillas', 'Livings y mobiliario', 'Gazebos y carpas', 'Decoración', 'Iluminación', 'Equipamiento de sonido', 'Máquinas de humo/burbujas', 'Máquinas de pochoclo y copos',
        'Servicio de catering', 'Vajilla y cristalería', 'Equipamiento gastronómico', 'Hornos y cocinas', 'Heladeras y freezers', 'Conservadoras', 'Barras y mobiliario gastronómico', 'Máquinas para eventos',
        'Disfraces', 'Trajes', 'Vestidos', 'Ropa para eventos', 'Vestuario teatral', 'Accesorios y complementos',
        'Equipos deportivos', 'Equipos de camping', 'Carpas', 'Kayaks', 'Cámaras', 'Lentes', 'Trípodes'
      ]
    }
  ];

  const sanJuanLocations = {
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

  const localities = ['Capital', 'Rivadavia', 'Rawson', 'Santa Lucía', 'Pocito', 'Chimbas', 'Albardón', 'Caucete'];

  const stores = [
    { id: 'la-boutique', name: 'La Boutique', category: 'Indumentaria y moda', location: 'Capital, San Juan', description: 'Prendas atemporales, accesorios y asesoramiento cercano para encontrar tu estilo.', image: photos.boutique },
    { id: 'tecnistore', name: 'TecniStore', category: 'Electrónica y tecnología', location: 'Capital, San Juan', description: 'Tecnología, accesorios y soluciones simples con atención personalizada.', image: photos.tech },
    { id: 'sabor-casero', name: 'Sabor Casero', category: 'Alimentos y bebidas', location: 'Rivadavia, San Juan', description: 'Cocina artesanal elaborada cada día con ingredientes de productores locales.', image: photos.cafe },
    { id: 'casa-deco', name: 'Casa & Deco', category: 'Hogar y decoración', location: 'Santa Lucía, San Juan', description: 'Objetos cálidos para transformar cada rincón de tu casa.', image: photos.home, isNew: true },
    { id: 'esencia', name: 'Esencia Natural', category: 'Salud y cuidado personal', location: 'Capital, San Juan', description: 'Cosmética consciente y productos de cuidado personal seleccionados.', image: photos.flower, isNew: true },
    { id: 'punto-firme', name: 'Punto Firme', category: 'Ferretería, construcción y herramientas', location: 'Rawson, San Juan', description: 'Herramientas, materiales y asesoramiento para concretar tus proyectos.', image: photos.street, isNew: true },
    { id: 'club-norte', name: 'Club Norte', category: 'Deportes y recreación', location: 'Chimbas, San Juan', description: 'Equipamiento y prendas para moverte todos los días.', image: photos.storefront },
    { id: 'mesa-local', name: 'Mesa Local', category: 'Alimentos y bebidas', location: 'Pocito, San Juan', description: 'Productos regionales y experiencias gastronómicas de cercanía.', image: photos.restaurant },
  ];

  const products = [
    { id: 'remera-basica', name: 'Remera básica oversize', category: 'Indumentaria', price: 24900, image: productPhotos[0], storeId: 'la-boutique' },
    { id: 'zapatillas-urbanas', name: 'Zapatillas urbanas', category: 'Calzado', price: 59900, image: productPhotos[1], storeId: 'la-boutique' },
    { id: 'bolso-camel', name: 'Bolso camel', category: 'Accesorios', price: 32700, image: productPhotos[2], storeId: 'la-boutique' },
    { id: 'maceta-minimal', name: 'Maceta minimal', category: 'Decoración', price: 18900, image: productPhotos[3], storeId: 'casa-deco' },
    { id: 'set-cuidado', name: 'Set de cuidado diario', category: 'Belleza', price: 21500, image: productPhotos[4], storeId: 'esencia' },
    { id: 'campera-liviana', name: 'Campera liviana', category: 'Indumentaria', price: 68400, image: productPhotos[5], storeId: 'la-boutique' },
  ];

  window.Data = { photos, categories, stores, products, localities, sanJuanLocations };
})();