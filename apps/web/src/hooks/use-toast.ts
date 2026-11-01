'use client';

import { createContext, useContext } from 'react';

export interface Aviso {
  tipo?: 'exito' | 'error' | 'info';
  titulo: string;
  texto?: string;
  accion?: { href: string; label: string };
}

export const ToastContext = createContext<((aviso: Aviso) => void) | null>(null);

/** Muestra un aviso breve que se cierra solo. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
