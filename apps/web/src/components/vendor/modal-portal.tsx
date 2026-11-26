'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const CLASE_ABIERTO = 'mp-modal-abierto';

/**
 * Monta el modal en `#contenido` (main), entre cabecera y pie del sitio —
 * igual que #add-store-modal en la maqueta. Mientras está abierto, fija el
 * shell a la ventana para que el modal quepa entero (con Cancelar / Registrar)
 * y el pie del sitio siga visible debajo.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [nodo, setNodo] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setNodo(document.getElementById('contenido') ?? document.body);
    document.documentElement.classList.add(CLASE_ABIERTO);
    return () => {
      document.documentElement.classList.remove(CLASE_ABIERTO);
    };
  }, []);

  if (!nodo) return null;
  return createPortal(children, nodo);
}
