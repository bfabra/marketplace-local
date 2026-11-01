import { Prisma } from '@prisma/client';
import { rubrosAdmin } from '@marketplace/contratos';
import { ejecutar, llamar, prisma, withUser } from '../../config/db.js';
import { AppError } from '../../common/errors/app-error.js';
import { conContrato } from '../../common/utils/contrato.js';
import { slugify } from '../../common/utils/slug.js';
import type { AttributeInput, CategoryAttributeInput, CategoryInput, ShippingRateInput } from './catalogo-admin.schema.js';

/**
 * Catálogo (categorías y atributos, para moderación) y territorio (provincias,
 * localidades y tarifas, para logística).
 * Las lecturas corren como servidor porque cuentan productos, tiendas y direcciones
 * de todos; la ruta ya exige el rol. Los cambios corren como el admin: la base
 * valida el rol y la auditoría registra quién fue.
 */
export class CatalogAdminService {
  static categories() {
    return llamar(prisma, Prisma.sql`select pkg_admin.categorias() as r`);
  }

  static async category(id: string) {
    const categoria = await llamar(prisma, Prisma.sql`select pkg_admin.categoria(${id}::uuid) as r`);
    if (!categoria) throw new AppError('No encontramos esa categoría', 404);
    return categoria;
  }

  /** La dirección web sale del nombre al crearla y no cambia al renombrar. */
  static saveCategory(adminId: string, id: string | null, data: CategoryInput) {
    return withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.guardar_categoria(${id}::uuid, ${data.nombre},
                     ${id ? null : slugify(data.nombre)}, ${data.padre_id ?? null}::uuid,
                     ${data.comision_pct}::numeric) as r`
      )
    );
  }

  static setCategoryActive(adminId: string, id: string, activa: boolean) {
    return withUser(adminId, (tx) =>
      llamar(tx, Prisma.sql`select pkg_admin.activar_categoria(${id}::uuid, ${activa}::boolean) as r`)
    );
  }

  /** Lo que se publique en la categoría (y sus subcategorías) pasa por moderación. */
  static async setCategoryReview(adminId: string, id: string, requiere: boolean) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.revision_categoria(${id}::uuid, ${requiere}::boolean)`)
    );
    return CatalogAdminService.category(id);
  }

  static async moveCategory(adminId: string, id: string, direccion: 'subir' | 'bajar') {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.ordenar_categoria(${id}::uuid, ${direccion})`)
    );
    return CatalogAdminService.categories();
  }

  static async deleteCategory(adminId: string, id: string) {
    await withUser(adminId, (tx) => ejecutar(tx, Prisma.sql`select pkg_admin.eliminar_categoria(${id}::uuid)`));
    return { ok: true };
  }

  static async saveCategoryAttribute(adminId: string, id: string, atributoId: string, data: CategoryAttributeInput) {
    await withUser(adminId, (tx) =>
      ejecutar(
        tx,
        Prisma.sql`select pkg_admin.guardar_atributo_categoria(${id}::uuid, ${atributoId}::uuid,
                     ${data.obligatorio}::boolean, ${data.define_variante}::boolean)`
      )
    );
    return CatalogAdminService.category(id);
  }

  static async removeCategoryAttribute(adminId: string, id: string, atributoId: string) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.quitar_atributo_categoria(${id}::uuid, ${atributoId}::uuid)`)
    );
    return CatalogAdminService.category(id);
  }

  static attributes() {
    return llamar(prisma, Prisma.sql`select pkg_admin.atributos() as r`);
  }

  static async saveAttribute(adminId: string, id: string | null, data: AttributeInput) {
    await withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.guardar_atributo(${id}::uuid, ${data.nombre}, ${data.tipo}::public.tipo_atributo,
                     ${data.unidad ?? null}, ${data.filtrable}::boolean) as r`
      )
    );
    return CatalogAdminService.attributes();
  }

  static async deleteAttribute(adminId: string, id: string) {
    await withUser(adminId, (tx) => ejecutar(tx, Prisma.sql`select pkg_admin.eliminar_atributo(${id}::uuid)`));
    return CatalogAdminService.attributes();
  }

  static async saveOption(adminId: string, atributoId: string, opcionId: string | null, valor: string) {
    await withUser(adminId, (tx) =>
      llamar(tx, Prisma.sql`select pkg_admin.guardar_opcion(${atributoId}::uuid, ${opcionId}::uuid, ${valor}) as r`)
    );
    return CatalogAdminService.attributes();
  }

  static async deleteOption(adminId: string, opcionId: string) {
    await withUser(adminId, (tx) => ejecutar(tx, Prisma.sql`select pkg_admin.eliminar_opcion(${opcionId}::uuid)`));
    return CatalogAdminService.attributes();
  }

  static async rubros() {
    return conContrato(rubrosAdmin, 'pkg_admin.rubros', await llamar(prisma, Prisma.sql`select pkg_admin.rubros() as r`));
  }

  /** Crea (con padre_id o como rubro principal) o renombra. El slug no cambia al renombrar. */
  static async saveRubro(adminId: string, id: string | null, nombre: string, padreId: string | null = null) {
    await withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.guardar_rubro(${id}::uuid, ${nombre}, ${id ? null : slugify(nombre)},
                     ${padreId}::uuid) as r`
      )
    );
    return CatalogAdminService.rubros();
  }

  /** Renombra y/o cambia la descripción (solo rubros principales; null o vacía la quita). */
  static async updateRubro(adminId: string, id: string, cambios: { nombre?: string; descripcion?: string | null }) {
    await withUser(adminId, async (tx) => {
      if (cambios.nombre !== undefined) {
        await llamar(tx, Prisma.sql`select pkg_admin.guardar_rubro(${id}::uuid, ${cambios.nombre}, null, null) as r`);
      }
      if (cambios.descripcion !== undefined) {
        await llamar(tx, Prisma.sql`select pkg_admin.describir_rubro(${id}::uuid, ${cambios.descripcion}) as r`);
      }
    });
    return CatalogAdminService.rubros();
  }

  static async setRubroActive(adminId: string, id: string, activo: boolean) {
    await withUser(adminId, (tx) =>
      llamar(tx, Prisma.sql`select pkg_admin.activar_rubro(${id}::uuid, ${activo}::boolean) as r`)
    );
    return CatalogAdminService.rubros();
  }

  static async moveRubro(adminId: string, id: string, direccion: 'subir' | 'bajar') {
    await withUser(adminId, (tx) => ejecutar(tx, Prisma.sql`select pkg_admin.ordenar_rubro(${id}::uuid, ${direccion})`));
    return CatalogAdminService.rubros();
  }

  static async deleteRubro(adminId: string, id: string) {
    await withUser(adminId, (tx) => ejecutar(tx, Prisma.sql`select pkg_admin.eliminar_rubro(${id}::uuid)`));
    return CatalogAdminService.rubros();
  }

  static territory(provincia?: string) {
    return llamar(prisma, Prisma.sql`select pkg_admin.territorio(${provincia ?? null}::uuid) as r`);
  }

  static saveProvince(adminId: string, id: string | null, nombre: string) {
    return withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.guardar_provincia(${id}::uuid, ${nombre}, ${id ? null : slugify(nombre)}) as r`
      )
    );
  }

  static setProvinceActive(adminId: string, id: string, activa: boolean) {
    return withUser(adminId, (tx) =>
      llamar(tx, Prisma.sql`select pkg_admin.activar_provincia(${id}::uuid, ${activa}::boolean) as r`)
    );
  }

  static saveLocality(adminId: string, provinciaId: string, id: string | null, nombre: string) {
    return withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.guardar_localidad(${provinciaId}::uuid, ${id}::uuid, ${nombre},
                     ${id ? null : slugify(nombre)}) as r`
      )
    );
  }

  static setLocalityActive(adminId: string, id: string, activa: boolean) {
    return withUser(adminId, (tx) =>
      llamar(tx, Prisma.sql`select pkg_admin.activar_localidad(${id}::uuid, ${activa}::boolean) as r`)
    );
  }

  static async deleteLocality(adminId: string, id: string) {
    await withUser(adminId, (tx) => ejecutar(tx, Prisma.sql`select pkg_admin.eliminar_localidad(${id}::uuid)`));
    return { ok: true };
  }

  static setShippingRate(adminId: string, localidadId: string, data: ShippingRateInput) {
    return withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.tarifa_envio(${localidadId}::uuid, ${data.costo}::numeric,
                     ${data.activa}::boolean) as r`
      )
    );
  }
}
