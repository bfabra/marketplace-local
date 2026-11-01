'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type EfectosPlan, type PlanAdmin } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { PageSkeleton } from '@/components/ui/skeleton';
import { numero } from '@/components/admin/controles';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { SuscripcionesTabs, limite } from '@/components/admin/operaciones';

type Respuesta = { efectos: EfectosPlan | null; planes: PlanAdmin[] };

function textoEfectos(e: EfectosPlan | null) {
  if (!e || (e.productos === 0 && e.empleados === 0)) return undefined;
  const partes = [
    e.productos > 0 && `${numero(e.productos)} ${e.productos === 1 ? 'producto quedó pausado' : 'productos quedaron pausados'}`,
    e.empleados > 0 && `${numero(e.empleados)} ${e.empleados === 1 ? 'empleado quedó suspendido' : 'empleados quedaron suspendidos'}`,
  ].filter(Boolean);
  return `Con los nuevos límites, ${partes.join(' y ')} en ${numero(e.tiendas)} ${e.tiendas === 1 ? 'tienda' : 'tiendas'}.`;
}

export default function AdminPlansPage() {
  const toast = useToast();
  const [planes, setPlanes] = useState<PlanAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);

  useEffect(() => {
    api<PlanAdmin[]>('/admin/planes')
      .then(setPlanes)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, []);

  async function mover(plan: PlanAdmin, direccion: 'subir' | 'bajar') {
    setMoviendo(plan.id);
    setError(null);
    try {
      setPlanes(await api<PlanAdmin[]>(`/admin/planes/${plan.id}/orden`, { method: 'POST', body: { direccion } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setMoviendo(null);
    }
  }

  function guardado(r: Respuesta, nombre: string, nuevo: boolean) {
    setPlanes(r.planes);
    setEditando(null);
    toast({ titulo: nuevo ? `Se creó el plan ${nombre}` : `Se guardó el plan ${nombre}`, texto: textoEfectos(r.efectos) });
  }

  return (
    <div className="stack">
      <EncabezadoAdmin titulo="Suscripciones y planes" descripcion="Precios y límites de lo que pueden contratar las tiendas.">
        {planes && editando === null && (
          <button className="btn" onClick={() => setEditando('nuevo')}>
            <Icon name="plus" size={16} /> Nuevo plan
          </button>
        )}
      </EncabezadoAdmin>

      <SuscripcionesTabs />

      <p className="muted">
        Un precio nuevo se cobra desde la próxima renovación de cada tienda. Si bajás un límite, se aplica al
        instante: se pausan los productos más nuevos y se suspenden los últimos empleados que superen el máximo.
      </p>

      {error && <Alert>{error}</Alert>}

      {editando === 'nuevo' && (
        <section className="card">
          <FormPlan onListo={(r, nombre) => guardado(r, nombre, true)} onCancelar={() => setEditando(null)} />
        </section>
      )}

      {!planes ? (
        <PageSkeleton />
      ) : (
        <ul className="planes-admin">
          {planes.map((p, i) => (
            <li key={p.id} className={`card plan-admin${p.activo ? '' : ' plan-inactivo'}`}>
              {editando === p.id ? (
                <FormPlan plan={p} onListo={(r, nombre) => guardado(r, nombre, false)} onCancelar={() => setEditando(null)} />
              ) : (
                <>
                  <div className="admin-fila-cabecera">
                    <div>
                      <h2>{p.nombre}</h2>
                      <p className="plan-precio">
                        {Number(p.precio_mensual) > 0 ? (
                          <>
                            <strong>{formatPrice(Number(p.precio_mensual))}</strong> <span className="muted">por mes</span>
                          </>
                        ) : (
                          <strong>Sin cargo</strong>
                        )}
                      </p>
                    </div>
                    <div className="plan-badges">
                      {p.es_gratis && <span className="badge badge-activa">De inicio</span>}
                      {!p.activo && <span className="badge badge-archivada">No se ofrece</span>}
                    </div>
                  </div>

                  <ul className="plan-limites">
                    <li>
                      <Icon name="package" size={16} /> {limite(p.max_productos, 'productos')}
                    </li>
                    <li>
                      <Icon name="users" size={16} /> {limite(p.max_empleados, 'empleados')}
                    </li>
                  </ul>

                  <div className="cifras">
                    <Link className="cifra cifra-link" href={`/admin/suscripciones?plan=${p.id}`}>
                      <strong>{numero(p.tiendas)}</strong>
                      <span>{p.tiendas === 1 ? 'tienda vigente' : 'tiendas vigentes'}</span>
                    </Link>
                    <Link className="cifra cifra-link" href={`/admin/suscripciones?vista=en_gracia&plan=${p.id}`}>
                      <strong>{numero(p.enGracia)}</strong>
                      <span>en gracia</span>
                    </Link>
                    <div className="cifra">
                      <strong>{formatPrice(Number(p.ingresoMensual))}</strong>
                      <span>por mes</span>
                    </div>
                  </div>

                  <div className="actions">
                    <button className="btn btn-secondary" disabled={editando !== null} onClick={() => setEditando(p.id)}>
                      <Icon name="pencil" size={16} /> Editar
                    </button>
                    <button
                      className="icon-btn icon-btn-sm"
                      aria-label={`Subir ${p.nombre}`}
                      title="Mostrar antes"
                      disabled={i === 0 || moviendo !== null}
                      onClick={() => mover(p, 'subir')}
                    >
                      <Icon name="chevron-up" size={16} />
                    </button>
                    <button
                      className="icon-btn icon-btn-sm"
                      aria-label={`Bajar ${p.nombre}`}
                      title="Mostrar después"
                      disabled={i === planes.length - 1 || moviendo !== null}
                      onClick={() => mover(p, 'bajar')}
                    >
                      <Icon name="chevron-down" size={16} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const aTexto = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

function FormPlan({
  plan,
  onListo,
  onCancelar,
}: {
  plan?: PlanAdmin;
  onListo: (r: Respuesta, nombre: string) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [nombre, setNombre] = useState(plan?.nombre ?? '');
  const [precio, setPrecio] = useState(aTexto(plan ? Number(plan.precio_mensual) : null));
  const [productos, setProductos] = useState(aTexto(plan?.max_productos));
  const [empleados, setEmpleados] = useState(aTexto(plan?.max_empleados));
  const [activo, setActivo] = useState(plan?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const gratis = plan?.es_gratis ?? false;
  const bajaLimite = (antes: number | null | undefined, ahora: string) =>
    plan !== undefined && ahora !== '' && (antes === null || antes === undefined || Number(ahora) < antes);
  const avisoLimite =
    plan && plan.tiendas > 0 && (bajaLimite(plan.max_productos, productos) || bajaLimite(plan.max_empleados, empleados));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2) return setError('El nombre tiene que tener al menos 2 caracteres.');
    const valorPrecio = gratis ? 0 : Number(precio.replace(',', '.'));
    if (!gratis && (precio.trim() === '' || !Number.isFinite(valorPrecio) || valorPrecio < 0)) {
      return setError('Ingresá un precio válido.');
    }
    for (const v of [productos, empleados]) {
      if (v !== '' && !/^\d+$/.test(v)) return setError('Los límites son números enteros; vacío es ilimitado.');
    }
    setEnviando(true);
    setError(null);
    try {
      const body = {
        nombre: nombre.trim(),
        precio_mensual: valorPrecio,
        max_productos: productos === '' ? null : Number(productos),
        max_empleados: empleados === '' ? null : Number(empleados),
        activo: gratis ? true : activo,
      };
      const r = plan
        ? await api<Respuesta>(`/admin/planes/${plan.id}`, { method: 'PUT', body })
        : await api<Respuesta>('/admin/planes', { method: 'POST', body });
      onListo(r, body.nombre);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="stack plan-form" onSubmit={enviar} noValidate>
      <h2>{plan ? `Editar ${plan.nombre}` : 'Nuevo plan'}</h2>
      <div className="plan-form-campos">
        <label className="field" htmlFor={`${id}-nombre`}>
          <span>Nombre</span>
          <input id={`${id}-nombre`} maxLength={40} value={nombre} autoFocus onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="field" htmlFor={`${id}-precio`}>
          <span>Precio por mes</span>
          <input
            id={`${id}-precio`}
            inputMode="decimal"
            value={gratis ? '0' : precio}
            disabled={gratis}
            placeholder="Por ejemplo: 9999"
            onChange={(e) => setPrecio(e.target.value)}
          />
          {gratis && <small className="field-hint">El plan de inicio no tiene cargo.</small>}
        </label>
        <label className="field" htmlFor={`${id}-productos`}>
          <span>Máximo de productos</span>
          <input
            id={`${id}-productos`}
            inputMode="numeric"
            value={productos}
            placeholder="Ilimitados"
            onChange={(e) => setProductos(e.target.value.trim())}
          />
        </label>
        <label className="field" htmlFor={`${id}-empleados`}>
          <span>Máximo de empleados</span>
          <input
            id={`${id}-empleados`}
            inputMode="numeric"
            value={empleados}
            placeholder="Ilimitados"
            onChange={(e) => setEmpleados(e.target.value.trim())}
          />
        </label>
      </div>
      <small className="field-hint">Dejá un límite vacío para que sea ilimitado.</small>

      {!gratis && (
        <label className="check">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span>
            Se ofrece a las tiendas
            <small className="field-hint">
              Si lo dejás de ofrecer, las tiendas que ya lo tienen lo conservan, pero nadie más lo puede elegir.
            </small>
          </span>
        </label>
      )}

      {avisoLimite && (
        <div className="aviso-banda aviso-advertencia">
          <Icon name="alert" size={18} />
          <span>
            Bajás un límite de un plan con {numero(plan.tiendas)} {plan.tiendas === 1 ? 'tienda' : 'tiendas'}: lo que
            sobre se pausa al guardar.
          </span>
        </div>
      )}

      {error && <small className="field-error">{error}</small>}
      <div className="actions">
        <button className="btn" disabled={enviando}>
          {enviando ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
