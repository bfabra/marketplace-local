'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ApiError,
  api,
  type ExportacionActividad,
  type MovimientoAuditoria,
  type PaginaActividad,
  type ResumenActividad,
} from '@/lib/api-client';
import { iniciales, plural } from '@/lib/visual';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Buscador } from '@/components/admin/controles';
import { EncabezadoAdmin } from '@/components/admin/encabezado';

const ENTIDADES: Record<string, { nombre: string; articulo: string }> = {
  tiendas: { nombre: 'Tiendas', articulo: 'la tienda' },
  productos: { nombre: 'Productos', articulo: 'el producto' },
  variantes: { nombre: 'Variantes (precio y stock)', articulo: 'una variante' },
  planes: { nombre: 'Planes', articulo: 'el plan' },
  suscripciones: { nombre: 'Suscripciones', articulo: 'una suscripción' },
  pagos_suscripcion: { nombre: 'Pagos de suscripciones', articulo: 'un pago de suscripción' },
  bloqueos_cuenta: { nombre: 'Bloqueos de cuentas', articulo: 'un bloqueo de cuenta' },
  reembolsos: { nombre: 'Reembolsos', articulo: 'un reembolso' },
  roles_plataforma: { nombre: 'Roles de plataforma', articulo: 'el rol de plataforma' },
  miembros_tienda: { nombre: 'Equipos de tiendas', articulo: 'un integrante de equipo' },
  roles_tienda: { nombre: 'Roles de tiendas', articulo: 'el rol de tienda' },
  roles_permisos: { nombre: 'Permisos de roles', articulo: 'un permiso de rol' },
  configuracion: { nombre: 'Configuración', articulo: 'el parámetro' },
  tarifas_envio: { nombre: 'Tarifas de envío', articulo: 'una tarifa de envío' },
  repartidores: { nombre: 'Repartidores', articulo: 'un repartidor' },
  categorias: { nombre: 'Categorías', articulo: 'la categoría' },
  rubros: { nombre: 'Rubros', articulo: 'el rubro' },
  categorias_atributos: { nombre: 'Atributos de categorías', articulo: 'un atributo de categoría' },
  atributos: { nombre: 'Atributos', articulo: 'el atributo' },
  atributo_opciones: { nombre: 'Opciones de atributos', articulo: 'una opción de atributo' },
  provincias: { nombre: 'Provincias', articulo: 'la provincia' },
  localidades: { nombre: 'Localidades', articulo: 'la localidad' },
};

type Accion = MovimientoAuditoria['accion'];

const VERBO = { INSERT: 'creó', UPDATE: 'modificó', DELETE: 'eliminó' } as const;
const ACCION = {
  INSERT: { label: 'Alta', icono: 'plus' },
  UPDATE: { label: 'Cambio', icono: 'pencil' },
  DELETE: { label: 'Baja', icono: 'trash' },
} as const satisfies Record<Accion, { label: string; icono: IconName }>;
const ACCIONES: { valor: Accion | ''; label: string }[] = [
  { valor: '', label: 'Todas' },
  { valor: 'INSERT', label: 'Altas' },
  { valor: 'UPDATE', label: 'Cambios' },
  { valor: 'DELETE', label: 'Bajas' },
];

type Periodo = 'todo' | 'hoy' | '7d' | '30d' | 'mes' | 'rango';
const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 'todo', label: 'Todo' },
  { valor: 'hoy', label: 'Hoy' },
  { valor: '7d', label: 'Últimos 7 días' },
  { valor: '30d', label: 'Últimos 30 días' },
  { valor: 'mes', label: 'Este mes' },
  { valor: 'rango', label: 'Elegir fechas' },
];

const MAX_CAMBIOS = 6;

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
const numero = (n: number) => n.toLocaleString('es-AR');

/** "2026-10-02" como medianoche en la hora de quien mira. */
function diaLocal(valor: string) {
  const [a, m, d] = valor.split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
}

function aTexto(fecha: Date) {
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${m}-${d}`;
}

function sumarDias(fecha: Date, dias: number) {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/** Instantes [desde, hasta) del período; "hasta" no se incluye. */
function rangoDe(periodo: Periodo, desde: string, hasta: string): { desde?: Date; hasta?: Date; error?: string } {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = sumarDias(hoy, 1);
  switch (periodo) {
    case 'hoy':
      return { desde: hoy, hasta: manana };
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: manana };
    case '30d':
      return { desde: sumarDias(hoy, -29), hasta: manana };
    case 'mes':
      return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: manana };
    case 'rango': {
      const d = diaLocal(desde);
      const h = diaLocal(hasta);
      if (d && h && d > h) return { error: 'La fecha "desde" tiene que ser anterior o igual a la fecha "hasta".' };
      return { desde: d ?? undefined, hasta: h ? sumarDias(h, 1) : undefined };
    }
    default:
      return {};
  }
}

function diaDe(iso: string) {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = sumarDias(hoy, -1);
  if (fecha.toDateString() === hoy.toDateString()) return 'Hoy';
  if (fecha.toDateString() === ayer.toDateString()) return 'Ayer';
  return fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: fecha.getFullYear() === hoy.getFullYear() ? undefined : 'numeric',
  });
}

function valorCompleto(v: unknown) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function valorCorto(v: unknown) {
  const texto = valorCompleto(v);
  return texto.length > 60 ? `${texto.slice(0, 57)}…` : texto;
}

const autorDe = (m: MovimientoAuditoria) => (m.actor ? m.actor.nombre ?? m.actor.email ?? 'Alguien' : 'El sistema');

function Movimiento({ m }: { m: MovimientoAuditoria }) {
  const [todos, setTodos] = useState(false);
  const autor = autorDe(m);
  const entidad = ENTIDADES[m.entidad];
  const cambios = m.cambios ?? [];
  const visibles = todos ? cambios : cambios.slice(0, MAX_CAMBIOS);
  const accion = ACCION[m.accion];

  return (
    <li className={`movimiento movimiento-${m.accion.toLowerCase()}`}>
      <span className={m.actor ? 'avatar movimiento-avatar' : 'avatar movimiento-avatar movimiento-sistema'} aria-hidden="true">
        {m.actor ? iniciales(autor) : <Icon name="sparkles" size={16} />}
      </span>
      <div className="movimiento-cuerpo">
        <div className="movimiento-cabecera">
          <p>
            <strong>{autor}</strong> {VERBO[m.accion]} {entidad?.articulo ?? m.entidad}
            {m.referencia && <strong className="movimiento-ref"> «{m.referencia}»</strong>}
          </p>
          <time dateTime={m.creado_en} title={new Date(m.creado_en).toLocaleString('es-AR')}>
            {hora(m.creado_en)}
          </time>
        </div>
        <div className="movimiento-etiquetas">
          <span className="movimiento-accion">
            <Icon name={accion.icono} size={12} /> {accion.label}
          </span>
          <span className="tag tag-suave">{entidad?.nombre ?? m.entidad}</span>
          {m.tienda && m.entidad !== 'tiendas' && (
            <span className="movimiento-tienda">
              <Icon name="store" size={13} /> {m.tienda.nombre}
            </span>
          )}
          {m.actor?.email && m.actor.nombre && <span className="movimiento-correo">{m.actor.email}</span>}
        </div>
        {cambios.length > 0 && (
          <ul className="movimiento-cambios">
            {visibles.map((c) => (
              <li key={c.campo}>
                <code>{c.campo}</code>
                <span className="movimiento-antes" title={valorCompleto(c.antes)}>
                  {todos ? valorCompleto(c.antes) : valorCorto(c.antes)}
                </span>
                <span className="movimiento-flecha" aria-label="pasó a">
                  →
                </span>
                <span className="movimiento-despues" title={valorCompleto(c.despues)}>
                  {todos ? valorCompleto(c.despues) : valorCorto(c.despues)}
                </span>
              </li>
            ))}
            {cambios.length > MAX_CAMBIOS && (
              <li className="movimiento-mas-cambios">
                <button type="button" className="btn-link" onClick={() => setTodos((t) => !t)}>
                  {todos ? 'Ver menos' : `Ver los ${cambios.length - MAX_CAMBIOS} cambios más`}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

function Cifra({ icono, valor, label }: { icono: IconName; valor: number; label: string }) {
  return (
    <div className="card pt-cifra">
      <span className="pt-cifra-icono" aria-hidden="true">
        <Icon name={icono} size={20} />
      </span>
      <strong>{numero(valor)}</strong>
      <span className="pt-cifra-label">{label}</span>
    </div>
  );
}

const celda = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function aCsv(items: MovimientoAuditoria[]) {
  const filas = [
    ['Fecha', 'Hora', 'Autor', 'Correo', 'Acción', 'Sección', 'Referencia', 'Tienda', 'Cambios'],
    ...items.map((m) => {
      const fecha = new Date(m.creado_en);
      return [
        fecha.toLocaleDateString('es-AR'),
        fecha.toLocaleTimeString('es-AR'),
        autorDe(m),
        m.actor?.email ?? '',
        ACCION[m.accion].label,
        ENTIDADES[m.entidad]?.nombre ?? m.entidad,
        m.referencia ?? m.entidad_id ?? '',
        m.tienda?.nombre ?? '',
        (m.cambios ?? []).map((c) => `${c.campo}: ${valorCompleto(c.antes)} → ${valorCompleto(c.despues)}`).join(' | '),
      ];
    }),
  ];
  return '\uFEFF' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
}

export default function AdminActivityPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Actividad />
    </Suspense>
  );
}

function Actividad() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const entidad = ENTIDADES[params.get('entidad') ?? ''] ? params.get('entidad')! : '';
  const accion = (ACCIONES.find((a) => a.valor === params.get('accion'))?.valor ?? '') as Accion | '';
  const origen = ['personas', 'sistema'].includes(params.get('origen') ?? '') ? params.get('origen')! : '';
  const periodo = (PERIODOS.find((p) => p.valor === params.get('periodo'))?.valor ?? 'todo') as Periodo;
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') ?? '';
  const buscar = params.get('buscar') ?? '';

  const rango = useMemo(() => rangoDe(periodo, desde, hasta), [periodo, desde, hasta]);
  const filtrado = Boolean(entidad || accion || origen || periodo !== 'todo' || buscar);

  const [items, setItems] = useState<MovimientoAuditoria[] | null>(null);
  const [resumen, setResumen] = useState<ResumenActividad | null>(null);
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ultimaConsulta = useRef(0);

  const navegar = useCallback(
    (cambios: Record<string, string>) => {
      const q = new URLSearchParams(params.toString());
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor) q.set(clave, valor);
        else q.delete(clave);
      }
      if (q.get('periodo') === 'todo') q.delete('periodo');
      if (q.get('periodo') !== 'rango') {
        q.delete('desde');
        q.delete('hasta');
      }
      router.replace(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const filtros = useCallback(() => {
    const q = new URLSearchParams();
    if (entidad) q.set('entidad', entidad);
    if (accion) q.set('accion', accion);
    if (origen) q.set('origen', origen);
    if (rango.desde) q.set('desde', rango.desde.toISOString());
    if (rango.hasta) q.set('hasta', rango.hasta.toISOString());
    if (buscar) q.set('buscar', buscar);
    return q;
  }, [entidad, accion, origen, rango, buscar]);

  const cargar = useCallback(
    async (antes: number | null) => {
      const consulta = ++ultimaConsulta.current;
      setCargando(true);
      setError(null);
      const q = filtros();
      if (antes) q.set('antes', String(antes));
      try {
        const pagina = await api<PaginaActividad>(`/admin/actividad?${q}`);
        if (consulta !== ultimaConsulta.current) return;
        setItems((prev) => (antes && prev ? [...prev, ...pagina.items] : pagina.items));
        if (pagina.resumen) setResumen(pagina.resumen);
        setSiguiente(pagina.siguiente);
      } catch (e) {
        if (consulta === ultimaConsulta.current) setError(e instanceof ApiError ? e.message : 'Error inesperado');
      } finally {
        if (consulta === ultimaConsulta.current) setCargando(false);
      }
    },
    [filtros]
  );

  useEffect(() => {
    if (rango.error) return;
    setItems(null);
    setResumen(null);
    cargar(null);
  }, [cargar, rango.error]);

  async function exportar() {
    setExportando(true);
    try {
      const datos = await api<ExportacionActividad>(`/admin/actividad/exportar?${filtros()}`);
      const url = URL.createObjectURL(new Blob([aCsv(datos.items)], { type: 'text/csv;charset=utf-8' }));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `actividad_${aTexto(new Date())}.csv`;
      enlace.click();
      URL.revokeObjectURL(url);
      toast(
        datos.recortado
          ? { tipo: 'info', titulo: 'Se exportaron los 5.000 más recientes', texto: 'Acotá el período para bajar el resto.' }
          : { tipo: 'exito', titulo: 'Exportación lista', texto: plural(datos.items.length, 'movimiento', 'movimientos') }
      );
    } catch (e) {
      toast({ tipo: 'error', titulo: 'No se pudo exportar', texto: e instanceof ApiError ? e.message : undefined });
    } finally {
      setExportando(false);
    }
  }

  const hoyTexto = aTexto(new Date());

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Actividad"
        descripcion="Auditoría de la plataforma: quién cambió qué y cuándo. El registro no se puede editar ni borrar."
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={exportar}
          disabled={exportando || !resumen?.total}
        >
          <Icon name="download" size={16} /> {exportando ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </EncabezadoAdmin>

      <section className="card actividad-filtros" aria-label="Filtros">
        <div className="actividad-periodo">
          <span className="actividad-etiqueta">
            <Icon name="clock" size={15} /> Período
          </span>
          <div className="tabs" role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                className="tab"
                aria-pressed={periodo === p.valor}
                onClick={() =>
                  navegar(
                    p.valor === 'rango'
                      ? { periodo: 'rango', desde: desde || aTexto(sumarDias(new Date(), -6)), hasta: hasta || hoyTexto }
                      : { periodo: p.valor }
                  )
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'rango' && (
            <div className="actividad-fechas">
              <label className="field">
                <span>Desde</span>
                <input
                  type="date"
                  value={desde}
                  max={hasta || hoyTexto}
                  onChange={(e) => navegar({ desde: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={hasta}
                  min={desde || undefined}
                  max={hoyTexto}
                  onChange={(e) => navegar({ hasta: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>

        <div className="actividad-controles">
          <label className="field">
            <span>Sección</span>
            <select value={entidad} onChange={(e) => navegar({ entidad: e.target.value })}>
              <option value="">Todas</option>
              {Object.entries(ENTIDADES)
                .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'))
                .map(([clave, e]) => (
                  <option key={clave} value={clave}>
                    {e.nombre}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Acción</span>
            <select value={accion} onChange={(e) => navegar({ accion: e.target.value })}>
              {ACCIONES.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Hecho por</span>
            <select value={origen} onChange={(e) => navegar({ origen: e.target.value })}>
              <option value="">Personas y sistema</option>
              <option value="personas">Solo personas</option>
              <option value="sistema">Solo el sistema</option>
            </select>
          </label>
          <div className="field actividad-buscar">
            <span>Buscar</span>
            <Buscador
              valor={buscar}
              placeholder="Persona, correo, tienda o referencia"
              onCambio={(texto) => navegar({ buscar: texto })}
            />
          </div>
        </div>

        {filtrado && (
          <div className="actividad-limpiar">
            <button type="button" className="btn btn-ghost" onClick={() => router.replace(pathname, { scroll: false })}>
              <Icon name="x" size={15} /> Quitar filtros
            </button>
          </div>
        )}
      </section>

      {rango.error && <Alert>{rango.error}</Alert>}
      {error && <Alert>{error}</Alert>}

      {resumen && resumen.total > 0 && (
        <section className="pt-cifras actividad-cifras" aria-label="Resumen del filtro">
          <Cifra icono="history" valor={resumen.total} label={resumen.total === 1 ? 'Movimiento' : 'Movimientos'} />
          <Cifra icono="plus" valor={resumen.altas} label="Altas" />
          <Cifra icono="pencil" valor={resumen.cambios} label="Cambios" />
          <Cifra icono="trash" valor={resumen.bajas} label="Bajas" />
          <Cifra icono="users" valor={resumen.personas} label={resumen.personas === 1 ? 'Persona' : 'Personas'} />
        </section>
      )}

      {rango.error ? null : !items ? (
        <PageSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icono="history" titulo={filtrado ? 'No hay movimientos con estos filtros' : 'Sin movimientos'}>
          {filtrado
            ? 'Probá con otro período o quitá algún filtro.'
            : 'Todavía no hay cambios registrados en la plataforma.'}
        </EmptyState>
      ) : (
        <section className="card stack">
          <div className="tarjeta-cabecera">
            <span className="icono-suave" aria-hidden="true">
              <Icon name="history" size={20} />
            </span>
            <div>
              <h2>{entidad ? ENTIDADES[entidad]?.nombre : 'Todos los movimientos'}</h2>
              <p>
                {resumen
                  ? `Mostrando ${numero(items.length)} de ${numero(resumen.total)}`
                  : plural(items.length, 'movimiento cargado', 'movimientos cargados')}
                {resumen?.sistema ? ` · ${plural(resumen.sistema, 'hecho', 'hechos')} por el sistema` : ''}
              </p>
            </div>
          </div>
          <ListaScroll as="ul" className="movimientos" etiqueta="Movimientos registrados">
            {items.map((m, i) => {
              const dia = diaDe(m.creado_en);
              const nuevoDia = i === 0 || diaDe(items[i - 1].creado_en) !== dia;
              return (
                <Fragment key={m.id}>
                  {nuevoDia && (
                    <li className="movimientos-dia" aria-hidden="true">
                      <span>{dia}</span>
                    </li>
                  )}
                  <Movimiento m={m} />
                </Fragment>
              );
            })}
          </ListaScroll>
          {siguiente && (
            <div className="actions movimientos-mas">
              <button className="btn btn-secondary" onClick={() => cargar(siguiente)} disabled={cargando}>
                {cargando ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
