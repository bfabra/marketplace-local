'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api, type RolPlataforma, type UsuarioConRoles } from '@/lib/api-client';
import { iniciales, plural } from '@/lib/visual';
import { useAuth } from '@/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Icon, type IconName } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Field, SelectField } from '@/components/ui/field';
import { useFormErrors } from '@/components/forms/use-form-errors';
import { EncabezadoAdmin } from '@/components/admin/encabezado';

const ROLES: Record<RolPlataforma, { nombre: string; descripcion: string; icono: IconName }> = {
  superadmin: { nombre: 'Superadmin', descripcion: 'Todo, incluido repartir los demás roles', icono: 'shieldAdmin' },
  moderacion: { nombre: 'Moderación', descripcion: 'Aprueba, suspende y revisa tiendas y productos', icono: 'shield' },
  soporte: { nombre: 'Soporte', descripcion: 'Ve cuentas, pedidos y equipos para ayudar a usuarios', icono: 'users' },
  finanzas: { nombre: 'Finanzas', descripcion: 'Pagos, comisiones, reembolsos y suscripciones', icono: 'card' },
  logistica: { nombre: 'Logística', descripcion: 'Envíos, repartidores y tarifas', icono: 'truck' },
};
const TODOS = Object.keys(ROLES) as RolPlataforma[];
const DELEGABLES = TODOS.filter((r) => r !== 'superadmin');
const MAX_AVATARES = 4;

export default function PlatformRolesPage() {
  const { user, loading, refresh } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioConRoles[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const form = useFormErrors();

  const esSuperadmin = !!user?.rolesPlataforma.includes('superadmin');

  useEffect(() => {
    if (!esSuperadmin) return;
    api<UsuarioConRoles[]>('/admin/roles')
      .then(setUsuarios)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [esSuperadmin]);

  async function asignar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const datos = new FormData(el);
    form.clear();
    setAviso(null);
    setOcupado('asignar');
    try {
      const email = String(datos.get('email'));
      setUsuarios(await api<UsuarioConRoles[]>('/admin/roles', { method: 'POST', body: { email, rol: datos.get('rol') } }));
      setAviso(`Rol asignado a ${email}.`);
      el.reset();
    } catch (err) {
      form.set(err);
    } finally {
      setOcupado(null);
    }
  }

  async function quitar(u: UsuarioConRoles, rol: RolPlataforma) {
    if (!window.confirm(`¿Quitarle el rol ${ROLES[rol].nombre} a ${u.nombre ?? u.email}?`)) return;
    setOcupado(`${u.usuario_id}:${rol}`);
    setError(null);
    setAviso(null);
    try {
      setUsuarios(await api<UsuarioConRoles[]>(`/admin/roles/${u.usuario_id}/${rol}`, { method: 'DELETE' }));
      setAviso('Rol quitado.');
      if (u.usuario_id === user?.id) await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setOcupado(null);
    }
  }

  if (loading) return <PageSkeleton />;
  if (!esSuperadmin) return <Alert>Solo el superadmin reparte los roles de la plataforma.</Alert>;

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Roles de plataforma"
        descripcion="Quién del equipo entra al panel y qué secciones ve cada persona."
      />

      {error && <Alert>{error}</Alert>}
      {aviso && <Alert kind="success">{aviso}</Alert>}

      <ul className="roles-plataforma" aria-label="Roles disponibles">
        {TODOS.map((r) => {
          const conRol = (usuarios ?? []).filter((u) => u.roles.includes(r));
          return (
            <li key={r} className={`card rol-plataforma rol-${r}`}>
              <span className="rol-plataforma-icono" aria-hidden="true">
                <Icon name={ROLES[r].icono} size={20} />
              </span>
              <div className="rol-plataforma-texto">
                <h2>{ROLES[r].nombre}</h2>
                <p>{ROLES[r].descripcion}</p>
              </div>
              <div className="rol-plataforma-pie">
                <span className="rol-plataforma-cuenta">
                  {usuarios ? plural(conRol.length, 'persona', 'personas') : '…'}
                </span>
                {conRol.length > 0 && (
                  <span className="avatares" aria-hidden="true">
                    {conRol.slice(0, MAX_AVATARES).map((u) => (
                      <span key={u.usuario_id} className="avatar" title={u.nombre ?? u.email ?? ''}>
                        {iniciales(u.nombre ?? u.email ?? '?')}
                      </span>
                    ))}
                    {conRol.length > MAX_AVATARES && (
                      <span className="avatar avatar-mas">+{conRol.length - MAX_AVATARES}</span>
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form className="card form-plain stack" onSubmit={asignar} noValidate>
        <div className="tarjeta-cabecera">
          <span className="icono-suave" aria-hidden="true">
            <Icon name="plus" size={20} />
          </span>
          <div>
            <h2>Asignar un rol</h2>
            <p>La persona tiene que tener una cuenta creada. Ve el cambio la próxima vez que cargue la web.</p>
          </div>
        </div>
        {form.message && <Alert>{form.message}</Alert>}
        <div className="roles-asignar">
          <Field label="Correo de la cuenta" name="email" type="email" required error={form.fields.email} />
          <SelectField
            label="Rol"
            name="rol"
            placeholder="Elegí un rol"
            options={DELEGABLES.map((r) => ({ value: r, label: ROLES[r].nombre }))}
            error={form.fields.rol}
          />
          <button className="btn" type="submit" disabled={ocupado === 'asignar'}>
            <Icon name="check" size={16} /> {ocupado === 'asignar' ? 'Asignando…' : 'Asignar'}
          </button>
        </div>
      </form>

      <section className="card stack">
        <div className="tarjeta-cabecera">
          <span className="icono-suave" aria-hidden="true">
            <Icon name="users" size={20} />
          </span>
          <div>
            <h2>Personas del equipo</h2>
            <p>{usuarios ? plural(usuarios.length, 'persona con rol', 'personas con rol') : 'Cargando…'}</p>
          </div>
        </div>
        {!usuarios ? (
          <PageSkeleton />
        ) : (
          <ListaScroll as="ul" className="personas-roles" etiqueta="Personas con roles de plataforma">
            {usuarios.map((u) => (
              <li key={u.usuario_id} className="persona-rol">
                <span className="avatar avatar-lg" aria-hidden="true">
                  {iniciales(u.nombre ?? u.email ?? '?')}
                </span>
                <div className="persona-rol-info">
                  <strong>
                    {u.nombre ?? u.email}
                    {u.usuario_id === user?.id && <span className="tag tag-suave">Vos</span>}
                  </strong>
                  <span className="muted">{u.email}</span>
                </div>
                <div className="persona-rol-chips">
                  {u.roles.map((r) => (
                    <span key={r} className={`rol-chip rol-${r}`}>
                      <Icon name={ROLES[r].icono} size={13} />
                      {ROLES[r].nombre}
                      {r !== 'superadmin' && (
                        <button
                          type="button"
                          className="rol-chip-quitar"
                          aria-label={`Quitar ${ROLES[r].nombre} a ${u.nombre ?? u.email}`}
                          title="Quitar rol"
                          disabled={ocupado === `${u.usuario_id}:${r}`}
                          onClick={() => quitar(u, r)}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ListaScroll>
        )}
      </section>
    </div>
  );
}
