'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Usuario } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useClickOutside } from '@/hooks/use-click-outside';
import { esEquipo } from '@/lib/equipo';
import { panelVendedor } from '@/lib/vendedor';
import { avatarVisible } from '@/lib/avatar';
import { fullName } from '@/lib/utils';
import { iniciales } from '@/lib/visual';

/** Ítem de menú — maqueta `docs/diseno/js/components/header.js` (solo texto). */
function Opcion({
  href,
  children,
  className,
}: {
  href: string;
  children: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`dropdown-item${className ? ` ${className}` : ''}`}>
      {children}
    </Link>
  );
}

/** Menú desplegable cliente / comercio — solo los ítems de la maqueta #header. */
export function UserMenu({ user }: { user: Usuario }) {
  const { logout } = useAuth();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const id = useId();
  const cerrar = useCallback(() => setAbierto(false), []);
  useClickOutside(contenedor, abierto, cerrar);
  useEffect(cerrar, [pathname, cerrar]);

  const nombre = user.nombre ? fullName(user.nombre, user.apellido) : (user.email ?? 'Mi cuenta');
  const nombreCorto = user.nombre?.trim().split(/\s+/)[0] || 'Mi cuenta';
  const tieneTienda = user.tiendas.length > 0;
  const tienda = user.tiendas[0];
  /** Cabecera: nombre de tienda si hay; el chip del header muestra a la persona. */
  const tituloMenu = tieneTienda ? tienda.nombre : nombre;
  const avatar = avatarVisible(user.id, user.avatar_url);

  return (
    <div ref={contenedor} className="user-dropdown-wrapper">
      <button
        type="button"
        className="btn-user-profile"
        aria-expanded={abierto}
        aria-controls={`${id}-menu`}
        aria-label={`Menú de ${nombre}`}
        onClick={() => setAbierto((a) => !a)}
      >
        <span className={`avatar-circle${avatar ? ' has-photo' : ''}`}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" />
          ) : (
            iniciales(nombre)
          )}
        </span>
        <span className="hide-mobile">{nombreCorto}</span>
      </button>

      {abierto && (
        <div id={`${id}-menu`} className="dropdown-menu-card" role="menu">
          <div className="dropdown-cabecera">
            <strong>{tituloMenu}</strong>
            {user.email && <span>{user.email}</span>}
          </div>

          {esEquipo(user) && (
            <div className="dropdown-grupo">
              <Opcion href="/admin" className="dropdown-item-destacado">
                Panel de administración
              </Opcion>
            </div>
          )}

          {tieneTienda ? (
            <div className="dropdown-grupo">
              <Opcion href={panelVendedor(user)} className="dropdown-item-destacado">
                Perfil Comerciante
              </Opcion>
              <Opcion href={`/vendor/tiendas/${tienda.id}/ventas`}>Mis Ventas</Opcion>
              <Opcion href={`/vendor/tiendas/${tienda.id}/productos`}>Mis Productos</Opcion>
            </div>
          ) : (
            <>
              <div className="dropdown-grupo">
                <Opcion href="/cuenta" className="dropdown-item-destacado">
                  Mi perfil
                </Opcion>
                <Opcion href="/mis-tiendas">Tiendas favoritas</Opcion>
                <Opcion href="/favoritos">Productos guardados</Opcion>
                <Opcion href="/mis-compras">Mis compras</Opcion>
              </div>
              <div className="dropdown-grupo">
                <Link href="/vendor/nueva-tienda" className="dropdown-item highlight-merchant">
                  Convertirme en Comercio
                </Link>
              </div>
            </>
          )}

          <div className="dropdown-grupo">
            <button
              type="button"
              className="dropdown-item danger"
              onClick={() => {
                void logout();
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
