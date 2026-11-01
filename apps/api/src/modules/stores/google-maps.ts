import { Prisma } from '@prisma/client';
import { llamar, prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';

export interface LugarGoogle {
  placeId: string;
  nombre: string;
  /** Calle y altura, para el campo "Dirección del local". */
  direccion: string;
  direccionCompleta: string;
  localidad: { id: string; nombre: string; provincia: string } | null;
  telefono: { pais: string; numero: string; tipo: 'fijo' } | null;
  ubicacion: { lat: number; lng: number };
  mapsUrl: string | null;
}

interface ComponenteGoogle {
  longText: string;
  types: string[];
}

interface LugarApi {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  addressComponents?: ComponenteGoogle[];
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
}

const CAMPOS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.addressComponents',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.googleMapsUri',
].join(',');

const ENLACES_CORTOS = ['maps.app.goo.gl', 'goo.gl'];
const esDominioGoogle = (host: string) => /^(www\.|maps\.)?google\.[a-z.]{2,6}$/.test(host);

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(departamento|partido|municipio|provincia) (de )?/, '')
    .replace(/ (province|provincia)$/, '')
    .trim();

/** Sigue un enlace corto de Google Maps (maps.app.goo.gl) hasta la dirección larga, sin salir de Google. */
async function expandir(url: URL): Promise<URL> {
  let actual = url;
  for (let i = 0; i < 3 && ENLACES_CORTOS.includes(actual.hostname); i++) {
    const res = await fetch(actual, { redirect: 'manual' });
    const destino = res.headers.get('location');
    if (!destino) break;
    actual = new URL(destino, actual);
  }
  if (!esDominioGoogle(actual.hostname)) {
    throw new AppError('Pegá un enlace de Google Maps (por ejemplo, el de "Compartir")', 400);
  }
  return actual;
}

/** Del enlace de Google Maps saca el nombre del lugar y sus coordenadas, si las tiene. */
async function interpretar(q: string): Promise<{ texto: string; cerca?: { lat: number; lng: number } }> {
  let url: URL;
  try {
    url = new URL(q);
  } catch {
    return { texto: q };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { texto: q };
  if (!ENLACES_CORTOS.includes(url.hostname) && !esDominioGoogle(url.hostname)) {
    throw new AppError('Pegá un enlace de Google Maps (por ejemplo, el de "Compartir")', 400);
  }
  url = await expandir(url);

  const coordenadas = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const cerca = coordenadas ? { lat: Number(coordenadas[1]), lng: Number(coordenadas[2]) } : undefined;
  const lugar = url.pathname.match(/\/place\/([^/]+)/)?.[1];
  const texto =
    (lugar && decodeURIComponent(lugar.replace(/\+/g, ' '))) ||
    url.searchParams.get('q') ||
    url.searchParams.get('query') ||
    '';
  if (!texto.trim()) {
    throw new AppError('Ese enlace no indica un local. En Google Maps abrí el local y usá "Compartir"', 400);
  }
  return { texto: texto.trim(), cerca };
}

function telefonoDe(lugar: LugarApi): LugarGoogle['telefono'] {
  const internacional = lugar.internationalPhoneNumber?.match(/^(\+\d{1,4})\s+(.+)$/);
  if (internacional) {
    return { pais: internacional[1], numero: internacional[2].replace(/[^\d ()-]/g, '').trim(), tipo: 'fijo' };
  }
  const nacional = lugar.nationalPhoneNumber?.replace(/[^\d ()-]/g, '').replace(/^0/, '').trim();
  return nacional ? { pais: '+54', numero: nacional, tipo: 'fijo' } : null;
}

function direccionDe(lugar: LugarApi) {
  const comp = (tipo: string) => lugar.addressComponents?.find((c) => c.types.includes(tipo))?.longText;
  const calle = [comp('route'), comp('street_number')].filter(Boolean).join(' ');
  return calle || lugar.shortFormattedAddress || lugar.formattedAddress || '';
}

/** Busca la localidad de la plataforma que corresponde a la dirección de Google. */
function localidadDe(lugar: LugarApi, localidades: { id: string; nombre: string; provincia: string }[]) {
  const comps = lugar.addressComponents ?? [];
  const provincia = comps.find((c) => c.types.includes('administrative_area_level_1'))?.longText;
  const candidatas = comps
    .filter((c) =>
      ['locality', 'administrative_area_level_2', 'administrative_area_level_3', 'sublocality'].some((t) =>
        c.types.includes(t)
      )
    )
    .map((c) => normalizar(c.longText));
  const enProvincia = provincia
    ? localidades.filter((l) => normalizar(l.provincia) === normalizar(provincia))
    : localidades;
  for (const nombre of candidatas) {
    const encontrada = enProvincia.find((l) => normalizar(l.nombre) === nombre);
    if (encontrada) return encontrada;
  }
  return null;
}

/**
 * Busca el local en Google Maps (Places API, búsqueda por texto) para completar
 * el alta: nombre, dirección, localidad, teléfono y ubicación en el mapa.
 */
export async function buscarEnGoogleMaps(q: string): Promise<LugarGoogle[]> {
  if (!env.GOOGLE_MAPS_API_KEY) throw new AppError('La importación desde Google Maps no está habilitada', 404);

  const { texto, cerca } = await interpretar(q.trim());
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': CAMPOS,
    },
    body: JSON.stringify({
      textQuery: texto,
      languageCode: 'es',
      regionCode: 'AR',
      pageSize: 5,
      ...(cerca && { locationBias: { circle: { center: { latitude: cerca.lat, longitude: cerca.lng }, radius: 500 } } }),
    }),
  });
  if (!res.ok) {
    console.error('Google Maps respondió', res.status, await res.text().catch(() => ''));
    throw new AppError('Google Maps no respondió. Probá de nuevo en unos minutos', 502);
  }

  const { places = [] } = (await res.json()) as { places?: LugarApi[] };
  const localidades = await llamar<{ id: string; nombre: string; provincia: string }[]>(
    prisma,
    Prisma.sql`select pkg_ubicacion.localidades() as r`
  );

  return places
    .filter((p) => p.location)
    .map((p) => ({
      placeId: p.id,
      nombre: p.displayName?.text ?? texto,
      direccion: direccionDe(p),
      direccionCompleta: p.formattedAddress ?? '',
      localidad: localidadDe(p, localidades),
      telefono: telefonoDe(p),
      ubicacion: { lat: p.location!.latitude, lng: p.location!.longitude },
      mapsUrl: p.googleMapsUri ?? null,
    }));
}
