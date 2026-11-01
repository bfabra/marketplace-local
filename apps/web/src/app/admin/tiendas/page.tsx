'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, type EstadoTienda, type PaginaTiendasAdmin, type TiendaAdmin } from '@/lib/api-client';
import { formatDate, formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { Icon } from '@/components/ui/icon';
import { StoreStatus } from '@/components/ui/store-status';
import { Buscador, Paginacion, numero } from '@/components/admin/controles';

const FILTROS: { estado: EstadoTienda | null; label: string }[] = [
  { estado: null, label: 'Todas' },
  { estado: 'pendiente', label: 'Pendientes' },
  { estado: 'activa', label: 'Activas' },
  { estado: 'suspendida', label: 'Suspendidas' },
  { estado: 'vencida', label: 'Vencidas' },
  { estado: 'archivada', label: 'Archivadas' },
];

const estadoDeUrl = (valor: string | null): EstadoTienda | null =>
  FILTROS.find((f) => f.estado === valor)?.estado ?? null;

export default function AdminStoresPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Tiendas />
    </Suspense>
  );
}

function Tiendas() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const estado = estadoDeUrl(params.get('estado'));
  const buscar = params.get('buscar') ?? '';
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);

  const [datos, setDatos] = useState<PaginaTiendasAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  // El filtro vive en la dirección: al volver desde la ficha de una tienda se conserva.
  const navegar = useCallback(
    (cambios: { estado?: EstadoTienda | null; buscar?: string; pagina?: number }) => {
      const q = new URLSearchParams();
      const e = 'estado' in cambios ? cambios.estado : estado;
      const b = cambios.buscar ?? buscar;
      const p = cambios.pagina ?? 1;
      q.set('estado', e ?? 'todas');
      if (b) q.set('buscar', b);
      if (p > 1) q.set('pagina', String(p));
      router.replace(`${pathname}?${q}`, { scroll: false });
    },
    [estado, buscar, pathname, router]
  );

  // Si cambia el filtro antes de que llegue una respuesta, se descarta la vieja.
  const ultimaConsulta = useRef(0);
  const cargar = useCallback(() => {
    const consulta = ++ultimaConsulta.current;
    const q = new URLSearchParams();
    if (estado) q.set('estado', estado);
    if (buscar) q.set('buscar', buscar);
    q.set('pagina', String(pagina));
    api<PaginaTiendasAdmin>(`/admin/stores?${q}`)
      .then((d) => consulta === ultimaConsulta.current && setDatos(d))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [estado, buscar, pagina]);

  useEffect(cargar, [cargar]);

  async function aprobar(t: TiendaAdmin) {
    setOcupada(t.id);
    setError(null);
    try {
      await api(`/admin/stores/${t.id}/estado`, { method: 'PATCH', body: { estado: 'activa' } });
      toast({ titulo: 'Tienda aprobada', texto: `${t.nombre} ya está visible en el sitio.` });
      cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div className="stack">
      <EncabezadoAdmin titulo="Tiendas" descripcion="Seguimiento de las tiendas y sus vendedores." />

      <div className="admin-filtros">
        <div className="tabs" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.label}
              className="tab"
              aria-pressed={estado === f.estado}
              onClick={() => navegar({ estado: f.estado })}
            >
              {f.label}
              {f.estado && datos ? <span className="tab-cuenta">{numero(datos.conteos[f.estado])}</span> : null}
            </button>
          ))}
        </div>
        <Buscador
          valor={buscar}
          placeholder="Nombre, CUIT o correo del dueño"
          onCambio={(texto) => navegar({ buscar: texto })}
        />
      </div>

      {error && <Alert>{error}</Alert>}

      {!datos ? (
        <p>Cargando…</p>
      ) : datos.items.length === 0 ? (
        <EmptyState icono="store" titulo={buscar ? 'No encontramos tiendas' : 'No hay tiendas en este estado'}>
          {buscar ? 'Probá con otro nombre, CUIT o correo.' : 'Cuando haya, van a aparecer acá.'}
        </EmptyState>
      ) : (
        <>
          <p className="muted admin-total">
            {numero(datos.total)} {datos.total === 1 ? 'tienda' : 'tiendas'}
          </p>
          <ListaScroll as="ul" className="admin-lista" etiqueta="Tiendas" key={datos.pagina}>
            {datos.items.map((t) => (
              <li key={t.id} className="card admin-fila">
                <div className="admin-fila-cabecera">
                  <div>
                    <h2>
                      <Link href={`/admin/tiendas/${t.id}`}>{t.nombre}</Link>
                    </h2>
                    <p className="muted">
                      {t.duenio.nombre || 'Sin nombre'} · {t.duenio.email} · {t.localidad}
                    </p>
                  </div>
                  <StoreStatus estado={t.estado} />
                </div>

                <dl className="admin-fila-datos">
                  <div>
                    <dt>Rubro</dt>
                    <dd>
                      {t.rubro ? (
                        <>
                          {t.rubro.nombre}
                          {t.rubro.subrubro && <span className="muted"> · {t.rubro.subrubro}</span>}
                        </>
                      ) : (
                        <span className="badge badge-pendiente">Sin rubro</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Plan</dt>
                    <dd>{t.plan ?? 'Sin plan'}</dd>
                  </div>
                  <div>
                    <dt>Publicados</dt>
                    <dd>
                      {numero(t.productos.publicados)} <span className="muted">de {numero(t.productos.total)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Ventas 30 días</dt>
                    <dd>
                      {formatPrice(Number(t.ventas30.monto))}{' '}
                      <span className="muted">· {numero(t.ventas30.pedidos)} ped.</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Alta</dt>
                    <dd>{formatDate(t.creado_en)}</dd>
                  </div>
                </dl>

                <div className="admin-fila-indicadores">
                  {t.productos.enRevision > 0 && (
                    <Link href={`/admin/productos?tienda=${t.id}`} className="indicador indicador-info">
                      <Icon name="package" size={14} /> {numero(t.productos.enRevision)} en revisión
                    </Link>
                  )}
                  {t.denunciasAbiertas > 0 && (
                    <span className="indicador indicador-alerta">
                      <Icon name="alert" size={14} /> {numero(t.denunciasAbiertas)} denuncias
                    </span>
                  )}
                  {!t.mercadoPagoVinculada && (
                    <span className="indicador">
                      <Icon name="card" size={14} /> Sin Mercado Pago
                    </span>
                  )}
                  {t.revision_productos !== 'automatica' && (
                    <span className="indicador">
                      <Icon name="shield" size={14} />
                      {t.revision_productos === 'siempre' ? 'Revisión de todo' : 'Sin revisión'}
                    </span>
                  )}
                  {t.motivo_estado && (t.estado === 'suspendida' || t.estado === 'archivada') && (
                    <span className="indicador indicador-alerta">Motivo: {t.motivo_estado}</span>
                  )}
                </div>

                <div className="actions">
                  <Link href={`/admin/tiendas/${t.id}`} className="btn btn-secondary">
                    Ver ficha
                  </Link>
                  {t.estado === 'pendiente' &&
                    (t.mercadoPagoVinculada ? (
                      <button className="btn" disabled={ocupada === t.id} onClick={() => aprobar(t)}>
                        Aprobar
                      </button>
                    ) : (
                      <span className="muted">Para aprobarla tiene que vincular Mercado Pago.</span>
                    ))}
                </div>
              </li>
            ))}
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
