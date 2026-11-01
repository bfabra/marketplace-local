'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Lista con altura máxima y scroll vertical. Desvanece el borde de arriba o de
 * abajo cuando queda contenido oculto de ese lado. Reemplaza al <ul>/<ol> de la
 * lista (as="ul") o envuelve otro contenido (as="div").
 */
export function ListaScroll({
  as: Etiqueta = 'div',
  children,
  etiqueta,
  alto,
  className = '',
}: {
  as?: 'ul' | 'ol' | 'div';
  children: ReactNode;
  /** Nombre de la región para lectores de pantalla (se recorre con el teclado). */
  etiqueta: string;
  /** Altura máxima en CSS; por defecto, unas dos terceras partes de la pantalla. */
  alto?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [bordes, setBordes] = useState({ arriba: false, abajo: false });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const arriba = el.scrollTop > 2;
    const abajo = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setBordes((b) => (b.arriba === arriba && b.abajo === abajo ? b : { arriba, abajo }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    medir();
    const tamanio = new ResizeObserver(medir);
    tamanio.observe(el);
    const contenido = new MutationObserver(medir);
    contenido.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      tamanio.disconnect();
      contenido.disconnect();
    };
  }, [medir]);

  const desborda = bordes.arriba || bordes.abajo;
  const clases = ['lista-scroll', bordes.arriba && 'lista-scroll-arriba', bordes.abajo && 'lista-scroll-abajo', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Etiqueta
      ref={(nodo: HTMLElement | null) => {
        ref.current = nodo;
      }}
      className={clases}
      style={alto ? ({ '--lista-alto': alto } as CSSProperties) : undefined}
      onScroll={medir}
      aria-label={etiqueta}
      tabIndex={desborda ? 0 : undefined}
    >
      {children}
    </Etiqueta>
  );
}
