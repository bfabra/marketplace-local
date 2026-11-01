import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';

export function EncabezadoPagina({
  icono,
  iniciales,
  antetitulo,
  titulo,
  descripcion,
  destacado = false,
  children,
}: {
  icono: IconName;
  /** Reemplaza al ícono por las iniciales de la persona. */
  iniciales?: string;
  antetitulo?: ReactNode;
  titulo: ReactNode;
  descripcion?: ReactNode;
  destacado?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className={destacado ? 'encabezado encabezado-destacado' : 'encabezado'}>
      <span className={iniciales ? 'encabezado-icono encabezado-iniciales' : 'encabezado-icono'} aria-hidden="true">
        {iniciales ?? <Icon name={icono} size={24} />}
      </span>
      <div className="encabezado-texto">
        {antetitulo && <span className="encabezado-grupo">{antetitulo}</span>}
        <h1>{titulo}</h1>
        {descripcion && <p>{descripcion}</p>}
      </div>
      {children && <div className="encabezado-acciones">{children}</div>}
    </header>
  );
}
