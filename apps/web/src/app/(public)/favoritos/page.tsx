'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type TarjetaProducto } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import { plural } from '@/lib/visual';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CuentaShell } from '@/components/layout/cuenta-shell';
import { MarketProductCard } from '@/components/catalog/market-product-card';

export default function FavoritesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { ids, listo } = useFavorites();
  const [productos, setProductos] = useState<TarjetaProducto[] | null>(null);
  const clave = useMemo(() => [...ids].sort().join(','), [ids]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/favoritos');
  }, [loading, user, router]);

  useEffect(() => {
    if (!listo || !user) return;
    const lista = clave ? clave.split(',') : [];
    if (lista.length === 0) {
      setProductos([]);
      return;
    }
    api<{ productos: TarjetaProducto[] }>('/favorites')
      .then((r) => setProductos(r.productos))
      .catch(() => setProductos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, user?.id, clave]);

  const visibles = productos?.filter((p) => ids.has(p.id)) ?? null;

  if (loading || !user) return <PageSkeleton />;

  return (
    <CuentaShell
      user={user}
      titulo="Productos favoritos"
      descripcion={
        visibles
          ? `${plural(visibles.length, 'producto guardado', 'productos guardados')} para encontrar rápido después.`
          : 'Cargando…'
      }
    >
      {!visibles ? (
        <PageSkeleton />
      ) : visibles.length === 0 ? (
        <EmptyState
          icono="heart"
          titulo="Todavía no guardaste nada"
          acciones={
            <Link href="/tiendas" className="market-primary-button">
              Explorar tiendas
            </Link>
          }
        >
          Tocá el corazón en cualquier producto para guardarlo y encontrarlo rápido después.
        </EmptyState>
      ) : (
        <div className="cuenta-fav-grid">
          {visibles.map((p) =>
            p.tienda ? <MarketProductCard key={p.id} producto={p} tiendaSlug={p.tienda.slug} /> : null
          )}
        </div>
      )}
    </CuentaShell>
  );
}
