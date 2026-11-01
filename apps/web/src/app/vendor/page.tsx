'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { iniciales } from '@/lib/visual';
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StoreStatus } from '@/components/ui/store-status';
import { CuentaNav } from '@/components/layout/cuenta-nav';

const BENEFICIOS: { icono: IconName; titulo: string; texto: string }[] = [
  { icono: 'sparkles', titulo: 'Gratis para empezar', texto: 'Con el plan Starter, sin costo, publicás hasta 10 productos.' },
  { icono: 'card', titulo: 'Cobrás con Mercado Pago', texto: 'El dinero de cada venta llega directo a tu cuenta.' },
  { icono: 'truck', titulo: 'Envío o retiro', texto: 'Tus clientes eligen recibirlo en su casa o pasar por tu local.' },
];

const PASOS = [
  { titulo: 'Cargá los datos de tu tienda', texto: 'Nombre, CUIT, dirección y contacto.' },
  { titulo: 'Vinculá Mercado Pago', texto: 'Para poder cobrar tus ventas.' },
  { titulo: 'Publicá tus productos', texto: 'Cuando el equipo la apruebe, tu tienda queda visible.' },
];

export default function VendorPage() {
  const { user, loading } = useAuth();
  const tiendas = user?.tiendas ?? [];

  if (loading) return <PageSkeleton />;

  if (tiendas.length === 0) {
    return (
      <div className="stack-lg">
        <div className="stack">
          <EncabezadoPagina
            destacado
            icono="store"
            antetitulo="Vender"
            titulo="Vendé en Tu Comercio Local"
            descripcion="Abrí tu tienda gratis y mostrá tus productos a los vecinos de tu zona."
          >
            <Link href="/vendor/nueva-tienda" className="btn btn-accent">
              <Icon name="store" size={16} /> Abrir mi tienda
            </Link>
          </EncabezadoPagina>
          <CuentaNav />
        </div>

        <ul className="vender-beneficios">
          {BENEFICIOS.map((b) => (
            <li key={b.titulo} className="card">
              <span className="icono-suave" aria-hidden="true">
                <Icon name={b.icono} size={20} />
              </span>
              <h2>{b.titulo}</h2>
              <p className="muted">{b.texto}</p>
            </li>
          ))}
        </ul>

        <section className="card stack">
          <div className="tarjeta-cabecera">
            <span className="icono-suave" aria-hidden="true">
              <Icon name="check" size={20} />
            </span>
            <div>
              <h2>Cómo empezar</h2>
              <p>Tres pasos y tu tienda está lista para vender.</p>
            </div>
          </div>
          <ol className="vender-pasos">
            {PASOS.map((p, i) => (
              <li key={p.titulo}>
                <span className="vender-paso-numero" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <strong>{p.titulo}</strong>
                  <span className="muted">{p.texto}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="actions">
            <Link href="/vendor/nueva-tienda" className="btn btn-accent">
              Empezar ahora
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <EncabezadoPagina
        destacado
        icono="store"
        antetitulo="Panel de mi tienda"
        titulo="Mis tiendas"
        descripcion="Elegí una tienda para ver sus pedidos, productos, equipo y plan."
      >
        <Link href="/vendor/nueva-tienda" className="btn btn-secondary">
          <Icon name="plus" size={16} /> Abrir otra tienda
        </Link>
      </EncabezadoPagina>

      <ul className="mis-tiendas">
        {tiendas.map((t) => (
          <li key={t.id} className="card mi-tienda">
            <div className="mi-tienda-cabecera">
              <span className="mi-tienda-inicial" aria-hidden="true">
                {iniciales(t.nombre)}
              </span>
              <div className="mi-tienda-texto">
                <h2>{t.nombre}</h2>
                <span className="muted">{t.rol === 'propietario' ? 'Sos el dueño' : `Rol: ${t.rol}`}</span>
              </div>
              <StoreStatus estado={t.estado} />
            </div>
            <div className="actions mi-tienda-acciones">
              <Link href={`/vendor/tiendas/${t.id}`} className="btn">
                <Icon name="sliders" size={16} /> Administrar
              </Link>
              {t.estado === 'activa' && (
                <Link href={`/tiendas/${t.slug}`} className="btn btn-secondary">
                  <Icon name="eye" size={16} /> Ver tienda
                </Link>
              )}
            </div>
          </li>
        ))}
        <li>
          <Link href="/vendor/nueva-tienda" className="mi-tienda-nueva">
            <Icon name="plus" size={22} />
            <strong>Abrir otra tienda</strong>
            <span className="muted">Empezás con el plan Starter, sin costo.</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
