'use client';

import { createContext, useContext } from 'react';
import type { Localidad } from '@/lib/api-client';

export interface LocationContextValue {
  localidades: Localidad[];
  /** null = todas las localidades */
  localidad: Localidad | null;
  /** "Todo San Juan" si todas las localidades son de la misma provincia */
  etiquetaTodas: string;
  /** Nombre de la zona completa para textos: "San Juan", o "tu ciudad" si hay varias provincias */
  zonaTodas: string;
  /** Ya se resolvió la localidad guardada (evita pedir la portada dos veces al cargar) */
  listo: boolean;
  elegir: (localidadId: string | null) => void;
}

export const LocationContext = createContext<LocationContextValue | null>(null);

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation debe usarse dentro de <LocationProvider>');
  return ctx;
}
