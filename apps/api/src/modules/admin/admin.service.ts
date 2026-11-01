import { Prisma } from '@prisma/client';
import { ejecutar, llamar, prisma, withUser } from '../../config/db.js';
import { AppError } from '../../common/errors/app-error.js';
import { conUrlFotos, conUrlImagen } from '../catalog/catalog.service.js';
import {
  ActivityFilters,
  ActivityQuery,
  AssignRoleInput,
  ChangeStoreStateInput,
  ModerateProductInput,
  ProductsQuery,
  StoreRoleInput,
  StoresQuery,
} from './admin.schema.js';

type Tarjeta = { imagen: string | null };

export class AdminService {
  /** Cifras del tablero: la base decide qué bloques ve cada rol de plataforma. */
  static dashboard(userId: string) {
    return llamar(prisma, Prisma.sql`select pkg_admin.tablero(${userId}::uuid) as r`);
  }

  /** Parámetros con su último cambio. La ruta exige superadmin; el autor vive en auth.users. */
  static settings() {
    return llamar(prisma, Prisma.sql`select pkg_admin.configuracion() as r`);
  }

  /** Corre como el superadmin: RLS solo le deja a él escribir y la auditoría registra quién fue. */
  static async saveSetting(adminId: string, clave: string, valor: boolean | number) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.guardar_configuracion(${clave}, ${JSON.stringify(valor)}::jsonb)`)
    );
    return AdminService.settings();
  }

  /** Registro de actividad. La ruta exige superadmin; los correos viven en auth.users. */
  static activity({ antes, ...f }: ActivityQuery) {
    return llamar(
      prisma,
      Prisma.sql`select pkg_admin.actividad(
        p_entidad => ${f.entidad ?? null},
        p_antes   => ${antes ?? null}::bigint,
        p_accion  => ${f.accion ?? null},
        p_desde   => ${f.desde ?? null}::timestamptz,
        p_hasta   => ${f.hasta ?? null}::timestamptz,
        p_buscar  => ${f.buscar ?? null},
        p_origen  => ${f.origen ?? null}) as r`
    );
  }

  /** Hasta 5.000 movimientos del filtro; el navegador arma el CSV. */
  static exportActivity(f: ActivityFilters) {
    return llamar(
      prisma,
      Prisma.sql`select pkg_admin.exportar_actividad(
        p_entidad => ${f.entidad ?? null},
        p_accion  => ${f.accion ?? null},
        p_desde   => ${f.desde ?? null}::timestamptz,
        p_hasta   => ${f.hasta ?? null}::timestamptz,
        p_buscar  => ${f.buscar ?? null},
        p_origen  => ${f.origen ?? null}) as r`
    );
  }

  /**
   * Las lecturas de tiendas y productos corren como servidor: la ruta ya exige
   * moderación, y los correos viven en auth.users, que los usuarios no pueden leer.
   */
  static stores({ estado, buscar, pagina }: StoresQuery) {
    return llamar(
      prisma,
      Prisma.sql`select pkg_admin.tiendas(${estado ?? null}::public.estado_tienda, ${buscar ?? null},
                                          ${pagina ?? 1}::int) as r`
    );
  }

  static async store(storeId: string) {
    const tienda = await llamar(prisma, Prisma.sql`select pkg_admin.tienda(${storeId}::uuid) as r`);
    if (!tienda) throw new AppError('No encontramos esa tienda', 404);
    return tienda;
  }

  /** Corre como moderación: la base valida el rol y la auditoría registra quién fue. */
  static async setReviewPolicy(adminId: string, storeId: string, politica: string) {
    return withUser(adminId, (tx) =>
      llamar(tx, Prisma.sql`select pkg_admin.politica_revision(${storeId}::uuid, ${politica}) as r`)
    );
  }

  static async products({ vista, tienda, buscar, pagina }: ProductsQuery) {
    const r = await llamar<{ items: Tarjeta[] }>(
      prisma,
      Prisma.sql`select pkg_admin.productos(${vista ?? 'revision'}, ${buscar ?? null},
                                            ${tienda ?? null}::uuid, ${pagina ?? 1}::int) as r`
    );
    return { ...r, items: r.items.map(conUrlImagen) };
  }

  static async product(productId: string) {
    const producto = await llamar<{ imagenes: { id: string; ruta: string }[] } | null>(
      prisma,
      Prisma.sql`select pkg_admin.producto(${productId}::uuid) as r`
    );
    if (!producto) throw new AppError('No encontramos ese producto', 404);
    return { ...producto, imagenes: conUrlFotos(producto.imagenes) };
  }

  static moderateProduct(adminId: string, productId: string, { accion, nota }: ModerateProductInput) {
    return withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.moderar_producto(${productId}::uuid, ${accion}, ${nota ?? null}) as r`
      )
    );
  }

  /** Quién tiene cada rol de plataforma. La ruta exige superadmin; los correos viven en auth.users. */
  static platformRoles() {
    return llamar(prisma, Prisma.sql`select pkg_admin.roles_plataforma() as r`);
  }

  /** Corre como el superadmin: RLS solo le deja a él escribir roles_plataforma. */
  static async assignRole(adminId: string, data: AssignRoleInput) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.asignar_rol(${data.email}, ${data.rol}::public.rol_plataforma)`)
    );
    return AdminService.platformRoles();
  }

  static async removeRole(adminId: string, userId: string, rol: string) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.quitar_rol(${userId}::uuid, ${rol}::public.rol_plataforma)`)
    );
    return AdminService.platformRoles();
  }

  /** Roles predefinidos que las tiendas asignan a sus empleados. La ruta exige superadmin. */
  static storeRoles() {
    return llamar(prisma, Prisma.sql`select pkg_admin.roles_tienda() as r`);
  }

  /** Corre como el superadmin: RLS solo le deja a él escribir los roles predefinidos. */
  static async saveStoreRole(adminId: string, roleId: string | null, data: StoreRoleInput) {
    await withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.guardar_rol_tienda(${roleId}::uuid, ${data.nombre}, ${data.permisos}::text[]) as r`
      )
    );
    return AdminService.storeRoles();
  }

  static async removeStoreRole(adminId: string, roleId: string) {
    await withUser(adminId, (tx) => ejecutar(tx, Prisma.sql`select pkg_admin.borrar_rol_tienda(${roleId}::uuid)`));
    return AdminService.storeRoles();
  }

  /** Corre como el admin: el trigger de tiendas exige Mercado Pago vinculado para activar. */
  static changeStoreState(adminId: string, storeId: string, data: ChangeStoreStateInput) {
    return withUser(adminId, (tx) =>
      llamar(
        tx,
        Prisma.sql`select pkg_admin.cambiar_estado_tienda(${storeId}::uuid,
                                                          ${data.estado}::public.estado_tienda,
                                                          ${data.motivo ?? null}) as r`
      )
    );
  }
}
