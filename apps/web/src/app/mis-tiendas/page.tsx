'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSeguidos } from '@/hooks/use-seguidos';
import { useDirectorio } from '@/hooks/use-directorio';
import { plural } from '@/lib/visual';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';
import { MarketStoreCard } from '@/components/catalog/market-store-card';

/**
 * Tiendas favoritas dentro de #profile (maqueta fav-stores).
 * No redirige a /tiendas?guardadas=1: el listado queda en el panel de cuenta.
 */
export default function MisTiendasPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { ids: seguidas } = useSeguidos();
  const { datos: directorio, error } = useDirectorio();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/mis-tiendas');
  }, [loading, user, router]);

  const tiendas = useMemo(
    () => directorio?.tiendas.filter((t) => seguidas.has(t.id)) ?? [],
    [directorio, seguidas]
  );

  if (loading || !user) return <PageSkeleton />;

  return (
    <CuentaShell
      user={user}
      titulo="Mis tiendas favoritas"
      descripcion="Acceso rápido a tus comercios preferidos en CompraLocal."
    >
      {error ? (
        <EmptyState icono="alert" titulo="No pudimos cargar tus tiendas">
          Revisá tu conexión e intentá de nuevo en unos segundos.
        </EmptyState>
      ) : !directorio ? (
        <PageSkeleton />
      ) : tiendas.length === 0 ? (
        <EmptyState
          icono="store"
          titulo="Todavía no seguís ninguna tienda"
          acciones={
            <Link href="/tiendas" className="market-primary-button">
              Explorar comercios
            </Link>
          }
        >
          Guardá comercios con el corazón en su ficha para encontrarlos acá después.
        </EmptyState>
      ) : (
        <>
          <p className="cuenta-fav-resumen muted">
            {plural(tiendas.length, 'comercio guardado', 'comercios guardados')}.
          </p>
          <div className="cuenta-fav-tiendas-grid cuenta-fav-tiendas-panel">
            {tiendas.map((t) => (
              <MarketStoreCard key={t.id} tienda={t} foto={directorio.fotos.get(t.slug)} />
            ))}
          </div>
        </>
      )}
    </CuentaShell>
  );
}
