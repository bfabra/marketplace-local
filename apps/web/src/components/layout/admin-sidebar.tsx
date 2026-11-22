'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, type RolPlataforma, type TableroAdmin } from '@/lib/api-client';
import { Icon } from '@/components/ui/icon';
import { BRAND_NAME, LogoMark } from './logo';
import { GRUPOS_ADMIN, puedeVer, seccionDe } from './admin-sections';

function badgeDe(href: string, t: TableroAdmin | null): number {
  if (!t) return 0;
  if (href === '/admin/tiendas') return Number(t.tiendas?.pendiente ?? 0);
  if (href === '/admin/productos') return Number(t.productos?.enRevision ?? 0);
  if (href === '/admin/pedidos') return Number(t.reembolsosPendientes ?? 0);
  if (href === '/admin/suscripciones')
    return Number(t.suscripciones?.en_gracia ?? 0) + Number(t.suscripciones?.porVencer ?? 0);
  return 0;
}

export function AdminSidebar({ roles, id, abierta }: { roles: RolPlataforma[]; id: string; abierta: boolean }) {
  const path = usePathname();
  const actual = seccionDe(path);
  const [tablero, setTablero] = useState<TableroAdmin | null>(null);

  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      api<TableroAdmin>('/admin/tablero')
        .then((t) => vivo && setTablero(t))
        .catch(() => undefined);
    };
    cargar();
    const onFocus = () => cargar();
    window.addEventListener('focus', onFocus);
    return () => {
      vivo = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [path]);

  return (
    <aside id={id} className="admin-aside" data-abierta={abierta}>
      <Link href="/admin" className="admin-marca" aria-label={`${BRAND_NAME}, administración`}>
        <LogoMark size={34} />
        <span>
          <strong>{BRAND_NAME}</strong>
          <small>Administración</small>
        </span>
      </Link>

      <nav className="admin-nav" aria-label="Administración">
        {GRUPOS_ADMIN.map((grupo) => {
          const visibles = grupo.secciones.filter((s) => puedeVer(s, roles));
          if (!visibles.length) return null;
          return (
            <div key={grupo.titulo} className="admin-nav-grupo">
              <span className="admin-nav-titulo">{grupo.titulo}</span>
              <ul>
                {visibles.map((s) => {
                  const badge = badgeDe(s.href, tablero);
                  return (
                    <li key={s.href}>
                      {s.lista ? (
                        <Link
                          href={s.href === '/admin/tiendas' && badge > 0 ? `${s.href}?estado=pendiente` : s.href}
                          className="admin-nav-link"
                          aria-current={actual?.href === s.href ? 'page' : undefined}
                        >
                          <span className="admin-nav-icono">
                            <Icon name={s.icon} size={17} />
                          </span>
                          <span>{s.label}</span>
                          {badge > 0 && (
                            <span className="admin-nav-badge" aria-label={`${badge} pendientes`}>
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="admin-nav-link admin-nav-pronto" aria-disabled="true">
                          <span className="admin-nav-icono">
                            <Icon name={s.icon} size={17} />
                          </span>
                          <span>{s.label}</span>
                          <small>Pronto</small>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <a href="/" target="_blank" rel="noopener" className="admin-nav-link admin-ver-sitio">
        <span className="admin-nav-icono">
          <Icon name="external" size={17} />
        </span>
        <span>Ver el sitio</span>
      </a>
    </aside>
  );
}
