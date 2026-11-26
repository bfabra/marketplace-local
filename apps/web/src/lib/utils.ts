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

/** Input de precio ARS: solo dígitos; se formatean como moneda mientras se escribe (centavos). */
export function formatearPrecioInput(valor: string) {
  const raw = valor.replace(/\D/g, '');
  if (!raw) return '';
  const num = Number(raw) / 100;
  return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Convierte el texto tipado (`12.345,67`) a número. */
export function parsearPrecioInput(valor: string) {
  const limpio = valor.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!limpio) return NaN;
  return Number(limpio);
}

export function fullName(nombre?: string | null, apellido?: string | null) {
  return [nombre, apellido].filter(Boolean).join(' ') || 'Sin nombre';
}
