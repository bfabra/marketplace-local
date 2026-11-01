'use client';

import { useEffect, useState } from 'react';
import { api, type OpcionesPlataforma } from '@/lib/api-client';

const SIN_OPCIONES: OpcionesPlataforma = { googleClientId: null, googleMaps: false, recuperarClave: false };

let pedido: Promise<OpcionesPlataforma> | null = null;

/** Qué servicios externos están configurados (Google, Google Maps, correo). Se pide una sola vez. */
export function useOpciones() {
  const [opciones, setOpciones] = useState<OpcionesPlataforma | null>(null);

  useEffect(() => {
    pedido ??= api<OpcionesPlataforma>('/opciones').catch(() => {
      pedido = null;
      return SIN_OPCIONES;
    });
    let vivo = true;
    pedido.then((o) => vivo && setOpciones(o));
    return () => {
      vivo = false;
    };
  }, []);

  return opciones;
}
