import type { Usuario } from './api-client';

const ULTIMA_TIENDA = 'tcl:ultima-tienda';

/**
 * Rutas del panel comerciante (#merchant-panel): hero + sidebar dentro del layout market.
 * El alta de comercio es pantalla completa aparte.
 */
export function esModoVendedor(path: string, user: Usuario | null, loading: boolean) {
  if (path.startsWith('/vendor/tiendas/')) return true;
  if (path === '/vendor/nueva-tienda') return false;
  if (path !== '/vendor' && !path.startsWith('/vendor/')) return false;
  return loading || !!user?.tiendas.length;
}

export function recordarTienda(id: string) {
  try {
    localStorage.setItem(ULTIMA_TIENDA, id);
  } catch {
    // Sin almacenamiento (modo privado): «Mi panel» lleva a la lista de tiendas.
  }
}

function ultimaTienda() {
  try {
    return localStorage.getItem(ULTIMA_TIENDA);
  } catch {
    return null;
  }
}

/**
 * Entrada al panel: con una sola tienda, su resumen. Con varias, la última que administró
 * (si se pide recordarla) o la lista para elegir.
 */
export function panelVendedor(user: Usuario | null, { recordar = true } = {}) {
  const tiendas = user?.tiendas ?? [];
  if (tiendas.length === 0) return '/vendor/nueva-tienda';
  if (tiendas.length === 1) return `/vendor/tiendas/${tiendas[0].id}`;
  const ultima = recordar && typeof window !== 'undefined' ? ultimaTienda() : null;
  return tiendas.some((t) => t.id === ultima) ? `/vendor/tiendas/${ultima}` : '/vendor';
}
