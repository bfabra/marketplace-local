import { formatPrice } from '@/lib/utils';

export function Price({
  precio,
  oferta,
  desde = false,
}: {
  precio: number | null;
  oferta: number | null;
  desde?: boolean;
}) {
  if (precio === null) return <span className="muted">Sin precio</span>;
  return (
    <span className="price">
      {desde && <small className="muted">Desde </small>}
      {oferta !== null ? (
        <>
          <span className="price-actual">{formatPrice(oferta)}</span>{' '}
          <s className="price-anterior">{formatPrice(precio)}</s>
        </>
      ) : (
        <span className="price-actual">{formatPrice(precio)}</span>
      )}
    </span>
  );
}
