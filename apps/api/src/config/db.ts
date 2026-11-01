import { Prisma, PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

// Conexión con el usuario dueño de la base: ignora RLS.
// Usar solo para tareas del servidor (registro, login, webhooks).
export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Ejecuta las consultas en nombre de un usuario, igual que Supabase:
 * rol "authenticated" y auth.uid() = userId, así que aplican las políticas RLS.
 * Sin userId se usa el rol "anon" (visitante sin sesión).
 * Todo lo que haga `fn` corre en una sola transacción (Prisma la corta a los 5 s
 * salvo que se pase otro `timeout`, por ejemplo para una importación grande).
 */
export const withUser = <T>(
  userId: string | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opciones: { timeout?: number } = {}
): Promise<T> =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      select set_config('role', ${userId ? 'authenticated' : 'anon'}, true),
             set_config('request.jwt.claim.sub', ${userId ?? ''}, true)
    `;
    return fn(tx);
  }, opciones);

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * El API no lee ni escribe tablas: solo llama a las funciones de los paquetes pkg_*.
 * La consulta tiene que devolver una sola columna llamada "r":
 *   llamar<Tienda>(tx, Prisma.sql`select pkg_tiendas.detalle(${id}::uuid) as r`)
 */
export const llamar = async <T>(db: Db, consulta: Prisma.Sql): Promise<T> => {
  const filas = await db.$queryRaw<{ r: T }[]>(consulta);
  return filas[0]?.r as T;
};

/** Para las funciones que no devuelven nada (Prisma no sabe leer columnas "void"). */
export const ejecutar = async (db: Db, consulta: Prisma.Sql): Promise<void> => {
  await db.$executeRaw(consulta);
};
