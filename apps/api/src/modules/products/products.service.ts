import { Prisma } from '@prisma/client';
import { ejecutar, llamar, withUser } from '../../config/db.js';
import { AppError } from '../../common/errors/app-error.js';
import { slugify } from '../../common/utils/slug.js';
import { borrarImagen, guardarImagen } from '../../common/utils/images.js';
import { CatalogService, conUrlFotos, conUrlImagen } from '../catalog/catalog.service.js';
import { ProductInput, ProductState } from './products.schema.js';
import {
  AtributoCategoria,
  ErrorImportacion,
  generarPlantilla,
  leerArchivo,
  validarFilas,
} from './importacion.js';

interface Listado {
  productos: { imagen: string | null }[];
  limite: { plan: string | null; max: number | null; publicados: number };
}

interface ResultadoDb {
  guardado: boolean;
  productos: { codigo: string; id?: string; estado: string; motivo_pausa: string | null; aviso: string | null }[];
  errores: { codigo: string; nombre: string; mensaje: string }[];
}

/** La categoría tiene que existir y ser del último nivel (sin subcategorías). */
async function categoriaFinal(categoriaId: string) {
  const lista = await CatalogService.categorias();
  const categoria = lista.find((c) => c.id === categoriaId);
  if (!categoria) throw new AppError('La categoría no existe', 404);
  if (lista.some((c) => c.padre_id === categoria.id)) {
    throw new AppError(`Elegí una subcategoría de «${categoria.etiqueta}»`, 400);
  }
  const atributos = (await CatalogService.atributos(categoriaId)) as AtributoCategoria[];
  return { categoria, atributos };
}

// Todo corre con el rol del usuario: permisos, límites del plan y la variante
// obligatoria para publicar los controla la base.
export class ProductsService {
  static async list(userId: string, storeId: string) {
    const listado = await withUser(userId, (tx) =>
      llamar<Listado>(tx, Prisma.sql`select pkg_productos.listar(${storeId}::uuid) as r`)
    );
    return { ...listado, productos: listado.productos.map(conUrlImagen) };
  }

  static async detail(userId: string, storeId: string, productId: string) {
    const producto = await withUser(userId, (tx) =>
      llamar<{ imagenes: { id: string; ruta: string }[] } | null>(
        tx,
        Prisma.sql`select pkg_productos.detalle(${storeId}::uuid, ${productId}::uuid) as r`
      )
    );
    if (!producto) throw new AppError('No encontramos ese producto en esta tienda', 404);
    return { ...producto, imagenes: conUrlFotos(producto.imagenes) };
  }

  /** El producto nace como borrador; para publicarlo se usa changeState. */
  static async create(userId: string, storeId: string, data: ProductInput) {
    const id = await ProductsService.guardar(userId, storeId, null, data);
    return ProductsService.detail(userId, storeId, id);
  }

  /**
   * Reemplaza los datos del producto. Las variantes se reconocen por su combinación
   * de opciones: las que ya no están se desactivan (pueden tener ventas asociadas).
   */
  static async update(userId: string, storeId: string, productId: string, data: ProductInput) {
    await ProductsService.guardar(userId, storeId, productId, data);
    return ProductsService.detail(userId, storeId, productId);
  }

  private static guardar(userId: string, storeId: string, productId: string | null, data: ProductInput) {
    return withUser(userId, (tx) =>
      llamar<string>(
        tx,
        Prisma.sql`select pkg_productos.guardar(${storeId}::uuid, ${productId}::uuid,
                                                ${JSON.stringify(data)}::jsonb, ${slugify(data.nombre)}) as r`
      )
    );
  }

  /** Plantilla de Excel con las columnas de la ficha y las variantes de la categoría. */
  static async template(categoriaId: string) {
    const { categoria, atributos } = await categoriaFinal(categoriaId);
    return {
      archivo: await generarPlantilla(categoria, atributos),
      nombre: `plantilla-${slugify(categoria.etiqueta)}.xlsx`,
    };
  }

  /**
   * Lee el archivo, revisa cada fila y, si el formato está bien, se lo pasa a la base:
   * sin confirmar solo prueba (vista previa); al confirmar guarda todo o nada.
   */
  static async import(
    userId: string,
    storeId: string,
    archivo: { buffer: Buffer; originalname: string },
    opciones: { categoriaId: string | null; publicar: boolean; confirmar: boolean }
  ) {
    const leido = await leerArchivo(archivo);
    const categoriaId = leido.categoriaId ?? opciones.categoriaId;
    if (!categoriaId) throw new AppError('Elegí la categoría de los productos', 400);
    const { categoria, atributos } = await categoriaFinal(categoriaId);
    const { productos, errores, avisos } = validarFilas(leido, atributos, categoriaId);

    const resumen = productos.map((p) => ({
      codigo: p.codigo,
      nombre: p.datos.nombre,
      filas: p.filas,
      variantes: p.datos.variantes.length,
      precio: Math.min(...p.datos.variantes.map((v) => v.precio)),
      stock: p.datos.variantes.reduce((total, v) => total + v.stock, 0),
      id: null as string | null,
      estado: null as string | null,
      motivo_pausa: null as string | null,
      aviso: null as string | null,
    }));
    const respuesta = {
      categoria: { id: categoria.id, etiqueta: categoria.etiqueta },
      filas: leido.filas.length,
      avisos,
      guardado: false,
      productos: resumen,
      errores: errores as ErrorImportacion[],
    };
    if (errores.length) return respuesta;

    const datos = productos.map((p) => ({ codigo: p.clave, slug: slugify(p.datos.nombre), datos: p.datos }));
    const r = await withUser(
      userId,
      (tx) =>
        llamar<ResultadoDb>(
          tx,
          Prisma.sql`select pkg_productos.importar(${storeId}::uuid, ${JSON.stringify(datos)}::jsonb,
                                                   ${opciones.publicar}, ${!opciones.confirmar}) as r`
        ),
      { timeout: 120_000 }
    );

    const porClave = new Map(productos.map((p, i) => [p.clave, i]));
    for (const p of r.productos) {
      const i = porClave.get(p.codigo)!;
      Object.assign(resumen[i], { id: p.id ?? null, estado: p.estado, motivo_pausa: p.motivo_pausa, aviso: p.aviso });
    }
    respuesta.errores = r.errores.map((e) => {
      const p = productos[porClave.get(e.codigo)!];
      return { fila: p.filas[0], columna: null, mensaje: `${p.datos.nombre}: ${e.mensaje}` };
    });
    respuesta.guardado = r.guardado;
    return respuesta;
  }

  static changeState(userId: string, storeId: string, productId: string, estado: ProductState) {
    return withUser(userId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_productos.cambiar_estado(${storeId}::uuid, ${productId}::uuid,
                                                       ${estado}::public.estado_producto) as r`
      )
    );
  }

  static async remove(userId: string, storeId: string, productId: string) {
    const rutas = await withUser(userId, (tx) =>
      llamar<string[]>(tx, Prisma.sql`select pkg_productos.borrar(${storeId}::uuid, ${productId}::uuid) as r`)
    );
    await Promise.all(rutas.map(borrarImagen));
  }

  static async addImages(userId: string, storeId: string, productId: string, files: Express.Multer.File[]) {
    // Se valida antes de escribir los archivos; agregar_imagenes vuelve a validar.
    await withUser(userId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_productos.validar_imagenes(${storeId}::uuid, ${productId}::uuid, ${files.length}::int) as r`
      )
    );

    const guardadas: string[] = [];
    try {
      for (const file of files) guardadas.push(await guardarImagen(storeId, file));
      await withUser(userId, (tx) =>
        ejecutar(
          tx,
          Prisma.sql`select pkg_productos.agregar_imagenes(${storeId}::uuid, ${productId}::uuid, ${guardadas}::text[])`
        )
      );
    } catch (error) {
      await Promise.all(guardadas.map(borrarImagen));
      throw error;
    }
    return ProductsService.detail(userId, storeId, productId);
  }

  static async removeImage(userId: string, storeId: string, productId: string, imageId: string) {
    const ruta = await withUser(userId, (tx) =>
      llamar<string>(
        tx,
        Prisma.sql`select pkg_productos.borrar_imagen(${storeId}::uuid, ${productId}::uuid, ${imageId}::uuid) as r`
      )
    );
    await borrarImagen(ruta);
    return ProductsService.detail(userId, storeId, productId);
  }

  /** La foto principal es la de menor orden: se usa en listados y tarjetas. */
  static async setMainImage(userId: string, storeId: string, productId: string, imageId: string) {
    await withUser(userId, (tx) =>
      ejecutar(
        tx,
        Prisma.sql`select pkg_productos.imagen_principal(${storeId}::uuid, ${productId}::uuid, ${imageId}::uuid)`
      )
    );
    return ProductsService.detail(userId, storeId, productId);
  }
}
