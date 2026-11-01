const soloDigitos = (cuit: string) => cuit.replace(/\D/g, '');

/** Valida el dígito verificador del CUIT/CUIL (módulo 11 de AFIP). */
export const cuitValido = (cuit: string) => {
  const d = soloDigitos(cuit);
  if (!/^\d{11}$/.test(d)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  return verificador !== 10 && verificador === Number(d[10]);
};

/** "20123456786" → "20-12345678-6" */
export const formatearCuit = (cuit: string) => {
  const d = soloDigitos(cuit);
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
};
