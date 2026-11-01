import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { detalleTienda } from '@marketplace/contratos';
import { ejecutar, llamar, prisma, withUser } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { conContrato } from '../../common/utils/contrato.js';
import { borrarImagen, conUrlPerfil, guardarImagen } from '../../common/utils/images.js';
import { slugify } from '../../common/utils/slug.js';
import { CreateStoreInput, UpdateStoreInput } from './stores.schema.js';

const NO_ENCONTRADA = 'No encontramos esa tienda o no tenés acceso a ella';

export type TipoImagen = 'portada' | 'logo';
const MP_PRUEBA = 'PRUEBA-';

/** Teléfonos y ubicación en el mapa; solo manda lo que vino en el pedido. */
async function guardarContacto(
  tx: Prisma.TransactionClient,
  storeId: string,
  { telefonos, ubicacion }: Pick<UpdateStoreInput, 'telefonos' | 'ubicacion'>
) {
  const cambios = {
    ...(telefonos !== undefined && { telefonos }),
    ...(ubicacion !== undefined && { ubicacion }),
  };
  if (Object.keys(cambios).length === 0) return;
  await ejecutar(tx, Prisma.sql`select pkg_tiendas.guardar_contacto(${storeId}::uuid, ${JSON.stringify(cambios)}::jsonb)`);
}

export class StoresService {
  /**
   * La tienda nace "pendiente" y con el plan gratuito (Starter). La base pone al usuario como
   * dueño y rechaza una segunda tienda gratis del mismo dueño.
   */
  static async create(userId: string, data: CreateStoreInput) {
    const { telefonos, ubicacion, ...datos } = data;
    const id = await withUser(userId, async (tx) => {
      const nueva = await llamar<string>(
        tx,
        Prisma.sql`select pkg_tiendas.crear(${JSON.stringify(datos)}::jsonb, ${slugify(datos.nombre)}) as r`
      );
      await guardarContacto(tx, nueva, { telefonos, ubicacion });
      return nueva;
    });
    return StoresService.detail(userId, id);
  }

  /** Datos de la tienda para su panel, con lo que el usuario puede hacer en ella. */
  static async detail(userId: string, storeId: string) {
    const tienda = await withUser(userId, (tx) =>
      llamar<unknown>(tx, Prisma.sql`select pkg_tiendas.detalle(${storeId}::uuid) as r`)
    );
    if (!tienda) throw new AppError(NO_ENCONTRADA, 404);

    return {
      ...conUrlPerfil(conContrato(detalleTienda, 'pkg_tiendas.detalle', tienda)),
      mpPruebaDisponible: env.NODE_ENV !== 'production',
    };
  }

  /** Cambia la portada o el logo (sin archivo, la quita) y borra el archivo anterior. */
  static async changeImage(userId: string, storeId: string, tipo: TipoImagen, file?: Express.Multer.File) {
    // Se valida antes de escribir el archivo; cambiar_imagen vuelve a validar.
    const { permisos } = await StoresService.detail(userId, storeId);
    if (!permisos.includes('configuracion.editar')) {
      throw new AppError('No tenés permiso para modificar los datos de esta tienda', 403);
    }
    const ruta = file ? await guardarImagen(storeId, file, 'perfil') : null;
    try {
      const anterior = await withUser(userId, (tx) =>
        llamar<string | null>(tx, Prisma.sql`select pkg_tiendas.cambiar_imagen(${storeId}::uuid, ${tipo}, ${ruta}) as r`)
      );
      if (anterior) await borrarImagen(anterior);
    } catch (error) {
      if (ruta) await borrarImagen(ruta);
      throw error;
    }
    return StoresService.detail(userId, storeId);
  }

  static async update(userId: string, storeId: string, data: UpdateStoreInput) {
    const { telefonos, ubicacion, ...datos } = data;
    await withUser(userId, async (tx) => {
      await ejecutar(tx, Prisma.sql`select pkg_tiendas.actualizar(${storeId}::uuid, ${JSON.stringify(datos)}::jsonb)`);
      await guardarContacto(tx, storeId, { telefonos, ubicacion });
    });
    return StoresService.detail(userId, storeId);
  }

  /**
   * Solo en desarrollo: simula la vinculación con Mercado Pago, que la base exige
   * para activar una tienda. En producción esto lo hace el OAuth de Mercado Pago.
   */
  static async linkTestMercadoPago(userId: string, storeId: string) {
    if (env.NODE_ENV === 'production') throw new AppError('No disponible', 404);

    await ejecutar(prisma, Prisma.sql`select pkg_tiendas.vincular_mp_prueba(${userId}::uuid, ${storeId}::uuid)`);
    return StoresService.detail(userId, storeId);
  }

  /** Cuántos siguen a la tienda; la base exige que quien pregunta sea de la tienda. */
  static followers(userId: string, storeId: string) {
    return withUser(userId, (tx) => llamar(tx, Prisma.sql`select pkg_tiendas.seguidores(${storeId}::uuid) as r`));
  }

  static plans(userId: string, storeId: string) {
    return withUser(userId, (tx) => llamar(tx, Prisma.sql`select pkg_tiendas.planes(${storeId}::uuid) as r`));
  }

  /**
   * Los planes sin precio se activan al instante. Los pagos se cobran con Mercado Pago:
   * en desarrollo el pago se simula aprobado; en producción falta la integración real.
   */
  static async changePlan(userId: string, storeId: string, planId: string) {
    const { planes } = await StoresService.plans(userId, storeId) as { planes: { id: string; precio_mensual: number }[] };
    const plan = planes.find((p) => p.id === planId);
    if (!plan) throw new AppError('Ese plan no está disponible', 404);

    let pagoMp: string | null = null;
    if (plan.precio_mensual > 0) {
      if (env.NODE_ENV === 'production') throw new AppError('El pago de planes todavía no está disponible', 501);
      pagoMp = `${MP_PRUEBA}${randomUUID()}`;
    }

    await ejecutar(
      prisma,
      Prisma.sql`select pkg_tiendas.cambiar_plan(${userId}::uuid, ${storeId}::uuid, ${planId}::uuid, ${pagoMp})`
    );
    return StoresService.detail(userId, storeId);
  }
}
