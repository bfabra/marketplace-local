import { CookieOptions, Response } from 'express';
import { env } from '../../config/env.js';
import { generateToken } from './jwt.js';

// La web (apps/web/src/middleware.ts) lee esta misma cookie para proteger rutas.
export const SESSION_COOKIE = 'tcl_sesion';

const options: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
};

const DIA = 24 * 60 * 60;

/**
 * Cuánto dura la sesión:
 *   navegador → hasta cerrar el navegador (y como mucho un día): ingresar sin "Recordarme";
 *   normal    → 7 días: al registrarse o entrar con Google;
 *   recordar  → 30 días: ingresar con "Recordarme".
 */
export type DuracionSesion = 'navegador' | 'normal' | 'recordar';

const SEGUNDOS: Record<DuracionSesion, number> = { navegador: DIA, normal: 7 * DIA, recordar: 30 * DIA };

export const iniciarSesion = (res: Response, userId: string, duracion: DuracionSesion = 'normal') => {
  const token = generateToken({ sub: userId }, SEGUNDOS[duracion]);
  res.cookie(SESSION_COOKIE, token, duracion === 'navegador' ? options : { ...options, maxAge: SEGUNDOS[duracion] * 1000 });
};

export const clearSessionCookie = (res: Response) => res.clearCookie(SESSION_COOKIE, options);
