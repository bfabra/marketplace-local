'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { esEquipo } from '@/lib/equipo';
import { panelVendedor } from '@/lib/vendedor';
import { AVATARES_PRESET, avatarVisible, guardarAvatarLocal } from '@/lib/avatar';
import { fullName } from '@/lib/utils';
import { iniciales } from '@/lib/visual';
import { Icon, type IconName } from '@/components/ui/icon';

type Seccion = { href: string; label: string; icono: IconName; activa: (path: string) => boolean };

/** Shell de cuenta al estilo maqueta #profile: hero + sidebar + contenido. */
export function CuentaShell({
  user,
  titulo,
  descripcion,
  children,
}: {
  user: Usuario;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  const { logout } = useAuth();
  const pathname = usePathname();
  const nombre = user.nombre ? fullName(user.nombre, user.apellido) : (user.email ?? 'Mi cuenta');
  const inicialesNombre = iniciales(nombre);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    setAvatar(avatarVisible(user.id, user.avatar_url));
  }, [user.id, user.avatar_url]);

  function elegirAvatar(url: string) {
    guardarAvatarLocal(user.id, url);
    setAvatar(url);
  }

  function subirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo || !archivo.type.startsWith('image/')) return;
    const lector = new FileReader();
    lector.onload = () => {
      if (typeof lector.result === 'string') elegirAvatar(lector.result);
    };
    lector.readAsDataURL(archivo);
    e.target.value = '';
  }

  const secciones: Seccion[] = [
    { href: '/cuenta', label: 'Datos del perfil', icono: 'user', activa: (p) => p === '/cuenta' },
    { href: '/mis-compras', label: 'Mis compras', icono: 'bag', activa: (p) => p === '/mis-compras' || p.startsWith('/mis-compras/') },
    { href: '/mis-envios', label: 'Estado de envíos', icono: 'truck', activa: (p) => p === '/mis-envios' },
    { href: '/mis-tiendas', label: 'Tiendas favoritas', icono: 'store', activa: (p) => p === '/mis-tiendas' },
    { href: '/favoritos', label: 'Productos favoritos', icono: 'heart', activa: (p) => p === '/favoritos' },
  ];

  const foto = (
    <>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" />
      ) : (
        inicialesNombre
      )}
    </>
  );

  return (
    <div className="market-container cuenta-shell">
      <nav className="cuenta-breadcrumb" aria-label="Navegación">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">›</span>
        <span>Mi cuenta</span>
      </nav>

      <header className="cuenta-hero">
        <div className="cuenta-hero-persona">
          <span className="cuenta-hero-avatar" aria-hidden="true">
            {foto}
          </span>
          <div>
            <div className="cuenta-hero-titulo">
              <h1>{nombre}</h1>
              <span>Cliente San Juan</span>
            </div>
            <div className="cuenta-hero-meta">
              {user.email && (
                <span>
                  <Icon name="mail" size={15} /> {user.email}
                </span>
              )}
              {user.telefono && (
                <span>
                  <Icon name="phone" size={15} /> {user.telefono}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="cuenta-hero-salir"
          onClick={() => {
            void logout();
          }}
        >
          Cerrar sesión
        </button>
      </header>

      <div className="cuenta-layout">
        <aside className="cuenta-sidebar">
          <div className="cuenta-sidebar-perfil">
            <div className="cuenta-sidebar-avatar-wrap">
              <span className="cuenta-sidebar-avatar" aria-hidden="true">
                {foto}
              </span>
              <label className="cuenta-avatar-camara" title="Subir foto de perfil">
                <Icon name="camera" size={18} />
                <span className="sr-only">Subir foto de perfil</span>
                <input type="file" accept="image/*" onChange={subirFoto} />
              </label>
            </div>
            <strong>{nombre}</strong>
            {user.email && <p>{user.email}</p>}

            <div className="cuenta-avatares-preset">
              <span>O elegí un avatar vectorial:</span>
              <div>
                {AVATARES_PRESET.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className={avatar === url ? 'is-activo' : undefined}
                    onClick={() => elegirAvatar(url)}
                    title="Seleccionar avatar"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <nav className="cuenta-sidebar-nav" aria-label="Tu cuenta">
            {secciones.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={s.activa(pathname) ? 'is-activa' : undefined}
                aria-current={s.activa(pathname) ? 'page' : undefined}
              >
                <Icon name={s.icono} size={18} />
                {s.label}
              </Link>
            ))}

            {esEquipo(user) && (
              <Link href="/admin">
                <Icon name="shield" size={18} /> Administración
              </Link>
            )}

            {user.tiendas.length > 0 ? (
              <Link href={panelVendedor(user)} className="cuenta-sidebar-comercio">
                <Icon name="store" size={18} /> Panel de vendedor
              </Link>
            ) : (
              <Link href="/vendor/nueva-tienda" className="cuenta-sidebar-comercio">
                <Icon name="store" size={18} /> Convertirme en Comercio
              </Link>
            )}

            <button
              type="button"
              className="cuenta-sidebar-salir"
              onClick={() => {
                void logout();
              }}
            >
              <Icon name="logout" size={18} /> Cerrar sesión
            </button>
          </nav>
        </aside>

        <div className="cuenta-contenido">
          <div className="cuenta-panel">
            <header className="cuenta-panel-cabecera">
              <div>
                <h2>{titulo}</h2>
                {descripcion && <p>{descripcion}</p>}
              </div>
            </header>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
