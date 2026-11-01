'use client';

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocation } from '@/hooks/use-location';
import { useAuth } from '@/hooks/use-auth';
import { useSeguidos } from '@/hooks/use-seguidos';
import { useDirectorio } from '@/hooks/use-directorio';
import { plural } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { MarketStoreCard } from '@/components/catalog/market-store-card';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type Orden = 'cerca' | 'nombre';

/** Listado de tiendas: copia de la maqueta del diseñador (docs/diseno, #stores). */
function Tiendas() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { datos, error } = useDirectorio();
  const { localidad, localidades } = useLocation();
  const { user } = useAuth();
  const { ids: seguidas } = useSeguidos();
  const [nombre, setNombre] = useState('');
  const [orden, setOrden] = useState<Orden>('cerca');

  const rubro = params.get('rubro') ?? '';
  const zona = params.get('localidad') ?? '';
  const soloGuardadas = params.get('guardadas') === '1';

  function filtrar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString());
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    const q = nuevos.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  function limpiar() {
    setNombre('');
    router.replace(pathname, { scroll: false });
  }

  const visibles = useMemo(() => {
    if (!datos) return null;
    const f = sinAcentos(nombre.trim());
    return datos.tiendas
      .filter(
        (t) =>
          (!f || sinAcentos(`${t.nombre} ${t.descripcion ?? ''}`).includes(f)) &&
          (!rubro || t.rubro?.slug === rubro) &&
          (!zona || t.localidad_id === zona) &&
          (!soloGuardadas || seguidas.has(t.id))
      )
      .sort((a, b) =>
        orden === 'nombre'
          ? a.nombre.localeCompare(b.nombre, 'es')
          : Number(b.localidad_id === localidad?.id) - Number(a.localidad_id === localidad?.id) ||
            a.nombre.localeCompare(b.nombre, 'es')
      );
  }, [datos, nombre, rubro, zona, soloGuardadas, seguidas, orden, localidad]);

  const hayFiltros = !!(nombre || rubro || zona || soloGuardadas);

  return (
    <div className="market-container market-page">
      <div className="market-page-heading">
        <span>{soloGuardadas ? 'TUS TIENDAS' : 'COMERCIOS LOCALES'}</span>
        <h1>{soloGuardadas ? 'Tiendas favoritas' : 'Tiendas cerca tuyo'}</h1>
        <p>
          {soloGuardadas
            ? 'Los comercios que guardaste para volver a visitar.'
            : 'Explorá comercios registrados y entrá a cada tienda para conocer su historia y sus productos.'}
        </p>
      </div>

      <div className="store-tools">
        <label className="market-filter-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Buscar por nombre de tienda"
            aria-label="Buscar por nombre de tienda"
          />
        </label>
        <select value={rubro} onChange={(e) => filtrar('rubro', e.target.value)} aria-label="Rubro">
          <option value="">Todos los rubros</option>
          {datos?.rubros.map((r) => (
            <option key={r.id} value={r.slug}>
              {r.nombre}
            </option>
          ))}
        </select>
        <select value={zona} onChange={(e) => filtrar('localidad', e.target.value)} aria-label="Localidad">
          <option value="">Todas las localidades</option>
          {localidades.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
        <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} aria-label="Orden">
          <option value="cerca">{localidad ? `Primero ${localidad.nombre}` : 'Más cercanos'}</option>
          <option value="nombre">Nombre A–Z</option>
        </select>
      </div>

      {error ? (
        <div className="market-empty">
          <i>
            <Icon name="alert" size={28} />
          </i>
          <h2>No pudimos cargar los comercios</h2>
          <p>Revisá tu conexión e intentá de nuevo en unos segundos.</p>
        </div>
      ) : !visibles || !datos ? (
        <div className="stores-page-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="market-store-card market-store-vacia" />
          ))}
        </div>
      ) : (
        <>
          <div className="result-summary">
            <strong>{plural(visibles.length, 'comercio', 'comercios')}</strong>
            {hayFiltros && (
              <button type="button" onClick={limpiar}>
                Limpiar filtros
              </button>
            )}
          </div>
          {visibles.length > 0 ? (
            <div className="stores-page-grid">
              {visibles.map((t) => (
                <MarketStoreCard key={t.id} tienda={t} foto={datos.fotos.get(t.slug)} />
              ))}
            </div>
          ) : (
            <div className="market-empty">
              <i>
                <Icon name={soloGuardadas ? 'heart' : 'search'} size={28} />
              </i>
              <h2>{soloGuardadas && !user ? 'Ingresá para ver tus tiendas' : 'No encontramos comercios'}</h2>
              <p>
                {soloGuardadas
                  ? 'Tocá el corazón de una tienda para guardarla y encontrarla acá.'
                  : 'No hay coincidencias para los filtros seleccionados. Probá ampliando la búsqueda.'}
              </p>
              {hayFiltros && (
                <button type="button" onClick={limpiar}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TiendasPage() {
  return (
    <Suspense fallback={<div className="market-container market-page" />}>
      <Tiendas />
    </Suspense>
  );
}
