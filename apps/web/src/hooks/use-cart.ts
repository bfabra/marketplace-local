'use client';

import { createContext, useContext } from 'react';
import type { Carrito } from '@/lib/api-client';

export interface CartContextValue {
  carrito: Carrito;
  /** false mientras se carga o se une el carrito del navegador con el guardado. */
  listo: boolean;
  agregar: (varianteId: string, cantidad: number) => Promise<void>;
  cambiar: (varianteId: string, cantidad: number) => Promise<void>;
  quitar: (varianteId: string) => Promise<void>;
  recargar: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
