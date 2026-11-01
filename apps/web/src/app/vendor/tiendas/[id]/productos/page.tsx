'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type EstadoProducto, type ListadoProductos, type ProductoListado, type Tienda } from '@/lib/api-client';
import { Alert } from '@/components/ui/alert';
import { Price } from '@/components/ui/price';
import { ProductStatus } from '@/components/ui/product-status';
import { AVISO_REVISION, NotaModeracion, puedeVolverAPublicar } from '@/components/catalog/moderacion-vendedor';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { BarraUso, EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { ModalPublicar } from '@/components/vendor/modal-publicar';

const VISTAS: { id: string; label: string; estado: EstadoProducto | null }[] = [
  { id: 'todos', label: 'Todos', estado: null },
  { id: 'publicados', label: 'Publicados', estado: 'publicado' },
  { id: 'borradores', label: 'Borradores', estado: 'borrador' },
  { id: 'pausados', label: 'Pausados', estado: 'pausado' },
];

export default function ProductsPage({ params }: { params: { id: string } }) {
  const base = `/stores/${params.id}/products`;
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [listado, setListado] = useState<ListadoProductos | null>(null);
  const [vista, setVista] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
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
    if (!window.confirm(`¿Borrar "${p.nombre}"? No se puede deshacer.`)) return;
    ejecutar(p, () => api(`${base}/${p.id}`, { method: 'DELETE' }), `"${p.nombre}" fue borrado.`);
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
  const actual = VISTAS.find((v) => v.id === vista)!;
  const texto = busqueda.trim().toLowerCase();
  const visibles = productos.filter(
    (p) => (!actual.estado || p.estado === actual.estado) && (!texto || p.nombre.toLowerCase().includes(texto))
  );

  return (
    <section className="mp-panel">
      <EncabezadoPanel
        tienda={tienda}
        titulo={`Catálogo de Productos — ${tienda.nombre}`}
        icono="package"
        descripcion="Publicá artículos exclusivos para esta sucursal."
      >
        {puedeEditar && (
          <button type="button" className="mp-btn-crear" onClick={() => setModalPublicar(true)}>
            + Publicar Producto / Carga Masiva
          </button>
        )}
      </EncabezadoPanel>

      <ModalPublicar
        tiendaId={params.id}
        tiendaNombre={tienda.nombre}
        abierto={modalPublicar}
        onCerrar={() => setModalPublicar(false)}
      />

      <div className="mp-uso-plan">
        <div>
          <p className="mp-uso-texto">
            <strong>{limite.publicados}</strong> de {limite.max ?? 'ilimitados'} publicados
            {limite.plan ? ` · Plan ${limite.plan}` : ''}
          </p>
          <BarraUso usado={limite.publicados} maximo={limite.max} label="Uso del límite del plan" />
        </div>
        {tienda.esDuenio && limite.max !== null && (
          <Link href={`/vendor/tiendas/${params.id}/plan`} className="mp-link-navy">
            Ampliar mi plan →
          </Link>
        )}
      </div>

      {tienda.estado !== 'activa' && (
        <Alert kind="info">
          Tu tienda todavía no está aprobada: podés cargar y publicar productos, pero los clientes los van a ver
          cuando la tienda esté activa.
        </Alert>
      )}
      {listado.revisionActiva && (
        <Alert kind="info">
          El equipo de Tu Comercio Local revisa los productos que publicás antes de mostrarlos en el sitio.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {aviso && <Alert kind="success">{aviso}</Alert>}

      {productos.length === 0 ? (
        <div className="mp-vacio" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <p style={{ margin: 0 }}>Sin productos publicados todavía en esta sucursal.</p>
          {puedeEditar && (
            <button type="button" className="mp-btn-crear" onClick={() => setModalPublicar(true)}>
              + Publicar Producto / Carga Masiva
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mp-filtros">
            <nav className="mp-tabs" aria-label="Filtrar productos">
              {VISTAS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={vista === v.id ? 'is-activa' : undefined}
                  aria-pressed={vista === v.id}
                  onClick={() => setVista(v.id)}
                >
                  {v.label}{' '}
                  <em>{productos.filter((p) => !v.estado || p.estado === v.estado).length}</em>
                </button>
              ))}
            </nav>
            <label className="mp-buscar">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar producto</span>
              <input
                type="search"
                placeholder="Buscar por nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
          </div>

          {visibles.length === 0 ? (
            <p className="mp-vacio">No hay productos que coincidan.</p>
          ) : (
            <ListaScroll as="ul" className="mp-productos-grid" etiqueta="Productos de la tienda">
              {visibles.map((p) => (
                <li key={p.id} className="mp-producto-card">
                  {p.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagen} alt="" />
                  ) : (
                    <div className="mp-producto-sin-foto">
                      <Icon name="image" size={22} />
                    </div>
                  )}
                  <div className="mp-producto-body">
                    <strong>{p.nombre}</strong>
                    <span className="muted">
                      {p.categoria} · Stock {p.stock}
                    </span>
                    <NotaModeracion motivo={p.motivo_pausa} nota={p.nota_moderacion} />
                    <div className="mp-producto-pie">
                      <Price precio={p.precio} oferta={p.precio_oferta} desde={p.desde} />
                      <ProductStatus estado={p.estado} motivo={p.motivo_pausa} />
                    </div>
                  </div>
                  <div className="mp-producto-acciones">
                    <Link href={`/vendor/tiendas/${params.id}/productos/${p.id}`} className="mp-btn-secundario">
                      {puedeEditar ? 'Editar' : 'Ver'}
                    </Link>
                    {puedePublicar && p.estado !== 'publicado' && puedeVolverAPublicar(p.motivo_pausa) && (
                      <button
                        type="button"
                        className="mp-btn-crear"
                        disabled={ocupado === p.id}
                        onClick={() => cambiarEstado(p, 'publicado', `"${p.nombre}" está publicado.`)}
                      >
                        {p.motivo_pausa === 'rechazado' ? 'Reenviar' : 'Publicar'}
                      </button>
                    )}
                    {puedePublicar && p.estado === 'publicado' && (
                      <button
                        type="button"
                        className="mp-btn-secundario"
                        disabled={ocupado === p.id}
                        onClick={() => cambiarEstado(p, 'pausado', `"${p.nombre}" quedó pausado.`)}
                      >
                        Pausar
                      </button>
                    )}
                    {puedeEditar && (
                      <button
                        type="button"
                        className="mp-btn-peligro"
                        disabled={ocupado === p.id}
                        onClick={() => borrar(p)}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ListaScroll>
          )}
        </>
      )}
    </section>
  );
}
