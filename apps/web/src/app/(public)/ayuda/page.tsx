'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { BRAND_NAME } from '@/components/layout/logo';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Icon } from '@/components/ui/icon';
import { TITULAR } from '@/lib/legal';

/**
 * Centro de ayuda (#help de la maqueta).
 * Atajos reales; tickets/reclamos del mockup quedan para una etapa con API.
 */
export default function AyudaPage() {
  const { user, loading } = useAuth();
  const correo = TITULAR.correo;

  if (loading) return <PageSkeleton />;

  if (!user) {
    return (
      <div className="market-container ayuda-page">
        <div className="ayuda-locked">
          <div className="ayuda-locked-icon" aria-hidden>
            <Icon name="lock" size={28} />
          </div>
          <h1>Acceso restringido</h1>
          <p>
            Para usar el Centro de ayuda y gestionar consultas sobre tus compras o tu comercio, iniciá sesión en{' '}
            {BRAND_NAME}.
          </p>
          <Link href="/login?next=/ayuda" className="mp-btn-crear">
            Iniciar sesión / Registrarse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="market-container ayuda-page">
      <header className="ayuda-hero">
        <h1>¿Con qué te ayudamos?</h1>
        <p>Atajos según tu cuenta en {BRAND_NAME} San Juan.</p>
      </header>

      <section className="ayuda-card">
        <h2>Atajos</h2>
        <ul className="ayuda-atajos">
          <li>
            <Link href="/mis-compras">
              <Icon name="bag" size={18} /> Mis compras
            </Link>
          </li>
          <li>
            <Link href="/mis-envios">
              <Icon name="truck" size={18} /> Estado de envíos
            </Link>
          </li>
          <li>
            <Link href="/preguntas">
              <Icon name="message" size={18} /> Preguntas frecuentes
            </Link>
          </li>
          <li>
            <Link href="/cuenta">
              <Icon name="user" size={18} /> Mi cuenta
            </Link>
          </li>
          <li>
            <Link href="/vendor">
              <Icon name="store" size={18} /> Panel de comerciante
            </Link>
          </li>
        </ul>
      </section>

      <section className="ayuda-card">
        <h2>Contacto</h2>
        <p className="ayuda-contacto-texto">
          Si tenés un reclamo por un pedido o necesitás soporte para tu comercio, escribinos. En una próxima etapa vas a
          poder abrir tickets desde acá.
        </p>
        {correo ? (
          <a href={`mailto:${correo}`} className="mp-btn-secundario">
            Escribir a {correo}
          </a>
        ) : (
          <p className="muted">El correo de soporte se publica cuando el titular complete los datos legales.</p>
        )}
      </section>
    </div>
  );
}
