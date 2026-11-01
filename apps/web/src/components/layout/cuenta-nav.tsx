'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { esEquipo } from '@/lib/equipo';
import { panelVendedor } from '@/lib/vendedor';
import { Icon, type IconName } from '@/components/ui/icon';

/**
 * LEGACY (`pt-nav`) — preferir `CuentaShell` (#profile) para /cuenta, /mis-compras, etc.
 * Solo queda en rutas vendor puntuales; no ampliar su uso.
 * Ver docs/diseno/LEGACY.md.
 */
export function CuentaNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const secciones: { href: string; label: string; icon: IconName; activa: boolean }[] = [
    { href: '/mis-compras', label: 'Mis compras', icon: 'receipt', activa: pathname.startsWith('/mis-compras') },
    { href: '/favoritos', label: 'Favoritos', icon: 'heart', activa: pathname === '/favoritos' },
    { href: '/cuenta', label: 'Mi cuenta', icon: 'user', activa: pathname === '/cuenta' },
    user.tiendas.length > 0
      ? { href: panelVendedor(user), label: 'Panel de vendedor', icon: 'store', activa: false }
      : {
          href: '/vendor/nueva-tienda',
          label: esEquipo(user) ? 'Vender' : 'Abrir mi tienda',
          icon: 'store',
          activa: pathname.startsWith('/vendor'),
        },
  ];

  return (
    <nav className="pt-nav" aria-label="Tu cuenta">
      {secciones.map((s) => (
        <Link key={s.href} href={s.href} className="pt-nav-item" aria-current={s.activa ? 'page' : undefined}>
          <Icon name={s.icon} size={18} />
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
