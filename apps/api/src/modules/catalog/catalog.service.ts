import { Prisma } from '@prisma/client';
import { categorias, opcionesRubro, tiendasResumen } from '@marketplace/contratos';
import { llamar, withUser } from '../../config/db.js';
import { AppError } from '../../common/errors/app-error.js';
import { conContrato } from '../../common/utils/contrato.js';
import { conUrlPerfil, urlImagen } from '../../common/utils/images.js';
import type { BuscarQuery } from './catalog.schema.js';

interface Tarjeta {
  imagen: string | null;
}

interface Foto {
  id: string;
  ruta: string;
}

// La base devuelve la ruta de cada foto; la URL depende de dónde se guardan.
export const conUrlImagen = <T extends Tarjeta>(p: T) => ({ ...p, imagen: p.imagen && urlImagen(p.imagen) });
export const conUrlFotos = <T extends Foto>(fotos: T[]) =>
  fotos.map(({ ruta, ...f }) => ({ ...f, url: urlImagen(ruta) }));

// Todo se lee como visitante (rol anon): RLS solo deja ver tiendas activas
// y productos publicados.
const leer = <T>(consulta: Prisma.Sql) => withUser(null, (tx) => llamar<T>(tx, consulta));

const uuidONull = (id?: string) => (id ? Prisma.sql`${id}::uuid` : Prisma.sql`null::uuid`);

interface Inicio {
  populares: Tarjeta[];
  novedades: Tarjeta[];
}

interface Sugerencias {
  productos: Tarjeta[];
}

interface Resultados {
  productos: Tarjeta[];
}

export class CatalogService {
  static async categorias() {
    return conContrato(categorias, 'pkg_catalogo.categorias', await leer(Prisma.sql`select pkg_catalogo.categorias() as r`));
  }

  static atributos(categoriaId: string) {
    return leer(Prisma.sql`select pkg_catalogo.atributos_categoria(${categoriaId}::uuid) as r`);
  }

  static async rubros() {
    return conContrato(opcionesRubro, 'pkg_catalogo.rubros', await leer(Prisma.sql`select pkg_catalogo.rubros() as r`));
  }

  static async tiendas() {
    return conContrato(tiendasResumen, 'pkg_catalogo.tiendas', await leer(Prisma.sql`select pkg_catalogo.tiendas() as r`)).map(
      conUrlPerfil
    );
  }

  static async inicio(localidad?: string) {
    const r = await leer<Inicio>(Prisma.sql`select pkg_catalogo.inicio(${uuidONull(localidad)}) as r`);
    return { ...r, populares: r.populares.map(conUrlImagen), novedades: r.novedades.map(conUrlImagen) };
  }

  static async sugerencias(q: string | undefined, localidad?: string) {
    const r = await leer<Sugerencias>(
      Prisma.sql`select pkg_catalogo.sugerencias(${q ?? null}, ${uuidONull(localidad)}) as r`
    );
    return { ...r, productos: r.productos.map(conUrlImagen) };
  }

  static async buscar({ q, localidad, categoria, orden, pagina }: BuscarQuery) {
    const r = await leer<Resultados>(
      Prisma.sql`select pkg_catalogo.buscar(${q || null}, ${uuidONull(localidad)}, ${uuidONull(categoria)},
                                            ${orden}, ${pagina}::int) as r`
    );
    return { ...r, productos: r.productos.map(conUrlImagen) };
  }

  static async tienda(slug: string) {
    const tienda = await leer<{ productos: Tarjeta[]; portada: string | null; logo: string | null } | null>(
      Prisma.sql`select pkg_catalogo.tienda(${slug}) as r`
    );
    if (!tienda) throw new AppError('No encontramos esa tienda', 404);
    return { ...conUrlPerfil(tienda), productos: tienda.productos.map(conUrlImagen) };
  }

  static async producto(tiendaSlug: string, productoSlug: string) {
    const producto = await leer<{ imagenes: (Foto & { alt: string | null })[] } | null>(
      Prisma.sql`select pkg_catalogo.producto(${tiendaSlug}, ${productoSlug}) as r`
    );
    if (!producto) throw new AppError('No encontramos ese producto', 404);
    return { ...producto, imagenes: conUrlFotos(producto.imagenes) };
  }
}
