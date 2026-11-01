'use client';

import { createContext, useContext } from 'react';
import type { Usuario } from '@/lib/api-client';

export interface RegisterData {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  dni: string;
  domicilio: { calle: string; numero: string; piso_depto?: string; localidad_id: string };
  aceptaTerminos: boolean;
}

export interface AuthContextValue {
  user: Usuario | null;
  loading: boolean;
  login: (email: string, password: string, recordarme?: boolean) => Promise<Usuario>;
  /** Continuar con Google. `nueva`: se creó la cuenta en este momento. */
  loginGoogle: (credencial: string, aceptaTerminos: boolean) => Promise<{ user: Usuario; nueva: boolean }>;
  register: (data: RegisterData) => Promise<Usuario>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: Usuario) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
