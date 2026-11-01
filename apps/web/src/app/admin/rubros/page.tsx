'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type RubroLista, type RubrosAdmin } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { visualCategoria } from '@/lib/visual';
import { Alert } from '@/components/ui/alert';
import { Icon, type IconName } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { BotonConfirmar, Buscador, EditarTexto, numero } from '@/components/admin/controles';

type Nodo = RubroLista & { hijos: Nodo[] };

const NIVEL: Record<1 | 2 | 3, { uno: string; varios: string; hijo?: string }> = {
  1: { uno: 'rubro', varios: 'rubros', hijo: 'Subrubro' },
  2: { uno: 'subrubro', varios: 'subrubros', hijo: 'Especialidad' },
  3: { uno: 'especialidad', varios: 'especialidades' },
};

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function armarArbol(lista: RubroLista[]): Nodo[] {
  const nodos = new Map<string, Nodo>(lista.map((r) => [r.id, { ...r, hijos: [] }]));
  const raices: Nodo[] = [];
  for (const n of nodos.values()) {
    const padre = n.padre_id ? nodos.get(n.padre_id) : undefined;
    (padre ? padre.hijos : raices).push(n);
  }
  const ordenar = (ns: Nodo[]) => {
    ns.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
    ns.forEach((n) => ordenar(n.hijos));
  };
  ordenar(raices);
  return raices;
}

/** Deja los nodos que coinciden con la búsqueda, con su camino desde la raíz. */
function filtrar(nodos: Nodo[], q: string): Nodo[] {
  if (!q) return nodos;
  return nodos.flatMap((n) => {
    if (normalizar(n.nombre).includes(q)) return [n];
    const hijos = filtrar(n.hijos, q);
    return hijos.length ? [{ ...n, hijos }] : [];
  });
}

const mensaje = (e: unknown) => (e instanceof ApiError ? e.message : 'Error inesperado');

export default function AdminRubrosPage() {
  const toast = useToast();
  const [datos, setDatos] = useState<RubrosAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [buscar, setBuscar] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  /** undefined: ninguno; null: rubro principal; id: dentro de ese rubro. */
  const [agregando, setAgregando] = useState<string | null | undefined>(undefined);

  const cargar = useCallback(() => {
    api<RubrosAdmin>('/admin/rubros')
      .then(setDatos)
      .catch((e) => setError(mensaje(e)));
  }, []);

  useEffect(cargar, [cargar]);

  const arbol = useMemo(() => (datos ? armarArbol(datos.rubros) : []), [datos]);
  const q = normalizar(buscar);
  const visibles = useMemo(() => filtrar(arbol, q), [arbol, q]);

  const cuenta = (nivel: 1 | 2 | 3) => datos?.rubros.filter((r) => r.nivel === nivel).length ?? 0;
  const inactivos = datos?.rubros.filter((r) => !r.activo).length ?? 0;

  async function accion(id: string, pedido: () => Promise<RubrosAdmin>, aviso?: { titulo: string; texto?: string }) {
    setOcupado(id);
    setError(null);
    try {
      setDatos(await pedido());
      if (aviso) toast(aviso);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setOcupado(null);
    }
  }

  const alternar = (id: string) =>
    setAbiertos((a) => {
      const b = new Set(a);
      if (b.has(id)) b.delete(id);
      else b.add(id);
      return b;
    });

  const acciones: Acciones = {
    ocupado,
    editando,
    agregando,
    abierto: (id) => !!q || abiertos.has(id),
    alternar,
    mover: (n, direccion) =>
      accion(n.id, () => api(`/admin/rubros/${n.id}/orden`, { method: 'PATCH', body: { direccion } })),
    activar: (n, activa) =>
      accion(
        n.id,
        () => api(`/admin/rubros/${n.id}/activa`, { method: 'PATCH', body: { activa } }),
        activa
          ? { titulo: `${n.nombre} vuelve a ofrecerse` }
          : { titulo: `${n.nombre} ya no se ofrece`, texto: 'Las tiendas que lo tienen lo conservan.' }
      ),
    borrar: (n) =>
      accion(n.id, () => api(`/admin/rubros/${n.id}`, { method: 'DELETE' }), { titulo: `${n.nombre} se borró` }),
    renombrar: async (n, nombre) => {
      setDatos(await api<RubrosAdmin>(`/admin/rubros/${n.id}`, { method: 'PUT', body: { nombre } }));
      setEditando(null);
      toast({ titulo: 'Nombre actualizado', texto: `Ahora se llama ${nombre}.` });
    },
    describir: async (n, descripcion) => {
      setDatos(await api<RubrosAdmin>(`/admin/rubros/${n.id}`, { method: 'PUT', body: { descripcion } }));
      setEditando(null);
      toast({
        titulo: descripcion ? 'Descripción actualizada' : 'Descripción quitada',
        texto: descripcion ? undefined : 'Se arma sola con los primeros subrubros.',
      });
    },
    editar: setEditando,
    agregar: (padre) => {
      setAgregando(padre);
      if (padre) setAbiertos((a) => new Set(a).add(padre));
    },
    cancelarAgregar: () => setAgregando(undefined),
    creado: (nuevos, nombre) => {
      setDatos(nuevos);
      setAgregando(undefined);
      toast({ titulo: 'Agregado', texto: `${nombre} ya se puede elegir en el formulario de las tiendas.` });
    },
  };

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Rubros"
        descripcion="El estándar para clasificar las tiendas: rubro principal (obligatorio), subrubro y especialidades (opcionales)."
      >
        {agregando !== null && (
          <button className="btn" onClick={() => acciones.agregar(null)}>
            <Icon name="plus" size={18} /> Nuevo rubro
          </button>
        )}
      </EncabezadoAdmin>

      {error && <Alert>{error}</Alert>}

      {datos && (
        <section className="pt-cifras rubros-cifras" aria-label="Resumen de rubros">
          <Cifra icono="grid" valor={cuenta(1)} label="Rubros" />
          <Cifra icono="tag" valor={cuenta(2)} label="Subrubros" />
          <Cifra icono="sparkles" valor={cuenta(3)} label="Especialidades" />
          <Cifra
            icono="alert"
            valor={datos.sinRubro}
            label={datos.sinRubro === 1 ? 'Tienda sin rubro' : 'Tiendas sin rubro'}
            destacar={datos.sinRubro > 0}
          />
        </section>
      )}

      <details className="card rubros-ayuda">
        <summary>
          <Icon name="info" size={18} /> Cómo funcionan
        </summary>
        <ul>
          <li>Cada tienda elige un rubro principal al darse de alta; el subrubro y las especialidades son opcionales.</li>
          <li>Las especialidades se muestran solo en los subrubros que las tienen (por ejemplo, Alquileres → Inmuebles).</li>
          <li>
            Desactivar deja de ofrecerlo, con todo lo que tiene adentro. Las tiendas que ya lo eligieron lo conservan.
          </li>
          <li>Solo se borra lo que no tiene nada adentro y ninguna tienda usa (sirve para corregir una carga equivocada).</li>
          <li>Renombrar no cambia la dirección web interna, así que no rompe enlaces ni colores.</li>
          <li>
            La descripción de cada rubro principal se ve en la página pública de rubros. Si la dejás vacía, se arma sola
            con los primeros subrubros.
          </li>
        </ul>
      </details>

      {agregando === null && datos && (
        <NuevoRubro padre={null} onCancelar={acciones.cancelarAgregar} onCreado={acciones.creado} />
      )}

      {!datos ? (
        <p>Cargando…</p>
      ) : arbol.length === 0 ? (
        <EmptyState icono="grid" titulo="Todavía no hay rubros">
          Creá el primero para que las tiendas puedan clasificarse.
        </EmptyState>
      ) : (
        <>
          <div className="rubros-barra">
            <Buscador valor={buscar} placeholder="Buscar rubro, subrubro o especialidad" onCambio={setBuscar} />
            <p className="muted admin-total">
              {inactivos > 0 && `${numero(inactivos)} ${inactivos === 1 ? 'inactivo' : 'inactivos'} · `}
              {q ? `${numero(visibles.length)} con coincidencias` : 'Tocá un rubro para ver lo que tiene adentro'}
            </p>
          </div>
          {visibles.length === 0 ? (
            <EmptyState icono="search" titulo="Sin coincidencias">
              Probá con otra palabra.
            </EmptyState>
          ) : (
            <div className="card cat-arbol-card">
              <ListaScroll etiqueta="Árbol de rubros">
                <Ramas nodos={visibles} a={acciones} />
              </ListaScroll>
            </div>
          )}
          {datos.sinRubro > 0 && (
            <p className="muted">
              Las tiendas sin rubro ven un aviso en su panel para elegirlo.{' '}
              <Link href="/admin/tiendas">Ver tiendas</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Cifra({ icono, valor, label, destacar }: { icono: IconName; valor: number; label: string; destacar?: boolean }) {
  return (
    <div className={destacar ? 'card pt-cifra rubros-cifra-alerta' : 'card pt-cifra'}>
      <span className="pt-cifra-icono" aria-hidden="true">
        <Icon name={icono} size={20} />
      </span>
      <strong>{numero(valor)}</strong>
      <span className="pt-cifra-label">{label}</span>
    </div>
  );
}

interface Acciones {
  ocupado: string | null;
  editando: string | null;
  agregando: string | null | undefined;
  abierto: (id: string) => boolean;
  alternar: (id: string) => void;
  mover: (n: Nodo, direccion: 'subir' | 'bajar') => void;
  activar: (n: Nodo, activa: boolean) => Promise<void>;
  borrar: (n: Nodo) => Promise<void>;
  renombrar: (n: Nodo, nombre: string) => Promise<void>;
  describir: (n: Nodo, descripcion: string) => Promise<void>;
  /** id del rubro, o `descripcion:id` para editar su descripción. */
  editar: (id: string | null) => void;
  agregar: (padre: string | null) => void;
  cancelarAgregar: () => void;
  creado: (datos: RubrosAdmin, nombre: string) => void;
}

function Ramas({ nodos, a }: { nodos: Nodo[]; a: Acciones }) {
  return (
    <ul className="cat-arbol rubros-arbol">
      {nodos.map((n, i) => {
        const abierto = n.hijos.length > 0 && a.abierto(n.id);
        const tipo = NIVEL[n.nivel];
        const hijos = n.hijos.length;
        const visual = n.nivel === 1 ? visualCategoria(n.slug) : null;
        return (
          <li key={n.id}>
            <div className={`rubro-nodo rubro-nivel-${n.nivel}${n.activo ? '' : ' rubro-inactivo'}`}>
              <span className="cat-orden">
                <button
                  className="icon-btn icon-btn-sm"
                  aria-label={`Subir ${n.nombre}`}
                  title="Subir"
                  disabled={i === 0 || a.ocupado !== null}
                  onClick={() => a.mover(n, 'subir')}
                >
                  <Icon name="chevron-up" size={16} />
                </button>
                <button
                  className="icon-btn icon-btn-sm"
                  aria-label={`Bajar ${n.nombre}`}
                  title="Bajar"
                  disabled={i === nodos.length - 1 || a.ocupado !== null}
                  onClick={() => a.mover(n, 'bajar')}
                >
                  <Icon name="chevron-down" size={16} />
                </button>
              </span>

              {visual && (
                <span className="rubro-icono" style={{ background: visual.tono.bg, color: visual.tono.fg }} aria-hidden>
                  <Icon name={visual.icono} size={18} />
                </span>
              )}

              <span className="rubro-info">
                {a.editando === n.id ? (
                  <EditarTexto
                    valor={n.nombre}
                    label={`Nuevo nombre de ${n.nombre}`}
                    maxLength={80}
                    onGuardar={(nombre) => a.renombrar(n, nombre)}
                    onCancelar={() => a.editar(null)}
                  />
                ) : hijos > 0 ? (
                  <button
                    type="button"
                    className="rubro-nombre"
                    aria-expanded={abierto}
                    onClick={() => a.alternar(n.id)}
                  >
                    <Icon name={abierto ? 'chevron-down' : 'chevron-right'} size={16} />
                    <strong>{n.nombre}</strong>
                  </button>
                ) : (
                  <strong className="rubro-nombre-hoja">{n.nombre}</strong>
                )}
                {n.nivel === 1 &&
                  (a.editando === `descripcion:${n.id}` ? (
                    <EditarTexto
                      valor={n.descripcion ?? ''}
                      label={`Descripción de ${n.nombre}`}
                      maxLength={120}
                      minLength={0}
                      onGuardar={(descripcion) => a.describir(n, descripcion)}
                      onCancelar={() => a.editar(null)}
                    />
                  ) : (
                    <span className={n.descripcion ? 'rubro-descripcion' : 'rubro-descripcion rubro-descripcion-vacia'}>
                      {n.descripcion ?? 'Sin descripción: se arma con los primeros subrubros'}
                    </span>
                  ))}
                <span className="muted">
                  {hijos > 0 && `${numero(hijos)} ${hijos === 1 ? NIVEL[(n.nivel + 1) as 2 | 3].uno : NIVEL[(n.nivel + 1) as 2 | 3].varios} · `}
                  {n.tiendas === 0 ? 'Sin tiendas' : `${numero(n.tiendas)} ${n.tiendas === 1 ? 'tienda' : 'tiendas'}`}
                </span>
              </span>

              {!n.activo && <span className="badge badge-archivada">Inactivo</span>}

              {a.editando !== n.id && a.editando !== `descripcion:${n.id}` && (
                <span className="rubro-acciones">
                  {tipo.hijo && (
                    <button
                      type="button"
                      className="btn btn-ghost rubro-btn"
                      aria-label={`Agregar ${tipo.hijo.toLowerCase()} a ${n.nombre}`}
                      onClick={() => a.agregar(n.id)}
                    >
                      <Icon name="plus" size={16} /> {tipo.hijo}
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    aria-label={`Renombrar ${n.nombre}`}
                    title="Renombrar"
                    onClick={() => a.editar(n.id)}
                  >
                    <Icon name="pencil" size={16} />
                  </button>
                  {n.nivel === 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost rubro-btn"
                      aria-label={`Editar la descripción de ${n.nombre}`}
                      onClick={() => a.editar(`descripcion:${n.id}`)}
                    >
                      Descripción
                    </button>
                  )}
                  {n.activo ? (
                    <BotonConfirmar
                      label="Desactivar"
                      className="btn btn-ghost rubro-btn"
                      pregunta={hijos > 0 ? `¿Desactivar ${n.nombre} y todo lo que tiene adentro?` : `¿Desactivar ${n.nombre}?`}
                      confirmar="Desactivar"
                      disabled={a.ocupado !== null}
                      onConfirmar={() => a.activar(n, false)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost rubro-btn"
                      disabled={a.ocupado !== null}
                      onClick={() => a.activar(n, true)}
                    >
                      Activar
                    </button>
                  )}
                  {hijos === 0 && n.tiendas === 0 && (
                    <BotonConfirmar
                      label={<Icon name="trash" size={16} />}
                      className="icon-btn icon-btn-sm"
                      pregunta={`¿Borrar ${n.nombre}?`}
                      confirmar="Borrar"
                      peligro
                      disabled={a.ocupado !== null}
                      onConfirmar={() => a.borrar(n)}
                    />
                  )}
                </span>
              )}
            </div>

            {a.agregando === n.id && (
              <NuevoRubro padre={n} onCancelar={a.cancelarAgregar} onCreado={a.creado} />
            )}
            {abierto && <Ramas nodos={n.hijos} a={a} />}
          </li>
        );
      })}
    </ul>
  );
}

function NuevoRubro({
  padre,
  onCancelar,
  onCreado,
}: {
  padre: Nodo | null;
  onCancelar: () => void;
  onCreado: (datos: RubrosAdmin, nombre: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.focus(), []);

  const etiqueta = !padre
    ? 'Nuevo rubro principal'
    : padre.nivel === 1
      ? `Nuevo subrubro en ${padre.nombre}`
      : `Nueva especialidad en ${padre.nombre}`;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpio = nombre.trim();
    if (limpio.length < 2) {
      setError('El nombre tiene que tener al menos 2 caracteres.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const datos = await api<RubrosAdmin>('/admin/rubros', {
        method: 'POST',
        body: { nombre: limpio, padre_id: padre?.id ?? null },
      });
      onCreado(datos, limpio);
    } catch (err) {
      setError(mensaje(err));
      setEnviando(false);
    }
  }

  return (
    <form className={padre ? 'rubro-nuevo rubro-nuevo-dentro' : 'card rubro-nuevo'} onSubmit={enviar} noValidate>
      <label className="field">
        <span>{etiqueta}</span>
        <input
          ref={ref}
          value={nombre}
          maxLength={80}
          aria-invalid={!!error}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
        />
        {error && <small className="field-error">{error}</small>}
      </label>
      {padre && !padre.activo && (
        <p className="aviso-banda">
          <Icon name="info" size={18} />
          {padre.nombre} está inactivo, así que lo nuevo también nace inactivo.
        </p>
      )}
      <div className="actions">
        <button className="btn" disabled={enviando}>
          {enviando ? 'Agregando…' : 'Agregar'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
