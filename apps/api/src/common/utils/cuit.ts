const soloDigitos = (cuit: string) => cuit.replace(/\D/g, '');

/**
 * Valida el dígito verificador del CUIT/CUIL (módulo 11 de AFIP).
 * Cuando el resto da 10, AFIP usa 9 (no se descarta el número).
 */
export const cuitValido = (cuit: string) => {
  const d = soloDigitos(cuit);
  if (!/^\d{11}$/.test(d)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(d[i]), 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 11) verificador = 0;
  if (verificador === 10) verificador = 9;
  return verificador === Number(d[10]);
};

/** "20123456786" → "20-12345678-6" */
export const formatearCuit = (cuit: string) => {
  const d = soloDigitos(cuit);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
};
