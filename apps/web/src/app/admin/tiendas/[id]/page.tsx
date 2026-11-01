'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ApiError,
  api,
  type EstadoTienda,
  type FichaTiendaAdmin,
  type PoliticaRevision,
} from '@/lib/api-client';
import { formatDate, formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StoreStatus } from '@/components/ui/store-status';
import { AccionConMotivo, numero } from '@/components/admin/controles';

const ESTADOS: Record<EstadoTienda, string> = {
  pendiente: 'Pendiente',
  activa: 'Activa',
  suspendida: 'Suspendida',
  vencida: 'Vencida',
  archivada: 'Archivada',
};

const POLITICAS: { valor: PoliticaRevision; label: string; texto: string }[] = [
  {
    valor: 'automatica',
    label: 'Automática',
    texto: 'Revisa sus primeros productos; con buen historial publica al instante.',
  },
  { valor: 'siempre', label: 'Revisar todo', texto: 'Todo lo que publique pasa por moderación.' },
  { valor: 'nunca', label: 'Sin revisión', texto: 'Publica al instante, aunque sea nueva.' },
];

export default function AdminStorePage({ params }: { params: { id: string } }) {
  const toast = useToast();
  const [t, setTienda] = useState<FichaTiendaAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    api<FichaTiendaAdmin>(`/admin/stores/${params.id}`)
      .then(setTienda)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  useEffect(cargar, [cargar]);

  /** Sin motivo atrapa el error acá; con motivo lo muestra el formulario. */
  async function cambiarEstado(estado: EstadoTienda, hecho: string, motivo?: string) {
    setOcupado(true);
    setError(null);
    try {
      await api(`/admin/stores/${params.id}/estado`, { method: 'PATCH', body: { estado, motivo } });
      toast({ titulo: hecho, texto: t?.nombre });
      cargar();
    } catch (e) {
      if (motivo !== undefined) throw e;
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarPolitica(politica: PoliticaRevision) {
    setOcupado(true);
    setError(null);
    try {
      await api(`/admin/stores/${params.id}/revision`, { method: 'PATCH', body: { politica } });
      toast({ titulo: 'Revisión actualizada', texto: POLITICAS.find((p) => p.valor === politica)?.texto });
      cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(false);
    }
  }

  const volver = (
    <Link href="/admin/tiendas" className="muted">
      ← Tiendas
    </Link>
  );

  if (error && !t) {
    return (
      <div className="stack">
        {volver}
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!t) return <PageSkeleton />;

  const productosHref = `/admin/productos?tienda=${t.id}`;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          {volver}
          <h1>{t.nombre}</h1>
          <p className="muted">
            {t.localidad} · desde el {formatDate(t.creado_en)} ·{' '}
            {t.rubro ? (
              <>
                {t.rubro.nombre}
                {t.rubro.subrubro && ` · ${t.rubro.subrubro}`}
              </>
            ) : (
              <span className="badge badge-pendiente">Sin rubro</span>
            )}
          </p>
        </div>
        <div className="actions">
          <StoreStatus estado={t.estado} />
          {t.estado === 'activa' && (
            <a href={`/tiendas/${t.slug}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <Icon name="external" size={16} /> Ver en el sitio
            </a>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <section className="card stack">
        <h2>Estado de la tienda</h2>
        {t.motivo_estado && (
          <p className="nota-moderacion">
            <strong>Motivo informado a la tienda:</strong> {t.motivo_estado}
          </p>
        )}
        <div className="actions">
          {t.estado === 'pendiente' && (
            <>
              <button
                className="btn"
                disabled={ocupado || !t.mercadoPagoVinculada}
                onClick={() => cambiarEstado('activa', 'Tienda aprobada')}
              >
                Aprobar
              </button>
              <AccionConMotivo
                label="Rechazar"
                pregunta="¿Por qué se rechaza la tienda?"
                ayuda="El dueño lo ve en su panel. La tienda queda archivada."
                confirmar="Rechazar tienda"
                peligro
                disabled={ocupado}
                onConfirmar={(motivo) => cambiarEstado('archivada', 'Tienda rechazada', motivo)}
              />
              {!t.mercadoPagoVinculada && (
                <span className="muted">Para aprobarla, el dueño tiene que vincular Mercado Pago.</span>
              )}
            </>
          )}
          {t.estado === 'activa' && (
            <AccionConMotivo
              label="Suspender"
              pregunta="¿Por qué se suspende la tienda?"
              ayuda="El dueño lo ve en su panel. Sus productos dejan de verse en el sitio."
              confirmar="Suspender tienda"
              peligro
              disabled={ocupado}
              onConfirmar={(motivo) => cambiarEstado('suspendida', 'Tienda suspendida', motivo)}
            />
          )}
          {t.estado === 'suspendida' && (
            <>
              <button className="btn" disabled={ocupado} onClick={() => cambiarEstado('activa', 'Tienda reactivada')}>
                Reactivar
              </button>
              <AccionConMotivo
                label="Archivar"
                pregunta="¿Por qué se archiva la tienda?"
                ayuda="El dueño lo ve en su panel."
                confirmar="Archivar tienda"
                peligro
                disabled={ocupado}
                onConfirmar={(motivo) => cambiarEstado('archivada', 'Tienda archivada', motivo)}
              />
            </>
          )}
          {t.estado === 'archivada' && (
            <button
              className="btn btn-secondary"
              disabled={ocupado}
              onClick={() => cambiarEstado('pendiente', 'La tienda vuelve a estar pendiente')}
            >
              Volver a pendiente
            </button>
          )}
          {t.estado === 'vencida' && (
            <p className="muted">Vuelve a estar activa cuando el dueño renueva el plan.</p>
          )}
        </div>
      </section>

      <section className="card stack">
        <div className="page-head">
          <h2>Revisión de productos</h2>
          <Link href={productosHref} className="btn btn-secondary">
            Ver sus productos
          </Link>
        </div>
        <div className="tabs" role="group" aria-label="Cómo se revisan sus productos">
          {POLITICAS.map((p) => (
            <button
              key={p.valor}
              className="tab"
              aria-pressed={t.revision_productos === p.valor}
              disabled={ocupado}
              onClick={() => t.revision_productos !== p.valor && cambiarPolitica(p.valor)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="muted">{POLITICAS.find((p) => p.valor === t.revision_productos)?.texto}</p>
        <p className={t.revision.activa ? 'revision-estado revision-activa' : 'revision-estado'}>
          <Icon name={t.revision.activa ? 'clock' : 'check'} size={16} />
          {t.revision.activa
            ? 'Hoy, lo que publique pasa por moderación.'
            : 'Hoy, lo que publique se ve al instante.'}
          {t.revision_productos === 'automatica' && t.revision.habilitadaGlobal && (
            <span className="muted">
              {' '}
              {t.revision.activa
                ? `(lleva ${numero(t.productos.aprobados)} de ${numero(t.revision.umbral)} productos aprobados para publicar sin revisión)`
                : `(ya tiene ${numero(t.productos.aprobados)} productos aprobados)`}
            </span>
          )}
        </p>
      </section>

      <div className="admin-bloques">
        <section className="card admin-bloque">
          <h2>
            <Icon name="package" size={18} /> Productos
          </h2>
          <div className="cifras">
            <Link href={`${productosHref}&vista=publicados`} className="cifra cifra-link">
              <strong>{numero(t.productos.publicado)}</strong>
              <span>publicados</span>
            </Link>
            <Link href={productosHref} className="cifra cifra-link">
              <strong>{numero(t.productos.enRevision)}</strong>
              <span>en revisión</span>
            </Link>
            <Link href={`${productosHref}&vista=rechazados`} className="cifra cifra-link">
              <strong>{numero(t.productos.rechazados)}</strong>
              <span>rechazados</span>
            </Link>
            <div className="cifra">
              <strong>{numero(t.productos.borrador)}</strong>
              <span>borradores</span>
            </div>
          </div>
        </section>
        <section className="card admin-bloque">
          <h2>
            <Icon name="receipt" size={18} /> Ventas
          </h2>
          <div className="cifras">
            <div className="cifra">
              <strong>{formatPrice(Number(t.ventas.monto30))}</strong>
              <span>últimos 30 días</span>
            </div>
            <div className="cifra">
              <strong>{numero(t.ventas.pedidos30)}</strong>
              <span>pedidos en 30 días</span>
            </div>
            <div className="cifra">
              <strong>{numero(t.ventas.enCurso)}</strong>
              <span>en curso</span>
            </div>
            <div className="cifra">
              <strong>{numero(t.reclamosAbiertos)}</strong>
              <span>reclamos abiertos</span>
            </div>
          </div>
          <p className="muted admin-bloque-pie">
            Desde el alta: {formatPrice(Number(t.ventas.monto))} en {numero(t.ventas.pedidos)} pedidos.
            {t.denunciasAbiertas > 0 && ` · ${numero(t.denunciasAbiertas)} denuncias abiertas.`}
          </p>
        </section>
      </div>

      <div className="admin-bloques">
        <section className="card stack">
          <h2>Dueño</h2>
          <dl className="datos">
            <dt>Nombre</dt>
            <dd>{t.duenio.nombre ?? 'Sin nombre'}</dd>
            <dt>Correo</dt>
            <dd>{t.duenio.email ? <a href={`mailto:${t.duenio.email}`}>{t.duenio.email}</a> : '—'}</dd>
            <dt>Teléfono</dt>
            <dd>{t.duenio.telefono ?? '—'}</dd>
            <dt>Cuenta desde</dt>
            <dd>{formatDate(t.duenio.creado_en)}</dd>
            <dt>Otras tiendas</dt>
            <dd>
              {t.duenio.otrasTiendas.length === 0 ? (
                'Ninguna'
              ) : (
                <ul className="lista-simple">
                  {t.duenio.otrasTiendas.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/tiendas/${o.id}`}>{o.nombre}</Link>{' '}
                      <span className="muted">· {ESTADOS[o.estado]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </dl>
        </section>

        <section className="card stack">
          <h2>Datos de la tienda</h2>
          <dl className="datos">
            <dt>CUIT</dt>
            <dd>{t.cuit}</dd>
            <dt>Razón social</dt>
            <dd>{t.razon_social ?? '—'}</dd>
            <dt>Dirección</dt>
            <dd>
              {t.direccion}, {t.localidad}
            </dd>
            <dt>Teléfono</dt>
            <dd>{t.telefono ?? '—'}</dd>
            <dt>Correo</dt>
            <dd>{t.email ?? '—'}</dd>
            <dt>Mercado Pago</dt>
            <dd>{t.mercadoPagoVinculada ? <span className="ok">Vinculado</span> : 'Sin vincular'}</dd>
          </dl>
        </section>

        <section className="card stack">
          <h2>Plan</h2>
          {t.suscripcion ? (
            <dl className="datos">
              <dt>Plan</dt>
              <dd>
                {t.suscripcion.plan}{' '}
                <span className="muted">
                  · {Number(t.suscripcion.precio_mensual) > 0 ? `${formatPrice(Number(t.suscripcion.precio_mensual))} por mes` : 'gratis'}
                </span>
              </dd>
              <dt>Estado</dt>
              <dd>{t.suscripcion.estado.replace('_', ' ')}</dd>
              <dt>Productos</dt>
              <dd>Hasta {t.suscripcion.max_productos ?? 'ilimitados'} publicados</dd>
              {t.suscripcion.fin_periodo && (
                <>
                  <dt>Período hasta</dt>
                  <dd>{formatDate(t.suscripcion.fin_periodo)}</dd>
                </>
              )}
              {t.suscripcion.gracia_hasta && (
                <>
                  <dt>Gracia hasta</dt>
                  <dd>{formatDate(t.suscripcion.gracia_hasta)}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="muted">Nunca tuvo un plan.</p>
          )}
        </section>

        <section className="card stack">
          <h2>Equipo</h2>
          {t.equipo.length === 0 ? (
            <p className="muted">Solo el dueño.</p>
          ) : (
            <ListaScroll as="ul" className="lista-simple" etiqueta="Equipo de la tienda" alto="22rem">
              {t.equipo.map((m, i) => (
                <li key={`${m.email}-${i}`}>
                  <strong>{m.nombre ?? m.email}</strong>{' '}
                  <span className="muted">
                    · {m.rol}
                    {m.estado !== 'activo' ? ` · ${m.estado}` : ''}
                  </span>
                </li>
              ))}
            </ListaScroll>
          )}
        </section>
      </div>

      <section className="card stack">
        <h2>Historial</h2>
        {t.historial.length === 0 ? (
          <p className="muted">Sin movimientos registrados.</p>
        ) : (
          <ListaScroll as="ol" className="historial" etiqueta="Historial de la tienda" alto="26rem">
            {t.historial.map((h, i) => (
              <li key={i}>
                <time className="muted" dateTime={h.fecha}>
                  {new Date(h.fecha).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
                <p>
                  {h.accion === 'INSERT'
                    ? 'Se creó la tienda'
                    : h.revision && h.estado === h.estadoAnterior
                      ? `Revisión de productos: ${POLITICAS.find((p) => p.valor === h.revision)?.label ?? h.revision}`
                      : `${ESTADOS[h.estadoAnterior ?? h.estado]} → ${ESTADOS[h.estado]}`}
                  {h.actor && <span className="muted"> · por {h.actor}</span>}
                </p>
                {h.motivo && h.estado !== h.estadoAnterior && <p className="muted">Motivo: {h.motivo}</p>}
              </li>
            ))}
          </ListaScroll>
        )}
      </section>
    </div>
  );
}
