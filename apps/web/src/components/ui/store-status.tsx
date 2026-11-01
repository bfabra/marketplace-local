import type { EstadoTienda } from '@/lib/api-client';

const ETIQUETAS: Record<EstadoTienda, string> = {
  pendiente: 'Pendiente de aprobación',
  activa: 'Activa',
  suspendida: 'Suspendida',
  vencida: 'Vencida',
  archivada: 'Archivada',
};

export function StoreStatus({ estado }: { estado: EstadoTienda }) {
  return <span className={`badge badge-${estado}`}>{ETIQUETAS[estado] ?? estado}</span>;
}
