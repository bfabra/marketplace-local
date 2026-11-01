import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

/** Bucket público definido en ..._1500_storage_imagenes.sql */
export const BUCKET_IMAGENES = 'productos';

// apps/api/uploads — solo se usa si no hay Supabase Storage configurado.
export const UPLOADS_DIR = fileURLToPath(new URL('../../../uploads/', import.meta.url));

/** True cuando las fotos van a Supabase (producción / staging). */
export const usaStorageRemoto = () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

let clienteStorage: SupabaseClient | null = null;

const storage = () => {
  if (!usaStorageRemoto()) return null;
  if (!clienteStorage) {
    clienteStorage = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return clienteStorage;
};

export const TIPOS_IMAGEN: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * URL pública de una imagen.
 * - Con Supabase: URL del bucket público.
 * - Sin Supabase (dev local): ruta servida por express.static en /api/uploads.
 */
export const urlImagen = (rutaStorage: string) => {
  if (usaStorageRemoto()) {
    const base = env.SUPABASE_URL!.replace(/\/$/, '');
    return `${base}/storage/v1/object/public/${BUCKET_IMAGENES}/${rutaStorage}`;
  }
  return `/api/uploads/${rutaStorage}`;
};

/** Portada y logo de la tienda: la base guarda la ruta y se responde la URL. */
export const conUrlPerfil = <T extends { portada?: string | null; logo?: string | null }>(t: T) => ({
  ...t,
  portada: t.portada ? urlImagen(t.portada) : null,
  logo: t.logo ? urlImagen(t.logo) : null,
});

/** Guarda la foto con un nombre aleatorio; la ruta sigue la convención del bucket. */
export const guardarImagen = async (
  tiendaId: string,
  file: Express.Multer.File,
  destino: 'productos' | 'perfil' = 'productos'
) => {
  const carpeta = `tiendas/${tiendaId}/${destino}`;
  const rutaStorage = `${carpeta}/${randomUUID()}.${TIPOS_IMAGEN[file.mimetype]}`;
  const sb = storage();

  if (sb) {
    const { error } = await sb.storage.from(BUCKET_IMAGENES).upload(rutaStorage, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (error) throw new AppError(`No se pudo guardar la imagen: ${error.message}`, 500);
    return rutaStorage;
  }

  await mkdir(path.join(UPLOADS_DIR, carpeta), { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, rutaStorage), file.buffer);
  return rutaStorage;
};

export const borrarImagen = async (rutaStorage: string) => {
  const sb = storage();
  if (sb) {
    await sb.storage.from(BUCKET_IMAGENES).remove([rutaStorage]).catch(() => undefined);
    return;
  }
  await unlink(path.join(UPLOADS_DIR, rutaStorage)).catch(() => undefined);
};
