import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { AuthenticatedRequest } from '../../common/middlewares/auth.middleware.js';
import { iniciarSesion, clearSessionCookie } from '../../common/utils/session-cookie.js';

// El token va solo en la cookie httpOnly: el código del navegador no puede leerlo.
export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.register(req.body);
      iniciarSesion(res, user.id);
      return res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.login(req.body);
      iniciarSesion(res, user.id, req.body.recordarme ? 'recordar' : 'navegador');
      return res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async google(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, nueva } = await AuthService.google(req.body);
      iniciarSesion(res, user.id);
      return res.status(nueva ? 201 : 200).json({ user, nueva });
    } catch (error) {
      next(error);
    }
  }

  static logout(_req: Request, res: Response) {
    clearSessionCookie(res);
    return res.status(204).end();
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.me(req.user!.id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.updateProfile(req.user!.id, req.body);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Cambiar la contraseña cierra las demás sesiones; la actual se renueva.
  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await AuthService.changePassword(req.user!.id, req.body);
      iniciarSesion(res, req.user!.id);
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
