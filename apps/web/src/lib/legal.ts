import { BRAND_NAME } from '@/components/layout/logo';

/** Tiene que coincidir con TERMINOS_VERSION del API: es la versión que queda registrada al aceptar. */
export const VERSION_TERMINOS = '2026-10-11';
export const FECHA_TERMINOS = '11 de octubre de 2026';

/** Datos del titular de la plataforma: completarlos antes de publicar (los exige la Ley 25.326). */
export const TITULAR = {
  nombre: BRAND_NAME,
  razonSocial: null as string | null,
  cuit: null as string | null,
  domicilio: null as string | null,
  correo: null as string | null,
  jurisdiccion: 'la Ciudad de San Juan, Provincia de San Juan',
};
