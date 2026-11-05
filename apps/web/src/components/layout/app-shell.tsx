'use client';

import { usePathname } from 'next/navigation';

// Pantallas que ya siguen la maqueta del diseñador: arman sus propios contenedores.
// El panel comerciante (#merchant-panel) también usa layout market (cabecera + pie).
const CON_DISENIO = [
  '/',
  '/rubros',
  '/tiendas',
  '/buscar',
  '/carrito',
  '/preguntas',
  '/acerca',
  '/ayuda',
  '/terminos',
  '/privacidad',
  '/cuenta',
  '/favoritos',
];
const conDisenio = (path: string) =>
  CON_DISENIO.includes(path) ||
  /^\/tiendas\/[^/]+$/.test(path) ||
  path === '/vendor' ||
  path.startsWith('/vendor/tiendas/') ||
  path.startsWith('/mis-compras') ||
  path === '/mis-envios' ||
  path === '/mis-tiendas';

// En la maqueta, ingresar, registrarse y el alta de comercio son pantallas completas, sin cabecera ni pie.
const PANTALLA_COMPLETA = ['/login', '/registro', '/recuperar', '/restablecer', '/vendor/nueva-tienda'];

/**
 * Admin arma su propio esqueleto. El panel de vendedor sigue #merchant-panel:
 * misma cabecera/pie del marketplace.
 */
export function AppShell({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (path === '/admin' || path.startsWith('/admin/') || PANTALLA_COMPLETA.includes(path)) return <>{children}</>;

  return (
    <div className="marketplace-shell">
      {header}
      <main id="contenido" className={conDisenio(path) ? 'market-main' : 'container main'}>
        {children}
      </main>
      {footer}
    </div>
  );
}
