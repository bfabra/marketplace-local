// Datos de demostración para desarrollo: 11 comercios en distintas localidades (3 propios y los 8 de la
// maqueta del diseñador, con sus fotos de Unsplash), productos con fotos, cuentas del equipo (moderación
// y logística) y una de comprador. Todas usan la contraseña Demo1234.
// Uso (con el API levantado): npm run db:demo        → crea los datos (si ya están, suma las cuentas
//                                                      del equipo y los comercios que falten)
//                             npm run db:demo:limpiar → borra comercios, cuentas, pedidos y fotos de demo
// Los altas pasan por el API (mismas validaciones que la web); solo los roles de plataforma y la limpieza
// tocan la base directo, porque son herramientas de desarrollo.
import { deflateSync } from 'node:zlib';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { UPLOADS_DIR } from '../common/utils/images.js';

const API = process.env.DEMO_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
const PATRON_EMAIL = 'demo\\_%@prueba.com';
const CLAVE = 'Demo1234';

// Corta el script con un mensaje. No usa process.exit: en Windows, cerrar el proceso
// a la fuerza con conexiones de fetch abiertas lo hace fallar.
class Salida extends Error {
  constructor(mensaje: string, public codigo: number) {
    super(mensaje);
  }
}
const salir = (mensaje: string, codigo = 1): never => {
  throw new Salida(mensaje, codigo);
};

if (process.env.NODE_ENV === 'production') {
  console.log('Los datos de demostración son solo para desarrollo.');
  process.exit(1);
}

// ---------- Fotos: PNG con degradado y una forma, generadas sin dependencias ----------
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (tipo: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(tipo), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function png(c1: string, c2: string, c3: string, forma: 'circulo' | 'cuadrado' = 'circulo') {
  const W = 480;
  const [a, b, c] = [hex(c1), hex(c2), hex(c3)];
  const filas: Buffer[] = [];
  for (let y = 0; y < W; y++) {
    const fila = Buffer.alloc(1 + W * 3);
    for (let x = 0; x < W; x++) {
      const t = (x + y) / (2 * W);
      let px = a.map((v, i) => Math.round(v + (b[i] - v) * t));
      const dx = x - W / 2;
      const dy = y - W / 2 - 10;
      const dentro =
        forma === 'circulo' ? dx * dx + dy * dy < (W * 0.28) ** 2 : Math.abs(dx) < W * 0.24 && Math.abs(dy) < W * 0.3;
      if (dentro) px = c;
      else if (forma === 'circulo' && Math.abs(dy - W * 0.3) < 8 && Math.abs(dx) < W * 0.2) px = px.map((v) => v * 0.8);
      fila.set(px, 1 + x * 3);
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(W, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(filas))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Fotos de la maqueta (docs/diseno/js/data.js), de Unsplash ----------
const unsplash = async (id: string, ancho: number) => {
  const url = `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=${ancho}`;
  const res = await fetch(url).catch(() =>
    salir(`No se pudo descargar la foto ${id} de Unsplash. ¿Hay conexión a internet?`)
  );
  if (!res.ok) throw new Error(`Unsplash ${id} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

/** Una foto: PNG generado o el id de una foto de Unsplash (JPG). */
type Foto = Buffer | string;
const archivo = async (foto: Foto, ancho: number) =>
  typeof foto === 'string'
    ? new Blob([new Uint8Array(await unsplash(foto, ancho))], { type: 'image/jpeg' })
    : new Blob([new Uint8Array(foto)], { type: 'image/png' });

// ---------- HTTP ----------
async function req<T = any>(
  ruta: string,
  opts: { method?: string; cookie?: string; body?: unknown; form?: FormData } = {}
): Promise<{ data: T; cookie: string }> {
  const method = opts.method ?? (opts.body || opts.form ? 'POST' : 'GET');
  const res = await fetch(API + ruta, {
    method,
    headers: {
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
  }).catch(() => salir(`No se pudo conectar con el API en ${API}. ¿Está levantado (npm run dev)?`));
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${ruta} → ${res.status} ${JSON.stringify(data)}`);
  return { data, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] };
}

const cuenta = async (email: string, nombre: string, apellido: string) =>
  (await req('/auth/register', { body: { email, password: CLAVE, nombre, apellido } })).cookie;

/** CUIT válido (dígito verificador de AFIP) a partir de 10 dígitos que se ajustan hasta que cierre. */
function cuit(base: string) {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 100; i++) {
    const d = base.slice(0, 8) + String(i).padStart(2, '0');
    const suma = pesos.reduce((acc, p, k) => acc + p * Number(d[k]), 0);
    const v = (11 - (suma % 11)) % 11;
    if (v !== 10) return d + v;
  }
  throw new Error('No se pudo generar el CUIT');
}

// ---------- Datos ----------
type Opcion = { atributo: string; valor: string };
type Variante = { opciones?: Opcion[]; precio: number; precio_oferta?: number; stock: number };
type Producto = {
  categoria: string;
  nombre: string;
  descripcion: string;
  variantes: Variante[];
  fotos: Foto[];
  material?: string;
};
type Tienda = {
  slug: string;
  nombre: string;
  descripcion: string;
  localidad: string;
  direccion: string;
  telefono: string;
  cuit: string;
  rubro: string;
  subrubro?: string;
  /** Id de la foto de Unsplash para la portada. */
  portada?: string;
  productos: Producto[];
};

const TIENDAS: Tienda[] = [
  {
    slug: 'raices',
    nombre: 'Raíces Deco',
    descripcion:
      'Somos una familia de artesanos de Capital. Hacemos piezas de cerámica, madera de algarrobo y textiles con técnicas que aprendimos de nuestros abuelos.',
    localidad: 'Capital',
    direccion: 'Mendoza 1240 (sur)',
    telefono: '264 455-1020',
    cuit: '30718800',
    rubro: 'regalos-y-artesanias',
    subrubro: 'artesanias',
    portada: 'photo-1618220179428-22790b461013',
    productos: [
      { categoria: '/hogar-y-decoracion/decoracion/', nombre: 'Lámpara de cerámica artesanal', descripcion: 'Torneada y esmaltada a mano. Cada pieza es única.', variantes: [{ precio: 38000, precio_oferta: 31500, stock: 6 }], fotos: [png('#f4e3d7', '#e8c6a8', '#b5651d'), png('#efe6dc', '#d9c2a7', '#8a4b1a')] },
      { categoria: '/hogar-y-decoracion/decoracion/', nombre: 'Set de 3 macetas de barro', descripcion: 'Barro cocido de Albardón, con plato.', variantes: [{ precio: 15900, stock: 14 }], fotos: [png('#f1ece4', '#d8cbb8', '#a0522d', 'cuadrado')] },
      { categoria: '/hogar-y-decoracion/muebles/', nombre: 'Mesa ratona de algarrobo', descripcion: 'Madera maciza estacionada, terminación con aceite natural. 90 × 50 cm.', variantes: [{ precio: 185000, stock: 2 }], fotos: [png('#ece4d6', '#cdb894', '#6b4423', 'cuadrado')] },
      { categoria: '/hogar-y-decoracion/decoracion/', nombre: 'Manta tejida en telar', descripcion: 'Lana de oveja hilada a mano, 1,40 × 2 m.', variantes: [{ precio: 62000, precio_oferta: 54900, stock: 4 }], fotos: [png('#e9eef4', '#c4d3e6', '#2f5d8a')] },
      { categoria: '/hogar-y-decoracion/decoracion/', nombre: 'Espejo con marco de madera recuperada', descripcion: 'Marco de madera de pallets recuperados. 60 cm de diámetro.', variantes: [{ precio: 47000, stock: 3 }], fotos: [] },
    ],
  },
  {
    slug: 'tejidos',
    nombre: 'Tejidos del Valle',
    descripcion:
      'Taller textil de Rawson. Diseñamos y cosemos prendas en tandas chicas, con telas nobles y pagando precios justos a nuestras costureras.',
    localidad: 'Rawson',
    direccion: 'Av. España 3150',
    telefono: '264 512-8830',
    cuit: '30718801',
    rubro: 'indumentaria-y-moda',
    productos: [
      {
        categoria: '/indumentaria-y-calzado/ropa-de-mujer/',
        nombre: 'Poncho de lana de oveja',
        descripcion: 'Tejido en telar criollo. Abriga sin pesar.',
        material: 'Lana de oveja',
        variantes: [
          { opciones: [{ atributo: 'Color', valor: 'Negro' }, { atributo: 'Talle', valor: 'S' }], precio: 72000, stock: 3 },
          { opciones: [{ atributo: 'Color', valor: 'Negro' }, { atributo: 'Talle', valor: 'M' }], precio: 72000, stock: 2 },
          { opciones: [{ atributo: 'Color', valor: 'Blanco' }, { atributo: 'Talle', valor: 'M' }], precio: 72000, stock: 0 },
        ],
        fotos: [png('#f5efe9', '#e2d3c4', '#3b3b3b'), png('#f5efe9', '#e2d3c4', '#f8f8f8')],
      },
      {
        categoria: '/indumentaria-y-calzado/ropa-de-hombre/',
        nombre: 'Camisa de lino',
        descripcion: 'Lino 100 %, corte recto y botones de coco.',
        material: 'Lino',
        variantes: [
          { opciones: [{ atributo: 'Color', valor: 'Blanco' }, { atributo: 'Talle', valor: 'M' }], precio: 44000, precio_oferta: 37400, stock: 5 },
          { opciones: [{ atributo: 'Color', valor: 'Azul' }, { atributo: 'Talle', valor: 'L' }], precio: 44000, precio_oferta: 37400, stock: 4 },
        ],
        fotos: [png('#eef2f6', '#cfd9e4', '#2c4a6e', 'cuadrado')],
      },
      {
        categoria: '/indumentaria-y-calzado/ropa-infantil/',
        nombre: 'Buzo de algodón para chicos',
        descripcion: 'Frisa de algodón peinado, suave y resistente.',
        variantes: [{ opciones: [{ atributo: 'Color', valor: 'Rojo' }, { atributo: 'Talle', valor: 'S' }], precio: 21000, stock: 9 }],
        fotos: [png('#fdecea', '#f6c9c3', '#c0392b', 'cuadrado')],
      },
      {
        categoria: '/indumentaria-y-calzado/calzado-de-mujer/',
        nombre: 'Alpargatas bordadas',
        descripcion: 'Yute y lona con bordado hecho a mano.',
        variantes: [
          { opciones: [{ atributo: 'Color', valor: 'Azul' }, { atributo: 'Talle', valor: '37' }], precio: 19500, stock: 6 },
          { opciones: [{ atributo: 'Color', valor: 'Azul' }, { atributo: 'Talle', valor: '38' }], precio: 19500, stock: 6 },
          { opciones: [{ atributo: 'Color', valor: 'Rojo' }, { atributo: 'Talle', valor: '39' }], precio: 19500, stock: 2 },
        ],
        fotos: [png('#eef1f8', '#cdd6ea', '#34495e')],
      },
    ],
  },
  {
    slug: 'tecnosur',
    nombre: 'TecnoSur',
    descripcion: 'Tecnología y servicio técnico en Chimbas.',
    localidad: 'Chimbas',
    direccion: 'Calle Mendoza 520 (norte)',
    telefono: '264 600-4411',
    cuit: '30718802',
    rubro: 'electronica-y-tecnologia',
    subrubro: 'computacion',
    productos: [
      { categoria: '/tecnologia-y-electronica/accesorios-para-computacion/', nombre: 'Teclado mecánico retroiluminado', descripcion: 'Switches rojos, distribución en español.', variantes: [{ precio: 58000, stock: 8 }], fotos: [png('#e8ecf2', '#c3ccd9', '#1f2a3a', 'cuadrado')] },
      { categoria: '/tecnologia-y-electronica/accesorios-para-computacion/', nombre: 'Mouse inalámbrico silencioso', descripcion: 'Batería de 12 meses, clic silencioso.', variantes: [{ precio: 16000, precio_oferta: 12900, stock: 20 }], fotos: [png('#eef0f3', '#d5d9e0', '#4a5568')] },
      {
        categoria: '/tecnologia-y-electronica/celulares/',
        nombre: 'Celular reacondicionado con garantía',
        descripcion: 'Revisado por nuestro servicio técnico. Garantía de 6 meses.',
        variantes: [
          { opciones: [{ atributo: 'Color', valor: 'Negro' }, { atributo: 'Memoria', valor: '128' }], precio: 289000, stock: 3 },
          { opciones: [{ atributo: 'Color', valor: 'Azul' }, { atributo: 'Memoria', valor: '256' }], precio: 339000, precio_oferta: 319000, stock: 1 },
        ],
        fotos: [png('#e9edf5', '#c6d0e3', '#0a2540', 'cuadrado')],
      },
    ],
  },
  // Los de la maqueta del diseñador. Los tres últimos son los "nuevos" de la portada.
  {
    slug: 'boutique',
    nombre: 'La Boutique',
    descripcion: 'Prendas atemporales, accesorios y asesoramiento cercano para encontrar tu estilo.',
    localidad: 'Capital',
    direccion: 'Rivadavia 340 (oeste)',
    telefono: '264 421-3390',
    cuit: '30718803',
    rubro: 'indumentaria-y-moda',
    subrubro: 'ropa-de-mujer',
    portada: 'photo-1770992255795-95993012028b',
    productos: [
      {
        categoria: '/indumentaria-y-calzado/ropa-de-mujer/',
        nombre: 'Remera básica oversize',
        descripcion: 'Algodón peinado, calce amplio y cuello reforzado.',
        variantes: [
          { opciones: [{ atributo: 'Color', valor: 'Blanco' }, { atributo: 'Talle', valor: 'M' }], precio: 24900, stock: 6 },
          { opciones: [{ atributo: 'Color', valor: 'Negro' }, { atributo: 'Talle', valor: 'L' }], precio: 24900, stock: 6 },
        ],
        fotos: ['photo-1586940069830-04cdba740ba5'],
      },
      {
        categoria: '/indumentaria-y-calzado/calzado-de-mujer/',
        nombre: 'Zapatillas urbanas',
        descripcion: 'Livianas, con plantilla acolchada para todo el día.',
        variantes: [
          { opciones: [{ atributo: 'Color', valor: 'Blanco' }, { atributo: 'Talle', valor: '37' }], precio: 59900, stock: 3 },
          { opciones: [{ atributo: 'Color', valor: 'Blanco' }, { atributo: 'Talle', valor: '38' }], precio: 59900, stock: 3 },
        ],
        fotos: ['photo-1551176693-79c3c1931579'],
      },
      { categoria: '/indumentaria-y-calzado/carteras-y-bolsos/', nombre: 'Bolso camel', descripcion: 'Cuero sintético color camel, con bolsillo interno y cierre.', variantes: [{ precio: 32700, stock: 5 }], fotos: ['photo-1511556820780-d912e42b4980'] },
      {
        categoria: '/indumentaria-y-calzado/abrigos/',
        nombre: 'Campera liviana',
        descripcion: 'Rompeviento con capucha que se guarda en el cuello.',
        variantes: [
          { opciones: [{ atributo: 'Color', valor: 'Negro' }, { atributo: 'Talle', valor: 'M' }], precio: 68400, stock: 2 },
          { opciones: [{ atributo: 'Color', valor: 'Azul' }, { atributo: 'Talle', valor: 'L' }], precio: 68400, stock: 2 },
        ],
        fotos: ['photo-1739384879592-79903b12b2a6'],
      },
    ],
  },
  {
    slug: 'tecnistore',
    nombre: 'TecniStore',
    descripcion: 'Tecnología, accesorios y soluciones simples con atención personalizada.',
    localidad: 'Capital',
    direccion: 'General Acha 820 (sur)',
    telefono: '264 427-5512',
    cuit: '30718804',
    rubro: 'electronica-y-tecnologia',
    subrubro: 'accesorios-tecnologicos',
    portada: 'photo-1785788681696-d69b9f554f79',
    productos: [],
  },
  {
    slug: 'saborcasero',
    nombre: 'Sabor Casero',
    descripcion: 'Cocina artesanal elaborada cada día con ingredientes de productores locales.',
    localidad: 'Rivadavia',
    direccion: 'Av. Libertador 6120 (oeste)',
    telefono: '264 433-8021',
    cuit: '30718805',
    rubro: 'alimentos-y-bebidas',
    subrubro: 'comida-elaborada-gastronomia',
    portada: 'photo-1761897526055-cd1df45f49ad',
    productos: [],
  },
  {
    slug: 'clubnorte',
    nombre: 'Club Norte',
    descripcion: 'Equipamiento y prendas para moverte todos los días.',
    localidad: 'Chimbas',
    direccion: 'Av. Benavídez 1450 (oeste)',
    telefono: '264 441-2276',
    cuit: '30718806',
    rubro: 'deportes-y-recreacion',
    subrubro: 'indumentaria-deportiva',
    portada: 'photo-1768180316485-2c7306ab38ff',
    productos: [],
  },
  {
    slug: 'mesalocal',
    nombre: 'Mesa Local',
    descripcion: 'Productos regionales y experiencias gastronómicas de cercanía.',
    localidad: 'Pocito',
    direccion: 'Calle 5 y Mendoza',
    telefono: '264 492-1180',
    cuit: '30718807',
    rubro: 'alimentos-y-bebidas',
    portada: 'photo-1785785041210-8c31c0b1ccc5',
    productos: [],
  },
  {
    slug: 'casadeco',
    nombre: 'Casa & Deco',
    descripcion: 'Objetos cálidos para transformar cada rincón de tu casa.',
    localidad: 'Santa Lucía',
    direccion: 'Av. Libertador 2350 (este)',
    telefono: '264 425-6630',
    cuit: '30718808',
    rubro: 'hogar-y-decoracion',
    subrubro: 'decoracion',
    portada: 'photo-1565382073974-9d123c621ea8',
    productos: [
      { categoria: '/hogar-y-decoracion/decoracion/', nombre: 'Maceta minimal', descripcion: 'Cerámica mate con plato, ideal para plantas de interior.', variantes: [{ precio: 18900, stock: 10 }], fotos: ['photo-1585545558198-6b443f90f2d0'] },
    ],
  },
  {
    slug: 'esencia',
    nombre: 'Esencia Natural',
    descripcion: 'Cosmética consciente y productos de cuidado personal seleccionados.',
    localidad: 'Capital',
    direccion: 'Laprida 510 (este)',
    telefono: '264 420-7745',
    cuit: '30718809',
    rubro: 'salud-y-cuidado-personal',
    subrubro: 'cosmetica',
    portada: 'photo-1783282627922-23f235eac33a',
    productos: [
      { categoria: '/salud-belleza-y-cuidado-personal/cuidado-facial/', nombre: 'Set de cuidado diario', descripcion: 'Limpiador, tónico y crema hidratante con ingredientes naturales.', variantes: [{ precio: 21500, stock: 8 }], fotos: ['photo-1685527645763-2cd1b47a2cd2'] },
    ],
  },
  {
    slug: 'puntofirme',
    nombre: 'Punto Firme',
    descripcion: 'Herramientas, materiales y asesoramiento para concretar tus proyectos.',
    localidad: 'Rawson',
    direccion: 'Av. España 4820 (sur)',
    telefono: '264 528-3304',
    cuit: '30718810',
    rubro: 'ferreteria-construccion-y-herramientas',
    subrubro: 'herramientas',
    portada: 'photo-1783275463499-995361d01289',
    productos: [],
  },
];

type Atributo = { id: string; nombre: string; opciones: { id: string; valor: string }[] };

const EQUIPO = [
  { email: 'demo_moderacion@prueba.com', apellido: 'Moderación', rol: 'moderacion' },
  { email: 'demo_logistica@prueba.com', apellido: 'Logística', rol: 'logistica' },
  { email: 'demo_soporte@prueba.com', apellido: 'Soporte', rol: 'soporte' },
  { email: 'demo_finanzas@prueba.com', apellido: 'Finanzas', rol: 'finanzas' },
];

/** Cuentas del equipo de la plataforma. Devuelve las que creó. */
async function equipoPlataforma() {
  const nuevas: string[] = [];
  for (const e of EQUIPO) {
    const ya = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from auth.users where email = ${e.email}`;
    if (Number(ya[0].n) === 0) {
      await cuenta(e.email, 'Demo', e.apellido);
      nuevas.push(e.email);
    }
    await prisma.$executeRaw`insert into public.roles_plataforma (usuario_id, rol)
      select id, ${e.rol}::public.rol_plataforma from auth.users where email = ${e.email}
      on conflict (usuario_id, rol) do nothing`;
  }
  return nuevas;
}

async function crear() {
  const existentes = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from auth.users where email like ${PATRON_EMAIL}`;
  const yaCargados = Number(existentes[0].n) > 0;
  // Se reconocen por el nombre en el listado público: así se suman las que se agregaron al script
  // y se completan las que quedaron a medias (sin portada o sin todos sus productos).
  type Activa = { id: string; nombre: string; portada: string | null; productos: number };
  const { data: activas } = await req<Activa[]>('/catalog/tiendas');
  const activaDe = (t: Tienda) => activas.find((a) => a.nombre === t.nombre);
  const faltan = TIENDAS.filter((t) => {
    const a = activaDe(t);
    return !a || (t.portada && !a.portada) || a.productos < t.productos.length;
  });
  if (yaCargados) {
    const nuevas = await equipoPlataforma();
    if (nuevas.length) console.log(`✓ Cuentas del equipo agregadas: ${nuevas.join(', ')} (contraseña ${CLAVE})`);
    if (faltan.length === 0) {
      salir('Los datos de demostración ya están cargados. Para recrearlos: npm run db:demo:limpiar y después npm run db:demo.', 0);
    }
  }

  const { data: categorias } = await req<{ id: string; ruta: string }[]>('/catalog/categorias');
  const { data: localidades } = await req<{ id: string; nombre: string }[]>('/locations/localidades');
  type RubroLista = { id: string; slug: string; subrubros: { id: string; slug: string }[] };
  const { data: rubros } = await req<RubroLista[]>('/catalog/rubros');
  const rubroDe = (t: Tienda) => {
    const r = rubros.find((x) => x.slug === t.rubro);
    if (!r) throw new Error(`Falta el rubro ${t.rubro}`);
    return { rubro_id: r.id, subrubro_id: r.subrubros.find((s) => s.slug === t.subrubro)?.id ?? null };
  };
  const categoriaId = (ruta: string) => {
    const c = categorias.find((x) => x.ruta === ruta);
    if (!c) throw new Error(`Falta la categoría ${ruta} (¿están aplicadas todas las migraciones? npm run db:local)`);
    return c.id;
  };
  const localidadId = (nombre: string) => {
    const l = localidades.find((x) => x.nombre === nombre);
    if (!l) throw new Error(`Falta la localidad ${nombre}`);
    return l.id;
  };
  const atributosDe = new Map<string, Atributo[]>();
  const atributos = async (catId: string) => {
    if (!atributosDe.has(catId)) atributosDe.set(catId, (await req<Atributo[]>(`/catalog/categorias/${catId}/atributos`)).data);
    return atributosDe.get(catId)!;
  };

  if (!yaCargados) await equipoPlataforma();
  const { cookie: moderacion } = await req('/auth/login', {
    body: { email: 'demo_moderacion@prueba.com', password: CLAVE },
  });
  if (!yaCargados) await cuenta('demo_comprador@prueba.com', 'Lucía', 'Compradora');

  // Las tiendas nuevas mandan sus primeros productos a revisión. Moderación aprueba casi todos y
  // deja el último de las dos primeras tiendas esperando, para que la cola tenga algo que mostrar.
  const enEspera: string[] = [];

  for (const [i, t] of faltan.entries()) {
    const email = `demo_${t.slug}@prueba.com`;
    const activa = activaDe(t);
    const enRevision: string[] = [];
    let duenio: string;
    let tiendaId: string;
    let yaTiene: string[] = [];
    if (activa) {
      duenio = (await req('/auth/login', { body: { email, password: CLAVE } })).cookie;
      tiendaId = activa.id;
      const { data: listado } = await req<{ productos: { nombre: string }[] }>(`/stores/${tiendaId}/products`, {
        cookie: duenio,
      });
      yaTiene = listado.productos.map((p) => p.nombre);
    } else {
      duenio = await cuenta(email, t.nombre.split(' ')[0], 'Demo');
      const { data: tienda } = await req('/stores', {
        cookie: duenio,
        body: {
          nombre: t.nombre,
          descripcion: t.descripcion,
          cuit: cuit(t.cuit),
          telefono: t.telefono,
          localidad_id: localidadId(t.localidad),
          direccion: t.direccion,
          ...rubroDe(t),
        },
      });
      tiendaId = tienda.id ?? tienda.tienda?.id;
      await req(`/stores/${tiendaId}/mercadopago/prueba`, { cookie: duenio, method: 'POST' });
      await req(`/admin/stores/${tiendaId}/estado`, { cookie: moderacion, method: 'PATCH', body: { estado: 'activa' } });
    }
    if (t.portada && !activa?.portada) {
      const form = new FormData();
      form.append('foto', await archivo(t.portada, 1200), 'portada.jpg');
      await req(`/stores/${tiendaId}/imagen/portada`, { cookie: duenio, form });
    }

    for (const p of t.productos) {
      if (yaTiene.includes(p.nombre)) continue;
      const catId = categoriaId(p.categoria);
      const attrs = await atributos(catId);
      const atributo = (nombre: string) => {
        const a = attrs.find((x) => x.nombre === nombre);
        if (!a) throw new Error(`La categoría ${p.categoria} no tiene el atributo ${nombre}`);
        return a;
      };
      const variantes = p.variantes.map((v) => ({
        ...v,
        opciones: (v.opciones ?? []).map((o) => {
          const a = atributo(o.atributo);
          const opcion = a.opciones.find((x) => x.valor === o.valor);
          if (!opcion) throw new Error(`El atributo ${o.atributo} no tiene la opción ${o.valor}`);
          return { atributo_id: a.id, opcion_id: opcion.id };
        }),
      }));
      const material = p.material ? [{ atributo_id: atributo('Material').id, valor_texto: p.material }] : [];

      const { data: prod } = await req(`/stores/${tiendaId}/products`, {
        cookie: duenio,
        body: { categoria_id: catId, nombre: p.nombre, descripcion: p.descripcion, atributos: material, variantes },
      });
      const productoId: string = prod.id ?? prod.producto?.id;
      if (p.fotos.length) {
        const form = new FormData();
        for (const [k, f] of p.fotos.entries()) {
          form.append('fotos', await archivo(f, 800), typeof f === 'string' ? `foto${k}.jpg` : `foto${k}.png`);
        }
        await req(`/stores/${tiendaId}/products/${productoId}/imagenes`, { cookie: duenio, form });
      }
      const { data: estado } = await req<{ motivo_pausa: string | null }>(
        `/stores/${tiendaId}/products/${productoId}/estado`,
        { cookie: duenio, method: 'PATCH', body: { estado: 'publicado' } }
      );
      if (estado.motivo_pausa === 'revision') enRevision.push(productoId);
    }
    const esperar = !yaCargados && i < 2 ? enRevision.pop() : undefined;
    if (esperar) enEspera.push(esperar);
    for (const productoId of enRevision) {
      await req(`/admin/products/${productoId}/moderacion`, { cookie: moderacion, body: { accion: 'aprobar' } });
    }
    const n = t.productos.length;
    const accion = activa ? 'completada' : `${n} ${n === 1 ? 'producto' : 'productos'}`;
    console.log(`✓ ${t.nombre} (${t.localidad}): ${accion} — ${email}`);
  }

  if (enEspera.length) console.log(`✓ ${enEspera.length} productos esperando revisión en /admin/productos`);
  console.log(
    '✓ Moderación: demo_moderacion@prueba.com · Logística: demo_logistica@prueba.com · Comprador: demo_comprador@prueba.com'
  );
  console.log('✓ Soporte: demo_soporte@prueba.com · Finanzas: demo_finanzas@prueba.com');
  console.log(`Contraseña de todas las cuentas: ${CLAVE}`);
}

async function limpiar() {
  const tiendas = await prisma.$queryRaw<{ id: string }[]>`
    select t.id from public.tiendas t join auth.users u on u.id = t.propietario_id where u.email like ${PATRON_EMAIL}`;
  const ids = tiendas.map((t) => t.id);

  // Pedidos hechos por las cuentas demo o a sus comercios (el resto de las tablas del pedido cae en cascada).
  const pedidos = await prisma.$executeRaw`
    delete from public.pedidos p
     where p.comprador_id in (select id from auth.users where email like ${PATRON_EMAIL})
        or exists (select 1 from public.pedidos_tienda pt where pt.pedido_id = p.id and pt.tienda_id = any(${ids}::uuid[]))`;
  await prisma.$executeRaw`delete from public.tiendas where id = any(${ids}::uuid[])`;
  const cuentas = await prisma.$executeRaw`delete from auth.users where email like ${PATRON_EMAIL}`;
  for (const id of ids) await rm(path.join(UPLOADS_DIR, 'tiendas', id), { recursive: true, force: true });

  console.log(`Limpieza: ${ids.length} comercios, ${pedidos} pedidos y ${cuentas} cuentas de demostración borrados.`);
}

try {
  await (process.argv.includes('--limpiar') ? limpiar() : crear());
  console.log('Listo.');
} catch (error) {
  if (error instanceof Salida) {
    console.log(error.message);
    process.exitCode = error.codigo;
  } else {
    console.log(
      `${error instanceof Error ? error.message : String(error)}\nSi quedó a medias, corré npm run db:demo:limpiar y volvé a intentar.`
    );
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
