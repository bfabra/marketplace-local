'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type Equipo, type InvitacionCreada, type Tienda } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { iniciales } from '@/lib/visual';
import { equipoEjemploDeTienda } from '@/lib/equipo';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { BarraUso, EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { useFormErrors } from '@/components/forms/use-form-errors';

export default function TeamPage({ params }: { params: { id: string } }) {
  const base = `/stores/${params.id}/team`;
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [esEjemplo, setEsEjemplo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [invitacion, setInvitacion] = useState<InvitacionCreada | null>(null);
  const [copiado, setCopiado] = useState(false);
  const invitar = useFormErrors();

  useEffect(() => {
    setError(null);
    api<Tienda>(`/stores/${params.id}`)
      .then(async (t) => {
        setTienda(t);
        try {
          setEquipo(await api<Equipo>(base));
          setEsEjemplo(false);
        } catch {
          // Solo el dueño puede ver el equipo real; si no, usamos el ejemplo de la plantilla.
          setEquipo(equipoEjemploDeTienda());
          setEsEjemplo(true);
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id, base]);

  const ejecutar = useCallback(
    async (clave: string, accion: () => Promise<Equipo>, hecho: string) => {
      setOcupado(clave);
      setError(null);
      setAviso(null);
      try {
        if (esEjemplo) {
          setAviso(hecho);
          return true;
        }
        setEquipo(await accion());
        setAviso(hecho);
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Error inesperado');
        return false;
      } finally {
        setOcupado(null);
      }
    },
    [esEjemplo]
  );

  async function onInvitar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    invitar.clear();
    setInvitacion(null);
    setCopiado(false);
    setOcupado('invitar');
    try {
      if (esEjemplo) {
        const email = String(datos.get('email'));
        const rolId = String(datos.get('rol_id'));
        const rol = equipo?.roles.find((r) => r.id === rolId);
        setEquipo((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            invitaciones: [
              {
                id: `ejemplo-inv-${Date.now()}`,
                email,
                rol: rol?.nombre ?? 'Colaborador',
                expira_en: new Date(Date.now() + 7 * 86400000).toISOString(),
                vencida: false,
              },
              ...prev.invitaciones,
            ],
          };
        });
        setInvitacion({ email, enlace: `https://ejemplo.local/invitacion/${params.id}` });
        form.reset();
        setAviso('Invitación de ejemplo creada (solo en pantalla).');
        return;
      }
      const creada = await api<InvitacionCreada>(`${base}/invitaciones`, {
        method: 'POST',
        body: { email: String(datos.get('email')), rol_id: String(datos.get('rol_id')) },
      });
      setInvitacion(creada);
      form.reset();
      setEquipo(await api<Equipo>(base));
    } catch (err) {
      invitar.set(err);
    } finally {
      setOcupado(null);
    }
  }

  function revocarEjemplo(miembroId: string) {
    setEquipo((prev) => {
      if (!prev) return prev;
      const miembros = prev.miembros.filter((m) => m.id !== miembroId);
      return { ...prev, miembros, activos: miembros.filter((m) => m.estado === 'activo').length };
    });
    setAviso('Colaborador revocado (ejemplo en pantalla).');
  }

  if (error && !tienda) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={`/vendor/tiendas/${params.id}`}>Volver al panel</Link>
      </div>
    );
  }
  if (!tienda || !equipo) return <PageSkeleton />;

  const { plan } = equipo;
  const sinEmpleados = plan.max_empleados === 0;
  const opcionesRol = equipo.roles.map((r) => ({ value: r.id, label: r.nombre }));
  const descripcion = Object.fromEntries(equipo.permisos.map((p) => [p.codigo, p.descripcion]));
  const nombrePlan = plan.nombre ? (/^plan\b/i.test(plan.nombre) ? plan.nombre : `Plan ${plan.nombre}`) : null;

  return (
    <section className="mp-panel">
      <EncabezadoPanel
        tienda={tienda}
        titulo={`Roles y Empleados — ${tienda.nombre}`}
        icono="users"
        descripcion="Invitá colaboradores por correo y asigná múltiples roles de gestión."
      >
        <Link href={`/vendor/tiendas/${params.id}/plan`} className="mp-btn-secundario">
          <Icon name="sparkles" size={14} /> Cambiar plan
        </Link>
      </EncabezadoPanel>

      {esEjemplo && (
        <div className="mp-demo" role="status">
          <Icon name="info" size={18} />
          <div>
            <strong>Equipo de ejemplo</strong>
            <p>
              Así se ve Roles y Empleados en la plantilla. Solo el dueño administra el equipo real; acá podés
              probar la pantalla.
            </p>
          </div>
        </div>
      )}

      {!sinEmpleados && (
        <div className="mp-uso-plan">
          <div>
            <p className="mp-uso-texto">
              <strong>{equipo.activos}</strong> de {plan.max_empleados ?? 'ilimitados'} empleados activos
              {nombrePlan ? ` · ${nombrePlan}` : ''}
            </p>
            <BarraUso usado={equipo.activos} maximo={plan.max_empleados} label="Empleados usados del plan" />
          </div>
        </div>
      )}

      {error && <Alert>{error}</Alert>}
      {aviso && <Alert kind="success">{aviso}</Alert>}

      <section className="mp-bloque mp-invitar">
        <h3>Invitar Nuevo Colaborador</h3>
        {sinEmpleados ? (
          <Alert kind="info">
            El plan {plan.nombre} no incluye empleados. <Link href={`/vendor/tiendas/${params.id}/plan`}>Cambiá de plan</Link>{' '}
            para sumar a tu equipo.
          </Alert>
        ) : (
          <form className="mp-invitar-form" onSubmit={onInvitar} noValidate>
            {invitar.message && <Alert>{invitar.message}</Alert>}
            <div className="mp-invitar-fila">
              <input
                type="email"
                name="email"
                required
                placeholder="correo@ejemplo.com"
                aria-label="Correo electrónico"
                aria-invalid={!!invitar.fields.email}
              />
              <button className="mp-btn-editar" type="submit" disabled={ocupado === 'invitar'}>
                {ocupado === 'invitar' ? 'Invitando…' : 'Enviar Invitación'}
              </button>
            </div>
            {invitar.fields.email && (
              <small className="mp-invitar-error" role="alert">
                {invitar.fields.email}
              </small>
            )}
            <div className="mp-invitar-roles" role="group" aria-label="Rol a asignar">
              {opcionesRol.map((r, i) => (
                <label key={r.value}>
                  <input type="radio" name="rol_id" value={r.value} required defaultChecked={i === 0} />
                  {r.label}
                </label>
              ))}
            </div>
            {invitar.fields.rol_id && (
              <small className="mp-invitar-error" role="alert">
                {invitar.fields.rol_id}
              </small>
            )}
          </form>
        )}
        {invitacion && (
          <Alert kind="success">
            <p>
              Invitación creada para <strong>{invitacion.email}</strong>
              {esEjemplo ? ' (ejemplo).' : '. Mientras no esté conectado el envío de correos, compartile este enlace:'}
            </p>
            {!esEjemplo && (
              <>
                <p className="mono texto-largo">{invitacion.enlace}</p>
                <button
                  className="mp-btn-secundario"
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(invitacion.enlace);
                    setCopiado(true);
                  }}
                >
                  {copiado ? 'Copiado' : 'Copiar enlace'}
                </button>
              </>
            )}
          </Alert>
        )}
      </section>

      <section className="mp-bloque">
        <h3>Equipo Autorizado</h3>
        {equipo.miembros.length === 0 ? (
          <p className="mp-vacio">Todavía no sumaste a nadie. Vos, como dueño, ya tenés todos los permisos.</p>
        ) : (
          <ListaScroll as="ul" className="mp-equipo-lista" etiqueta="Personas del equipo">
            {equipo.miembros.map((m) => (
              <li key={m.id} className="mp-equipo-item">
                <span className="mp-equipo-avatar" aria-hidden>
                  {iniciales(m.nombre ?? m.email ?? '?')}
                </span>
                <div className="mp-equipo-info">
                  <strong>{m.email ?? m.nombre}</strong>
                  <span>Roles: {m.rol.nombre}</span>
                </div>
                <div className="mp-equipo-acciones">
                  {!esEjemplo && (
                    <select
                      value={m.rol.id}
                      disabled={ocupado === m.id}
                      aria-label={`Rol de ${m.nombre ?? m.email}`}
                      onChange={(e) =>
                        ejecutar(
                          m.id,
                          () => api<Equipo>(`${base}/miembros/${m.id}`, { method: 'PATCH', body: { rol_id: e.target.value } }),
                          `Rol actualizado.`
                        )
                      }
                    >
                      {opcionesRol.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className="mp-btn-peligro"
                    disabled={ocupado === m.id}
                    onClick={() => {
                      if (!window.confirm(`¿Quitar a ${m.nombre ?? m.email} del equipo?`)) return;
                      if (esEjemplo) {
                        revocarEjemplo(m.id);
                        return;
                      }
                      ejecutar(
                        m.id,
                        () => api<Equipo>(`${base}/miembros/${m.id}`, { method: 'PATCH', body: { estado: 'retirado' } }),
                        'La persona ya no forma parte del equipo.'
                      );
                    }}
                  >
                    Revocar
                  </button>
                </div>
              </li>
            ))}
          </ListaScroll>
        )}
      </section>

      {equipo.invitaciones.length > 0 && (
        <section className="mp-bloque">
          <h3>Invitaciones pendientes</h3>
          <ul className="mp-equipo-lista">
            {equipo.invitaciones.map((i) => (
              <li key={i.id} className="mp-equipo-item">
                <div className="mp-equipo-info">
                  <strong>{i.email}</strong>
                  <span>
                    Roles: {i.rol} · {i.vencida ? 'vencida' : `vence el ${formatDate(i.expira_en)}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="mp-btn-peligro"
                  disabled={ocupado === i.id}
                  onClick={() => {
                    if (esEjemplo) {
                      setEquipo((prev) =>
                        prev ? { ...prev, invitaciones: prev.invitaciones.filter((x) => x.id !== i.id) } : prev
                      );
                      setAviso('Invitación anulada (ejemplo).');
                      return;
                    }
                    ejecutar(i.id, () => api<Equipo>(`${base}/invitaciones/${i.id}`, { method: 'DELETE' }), 'Invitación anulada.');
                  }}
                >
                  Anular
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mp-bloque">
        <h3>Roles disponibles</h3>
        <p className="muted">
          Cada rol define qué puede hacer la persona. Los define Tu Comercio Local; el equipo queda en tus manos.
        </p>
        <ul className="mp-roles">
          {equipo.roles.map((r) => (
            <li key={r.id} className="mp-rol">
              <strong>{r.nombre}</strong>
              <span className="muted">
                {r.enUso > 0
                  ? `${r.enUso} ${r.enUso === 1 ? 'persona' : 'personas'} con este rol`
                  : 'Nadie lo tiene todavía'}
              </span>
              <ul className="mp-permisos">
                {r.permisos.map((p) => (
                  <li key={p}>{descripcion[p] ?? p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
