import { redirect } from 'next/navigation';
import { enlaceProducto } from '@/components/catalog/market-product-card';

/** La ficha de producto se abre encima del perfil de la tienda, como en la maqueta. */
export default function PublicProductPage({ params }: { params: { slug: string; producto: string } }) {
  redirect(enlaceProducto(params.slug, decodeURIComponent(params.producto)));
}
