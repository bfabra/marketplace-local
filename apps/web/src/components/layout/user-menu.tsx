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
import { Icon, type IconName } from '@/components/ui/icon';

function Opcion({
  href,
  icono,
  children,
  className,
}: {
  href: string;
  icono: IconName;
  children: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`dropdown-item${className ? ` ${className}` : ''}`}>
      <Icon name={icono} size={16} />
      {children}
    </Link>
  );
}

/** Menú desplegable cliente / comercio, al estilo de la maqueta (docs/diseno). */
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
  const nombreCorto = (user.nombre?.trim().split(/\s+/)[0] || 'Mi cuenta');
  const tieneTienda = user.tiendas.length > 0;
  const tienda = user.tiendas[0];
  /** Cabecera del menú: tienda si hay; el chip del header siempre muestra a la persona (maqueta #header). */
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
        <Icon name="grid-dots" size={18} strokeWidth={2.2} className="btn-user-caret" />
      </button>

      {abierto && (
        <div id={`${id}-menu`} className="dropdown-menu-card" role="menu">
          <div className="dropdown-cabecera">
            <strong>{tituloMenu}</strong>
            {user.email && <span>{user.email}</span>}
          </div>

          {esEquipo(user) && (
            <div className="dropdown-grupo">
              <Opcion href="/admin" icono="shield" className="dropdown-item-destacado">
                Panel de administración
              </Opcion>
            </div>
          )}

          {tieneTienda ? (
            <div className="dropdown-grupo">
              <Opcion href={panelVendedor(user)} icono="store" className="dropdown-item-destacado">
                Perfil Comerciante
              </Opcion>
              <Opcion href={`/vendor/tiendas/${tienda.id}/pedidos`} icono="bag">
                Pedidos vigentes
              </Opcion>
              <Opcion href={`/vendor/tiendas/${tienda.id}/ventas`} icono="chart">
                Mis ventas y métricas
              </Opcion>
              <Opcion href={`/vendor/tiendas/${tienda.id}/productos`} icono="package">
                Mis productos
              </Opcion>
              <Opcion href={`/vendor/tiendas/${tienda.id}/equipo`} icono="users">
                Roles y empleados
              </Opcion>
              <Opcion href={`/vendor/tiendas/${tienda.id}/seguridad`} icono="lock">
                Seguridad y cuenta
              </Opcion>
            </div>
          ) : (
            <>
              <div className="dropdown-grupo">
                <Opcion href="/cuenta" icono="user" className="dropdown-item-destacado">
                  Mi perfil
                </Opcion>
                <Opcion href="/mis-tiendas" icono="store">
                  Tiendas favoritas
                </Opcion>
                <Opcion href="/favoritos" icono="heart">
                  Productos guardados
                </Opcion>
                <Opcion href="/mis-compras" icono="bag">
                  Mis compras
                </Opcion>
                <Opcion href="/mis-envios" icono="box">
                  Mis pedidos
                </Opcion>
                <Opcion href="/preguntas" icono="message">
                  Preguntas
                </Opcion>
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
              <Icon name="logout" size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
