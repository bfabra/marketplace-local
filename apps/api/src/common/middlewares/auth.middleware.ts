import { Request, Response, NextFunction } from 'express';
import { Prisma, rol_plataforma } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { verifyToken } from '../utils/jwt.js';
import { SESSION_COOKIE, clearSessionCookie } from '../utils/session-cookie.js';
import { controlSesion, MENSAJE_CUENTA_BLOQUEADA, sesionVencida } from '../utils/bloqueos.js';
import { llamar, prisma } from '../../config/db.js';

export interface AuthUser {
  id: string;
}

// Extendemos Request de Express para incluir la propiedad user
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Middleware para verificar la validez del token JWT.
 * La web lo manda en la cookie de sesión; otros clientes, en el header Authorization.
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : (req.cookies?.[SESSION_COOKIE] as string | undefined);

  if (!token) {
    return next(new AppError('No iniciaste sesión', 401));
  }

  let userId: string;
  let iat: number;
  try {
    ({ sub: userId, iat } = verifyToken(token));
  } catch (error) {
    return next(new AppError('Tu sesión expiró, volvé a ingresar', 401));
  }

  try {
    // Una cuenta bloqueada pierde también las sesiones que tenía abiertas.
    const control = await controlSesion(userId);
    if (control.bloqueada) {
      clearSessionCookie(res);
      return next(new AppError(MENSAJE_CUENTA_BLOQUEADA, 401));
    }
    if (sesionVencida(iat, control)) {
      clearSessionCookie(res);
      return next(new AppError('Cambiaste tu contraseña: volvé a ingresar', 401));
    }
  } catch (error) {
    return next(error);
  }

  req.user = { id: userId };
  return next();
};

/**
 * Middleware para rutas de administración de la plataforma.
 * Mismo criterio que public.es_admin(): el superadmin cuenta como todos los roles.
 * Los permisos dentro de una tienda (dueño, empleados) los resuelve RLS vía withUser.
 */
export const authorizeAdmin = (...allowedRoles: rol_plataforma[]) => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Usuario no autenticado', 401));
    }

    try {
      const autorizado = await llamar<boolean>(
        prisma,
        Prisma.sql`select pkg_admin.tiene_rol(${req.user.id}::uuid, ${allowedRoles}::text[]) as r`
      );

      if (!autorizado) {
        return next(
          new AppError('No tenés permiso para realizar esta acción', 403)
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
