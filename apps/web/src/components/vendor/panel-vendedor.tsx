'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, type Tienda, type Venta } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { iniciales } from '@/lib/visual';
import { recordarTienda } from '@/lib/vendedor';
import { Alert } from '@/components/ui/alert';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { BRAND_NAME, LogoMark } from '@/components/layout/logo';

interface PanelTienda {
  tienda: Tienda | null;
  recargar: () => void;
  recontarPedidos: () => void;
}

const Contexto = createContext<PanelTienda>({ tienda: null, recargar: () => {}, recontarPedidos: () => {} });
export const usePanelTienda = () => useContext(Contexto);

interface Seccion {
  href: string;
  label: string;
  icon: IconName;
  contador?: number;
}

const tiendaDeRuta = (path: string) => path.match(/^\/vendor\/tiendas\/([^/]+)/)?.[1] ?? null;

const ESTADO_HERO: Record<string, string> = {
  pendiente: 'En revisión',
  activa: 'Tienda Activa',
  suspendida: 'Suspendida',
  vencida: 'Vencida',
  archivada: 'Archivada',
};

/** Las 6 pestañas de #merchant-panel (siempre visibles, como en la maqueta). */
function seccionesDe(id: string, porPreparar = 0): Seccion[] {
  const base = `/vendor/tiendas/${id}`;
  return [
    { href: base, label: 'Perfil Comerciante', icon: 'store' },
    { href: `${base}/pedidos`, label: 'Pedidos Vigentes', icon: 'bag', contador: porPreparar },
    { href: `${base}/ventas`, label: 'Mis Ventas y Métricas', icon: 'chart' },
    { href: `${base}/productos`, label: 'Mis Productos', icon: 'package' },
    { href: `${base}/equipo`, label: 'Roles y Empleados', icon: 'users' },
    { href: `${base}/seguridad`, label: 'Seguridad y Cuenta', icon: 'lock' },
  ];
}

function seccionActiva(path: string, s: Seccion) {
  if (path === s.href) return true;
  // Perfil es la raíz /vendor/tiendas/:id — no marcar activa en otras pestañas.
  if (/^\/vendor\/tiendas\/[^/]+$/.test(s.href)) return false;
  // Subrutas (productos/nuevo, productos/:id, …).
  return path.startsWith(`${s.href}/`);
}

function telefonoPrincipal(tienda: Tienda) {
  const t = tienda.telefonos[0];
  if (!t) return null;
  const prefijo = t.tipo === 'fijo' ? '+54' : '+54 9';
  return `${prefijo} ${t.numero}`;
}

function Enlace({ s, activa }: { s: Seccion; activa: boolean }) {
  // Maqueta #merchant-panel: ítems solo texto (sin iconos), badge rojo en Pedidos.
  return (
    <Link href={s.href} className={activa ? 'is-activa' : undefined} aria-current={activa ? 'page' : undefined}>
      <span>{s.label}</span>
      {!!s.contador && <em>{s.contador > 99 ? '99+' : s.contador}</em>}
    </Link>
  );
}

function HeroTienda({
  tienda,
  tiendas,
  onCambiar,
}: {
  tienda: Tienda;
  tiendas: { id: string; nombre: string }[];
  onCambiar: (id: string) => void;
}) {
  const telefono = telefonoPrincipal(tienda);
  return (
    <header className="mp-hero">
      <div className="mp-hero-arriba">
        <div className="mp-hero-info">
          <span className="mp-hero-logo" aria-hidden="true">
            {tienda.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tienda.logo} alt="" />
            ) : (
              iniciales(tienda.nombre)
            )}
          </span>
          <div>
            <div className="mp-hero-titulo">
              <h1>{tienda.nombre}</h1>
              <span className={`mp-hero-estado mp-hero-estado-${tienda.estado}`}>
                {ESTADO_HERO[tienda.estado] ?? tienda.estado}
              </span>
            </div>
            <div className="mp-hero-meta">
              {tienda.rubro && (
                <span>
                  <Icon name="store" size={14} /> {tienda.rubro.nombre}
                  {tienda.subrubro ? ` · ${tienda.subrubro.nombre}` : ''}
                </span>
              )}
              <span>
                <Icon name="pin" size={14} /> {tienda.direccion}, {tienda.localidad.nombre}
              </span>
              {telefono && (
                <span>
                  <Icon name="phone" size={14} /> {telefono}
                </span>
              )}
            </div>
          </div>
        </div>
        {tienda.estado === 'activa' && (
          <Link href={`/tiendas/${tienda.slug}`} className="mp-hero-publica">
            Ver mi tienda pública ›
          </Link>
        )}
      </div>

      {tiendas.length > 0 && (
        <label className="mp-hero-gestionar">
          <span>Gestionar:</span>
          <select
            value={tienda.id}
            onChange={(e) => onCambiar(e.target.value)}
            aria-label="Elegir tienda a administrar"
            disabled={tiendas.length === 1}
          >
            {tiendas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
    </header>
  );
}

function SinSesion({ children }: { children: ReactNode }) {
  return (
    <div className="mp-sin-sesion">
      <Link href="/" className="mp-marca">
        <LogoMark size={34} />
        <span>
          <strong>{BRAND_NAME}</strong>
          <small>Panel de comerciante</small>
        </span>
      </Link>
      {children}
    </div>
  );
}

/**
 * Panel #merchant-panel: hero + 6 pestañas fijas (perfil, pedidos, ventas, productos, roles, seguridad).
 */
export function PanelVendedor({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const idTienda = tiendaDeRuta(path);

  const recargar = useCallback(() => {
    if (!idTienda) return;
    api<Tienda>(`/stores/${idTienda}`)
      .then(setTienda)
      .catch(() => setTienda(null));
  }, [idTienda]);

  useEffect(() => {
    setTienda(null);
    if (!idTienda) return;
    recordarTienda(idTienda);
    recargar();
  }, [idTienda, recargar]);

  const [porPreparar, setPorPreparar] = useState<{ tienda: string; cantidad: number } | null>(null);

  const recontarPedidos = useCallback(() => {
    if (!idTienda) return;
    const vigentes = new Set([
      'pago_confirmado',
      'en_preparacion',
      'listo_para_recoleccion',
      'listo_para_retiro',
      'recolectado',
      'en_camino',
    ]);
    api<Venta[]>(`/stores/${idTienda}/orders`)
      .then((ventas) =>
        setPorPreparar({ tienda: idTienda, cantidad: ventas.filter((v) => vigentes.has(v.estado)).length })
      )
      .catch(() => setPorPreparar(null));
  }, [idTienda]);

  useEffect(() => {
    recontarPedidos();
  }, [recontarPedidos, path]);

  if (loading) {
    return (
      <SinSesion>
        <PageSkeleton />
      </SinSesion>
    );
  }
  if (!user) {
    return (
      <SinSesion>
        <Alert kind="info">
          Tu sesión terminó. <Link href={`/login?next=${encodeURIComponent(path)}`}>Ingresá de nuevo</Link> para
          administrar tu tienda.
        </Alert>
      </SinSesion>
    );
  }

  const tiendaAbierta = tienda?.id === idTienda ? tienda : null;
  const pendientes = porPreparar?.tienda === idTienda ? porPreparar.cantidad : 0;
  const nav = idTienda ? seccionesDe(idTienda, pendientes) : null;

  return (
    <Contexto.Provider value={{ tienda: tiendaAbierta, recargar, recontarPedidos }}>
      <div className="mp-container">
        {tiendaAbierta && (
          <HeroTienda
            tienda={tiendaAbierta}
            tiendas={user.tiendas}
            onCambiar={(id) => router.push(`/vendor/tiendas/${id}`)}
          />
        )}

        <div className="mp-layout">
          <aside className="mp-sidebar">
            <nav className="mp-nav" aria-label="Panel de comerciante">
              {idTienda && nav ? (
                nav.map((s) => <Enlace key={s.href} s={s} activa={seccionActiva(path, s)} />)
              ) : (
                <>
                  <Enlace s={{ href: '/vendor', label: 'Mis tiendas', icon: 'store' }} activa={path === '/vendor'} />
                  {user.tiendas.map((t) => (
                    <Link key={t.id} href={`/vendor/tiendas/${t.id}`}>
                      <span className="mp-nav-inicial">{iniciales(t.nombre)}</span>
                      <span>{t.nombre}</span>
                    </Link>
                  ))}
                  <Enlace
                    s={{ href: '/vendor/nueva-tienda', label: 'Crear otra tienda', icon: 'plus' }}
                    activa={path === '/vendor/nueva-tienda'}
                  />
                  <Enlace s={{ href: '/cuenta', label: 'Seguridad y Cuenta', icon: 'lock' }} activa={path === '/cuenta'} />
                </>
              )}
            </nav>
          </aside>

          <div className="mp-main">{children}</div>
        </div>
      </div>
    </Contexto.Provider>
  );
}
