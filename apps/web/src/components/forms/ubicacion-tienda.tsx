'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { ApiError, api, type LugarGoogle, type Ubicacion } from '@/lib/api-client';
import { Icon } from '@/components/ui/icon';

export const urlMapa = (u: Ubicacion) => `https://maps.google.com/maps?q=${u.lat},${u.lng}&z=16&output=embed`;

const PIN_CENTRO = { x: 50, y: 50, texto: 'San Juan (Predeterminado)', lat: -31.5375, lng: -68.5364 };

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
 * "Ubicación y mapa" del alta de comercio (docs/diseno #merchant).
 * Con Google Maps: importar local. Sin pin real: mapa soft clicable (como la maqueta).
 */
export function UbicacionTienda({
  conGoogleMaps,
  ubicacion,
  nombre,
  onImportar,
  onUbicacion,
  onQuitarUbicacion,
  children,
}: {
  conGoogleMaps: boolean;
  ubicacion: Ubicacion | null;
  nombre: string;
  onImportar: (lugar: LugarGoogle) => void;
  onUbicacion: (punto: Ubicacion) => void;
  onQuitarUbicacion: () => void;
  children: ReactNode;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [lugares, setLugares] = useState<LugarGoogle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importado, setImportado] = useState<string | null>(null);
  const [pin, setPin] = useState(PIN_CENTRO);

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
      if (encontrados.length === 0) {
        setError('No encontramos ese local en Google Maps. Probá con el nombre y la ciudad, o pegá el enlace.');
      }
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

  function marcarPin(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const lat = Number((-31.53 - (y / 100) * 0.02).toFixed(4));
    const lng = Number((-68.525 + (x / 100) * 0.02).toFixed(4));
    setPin({ x, y, texto: `Pin: Lat ${lat}, Lng ${lng}`, lat, lng });
    onUbicacion({ lat, lng });
  }

  function centrarPin() {
    setPin(PIN_CENTRO);
    onUbicacion({ lat: PIN_CENTRO.lat, lng: PIN_CENTRO.lng });
  }

  return (
    <fieldset className="ds-caja ubicacion-tienda">
      <div className="ds-caja-cabecera">
        <legend>
          <Icon name="pin" size={16} /> Ubicación y mapa
        </legend>
        {conGoogleMaps && (
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
        )}
      </div>

      <p className="ubicacion-intro">
        Buscá tu comercio o hacé clic en el mapa interactivo para fijar la dirección exacta.
      </p>

      {conGoogleMaps && (
        <div className="ubicacion-buscar">
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
        <div>
          <div
            className="signup-mapa merchant-mapa"
            role="button"
            tabIndex={0}
            title="Hacé clic para marcar la ubicación del local"
            onClick={marcarPin}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                centrarPin();
              }
            }}
          >
            <div className="signup-mapa-guia">
              Mapa interactivo de ubicación de tienda
              <span>Hacé clic para posicionar el marcador exacto de tu local</span>
            </div>
            <span className="signup-mapa-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} aria-hidden>
              <Icon name="pin" size={24} />
            </span>
          </div>
          <div className="signup-mapa-pie">
            <span>{ubicacion ? `Pin: Lat ${ubicacion.lat}, Lng ${ubicacion.lng}` : pin.texto}</span>
            <button type="button" onClick={centrarPin}>
              Centrar pin
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
