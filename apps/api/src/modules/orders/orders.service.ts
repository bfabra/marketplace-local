import { Prisma } from '@prisma/client';
import { ejecutar, llamar, prisma, withUser } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { urlImagen } from '../../common/utils/images.js';
import { AddressInput, CreateOrderInput } from './orders.schema.js';

interface Checkout {
  carrito: { tiendas: { items: { imagen: string | null }[] }[] };
}

export class OrdersService {
  static addresses(userId: string) {
    return withUser(userId, (tx) => llamar(tx, Prisma.sql`select pkg_compras.direcciones() as r`));
  }

  static async saveAddress(userId: string, id: string | null, d: AddressInput) {
    await withUser(userId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_compras.guardar_direccion(
          ${id}::uuid, ${d.alias ?? null}, ${d.calle}, ${d.numero}, ${d.piso_depto ?? null},
          ${d.localidad_id}::uuid, ${d.codigo_postal ?? null}, ${d.referencias ?? null}, ${d.es_principal ?? false}
        ) as r`
      )
    );
    return OrdersService.addresses(userId);
  }

  static async removeAddress(userId: string, id: string) {
    await withUser(userId, (tx) => ejecutar(tx, Prisma.sql`select pkg_compras.borrar_direccion(${id}::uuid)`));
    return OrdersService.addresses(userId);
  }

  static async checkout(userId: string) {
    const datos = await withUser(userId, (tx) => llamar<Checkout>(tx, Prisma.sql`select pkg_compras.checkout() as r`));
    const tiendas = datos.carrito.tiendas.map((t) => ({
      ...t,
      items: t.items.map((i) => ({ ...i, imagen: i.imagen && urlImagen(i.imagen) })),
    }));
    return { ...datos, carrito: { ...datos.carrito, tiendas }, pagoSimulado: env.NODE_ENV !== 'production' };
  }

  /** Arma el pedido con el carrito, reserva el stock y devuelve a dónde ir a pagar. */
  static async create(userId: string, data: CreateOrderInput) {
    const id = await withUser(userId, (tx) =>
      llamar<string>(
        tx,
        Prisma.sql`select pkg_compras.crear_pedido(${data.direccion_id ?? null}::uuid, ${data.tiendas_retiro}::uuid[]) as r`
      )
    );
    return { id, pago: OrdersService.paymentUrl(id) };
  }

  // En producción acá se crea la preferencia de Mercado Pago y se devuelve su init_point.
  private static paymentUrl(id: string) {
    if (env.NODE_ENV === 'production') throw new AppError('El pago con Mercado Pago todavía no está disponible', 501);
    return `/pago-simulado/${id}`;
  }

  static list(userId: string) {
    return withUser(userId, (tx) => llamar(tx, Prisma.sql`select pkg_compras.mis_pedidos() as r`));
  }

  static async detail(userId: string, id: string) {
    const pedido = await withUser(userId, (tx) =>
      llamar<object | null>(tx, Prisma.sql`select pkg_compras.pedido(${id}::uuid) as r`)
    );
    if (!pedido) throw new AppError('No encontramos ese pedido', 404);
    return pedido;
  }

  /**
   * Reemplaza el aviso (webhook) de Mercado Pago mientras no hay integración real.
   * Corre con el usuario dueño de la base, como lo haría el webhook.
   */
  static async simulatePayment(userId: string, id: string, aprobado: boolean) {
    if (env.NODE_ENV === 'production') throw new AppError('No disponible', 404);
    const resultado = await llamar<{ estado_pago: string; partesSinStock: number }>(
      prisma,
      Prisma.sql`select pkg_compras.simular_pago(${userId}::uuid, ${id}::uuid, ${aprobado}) as r`
    );
    console.log(`[pago simulado] Pedido ${id}: ${resultado.estado_pago}`);
    return resultado;
  }
}
