'use client';

import Link from 'next/link';
import type { TiendaResumen } from '@/lib/api-client';
import { useLocation } from '@/hooks/use-location';
import { plural, tonoDe, visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { StoreAvatar } from './store-avatar';

export function StoreCard({ tienda }: { tienda: TiendaResumen }) {
  const { localidad } = useLocation();
  const cerca =
    !!localidad && (tienda.localidad_id ? tienda.localidad_id === localidad.id : tienda.localidad === localidad.nombre);
  const visual = tienda.rubro ? visualCategoria(tienda.rubro.slug) : null;
  const tono = visual?.tono ?? tonoDe(tienda.nombre);

  return (
    <article className="scard">
      <div className="scard-cover" style={{ background: `linear-gradient(135deg, ${tono.bg}, #ffffff)` }}>
        {visual && (
          <span className="scard-cover-icono" style={{ color: tono.fg }}>
            <Icon name={visual.icono} size={56} strokeWidth={1.25} />
          </span>
        )}
        <div className="scard-tags">
          {cerca && <span className="tag tag-cerca">En tu zona</span>}
          {tienda.nueva && <span className="tag tag-nuevo">Nueva</span>}
        </div>
      </div>
      <div className="scard-body">
        <StoreAvatar nombre={tienda.nombre} rubro={tienda.rubro?.slug} className="scard-avatar" />
        <h3 className="scard-nombre">
          <Link href={`/tiendas/${tienda.slug}`} className="scard-link">
            {tienda.nombre}
          </Link>
        </h3>
        <p className="scard-meta">
          <Icon name="pin" size={14} />
          {tienda.localidad}
          {tienda.rubro && <span aria-hidden="true">·</span>}
          {tienda.rubro && <span>{tienda.rubro.subrubro ?? tienda.rubro.nombre}</span>}
        </p>
        {tienda.rubro?.subrubro && <p className="scard-rubro">{tienda.rubro.nombre}</p>}
        {tienda.descripcion && <p className="scard-desc">{tienda.descripcion}</p>}
        <p className="scard-pie">
          <Icon name="bag" size={14} />
          {tienda.productos > 0 ? plural(tienda.productos, 'producto', 'productos') : 'Pronto con productos'}
        </p>
      </div>
    </article>
  );
}
