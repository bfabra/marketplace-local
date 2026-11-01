'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { descripcionRubro, tiendasPorRubro, useDirectorio } from '@/hooks/use-directorio';
import { plural, visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Todos los rubros: copia de la maqueta del diseñador (docs/diseno, #categories). */
export default function RubrosPage() {
  const { datos, error } = useDirectorio();
  const [filtro, setFiltro] = useState('');
  const cuenta = useMemo(() => tiendasPorRubro(datos?.tiendas ?? []), [datos]);

  const visibles = useMemo(() => {
    const f = sinAcentos(filtro.trim());
    return (datos?.rubros ?? []).filter(
      (r) => !f || sinAcentos(`${r.nombre} ${r.subrubros.map((s) => s.nombre).join(' ')}`).includes(f)
    );
  }, [datos, filtro]);

  return (
    <div className="market-container market-page">
      <div className="market-page-heading">
        <span>RUBROS LOCALES</span>
        <h1>Explorá todos los rubros</h1>
        <p>Encontrá comercios por categoría y conocé las propuestas disponibles en tu ciudad.</p>
      </div>
      <label className="market-filter-search">
        <Icon name="search" size={18} />
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar un rubro"
          aria-label="Buscar un rubro"
        />
      </label>

      {error ? (
        <div className="market-empty">
          <i>
            <Icon name="alert" size={28} />
          </i>
          <h2>No pudimos cargar los rubros</h2>
          <p>Revisá tu conexión e intentá de nuevo en unos segundos.</p>
        </div>
      ) : datos && visibles.length === 0 ? (
        <div className="market-empty">
          <i>
            <Icon name="search" size={28} />
          </i>
          <h2>No encontramos ese rubro</h2>
          <p>Probá con otra palabra o revisá todos los rubros disponibles.</p>
          <button type="button" onClick={() => setFiltro('')}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="category-page-grid">
          {visibles.map((r) => (
            <Link key={r.id} href={`/tiendas?rubro=${r.slug}`}>
              <i>
                <Icon name={visualCategoria(r.slug).icono} size={28} />
              </i>
              <div>
                <h2>{r.nombre}</h2>
                <p>{descripcionRubro(r)}</p>
                <span className={cuenta.get(r.slug) ? undefined : 'proximamente'}>
                  {cuenta.get(r.slug) ? plural(cuenta.get(r.slug)!, 'comercio', 'comercios') : 'Próximamente'}{' '}
                  <Icon name="chevron-right" size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
