'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api, type AuthResponse, type Usuario } from '@/lib/api-client';
import { AuthContext, type RegisterData } from '@/hooks/use-auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api<Usuario>('/auth/me'));
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) console.error(error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      setUser,
      login: async (email: string, password: string, recordarme = false) => {
        const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password, recordarme } });
        setUser(res.user);
        return res.user;
      },
      loginGoogle: async (credencial: string, aceptaTerminos: boolean) => {
        const res = await api<AuthResponse & { nueva: boolean }>('/auth/google', {
          method: 'POST',
          body: { credencial, aceptaTerminos },
        });
        setUser(res.user);
        return res;
      },
      register: async (data: RegisterData) => {
        const res = await api<AuthResponse>('/auth/register', { method: 'POST', body: data });
        setUser(res.user);
        return res.user;
      },
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setUser(null);
        // Ir al marketplace (maqueta #marketplace). assign evita que páginas
        // protegidas (p. ej. /cuenta) redirijan a /login al ver user=null.
        window.location.assign('/');
      },
    }),
    [user, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
