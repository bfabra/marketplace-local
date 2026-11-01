'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError, type TarjetaProducto } from '@/lib/api-client';
import { useCart } from '@/hooks/use-cart';
import { useLocation } from '@/hooks/use-location';
import { useToast } from '@/hooks/use-toast';
import { descuento } from '@/lib/visual';
import { Price } from '@/components/ui/price';
import { Icon } from '@/components/ui/icon';
import { Rating } from '@/components/ui/rating';
import { FavoriteButton } from '@/components/ui/favorite-button';

export function ProductCard({
  producto,
  tiendaSlug,
  mostrarTienda = true,
}: {
  producto: TarjetaProducto;
  /** Para listados de una sola tienda, donde la tarjeta no trae la tienda. */
  tiendaSlug?: string;
  mostrarTienda?: boolean;
}) {
  const { agregar } = useCart();
  const { localidad } = useLocation();
  const toast = useToast();
  const [agregando, setAgregando] = useState(false);

  const slugTienda = producto.tienda?.slug ?? tiendaSlug ?? '';
  const href = `/tiendas/${slugTienda}/${producto.slug}`;
  const sinStock = producto.stock === 0;
  const pct = descuento(producto.precio, producto.precio_oferta);
  const cerca = !!localidad && producto.tienda?.localidad_id === localidad.id;

  async function agregarRapido() {
    if (!producto.variante_unica) return;
    setAgregando(true);
    try {
      await agregar(producto.variante_unica, 1);
      toast({ titulo: 'Agregado al carrito', texto: producto.nombre, accion: { href: '/carrito', label: 'Ver carrito' } });
    } catch (e) {
      toast({ tipo: 'error', titulo: 'No se pudo agregar', texto: e instanceof ApiError ? e.message : undefined });
    } finally {
      setAgregando(false);
    }
  }

  return (
    <article className={`pcard${sinStock ? ' pcard-agotada' : ''}`}>
      <div className="pcard-media">
        {producto.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={producto.imagen} alt="" loading="lazy" />
        ) : (
          <span className="pcard-sin-foto">
            <Icon name="image" size={32} strokeWidth={1.5} />
          </span>
        )}
        <div className="pcard-tags">
          {pct && <span className="tag tag-oferta">−{pct}%</span>}
          {producto.nuevo && !pct && <span className="tag tag-nuevo">Nuevo</span>}
        </div>
        <FavoriteButton productoId={producto.id} nombre={producto.nombre} className="pcard-fav" />
        {sinStock && <span className="pcard-agotado">Sin stock</span>}
      </div>

      <div className="pcard-body">
        {mostrarTienda && producto.tienda && (
          <span className={`pcard-tienda${cerca ? ' is-cerca' : ''}`}>
            <Icon name={cerca ? 'pin' : 'store'} size={13} />
            <span>
              {producto.tienda.nombre} · {producto.tienda.localidad}
            </span>
          </span>
        )}
        <h3 className="pcard-titulo">
          <Link href={href} className="pcard-link">
            {producto.nombre}
          </Link>
        </h3>
        {producto.calificacion && <Rating {...producto.calificacion} />}
        <div className="pcard-pie">
          <Price precio={producto.precio} oferta={producto.precio_oferta} desde={producto.desde} />
          {!sinStock &&
            (producto.variante_unica ? (
              <button
                type="button"
                className="pcard-agregar"
                onClick={agregarRapido}
                disabled={agregando}
                aria-label={`Agregar ${producto.nombre} al carrito`}
              >
                {agregando ? <span className="spinner" /> : <Icon name="plus" size={18} strokeWidth={2.5} />}
              </button>
            ) : (
              <Link href={href} className="pcard-agregar" aria-label={`Elegir opciones de ${producto.nombre}`} tabIndex={-1}>
                <Icon name="chevron-right" size={18} strokeWidth={2.5} />
              </Link>
            ))}
        </div>
      </div>
    </article>
  );
}
