'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { IconName } from '@/components/ui/icon';
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina';
import { grupoDe, seccionDe } from '@/components/layout/admin-sections';

/** Encabezado de las secciones del panel: toma el ícono y el grupo del menú lateral. */
export function EncabezadoAdmin({
  titulo,
  descripcion,
  icono,
  destacado = false,
  children,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  icono?: IconName;
  destacado?: boolean;
  children?: ReactNode;
}) {
  const seccion = seccionDe(usePathname());

  return (
    <EncabezadoPagina
      icono={icono ?? seccion?.icon ?? 'grid'}
      antetitulo={seccion ? grupoDe(seccion) : undefined}
      titulo={titulo}
      descripcion={descripcion}
      destacado={destacado}
    >
      {children}
    </EncabezadoPagina>
  );
}
