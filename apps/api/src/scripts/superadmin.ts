// Asigna el rol superadmin a una cuenta ya registrada.
// Uso: npm run db:superadmin -- correo@ejemplo.com [--reemplazar]
// La plataforma admite un solo superadmin; --reemplazar se lo quita al actual.
import { Prisma } from '@prisma/client';
import { llamar, prisma } from '../config/db.js';
import { extraerPgError } from '../common/errors/db-error.js';

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();
const reemplazar = args.includes('--reemplazar');

const salir = async (mensaje: string, codigo = 1) => {
  console.log(mensaje);
  await prisma.$disconnect();
  process.exit(codigo);
};

if (!email) await salir('Uso: npm run db:superadmin -- correo@ejemplo.com [--reemplazar]');

try {
  const resultado = await llamar<'asignado' | 'ya_era'>(
    prisma,
    Prisma.sql`select pkg_admin.asignar_superadmin(${email}, ${reemplazar}) as r`
  );
  await salir(
    resultado === 'ya_era'
      ? `${email} ya es superadmin.`
      : `Listo: ${email} es superadmin. Recargá "Mi cuenta" en la web para verlo.`,
    0
  );
} catch (error) {
  await salir(extraerPgError(error)?.message ?? String(error));
}
