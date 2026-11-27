'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Tienda } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { CambiarClaveForm } from '@/components/forms/cambiar-clave-form';

/** Panel comerciante → Seguridad y Cuenta (cambio de clave + recuperación). */
export default function SeguridadPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Tienda>(`/stores/${params.id}`)
      .then(setTienda)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  if (error && !tienda) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={`/vendor/tiendas/${params.id}`}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda || !user) return <PageSkeleton />;

  return (
    <section className="mp-panel mp-seguridad">
      <EncabezadoPanel
        titulo="Seguridad y Cuenta"
        descripcion="Administrá la contraseña de acceso a tu cuenta."
      />

      <CambiarClaveForm user={user} />

      <p className="mp-seguridad-pie">
        <Link href="/cuenta">
          Ir a Mi cuenta completa <Icon name="arrow-right" size={14} />
        </Link>
      </p>
    </section>
  );
}
