import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ejecutar, llamar, prisma, withUser } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { hashPassword, comparePassword } from '../../common/utils/bcrypt.js';
import { MENSAJE_CUENTA_BLOQUEADA, olvidarBloqueo } from '../../common/utils/bloqueos.js';
import { correoDisponible, enviarCorreo } from '../../common/utils/correo.js';
import { verificarTokenGoogle } from '../../common/utils/google.js';
import {
  RegisterInput,
  LoginInput,
  GoogleInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from './auth.schema.js';

/** Versión de los Términos y la Política de Privacidad (apps/web: /terminos y /privacidad). */
export const TERMINOS_VERSION = '2026-10-11';

/** Minutos que vale el enlace para restablecer la contraseña. */
const MINUTOS_RECUPERACION = 60;

export interface Sesion {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  avatar_url: string | null;
  creado_en: string;
  dni: string | null;
  tieneClave: boolean;
  conGoogle: boolean;
  rolesPlataforma: string[];
  tiendas: { id: string; nombre: string; slug: string; estado: string; rol: string }[];
}

const hashCodigo = (codigo: string) => createHash('sha256').update(codigo, 'utf8').digest('hex');

/** Si la cuenta está bloqueada lo avisa; si no, anota el ingreso. */
async function exigirNoBloqueada(userId: string) {
  const motivo = await llamar<string | null>(prisma, Prisma.sql`select pkg_auth.ingreso(${userId}::uuid) as r`);
  if (motivo !== null) throw new AppError(MENSAJE_CUENTA_BLOQUEADA, 403);
}

// Registro, login y contraseña los resuelve el servidor (auth.users no es visible
// para los usuarios); el perfil propio se edita con el rol del usuario.
export class AuthService {
  static async register(data: RegisterInput) {
    const hash = await hashPassword(data.password);
    const { password: _password, aceptaTerminos: _acepta, ...datos } = data;

    // En un solo paso: cuenta, perfil, DNI, términos aceptados y domicilio principal.
    const id = await llamar<string>(
      prisma,
      Prisma.sql`select pkg_auth.registrar_cliente(${JSON.stringify({ ...datos, terminos: TERMINOS_VERSION })}::jsonb,
                                                   ${hash}) as r`
    );
    return AuthService.me(id);
  }

  static async login(data: LoginInput) {
    const [cuenta] = await prisma.$queryRaw<{ id: string; hash: string | null }[]>`
      select id, hash from pkg_auth.credenciales(${data.email})
    `;

    const isPasswordValid = !!cuenta?.hash && (await comparePassword(data.password, cuenta.hash));
    if (!cuenta || !isPasswordValid) {
      throw new AppError('Credenciales inválidas', 401);
    }

    // Recién con la contraseña correcta se avisa del bloqueo: si no, revelaría qué correos existen.
    await exigirNoBloqueada(cuenta.id);
    return AuthService.me(cuenta.id);
  }

  /** Continuar con Google: entra, vincula la cuenta con el mismo correo o crea una nueva. */
  static async google(data: GoogleInput) {
    const g = await verificarTokenGoogle(data.credencial);
    const { id, nueva } = await llamar<{ id: string; nueva: boolean }>(
      prisma,
      Prisma.sql`select pkg_auth.ingresar_google(${g.sub}, ${g.email}, ${g.nombre}, ${g.apellido || null},
                                                 ${g.avatar}, ${data.aceptaTerminos ? TERMINOS_VERSION : null}) as r`
    );
    await exigirNoBloqueada(id);
    return { user: await AuthService.me(id), nueva };
  }

  /**
   * Manda por correo un enlace para elegir una contraseña nueva. Responde lo mismo
   * exista o no la cuenta, para no revelar qué correos están registrados.
   */
  static async recover(email: string) {
    if (!correoDisponible()) throw new AppError('La recuperación de contraseña todavía no está habilitada', 503);

    const codigo = randomBytes(32).toString('hex');
    const cuenta = await llamar<{ nombre: string | null; email: string } | null>(
      prisma,
      Prisma.sql`select pkg_auth.crear_recuperacion(${email}, ${hashCodigo(codigo)}, ${MINUTOS_RECUPERACION}::int) as r`
    );
    if (!cuenta) return;

    const enlace = `${env.WEB_ORIGIN}/restablecer?token=${codigo}`;
    const saludo = cuenta.nombre ? `Hola, ${cuenta.nombre}:` : 'Hola:';
    await enviarCorreo({
      para: cuenta.email,
      asunto: 'Cambiá tu contraseña de Tu Comercio Local',
      texto:
        `${saludo}\n\nRecibimos un pedido para cambiar la contraseña de tu cuenta. ` +
        `Para elegir una nueva, entrá a este enlace (vale ${MINUTOS_RECUPERACION} minutos y una sola vez):\n\n${enlace}\n\n` +
        'Si no lo pediste vos, ignorá este correo: tu contraseña no cambia.\n\nTu Comercio Local',
      html:
        `<p>${saludo}</p><p>Recibimos un pedido para cambiar la contraseña de tu cuenta. ` +
        `Para elegir una nueva, hacé clic en el botón (el enlace vale ${MINUTOS_RECUPERACION} minutos y una sola vez):</p>` +
        `<p><a href="${enlace}" style="display:inline-block;padding:12px 20px;background:#0b3160;color:#fff;` +
        `border-radius:8px;text-decoration:none;font-weight:700">Elegir contraseña nueva</a></p>` +
        '<p>Si no lo pediste vos, ignorá este correo: tu contraseña no cambia.</p><p>Tu Comercio Local</p>',
    });
  }

  static async resetTokenValid(token: string) {
    return {
      valido: await llamar<boolean>(prisma, Prisma.sql`select pkg_auth.recuperacion_valida(${hashCodigo(token)}) as r`),
    };
  }

  /** Cambia la contraseña con el enlace del correo y cierra todas las sesiones abiertas. */
  static async reset(token: string, password: string) {
    const userId = await llamar<string>(
      prisma,
      Prisma.sql`select pkg_auth.restablecer_clave(${hashCodigo(token)}, ${await hashPassword(password)}) as r`
    );
    olvidarBloqueo(userId);
    const user = await AuthService.me(userId);
    return { email: user.email };
  }

  static async updateProfile(userId: string, data: UpdateProfileInput) {
    const { dni, ...perfil } = data;
    if (dni !== undefined) {
      await ejecutar(prisma, Prisma.sql`select pkg_auth.guardar_dni(${userId}::uuid, ${dni})`);
    }
    if (Object.keys(perfil).length > 0) {
      await withUser(userId, (tx) =>
        ejecutar(tx, Prisma.sql`select pkg_auth.actualizar_perfil(${JSON.stringify(perfil)}::jsonb)`)
      );
    }
    return AuthService.me(userId);
  }

  /** Quien entra solo con Google no tiene contraseña: la crea sin escribir la actual. */
  static async changePassword(userId: string, data: ChangePasswordInput) {
    const hash = await llamar<string | null>(
      prisma,
      Prisma.sql`select pkg_auth.hash_actual(${userId}::uuid) as r`
    );

    if (hash && !data.actual) {
      throw new AppError('Ingresá tu contraseña actual', 400);
    }
    if (hash && !(await comparePassword(data.actual!, hash))) {
      throw new AppError('La contraseña actual no es correcta', 400);
    }

    await ejecutar(
      prisma,
      Prisma.sql`select pkg_auth.cambiar_clave(${userId}::uuid, ${await hashPassword(data.nueva)})`
    );
    olvidarBloqueo(userId);
  }

  /** Perfil del usuario con sus roles de plataforma y las tiendas donde trabaja. */
  static async me(userId: string) {
    const sesion = await llamar<Sesion | null>(
      prisma,
      Prisma.sql`select pkg_auth.sesion(${userId}::uuid) as r`
    );
    if (!sesion) throw new AppError('Usuario no encontrado', 404);
    return sesion;
  }
}
