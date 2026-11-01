'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ApiError,
  api,
  type PaginaSuscripcionesAdmin,
  type PlanAdmin,
  type VistaSuscripciones,
} from '@/lib/api-client';
import { formatDate, formatPrice } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { Icon } from '@/components/ui/icon';
import { StoreStatus } from '@/components/ui/store-status';
import { Buscador, Paginacion, numero } from '@/components/admin/controles';
import { EstadoSuscripcionBadge, SuscripcionesTabs, vencimiento } from '@/components/admin/operaciones';

const VISTAS: { vista: VistaSuscripciones; label: string }[] = [
  { vista: 'todas', label: 'Todas' },
  { vista: 'vigentes', label: 'Vigentes' },
  { vista: 'por_vencer', label: 'Vencen en 7 días' },
  { vista: 'en_gracia', label: 'En gracia' },
  { vista: 'vencidas', label: 'Vencidas' },
  { vista: 'canceladas', label: 'Canceladas' },
];

const vistaDeUrl = (valor: string | null): VistaSuscripciones =>
  VISTAS.find((v) => v.vista === valor)?.vista ?? 'todas';

export default function AdminSubscriptionsPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Suscripciones />
    </Suspense>
  );
}

function Suscripciones() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const vista = vistaDeUrl(params.get('vista'));
  const plan = params.get('plan') ?? '';
  const buscar = params.get('buscar') ?? '';
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);

  const [datos, setDatos] = useState<PaginaSuscripcionesAdmin | null>(null);
  const [planes, setPlanes] = useState<PlanAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PlanAdmin[]>('/admin/planes').then(setPlanes).catch(() => setPlanes([]));
  }, []);

  const navegar = useCallback(
    (cambios: { vista?: VistaSuscripciones; plan?: string; buscar?: string; pagina?: number }) => {
      const q = new URLSearchParams();
      const v = cambios.vista ?? vista;
      const pl = cambios.plan ?? plan;
      const b = cambios.buscar ?? buscar;
      const p = cambios.pagina ?? 1;
      if (v !== 'todas') q.set('vista', v);
      if (pl) q.set('plan', pl);
      if (b) q.set('buscar', b);
      if (p > 1) q.set('pagina', String(p));
      router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [vista, plan, buscar, pathname, router]
  );

  const ultimaConsulta = useRef(0);
  useEffect(() => {
    const consulta = ++ultimaConsulta.current;
    const q = new URLSearchParams({ vista, pagina: String(pagina) });
    if (plan) q.set('plan', plan);
    if (buscar) q.set('buscar', buscar);
    api<PaginaSuscripcionesAdmin>(`/admin/suscripciones?${q}`)
      .then((d) => consulta === ultimaConsulta.current && setDatos(d))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [vista, plan, buscar, pagina]);

  return (
    <div className="stack">
      <EncabezadoAdmin titulo="Suscripciones y planes" descripcion="El plan de cada tienda, sus pagos y vencimientos." />

      <SuscripcionesTabs />

      <div className="admin-filtros">
        <div className="tabs" role="group" aria-label="Filtrar suscripciones">
          {VISTAS.map((v) => (
            <button
              key={v.vista}
              className="tab"
              aria-pressed={vista === v.vista}
              onClick={() => navegar({ vista: v.vista })}
            >
              {v.label}
              {v.vista !== 'todas' && datos ? (
                <span className="tab-cuenta">{numero(datos.conteos[v.vista])}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="filtros-linea">
          <label className="field field-compacto">
            <span className="sr-only">Plan</span>
            <select value={plan} onChange={(e) => navegar({ plan: e.target.value })}>
              <option value="">Todos los planes</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <Buscador
            valor={buscar}
            placeholder="Tienda o correo del dueño"
            onCambio={(texto) => navegar({ buscar: texto })}
          />
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {!datos ? (
        <p>Cargando…</p>
      ) : datos.items.length === 0 ? (
        <EmptyState icono="card" titulo={buscar ? 'No encontramos suscripciones' : 'No hay suscripciones en esta vista'}>
          {buscar ? 'Probá con otro nombre de tienda o correo.' : 'Cuando haya, van a aparecer acá.'}
        </EmptyState>
      ) : (
        <>
          <p className="muted admin-total">
            {numero(datos.total)} {datos.total === 1 ? 'suscripción' : 'suscripciones'}
          </p>
          <ListaScroll as="ul" className="admin-lista" etiqueta="Suscripciones" key={datos.pagina}>
            {datos.items.map((s) => {
              const v = vencimiento(s);
              return (
                <li key={s.id} className="card admin-fila">
                  <div className="admin-fila-cabecera">
                    <div>
                      <h2>
                        <Link href={`/admin/suscripciones/${s.id}`}>{s.tienda.nombre}</Link>
                      </h2>
                      <p className="muted">
                        {s.duenio.nombre || 'Sin nombre'} · {s.duenio.email}
                      </p>
                    </div>
                    <EstadoSuscripcionBadge estado={s.estado} />
                  </div>

                  <dl className="admin-fila-datos">
                    <div>
                      <dt>Plan</dt>
                      <dd>
                        {s.plan.nombre}{' '}
                        <span className="muted">
                          · {Number(s.plan.precio_mensual) > 0 ? `${formatPrice(Number(s.plan.precio_mensual))}/mes` : 'sin cargo'}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Desde</dt>
                      <dd>{formatDate(s.inicio)}</dd>
                    </div>
                    <div>
                      <dt>Último pago</dt>
                      <dd>
                        {s.ultimoPago
                          ? `${formatPrice(Number(s.ultimoPago.monto))} · ${s.ultimoPago.pagado_en ? formatDate(s.ultimoPago.pagado_en) : s.ultimoPago.estado}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Tienda</dt>
                      <dd>
                        <StoreStatus estado={s.tienda.estado} />
                      </dd>
                    </div>
                  </dl>

                  {v && (
                    <div className="admin-fila-indicadores">
                      <span className={v.alerta ? 'indicador indicador-alerta' : 'indicador'}>
                        <Icon name="clock" size={14} /> {v.texto}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ListaScroll>
          <Paginacion
            pagina={datos.pagina}
            total={datos.total}
            porPagina={datos.porPagina}
            onCambio={(p) => navegar({ pagina: p })}
          />
        </>
      )}
    </div>
  );
}
