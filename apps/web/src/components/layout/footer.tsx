import Link from 'next/link';
import { TITULAR } from '@/lib/legal';
import { BRAND_NAME, LogoMark } from './logo';

/** Pie del marketplace: columnas de la maqueta + enlaces legales reales. */
export function Footer() {
  const correo = TITULAR.correo;

  return (
    <footer className="market-footer">
      <div className="footer-brand">
        <Link href="/" aria-label={`${BRAND_NAME}, ir al inicio`}>
          <LogoMark size={45} claro />
        </Link>
        <p>Comprar y vender en los comercios de tu ciudad, de forma simple.</p>
      </div>

      <div>
        <strong>Explorar</strong>
        <Link href="/">Inicio</Link>
        <Link href="/tiendas">Tiendas</Link>
        <Link href="/rubros">Rubros</Link>
      </div>

      <div>
        <strong>{BRAND_NAME}</strong>
        <Link href="/acerca">Acerca de la plataforma</Link>
        <Link href="/vendor/nueva-tienda">Sumá tu comercio</Link>
        <Link href="/preguntas">Preguntas frecuentes</Link>
      </div>

      <div>
        <strong>Ayuda</strong>
        <Link href="/ayuda">Centro de ayuda</Link>
        {correo ? <a href={`mailto:${correo}`}>Contacto</a> : <Link href="/ayuda">Contacto</Link>}
        <Link href="/terminos">Términos y privacidad</Link>
        <Link href="/privacidad">Privacidad</Link>
      </div>

      <p className="footer-bottom">
        © {new Date().getFullYear()} {BRAND_NAME} · Hecho con comercios de San Juan
      </p>
    </footer>
  );
}
