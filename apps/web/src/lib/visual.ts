import type { IconName } from '@/components/ui/icon';

export interface Tono {
  /** Fondo suave */
  bg: string;
  /** Ícono y texto sobre el fondo suave (contraste AA) */
  fg: string;
}

const TONOS: Tono[] = [
  { bg: '#fff1e6', fg: '#b44400' },
  { bg: '#e8f1fb', fg: '#1d4ed8' },
  { bg: '#e9f8ef', fg: '#15803d' },
  { bg: '#f3edfd', fg: '#6d28d9' },
  { bg: '#fdecef', fg: '#be123c' },
  { bg: '#e6f6f7', fg: '#0f766e' },
];

// Rubros de la lista estándar y categorías principales conocidas; los nuevos
// toman un tono y el ícono genérico.
const CATEGORIAS: Record<string, { icono: IconName; tono: number }> = {
  'alimentos-y-bebidas': { icono: 'leaf', tono: 2 },
  'indumentaria-y-calzado': { icono: 'shirt', tono: 0 },
  'tecnologia-y-electronica': { icono: 'smartphone', tono: 1 },
  electrodomesticos: { icono: 'home', tono: 5 },
  'automotor-y-motocicletas': { icono: 'car', tono: 1 },
  'salud-belleza-y-cuidado-personal': { icono: 'pill', tono: 4 },
  'deportes-y-aire-libre': { icono: 'bike', tono: 5 },
  'mascotas-y-animales': { icono: 'paw', tono: 3 },
  'libreria-papeleria-y-oficina': { icono: 'book', tono: 1 },
  'juguetes-bebes-y-ninos': { icono: 'star', tono: 3 },
  'regalos-artesanias-y-personalizados': { icono: 'gift', tono: 4 },
  'jardineria-viveros-y-agricultura': { icono: 'leaf', tono: 5 },
  'productos-regionales-y-produccion-local': { icono: 'mountain', tono: 0 },
  'industria-y-empresas': { icono: 'factory', tono: 1 },
  'turismo-y-actividades': { icono: 'plane', tono: 2 },
  'indumentaria-y-moda': { icono: 'shirt', tono: 0 },
  'hogar-y-decoracion': { icono: 'sofa', tono: 5 },
  'electronica-y-tecnologia': { icono: 'smartphone', tono: 1 },
  'ferreteria-construccion-y-herramientas': { icono: 'wrench', tono: 0 },
  automotor: { icono: 'car', tono: 1 },
  'salud-y-cuidado-personal': { icono: 'pill', tono: 4 },
  'deportes-y-recreacion': { icono: 'bike', tono: 5 },
  mascotas: { icono: 'paw', tono: 3 },
  'libreria-educacion-y-oficina': { icono: 'book', tono: 1 },
  'juguetes-y-ninos': { icono: 'star', tono: 3 },
  'regalos-y-artesanias': { icono: 'gift', tono: 4 },
  servicios: { icono: 'briefcase', tono: 5 },
  'industria-y-comercio': { icono: 'factory', tono: 1 },
  'turismo-y-experiencias': { icono: 'plane', tono: 2 },
  'musica-fiestas-y-recreacion': { icono: 'music', tono: 3 },
  alquileres: { icono: 'key', tono: 0 },
  indumentaria: { icono: 'shirt', tono: 0 },
  tecnologia: { icono: 'smartphone', tono: 1 },
  hogar: { icono: 'sofa', tono: 2 },
  alimentos: { icono: 'leaf', tono: 2 },
  almacen: { icono: 'leaf', tono: 2 },
  artesanias: { icono: 'sparkles', tono: 3 },
  regionales: { icono: 'mountain', tono: 0 },
  belleza: { icono: 'heart', tono: 4 },
};

const hash = (texto: string) => [...texto].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const tonoDe = (clave: string): Tono => TONOS[hash(clave) % TONOS.length];

export function visualCategoria(slug: string | null | undefined): { icono: IconName; tono: Tono } {
  const conocida = slug ? CATEGORIAS[slug] : undefined;
  if (conocida) return { icono: conocida.icono, tono: TONOS[conocida.tono] };
  return { icono: 'tag', tono: tonoDe(slug ?? 'otras') };
}

/** Slug de la categoría principal a partir de la ruta: "/hogar/muebles/" → "hogar". */
export const raizDeRuta = (ruta: string) => ruta.split('/').filter(Boolean)[0] ?? '';

export function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

export function descuento(precio: number | null, oferta: number | null) {
  if (precio === null || oferta === null || precio <= 0) return null;
  const pct = Math.round((1 - oferta / precio) * 100);
  return pct >= 1 ? pct : null;
}

export const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-AR')} ${n === 1 ? uno : varios}`;
