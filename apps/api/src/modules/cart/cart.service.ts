import { Prisma } from '@prisma/client';
import { llamar, withUser } from '../../config/db.js';
import { urlImagen } from '../../common/utils/images.js';
import { CartItem } from './cart.schema.js';

interface Carrito {
  tiendas: { items: { imagen: string | null }[] }[];
}

const conUrls = (c: Carrito) => ({
  ...c,
  tiendas: c.tiendas.map((t) => ({
    ...t,
    items: t.items.map((i) => ({ ...i, imagen: i.imagen && urlImagen(i.imagen) })),
  })),
});

const comoUsuario = async (userId: string | null, consulta: Prisma.Sql) =>
  conUrls(await withUser(userId, (tx) => llamar<Carrito>(tx, consulta)));

export class CartService {
  /** Carrito del navegador, sin sesión: precios y stock de hoy. */
  static preview(items: CartItem[]) {
    return comoUsuario(null, Prisma.sql`select pkg_carrito.vista_previa(${JSON.stringify(items)}::jsonb) as r`);
  }

  static get(userId: string) {
    return comoUsuario(userId, Prisma.sql`select pkg_carrito.ver() as r`);
  }

  static add(userId: string, { variante_id, cantidad }: CartItem) {
    return comoUsuario(userId, Prisma.sql`select pkg_carrito.agregar(${variante_id}::uuid, ${cantidad}::int) as r`);
  }

  static setQuantity(userId: string, varianteId: string, cantidad: number) {
    return comoUsuario(
      userId,
      Prisma.sql`select pkg_carrito.cambiar_cantidad(${varianteId}::uuid, ${cantidad}::int) as r`
    );
  }

  static remove(userId: string, varianteId: string) {
    return comoUsuario(userId, Prisma.sql`select pkg_carrito.quitar(${varianteId}::uuid) as r`);
  }

  /** Al ingresar, el carrito del navegador se suma al guardado. */
  static merge(userId: string, items: CartItem[]) {
    return comoUsuario(userId, Prisma.sql`select pkg_carrito.unir(${JSON.stringify(items)}::jsonb) as r`);
  }
}
