'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api, type EstadoSeguimiento } from '@/lib/api-client';
import { useAuth } from './use-auth';

// Tiendas que sigue el usuario, compartidas por todas las tarjetas de la página.
let ids = new Set<string>();
let deUsuario: string | null = null;
const oyentes = new Set<() => void>();

function publicar(nuevos: Iterable<string>) {
  ids = new Set(nuevos);
  oyentes.forEach((o) => o());
}

const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => oyentes.delete(o);
};

export function useSeguidos() {
  const { user } = useAuth();
  const actuales = useSyncExternalStore(
    suscribir,
    () => ids,
    () => ids
  );

  useEffect(() => {
    const id = user?.id ?? null;
    if (id === deUsuario) return;
    deUsuario = id;
    if (!id) return publicar([]);
    api<string[]>('/seguidos/ids')
      .then(publicar)
      .catch(() => publicar([]));
  }, [user]);

  const alternar = useCallback(async (tiendaId: string) => {
    const r = await api<EstadoSeguimiento>(`/seguidos/${tiendaId}`, { method: ids.has(tiendaId) ? 'DELETE' : 'PUT' });
    publicar(r.ids);
    return r.ids.includes(tiendaId);
  }, []);

  return { ids: actuales, alternar };
}
