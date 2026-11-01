import { Icon } from './icon';

/** Calificación con estrellas. Solo se muestra cuando hay reseñas. */
export function Rating({ promedio, cantidad }: { promedio: number; cantidad: number }) {
  if (cantidad === 0) return null;
  const valor = promedio.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span className="rating" aria-label={`Calificación ${valor} de 5, ${cantidad} reseñas`}>
      <Icon name="star" size={14} filled />
      <strong>{valor}</strong>
      <span className="muted">({cantidad})</span>
    </span>
  );
}
