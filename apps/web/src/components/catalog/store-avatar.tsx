import { iniciales, tonoDe, visualCategoria } from '@/lib/visual';

/** Las tiendas todavía no suben logo: se muestran sus iniciales con el color de su rubro. */
export function StoreAvatar({
  nombre,
  rubro,
  className = '',
}: {
  nombre: string;
  rubro?: string | null;
  className?: string;
}) {
  const tono = rubro ? visualCategoria(rubro).tono : tonoDe(nombre);
  return (
    <span className={`store-avatar ${className}`} style={{ background: tono.bg, color: tono.fg }} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}
