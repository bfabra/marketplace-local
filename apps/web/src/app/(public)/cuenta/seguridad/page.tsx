'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';
import { CambiarClaveForm } from '@/components/forms/cambiar-clave-form';

export default function CuentaSeguridadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/cuenta/seguridad');
  }, [loading, user, router]);

  if (loading || !user) return <PageSkeleton />;

  return (
    <CuentaShell
      user={user}
      titulo="Seguridad de la cuenta"
      descripcion={
        user.tieneClave
          ? 'Cambiá tu contraseña. Si la olvidás, podés recuperarla por correo.'
          : 'Creá una contraseña para poder ingresar también con correo, además de Google.'
      }
    >
      <CambiarClaveForm user={user} />
    </CuentaShell>
  );
}
