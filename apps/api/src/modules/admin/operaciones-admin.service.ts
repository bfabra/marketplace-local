import { Prisma } from '@prisma/client';
import { ejecutar, llamar, prisma, withUser } from '../../config/db.js';
import { AppError } from '../../common/errors/app-error.js';
import { olvidarBloqueo } from '../../common/utils/bloqueos.js';
import type { OrdersQuery, PlanInput, RefundInput, SubscriptionsQuery, UsersQuery } from './operaciones-admin.schema.js';

/**
 * Usuarios (soporte), pedidos (soporte, finanzas y logística) y planes y
 * suscripciones (finanzas).
 * Las lecturas corren como servidor: la ruta ya exige el rol y los correos viven
 * en auth.users. Los cambios corren como el admin: la base valida el rol, RLS y
 * los triggers hacen el resto y la auditoría registra quién fue.
 */
export class OperationsAdminService {
  // ---------- Usuarios ----------
  static users({ filtro, buscar, pagina }: UsersQuery) {
    return llamar(
      prisma,
      Prisma.sql`select pkg_admin.usuarios(${filtro ?? 'todos'}, ${buscar ?? null}, ${pagina ?? 1}::int) as r`
    );
  }

  static async user(id: string) {
    const usuario = await llamar(prisma, Prisma.sql`select pkg_admin.usuario(${id}::uuid) as r`);
    if (!usuario) throw new AppError('No encontramos esa cuenta', 404);
    return usuario;
  }

  static async blockUser(adminId: string, id: string, motivo: string) {
    const resultado = await withUser(adminId, (tx) =>
      llamar<{ tiendasSuspendidas: number }>(tx, Prisma.sql`select pkg_admin.bloquear_usuario(${id}::uuid, ${motivo}) as r`)
    );
    olvidarBloqueo(id);
    return { resultado, usuario: await OperationsAdminService.user(id) };
  }

  static async unblockUser(adminId: string, id: string, nota?: string) {
    const resultado = await withUser(adminId, (tx) =>
      llamar<{ tiendasRestauradas: number; tiendasSuspendidas: number }>(
        tx,
        Prisma.sql`select pkg_admin.desbloquear_usuario(${id}::uuid, ${nota ?? null}) as r`
      )
    );
    olvidarBloqueo(id);
    return { resultado, usuario: await OperationsAdminService.user(id) };
  }

  // ---------- Pedidos ----------
  static orders({ vista, buscar, pagina }: OrdersQuery) {
    return llamar(
      prisma,
      Prisma.sql`select pkg_admin.pedidos(${vista ?? 'todos'}, ${buscar ?? null}, ${pagina ?? 1}::int) as r`
    );
  }

  /** Los pagos y las acciones disponibles dependen del rol de quien mira. */
  static async order(adminId: string, id: string) {
    const pedido = await llamar(prisma, Prisma.sql`select pkg_admin.pedido(${id}::uuid, ${adminId}::uuid) as r`);
    if (!pedido) throw new AppError('No encontramos ese pedido', 404);
    return pedido;
  }

  static async cancelPart(adminId: string, id: string, parteId: string, motivo: string) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.cancelar_parte(${parteId}::uuid, ${motivo})`)
    );
    return OperationsAdminService.order(adminId, id);
  }

  static async refund(adminId: string, id: string, data: RefundInput) {
    await withUser(adminId, (tx) =>
      ejecutar(
        tx,
        Prisma.sql`select pkg_admin.reembolsar(${data.parteId}::uuid, ${data.monto}::numeric, ${data.motivo})`
      )
    );
    return OperationsAdminService.order(adminId, id);
  }

  static async processRefund(adminId: string, id: string, reembolsoId: string, aprobar: boolean, nota?: string) {
    await withUser(adminId, (tx) =>
      ejecutar(
        tx,
        Prisma.sql`select pkg_admin.procesar_reembolso(${reembolsoId}::uuid, ${aprobar}::boolean, ${nota ?? null})`
      )
    );
    return OperationsAdminService.order(adminId, id);
  }

  // ---------- Planes ----------
  static plans() {
    return llamar(prisma, Prisma.sql`select pkg_admin.planes() as r`);
  }

  /** Devuelve los planes y, si bajó un límite, a cuántas tiendas afectó. */
  static async savePlan(adminId: string, id: string | null, data: PlanInput) {
    const plan = await withUser(adminId, (tx) =>
      llamar<{ efectos: unknown }>(
        tx,
        Prisma.sql`select pkg_admin.guardar_plan(${id}::uuid, ${data.nombre}, ${data.precio_mensual}::numeric,
                     ${data.max_productos}::int, ${data.max_empleados}::int, ${data.activo}::boolean) as r`
      )
    );
    return { efectos: plan.efectos, planes: await OperationsAdminService.plans() };
  }

  static async movePlan(adminId: string, id: string, direccion: 'subir' | 'bajar') {
    await withUser(adminId, (tx) => ejecutar(tx, Prisma.sql`select pkg_admin.ordenar_plan(${id}::uuid, ${direccion})`));
    return OperationsAdminService.plans();
  }

  // ---------- Suscripciones ----------
  static subscriptions({ vista, plan, buscar, pagina }: SubscriptionsQuery) {
    return llamar(
      prisma,
      Prisma.sql`select pkg_admin.suscripciones(${vista ?? 'vigentes'}, ${plan ?? null}::uuid,
                                                ${buscar ?? null}, ${pagina ?? 1}::int) as r`
    );
  }

  static async subscription(id: string) {
    const suscripcion = await llamar(prisma, Prisma.sql`select pkg_admin.suscripcion(${id}::uuid) as r`);
    if (!suscripcion) throw new AppError('No encontramos esa suscripción', 404);
    return suscripcion;
  }

  static async extendSubscription(adminId: string, id: string, dias: number, motivo: string) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.extender_suscripcion(${id}::uuid, ${dias}::int, ${motivo})`)
    );
    return OperationsAdminService.subscription(id);
  }

  static async registerSubscriptionPayment(adminId: string, id: string, referencia?: string) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.registrar_pago_suscripcion(${id}::uuid, ${referencia || null})`)
    );
    return OperationsAdminService.subscription(id);
  }

  static async cancelSubscription(adminId: string, id: string, motivo: string) {
    await withUser(adminId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_admin.cancelar_suscripcion(${id}::uuid, ${motivo})`)
    );
    return OperationsAdminService.subscription(id);
  }
}
