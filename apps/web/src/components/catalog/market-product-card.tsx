'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, type TarjetaProducto } from '@/lib/api-client';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

export const enlaceProducto = (tiendaSlug: string, productoSlug: string) =>
  `/tiendas/${tiendaSlug}?producto=${encodeURIComponent(productoSlug)}`;

/**
 * Tarjeta de producto de la maqueta (Pantallas Cards.product): foto, precio y «+ Agregar».
 * Con `onAbrir` la ficha se abre en el lugar; el enlace sigue sirviendo para otra pestaña.
 */
export function MarketProductCard({
  producto,
  tiendaSlug,
  onAbrir,
}: {
  producto: TarjetaProducto;
  tiendaSlug: string;
  onAbrir?: () => void;
}) {
  const { agregar } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [agregando, setAgregando] = useState(false);
  const oferta = producto.precio_oferta !== null && producto.precio !== null && producto.precio_oferta < producto.precio;
  const precio = oferta ? producto.precio_oferta : producto.precio;
  const href = enlaceProducto(tiendaSlug, producto.slug);
  const sinStock = producto.stock === 0;

  async function agregarRapido(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Varias variantes: abrir ficha para elegir. Una sola: al carrito directo.
    if (!producto.variante_unica) {
      if (onAbrir) onAbrir();
      else router.push(href, { scroll: false });
      return;
    }

    setAgregando(true);
    try {
      await agregar(producto.variante_unica, 1);
      toast({ titulo: 'Agregado al carrito', texto: producto.nombre, accion: { href: '/carrito', label: 'Ver carrito' } });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo agregar', texto: err instanceof ApiError ? err.message : undefined });
    } finally {
      setAgregando(false);
    }
  }

  return (
    <article className="market-product-card">
      <Link
        href={href}
        scroll={false}
        className="product-image-button"
        aria-label={`Ver detalle de ${producto.nombre}`}
        onClick={(e) => {
          if (!onAbrir || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onAbrir();
        }}
      >
        {producto.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
        ) : (
          <i className="product-sin-foto" aria-hidden="true">
            <Icon name="image" size={36} strokeWidth={1.4} />
          </i>
        )}
        <span>Ver detalle</span>
      </Link>
      <small>{producto.categoria?.nombre ?? 'Producto'}</small>
      <h3>{producto.nombre}</h3>
      <div className="market-product-pie">
        <strong>
          {precio === null ? 'Consultar' : `${producto.desde ? 'Desde ' : ''}${formatPrice(precio)}`}
          {oferta && <del>{formatPrice(producto.precio!)}</del>}
        </strong>
        {!sinStock && (
          <button type="button" className="market-product-agregar" onClick={agregarRapido} disabled={agregando}>
            {agregando ? '…' : '+ Agregar'}
          </button>
        )}
      </div>
    </article>
  );
}
