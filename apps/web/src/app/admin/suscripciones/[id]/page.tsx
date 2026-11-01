'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type FichaSuscripcionAdmin } from '@/lib/api-client';
import { formatDate, formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StoreStatus } from '@/components/ui/store-status';
import { AccionConMotivo, numero } from '@/components/admin/controles';
import {
  ESTADO_SUSCRIPCION,
  EstadoSuscripcionBadge,
  fechaHora,
  limite,
  vencimiento,
} from '@/components/admin/operaciones';

const pesos = (n: number) => formatPrice(Number(n));
const mes = (periodo: string) =>
  new Date(`${periodo}T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

export default function AdminSubscriptionPage({ params }: { params: { id: string } }) {
  const toast = useToast();
  const [s, setSuscripcion] = useState<FichaSuscripcionAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<'extender' | 'pago' | null>(null);

  const cargar = useCallback(() => {
    api<FichaSuscripcionAdmin>(`/admin/suscripciones/${params.id}`)
      .then(setSuscripcion)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(cargar, [cargar]);

  async function cancelar(motivo: string) {
    const r = await api<FichaSuscripcionAdmin>(`/admin/suscripciones/${params.id}/cancelacion`, {
      method: 'POST',
      body: { motivo },
    });
    setSuscripcion(r);
    toast({
      titulo: 'Suscripción cancelada',
      texto: r.tienda.estado === 'vencida' ? `${r.tienda.nombre} quedó vencida hasta que elija un plan.` : undefined,
    });
  }

  const volver = (
    <Link href="/admin/suscripciones" className="muted">
      ← Suscripciones
    </Link>
  );

  if (error && !s) {
    return (
      <div className="stack">
        {volver}
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!s) return <PageSkeleton />;

  const conPrecio = Number(s.plan.precio_mensual) > 0;
  const renovable = conPrecio && ['activa', 'en_gracia', 'vencida'].includes(s.estado);
  const vigente = ['activa', 'en_gracia', 'pendiente'].includes(s.estado);
  const cancelable = vigente && !s.plan.es_gratis;
  const v = vencimiento(s);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          {volver}
          <h1>{s.tienda.nombre}</h1>
          <p className="muted">
            {s.plan.nombre} · desde el {formatDate(s.inicio)}
            {s.debitoAutomatico ? ' · débito automático' : ''}
          </p>
        </div>
        <div className="actions">
          <EstadoSuscripcionBadge estado={s.estado} />
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {s.estado === 'en_gracia' && (
        <div className="aviso-banda aviso-advertencia">
          <Icon name="clock" size={18} />
          <span>
            No se cobró la renovación. La tienda sigue abierta {s.diasGracia} días de gracia
            {s.gracia_hasta ? `, hasta el ${formatDate(s.gracia_hasta)}` : ''}; después vence.
          </span>
        </div>
      )}
      {s.estado === 'cancelada' && s.motivo_cancelacion && (
        <p className="nota-moderacion">
          <strong>Motivo de la cancelación:</strong> {s.motivo_cancelacion}
        </p>
      )}

      <div className="admin-bloques">
        <section className="card stack">
          <h2>Plan</h2>
          <dl className="datos">
            <dt>Plan</dt>
            <dd>
              {s.plan.nombre}
              {!s.plan.activo && <span className="muted"> · ya no se ofrece</span>}
            </dd>
            <dt>Precio</dt>
            <dd>{conPrecio ? `${pesos(s.plan.precio_mensual)} por mes` : 'Sin cargo'}</dd>
            <dt>Período</dt>
            <dd>
              {s.fin_periodo ? `hasta el ${formatDate(s.fin_periodo)}` : 'sin vencimiento'}
              {v?.alerta && <span className="muted"> · {v.texto.toLowerCase()}</span>}
            </dd>
            {s.nota_admin && (
              <>
                <dt>Última nota</dt>
                <dd>{s.nota_admin}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="card admin-bloque">
          <h2>
            <Icon name="package" size={18} /> Uso del plan
          </h2>
          <div className="cifras">
            <div className="cifra">
              <strong>
                {numero(s.uso.productos)}
                {s.plan.max_productos !== null && <small> / {numero(s.plan.max_productos)}</small>}
              </strong>
              <span>productos publicados</span>
            </div>
            <div className="cifra">
              <strong>{numero(s.uso.pausadosPorLimite)}</strong>
              <span>pausados por el límite</span>
            </div>
            <div className="cifra">
              <strong>
                {numero(s.uso.empleados)}
                {s.plan.max_empleados !== null && <small> / {numero(s.plan.max_empleados)}</small>}
              </strong>
              <span>empleados activos</span>
            </div>
          </div>
          <p className="muted admin-bloque-pie">
            Incluye {limite(s.plan.max_productos, 'productos')} y {limite(s.plan.max_empleados, 'empleados')}.
          </p>
        </section>

        <section className="card stack">
          <h2>Tienda</h2>
          <dl className="datos">
            <dt>Estado</dt>
            <dd>
              <StoreStatus estado={s.tienda.estado} />
            </dd>
            {s.tienda.motivo_estado && (
              <>
                <dt>Motivo</dt>
                <dd>{s.tienda.motivo_estado}</dd>
              </>
            )}
            <dt>Dueño</dt>
            <dd>{s.duenio.nombre ?? 'Sin nombre'}</dd>
            <dt>Correo</dt>
            <dd>{s.duenio.email ? <a href={`mailto:${s.duenio.email}`}>{s.duenio.email}</a> : '—'}</dd>
          </dl>
        </section>
      </div>

      {(renovable || cancelable) && (
        <section className="card stack">
          <h2>Acciones</h2>
          {s.estado === 'vencida' && (
            <p className="muted">
              Extender o registrar un pago la reactiva: la tienda vuelve a estar activa con este plan.
            </p>
          )}
          {accion === null && (
            <div className="actions">
              {renovable && (
                <>
                  <button className="btn" onClick={() => setAccion('pago')}>
                    Registrar pago
                  </button>
                  <button className="btn btn-secondary" onClick={() => setAccion('extender')}>
                    Extender período
                  </button>
                </>
              )}
              {cancelable && (
                <AccionConMotivo
                  label="Cancelar suscripción"
                  pregunta="¿Por qué se cancela?"
                  ayuda="Queda en el historial. Si la tienda no tiene otro plan vigente, vence y sus productos dejan de verse hasta que elija uno."
                  confirmar="Cancelar suscripción"
                  peligro
                  onConfirmar={cancelar}
                />
              )}
            </div>
          )}
          {accion === 'pago' && (
            <FormPago
              ficha={s}
              onListo={(r) => {
                setSuscripcion(r);
                setAccion(null);
                toast({
                  titulo: 'Pago registrado',
                  texto: r.fin_periodo ? `El período sigue hasta el ${formatDate(r.fin_periodo)}.` : undefined,
                });
              }}
              onCancelar={() => setAccion(null)}
            />
          )}
          {accion === 'extender' && (
            <FormExtender
              ficha={s}
              onListo={(r, dias) => {
                setSuscripcion(r);
                setAccion(null);
                toast({
                  titulo: `Período extendido ${dias} ${dias === 1 ? 'día' : 'días'}`,
                  texto: r.fin_periodo ? `Ahora vence el ${formatDate(r.fin_periodo)}.` : undefined,
                });
              }}
              onCancelar={() => setAccion(null)}
            />
          )}
        </section>
      )}

      <section className="card stack">
        <h2>Pagos</h2>
        {s.pagos.length === 0 ? (
          <p className="muted">{conPrecio ? 'Todavía no hay pagos registrados.' : 'Este plan no tiene cargo.'}</p>
        ) : (
          <ListaScroll as="ul" className="lista-simple" etiqueta="Pagos" alto="22rem">
            {s.pagos.map((pg) => (
              <li key={pg.id} className="fila-con-estado">
                <span>
                  <strong className="capitalizar">{mes(pg.periodo)}</strong>{' '}
                  <span className="muted">
                    · {pg.pagado_en ? fechaHora(pg.pagado_en) : 'sin fecha'}
                    {pg.mp_payment_id ? ` · ${pg.mp_payment_id}` : ''}
                  </span>
                </span>
                <span>
                  <strong>{pesos(pg.monto)}</strong> <span className="muted">· {pg.estado}</span>
                </span>
              </li>
            ))}
          </ListaScroll>
        )}
      </section>

      <section className="card stack">
        <h2>Historial</h2>
        {s.historial.length === 0 ? (
          <p className="muted">Sin movimientos registrados.</p>
        ) : (
          <ListaScroll as="ol" className="historial" etiqueta="Historial de la suscripción" alto="26rem">
            {s.historial.map((h, i) => (
              <li key={i}>
                <time className="muted" dateTime={h.fecha}>
                  {fechaHora(h.fecha)}
                </time>
                <p>
                  {h.accion === 'INSERT'
                    ? `Se creó (${h.estado ? ESTADO_SUSCRIPCION[h.estado].label.toLowerCase() : ''})`
                    : h.plan
                      ? `Cambió al plan ${h.plan}`
                      : h.estado !== h.estadoAnterior && h.estado
                        ? `${h.estadoAnterior ? ESTADO_SUSCRIPCION[h.estadoAnterior].label : ''} → ${ESTADO_SUSCRIPCION[h.estado].label}`
                        : h.fin_periodo !== h.finAnterior && h.fin_periodo
                          ? `Vence el ${formatDate(h.fin_periodo)}`
                          : 'Se actualizó'}
                  <span className="muted"> · {h.actor ? `por ${h.actor}` : 'automático'}</span>
                </p>
                {h.estado !== h.estadoAnterior && h.fin_periodo !== h.finAnterior && h.fin_periodo && h.accion !== 'INSERT' && (
                  <p className="muted">Vence el {formatDate(h.fin_periodo)}</p>
                )}
                {h.nota && <p className="muted">{h.nota}</p>}
              </li>
            ))}
          </ListaScroll>
        )}
      </section>

      {s.otras.length > 0 && (
        <section className="card stack">
          <h2>Otras suscripciones de la tienda</h2>
          <ul className="lista-simple">
            {s.otras.map((o) => (
              <li key={o.id} className="fila-con-estado">
                <span>
                  <Link href={`/admin/suscripciones/${o.id}`}>{o.plan}</Link>{' '}
                  <span className="muted">· desde el {formatDate(o.inicio)}</span>
                </span>
                <EstadoSuscripcionBadge estado={o.estado} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FormPago({
  ficha,
  onListo,
  onCancelar,
}: {
  ficha: FichaSuscripcionAdmin;
  onListo: (r: FichaSuscripcionAdmin) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      onListo(
        await api<FichaSuscripcionAdmin>(`/admin/suscripciones/${ficha.id}/pagos`, {
          method: 'POST',
          body: { referencia: referencia.trim() || undefined },
        })
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="motivo-form" onSubmit={enviar} noValidate>
      <p>
        Se registra un mes de <strong>{ficha.plan.nombre}</strong> por{' '}
        <strong>{pesos(ficha.plan.precio_mensual)}</strong> y el período se corre un mes.
      </p>
      <label className="field" htmlFor={id}>
        <span>Referencia del pago (opcional)</span>
        <input
          id={id}
          maxLength={60}
          value={referencia}
          autoFocus
          placeholder="Número de transferencia o de operación"
          onChange={(e) => setReferencia(e.target.value)}
        />
        <small className="field-hint">Si la dejás vacía, se genera una referencia de prueba.</small>
      </label>
      {error && <small className="field-error">{error}</small>}
      <div className="actions">
        <button className="btn" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Registrar pago'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

const DIAS = [7, 15, 30];

function FormExtender({
  ficha,
  onListo,
  onCancelar,
}: {
  ficha: FichaSuscripcionAdmin;
  onListo: (r: FichaSuscripcionAdmin, dias: number) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [dias, setDias] = useState(7);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
      setError('Se extiende entre 1 y 90 días.');
      return;
    }
    if (motivo.trim().length < 5) {
      setError('Anotá el motivo (al menos 5 caracteres).');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await api<FichaSuscripcionAdmin>(`/admin/suscripciones/${ficha.id}/extension`, {
        method: 'POST',
        body: { dias, motivo: motivo.trim() },
      });
      onListo(r, dias);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="motivo-form" onSubmit={enviar} noValidate>
      <fieldset className="field">
        <legend>¿Cuántos días sin cargo?</legend>
        <div className="tabs" role="group">
          {DIAS.map((d) => (
            <button key={d} type="button" className="tab" aria-pressed={dias === d} onClick={() => setDias(d)}>
              {d} días
            </button>
          ))}
          <label className="dias-otro">
            <span className="sr-only">Otra cantidad de días</span>
            <input
              type="number"
              min={1}
              max={90}
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
            />
          </label>
        </div>
      </fieldset>
      <label className="field" htmlFor={id}>
        <span>Motivo</span>
        <textarea
          id={id}
          rows={2}
          maxLength={500}
          value={motivo}
          placeholder="Por ejemplo: compensación por la caída del sitio"
          onChange={(e) => setMotivo(e.target.value)}
        />
        <small className="field-hint">
          Queda en el historial. Se suma desde {ficha.estado === 'activa' ? 'el vencimiento actual' : 'hoy'}.
        </small>
      </label>
      {error && <small className="field-error">{error}</small>}
      <div className="actions">
        <button className="btn" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Extender'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
