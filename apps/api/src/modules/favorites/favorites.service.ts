import { Prisma } from '@prisma/client';
import { llamar, withUser } from '../../config/db.js';
import { conUrlImagen } from '../catalog/catalog.service.js';

interface Tarjeta {
  imagen: string | null;
}

const comoUsuario = <T>(userId: string | null, consulta: Prisma.Sql) =>
  withUser(userId, (tx) => llamar<T>(tx, consulta));

const arregloUuid = (ids: string[]) => Prisma.sql`${ids}::uuid[]`;

export class FavoritesService {
  /** Favoritos del navegador, sin sesión. */
  static async preview(ids: string[]) {
    const productos = await comoUsuario<Tarjeta[]>(
      null,
      Prisma.sql`select pkg_favoritos.vista_previa(${arregloUuid(ids)}) as r`
    );
    return productos.map(conUrlImagen);
  }

  static async get(userId: string) {
    const r = await comoUsuario<{ ids: string[]; productos: Tarjeta[] }>(
      userId,
      Prisma.sql`select pkg_favoritos.ver() as r`
    );
    return { ...r, productos: r.productos.map(conUrlImagen) };
  }

  static ids(userId: string) {
    return comoUsuario<string[]>(userId, Prisma.sql`select pkg_favoritos.ids() as r`);
  }

  static add(userId: string, productoId: string) {
    return comoUsuario<string[]>(userId, Prisma.sql`select pkg_favoritos.agregar(${productoId}::uuid) as r`);
  }

  static remove(userId: string, productoId: string) {
    return comoUsuario<string[]>(userId, Prisma.sql`select pkg_favoritos.quitar(${productoId}::uuid) as r`);
  }

  /** Al ingresar, los favoritos del navegador se suman a la cuenta. */
  static merge(userId: string, ids: string[]) {
    return comoUsuario<string[]>(userId, Prisma.sql`select pkg_favoritos.unir(${arregloUuid(ids)}) as r`);
  }
}
