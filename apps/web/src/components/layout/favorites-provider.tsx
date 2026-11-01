'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { FavoritesContext } from '@/hooks/use-favorites';
const CLAVE = 'tcl_favoritos';
const MAX_SIN_CUENTA = 100;

function leerLocal(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function guardarLocal(ids: string[]) {
  if (ids.length) localStorage.setItem(CLAVE, JSON.stringify(ids));
  else localStorage.removeItem(CLAVE);
}

/**
 * Igual que el carrito: sin sesión, los favoritos viven en el navegador; al ingresar
 * se suman a la cuenta y se borran del navegador.
 */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const [listo, setListo] = useState(false);
  const fila = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (loading) return;
    let vigente = true;
    setListo(false);

    const sincronizar = async (): Promise<string[]> => {
      const locales = leerLocal();
      if (!userId) return locales;
      if (!locales.length) return api<string[]>('/favorites/ids');
      guardarLocal([]);
      try {
        return await api<string[]>('/favorites/unir', { method: 'POST', body: { ids: locales } });
      } catch (e) {
        guardarLocal(locales);
        throw e;
      }
    };

    const tarea = fila.current.then(sincronizar);
    fila.current = tarea.catch(() => undefined);
    tarea
      .then((lista) => vigente && setIds(new Set(lista)))
      .catch((e) => console.error(e))
      .finally(() => vigente && setListo(true));

    return () => {
      vigente = false;
    };
  }, [userId, loading]);

  const alternar = useCallback(
    async (productoId: string) => {
      const guardar = !ids.has(productoId);
      const anterior = ids;
      const optimista = new Set(ids);
      if (guardar) optimista.add(productoId);
      else optimista.delete(productoId);
      setIds(optimista);

      try {
        if (userId) {
          const lista = await api<string[]>(`/favorites/${productoId}`, { method: guardar ? 'PUT' : 'DELETE' });
          setIds(new Set(lista));
        } else {
          const locales = leerLocal().filter((id) => id !== productoId);
          if (guardar && locales.length >= MAX_SIN_CUENTA) {
            throw new ApiError(`Podés guardar hasta ${MAX_SIN_CUENTA} favoritos sin cuenta. Ingresá para guardar más.`, 409);
          }
          guardarLocal(guardar ? [productoId, ...locales] : locales);
        }
        return guardar;
      } catch (e) {
        setIds(anterior);
        throw e;
      }
    },
    [ids, userId]
  );

  const value = useMemo(() => ({ ids, listo, alternar }), [ids, listo, alternar]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
