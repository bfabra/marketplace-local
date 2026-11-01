import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rechaza con 400 los parámetros que deberían ser UUID y no lo son.
 * Para los de la propia ruta: router.param('memberId', uuidParam).
 * Para los heredados del montaje (mergeParams), como middleware: validarIds('storeId').
 */
export const uuidParam = (_req: Request, _res: Response, next: NextFunction, valor: string) =>
  next(UUID.test(valor) ? undefined : new AppError('Identificador inválido', 400));

export const validarIds =
  (...nombres: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const invalido = nombres.some((n) => req.params[n] !== undefined && !UUID.test(req.params[n]));
    return next(invalido ? new AppError('Identificador inválido', 400) : undefined);
  };
