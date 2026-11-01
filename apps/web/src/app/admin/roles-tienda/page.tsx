'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { ApiError, api, type Permiso, type RolPredefinido, type RolesTiendaAdmin } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { numero } from '@/components/admin/controles';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { plural } from '@/lib/visual';

export default function AdminStoreRolesPage() {
  const toast = useToast();
  const [datos, setDatos] = useState<RolesTiendaAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  useEffect(() => {
    api<RolesTiendaAdmin>('/admin/roles-tienda')
      .then(setDatos)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, []);

  async function borrar(rol: RolPredefinido) {
    if (!window.confirm(`¿Borrar el rol "${rol.nombre}"? Las tiendas ya no lo van a poder asignar.`)) return;
    setBorrando(rol.id);
    setError(null);
    try {
      setDatos(await api<RolesTiendaAdmin>(`/admin/roles-tienda/${rol.id}`, { method: 'DELETE' }));
      toast({ titulo: `Se borró el rol ${rol.nombre}` });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBorrando(null);
    }
  }

  function guardado(r: RolesTiendaAdmin, nombre: string, nuevo: boolean) {
    setDatos(r);
    setEditando(null);
    toast({ titulo: nuevo ? `Se creó el rol ${nombre}` : `Se guardó el rol ${nombre}` });
  }

  const areas = [...new Set((datos?.permisos ?? []).map((p) => p.area))];

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Roles de las tiendas"
        descripcion="Los roles que cada comercio puede asignar a las personas que suma a su equipo."
      >
        {datos && editando === null && (
          <button className="btn" onClick={() => setEditando('nuevo')}>
            <Icon name="plus" size={16} /> Nuevo rol
          </button>
        )}
      </EncabezadoAdmin>

      <div className="aviso-banda">
        <Icon name="info" size={18} />
        <span>
          Los comercios no crean roles: eligen uno de esta lista al invitar a alguien. El plan, la suscripción y el
          equipo quedan siempre en manos del dueño. Un rol con personas o invitaciones pendientes no se puede borrar.
        </span>
      </div>

      {error && <Alert>{error}</Alert>}

      {editando === 'nuevo' && datos && (
        <section className="card">
          <FormRol
            permisos={datos.permisos}
            onListo={(r, nombre) => guardado(r, nombre, true)}
            onCancelar={() => setEditando(null)}
          />
        </section>
      )}

      {!datos ? (
        error ? null : <PageSkeleton />
      ) : (
        <ul className="roles-tienda">
          {datos.roles.map((r) => {
            const enUso = r.personas + r.invitaciones > 0;
            return (
              <li key={r.id} className={editando === r.id ? 'card rol-tienda rol-tienda-editando' : 'card rol-tienda'}>
                {editando === r.id ? (
                  <FormRol
                    rol={r}
                    permisos={datos.permisos}
                    onListo={(res, nombre) => guardado(res, nombre, false)}
                    onCancelar={() => setEditando(null)}
                  />
                ) : (
                  <>
                    <div className="tarjeta-cabecera">
                      <span className="icono-suave" aria-hidden="true">
                        <Icon name="shield" size={20} />
                      </span>
                      <div>
                        <h2>{r.nombre}</h2>
                        <p>{plural(r.permisos.length, 'permiso', 'permisos')}</p>
                      </div>
                      <span className={enUso ? 'badge badge-activa' : 'badge badge-archivada'}>
                        {enUso ? 'En uso' : 'Sin usar'}
                      </span>
                    </div>

                    <div className="rol-tienda-areas">
                      {areas.map((area) => {
                        const delArea = datos.permisos.filter((p) => p.area === area && r.permisos.includes(p.codigo));
                        if (!delArea.length) return null;
                        return (
                          <div key={area} className="rol-tienda-area">
                            <span className="rol-tienda-area-titulo">{area}</span>
                            <ul>
                              {delArea.map((p) => (
                                <li key={p.codigo}>
                                  <Icon name="check" size={14} />
                                  {p.descripcion}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>

                    <dl className="rol-tienda-uso">
                      <div>
                        <Icon name="users" size={16} />
                        <dt>{r.personas === 1 ? 'Persona' : 'Personas'}</dt>
                        <dd>{numero(r.personas)}</dd>
                      </div>
                      <div>
                        <Icon name="store" size={16} />
                        <dt>{r.tiendas === 1 ? 'Tienda' : 'Tiendas'}</dt>
                        <dd>{numero(r.tiendas)}</dd>
                      </div>
                      <div>
                        <Icon name="clock" size={16} />
                        <dt>{r.invitaciones === 1 ? 'Invitación' : 'Invitaciones'}</dt>
                        <dd>{numero(r.invitaciones)}</dd>
                      </div>
                    </dl>

                    <div className="actions rol-tienda-acciones">
                      <button
                        className="btn btn-secondary"
                        disabled={editando !== null}
                        onClick={() => setEditando(r.id)}
                      >
                        <Icon name="pencil" size={16} /> Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-link-peligro"
                        disabled={editando !== null || borrando !== null || enUso}
                        title={enUso ? 'Está en uso en alguna tienda' : undefined}
                        onClick={() => borrar(r)}
                      >
                        <Icon name="trash" size={16} /> {borrando === r.id ? 'Borrando…' : 'Borrar'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FormRol({
  rol,
  permisos,
  onListo,
  onCancelar,
}: {
  rol?: RolPredefinido;
  permisos: Permiso[];
  onListo: (r: RolesTiendaAdmin, nombre: string) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [nombre, setNombre] = useState(rol?.nombre ?? '');
  const [elegidos, setElegidos] = useState<string[]>(rol?.permisos ?? []);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const areas = [...new Set(permisos.map((p) => p.area))];

  function alternar(codigo: string, marcado: boolean) {
    setElegidos((actual) => (marcado ? [...actual, codigo] : actual.filter((c) => c !== codigo)));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2) return setError('El nombre tiene que tener al menos 2 caracteres.');
    if (elegidos.length === 0) return setError('Elegí al menos un permiso.');
    setEnviando(true);
    setError(null);
    try {
      const body = { nombre: nombre.trim(), permisos: elegidos };
      const r = rol
        ? await api<RolesTiendaAdmin>(`/admin/roles-tienda/${rol.id}`, { method: 'PUT', body })
        : await api<RolesTiendaAdmin>('/admin/roles-tienda', { method: 'POST', body });
      onListo(r, body.nombre);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="stack plan-form" onSubmit={enviar} noValidate>
      <h2>{rol ? `Editar ${rol.nombre}` : 'Nuevo rol'}</h2>
      <label className="field" htmlFor={`${id}-nombre`}>
        <span>Nombre</span>
        <input id={`${id}-nombre`} maxLength={40} value={nombre} autoFocus onChange={(e) => setNombre(e.target.value)} />
      </label>
      <fieldset className="fieldset-plain stack">
        <legend className="permisos-leyenda">
          Permisos <span className="tab-cuenta">{elegidos.length}</span>
        </legend>
        {areas.map((area) => {
          const delArea = permisos.filter((p) => p.area === area);
          const todos = delArea.every((p) => elegidos.includes(p.codigo));
          return (
            <div key={area} className="permisos-area">
              <div className="permisos-area-cabecera">
                <strong>{area}</strong>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() =>
                    setElegidos((actual) =>
                      todos
                        ? actual.filter((c) => !delArea.some((p) => p.codigo === c))
                        : [...new Set([...actual, ...delArea.map((p) => p.codigo)])]
                    )
                  }
                >
                  {todos ? 'Quitar todos' : 'Elegir todos'}
                </button>
              </div>
              <div className="permisos-opciones">
                {delArea.map((p) => (
                  <label key={p.codigo} className="permiso-opcion">
                    <input
                      type="checkbox"
                      checked={elegidos.includes(p.codigo)}
                      onChange={(e) => alternar(p.codigo, e.target.checked)}
                    />
                    <span>{p.descripcion}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </fieldset>
      {rol && rol.personas > 0 && (
        <div className="aviso-banda aviso-advertencia">
          <Icon name="alert" size={18} />
          <span>
            {numero(rol.personas)} {rol.personas === 1 ? 'persona tiene' : 'personas tienen'} este rol: los cambios se
            aplican al instante en sus tiendas.
          </span>
        </div>
      )}
      {error && <small className="field-error">{error}</small>}
      <div className="actions">
        <button className="btn" disabled={enviando}>
          {enviando ? 'Guardando…' : rol ? 'Guardar cambios' : 'Crear rol'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
