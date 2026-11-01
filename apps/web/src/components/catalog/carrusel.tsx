'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';

/** Flechas del carrusel: mueven la pista `#targetId`. */
export function ControlesCarrusel({ targetId }: { targetId: string }) {
  function mover(dir: -1 | 1) {
    document.getElementById(targetId)?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  }

  return (
    <div className="carrusel-flechas">
      <button type="button" className="carrusel-flecha" aria-label="Anterior" onClick={() => mover(-1)}>
        <Icon name="chevron-left" size={18} />
      </button>
      <button type="button" className="carrusel-flecha" aria-label="Siguiente" onClick={() => mover(1)}>
        <Icon name="chevron-right" size={18} />
      </button>
    </div>
  );
}

/** Pista horizontal sin barra de scroll visible. */
export function PistaCarrusel({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div id={id} className={`carrusel-pista${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
