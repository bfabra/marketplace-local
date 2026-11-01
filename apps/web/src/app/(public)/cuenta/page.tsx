'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RolPlataforma } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StoreStatus } from '@/components/ui/store-status';
import { CuentaShell } from '@/components/layout/cuenta-shell';
import { ProfileForm } from '@/components/forms/profile-form';
import { iniciales } from '@/lib/visual';

const NOMBRE_ROL: Record<RolPlataforma, string> = {
  superadmin: 'Superadmin',
  moderacion: 'Moderación',
  soporte: 'Soporte',
  finanzas: 'Finanzas',
  logistica: 'Logística',
};

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/cuenta');
  }, [loading, user, router]);

  if (loading || !user) return <PageSkeleton />;

  return (
    <CuentaShell
      user={user}
      titulo="Datos personales y domicilio de envío"
      descripcion="Información de contacto y domicilio para el repartidor en San Juan."
    >
      <div className="cuenta-datos">
        <ProfileForm user={user} />

        <section className="cuenta-bloque">
          <div className="cuenta-bloque-cabecera">
            <h3>Seguridad de la cuenta</h3>
            {user.tiendas[0] ? (
              <Link href={`/vendor/tiendas/${user.tiendas[0].id}/seguridad`}>Cambiar contraseña →</Link>
            ) : (
              <Link href="/cuenta#clave">Ver opciones →</Link>
            )}
          </div>
          <p className="muted">
            {user.tieneClave
              ? 'Podés actualizar tu contraseña con doble autenticación desde el panel de seguridad.'
              : 'Entrás con Google. Podés crear una contraseña para ingresar también con correo.'}
          </p>
        </section>

        {user.tiendas.length > 0 && (
          <section className="cuenta-bloque">
            <h3>Mis tiendas</h3>
            <ul className="cuenta-tiendas">
              {user.tiendas.map((t) => (
                <li key={t.id}>
                  <Link href={`/vendor/tiendas/${t.id}`} className="cuenta-tienda">
                    <span className="cuenta-tienda-inicial" aria-hidden="true">
                      {iniciales(t.nombre)}
                    </span>
                    <span className="cuenta-tienda-texto">
                      <strong>{t.nombre}</strong>
                      <span className="muted">{t.rol === 'propietario' ? 'Sos el dueño' : `Rol: ${t.rol}`}</span>
                    </span>
                    <StoreStatus estado={t.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {user.rolesPlataforma.length > 0 && (
          <section className="cuenta-bloque">
            <h3>Equipo de la plataforma</h3>
            <p className="muted">{user.rolesPlataforma.map((r) => NOMBRE_ROL[r]).join(' · ')}</p>
            <Link href="/admin" className="btn btn-secondary">
              <Icon name="shield" size={16} /> Ir al panel de administración
            </Link>
          </section>
        )}
      </div>
    </CuentaShell>
  );
}
