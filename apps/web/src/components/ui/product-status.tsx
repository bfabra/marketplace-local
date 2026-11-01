import type { EstadoProducto, MotivoPausa } from '@/lib/api-client';

const ETIQUETAS: Record<EstadoProducto, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  pausado: 'Pausado',
  archivado: 'Archivado',
};

const MOTIVOS: Record<MotivoPausa, string> = {
  manual: '',
  limite_plan: ' (límite del plan)',
  moderacion: ' (por moderación)',
  revision: '',
  rechazado: '',
};

// En revisión y rechazado son pausas, pero se muestran como estados propios.
const PROPIOS: Partial<Record<MotivoPausa, { etiqueta: string; clase: string }>> = {
  revision: { etiqueta: 'En revisión', clase: 'revision' },
  rechazado: { etiqueta: 'Rechazado', clase: 'rechazado' },
};

export function ProductStatus({ estado, motivo }: { estado: EstadoProducto; motivo?: MotivoPausa | null }) {
  const propio = estado === 'pausado' && motivo ? PROPIOS[motivo] : undefined;
  if (propio) return <span className={`badge badge-producto-${propio.clase}`}>{propio.etiqueta}</span>;
  return (
    <span className={`badge badge-producto-${estado}`}>
      {ETIQUETAS[estado]}
      {estado === 'pausado' && motivo ? MOTIVOS[motivo] : ''}
    </span>
  );
}
