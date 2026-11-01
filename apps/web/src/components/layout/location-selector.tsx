'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { useLocation } from '@/hooks/use-location';
import { useClickOutside } from '@/hooks/use-click-outside';
import { Icon } from '@/components/ui/icon';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function LocationSelector({ className = '', compacto = false }: { className?: string; compacto?: boolean }) {
  const { localidades, localidad, etiquetaTodas, elegir } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const contenedor = useRef<HTMLDivElement>(null);
  const id = useId();

  const cerrar = useCallback(() => {
    setAbierto(false);
    setFiltro('');
  }, []);
  useClickOutside(contenedor, abierto, cerrar);

  const visibles = localidades.filter((l) => sinAcentos(l.nombre).includes(sinAcentos(filtro)));

  function seleccionar(idLocalidad: string | null) {
    elegir(idLocalidad);
    cerrar();
  }

  return (
    <div ref={contenedor} className={`ubicacion ${compacto ? 'ubicacion-compacta' : ''} ${className}`}>
      <button
        type="button"
        className="ubicacion-boton"
        aria-expanded={abierto}
        aria-controls={`${id}-panel`}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
      >
        <Icon name="pin" size={compacto ? 16 : 20} />
        <span className="ubicacion-textos">
          {!compacto && <small>Comprás en</small>}
          <strong>{localidad?.nombre ?? etiquetaTodas}</strong>
        </span>
        <Icon name="chevron-down" size={16} className="ubicacion-flecha" />
      </button>

      {abierto && (
        <div id={`${id}-panel`} className="popover ubicacion-panel" role="dialog" aria-label="Elegí tu localidad">
          <p className="popover-titulo">¿Dónde querés comprar?</p>
          <p className="muted popover-texto">Te mostramos primero los comercios de tu zona.</p>
          {localidades.length > 8 && (
            <input
              type="search"
              className="input"
              placeholder="Buscar localidad"
              aria-label="Buscar localidad"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              autoFocus
            />
          )}
          <ul className="ubicacion-lista">
            {!filtro && (
              <li>
                <button type="button" aria-pressed={!localidad} onClick={() => seleccionar(null)}>
                  <Icon name="mountain" size={16} />
                  {etiquetaTodas}
                  {!localidad && <Icon name="check" size={16} className="ubicacion-check" />}
                </button>
              </li>
            )}
            {visibles.map((l) => (
              <li key={l.id}>
                <button type="button" aria-pressed={localidad?.id === l.id} onClick={() => seleccionar(l.id)}>
                  <Icon name="pin" size={16} />
                  {l.nombre}
                  {localidad?.id === l.id && <Icon name="check" size={16} className="ubicacion-check" />}
                </button>
              </li>
            ))}
            {visibles.length === 0 && <li className="muted ubicacion-vacia">No encontramos esa localidad.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
