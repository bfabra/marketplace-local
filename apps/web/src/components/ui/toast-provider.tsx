'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { ToastContext, type Aviso } from '@/hooks/use-toast';
import { Icon } from './icon';

const DURACION = 4500;
const ICONO = { exito: 'check', error: 'alert', info: 'info' } as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<(Aviso & { id: number })[]>([]);
  const siguiente = useRef(0);

  const cerrar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  const mostrar = useCallback(
    (aviso: Aviso) => {
      const id = ++siguiente.current;
      setAvisos((lista) => [...lista.slice(-2), { ...aviso, id }]);
      window.setTimeout(() => cerrar(id), DURACION);
    },
    [cerrar]
  );

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {avisos.map((a) => {
          const tipo = a.tipo ?? 'exito';
          return (
            <div key={a.id} className={`toast toast-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
              <span className="toast-icono">
                <Icon name={ICONO[tipo]} size={18} strokeWidth={2.5} />
              </span>
              <div className="toast-texto">
                <strong>{a.titulo}</strong>
                {a.texto && <span>{a.texto}</span>}
              </div>
              {a.accion && (
                <Link href={a.accion.href} className="toast-accion" onClick={() => cerrar(a.id)}>
                  {a.accion.label}
                </Link>
              )}
              <button type="button" className="toast-cerrar" aria-label="Cerrar aviso" onClick={() => cerrar(a.id)}>
                <Icon name="x" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
