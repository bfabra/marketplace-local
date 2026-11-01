'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError, api, type EstadoProducto, type ProductoEdicion, type Tienda } from '@/lib/api-client';
import { Alert } from '@/components/ui/alert';
import { ProductStatus } from '@/components/ui/product-status';
import { ProductForm } from '@/components/forms/product-form';
import { ProductImages } from '@/components/catalog/product-images';
import { AVISO_REVISION, NotaModeracion, puedeVolverAPublicar } from '@/components/catalog/moderacion-vendedor';

const TEXTO_PAUSA: Partial<Record<NonNullable<ProductoEdicion['motivo_pausa']>, string>> = {
  revision: 'Está esperando que el equipo de Tu Comercio Local lo revise. No lo ven los clientes todavía.',
  rechazado: 'No está visible. Corregí lo que pidió moderación y envialo de nuevo.',
  moderacion: 'Moderación lo pausó y no está visible. Solo moderación lo puede reactivar.',
};

export default function EditProductPage({ params }: { params: { id: string; productId: string } }) {
  const recienCreado = useSearchParams().get('creado') === '1';
  const base = `/stores/${params.id}/products/${params.productId}`;
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [producto, setProducto] = useState<ProductoEdicion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(recienCreado ? 'Producto creado. Sumale fotos y publicalo.' : null);
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    Promise.all([api<Tienda>(`/stores/${params.id}`), api<ProductoEdicion>(base)])
      .then(([t, p]) => {
        setTienda(t);
        setProducto(p);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id, base]);

  async function cambiarEstado(estado: EstadoProducto, hecho: string) {
    setCambiando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await api<Pick<ProductoEdicion, 'estado' | 'motivo_pausa'>>(`${base}/estado`, {
        method: 'PATCH',
        body: { estado },
      });
      setProducto((p) => p && { ...p, ...r });
      setAviso(r.motivo_pausa === 'revision' ? `Lo enviamos a revisión. ${AVISO_REVISION}` : hecho);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setCambiando(false);
    }
  }

  const volver = (
    <Link href={`/vendor/tiendas/${params.id}/productos`} className="muted">
      ← Productos
    </Link>
  );

  if (error && !producto) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        {volver}
      </div>
    );
  }
  if (!tienda || !producto) return <p>Cargando…</p>;

  const puedeEditar = tienda.permisos.includes('productos.editar');
  const puedePublicar = tienda.permisos.includes('productos.publicar');
  const publico = producto.estado === 'publicado' && tienda.estado === 'activa';

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          {volver}
          <h1>{producto.nombre}</h1>
        </div>
        <ProductStatus estado={producto.estado} motivo={producto.motivo_pausa} />
      </div>

      {error && <Alert>{error}</Alert>}
      {aviso && <Alert kind="success">{aviso}</Alert>}

      <section className="card page-head">
        <div className="publicacion-texto">
          <p className="muted">
            {producto.estado === 'publicado'
              ? tienda.estado === 'activa'
                ? 'Está visible en tu tienda.'
                : 'Está publicado; se va a ver cuando aprueben tu tienda.'
              : (producto.motivo_pausa && TEXTO_PAUSA[producto.motivo_pausa]) ?? 'No está visible para los clientes.'}
          </p>
          <NotaModeracion motivo={producto.motivo_pausa} nota={producto.nota_moderacion} />
        </div>
        <div className="actions">
          {publico && (
            <Link href={`/tiendas/${tienda.slug}/${producto.slug}`} className="btn btn-secondary">
              Ver en la tienda
            </Link>
          )}
          {puedePublicar &&
            (producto.estado === 'publicado' ? (
              <button className="btn btn-secondary" disabled={cambiando} onClick={() => cambiarEstado('pausado', 'Producto pausado.')}>
                Pausar
              </button>
            ) : (
              puedeVolverAPublicar(producto.motivo_pausa) && (
                <button className="btn" disabled={cambiando} onClick={() => cambiarEstado('publicado', 'Producto publicado.')}>
                  {producto.motivo_pausa === 'rechazado' ? 'Enviar de nuevo' : 'Publicar'}
                </button>
              )
            ))}
        </div>
      </section>

      <ProductImages
        base={base}
        imagenes={producto.imagenes}
        puedeEditar={puedeEditar}
        onChange={setProducto}
      />

      <ProductForm
        key={producto.id}
        tiendaId={params.id}
        producto={producto}
        puedeEditar={puedeEditar}
        onSaved={(p) => {
          setProducto(p);
          setAviso(null);
        }}
      />
    </div>
  );
}
