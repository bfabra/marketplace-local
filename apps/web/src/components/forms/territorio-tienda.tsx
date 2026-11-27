'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Localidad } from '@/lib/api-client';
import { SelectorDisenio } from '@/components/forms/campo-disenio';

/**
 * Provincia + Departamento del alta de comercio (docs/diseno #merchant).
 * En la base, cada “localidad” de San Juan es un departamento (Capital, Rawson, …);
 * no hay villas anidadas todavía — el valor guardado sigue siendo `localidad_id`.
 */
export function TerritorioTienda({
  localidades,
  localidadId,
  onChange,
  error,
}: {
  localidades: Localidad[];
  localidadId: string;
  onChange: (localidadId: string) => void;
  error?: string;
}) {
  const provincias = useMemo(
    () => [...new Set(localidades.map((l) => l.provincia))].sort((a, b) => a.localeCompare(b, 'es')),
    [localidades]
  );

  const elegida = localidades.find((l) => l.id === localidadId);
  const [provincia, setProvincia] = useState(elegida?.provincia ?? '');

  useEffect(() => {
    if (elegida?.provincia && elegida.provincia !== provincia) {
      setProvincia(elegida.provincia);
    }
  }, [elegida?.provincia]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!provincia && provincias.length) setProvincia(provincias[0]);
  }, [provincia, provincias]);

  const departamentos = useMemo(
    () =>
      localidades
        .filter((l) => l.provincia === provincia)
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [localidades, provincia]
  );

  function cambiarProvincia(nombre: string) {
    setProvincia(nombre);
    const sigue = localidades.some((l) => l.id === localidadId && l.provincia === nombre);
    if (!sigue) onChange('');
  }

  return (
    <div className="territorio-tienda">
      <div className="split-fields">
        <SelectorDisenio
          label="Provincia"
          name="provincia"
          value={provincia}
          onChange={cambiarProvincia}
          placeholder={provincias.length ? 'Seleccioná provincia' : 'Cargando…'}
          opciones={provincias.map((p) => ({ value: p, label: p }))}
          disabled={provincias.length <= 1}
        />
        <SelectorDisenio
          label="Departamento"
          name="localidad_id"
          value={localidadId}
          onChange={onChange}
          placeholder={
            !provincia
              ? 'Primero elegí la provincia'
              : departamentos.length
                ? 'Seleccioná departamento'
                : 'Cargando…'
          }
          opciones={departamentos.map((d) => ({ value: d.id, label: d.nombre }))}
          disabled={!provincia || departamentos.length === 0}
          error={error}
        />
      </div>
      <p className="territorio-ayuda muted">
        Elegí provincia y departamento. Después seleccioná la localidad / villa / zona.
      </p>
    </div>
  );
}
