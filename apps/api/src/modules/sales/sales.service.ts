import { Prisma } from '@prisma/client';
import { llamar, withUser } from '../../config/db.js';
import { OrderStatusInput } from './sales.schema.js';

// Corre como el usuario: la base exige pedidos.ver o pedidos.gestionar en la tienda.
export class SalesService {
  static list(userId: string, storeId: string) {
    return withUser(userId, (tx) => llamar(tx, Prisma.sql`select pkg_ventas.listar(${storeId}::uuid) as r`));
  }

  static changeStatus(userId: string, storeId: string, orderId: string, { estado, motivo }: OrderStatusInput) {
    return withUser(userId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_ventas.cambiar_estado(
          ${storeId}::uuid, ${orderId}::uuid, ${estado}::public.estado_pedido_tienda, ${motivo ?? null}
        ) as r`
      )
    );
  }
}
