'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type SugerenciasSeguidas } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { plural } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { ProductCard } from '@/components/catalog/product-card';
import { StoreAvatar } from '@/components/catalog/store-avatar';

/** Solo con sesión: novedades de las tiendas que sigue la persona. */
export function FollowedSuggestions() {
  const { user, loading } = useAuth();
  const [datos, setDatos] = useState<SugerenciasSeguidas | null>(null);
  const userId = user?.id;

  useEffect(() => {
    setDatos(null);
    if (!userId) return;
    let vigente = true;
    api<SugerenciasSeguidas>('/seguidos/sugerencias')
      .then((d) => vigente && setDatos(d))
      .catch(() => vigente && setDatos(null));
    return () => {
      vigente = false;
    };
  }, [userId]);

  if (loading || !user || !datos) return null;

  if (datos.tiendas.length === 0) {
    return (
      <section className="card seguidas-vacio">
        <span className="seguidas-icono" aria-hidden="true">
          <Icon name="store" size={22} />
        </span>
        <div>
          <strong>Seguí a tus tiendas favoritas</strong>
          <p className="muted">Cuando sigas una tienda, vas a ver acá sus productos nuevos cada vez que entres.</p>
        </div>
        <Link href="/tiendas" className="btn btn-secondary">
          Explorar tiendas
        </Link>
      </section>
    );
  }

  return (
    <section className="seguidas stack" aria-labelledby="titulo-seguidas">
      <div>
        <h2 id="titulo-seguidas">
          <Icon name="sparkles" size={20} /> Para vos, de las tiendas que seguís
        </h2>
        <p className="muted">Lo más nuevo de {plural(datos.tiendas.length, 'tienda que seguís', 'tiendas que seguís')}.</p>
      </div>
      <ul className="seguidas-tiendas">
        {datos.tiendas.map((t) => (
          <li key={t.id}>
            <Link href={`/tiendas/${t.slug}`} className="seguida-chip">
              <StoreAvatar nombre={t.nombre} rubro={t.rubro?.slug} className="store-avatar-sm" />
              <span>
                <strong>{t.nombre}</strong>
                <small className={t.novedades > 0 ? 'seguida-novedades' : 'muted'}>
                  {t.novedades > 0 ? plural(t.novedades, 'producto nuevo', 'productos nuevos') : t.localidad}
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {datos.productos.length > 0 ? (
        <div className="product-grid">
          {datos.productos.slice(0, 8).map((p) => (
            <ProductCard key={p.id} producto={p} />
          ))}
        </div>
      ) : (
        <p className="muted">Las tiendas que seguís todavía no publicaron productos.</p>
      )}
    </section>
  );
}
