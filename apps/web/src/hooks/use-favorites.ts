'use client';

import { createContext, useContext } from 'react';

export interface FavoritesContextValue {
  ids: ReadonlySet<string>;
  listo: boolean;
  /** Guarda o quita el producto. Devuelve true si quedó guardado. */
  alternar: (productoId: string) => Promise<boolean>;
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites debe usarse dentro de <FavoritesProvider>');
  return ctx;
}
