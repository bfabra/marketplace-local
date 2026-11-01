'use client';

import { useEffect, type RefObject } from 'react';

/** Cierra un menú al hacer clic afuera o al apretar Escape. */
export function useClickOutside(ref: RefObject<HTMLElement>, abierto: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, abierto, cerrar]);
}
