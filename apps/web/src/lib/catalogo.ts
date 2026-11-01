import { api, type Categoria } from './api-client';

// Las categorías cambian muy poco: se piden una vez por visita y se comparten.
let categorias: Promise<Categoria[]> | null = null;

export function obtenerCategorias() {
  categorias ??= api<Categoria[]>('/catalog/categorias').catch((e) => {
    categorias = null;
    throw e;
  });
  return categorias;
}

/** Hijas de cada categoría (las raíces bajo la clave ''), en el orden del menú. */
export function hijasPorPadre(lista: Categoria[]) {
  const mapa = new Map<string, Categoria[]>();
  for (const c of lista) {
    const clave = c.padre_id ?? '';
    mapa.set(clave, [...(mapa.get(clave) ?? []), c]);
  }
  return mapa;
}

export const enlaceCategoria = (id: string) => `/buscar?categoria=${id}`;
