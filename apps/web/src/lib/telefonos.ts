import type { TelefonoTienda, TipoTelefono } from '@/lib/api-client';

export const MAX_TELEFONOS = 5;

export const PAISES = [
  { codigo: '+54', etiqueta: 'AR (+54)' },
  { codigo: '+55', etiqueta: 'BR (+55)' },
  { codigo: '+56', etiqueta: 'CL (+56)' },
  { codigo: '+598', etiqueta: 'UY (+598)' },
  { codigo: '+595', etiqueta: 'PY (+595)' },
  { codigo: '+591', etiqueta: 'BO (+591)' },
  { codigo: '+51', etiqueta: 'PE (+51)' },
  { codigo: '+57', etiqueta: 'CO (+57)' },
  { codigo: '+58', etiqueta: 'VE (+58)' },
  { codigo: '+52', etiqueta: 'MX (+52)' },
  { codigo: '+1', etiqueta: 'US (+1)' },
  { codigo: '+34', etiqueta: 'ES (+34)' },
];

export const TIPOS_TELEFONO: Record<TipoTelefono, string> = {
  whatsapp: 'WhatsApp',
  celular: 'Celular',
  fijo: 'Fijo',
};

export const telefonoVacio = (tipo: TipoTelefono = 'whatsapp'): TelefonoTienda => ({ pais: '+54', numero: '', tipo });

/** Los que tienen número: las filas vacías no se guardan. */
export const telefonosCargados = (lista: TelefonoTienda[]) =>
  lista.map((t) => ({ ...t, numero: t.numero.trim() })).filter((t) => t.numero);

export const verTelefono = (t: TelefonoTienda) => `${t.pais} ${t.numero}`;

/** WhatsApp abre el chat; el resto, la llamada. En Argentina WhatsApp usa 54 9 + número sin el 15. */
export function enlaceTelefono(t: TelefonoTienda) {
  const digitos = t.numero.replace(/\D/g, '');
  const pais = t.pais.replace(/\D/g, '');
  if (t.tipo !== 'whatsapp') return `tel:+${pais}${digitos.replace(/^0/, '')}`;
  const local = digitos.replace(/^0/, '');
  return `https://wa.me/${pais}${pais === '54' && !local.startsWith('9') ? `9${local}` : local}`;
}

/** Lo mínimo antes de mandarlo; el API vuelve a validar. Devuelve errores con la ruta del API. */
export function validarTelefonos(lista: TelefonoTienda[]) {
  const errores: Record<string, string> = {};
  lista.forEach((t, i) => {
    const numero = t.numero.trim();
    if (numero && (!/^[0-9 ()-]+$/.test(numero) || numero.replace(/\D/g, '').length < 6))
      errores[`telefonos.${i}.numero`] = 'Usá solo números (mínimo 6), sin el código de país';
  });
  return errores;
}
