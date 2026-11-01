import { Prisma } from '@prisma/client';
import { ejecutar, llamar, withUser } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { InviteInput, MemberInput } from './team.schema.js';

// Todo corre como el usuario: la base exige que sea el dueño y controla el límite del plan.
export class TeamService {
  static detail(userId: string, storeId: string) {
    return withUser(userId, (tx) => llamar(tx, Prisma.sql`select pkg_equipo.equipo(${storeId}::uuid) as r`));
  }

  /**
   * El correo todavía no se envía: el enlace se muestra en pantalla y en la consola del API.
   * Al conectar un proveedor de correo, este es el único lugar que cambia.
   */
  static async invite(userId: string, storeId: string, data: InviteInput) {
    const inv = await withUser(userId, (tx) =>
      llamar<{ token: string; email: string; tienda: string }>(
        tx,
        Prisma.sql`select pkg_equipo.invitar(${storeId}::uuid, ${data.email}, ${data.rol_id}::uuid) as r`
      )
    );
    const enlace = `${env.WEB_ORIGIN}/invitacion/${inv.token}`;
    console.log(`\n[correo simulado] Para: ${inv.email}\nTe invitaron a sumarte a "${inv.tienda}": ${enlace}\n`);
    return { email: inv.email, enlace };
  }

  static async cancelInvitation(userId: string, storeId: string, invitationId: string) {
    await withUser(userId, (tx) =>
      ejecutar(tx, Prisma.sql`select pkg_equipo.anular_invitacion(${storeId}::uuid, ${invitationId}::uuid)`)
    );
    return TeamService.detail(userId, storeId);
  }

  static async updateMember(userId: string, storeId: string, memberId: string, data: MemberInput) {
    await withUser(userId, async (tx) => {
      if (data.rol_id) {
        await ejecutar(tx, Prisma.sql`select pkg_equipo.cambiar_rol(${storeId}::uuid, ${memberId}::uuid, ${data.rol_id}::uuid)`);
      }
      if (data.estado) {
        await ejecutar(
          tx,
          Prisma.sql`select pkg_equipo.cambiar_estado(${storeId}::uuid, ${memberId}::uuid, ${data.estado}::public.estado_miembro)`
        );
      }
    });
    return TeamService.detail(userId, storeId);
  }

  // Invitaciones vistas por el invitado.
  static async invitation(token: string) {
    const inv = await withUser(null, (tx) =>
      llamar<object | null>(tx, Prisma.sql`select pkg_equipo.ver_invitacion(${token}) as r`)
    );
    if (!inv) throw new AppError('La invitación no existe', 404);
    return inv;
  }

  static async accept(userId: string, token: string) {
    const tiendaId = await withUser(userId, (tx) =>
      llamar<string>(tx, Prisma.sql`select pkg_equipo.aceptar(${token}) as r`)
    );
    return { tiendaId };
  }
}
