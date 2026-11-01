'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Monta ventanas flotantes en `#contenido` (main del marketplace), igual que
 * la maqueta (#page-content.page-enter): el overlay fixed queda contenido entre
 * la cabecera y el pie, que siguen visibles.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [nodo, setNodo] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setNodo(document.getElementById('contenido') ?? document.body);
  }, []);

  if (!nodo) return null;
  return createPortal(children, nodo);
}
