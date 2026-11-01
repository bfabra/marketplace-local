'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api, type Categoria, type ResultadosBusqueda } from '@/lib/api-client';
import { obtenerCategorias } from '@/lib/catalogo';
import { useLocation } from '@/hooks/use-location';
import { useDirectorio } from '@/hooks/use-directorio';
import { BRAND_NAME } from '@/components/layout/logo';
import { Icon } from '@/components/ui/icon';
import { MarketStoreCard } from '@/components/catalog/market-store-card';
import { MarketProductCard } from '@/components/catalog/market-product-card';
import { ProductoModal } from '@/components/catalog/producto-modal';

type Tipo = 'todo' | 'tiendas' | 'productos';
const ESPERA_MS = 350;
const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Resultados: copia de la maqueta del diseñador (docs/diseno, #search). Primero los comercios. */
function Resultados() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { localidad } = useLocation();
  const { datos: directorio } = useDirectorio();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<ResultadosBusqueda | null>(null);
  const [error, setError] = useState(false);
  const [tipo, setTipo] = useState<Tipo>('todo');
  const [abierto, setAbierto] = useState<{ tienda: string; producto: string } | null>(null);

  const q = params.get('q')?.trim() ?? '';
  const categoriaId = params.get('categoria');
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const [texto, setTexto] = useState(q);

  useEffect(() => setTexto(q), [q]);

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  function cambiar(cambios: Record<string, string | null>) {
    const nuevos = new URLSearchParams(params.toString());
    Object.entries(cambios).forEach(([k, v]) => (v ? nuevos.set(k, v) : nuevos.delete(k)));
    if (!('pagina' in cambios)) nuevos.delete('pagina');
    const query = nuevos.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: 'pagina' in cambios });
  }

  // Como en la maqueta, los resultados se actualizan mientras se escribe.
  useEffect(() => {
    if (texto.trim() === q) return;
    const espera = window.setTimeout(() => cambiar({ q: texto.trim() || null }), ESPERA_MS);
    return () => window.clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  useEffect(() => {
    let vigente = true;
    setProductos(null);
    setError(false);
    const query = new URLSearchParams({ pagina: String(pagina) });
    if (q) query.set('q', q);
    if (categoriaId) query.set('categoria', categoriaId);
    api<ResultadosBusqueda>(`/catalog/buscar?${query}`)
      .then((d) => vigente && setProductos(d))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [q, categoriaId, pagina]);

  const tiendas = useMemo(() => {
    if (!q || !directorio) return [];
    const buscado = sinAcentos(q);
    return directorio.tiendas
      .filter((t) =>
        sinAcentos(`${t.nombre} ${t.rubro?.nombre ?? ''} ${t.descripcion ?? ''} ${t.localidad}`).includes(buscado)
      )
      .sort(
        (a, b) =>
          Number(b.localidad_id === localidad?.id) - Number(a.localidad_id === localidad?.id) ||
          a.nombre.localeCompare(b.nombre, 'es')
      );
  }, [q, directorio, localidad]);

  const categoria = categorias.find((c) => c.id === categoriaId) ?? null;
  const titulo = q ? `Resultados para “${q}”` : (categoria?.nombre ?? `Buscá en ${BRAND_NAME}`);
  const cargando = !productos && !error;
  const sinNada = !!productos && productos.total === 0 && tiendas.length === 0;
  const verTiendas = (tipo === 'todo' || tipo === 'tiendas') && tiendas.length > 0;
  const verProductos = (tipo === 'todo' || tipo === 'productos') && !!productos && productos.total > 0;

  useEffect(() => {
    document.title = `${q ? `“${q}”` : 'Resultados'} · ${BRAND_NAME}`;
  }, [q]);

  function limpiar() {
    setTexto('');
    setTipo('todo');
    router.replace(pathname, { scroll: false });
  }

  const pestania = (id: Tipo, etiqueta: string) => (
    <button type="button" className={tipo === id ? 'active' : undefined} aria-pressed={tipo === id} onClick={() => setTipo(id)}>
      {etiqueta}
    </button>
  );

  return (
    <div className="market-container market-page search-page">
      <div className="market-page-heading">
        <span>RESULTADOS</span>
        <h1>{titulo}</h1>
        <p>Priorizamos comercios para que puedas conocer quién vende cerca tuyo.</p>
      </div>
      <label className="market-filter-search search-large">
        <Icon name="search" size={20} />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar tiendas, rubros o productos"
          aria-label="Buscar tiendas, rubros o productos"
          enterKeyHint="search"
        />
      </label>
      <div className="search-type-tabs">
        {pestania('todo', 'Todo')}
        {pestania('tiendas', `Tiendas (${tiendas.length})`)}
        {pestania('productos', `Productos (${productos?.total ?? 0})`)}
        {categoria && (
          <button type="button" className="search-filtro" onClick={() => cambiar({ categoria: null })}>
            {categoria.nombre} <Icon name="x" size={13} />
            <span className="sr-only">Quitar el filtro de categoría</span>
          </button>
        )}
      </div>

      {error ? (
        <div className="market-empty">
          <i>
            <Icon name="alert" size={28} />
          </i>
          <h2>No pudimos hacer la búsqueda</h2>
          <p>Revisá tu conexión e intentá de nuevo en unos segundos.</p>
        </div>
      ) : cargando ? (
        <div className="product-grid" role="status" aria-label="Buscando">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="market-product-card market-product-vacia" />
          ))}
        </div>
      ) : sinNada ? (
        <div className="market-empty">
          <i>
            <Icon name="search" size={28} />
          </i>
          <h2>No encontramos coincidencias</h2>
          <p>
            {q
              ? `No hay resultados para “${q}”. Probá con un término más general.`
              : 'Todavía no hay productos publicados en esta categoría.'}
          </p>
          {(q || categoria) && (
            <button type="button" onClick={limpiar}>
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : !verTiendas && !verProductos ? (
        <div className="market-empty">
          <i>
            <Icon name={tipo === 'tiendas' ? 'store' : 'bag'} size={28} />
          </i>
          <h2>{tipo === 'tiendas' ? 'Ninguna tienda coincide' : 'Ningún producto coincide'}</h2>
          <p>Mirá la otra pestaña o probá con otra palabra.</p>
          <button type="button" onClick={() => setTipo('todo')}>
            Ver todo
          </button>
        </div>
      ) : (
        <>
          {verTiendas && (
            <section className="search-result-section">
              <div className="market-section-heading">
                <div>
                  <span>PRIMERO, LOS COMERCIOS</span>
                  <h2>Tiendas encontradas</h2>
                </div>
              </div>
              <div className="stores-page-grid">
                {tiendas.map((t) => (
                  <MarketStoreCard key={t.id} tienda={t} foto={directorio?.fotos.get(t.slug)} />
                ))}
              </div>
            </section>
          )}
          {verProductos && (
            <section className="search-result-section">
              <div className="market-section-heading">
                <div>
                  <span>{q ? 'PRODUCTOS RELACIONADOS' : 'EXPLORÁ'}</span>
                  <h2>{q ? 'Productos encontrados' : (categoria?.nombre ?? 'Todos los productos')}</h2>
                </div>
              </div>
              <div className="product-grid">
                {productos!.productos.map((p) => (
                  <MarketProductCard
                    key={p.id}
                    producto={p}
                    tiendaSlug={p.tienda!.slug}
                    onAbrir={() => setAbierto({ tienda: p.tienda!.slug, producto: p.slug })}
                  />
                ))}
              </div>
              {productos!.paginas > 1 && (
                <nav className="search-paginacion" aria-label="Páginas de productos">
                  <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() => cambiar({ pagina: pagina > 2 ? String(pagina - 1) : null })}
                  >
                    <Icon name="chevron-left" size={16} /> Anterior
                  </button>
                  <span>
                    Página {productos!.pagina} de {productos!.paginas}
                  </span>
                  <button
                    type="button"
                    disabled={pagina >= productos!.paginas}
                    onClick={() => cambiar({ pagina: String(pagina + 1) })}
                  >
                    Siguiente <Icon name="chevron-right" size={16} />
                  </button>
                </nav>
              )}
            </section>
          )}
        </>
      )}

      {abierto && (
        <ProductoModal
          tiendaSlug={abierto.tienda}
          productoSlug={abierto.producto}
          onCerrar={() => setAbierto(null)}
          conTienda
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="market-container market-page" />}>
      <Resultados />
    </Suspense>
  );
}
