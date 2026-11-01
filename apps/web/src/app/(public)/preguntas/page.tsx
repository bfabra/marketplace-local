import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND_NAME } from '@/components/layout/logo';
import { TITULAR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes',
  description: `Dudas sobre envíos, pagos, compras y cuentas en ${BRAND_NAME} San Juan.`,
};

const FAQS = [
  {
    q: `¿Cómo funcionan los envíos a domicilio en ${BRAND_NAME}?`,
    a: 'El envío a domicilio se calcula una sola vez según la localidad de tu dirección, aunque compres en varias tiendas. Al finalizar elegís envío o retiro y seguís el pedido desde Mis compras y Estado de envíos.',
  },
  {
    q: '¿Cuáles son los medios de pago aceptados?',
    a: 'Pagás con Mercado Pago (tarjetas, dinero en cuenta y otros medios que habilite Mercado Pago). El cobro se confirma antes de que el comercio prepare tu pedido.',
  },
  {
    q: '¿Cómo puedo convertir mi cuenta en Cuenta Comercio?',
    a: 'Desde tu perfil (menú arriba a la derecha o Mi cuenta) elegí “Convertirme en Comercio”. Completá los datos de tu local y vas a poder administrar productos y pedidos sin crear otra cuenta.',
  },
  {
    q: '¿Dónde veo mis comprobantes de compra?',
    a: 'Quedan en Mis compras, con el detalle de cada pedido, tiendas incluidas y estado del pago y de la entrega.',
  },
  {
    q: '¿Cómo se garantiza la seguridad de mis datos y compras?',
    a: `${BRAND_NAME} trabaja con comercios de San Juan y pagos a través de Mercado Pago. Ante cualquier inconveniente, podés contactar soporte desde Ayuda.`,
  },
];

/** Preguntas frecuentes (#faq de la maqueta). */
export default function PreguntasPage() {
  const correo = TITULAR.correo;

  return (
    <div className="market-container faq-page">
      <nav className="faq-breadcrumb" aria-label="Navegación">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">›</span>
        <span>Preguntas Frecuentes</span>
      </nav>

      <header className="faq-hero">
        <h1>Preguntas Frecuentes</h1>
        <p>Resolvé todas tus dudas sobre envíos, pagos, compras y cuentas en {BRAND_NAME} San Juan.</p>
      </header>

      <div className="faq-lista">
        {FAQS.map((item, i) => (
          <article key={item.q} className="faq-item">
            <h2>
              <span aria-hidden="true">{i + 1}.</span> {item.q}
            </h2>
            <p>{item.a}</p>
          </article>
        ))}
      </div>

      <aside className="faq-soporte">
        <h2>¿Tenés otra consulta?</h2>
        <p>Nuestro equipo de soporte en San Juan está disponible para ayudarte.</p>
        {correo ? (
          <a href={`mailto:${correo}`} className="market-primary-button">
            Contactar Soporte
          </a>
        ) : (
          <Link href="/cuenta" className="market-primary-button">
            Contactar Soporte
          </Link>
        )}
      </aside>
    </div>
  );
}
