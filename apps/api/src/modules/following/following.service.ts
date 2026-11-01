import { Prisma } from '@prisma/client';
import { llamar, withUser } from '../../config/db.js';
import { conUrlImagen } from '../catalog/catalog.service.js';

interface Tarjeta {
  imagen: string | null;
}

type Estado = { ids: string[]; seguidores: number };

const comoUsuario = <T>(userId: string, consulta: Prisma.Sql) => withUser(userId, (tx) => llamar<T>(tx, consulta));

export class FollowingService {
  static ids(userId: string) {
    return comoUsuario<string[]>(userId, Prisma.sql`select pkg_seguidos.ids() as r`);
  }

  static follow(userId: string, tiendaId: string) {
    return comoUsuario<Estado>(userId, Prisma.sql`select pkg_seguidos.seguir(${tiendaId}::uuid) as r`);
  }

  static unfollow(userId: string, tiendaId: string) {
    return comoUsuario<Estado>(userId, Prisma.sql`select pkg_seguidos.dejar(${tiendaId}::uuid) as r`);
  }

  static async suggestions(userId: string) {
    const r = await comoUsuario<{ tiendas: unknown[]; productos: Tarjeta[] }>(
      userId,
      Prisma.sql`select pkg_seguidos.sugerencias() as r`
    );
    return { ...r, productos: r.productos.map(conUrlImagen) };
  }
}
