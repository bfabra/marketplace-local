'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RolPlataforma } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { fullName } from '@/lib/utils';
import { iniciales } from '@/lib/visual';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { LogoMark } from '@/components/layout/logo';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { puedeVer, seccionDe } from '@/components/layout/admin-sections';

const NOMBRE_ROL: Record<RolPlataforma, string> = {
  superadmin: 'Superadmin',
  moderacion: 'Moderación',
  soporte: 'Soporte',
  finanzas: 'Finanzas',
  logistica: 'Logística',
};

/** Pantalla sin menú para cuando no hay sesión o la cuenta no es del equipo. */
function SinAcceso({ children }: { children: React.ReactNode }) {
  return (
    <main id="contenido" className="admin-sin-acceso">
      <Link href="/" className="admin-marca admin-marca-oscura">
        <LogoMark size={34} />
        <span>
          <strong>Tu Comercio Local</strong>
          <small>Administración</small>
        </span>
      </Link>
      {children}
    </main>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const path = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => setMenuAbierto(false), [path]);

  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [menuAbierto]);

  if (loading) {
    return (
      <SinAcceso>
        <PageSkeleton />
      </SinAcceso>
    );
  }
  if (!user) {
    return (
      <SinAcceso>
        <Alert kind="info">
          Tu sesión terminó. <Link href={`/login?next=${encodeURIComponent(path)}`}>Ingresá de nuevo</Link> para ver el
          panel.
        </Alert>
      </SinAcceso>
    );
  }
  const roles = user.rolesPlataforma;
  if (!roles.length) {
    return (
      <SinAcceso>
        <Alert>
          Esta sección es solo para el equipo de administración de la plataforma. <Link href="/">Volver al sitio</Link>
        </Alert>
      </SinAcceso>
    );
  }

  const seccion = seccionDe(path);
  const permitido = !seccion || puedeVer(seccion, roles);
  const nombre = user.nombre ? fullName(user.nombre, user.apellido) : (user.email ?? 'Mi cuenta');

  function salir() {
    void logout();
  }

  return (
    <div className="admin-app">
      <AdminSidebar roles={roles} id="admin-menu" abierta={menuAbierto} />
      {menuAbierto && <div className="admin-velo" aria-hidden="true" onClick={() => setMenuAbierto(false)} />}

      <div className="admin-principal">
        <header className="admin-barra">
          <button
            type="button"
            className="icon-btn admin-menu-boton"
            aria-label={menuAbierto ? 'Cerrar el menú' : 'Abrir el menú'}
            aria-expanded={menuAbierto}
            aria-controls="admin-menu"
            onClick={() => setMenuAbierto((a) => !a)}
          >
            <Icon name={menuAbierto ? 'x' : 'menu'} size={22} />
          </button>
          <span className="admin-barra-titulo">{seccion?.label ?? 'Administración'}</span>

          <div className="admin-usuario">
            <span className="avatar">{iniciales(nombre)}</span>
            <span className="admin-usuario-texto">
              <strong>{nombre}</strong>
              <small>{roles.map((r) => NOMBRE_ROL[r]).join(' · ')}</small>
            </span>
          </div>
          <button type="button" className="btn btn-ghost admin-salir" onClick={salir}>
            <Icon name="logout" size={18} />
            <span>Salir</span>
          </button>
        </header>

        <main id="contenido" className="admin-contenido">
          {permitido ? children : <Alert>Tu rol no tiene acceso a esta sección.</Alert>}
        </main>
      </div>
    </div>
  );
}
