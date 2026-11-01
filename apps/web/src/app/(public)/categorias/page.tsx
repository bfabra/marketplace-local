'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Categoria } from '@/lib/api-client';
import { useCategorias } from '@/hooks/use-categorias';
import { enlaceCategoria, hijasPorPadre } from '@/lib/catalogo';
import { plural, raizDeRuta, visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

// Cuántas subcategorías se ven antes de «Ver N más» (menos si traen sus tipos abajo).
const SUBCATEGORIAS_VISIBLES = 8;
const SUBCATEGORIAS_CON_TIPOS_VISIBLES = 4;

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface Sub {
  categoria: Categoria;
  tipos: Categoria[];
}

interface Grupo {
  raiz: Categoria;
  subs: Sub[];
  /** Con un filtro, la categoría entra por alguna de sus subcategorías. */
  parcial: boolean;
}

function Cantidad({ n }: { n: number }) {
  return <span className="categoria-cantidad">{n > 0 ? plural(n, 'producto', 'productos') : 'Muy pronto'}</span>;
}

function TarjetaCategoria({ grupo, filtrando }: { grupo: Grupo; filtrando: boolean }) {
  const [todas, setTodas] = useState(false);
  const { raiz, subs } = grupo;
  const slug = raizDeRuta(raiz.ruta);
  const { icono, tono } = visualCategoria(slug);
  const limite = subs.some((s) => s.tipos.length) ? SUBCATEGORIAS_CON_TIPOS_VISIBLES : SUBCATEGORIAS_VISIBLES;
  const visibles = todas || filtrando ? subs : subs.slice(0, limite);
  const ocultas = subs.length - visibles.length;

  return (
    <article id={slug} className="categoria-card">
      <header className="categoria-card-cabecera">
        <span className="categoria-card-icono" style={{ background: tono.bg, color: tono.fg }}>
          <Icon name={icono} size={24} />
        </span>
        <div className="categoria-card-titulo">
          <h2>
            <Link href={enlaceCategoria(raiz.id)}>{raiz.nombre}</Link>
          </h2>
          <Cantidad n={raiz.productos} />
        </div>
        {raiz.revision && (
          <span className="badge badge-producto-revision" title="Lo que se publica acá pasa por moderación">
            <Icon name="shield" size={12} />
            Con revisión
          </span>
        )}
      </header>

      <ul className="categoria-subs">
        {visibles.map(({ categoria: s, tipos }) => (
          <li key={s.id}>
            <Link href={enlaceCategoria(s.id)} className="categoria-sub">
              <span>{s.nombre}</span>
              {s.productos > 0 && <small>{s.productos}</small>}
            </Link>
            {tipos.length > 0 && (
              <p className="categoria-tipos">
                {tipos.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && ' · '}
                    <Link href={enlaceCategoria(t.id)}>{t.nombre}</Link>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>

      <footer className="categoria-card-pie">
        {ocultas > 0 ? (
          <button type="button" className="categoria-mas" onClick={() => setTodas(true)}>
            Ver {ocultas} más
            <Icon name="chevron-down" size={14} />
          </button>
        ) : (
          todas &&
          !filtrando && (
            <button type="button" className="categoria-mas" onClick={() => setTodas(false)}>
              Ver menos
              <Icon name="chevron-up" size={14} />
            </button>
          )
        )}
        <Link href={enlaceCategoria(raiz.id)} className="categoria-ver-todo">
          Ver todo
          <Icon name="arrow-right" size={14} />
        </Link>
      </footer>
    </article>
  );
}

export default function CategoriasPage() {
  const categorias = useCategorias();
  const [filtro, setFiltro] = useState('');

  const grupos = useMemo<Grupo[] | null>(() => {
    if (!categorias) return null;
    const hijas = hijasPorPadre(categorias);
    const todos = (hijas.get('') ?? []).map((raiz) => ({
      raiz,
      subs: (hijas.get(raiz.id) ?? []).map((categoria) => ({ categoria, tipos: hijas.get(categoria.id) ?? [] })),
      parcial: false,
    }));

    const f = sinAcentos(filtro.trim());
    if (!f) return todos;
    const coincide = (c: Categoria) => sinAcentos(c.nombre).includes(f);
    return todos.flatMap((g) => {
      if (coincide(g.raiz)) return [g];
      const subs = g.subs.flatMap((s) => {
        if (coincide(s.categoria)) return [s];
        const tipos = s.tipos.filter(coincide);
        return tipos.length ? [{ ...s, tipos }] : [];
      });
      return subs.length ? [{ ...g, subs, parcial: true }] : [];
    });
  }, [categorias, filtro]);

  const raices = categorias?.filter((c) => !c.padre_id) ?? [];
  const totalProductos = raices.reduce((t, c) => t + c.productos, 0);

  return (
    <div className="stack-lg">
      <nav className="breadcrumb" aria-label="Estás en">
        <Link href="/">Inicio</Link>
        <Icon name="chevron-right" size={14} />
        <span aria-current="page">Categorías</span>
      </nav>

      <header className="resultados-cabecera">
        <div>
          <h1>Todas las categorías</h1>
          <p className="muted">
            {categorias
              ? `${plural(raices.length, 'categoría', 'categorías')} · ${plural(
                  categorias.length - raices.length,
                  'subcategoría',
                  'subcategorías'
                )} · ${plural(totalProductos, 'producto publicado', 'productos publicados')}`
              : 'Cargando…'}
          </p>
        </div>
        <label className="campo-icono">
          <Icon name="search" size={16} />
          <span className="sr-only">Buscar categoría</span>
          <input
            type="search"
            placeholder="Buscar categoría"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </label>
      </header>

      {!filtro && raices.length > 0 && (
        <nav className="categorias-indice" aria-label="Ir a una categoría">
          {raices.map((r) => {
            const slug = raizDeRuta(r.ruta);
            const { icono, tono } = visualCategoria(slug);
            return (
              <a key={r.id} href={`#${slug}`} className="categorias-indice-item">
                <span className="categorias-indice-icono" style={{ background: tono.bg, color: tono.fg }}>
                  <Icon name={icono} size={14} />
                </span>
                {r.nombre}
              </a>
            );
          })}
        </nav>
      )}

      {!grupos ? (
        <div className="categorias-grid" role="status" aria-label="Cargando categorías">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="categoria-card" style={{ height: 320 }} />
          ))}
        </div>
      ) : grupos.length === 0 ? (
        <EmptyState icono="search" titulo={filtro ? `No encontramos “${filtro}”` : 'No pudimos cargar las categorías'}>
          {filtro ? 'Probá con otra palabra, o buscá el producto directamente.' : 'Intentá de nuevo en unos segundos.'}
        </EmptyState>
      ) : (
        <div className="categorias-grid">
          {grupos.map((g) => (
            <TarjetaCategoria key={g.raiz.id} grupo={g} filtrando={g.parcial} />
          ))}
        </div>
      )}
    </div>
  );
}
