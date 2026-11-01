'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, type PaginaPedidosAdmin, type VistaPedidosAdmin } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import { ESTADO_PAGO, MODALIDAD } from '@/lib/pedidos';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { Icon } from '@/components/ui/icon';
import { Buscador, Paginacion, haceCuanto, numero } from '@/components/admin/controles';
import { EstadoPedido, fechaHora } from '@/components/admin/operaciones';

const VISTAS: { vista: VistaPedidosAdmin; label: string; cuenta?: keyof PaginaPedidosAdmin['conteos'] }[] = [
  { vista: 'todos', label: 'Todos' },
  { vista: 'en_curso', label: 'En curso', cuenta: 'en_curso' },
  { vista: 'pendiente_pago', label: 'Esperando el pago', cuenta: 'pendiente_pago' },
  { vista: 'reembolsos', label: 'Reembolsos pendientes', cuenta: 'reembolsos' },
  { vista: 'cancelados', label: 'Con cancelaciones' },
  { vista: 'entregados', label: 'Entregados' },
];

const vistaDeUrl = (valor: string | null): VistaPedidosAdmin =>
  VISTAS.find((v) => v.vista === valor)?.vista ?? 'todos';

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Pedidos />
    </Suspense>
  );
}

function Pedidos() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const vista = vistaDeUrl(params.get('vista'));
  const buscar = params.get('buscar') ?? '';
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);

  const [datos, setDatos] = useState<PaginaPedidosAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navegar = useCallback(
    (cambios: { vista?: VistaPedidosAdmin; buscar?: string; pagina?: number }) => {
      const q = new URLSearchParams();
      const v = cambios.vista ?? vista;
      const b = cambios.buscar ?? buscar;
      const p = cambios.pagina ?? 1;
      if (v !== 'todos') q.set('vista', v);
      if (b) q.set('buscar', b);
      if (p > 1) q.set('pagina', String(p));
      router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [vista, buscar, pathname, router]
  );

  const ultimaConsulta = useRef(0);
  useEffect(() => {
    const consulta = ++ultimaConsulta.current;
    const q = new URLSearchParams({ vista, pagina: String(pagina) });
    if (buscar) q.set('buscar', buscar);
    api<PaginaPedidosAdmin>(`/admin/pedidos?${q}`)
      .then((d) => consulta === ultimaConsulta.current && setDatos(d))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [vista, buscar, pagina]);

  return (
    <div className="stack">
      <EncabezadoAdmin titulo="Pedidos" descripcion="Todas las compras de la plataforma, con el estado de cada tienda." />

      <div className="admin-filtros">
        <div className="tabs" role="group" aria-label="Filtrar pedidos">
          {VISTAS.map((v) => (
            <button
              key={v.vista}
              className="tab"
              aria-pressed={vista === v.vista}
              onClick={() => navegar({ vista: v.vista })}
            >
              {v.label}
              {v.cuenta && datos ? <span className="tab-cuenta">{numero(datos.conteos[v.cuenta])}</span> : null}
            </button>
          ))}
        </div>
        <Buscador
          valor={buscar}
          placeholder="Número (#1001), comprador o tienda"
          onCambio={(texto) => navegar({ buscar: texto })}
        />
      </div>

      {error && <Alert>{error}</Alert>}

      {!datos ? (
        <p>Cargando…</p>
      ) : datos.items.length === 0 ? (
        <EmptyState icono="receipt" titulo={buscar ? 'No encontramos pedidos' : 'No hay pedidos en esta vista'}>
          {buscar ? 'Probá con el número, el correo del comprador o el nombre de la tienda.' : 'Cuando haya, van a aparecer acá.'}
        </EmptyState>
      ) : (
        <>
          <p className="muted admin-total">
            {numero(datos.total)} {datos.total === 1 ? 'pedido' : 'pedidos'}
          </p>
          <ListaScroll as="ul" className="admin-lista" etiqueta="Pedidos" key={datos.pagina}>
            {datos.items.map((p) => (
              <li key={p.id} className="card admin-fila">
                <div className="admin-fila-cabecera">
                  <div>
                    <h2>
                      <Link href={`/admin/pedidos/${p.id}`}>Pedido #{p.numero}</Link>
                    </h2>
                    <p className="muted">
                      {p.comprador.nombre || 'Sin nombre'} · {p.comprador.email} ·{' '}
                      <time dateTime={p.creado_en} title={fechaHora(p.creado_en)}>
                        {haceCuanto(p.creado_en)}
                      </time>
                    </p>
                  </div>
                  <div className="pedido-total">
                    <strong>{formatPrice(Number(p.total))}</strong>
                    <span className="muted">{ESTADO_PAGO[p.estado_pago]}</span>
                  </div>
                </div>

                <ul className="pedido-partes">
                  {p.partes.map((pt) => (
                    <li key={pt.tienda}>
                      <span>
                        <strong>{pt.tienda}</strong> <span className="muted">· {MODALIDAD[pt.modalidad]}</span>
                      </span>
                      <EstadoPedido estado={pt.estado} />
                    </li>
                  ))}
                </ul>

                {Number(p.reembolsoPendiente) > 0 && (
                  <div className="admin-fila-indicadores">
                    <span className="indicador indicador-alerta">
                      <Icon name="card" size={14} /> {formatPrice(Number(p.reembolsoPendiente))} por devolver
                    </span>
                  </div>
                )}
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
