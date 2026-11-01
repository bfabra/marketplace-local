'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';

/** Fila con desplazamiento horizontal: deslizable en el celular, con flechas en la compu. */
export function Carousel({ children, etiqueta }: { children: React.ReactNode; etiqueta: string }) {
  const pista = useRef<HTMLDivElement>(null);
  const [bordes, setBordes] = useState({ inicio: true, fin: true });

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    setBordes({ inicio: el.scrollLeft <= 4, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [medir, children]);

  const mover = (sentido: 1 | -1) => {
    const el = pista.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className="carousel">
      <div ref={pista} className="carousel-pista" onScroll={medir} role="region" aria-label={etiqueta} tabIndex={0}>
        {children}
      </div>
      {!bordes.inicio && (
        <button type="button" className="carousel-flecha carousel-anterior" onClick={() => mover(-1)} aria-label="Ver anteriores">
          <Icon name="chevron-left" />
        </button>
      )}
      {!bordes.fin && (
        <button type="button" className="carousel-flecha carousel-siguiente" onClick={() => mover(1)} aria-label="Ver más">
          <Icon name="chevron-right" />
        </button>
      )}
    </div>
  );
}
