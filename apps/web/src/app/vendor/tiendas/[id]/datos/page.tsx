'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Tienda } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StoreForm } from '@/components/forms/store-form';
import { EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { ImagenesTienda } from '@/components/vendor/imagenes-tienda';
import { usePanelTienda } from '@/components/vendor/panel-vendedor';

export default function DatosTiendaPage({ params }: { params: { id: string } }) {
  const { refresh: refrescarSesion } = useAuth();
  const { recargar: recargarPanel } = usePanelTienda();
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
        <Link href={`/vendor/tiendas/${params.id}`}>Volver al resumen</Link>
      </div>
    );
  }
  if (!tienda) return <PageSkeleton />;

  return (
    <section className="mp-panel">
      <EncabezadoPanel
        tienda={tienda}
        titulo="Datos de la tienda"
        icono="pencil"
        descripcion="Nombre, rubro, descripción, contacto y dirección: lo que ven tus clientes y usamos para facturar."
      />

      {tienda.permisos.includes('configuracion.editar') && <ImagenesTienda tienda={tienda} onChange={setTienda} />}

      {tienda.permisos.includes('configuracion.editar') ? (
        <StoreForm
          key={tienda.id}
          title="Editar datos"
          submitLabel="Guardar cambios"
          sendingLabel="Guardando…"
          successMessage="Cambios guardados"
          tienda={tienda}
          onSubmit={async (datos) => {
            setTienda(await api<Tienda>(`/stores/${tienda.id}`, { method: 'PATCH', body: datos }));
            // El nombre y el rubro también se ven en el menú y en el selector de tiendas.
            await refrescarSesion();
            recargarPanel();
          }}
        />
      ) : (
        <Alert kind="info">Solo quien administra la tienda puede cambiar sus datos.</Alert>
      )}
    </section>
  );
}
