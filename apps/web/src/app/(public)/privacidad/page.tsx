import Link from 'next/link';
import { TITULAR } from '@/lib/legal';
import { DocumentoLegal, type SeccionLegal } from '@/components/legal/documento-legal';

export const metadata = { title: 'Política de Privacidad' };

const P = TITULAR.nombre;

const SECCIONES: SeccionLegal[] = [
  {
    id: 'responsable',
    titulo: 'Quién es responsable de tus datos',
    contenido: (
      <p>
        El responsable de la base de datos es {TITULAR.razonSocial ?? `el titular de ${P}`}
        {TITULAR.domicilio ? `, con domicilio en ${TITULAR.domicilio}` : ''}. Tratamos tus datos según la Ley 25.326 de
        Protección de los Datos Personales y su normativa complementaria.
      </p>
    ),
  },
  {
    id: 'datos',
    titulo: 'Qué datos recopilamos',
    contenido: (
      <ul>
        <li>
          <strong>Cuenta:</strong> nombre, apellido, correo, teléfono, DNI y la contraseña (guardada cifrada, nadie puede
          leerla). Si entrás con Google, recibimos tu nombre, correo, foto de perfil y un identificador de tu cuenta de Google.
        </li>
        <li>
          <strong>Compras:</strong> domicilios de entrega, pedidos, productos guardados y tiendas que seguís.
        </li>
        <li>
          <strong>Pagos:</strong> el estado y el identificador de cada pago. Los datos de la tarjeta los procesa Mercado Pago:
          no los guardamos.
        </li>
        <li>
          <strong>Tiendas:</strong> CUIT, razón social, teléfonos, dirección, ubicación en el mapa y las personas que trabajan
          en ellas.
        </li>
        <li>
          <strong>Uso:</strong> registros técnicos necesarios para la seguridad (por ejemplo, fecha de ingreso y cambios en la
          cuenta).
        </li>
      </ul>
    ),
  },
  {
    id: 'uso',
    titulo: 'Para qué los usamos',
    contenido: (
      <ul>
        <li>Crear y proteger tu cuenta, y verificar tu identidad cuando haga falta.</li>
        <li>Procesar tus pedidos, pagos, envíos, cancelaciones y reintegros.</li>
        <li>Mandarte correos necesarios del servicio, como el enlace para cambiar la contraseña o avisos de tus pedidos.</li>
        <li>Prevenir fraudes y cumplir obligaciones legales e impositivas.</li>
      </ul>
    ),
  },
  {
    id: 'compartir',
    titulo: 'Con quién los compartimos',
    contenido: (
      <>
        <p>
          Cuando comprás, la Tienda ve tu nombre, teléfono y domicilio de entrega para preparar y entregar el pedido. Tu DNI no
          se comparte con las Tiendas.
        </p>
        <p>
          También trabajamos con proveedores que nos prestan servicios: Mercado Pago (pagos), Google (ingreso con Google y
          mapas), el servicio de alojamiento y base de datos, y el de envío de correos. Solo reciben lo necesario para cada
          servicio. No vendemos tus datos.
        </p>
        <p>Podemos entregar datos a autoridades cuando una ley o una orden judicial lo exija.</p>
      </>
    ),
  },
  {
    id: 'conservacion',
    titulo: 'Cuánto tiempo los guardamos',
    contenido: (
      <p>
        Mientras tengas la cuenta activa. Si pedís la baja, borramos o anonimizamos tus datos, salvo los que debamos conservar
        por obligaciones legales (por ejemplo, los registros de compras y facturación), durante el plazo que fija la ley.
      </p>
    ),
  },
  {
    id: 'derechos',
    titulo: 'Tus derechos',
    contenido: (
      <>
        <p>
          Podés acceder a tus datos, rectificarlos, actualizarlos o pedir que los suprimamos. Buena parte la podés hacer vos
          desde <Link href="/cuenta">Mi cuenta</Link>; para lo demás, escribinos
          {TITULAR.correo ? (
            <>
              {' '}
              a <a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a>
            </>
          ) : (
            ' a través de los canales de contacto de la plataforma'
          )}
          . El acceso es gratuito en intervalos no menores a seis meses, salvo interés legítimo (artículo 14, inciso 3, de la
          Ley 25.326).
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley 25.326, tiene la
          atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
          incumplimiento de las normas vigentes en materia de protección de datos personales.
        </p>
      </>
    ),
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad',
    contenido: (
      <p>
        Usamos conexiones cifradas, contraseñas cifradas, permisos por persona y controles de acceso en la base de datos para
        que cada quien vea solo lo que le corresponde. Al cambiar tu contraseña cerramos las sesiones abiertas en otros
        dispositivos.
      </p>
    ),
  },
  {
    id: 'cookies',
    titulo: 'Cookies',
    contenido: (
      <p>
        Usamos una cookie propia para mantener tu sesión iniciada (si marcás “Recordarme”, dura 30 días) y el almacenamiento del
        navegador para recordar tu carrito y la localidad elegida. Si entrás con Google, Google puede usar sus propias cookies
        según su política. No usamos cookies publicitarias.
      </p>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios en esta política',
    contenido: (
      <p>
        Si cambiamos esta política de forma relevante, te lo avisaremos antes de que entre en vigencia. La fecha de la versión
        vigente figura al principio. Ver también los <Link href="/terminos">Términos y Condiciones</Link>.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <DocumentoLegal
      antetitulo="LEGALES"
      titulo="Política de Privacidad"
      intro={
        <p>
          En esta política te contamos qué datos tuyos guarda {P}, para qué los usa, con quién los comparte y cómo podés
          ejercer tus derechos.
        </p>
      }
      secciones={SECCIONES}
      otro={{ href: '/terminos', texto: 'Términos y Condiciones' }}
    />
  );
}
