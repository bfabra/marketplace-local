import { Request, Response, NextFunction } from 'express';
import { AppError } from './app-error.js';
import { traducirErrorDb } from './db-error.js';
import { ZodError } from 'zod';
import { MulterError } from 'multer';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const appError = err instanceof AppError ? err : traducirErrorDb(err);
  if (appError) {
    return res.status(appError.statusCode).json({ error: appError.message });
  }

  if (err instanceof MulterError) {
    const mensajes: Partial<Record<MulterError['code'], string>> = {
      LIMIT_FILE_SIZE: 'Cada foto puede pesar hasta 5 MB',
      LIMIT_FILE_COUNT: 'Podés subir hasta 8 fotos a la vez',
      LIMIT_UNEXPECTED_FILE: 'Archivo inesperado en el formulario',
    };
    return res.status(400).json({ error: mensajes[err.code] ?? 'No pudimos recibir las fotos' });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Revisá los datos marcados',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
};
