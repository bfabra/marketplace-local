'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { useClickOutside } from '@/hooks/use-click-outside';
import { formatPrice } from '@/lib/utils';
import { plural } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { SearchBox } from '@/components/search/search-box';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

const SECCIONES = [
  { href: '/', label: 'Inicio', activa: (p: string) => p === '/' },
  { href: '/tiendas', label: 'Tiendas', activa: (p: string) => p.startsWith('/tiendas') },
  { href: '/rubros', label: 'Rubros', activa: (p: string) => p.startsWith('/rubros') },
];

/** Popover del carrito en el header (docs/diseno). */
function Carrito() {
  const { carrito } = useCart();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  useClickOutside(contenedor, abierto, cerrar);
  useEffect(cerrar, [pathname, cerrar]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, cerrar]);

  const { cantidad, subtotal } = carrito;
  const lineas = carrito.tiendas.flatMap((t) => t.items);
  const vacio = cantidad === 0;

  return (
    <div ref={contenedor} className="cart-menu">
      <button
        type="button"
        className="cart-action"
        aria-label={`Carrito, ${plural(cantidad, 'producto', 'productos')}`}
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <Icon name="cart" size={19} />
        <b aria-hidden={cantidad === 0}>{cantidad > 99 ? '99+' : cantidad}</b>
      </button>
      {abierto && (
        <aside className="mini-cart" role="dialog" aria-label="Tu carrito">
          <div className="mini-cart-cabecera">
            <strong>Tu carrito</strong>
            <button type="button" onClick={cerrar} aria-label="Cerrar carrito">
              <Icon name="x" size={17} />
            </button>
          </div>

          {vacio ? (
            <p className="mini-cart-vacio">Tu carrito está vacío.</p>
          ) : (
            <>
              <ul className="mini-cart-lista">
                {lineas.slice(0, 6).map((item) => (
                  <li key={item.variante_id}>
                    {item.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imagen} alt="" />
                    ) : (
                      <span className="mini-cart-sin-foto" aria-hidden="true">
                        <Icon name="package" size={16} />
                      </span>
                    )}
                    <div>
                      <strong>{item.nombre}</strong>
                      <span>
                        {item.cantidad}× {formatPrice(item.precio)}
                      </span>
                    </div>
                    <em>{formatPrice(item.precio * item.cantidad)}</em>
                  </li>
                ))}
              </ul>
              {lineas.length > 6 && <p className="mini-cart-mas">y {lineas.length - 6} más…</p>}
              <div className="mini-cart-subtotal">
                <span>Subtotal productos:</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div className="mini-cart-acciones">
                <Link href="/carrito" className="mini-cart-ir" onClick={cerrar}>
                  Ver carrito completo y pagar
                </Link>
                <button type="button" className="mini-cart-seguir" onClick={cerrar}>
                  Seguir explorando
                </button>
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
}

/** Cabecera del marketplace (docs/diseno). */
export function Header() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cabecera = useRef<HTMLElement>(null);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);
  useClickOutside(cabecera, menuAbierto, cerrarMenu);
  useEffect(cerrarMenu, [pathname, cerrarMenu]);

  return (
    <header ref={cabecera} className="market-header">
      <div className="header-inner">
        <Logo />

        <button
          type="button"
          className="market-menu"
          aria-label={menuAbierto ? 'Cerrar navegación' : 'Abrir navegación'}
          aria-expanded={menuAbierto}
          aria-controls="market-nav"
          onClick={() => setMenuAbierto((a) => !a)}
        >
          <Icon name={menuAbierto ? 'x' : 'menu'} size={20} />
        </button>

        <nav id="market-nav" className={menuAbierto ? 'open' : undefined} aria-label="Principal">
          {SECCIONES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={s.activa(pathname) ? 'active' : undefined}
              aria-current={s.activa(pathname) ? 'page' : undefined}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <Suspense fallback={<div className="search market-header-search" />}>
          <SearchBox className="market-header-search" />
        </Suspense>

        <div className="market-actions">
          {loading ? (
            <span className="avatar-circle avatar-cargando" aria-hidden="true" />
          ) : user ? (
            <UserMenu user={user} />
          ) : (
            <Link href="/login" className="market-cuenta">
              <Icon name="user" size={18} />
              <span>Mi cuenta</span>
            </Link>
          )}
          <Carrito />
        </div>
      </div>
    </header>
  );
}
