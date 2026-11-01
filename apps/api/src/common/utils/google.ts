import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export interface CuentaGoogle {
  sub: string;
  email: string;
  nombre: string;
  apellido: string;
  avatar: string | null;
}

const EMISORES = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Verifica el token que entrega el botón "Continuar con Google" (Google Identity
 * Services) con el servicio oficial de Google: firma, vencimiento y que sea para
 * nuestra aplicación.
 */
export async function verificarTokenGoogle(credencial: string): Promise<CuentaGoogle> {
  if (!env.GOOGLE_CLIENT_ID) throw new AppError('El ingreso con Google no está habilitado', 404);

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credencial)}`);
  if (!res.ok) throw new AppError('No pudimos validar tu cuenta de Google. Probá de nuevo', 401);
  const t = (await res.json()) as Record<string, string | undefined>;

  if (
    t.aud !== env.GOOGLE_CLIENT_ID ||
    !EMISORES.includes(t.iss ?? '') ||
    Number(t.exp) * 1000 < Date.now() ||
    !t.sub ||
    !t.email
  ) {
    throw new AppError('No pudimos validar tu cuenta de Google. Probá de nuevo', 401);
  }
  if (t.email_verified !== 'true') {
    throw new AppError('Tu correo de Google no está verificado', 401);
  }

  return {
    sub: t.sub,
    email: t.email.toLowerCase(),
    nombre: t.given_name || t.name || t.email.split('@')[0],
    apellido: t.family_name ?? '',
    avatar: t.picture ?? null,
  };
}
