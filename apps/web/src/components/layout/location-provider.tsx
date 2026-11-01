'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Localidad } from '@/lib/api-client';
import { LocationContext } from '@/hooks/use-location';

const CLAVE = 'tcl_localidad';

/** Localidad donde compra el visitante: ordena la portada y filtra la búsqueda. Se recuerda en el navegador. */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [elegida, setElegida] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setElegida(localStorage.getItem(CLAVE));
    api<Localidad[]>('/locations/localidades')
      .then(setLocalidades)
      .catch(() => setLocalidades([]))
      .finally(() => setListo(true));
  }, []);

  const elegir = useCallback((id: string | null) => {
    if (id) localStorage.setItem(CLAVE, id);
    else localStorage.removeItem(CLAVE);
    setElegida(id);
  }, []);

  const value = useMemo(() => {
    const provincias = [...new Set(localidades.map((l) => l.provincia))];
    const unica = provincias.length === 1 ? provincias[0] : null;
    return {
      localidades,
      localidad: localidades.find((l) => l.id === elegida) ?? null,
      etiquetaTodas: unica ? `Todo ${unica}` : 'Todas las localidades',
      zonaTodas: unica ?? 'tu ciudad',
      listo,
      elegir,
    };
  }, [localidades, elegida, listo, elegir]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
