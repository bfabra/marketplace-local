'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type EstadoProducto, type ListadoProductos, type ProductoListado, type Tienda } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { AVISO_REVISION, NotaModeracion, puedeVolverAPublicar } from '@/components/catalog/moderacion-vendedor';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { ModalPublicar } from '@/components/vendor/modal-publicar';

type VistaModo = 'grid' | 'list';

const ETIQUETA_ESTADO: Partial<Record<EstadoProducto, string>> = {
  publicado: 'Publicado',
  borrador: 'Borrador',
  pausado: 'Pausado',
};

/** Panel #merchant-panel → Mis Productos (merchant.js renderProductsTab). */
export default function ProductsPage({ params }: { params: { id: string } }) {
  const base = `/stores/${params.id}/products`;
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [listado, setListado] = useState<ListadoProductos | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [modo, setModo] = useState<VistaModo>('grid');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [modalPublicar, setModalPublicar] = useState(false);

  const cargar = useCallback(() => {
    Promise.all([api<Tienda>(`/stores/${params.id}`), api<ListadoProductos>(base)])
      .then(([t, l]) => {
        setTienda(t);
        setListado(l);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id, base]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function ejecutar<T>(producto: ProductoListado, accion: () => Promise<T>, hecho: string | ((r: T) => string)) {
    setOcupado(producto.id);
    setError(null);
    setAviso(null);
    try {
      const r = await accion();
      setAviso(typeof hecho === 'function' ? hecho(r) : hecho);
      cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(null);
    }
  }

  const cambiarEstado = (p: ProductoListado, estado: EstadoProducto, hecho: string) =>
    ejecutar(
      p,
      () => api<Pick<ProductoListado, 'motivo_pausa'>>(`${base}/${p.id}/estado`, { method: 'PATCH', body: { estado } }),
      (r) => (r.motivo_pausa === 'revision' ? `"${p.nombre}" se envió a revisión. ${AVISO_REVISION}` : hecho)
    );

  function borrar(p: ProductoListado) {
    if (!window.confirm(`¿Eliminar "${p.nombre}"? No se puede deshacer.`)) return;
    ejecutar(p, () => api(`${base}/${p.id}`, { method: 'DELETE' }), `"${p.nombre}" fue eliminado.`);
  }

  if (error && !listado) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={`/vendor/tiendas/${params.id}`}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda || !listado) return <PageSkeleton />;

  const puedeEditar = tienda.permisos.includes('productos.editar');
  const puedePublicar = tienda.permisos.includes('productos.publicar');
  const { limite, productos } = listado;
  const texto = busqueda.trim().toLowerCase();
  const visibles = productos.filter((p) => {
    if (!texto) return true;
    return (
      p.nombre.toLowerCase().includes(texto) ||
      (p.categoria ?? '').toLowerCase().includes(texto) ||
      p.id.toLowerCase().includes(texto)
    );
  });
  const cupo = `${productos.length}/${limite.max ?? '∞'}`;

  function acciones(p: ProductoListado) {
    return (
      <div className="mp-prod-acciones">
        <Link
          href={`/vendor/tiendas/${params.id}/productos/${p.id}`}
          className="mp-prod-btn-editar"
        >
          {puedeEditar ? 'Editar' : 'Ver'}
        </Link>
        {puedePublicar && p.estado !== 'publicado' && puedeVolverAPublicar(p.motivo_pausa) && (
          <button
            type="button"
            className="mp-prod-btn-editar"
            disabled={ocupado === p.id}
            onClick={() => cambiarEstado(p, 'publicado', `"${p.nombre}" está publicado.`)}
          >
            {p.motivo_pausa === 'rechazado' ? 'Reenviar' : 'Publicar'}
          </button>
        )}
        {puedePublicar && p.estado === 'publicado' && (
          <button
            type="button"
            className="mp-prod-btn-editar"
            disabled={ocupado === p.id}
            onClick={() => cambiarEstado(p, 'pausado', `"${p.nombre}" quedó pausado.`)}
          >
            Pausar
          </button>
        )}
        {puedeEditar && (
          <button
            type="button"
            className="mp-prod-btn-eliminar"
            disabled={ocupado === p.id}
            onClick={() => borrar(p)}
          >
            Eliminar
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="mp-panel mp-productos">
      <EncabezadoPanel
        tienda={tienda}
        titulo={`Mis Productos (${cupo}) — ${tienda.nombre}`}
        descripcion="Gestioná, buscá y alterná la vista de tu inventario."
      >
        {puedeEditar && (
          <button type="button" className="mp-btn-crear mp-btn-crear-acento" onClick={() => setModalPublicar(true)}>
            + Publicar Producto / Carga Masiva
          </button>
        )}
      </EncabezadoPanel>

      <ModalPublicar
        tiendaId={params.id}
        tiendaNombre={tienda.nombre}
        abierto={modalPublicar}
        onCerrar={() => setModalPublicar(false)}
        onPublicado={cargar}
        puedePublicar={puedePublicar}
      />

      {tienda.estado !== 'activa' && (
        <Alert kind="info">
          Tu tienda todavía no está aprobada: podés cargar y publicar productos, pero los clientes los van a ver cuando
          la tienda esté activa.
        </Alert>
      )}
      {listado.revisionActiva && (
        <Alert kind="info">
          El equipo de Tu Comercio Local revisa los productos que publicás antes de mostrarlos en el sitio.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {aviso && <Alert kind="success">{aviso}</Alert>}

      <div className="mp-prod-toolbar">
        <label className="mp-prod-buscar">
          <span className="mp-prod-buscar-icono" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <span className="sr-only">Buscar producto</span>
          <input
            type="search"
            placeholder="Buscá por nombre, ID / SKU o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
        <div className="mp-prod-vista">
          <span>Vista:</span>
          <button
            type="button"
            className={modo === 'grid' ? 'is-activa' : undefined}
            aria-pressed={modo === 'grid'}
            onClick={() => setModo('grid')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Grilla
          </button>
          <button
            type="button"
            className={modo === 'list' ? 'is-activa' : undefined}
            aria-pressed={modo === 'list'}
            onClick={() => setModo('list')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Lista
          </button>
        </div>
      </div>

      {productos.length === 0 ? (
        <div className="mp-prod-vacio">
          <p>Sin productos publicados todavía en esta sucursal.</p>
          {puedeEditar && (
            <button type="button" className="mp-btn-crear mp-btn-crear-acento" onClick={() => setModalPublicar(true)}>
              + Publicar Producto / Carga Masiva
            </button>
          )}
        </div>
      ) : visibles.length === 0 ? (
        <p className="mp-prod-filtro-vacio">No se encontraron productos con el filtro ingresado.</p>
      ) : modo === 'grid' ? (
        <ListaScroll as="ul" className="mp-productos-grid" etiqueta="Productos de la tienda">
          {visibles.map((p) => (
            <li key={p.id} className="mp-producto-card">
              {p.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagen} alt="" />
              ) : (
                <div className="mp-producto-sin-foto" aria-hidden="true" />
              )}
              <div className="mp-producto-body">
                <strong>{p.nombre}</strong>
                <span className="mp-producto-meta">SKU: N/D</span>
                <span className="mp-producto-meta">
                  Stock: <b>{p.stock}</b> un.
                </span>
                <NotaModeracion motivo={p.motivo_pausa} nota={p.nota_moderacion} />
                <div className="mp-producto-pie">
                  <span className="mp-producto-precio">{formatPrice(p.precio_oferta ?? p.precio ?? 0)}</span>
                  <span className="mp-producto-badge">{ETIQUETA_ESTADO[p.estado] ?? p.estado}</span>
                </div>
                {acciones(p)}
              </div>
            </li>
          ))}
        </ListaScroll>
      ) : (
        <ListaScroll as="ul" className="mp-productos-lista" etiqueta="Productos de la tienda">
          {visibles.map((p) => (
            <li key={p.id} className="mp-producto-fila">
              <div className="mp-producto-fila-izq">
                {p.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen} alt="" />
                ) : (
                  <div className="mp-producto-fila-sin-foto" aria-hidden="true" />
                )}
                <div>
                  <strong>{p.nombre}</strong>
                  <span className="mp-producto-meta">
                    SKU: N/D · Categoría: {p.categoria || 'N/D'}
                  </span>
                  <NotaModeracion motivo={p.motivo_pausa} nota={p.nota_moderacion} />
                </div>
              </div>
              <div className="mp-producto-fila-der">
                <div className="mp-producto-fila-stock">
                  <span className="mp-producto-meta">
                    Stock: <b>{p.stock}</b>
                  </span>
                  <strong className="mp-producto-precio">{formatPrice(p.precio_oferta ?? p.precio ?? 0)}</strong>
                </div>
                <span className="mp-producto-badge">{ETIQUETA_ESTADO[p.estado] ?? p.estado}</span>
                {acciones(p)}
              </div>
            </li>
          ))}
        </ListaScroll>
      )}
    </section>
  );
}
