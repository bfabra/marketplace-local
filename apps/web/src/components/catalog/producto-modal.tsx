'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type ProductoPublico } from '@/lib/api-client';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { FavoriteButton } from '@/components/ui/favorite-button';

type Variante = ProductoPublico['variantes'][number];
type Seleccion = Record<string, string>;

const coincide = (v: Variante, seleccion: Seleccion) =>
  Object.entries(seleccion).every(([atributoId, opcionId]) =>
    v.opciones.some((o) => o.atributo_id === atributoId && o.opcion_id === opcionId)
  );

const seleccionDe = (v: Variante | undefined): Seleccion =>
  Object.fromEntries((v?.opciones ?? []).map((o) => [o.atributo_id, o.opcion_id]));

function textoStock(stock: number) {
  if (stock === 0) return 'Sin stock en esta combinación';
  if (stock <= 3) return `¡Últimas ${stock === 1 ? 'unidad' : `${stock} unidades`}!`;
  return `Stock disponible · ${stock} unidades`;
}

/**
 * Ficha de producto de la maqueta (docs/diseno, modal de producto). `conTienda` muestra a qué
 * comercio pertenece, para cuando se abre fuera del perfil de la tienda.
 */
export function ProductoModal({
  tiendaSlug,
  productoSlug,
  onCerrar,
  conTienda = false,
}: {
  tiendaSlug: string;
  productoSlug: string;
  onCerrar: () => void;
  conTienda?: boolean;
}) {
  const [producto, setProducto] = useState<ProductoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>({});
  const [foto, setFoto] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [errorCarrito, setErrorCarrito] = useState<string | null>(null);
  const { agregar } = useCart();
  const toast = useToast();
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;

  useEffect(() => {
    setProducto(null);
    setError(null);
    setFoto(0);
    setCantidad(1);
    api<ProductoPublico>(
      `/catalog/tiendas/${encodeURIComponent(tiendaSlug)}/productos/${encodeURIComponent(productoSlug)}`
    )
      .then((p) => {
        setProducto(p);
        setSeleccion(seleccionDe(p.variantes.find((v) => v.stock > 0) ?? p.variantes[0]));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [tiendaSlug, productoSlug]);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    botonCerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar.current();
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', alTeclear);
      anterior?.focus();
    };
  }, []);

  const variante = producto?.variantes.find(
    (v) => coincide(v, seleccion) && v.opciones.length === Object.keys(seleccion).length
  );

  // Al elegir una opción se conservan las demás si existe esa combinación; si no, se salta a una que sí exista.
  function elegir(atributoId: string, opcionId: string) {
    const deseada = { ...seleccion, [atributoId]: opcionId };
    const exacta = producto!.variantes.find((v) => coincide(v, deseada));
    const alternativa = producto!.variantes.find((v) => coincide(v, { [atributoId]: opcionId }));
    setSeleccion(exacta ? deseada : seleccionDe(alternativa));
    setCantidad(1);
    setErrorCarrito(null);
  }

  async function agregarAlCarrito(irCheckout = false) {
    if (!variante) return;
    setAgregando(true);
    setErrorCarrito(null);
    try {
      await agregar(variante.id, cantidad);
      if (irCheckout) {
        window.location.href = '/checkout';
        return;
      }
      toast({
        titulo: `Agregaste ${cantidad} ${cantidad === 1 ? 'unidad' : 'unidades'} al carrito`,
        texto: producto?.nombre,
        accion: { href: '/carrito', label: 'Ver carrito' },
      });
      setCantidad(1);
    } catch (e) {
      setErrorCarrito(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setAgregando(false);
    }
  }

  const imagen = producto ? (producto.imagenes[foto] ?? producto.imagenes[0]) : null;
  const oferta = variante?.precio_oferta !== null && variante?.precio_oferta !== undefined && variante.precio_oferta < variante.precio;

  return (
    <div className="product-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <article
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-label={producto?.nombre ?? 'Ficha de producto'}
        aria-busy={!producto && !error}
      >
        <button ref={botonCerrar} type="button" className="modal-close" onClick={onCerrar} aria-label="Cerrar">
          <Icon name="x" size={18} />
        </button>

        {error ? (
          <div className="product-modal-estado">
            <i>
              <Icon name="bag" size={28} />
            </i>
            <h2>Este producto no está disponible</h2>
            <p>{error}. Puede que se haya agotado o que la tienda lo haya pausado.</p>
          </div>
        ) : !producto ? (
          <>
            <div className="product-modal-galeria product-modal-cargando" />
            <div className="product-modal-info" role="status" aria-label="Cargando producto" />
          </>
        ) : (
          <>
            <div className="product-modal-galeria">
              {imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagen.url} alt={imagen.alt ?? producto.nombre} />
              ) : (
                <i className="product-sin-foto" aria-hidden="true">
                  <Icon name="image" size={48} strokeWidth={1.25} />
                </i>
              )}
              {producto.imagenes.length > 1 && (
                <div className="product-modal-miniaturas">
                  {producto.imagenes.map((img, i) => (
                    <button
                      key={img.id}
                      type="button"
                      aria-pressed={i === foto}
                      aria-label={`Ver foto ${i + 1}`}
                      onClick={() => setFoto(i)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="product-modal-info">
              <span>FICHA DE PRODUCTO</span>
              <div className="product-modal-titulo">
                <h2>{producto.nombre}</h2>
                <FavoriteButton productoId={producto.id} nombre={producto.nombre} />
              </div>
              <small>
                {producto.categoria}
                {conTienda && (
                  <>
                    {' · '}
                    <Link href={`/tiendas/${producto.tienda.slug}`}>{producto.tienda.nombre}</Link>
                  </>
                )}
              </small>
              <strong>
                {variante ? formatPrice(oferta ? variante.precio_oferta! : variante.precio) : 'Elegí una combinación disponible'}
                {oferta && <del>{formatPrice(variante!.precio)}</del>}
              </strong>
              {producto.descripcion && <p>{producto.descripcion}</p>}

              {producto.opcionesVariante.map((a) => (
                <fieldset key={a.id} className="product-modal-opciones">
                  <legend>
                    {a.nombre}
                    {seleccion[a.id] && <span>: {a.opciones.find((o) => o.id === seleccion[a.id])?.valor}</span>}
                  </legend>
                  <div>
                    {a.opciones.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className={
                          producto.variantes.some((v) => coincide(v, { ...seleccion, [a.id]: o.id })) ? undefined : 'tenue'
                        }
                        aria-pressed={seleccion[a.id] === o.id}
                        onClick={() => elegir(a.id, o.id)}
                      >
                        {o.valor}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}

              {producto.ficha.length > 0 && (
                <dl className="product-modal-ficha">
                  {producto.ficha.map((f) => (
                    <div key={f.nombre}>
                      <dt>{f.nombre}</dt>
                      <dd>{f.valor}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="product-modal-compra">
                {variante && (
                  <p className={`product-modal-stock${variante.stock === 0 ? ' agotado' : variante.stock <= 3 ? ' poco' : ''}`}>
                    {textoStock(variante.stock)}
                  </p>
                )}
                <div>
                  {variante && variante.stock > 0 && (
                    <QuantityStepper valor={cantidad} max={variante.stock} onChange={setCantidad} disabled={agregando} />
                  )}
                </div>
                <div className="product-modal-acciones">
                  <button
                    type="button"
                    className="market-primary-button"
                    onClick={() => agregarAlCarrito(true)}
                    disabled={!variante || variante.stock === 0 || agregando}
                  >
                    {agregando ? <span className="spinner" /> : null}
                    {agregando ? 'Preparando…' : 'Comprar ahora'}
                  </button>
                  <button
                    type="button"
                    className="product-modal-agregar"
                    onClick={() => agregarAlCarrito(false)}
                    disabled={!variante || variante.stock === 0 || agregando}
                  >
                    {agregando ? <span className="spinner" /> : <Icon name="cart" size={18} />}
                    {agregando ? 'Agregando…' : 'Agregar al carrito'}
                  </button>
                </div>
                {errorCarrito && (
                  <p className="market-aviso" role="alert">
                    {errorCarrito} {errorCarrito.includes('carrito') && <Link href="/carrito">Ver carrito</Link>}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
