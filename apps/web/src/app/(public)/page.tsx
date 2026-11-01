'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { OpcionRubro, TarjetaProducto, TiendaResumen } from '@/lib/api-client';
import { tiendasPorRubro, useDirectorio } from '@/hooks/use-directorio';
import { formatPrice } from '@/lib/utils';
import { descuento, plural, visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { ControlesCarrusel, PistaCarrusel } from '@/components/catalog/carrusel';
import { MarketStoreCard } from '@/components/catalog/market-store-card';
import { MarketProductCard, enlaceProducto } from '@/components/catalog/market-product-card';
import { BRAND_NAME } from '@/components/layout/logo';

/** Un solo costo por dirección (regla real; no $2.999 × tienda de la maqueta demo). */
const RUBROS_EN_PORTADA = 7;
const RUBROS_CON_TIENDAS = 5;
const SECTORES_PRODUCTOS = 3;

/** Portada del marketplace: maqueta docs/diseno #marketplace (oct 2026). */
export default function HomePage() {
  const { datos, error } = useDirectorio();
  const cuenta = useMemo(() => tiendasPorRubro(datos?.tiendas ?? []), [datos]);

  const rubrosPortada = useMemo(() => {
    const lista = [...(datos?.rubros ?? [])].sort(
      (a, b) => (cuenta.get(b.slug) ?? 0) - (cuenta.get(a.slug) ?? 0) || a.nombre.localeCompare(b.nombre, 'es')
    );
    return lista.slice(0, RUBROS_EN_PORTADA);
  }, [datos, cuenta]);

  const destacadas = useMemo(() => {
    if (!datos) return [];
    return [...datos.tiendas]
      .sort(
        (a, b) =>
          Number(!!b.portada) - Number(!!a.portada) ||
          Number(datos.fotos.has(b.slug)) - Number(datos.fotos.has(a.slug)) ||
          b.productos - a.productos
      )
      .slice(0, 10);
  }, [datos]);

  const rubrosConTiendas = useMemo(() => {
    if (!datos) return [] as { rubro: OpcionRubro; tiendas: TiendaResumen[] }[];
    return [...datos.rubros]
      .map((rubro) => ({
        rubro,
        tiendas: datos.tiendas
          .filter((t) => t.rubro?.slug === rubro.slug)
          .sort((a, b) => Number(!!b.nueva) - Number(!!a.nueva) || b.productos - a.productos)
          .slice(0, 8),
      }))
      .filter((x) => x.tiendas.length > 0)
      .slice(0, RUBROS_CON_TIENDAS);
  }, [datos]);

  const ofertas = useMemo(() => {
    if (!datos) return [] as TarjetaProducto[];
    return datos.productos
      .filter((p) => p.precio_oferta != null && p.precio != null && p.precio_oferta < p.precio && p.tienda)
      .slice(0, 12);
  }, [datos]);

  const productosPorRubro = useMemo(() => {
    if (!datos) return [] as { rubro: OpcionRubro; productos: TarjetaProducto[] }[];
    const porSlug = new Map(datos.tiendas.map((t) => [t.slug, t]));
    return [...datos.rubros]
      .map((rubro) => ({
        rubro,
        productos: datos.productos
          .filter((p) => p.tienda && porSlug.get(p.tienda.slug)?.rubro?.slug === rubro.slug)
          .slice(0, 8),
      }))
      .filter((x) => x.productos.length > 0)
      .slice(0, SECTORES_PRODUCTOS);
  }, [datos]);

  const nuevas = datos?.tiendas.filter((t) => t.nueva).slice(0, 3) ?? [];

  return (
    <div className="page-enter">
      <Hero />
      <BannerMovil />

      <div className="market-container home-page">
        <section className="market-section" aria-labelledby="titulo-rubros">
          <div className="market-section-heading">
            <div>
              <span>EXPLORÁ POR RUBRO</span>
              <h2 id="titulo-rubros">Encontrá lo que necesitás</h2>
            </div>
            <Link href="/rubros">
              Ver más <Icon name="chevron-right" size={15} />
            </Link>
          </div>
          <div className="home-category-grid home-category-grid-8">
            {datos
              ? rubrosPortada.map((r) => (
                  <Link key={r.id} href={`/tiendas?rubro=${r.slug}`}>
                    <i>
                      <Icon name={visualCategoria(r.slug).icono} size={22} />
                    </i>
                    <strong>{r.nombre}</strong>
                    <span>{cuenta.get(r.slug) ? plural(cuenta.get(r.slug)!, 'tienda', 'tiendas') : 'Próximamente'}</span>
                  </Link>
                ))
              : Array.from({ length: RUBROS_EN_PORTADA }, (_, i) => <div key={i} className="home-category-vacia" />)}
            <Link href="/rubros" className="home-category-mas">
              <i>
                <Icon name="grid" size={22} />
              </i>
              <strong>Más categorías</strong>
              <span>Ver todos ({datos?.rubros.length ?? '…'})</span>
            </Link>
          </div>
          {error && <p className="market-aviso">No pudimos cargar los rubros. Intentá de nuevo en unos segundos.</p>}
        </section>

        <section className="market-section" aria-labelledby="titulo-destacadas">
          <div className="market-section-heading">
            <div>
              <span>SELECCIÓN LOCAL</span>
              <h2 id="titulo-destacadas">Tiendas destacadas</h2>
              <p>Conocé los comercios reales que confían en {BRAND_NAME}.</p>
            </div>
            {destacadas.length > 3 ? (
              <ControlesCarrusel targetId="carrusel-destacadas" />
            ) : (
              <Link href="/tiendas">
                Ver más <Icon name="chevron-right" size={15} />
              </Link>
            )}
          </div>
          {datos && destacadas.length === 0 ? (
            <div className="market-empty">
              <i>
                <Icon name="store" size={28} />
              </i>
              <h2>Muy pronto, los primeros comercios</h2>
              <p>Estamos aprobando las primeras tiendas. ¿Tenés un negocio? Podés ser de los primeros.</p>
              <Link href="/vendor/nueva-tienda">Sumá tu comercio</Link>
            </div>
          ) : (
            <PistaCarrusel id="carrusel-destacadas" className="carrusel-tiendas">
              {datos
                ? destacadas.map((t) => (
                    <div key={t.id} className="carrusel-item-tienda">
                      <MarketStoreCard tienda={t} foto={datos.fotos.get(t.slug)} />
                    </div>
                  ))
                : Array.from({ length: 3 }, (_, i) => <div key={i} className="market-store-card market-store-vacia" />)}
            </PistaCarrusel>
          )}
        </section>

        {rubrosConTiendas.map(({ rubro, tiendas }) => (
          <section key={rubro.id} className="market-section" aria-labelledby={`rubro-${rubro.slug}`}>
            <div className="market-section-heading">
              <div>
                <span>RUBRO DESTACADO</span>
                <h2 id={`rubro-${rubro.slug}`}>{rubro.nombre}</h2>
              </div>
              <Link href={`/tiendas?rubro=${rubro.slug}`}>
                Ver más <Icon name="chevron-right" size={15} />
              </Link>
            </div>
            <div className="home-store-grid">
              {tiendas.map((t) => (
                <MarketStoreCard key={t.id} tienda={t} foto={datos!.fotos.get(t.slug)} />
              ))}
            </div>
            <div className="home-ver-mas-rubro">
              <Link href={`/tiendas?rubro=${rubro.slug}`}>Ver más tiendas de {rubro.nombre}</Link>
            </div>
          </section>
        ))}

        {ofertas.length > 0 && (
          <section className="market-section" aria-labelledby="titulo-ofertas">
            <div className="market-section-heading">
              <div>
                <span>APROVECHÁ HOY</span>
                <h2 id="titulo-ofertas">Ofertas imperdibles</h2>
                <p>Precios especiales de comercios cercanos.</p>
              </div>
              <ControlesCarrusel targetId="carrusel-ofertas" />
            </div>
            <PistaCarrusel id="carrusel-ofertas" className="carrusel-productos">
              {ofertas.map((p) => (
                <TarjetaOferta key={p.id} producto={p} />
              ))}
            </PistaCarrusel>
            <AutoplayCarrusel targetId="carrusel-ofertas" />
          </section>
        )}

        <section className="home-cta-comercio">
          <div>
            <span>¿Tenés un negocio en San Juan?</span>
            <h2>Sumá tu comercio a {BRAND_NAME}</h2>
            <p>Llegá a más clientes en toda la provincia con envíos gestionados y cobros seguros. Creá tu tienda en minutos.</p>
          </div>
          <Link href="/vendor/nueva-tienda">Crear mi comercio gratis</Link>
        </section>

        {nuevas.length > 0 && datos && (
          <section className="market-section new-stores-section" aria-labelledby="titulo-nuevos">
            <div className="market-section-heading">
              <div>
                <span>RECIÉN LLEGADOS</span>
                <h2 id="titulo-nuevos">Nuevos comercios</h2>
              </div>
            </div>
            <div className="new-store-grid">
              {nuevas.map((t) => (
                <MarketStoreCard key={t.id} tienda={t} foto={datos.fotos.get(t.slug)} compact />
              ))}
            </div>
          </section>
        )}

        {productosPorRubro.map(({ rubro, productos }) => (
          <section key={rubro.id} className="market-section" aria-labelledby={`sector-${rubro.slug}`}>
            <div className="market-section-heading">
              <div>
                <span>DESTACADOS EN SECTOR</span>
                <h2 id={`sector-${rubro.slug}`}>{rubro.nombre}</h2>
              </div>
              <Link href={`/tiendas?rubro=${rubro.slug}`}>
                Ver más <Icon name="chevron-right" size={15} />
              </Link>
            </div>
            <div className="home-product-grid">
              {productos.map((p) =>
                p.tienda ? <MarketProductCard key={p.id} producto={p} tiendaSlug={p.tienda.slug} /> : null
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  const router = useRouter();
  const [texto, setTexto] = useState('');

  function buscar(e: FormEvent) {
    e.preventDefault();
    router.push(texto.trim() ? `/buscar?q=${encodeURIComponent(texto.trim())}` : '/buscar');
  }

  return (
    <section className="market-hero" aria-labelledby="titulo-hero">
      <div className="market-hero-overlay" />
      <div className="market-hero-content">
        <span>TODO CERCA TUYO · UN SOLO ENVÍO A TU DIRECCIÓN</span>
        <h1 id="titulo-hero">
          Descubrí los comercios
          <br />
          de tu zona en San Juan
        </h1>
        <p>Negocios reales de la provincia, con entrega directa a la puerta de tu casa.</p>
        <form role="search" onSubmit={buscar}>
          <Icon name="search" size={20} />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Qué comercio, rubro o producto buscás?"
            aria-label="Buscar comercio, rubro o producto"
            enterKeyHint="search"
          />
          <button type="submit">Buscar</button>
        </form>
        <small>
          <Icon name="pin" size={14} /> Comercios verificados en San Juan
        </small>
      </div>
    </section>
  );
}

const MENSAJES_BANNER = [
  'Envío a domicilio: un solo costo por dirección',
  'Negocios 100% locales y reales',
  'Recibí tu compra sin moverte',
  'Apoyá a los emprendedores de la provincia',
];

function BannerMovil() {
  const grupo = MENSAJES_BANNER.map((t) => (
    <span key={t} className="moving-banner-item">
      {t}
    </span>
  ));
  return (
    <div className="moving-banner-wrapper" aria-hidden="true">
      <div className="moving-banner-track">
        <div className="moving-banner-group">{grupo}</div>
        <div className="moving-banner-group">{grupo}</div>
      </div>
    </div>
  );
}

function TarjetaOferta({ producto }: { producto: TarjetaProducto }) {
  const pct = descuento(producto.precio, producto.precio_oferta);
  if (!producto.tienda) return null;
  return (
    <Link href={enlaceProducto(producto.tienda.slug, producto.slug)} className="home-oferta-card" scroll={false}>
      {pct != null && <span className="home-oferta-badge">{pct}% OFF</span>}
      <div className="home-oferta-foto">
        {producto.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={producto.imagen} alt="" loading="lazy" />
        ) : (
          <i aria-hidden="true">
            <Icon name="image" size={32} strokeWidth={1.4} />
          </i>
        )}
      </div>
      <strong>{producto.nombre}</strong>
      <div className="home-oferta-precios">
        <span>{formatPrice(producto.precio_oferta!)}</span>
        <del>{formatPrice(producto.precio!)}</del>
      </div>
      <div className="home-oferta-pie">
        <small>
          <Icon name="pin" size={12} /> {producto.tienda.localidad}
        </small>
        <small className="home-oferta-envio">Envío a domicilio</small>
      </div>
    </Link>
  );
}

/** Autoplay suave del carrusel de ofertas; se pausa al pasar el mouse. */
function AutoplayCarrusel({ targetId }: { targetId: string }) {
  const pausado = useRef(false);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const pausar = () => {
      pausado.current = true;
    };
    const reanudar = () => {
      pausado.current = false;
    };
    el.addEventListener('mouseenter', pausar);
    el.addEventListener('mouseleave', reanudar);
    const t = setInterval(() => {
      if (pausado.current || !document.body.contains(el)) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 12) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 280, behavior: 'smooth' });
      }
    }, 3500);
    return () => {
      clearInterval(t);
      el.removeEventListener('mouseenter', pausar);
      el.removeEventListener('mouseleave', reanudar);
    };
  }, [targetId]);
  return null;
}
