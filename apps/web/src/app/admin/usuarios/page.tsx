'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, type FiltroUsuarios, type PaginaUsuariosAdmin } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { Icon } from '@/components/ui/icon';
import { Buscador, Paginacion, haceCuanto, numero } from '@/components/admin/controles';
import { ROL_LABEL } from '@/components/admin/operaciones';

const FILTROS: { filtro: FiltroUsuarios; label: string }[] = [
  { filtro: 'todos', label: 'Todas' },
  { filtro: 'vendedores', label: 'Vendedores' },
  { filtro: 'compradores', label: 'Compradores' },
  { filtro: 'equipo', label: 'Equipo' },
  { filtro: 'bloqueados', label: 'Bloqueadas' },
];

const filtroDeUrl = (valor: string | null): FiltroUsuarios =>
  FILTROS.find((f) => f.filtro === valor)?.filtro ?? 'todos';

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Usuarios />
    </Suspense>
  );
}

function Usuarios() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filtro = filtroDeUrl(params.get('filtro'));
  const buscar = params.get('buscar') ?? '';
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);

  const [datos, setDatos] = useState<PaginaUsuariosAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navegar = useCallback(
    (cambios: { filtro?: FiltroUsuarios; buscar?: string; pagina?: number }) => {
      const q = new URLSearchParams();
      const f = cambios.filtro ?? filtro;
      const b = cambios.buscar ?? buscar;
      const p = cambios.pagina ?? 1;
      if (f !== 'todos') q.set('filtro', f);
      if (b) q.set('buscar', b);
      if (p > 1) q.set('pagina', String(p));
      router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [filtro, buscar, pathname, router]
  );

  const ultimaConsulta = useRef(0);
  useEffect(() => {
    const consulta = ++ultimaConsulta.current;
    const q = new URLSearchParams({ filtro, pagina: String(pagina) });
    if (buscar) q.set('buscar', buscar);
    api<PaginaUsuariosAdmin>(`/admin/usuarios?${q}`)
      .then((d) => consulta === ultimaConsulta.current && setDatos(d))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [filtro, buscar, pagina]);

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Usuarios"
        descripcion="Cuentas de compradores, vendedores y del equipo de la plataforma."
      />

      <div className="admin-filtros">
        <div className="tabs" role="group" aria-label="Filtrar cuentas">
          {FILTROS.map((f) => (
            <button
              key={f.filtro}
              className="tab"
              aria-pressed={filtro === f.filtro}
              onClick={() => navegar({ filtro: f.filtro })}
            >
              {f.label}
              {datos ? <span className="tab-cuenta">{numero(datos.conteos[f.filtro])}</span> : null}
            </button>
          ))}
        </div>
        <Buscador
          valor={buscar}
          placeholder="Nombre, correo o teléfono"
          onCambio={(texto) => navegar({ buscar: texto })}
        />
      </div>

      {error && <Alert>{error}</Alert>}

      {!datos ? (
        <p>Cargando…</p>
      ) : datos.items.length === 0 ? (
        <EmptyState icono="users" titulo={buscar ? 'No encontramos cuentas' : 'No hay cuentas en este filtro'}>
          {buscar ? 'Probá con otro nombre, correo o teléfono.' : 'Cuando haya, van a aparecer acá.'}
        </EmptyState>
      ) : (
        <>
          <p className="muted admin-total">
            {numero(datos.total)} {datos.total === 1 ? 'cuenta' : 'cuentas'}
          </p>
          <ListaScroll as="ul" className="admin-lista" etiqueta="Cuentas" key={datos.pagina}>
            {datos.items.map((u) => (
              <li key={u.id} className="card admin-fila">
                <div className="admin-fila-cabecera">
                  <div>
                    <h2>
                      <Link href={`/admin/usuarios/${u.id}`}>{u.nombre || u.email || 'Sin nombre'}</Link>
                    </h2>
                    <p className="muted">
                      {u.email}
                      {u.telefono ? ` · ${u.telefono}` : ''}
                    </p>
                  </div>
                  {u.bloqueo ? (
                    <span className="badge badge-suspendida">Bloqueada</span>
                  ) : (
                    <span className="badge badge-activa">Activa</span>
                  )}
                </div>

                <dl className="admin-fila-datos">
                  <div>
                    <dt>Tiendas</dt>
                    <dd>{numero(u.tiendas)}</dd>
                  </div>
                  <div>
                    <dt>Compras pagadas</dt>
                    <dd>{numero(u.compras)}</dd>
                  </div>
                  <div>
                    <dt>Último ingreso</dt>
                    <dd>{u.ultimo_ingreso ? haceCuanto(u.ultimo_ingreso) : 'Sin registro'}</dd>
                  </div>
                  <div>
                    <dt>Alta</dt>
                    <dd>{formatDate(u.creado_en)}</dd>
                  </div>
                </dl>

                <div className="admin-fila-indicadores">
                  {u.roles.map((r) => (
                    <span key={r} className="indicador indicador-info">
                      <Icon name="shieldAdmin" size={14} /> {ROL_LABEL[r]}
                    </span>
                  ))}
                  {u.bloqueo && (
                    <span className="indicador indicador-alerta">
                      <Icon name="lock" size={14} /> Desde el {formatDate(u.bloqueo.desde)}: {u.bloqueo.motivo}
                    </span>
                  )}
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
