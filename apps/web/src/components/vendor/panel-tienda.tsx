'use client';

import type { Tienda } from '@/lib/api-client';

/**
 * Cabecera de panel al estilo #merchant-panel: tarjeta blanca, título 18px,
 * descripción muted y acciones a la derecha (sin sub-hero naranja).
 */
export function EncabezadoPanel({
  titulo,
  descripcion,
  children,
}: {
  tienda?: Tienda;
  titulo: string;
  icono?: string;
  descripcion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mp-panel-cabecera">
      <div>
        <h2>{titulo}</h2>
        {descripcion && <p className="mp-panel-perfil-desc">{descripcion}</p>}
      </div>
      {children && <div className="mp-panel-cabecera-acciones">{children}</div>}
    </header>
  );
}

/** Barra de uso contra un límite (productos, empleados). */
export function BarraUso({ usado, maximo, label }: { usado: number; maximo: number | null; label: string }) {
  if (!maximo) return null;
  const porcentaje = Math.min(100, Math.round((usado / maximo) * 100));
  return (
    <div
      className={`mp-barra${porcentaje >= 100 ? ' mp-barra-llena' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
      aria-label={label}
    >
      <span style={{ width: `${porcentaje}%` }} />
    </div>
  );
}
