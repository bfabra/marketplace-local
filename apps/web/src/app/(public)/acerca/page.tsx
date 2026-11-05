import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND_NAME } from '@/components/layout/logo';

export const metadata: Metadata = {
  title: 'Acerca de la plataforma',
  description: `${BRAND_NAME}: marketplace que conecta vecinos con comercios de San Juan.`,
};

/** `#about` de la maqueta (docs/diseno/js/pages/about.js). */
export default function AcercaPage() {
  return (
    <div className="market-container legal-page acerca-page">
      <nav className="faq-breadcrumb" aria-label="Navegación">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">›</span>
        <span>Acerca de la plataforma</span>
      </nav>

      <article className="acerca-card">
        <header className="acerca-hero">
          <span className="acerca-eyebrow">Nuestra misión</span>
          <h1>¿Qué es {BRAND_NAME}?</h1>
          <p>
            El marketplace que conecta de forma directa, simple y rápida a los vecinos con los comercios de cercanía y
            emprendedores de la provincia de <strong>San Juan</strong>.
          </p>
        </header>

        <section>
          <h2>Comercio 100% sanjuanino</h2>
          <p>
            Nació para potenciar la economía local: detrás de cada negocio de barrio hay familias, esfuerzo y productos de
            calidad. Acercamos el almacén, la feria, la ferretería o la tienda de indumentaria a tu celular o computadora.
          </p>
        </section>

        <div className="acerca-grid">
          <section>
            <h3>Para vecinos</h3>
            <ul>
              <li>Descubrí comercios cerca tuyo por rubro y categoría</li>
              <li>Un solo carrito y un envío por dirección (o retiro en local)</li>
              <li>Seguí tus compras y envíos desde tu cuenta</li>
            </ul>
          </section>
          <section>
            <h3>Para comercios</h3>
            <ul>
              <li>Publicá catálogo, stock y ofertas en minutos</li>
              <li>Gestioná pedidos vigentes desde el panel</li>
              <li>Empezá con el plan Starter sin costo de alta</li>
            </ul>
          </section>
        </div>

        <footer className="acerca-cta">
          <Link href="/tiendas" className="mp-btn-secundario">
            Explorar tiendas
          </Link>
          <Link href="/vendor/nueva-tienda" className="mp-btn-crear">
            Sumá tu comercio
          </Link>
        </footer>
      </article>
    </div>
  );
}
