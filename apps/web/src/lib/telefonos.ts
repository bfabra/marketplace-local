import type { TelefonoTienda, TipoTelefono } from '@/lib/api-client';

/** Maqueta #merchant: hasta 3 teléfonos de contacto. */
export const MAX_TELEFONOS = 3;

/**
 * Dígitos del número nacional argentino (código de área + abonado), sin +54 / 9 / 0 / 15.
 * ENACOM PFNN: longitud fija de 10; el área (2–4) y el abonado (6–8) varían, la suma no.
 */
export const DIGITOS_TELEFONO_AR = 10;

/** Países LATAM (+ códigos habituales) — maqueta #signup. */
export const PAISES = [
  { codigo: '+54', etiqueta: 'Argentina (+54)' },
  { codigo: '+591', etiqueta: 'Bolivia (+591)' },
  { codigo: '+55', etiqueta: 'Brasil (+55)' },
  { codigo: '+56', etiqueta: 'Chile (+56)' },
  { codigo: '+57', etiqueta: 'Colombia (+57)' },
  { codigo: '+506', etiqueta: 'Costa Rica (+506)' },
  { codigo: '+53', etiqueta: 'Cuba (+53)' },
  { codigo: '+593', etiqueta: 'Ecuador (+593)' },
  { codigo: '+503', etiqueta: 'El Salvador (+503)' },
  { codigo: '+502', etiqueta: 'Guatemala (+502)' },
  { codigo: '+504', etiqueta: 'Honduras (+504)' },
  { codigo: '+52', etiqueta: 'México (+52)' },
  { codigo: '+505', etiqueta: 'Nicaragua (+505)' },
  { codigo: '+507', etiqueta: 'Panamá (+507)' },
  { codigo: '+595', etiqueta: 'Paraguay (+595)' },
  { codigo: '+51', etiqueta: 'Perú (+51)' },
  { codigo: '+598', etiqueta: 'Uruguay (+598)' },
  { codigo: '+58', etiqueta: 'Venezuela (+58)' },
  { codigo: '+1', etiqueta: 'EE.UU. / Canadá (+1)' },
  { codigo: '+34', etiqueta: 'España (+34)' },
];

/** Arma el texto de perfil a partir de país / tipo / número (#signup). */
export function armarTelefonoPerfil(pais: string, tipo: TipoTelefono, numero: string) {
  const digitos = numero.replace(/\D/g, '');
  if (!digitos) return undefined;
  const local = digitos.replace(/^0/, '');
  return `${prefijoTelefono(pais, tipo)} ${local}`;
}

export const TIPOS_TELEFONO: Record<TipoTelefono, string> = {
  whatsapp: 'WhatsApp',
  celular: 'Celular',
  fijo: 'Fijo',
};

/**
 * Prefijo visible en el input (AR: fijo = +54, celular/WhatsApp = +549).
 * Maqueta #merchant / onboarding + regla AR.
 */
export function prefijoTelefono(pais: string, tipo: TipoTelefono) {
  if (pais === '+54' || pais.includes('+54')) {
    return tipo === 'fijo' ? '+54' : '+549';
  }
  return pais.startsWith('+') ? pais : `+${pais}`;
}

export const telefonoVacio = (tipo: TipoTelefono = 'whatsapp'): TelefonoTienda => ({ pais: '+54', numero: '', tipo });

/** Los que tienen número: las filas vacías no se guardan. */
export const telefonosCargados = (lista: TelefonoTienda[]) =>
  lista.map((t) => ({ ...t, numero: t.numero.trim() })).filter((t) => t.numero);

export const verTelefono = (t: TelefonoTienda) => `${prefijoTelefono(t.pais, t.tipo)} ${t.numero}`;

/** WhatsApp abre el chat; el resto, la llamada. En Argentina WhatsApp/celular usan 549 + número sin el 15. */
export function enlaceTelefono(t: TelefonoTienda) {
  const digitos = t.numero.replace(/\D/g, '');
  const local = digitos.replace(/^0/, '');
  const pais = t.pais.replace(/\D/g, '');
  const esArMovil = pais === '54' && t.tipo !== 'fijo';
  const e164 = esArMovil
    ? `549${local.replace(/^9/, '')}`
    : `${pais}${local}`;
  if (t.tipo === 'whatsapp') return `https://wa.me/${e164}`;
  return `tel:+${e164}`;
}

/** Normaliza a solo dígitos y recorta al máximo nacional (10). */
export function soloDigitosTelefono(valor: string, max = DIGITOS_TELEFONO_AR) {
  return valor.replace(/\D/g, '').slice(0, max);
}

function esArgentina(pais: string) {
  return pais === '+54' || pais.includes('+54');
}

/** Lo mínimo antes de mandarlo; el API vuelve a validar. Devuelve errores con la ruta del API. */
export function validarTelefonos(lista: TelefonoTienda[]) {
  const errores: Record<string, string> = {};
  lista.forEach((t, i) => {
    const numero = t.numero.trim();
    if (!numero) return;
    const digitos = numero.replace(/\D/g, '');
    if (!/^[0-9 ()-]+$/.test(numero)) {
      errores[`telefonos.${i}.numero`] = 'Usá solo números, sin el código de país';
      return;
    }
    if (esArgentina(t.pais)) {
      if (digitos.length !== DIGITOS_TELEFONO_AR) {
        errores[`telefonos.${i}.numero`] =
          `En Argentina el número tiene ${DIGITOS_TELEFONO_AR} dígitos (código de área + número, sin 0 ni 15)`;
      }
      return;
    }
    if (digitos.length < 6 || digitos.length > DIGITOS_TELEFONO_AR) {
      errores[`telefonos.${i}.numero`] = `Usá entre 6 y ${DIGITOS_TELEFONO_AR} dígitos, sin el código de país`;
    }
  });
  return errores;
}
