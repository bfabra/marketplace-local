/** Misma regla que apps/api/src/common/utils/cuit.ts (AFIP módulo 11). */

export function soloDigitosCuit(cuit: string) {
  return cuit.replace(/\D/g, '');
}

export function formatearCuit(valor: string) {
  const d = soloDigitosCuit(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

function digitoVerificadorAfip(primeros10: string) {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(primeros10[i]), 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 11) verificador = 0;
  if (verificador === 10) verificador = 9;
  return verificador;
}

export function cuitValido(cuit: string) {
  const d = soloDigitosCuit(cuit);
  if (!/^\d{11}$/.test(d)) return false;
  return digitoVerificadorAfip(d.slice(0, 10)) === Number(d[10]);
}

/** Mensaje según si faltan dígitos o falla el verificador AFIP. */
export function mensajeCuitInvalido(cuit: string) {
  const d = soloDigitosCuit(cuit);
  if (d.length !== 11) {
    return 'Ingresá los 11 dígitos de tu CUIT/CUIL (ej. 20-12345678-6)';
  }
  return 'El último dígito no coincide con el verificador de AFIP. Revisá tu CUIT/CUIL completo';
}
