export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatPrice(value: number) {
  return pesos.format(value);
}

export function fullName(nombre?: string | null, apellido?: string | null) {
  return [nombre, apellido].filter(Boolean).join(' ') || 'Sin nombre';
}
