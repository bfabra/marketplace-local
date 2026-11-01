'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, type TiendaResumen } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from '@/hooks/use-location';
import { useSeguidos } from '@/hooks/use-seguidos';
import { useToast } from '@/hooks/use-toast';
import { visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';

/** Guardar = seguir la tienda. Sin sesión lleva a ingresar. */
function Guardar({ tienda }: { tienda: TiendaResumen }) {
  const { user } = useAuth();
  const { ids, alternar } = useSeguidos();
  const router = useRouter();
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const guardada = ids.has(tienda.id);
  const propia = !!user?.tiendas.some((t) => t.id === tienda.id);
  if (propia) return null;

  async function alClic() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/tiendas/${tienda.slug}`)}`);
      return;
    }
    setOcupado(true);
    try {
      const ahora = await alternar(tienda.id);
      toast({ titulo: ahora ? `Guardaste ${tienda.nombre}` : `Quitaste ${tienda.nombre} de tus tiendas` });
    } catch (e) {
      toast({ titulo: e instanceof ApiError ? e.message : 'No pudimos actualizar', tipo: 'error' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      className={guardada ? 'saved' : undefined}
      aria-pressed={guardada}
      aria-label={`${guardada ? 'Quitar de guardados' : 'Guardar'} ${tienda.nombre}`}
      disabled={ocupado}
      onClick={alClic}
    >
      <Icon name="heart" size={15} />
    </button>
  );
}

/** Tarjeta de tienda de la maqueta (docs/diseno, Cards.store). */
export function MarketStoreCard({
  tienda,
  foto,
  compact = false,
}: {
  tienda: TiendaResumen;
  foto?: string;
  compact?: boolean;
}) {
  const { localidades } = useLocation();
  const provincia = localidades.find((l) => l.id === tienda.localidad_id)?.provincia;
  const visual = visualCategoria(tienda.rubro?.slug);
  // Sin portada propia, se muestra una foto de sus productos.
  const imagen = tienda.portada ?? foto;

  return (
    <article className={`market-store-card${compact ? ' compact' : ''}`}>
      <div className="market-store-image">
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt={tienda.portada ? tienda.nombre : `Producto de ${tienda.nombre}`} loading="lazy" />
        ) : (
          <div className="market-store-sin-foto" aria-hidden="true">
            <Icon name={visual.icono} size={compact ? 34 : 46} strokeWidth={1.4} />
          </div>
        )}
        {tienda.nueva && <span>NUEVO</span>}
        <Guardar tienda={tienda} />
      </div>
      <div className="market-store-copy">
        <small>{tienda.rubro?.nombre ?? 'Comercio local'}</small>
        <h3>{tienda.nombre}</h3>
        <p>
          <Icon name="pin" size={13} /> {tienda.localidad}
          {provincia && provincia !== tienda.localidad ? `, ${provincia}` : ''}
        </p>
        <Link href={`/tiendas/${tienda.slug}`}>
          Ver tienda <Icon name="chevron-right" size={14} />
        </Link>
      </div>
    </article>
  );
}
