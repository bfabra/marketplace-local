import type { MotivoPausa } from '@/lib/api-client';

export const AVISO_REVISION = 'Lo vas a ver publicado apenas el equipo lo apruebe.';

/** En revisión espera a moderación; pausado por moderación solo lo reactiva moderación. */
export const puedeVolverAPublicar = (motivo: MotivoPausa | null) => motivo !== 'revision' && motivo !== 'moderacion';

const TITULOS: Partial<Record<MotivoPausa, string>> = {
  rechazado: 'Moderación lo rechazó',
  moderacion: 'Moderación lo pausó',
};

export function NotaModeracion({ motivo, nota }: { motivo: MotivoPausa | null; nota: string | null }) {
  const titulo = motivo ? TITULOS[motivo] : undefined;
  if (!titulo || !nota) return null;
  return (
    <p className="nota-moderacion">
      <strong>{titulo}:</strong> {nota}
    </p>
  );
}
