import Link from 'next/link';
import { TITULAR } from '@/lib/legal';
import { DocumentoLegal, type SeccionLegal } from '@/components/legal/documento-legal';

export const metadata = { title: 'Términos y Condiciones' };

const P = TITULAR.nombre;

const SECCIONES: SeccionLegal[] = [
  {
    id: 'objeto',
    titulo: 'Qué es la plataforma',
    contenido: (
      <>
        <p>
          {P} es un marketplace que permite a comercios de la zona (las <strong>Tiendas</strong>) publicar sus productos y a
          las personas usuarias (los <strong>Compradores</strong>) comprarlos en línea.
        </p>
        <p>
          {P} no es vendedor de los productos publicados: cada Tienda es la proveedora frente al Comprador y responde por lo
          que ofrece, su precio, su stock, su calidad, sus garantías, la facturación y el cumplimiento de la entrega o el retiro
          que haya ofrecido. {P} brinda el espacio, las herramientas de publicación y gestión, y el canal de pago.
        </p>
      </>
    ),
  },
  {
    id: 'aceptacion',
    titulo: 'Aceptación',
    contenido: (
      <>
        <p>
          Al crear una cuenta (con correo y contraseña o con Google) aceptás estos Términos y la{' '}
          <Link href="/privacidad">Política de Privacidad</Link>. Registramos la versión que aceptaste y la fecha.
        </p>
        <p>
          Si cambiamos estos Términos de forma relevante, te lo avisaremos con anticipación razonable. Si seguís usando la
          plataforma después de la fecha de vigencia, se entiende que aceptás los cambios; si no estás de acuerdo, podés pedir la
          baja de tu cuenta.
        </p>
      </>
    ),
  },
  {
    id: 'cuenta',
    titulo: 'Tu cuenta',
    contenido: (
      <>
        <p>
          Para comprar o vender tenés que ser mayor de 18 años y cargar datos verdaderos y actualizados (nombre, DNI, correo y
          domicilio de entrega). La cuenta es personal: cuidá tu contraseña y avisanos si creés que alguien más entró.
        </p>
        <p>
          Podemos suspender o dar de baja cuentas que den datos falsos, incumplan estos Términos, cometan fraude o perjudiquen a
          otras personas usuarias, con aviso al titular salvo que la ley o la urgencia del caso lo impidan.
        </p>
      </>
    ),
  },
  {
    id: 'compras',
    titulo: 'Compras, precios y pagos',
    contenido: (
      <>
        <p>
          Los precios se muestran en pesos argentinos e incluyen impuestos, salvo que la Tienda indique otra cosa. El costo de
          envío, cuando corresponde, se informa antes de confirmar el pedido.
        </p>
        <p>
          Los pagos se procesan a través de Mercado Pago, sujetos a sus propios términos. {P} no almacena los datos completos de
          tu tarjeta. Un pedido queda confirmado cuando el pago se acredita.
        </p>
        <p>
          Si una Tienda no puede cumplir un pedido (por ejemplo, por falta de stock), lo cancela y se reintegra el importe por el
          mismo medio de pago.
        </p>
      </>
    ),
  },
  {
    id: 'arrepentimiento',
    titulo: 'Derecho de arrepentimiento',
    contenido: (
      <>
        <p>
          Según el artículo 34 de la Ley 24.240 de Defensa del Consumidor, podés revocar la compra dentro de los{' '}
          <strong>10 días corridos</strong> desde que recibiste el producto o se celebró el contrato, lo último que ocurra, sin
          costo ni necesidad de dar explicaciones. El producto tiene que devolverse en las mismas condiciones en que lo
          recibiste, y los gastos de devolución quedan a cargo de la Tienda.
        </p>
        <p>
          Para pedirlo, contactá a la Tienda (sus datos están en el detalle del pedido, en{' '}
          <Link href="/mis-compras">Mis compras</Link>) o al equipo de {P}. Las garantías legales de los productos (artículos
          11 y siguientes de la Ley 24.240) corren por cuenta de la Tienda.
        </p>
      </>
    ),
  },
  {
    id: 'tiendas',
    titulo: 'Para las Tiendas',
    contenido: (
      <>
        <p>
          Quien abre una Tienda declara que tiene facultades para representar al comercio y que el CUIT y los datos cargados
          son correctos. Se compromete a publicar solo productos que pueda vender legalmente, con descripciones, fotos y precios
          veraces, y a cumplir con la normativa de defensa del consumidor, lealtad comercial, facturación y la que regule su
          rubro.
        </p>
        <p>
          El plan elegido, sus límites y comisiones se informan en el panel de la Tienda antes de contratarlo. Las Tiendas
          nuevas quedan pendientes hasta que el equipo de {P} las revisa.
        </p>
        <p>
          Está prohibido publicar productos ilegales, falsificados, robados, peligrosos sin la habilitación correspondiente o
          que infrinjan derechos de terceros. Podemos pausar publicaciones o Tiendas que incumplan estas reglas.
        </p>
      </>
    ),
  },
  {
    id: 'contenido',
    titulo: 'Contenido y propiedad intelectual',
    contenido: (
      <p>
        La marca, el diseño y el software de {P} le pertenecen a su titular. Las Tiendas conservan los derechos sobre sus fotos,
        logos y textos, y nos autorizan a mostrarlos dentro de la plataforma y en su promoción mientras la publicación esté
        activa. Nadie puede copiar ni usar de forma automatizada el contenido de la plataforma sin autorización.
      </p>
    ),
  },
  {
    id: 'responsabilidad',
    titulo: 'Responsabilidad',
    contenido: (
      <p>
        Trabajamos para que la plataforma funcione de forma continua y segura, pero puede haber interrupciones por
        mantenimiento o causas ajenas. Nada de lo dispuesto en estos Términos limita los derechos que te reconoce la Ley 24.240
        ni la responsabilidad que la ley les asigna a quienes intervienen en la cadena de comercialización.
      </p>
    ),
  },
  {
    id: 'reclamos',
    titulo: 'Consultas, reclamos y ley aplicable',
    contenido: (
      <>
        <p>
          Ante un problema con un pedido, primero escribile a la Tienda desde el detalle de tu compra. Si no se resuelve, podés
          contactar al equipo de {P}
          {TITULAR.correo ? (
            <>
              {' '}
              en <a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a>
            </>
          ) : null}
          . También podés hacer tu reclamo ante la autoridad de defensa del consumidor de tu jurisdicción o en el sistema
          nacional de Ventanilla Única Federal (argentina.gob.ar/produccion/defensadelconsumidor).
        </p>
        <p>
          Estos Términos se rigen por las leyes de la República Argentina. Para cualquier controversia son competentes los
          tribunales ordinarios de {TITULAR.jurisdiccion}, sin perjuicio del derecho del consumidor a elegir los tribunales de
          su domicilio (artículo 36 de la Ley 24.240).
        </p>
      </>
    ),
  },
];

export default function TerminosPage() {
  return (
    <DocumentoLegal
      antetitulo="LEGALES"
      titulo="Términos y Condiciones"
      intro={
        <p>
          Estas son las reglas para usar {P}, tanto para comprar como para vender. Las escribimos en lenguaje simple; si algo no
          queda claro, consultanos antes de usar la plataforma.
        </p>
      }
      secciones={SECCIONES}
      otro={{ href: '/privacidad', texto: 'Política de Privacidad' }}
    />
  );
}
