import { Prisma } from '@prisma/client';
import { AppError } from './app-error.js';

interface PgError {
  code: string;
  message: string;
}

// Prisma no expone el error de PostgreSQL de forma uniforme: en consultas raw
// viene en `meta`; en las de modelo, solo dentro del texto del mensaje.
export const extraerPgError = (err: unknown): PgError | null => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2010') {
    const meta = err.meta as { code?: string; message?: string } | undefined;
    if (meta?.code) {
      return { code: meta.code, message: (meta.message ?? '').replace(/^ERROR:\s*/, '') };
    }
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const match = err.message.match(/code: "(\w+)", message: "((?:[^"\\]|\\.)*)"/);
    if (match) return { code: match[1], message: match[2].replace(/\\(.)/g, '$1') };
  }
  return null;
};

/** ¿Falló porque otro registro todavía apunta a este (clave foránea)? */
export const esReferenciaEnUso = (err: unknown) =>
  (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') ||
  extraerPgError(err)?.code === '23503';

// Códigos propios de los paquetes pkg_* (RAISE ... USING ERRCODE = 'TC404').
const CODIGOS_PAQUETES: Record<string, number> = { TC400: 400, TC403: 403, TC404: 404, TC409: 409 };

/**
 * Traduce los errores de la base a respuestas HTTP.
 * Las reglas de negocio viven en triggers y funciones (RAISE EXCEPTION, código P0001
 * o los códigos TC de los paquetes) y sus mensajes ya están escritos para el usuario final.
 * Devuelve null si no es un error conocido.
 */
export const traducirErrorDb = (err: unknown): AppError | null => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return new AppError('Ya existe un registro con esos datos', 409);
      case 'P2003':
        return new AppError('Hace referencia a un registro que no existe', 400);
      case 'P2023':
        return new AppError('Identificador inválido', 400);
      case 'P2025':
        return new AppError('No se encontró el registro', 404);
    }
  }

  const pg = extraerPgError(err);
  if (!pg) return null;

  const status = CODIGOS_PAQUETES[pg.code];
  if (status) return new AppError(pg.message, status);

  switch (pg.code) {
    case 'P0001':
      return new AppError(pg.message, 400);
    case '42501':
      return new AppError('No tenés permiso para realizar esta acción', 403);
    case '23505':
      return new AppError('Ya existe un registro con esos datos', 409);
    case '23503':
      return new AppError('Hace referencia a un registro que no existe', 400);
    case '23514':
    case '23502':
    case '22P02':
      return new AppError('Algún dato no cumple las reglas de la plataforma', 400);
    default:
      return null;
  }
};
