'use client';

import { useEffect, useState } from 'react';
import type { Categoria } from '@/lib/api-client';
import { obtenerCategorias } from '@/lib/catalogo';

/** Todas las categorías visibles; `null` mientras cargan y `[]` si fallan. */
export function useCategorias() {
  const [lista, setLista] = useState<Categoria[] | null>(null);
  useEffect(() => {
    let vigente = true;
    obtenerCategorias()
      .then((l) => vigente && setLista(l))
      .catch(() => vigente && setLista([]));
    return () => {
      vigente = false;
    };
  }, []);
  return lista;
}
