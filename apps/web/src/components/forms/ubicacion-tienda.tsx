'use client';

import { useState, type ReactNode } from 'react';
import { ApiError, api, type LugarGoogle, type Ubicacion } from '@/lib/api-client';
import { Icon } from '@/components/ui/icon';

export const urlMapa = (u: Ubicacion) => `https://maps.google.com/maps?q=${u.lat},${u.lng}&z=16&output=embed`;

/** Mapa de Google con el punto del local (sin clave: es el mapa público embebido). */
export function MapaTienda({ ubicacion, titulo, className }: { ubicacion: Ubicacion; titulo: string; className?: string }) {
  return (
    <iframe
      className={`mapa-tienda${className ? ` ${className}` : ''}`}
      src={urlMapa(ubicacion)}
      title={titulo}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

/**
 * "Ubicación y mapa" del alta de comercio (docs/diseno). Con Google Maps configurado
 * en la plataforma se puede buscar el local y completar los datos desde ahí.
 */
export function UbicacionTienda({
  conGoogleMaps,
  ubicacion,
  nombre,
  onImportar,
  onQuitarUbicacion,
  children,
}: {
  conGoogleMaps: boolean;
  ubicacion: Ubicacion | null;
  nombre: string;
  onImportar: (lugar: LugarGoogle) => void;
  onQuitarUbicacion: () => void;
  children: ReactNode;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [lugares, setLugares] = useState<LugarGoogle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importado, setImportado] = useState<string | null>(null);

  async function buscar() {
    const q = busqueda.trim() || nombre.trim();
    if (q.length < 3) {
      setError('Escribí el nombre del local o pegá el enlace de Google Maps');
      return;
    }
    setBuscando(true);
    setError(null);
    setImportado(null);
    try {
      const encontrados = await api<LugarGoogle[]>(`/stores/google-maps?q=${encodeURIComponent(q)}`);
      setLugares(encontrados);
      if (encontrados.length === 0) setError('No encontramos ese local en Google Maps. Probá con el nombre y la ciudad, o pegá el enlace.');
    } catch (e) {
      setLugares(null);
      setError(e instanceof ApiError ? e.message : 'No pudimos buscar en Google Maps');
    } finally {
      setBuscando(false);
    }
  }

  function elegir(lugar: LugarGoogle) {
    onImportar(lugar);
    setLugares(null);
    setImportado(lugar.nombre);
  }

  return (
    <fieldset className="ds-caja ubicacion-tienda">
      <div className="ds-caja-cabecera">
        <legend>
          <Icon name="pin" size={16} /> Ubicación y mapa
        </legend>
      </div>

      {conGoogleMaps && (
        <div className="ubicacion-buscar">
          <p>Buscá tu comercio por nombre o pegá el enlace de Google Maps: completamos la dirección, la localidad, el teléfono y el punto en el mapa.</p>
          <div className="ubicacion-buscar-fila">
            <label className="ds-field">
              <span className="sr-only">Nombre del local o enlace de Google Maps</span>
              <div>
                <Icon name="search" size={18} />
                <input
                  type="search"
                  placeholder={nombre.trim() ? `Ej. ${nombre.trim()}, San Juan` : 'Ej. Almacén Libertador, San Juan'}
                  value={busqueda}
                  maxLength={500}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      buscar();
                    }
                  }}
                />
              </div>
            </label>
            <button type="button" className="ds-btn secondary ds-btn-chico" onClick={buscar} disabled={buscando}>
              {buscando ? (
                <>
                  <span className="spinner" /> Buscando…
                </>
              ) : (
                <>
                  <Icon name="search" size={14} /> Importar desde Google Maps
                </>
              )}
            </button>
          </div>
          {error && (
            <small className="ubicacion-error" role="alert">
              {error}
            </small>
          )}
          {importado && (
            <small className="ubicacion-ok" role="status">
              <Icon name="check" size={13} /> Importamos los datos de “{importado}”. Revisalos antes de continuar.
            </small>
          )}
          {lugares && lugares.length > 0 && (
            <ul className="ubicacion-resultados" aria-label="Locales encontrados en Google Maps">
              {lugares.map((l) => (
                <li key={l.placeId}>
                  <button type="button" onClick={() => elegir(l)}>
                    <Icon name="pin" size={16} />
                    <span>
                      <strong>{l.nombre}</strong>
                      <small>{l.direccionCompleta}</small>
                    </span>
                    <b>Usar este</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {children}

      {ubicacion ? (
        <div className="ubicacion-mapa">
          <MapaTienda ubicacion={ubicacion} titulo="Ubicación del local en el mapa" />
          <button type="button" className="text-link" onClick={onQuitarUbicacion}>
            Quitar el punto del mapa
          </button>
        </div>
      ) : (
        conGoogleMaps && (
          <div className="ubicacion-mapa vacio" aria-hidden="true">
            <Icon name="pin" size={24} />
            <p>Vista previa del mapa</p>
            <small>Aparece cuando importás tu local desde Google Maps.</small>
          </div>
        )
      )}
    </fieldset>
  );
}
