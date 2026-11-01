'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, type ColaModeracion, type ProductoModeracion, type VistaModeracion } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { Price } from '@/components/ui/price';
import { ProductStatus } from '@/components/ui/product-status';
import { Buscador, Paginacion, haceCuanto, numero } from '@/components/admin/controles';

const VISTAS: { vista: VistaModeracion; label: string; vacio: string }[] = [
  { vista: 'todos', label: 'Todos', vacio: 'No hay productos.' },
  { vista: 'revision', label: 'En revisión', vacio: 'No hay productos esperando revisión. ¡Todo al día!' },
  { vista: 'rechazados', label: 'Rechazados', vacio: 'No hay productos rechazados sin corregir.' },
  { vista: 'moderacion', label: 'Pausados por moderación', vacio: 'No hay productos pausados por moderación.' },
  { vista: 'publicados', label: 'Publicados', vacio: 'No hay productos publicados.' },
];

const vistaDeUrl = (valor: string | null): VistaModeracion =>
  VISTAS.find((v) => v.vista === valor)?.vista ?? 'todos';

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Productos />
    </Suspense>
  );
}

function Productos() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const vista = vistaDeUrl(params.get('vista'));
  const tienda = params.get('tienda') ?? '';
  const buscar = params.get('buscar') ?? '';
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);

  const [datos, setDatos] = useState<ColaModeracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const navegar = useCallback(
    (cambios: { vista?: VistaModeracion; tienda?: string; buscar?: string; pagina?: number }) => {
      const q = new URLSearchParams();
      const v = cambios.vista ?? vista;
      const t = cambios.tienda ?? tienda;
      const b = cambios.buscar ?? buscar;
      const p = cambios.pagina ?? 1;
      if (v !== 'todos') q.set('vista', v);
      if (t) q.set('tienda', t);
      if (b) q.set('buscar', b);
      if (p > 1) q.set('pagina', String(p));
      const query = q.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [vista, tienda, buscar, pathname, router]
  );

  const ultimaConsulta = useRef(0);
  const cargar = useCallback(() => {
    const consulta = ++ultimaConsulta.current;
    const q = new URLSearchParams({ vista, pagina: String(pagina) });
    if (tienda) q.set('tienda', tienda);
    if (buscar) q.set('buscar', buscar);
    api<ColaModeracion>(`/admin/products?${q}`)
      .then((d) => consulta === ultimaConsulta.current && setDatos(d))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [vista, tienda, buscar, pagina]);

  useEffect(cargar, [cargar]);

  async function aprobar(p: ProductoModeracion) {
    setOcupado(p.id);
    setError(null);
    try {
      await api(`/admin/products/${p.id}/moderacion`, { method: 'POST', body: { accion: 'aprobar' } });
      toast({ titulo: 'Producto aprobado', texto: `${p.nombre} ya se ve en ${p.tienda.nombre}.` });
      cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(null);
    }
  }

  const actual = VISTAS.find((v) => v.vista === vista)!;
  const conteo = (v: VistaModeracion) =>
    datos && (v === 'revision' || v === 'rechazados' || v === 'moderacion') ? datos.conteos[v] : null;

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Productos y moderación"
        descripcion="Las tiendas nuevas mandan sus primeros productos a revisión antes de mostrarlos."
      />

      <div className="admin-filtros">
        <div className="tabs" role="group" aria-label="Qué productos ver">
          {VISTAS.map((v) => {
            const n = conteo(v.vista);
            return (
              <button key={v.vista} className="tab" aria-pressed={vista === v.vista} onClick={() => navegar({ vista: v.vista })}>
                {v.label}
                {n !== null && <span className="tab-cuenta">{numero(n)}</span>}
              </button>
            );
          })}
        </div>
        <Buscador
          valor={buscar}
          placeholder="Buscar por producto o tienda"
          onCambio={(texto) => navegar({ buscar: texto })}
        />
      </div>

      {datos?.tienda && (
        <p className="chips">
          <span className="chip chip-filtro">
            Tienda: {datos.tienda.nombre}
            <button className="chip-quitar" aria-label="Ver todas las tiendas" onClick={() => navegar({ tienda: '' })}>
              ×
            </button>
          </span>
        </p>
      )}

      {error && <Alert>{error}</Alert>}

      {!datos ? (
        <p>Cargando…</p>
      ) : datos.items.length === 0 ? (
        <EmptyState icono="package" titulo={buscar ? 'No encontramos productos' : actual.label}>
          {buscar ? 'Probá con otro nombre de producto o tienda.' : actual.vacio}
        </EmptyState>
      ) : (
        <>
          <p className="muted admin-total">
            {numero(datos.total)} {datos.total === 1 ? 'producto' : 'productos'}
          </p>
          <ListaScroll as="ul" className="admin-lista" etiqueta="Productos" key={datos.pagina}>
            {datos.items.map((p) => (
              <li key={p.id} className="card moderacion-fila">
                {p.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen} alt="" className="product-thumb" />
                ) : (
                  <div className="product-thumb product-img-vacia">Sin foto</div>
                )}
                <div className="product-row-info">
                  <Link href={`/admin/productos/${p.id}`}>
                    <strong>{p.nombre}</strong>
                  </Link>
                  <span className="muted">
                    <Link href={`/admin/tiendas/${p.tienda.id}`}>{p.tienda.nombre}</Link> · {p.categoria}
                  </span>
                  <Price precio={p.precio} oferta={p.precio_oferta} desde={p.desde} />
                  {p.motivo_pausa === 'revision' && p.revision_desde && (
                    <span className="muted">Enviado {haceCuanto(p.revision_desde)}</span>
                  )}
                  {p.nota_moderacion && (p.motivo_pausa === 'rechazado' || p.motivo_pausa === 'moderacion') && (
                    <p className="nota-moderacion">{p.nota_moderacion}</p>
                  )}
                </div>
                <ProductStatus estado={p.estado} motivo={p.motivo_pausa} />
                <div className="actions">
                  <Link href={`/admin/productos/${p.id}`} className={p.motivo_pausa === 'revision' ? 'btn' : 'btn btn-secondary'}>
                    {p.motivo_pausa === 'revision' ? 'Revisar' : 'Ver detalle'}
                  </Link>
                  {p.motivo_pausa === 'revision' && (
                    <button className="btn btn-secondary" disabled={ocupado === p.id} onClick={() => aprobar(p)}>
                      Aprobar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ListaScroll>
          <Paginacion
            pagina={datos.pagina}
            total={datos.total}
            porPagina={datos.porPagina}
            onCambio={(n) => navegar({ pagina: n })}
          />
        </>
      )}
    </div>
  );
}
