import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

/** Envuelve un handler: responde el resultado en JSON (o 204 si no devuelve nada) y pasa los errores. */
export const responder =
  (fn: (req: AuthenticatedRequest) => Promise<unknown>, status = 200) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const resultado = await fn(req);
      if (resultado === undefined) return res.status(204).end();
      return res.status(status).json(resultado);
    } catch (error) {
      next(error);
    }
  };
