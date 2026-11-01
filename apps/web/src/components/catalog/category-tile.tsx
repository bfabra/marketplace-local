import Link from 'next/link';
import { plural, visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';

export function CategoryTile({
  id,
  nombre,
  slug,
  productos,
}: {
  id: string;
  nombre: string;
  slug: string;
  productos?: number;
}) {
  const { icono, tono } = visualCategoria(slug);
  return (
    <Link href={`/buscar?categoria=${id}`} className="cat-tile">
      <span className="cat-tile-icono" style={{ background: tono.bg, color: tono.fg }}>
        <Icon name={icono} size={26} strokeWidth={1.75} />
      </span>
      <span className="cat-tile-nombre">{nombre}</span>
      {productos !== undefined && (
        <span className="cat-tile-cantidad">{productos > 0 ? plural(productos, 'producto', 'productos') : 'Muy pronto'}</span>
      )}
    </Link>
  );
}
