'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useOpciones } from '@/hooks/use-opciones';

interface GoogleId {
  initialize(opciones: { client_id: string; callback: (r: { credential: string }) => void; context?: string }): void;
  renderButton(contenedor: HTMLElement, opciones: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let script: Promise<void> | null = null;

function cargarGoogle() {
  script ??= new Promise<void>((resolver, rechazar) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolver();
    s.onerror = () => {
      script = null;
      s.remove();
      rechazar(new Error('No se pudo cargar Google'));
    };
    document.head.appendChild(s);
  });
  return script;
}

/**
 * "Continuar con Google" con el botón oficial (Google Identity Services). No se
 * muestra si la plataforma no tiene configurado el ingreso con Google.
 */
export function AccesoGoogle({
  separador,
  registro = false,
  onIngreso,
  onError,
}: {
  separador: string;
  registro?: boolean;
  onIngreso: (user: Usuario, nueva: boolean) => void;
  onError: (error: unknown) => void;
}) {
  const opciones = useOpciones();
  const { loginGoogle } = useAuth();
  const contenedor = useRef<HTMLDivElement>(null);
  const avisos = useRef({ onIngreso, onError });
  avisos.current = { onIngreso, onError };
  const [sinConexion, setSinConexion] = useState(false);
  const clientId = opciones?.googleClientId;

  useEffect(() => {
    if (!clientId) return;
    let vivo = true;
    cargarGoogle().then(
      () => {
        const google = window.google?.accounts.id;
        if (!vivo || !google || !contenedor.current) return;
        google.initialize({
          client_id: clientId,
          context: registro ? 'signup' : 'signin',
          callback: ({ credential }) =>
            loginGoogle(credential, true).then(
              ({ user, nueva }) => avisos.current.onIngreso(user, nueva),
              (error) => avisos.current.onError(error)
            ),
        });
        google.renderButton(contenedor.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: registro ? 'signup_with' : 'continue_with',
          logo_alignment: 'center',
          locale: 'es-419',
          width: Math.min(400, contenedor.current.offsetWidth || 400),
        });
      },
      () => vivo && setSinConexion(true)
    );
    return () => {
      vivo = false;
    };
  }, [clientId, registro, loginGoogle]);

  if (!clientId) return null;

  return (
    <div className="acceso-google">
      <div className="ds-separador">
        <span>{separador}</span>
      </div>
      {sinConexion ? (
        <p className="acceso-google-error" role="alert">
          No pudimos cargar el ingreso con Google. Revisá tu conexión y recargá la página.
        </p>
      ) : (
        <div ref={contenedor} className="acceso-google-boton" />
      )}
      <p className="acceso-google-nota">
        Si es tu primera vez, al continuar con Google aceptás los{' '}
        <Link href="/terminos" target="_blank">
          Términos y Condiciones
        </Link>{' '}
        y la{' '}
        <Link href="/privacidad" target="_blank">
          Política de Privacidad
        </Link>
        .
      </p>
    </div>
  );
}
