'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, type TelefonoTienda, type TiendaPublica } from '@/lib/api-client';
import { TIPOS_TELEFONO, enlaceTelefono, verTelefono } from '@/lib/telefonos';
import { MapaTienda } from '@/components/forms/ubicacion-tienda';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from '@/hooks/use-location';
import { useSeguidos } from '@/hooks/use-seguidos';
import { useToast } from '@/hooks/use-toast';
import { iniciales, plural, visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { MarketProductCard, enlaceProducto } from '@/components/catalog/market-product-card';
import { ProductoModal } from '@/components/catalog/producto-modal';
import { BRAND_NAME } from '@/components/layout/logo';

type Pestania = 'productos' | 'info' | 'contacto';
const PESTANIAS: [Pestania, string][] = [
  ['productos', 'Productos'],
  ['info', 'Información'],
  ['contacto', 'Contacto'],
];
const TODOS = 'Todos';
const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Seguir la tienda (maqueta #store). Sin sesión → login; el dueño ve un chip “Tu tienda”. */
function Seguir({ tienda, onSeguidores }: { tienda: TiendaPublica; onSeguidores: (delta: number) => void }) {
  const { user } = useAuth();
  const { ids, alternar } = useSeguidos();
  const router = useRouter();
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const siguiendo = ids.has(tienda.id);
  const propia = !!user?.tiendas.some((t) => t.id === tienda.id);

  if (propia) {
    return (
      <span className="follow-button follow-propia" aria-label="Estás viendo tu tienda pública">
        <Icon name="store" size={16} /> <span>Tu tienda</span>
      </span>
    );
  }

  async function alClic() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/tiendas/${tienda.slug}`)}`);
      return;
    }
    setOcupado(true);
    try {
      const ahora = await alternar(tienda.id);
      onSeguidores(ahora ? 1 : -1);
      toast({ titulo: ahora ? `Seguís a ${tienda.nombre}` : `Dejaste de seguir a ${tienda.nombre}` });
    } catch (e) {
      toast({ titulo: e instanceof ApiError ? e.message : 'No pudimos actualizar', tipo: 'error' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button type="button" className="follow-button" aria-pressed={siguiendo} disabled={ocupado} onClick={alClic}>
      <Icon name="heart" size={16} /> <span>{siguiendo ? 'Siguiendo' : 'Seguir tienda'}</span>
    </button>
  );
}

function Catalogo({ tienda }: { tienda: TiendaPublica }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(TODOS);
  const categorias = useMemo(
    () => [TODOS, ...new Set(tienda.productos.map((p) => p.categoria?.nombre).filter((c): c is string => !!c))],
    [tienda]
  );
  const visibles = tienda.productos.filter(
    (p) =>
      (categoria === TODOS || p.categoria?.nombre === categoria) &&
      sinAcentos(p.nombre).includes(sinAcentos(busqueda.trim()))
  );

  return (
    <section className="catalog-section">
      <div className="market-section-heading">
        <div>
          <span>CATÁLOGO</span>
          <h2>Productos de {tienda.nombre}</h2>
        </div>
      </div>
      {tienda.productos.length === 0 ? (
        <div className="market-empty">
          <i>
            <Icon name="bag" size={28} />
          </i>
          <h2>Todavía no hay productos</h2>
          <p>Esta tienda está preparando su vidriera. Seguila para enterarte cuando publique.</p>
        </div>
      ) : (
        <>
          <div className="catalog-tools">
            <label className="market-filter-search">
              <Icon name="search" size={17} />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar dentro de esta tienda"
                aria-label="Buscar dentro de esta tienda"
              />
            </label>
            <div>
              {categorias.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={categoria === c ? 'active' : undefined}
                  aria-pressed={categoria === c}
                  onClick={() => setCategoria(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {visibles.length > 0 ? (
            <div className="product-grid">
              {visibles.map((p) => (
                <MarketProductCard
                  key={p.id}
                  producto={p}
                  tiendaSlug={tienda.slug}
                  onAbrir={() => router.replace(enlaceProducto(tienda.slug, p.slug), { scroll: false })}
                />
              ))}
            </div>
          ) : (
            <div className="market-empty">
              <i>
                <Icon name="search" size={28} />
              </i>
              <h2>Sin productos coincidentes</h2>
              <p>Probá otra búsqueda o elegí una categoría diferente.</p>
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setCategoria(TODOS);
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function EnlaceTelefono({ telefono, children }: { telefono: TelefonoTienda; children: ReactNode }) {
  const whatsapp = telefono.tipo === 'whatsapp';
  return (
    <a href={enlaceTelefono(telefono)} target={whatsapp ? '_blank' : undefined} rel={whatsapp ? 'noreferrer' : undefined}>
      {children}
    </a>
  );
}

function Informacion({ tienda }: { tienda: TiendaPublica }) {
  const desde = new Date(tienda.desde).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const especialidades = tienda.rubro?.especialidades ?? [];
  return (
    <section className="about-store">
      <div>
        <span>SOBRE NOSOTROS</span>
        <h2>Una tienda con identidad local</h2>
        <p>{tienda.descripcion || `${tienda.nombre} todavía no cargó una descripción.`}</p>
        {especialidades.length > 0 && <p>Qué ofrece: {especialidades.join(', ')}.</p>}
      </div>
      <div>
        <span>INFORMACIÓN</span>
        <p>
          <Icon name="pin" size={16} /> {tienda.direccion}, {tienda.localidad}
        </p>
        {tienda.telefonos.map((t, i) => (
          <p key={i}>
            <Icon name="phone" size={16} /> <EnlaceTelefono telefono={t}>{verTelefono(t)}</EnlaceTelefono>
            <span className={`telefono-tipo ${t.tipo}`}>{TIPOS_TELEFONO[t.tipo]}</span>
          </p>
        ))}
        <p>
          <Icon name="users" size={16} /> {plural(tienda.seguidores, 'seguidor', 'seguidores')}
        </p>
        <p>
          <Icon name="clock" size={16} /> En {BRAND_NAME} desde {desde}
        </p>
      </div>
    </section>
  );
}

function Contacto({ tienda }: { tienda: TiendaPublica }) {
  return (
    <>
      <section className="profile-contact">
        <div>
          <Icon name="pin" size={21} />
          <span>
            <strong>Visitanos</strong>
            {tienda.direccion}, {tienda.localidad}
          </span>
        </div>
        {tienda.telefonos.length > 0 ? (
          tienda.telefonos.map((t, i) => (
            <EnlaceTelefono key={i} telefono={t}>
              <Icon name="phone" size={21} />
              <span>
                <strong>{t.tipo === 'whatsapp' ? 'Escribinos por WhatsApp' : `Llamanos (${TIPOS_TELEFONO[t.tipo].toLowerCase()})`}</strong>
                {verTelefono(t)}
              </span>
            </EnlaceTelefono>
          ))
        ) : (
          <div>
            <Icon name="truck" size={21} />
            <span>
              <strong>Retiro o envío</strong>
              Elegí cómo recibir tu compra al finalizar el pedido.
            </span>
          </div>
        )}
      </section>
      {tienda.ubicacion && (
        <MapaTienda ubicacion={tienda.ubicacion} titulo={`Ubicación de ${tienda.nombre} en el mapa`} className="profile-mapa" />
      )}
    </>
  );
}

/** Perfil de la tienda: copia de la maqueta del diseñador (docs/diseno, #store). */
export default function PublicStorePage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={null}>
      <PerfilTienda slug={params.slug} />
    </Suspense>
  );
}

/** `?producto=` abre la ficha encima del perfil; Atrás o Cerrar la quitan sin recargar la tienda. */
function PerfilTienda({ slug }: { slug: string }) {
  const pathname = usePathname();
  const productoAbierto = useSearchParams().get('producto');
  const { localidad } = useLocation();
  const [tienda, setTienda] = useState<TiendaPublica | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestania, setPestania] = useState<Pestania>('productos');

  useEffect(() => {
    api<TiendaPublica>(`/catalog/tiendas/${encodeURIComponent(slug)}`)
      .then((t) => {
        setTienda(t);
        document.title = `${t.nombre} · ${BRAND_NAME}`;
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [slug]);

  if (error) {
    return (
      <div className="market-container market-page">
        <div className="market-empty">
          <i>
            <Icon name="store" size={28} />
          </i>
          <h2>No encontramos esta tienda</h2>
          <p>{error}. Puede que haya cambiado de dirección o que todavía no esté aprobada.</p>
          <Link href="/tiendas">Ver todas las tiendas</Link>
        </div>
      </div>
    );
  }

  if (!tienda) {
    return (
      <div role="status" aria-label="Cargando tienda">
        <section className="profile-cover" />
        <div className="market-container store-profile">
          <section className="store-profile-header">
            <div className="profile-mark" />
          </section>
        </div>
      </div>
    );
  }

  const visual = visualCategoria(tienda.rubro?.slug);
  const cerca = localidad?.id === tienda.localidad_id;

  return (
    <>
      <section className="profile-cover">
        {tienda.portada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tienda.portada} alt={`Portada de ${tienda.nombre}`} />
        ) : (
          <i className="profile-cover-vacia" aria-hidden="true">
            <Icon name={visual.icono} size={120} strokeWidth={0.9} />
          </i>
        )}
      </section>
      <div className="market-container store-profile">
        <section className="store-profile-header">
          <div className="profile-mark" aria-hidden="true">
            {tienda.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tienda.logo} alt="" />
            ) : (
              iniciales(tienda.nombre)
            )}
          </div>
          <div className="profile-title">
            <span>{tienda.rubro?.nombre ?? 'Comercio local'}</span>
            <h1>{tienda.nombre}</h1>
            <p>
              <Icon name="pin" size={14} /> {tienda.localidad}
              {cerca && ' · En tu zona'}
            </p>
          </div>
          <Seguir
            tienda={tienda}
            onSeguidores={(delta) => setTienda({ ...tienda, seguidores: Math.max(0, tienda.seguidores + delta) })}
          />
        </section>
        <nav className="profile-tabs" aria-label="Secciones de la tienda">
          {PESTANIAS.map(([id, texto]) => (
            <button
              key={id}
              type="button"
              className={pestania === id ? 'active' : undefined}
              aria-current={pestania === id ? 'page' : undefined}
              onClick={() => setPestania(id)}
            >
              {texto}
            </button>
          ))}
        </nav>
        {pestania === 'productos' && <Catalogo tienda={tienda} />}
        {pestania === 'info' && <Informacion tienda={tienda} />}
        {pestania === 'contacto' && <Contacto tienda={tienda} />}
      </div>
      {productoAbierto && (
        <ProductoModal
          tiendaSlug={tienda.slug}
          productoSlug={productoAbierto}
          onCerrar={() => window.history.replaceState(null, '', pathname)}
        />
      )}
    </>
  );
}
