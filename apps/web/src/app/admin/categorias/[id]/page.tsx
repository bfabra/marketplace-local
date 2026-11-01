'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ApiError,
  api,
  type AtributoAdmin,
  type AtributoDeCategoria,
  type CategoriaAdmin,
  type FichaCategoriaAdmin,
  type ResultadoVisibilidad,
} from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { BotonConfirmar, numero } from '@/components/admin/controles';
import { etiquetaTipo, opcionesDeCategorias } from '@/components/admin/catalogo';

const mensaje = (e: unknown) => (e instanceof ApiError ? e.message : 'Error inesperado');
const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;

export default function AdminCategoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [ficha, setFicha] = useState<FichaCategoriaAdmin | null>(null);
  const [lista, setLista] = useState<CategoriaAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noExiste, setNoExiste] = useState(false);

  const cargar = useCallback(() => {
    api<FichaCategoriaAdmin>(`/admin/categorias/${id}`)
      .then(setFicha)
      .catch((e) => (e instanceof ApiError && e.status === 404 ? setNoExiste(true) : setError(mensaje(e))));
    api<CategoriaAdmin[]>('/admin/categorias')
      .then(setLista)
      .catch(() => undefined);
  }, [id]);

  useEffect(cargar, [cargar]);

  const volver = (
    <Link href="/admin/categorias" className="muted">
      ← Categorías
    </Link>
  );

  if (noExiste) {
    return (
      <div className="stack">
        {volver}
        <Alert>No encontramos esa categoría. Puede que la hayan borrado.</Alert>
      </div>
    );
  }
  if (!ficha) return error ? <Alert>{error}</Alert> : <p>Cargando…</p>;

  const madreOculta = ficha.camino.find((c) => !c.activa);
  const subtotal = ficha.subcategorias.length;
  const conProductos = ficha.productos.total > 0;
  const productosParaBorrar = ficha.productos.total + ficha.productos.archivados;

  async function visibilidad(activa: boolean) {
    setError(null);
    try {
      const r = await api<ResultadoVisibilidad>(`/admin/categorias/${id}/activa`, { method: 'PATCH', body: { activa } });
      const subcategorias = r.categorias - 1;
      const detalle = [
        subcategorias > 0 && plural(subcategorias, 'subcategoría', 'subcategorías'),
        r.productos > 0 && plural(r.productos, 'producto', 'productos'),
      ]
        .filter(Boolean)
        .join(' y ');
      const junto = detalle ? `, junto con ${detalle}` : '';
      toast(
        activa
          ? { titulo: 'Categoría visible', texto: `${ficha!.nombre} vuelve a verse en el sitio${junto}.` }
          : {
              titulo: 'Categoría oculta',
              texto:
                `${ficha!.nombre} ya no se ve en el sitio${junto}.` +
                (r.carritos > 0 ? ` Se quitaron de ${plural(r.carritos, 'carrito', 'carritos')}.` : ''),
            }
      );
      cargar();
    } catch (e) {
      setError(mensaje(e));
    }
  }

  async function borrar() {
    setError(null);
    try {
      await api(`/admin/categorias/${id}`, { method: 'DELETE' });
      toast({ titulo: 'Categoría borrada', texto: `${ficha!.nombre} ya no existe.` });
      router.push('/admin/categorias');
    } catch (e) {
      setError(mensaje(e));
    }
  }

  return (
    <div className="stack">
      {volver}

      <div className="page-head">
        <div>
          {ficha.camino.length > 0 && (
            <p className="muted cat-camino">
              {ficha.camino.map((c) => (
                <span key={c.id}>
                  <Link href={`/admin/categorias/${c.id}`}>{c.nombre}</Link> ›{' '}
                </span>
              ))}
            </p>
          )}
          <h1>{ficha.nombre}</h1>
          <p className="muted">
            Creada el {new Date(ficha.creado_en).toLocaleDateString('es-AR')}
            {ficha.activa && (
              <>
                {' · '}
                <Link href={`/buscar?categoria=${ficha.id}`} target="_blank">
                  Ver en el sitio <Icon name="external" size={14} />
                </Link>
              </>
            )}
          </p>
        </div>
        <span className={ficha.activa ? 'badge badge-activa' : 'badge badge-archivada'}>
          {ficha.activa ? 'Visible en el sitio' : 'Oculta'}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="cifras">
        <div className="cifra">
          <strong>{numero(ficha.productos.publicados)}</strong>
          <span>Publicados</span>
        </div>
        <div className="cifra">
          <strong>{numero(ficha.productos.pausados + ficha.productos.borradores)}</strong>
          <span>Pausados o en borrador</span>
        </div>
        <div className="cifra">
          <strong>{numero(ficha.productos.tiendas)}</strong>
          <span>{ficha.productos.tiendas === 1 ? 'Tienda que vende acá' : 'Tiendas que venden acá'}</span>
        </div>
        <div className="cifra">
          <strong>{numero(subtotal)}</strong>
          <span>{subtotal === 1 ? 'Subcategoría' : 'Subcategorías'}</span>
        </div>
      </div>

      <div className="admin-bloques">
        <DatosCategoria ficha={ficha} lista={lista} onGuardada={cargar} />

        <section className="card stack admin-bloque">
          <h2>Visibilidad</h2>
          {ficha.activa ? (
            <>
              <p>
                Se ve en el menú y las tiendas la pueden elegir.
                {(subtotal > 0 || ficha.productos.publicados > 0) &&
                  ` Si la ocultás, también se ocultan ${
                    subtotal > 0 ? `sus subcategorías y ` : ''
                  }${plural(ficha.productos.publicados, 'producto publicado', 'productos publicados')}, que salen de los carritos.`}
              </p>
              <p className="muted">Las tiendas siguen viendo sus productos en su panel.</p>
              <div className="actions">
                <BotonConfirmar
                  label={
                    <>
                      <Icon name="eye-off" size={18} /> Ocultar categoría
                    </>
                  }
                  pregunta="¿Ocultarla del sitio?"
                  confirmar="Sí, ocultar"
                  peligro
                  onConfirmar={() => visibilidad(false)}
                />
              </div>
            </>
          ) : (
            <>
              <p>No se ve en el sitio ni se puede elegir para productos nuevos.</p>
              {madreOculta && (
                <p className="aviso-banda">
                  <Icon name="info" size={18} />
                  Para mostrarla, primero mostrá «{madreOculta.nombre}».
                </p>
              )}
              <div className="actions">
                <button className="btn" disabled={!!madreOculta} onClick={() => visibilidad(true)}>
                  <Icon name="eye" size={18} /> Mostrar categoría
                </button>
              </div>
            </>
          )}
        </section>

        <RevisionCategoria ficha={ficha} onCambio={cargar} />
      </div>

      <AtributosCategoria ficha={ficha} conProductos={conProductos} onCambio={setFicha} />

      <section className="card stack">
        <div className="bloque-head">
          <h2>Subcategorías</h2>
          <Link href={`/admin/categorias?nueva=${ficha.id}`} className="btn btn-secondary">
            <Icon name="plus" size={18} /> Nueva subcategoría
          </Link>
        </div>
        {subtotal === 0 ? (
          <p className="muted">No tiene subcategorías.</p>
        ) : (
          <ListaScroll as="ul" className="lista-simple" etiqueta="Subcategorías" alto="22rem">
            {ficha.subcategorias.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/categorias/${s.id}`}>{s.nombre}</Link>
                {!s.activa && <span className="badge badge-archivada">Oculta</span>}
              </li>
            ))}
          </ListaScroll>
        )}
      </section>

      <section className="card stack">
        <h2>Borrar categoría</h2>
        {subtotal > 0 || productosParaBorrar > 0 ? (
          <p className="muted">
            No se puede borrar porque tiene{' '}
            {[
              subtotal > 0 && plural(subtotal, 'subcategoría', 'subcategorías'),
              productosParaBorrar > 0 && plural(productosParaBorrar, 'producto', 'productos'),
            ]
              .filter(Boolean)
              .join(' y ')}
            {ficha.productos.archivados > 0 && ' (cuentan también los archivados, por los pedidos viejos)'}. Si
            ya no la querés en el sitio, ocultala.
          </p>
        ) : (
          <>
            <p className="muted">No tiene productos ni subcategorías, así que se puede borrar.</p>
            <div className="actions">
              <BotonConfirmar
                label={
                  <>
                    <Icon name="trash" size={18} /> Borrar categoría
                  </>
                }
                className="btn btn-peligro"
                pregunta={`¿Borrar ${ficha.nombre}?`}
                confirmar="Sí, borrar"
                peligro
                onConfirmar={borrar}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function DatosCategoria({
  ficha,
  lista,
  onGuardada,
}: {
  ficha: FichaCategoriaAdmin;
  lista: CategoriaAdmin[];
  onGuardada: () => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(ficha.nombre);
  const [padre, setPadre] = useState(ficha.padre_id ?? '');
  const [comision, setComision] = useState(String(ficha.comision_pct));
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setNombre(ficha.nombre);
    setPadre(ficha.padre_id ?? '');
    setComision(String(ficha.comision_pct));
  }, [ficha]);

  const opciones = useMemo(() => opcionesDeCategorias(lista, ficha.ruta), [lista, ficha.ruta]);
  const cambio =
    nombre.trim() !== ficha.nombre || padre !== (ficha.padre_id ?? '') || Number(comision) !== Number(ficha.comision_pct);
  const nuevaMadre = padre !== (ficha.padre_id ?? '') ? lista.find((c) => c.id === padre) : undefined;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2) {
      setError('El nombre tiene que tener al menos 2 caracteres.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api(`/admin/categorias/${ficha.id}`, {
        method: 'PUT',
        body: { nombre: nombre.trim(), padre_id: padre || null, comision_pct: Number(comision) },
      });
      toast({ titulo: 'Cambios guardados', texto: `${nombre.trim()} quedó actualizada.` });
      onGuardada();
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="card stack admin-bloque" onSubmit={enviar} noValidate>
      <h2>Datos</h2>
      {error && <Alert>{error}</Alert>}
      <label className="field">
        Nombre
        <input value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <label className="field">
        Dentro de
        <select value={padre} onChange={(e) => setPadre(e.target.value)}>
          <option value="">Ninguna (va al menú principal)</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="field-hint">Al moverla, se lleva sus subcategorías y productos.</span>
      </label>
      {nuevaMadre && !nuevaMadre.activa && ficha.activa && (
        <p className="aviso-banda">
          <Icon name="info" size={18} />
          {nuevaMadre.nombre} está oculta: al moverla ahí, esta categoría también se oculta.
        </p>
      )}
      <label className="field">
        Comisión (%)
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.5"
          value={comision}
          onChange={(e) => setComision(e.target.value)}
        />
        <span className="field-hint">Se aplica a las ventas nuevas de los productos de esta categoría.</span>
      </label>
      <div className="actions">
        <button className="btn" disabled={!cambio || enviando}>
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function RevisionCategoria({ ficha, onCambio }: { ficha: FichaCategoriaAdmin; onCambio: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const desde = ficha.revisionDesde && ficha.revisionDesde.id !== ficha.id ? ficha.revisionDesde : null;

  async function cambiar(requiere_revision: boolean) {
    setEnviando(true);
    setError(null);
    try {
      await api(`/admin/categorias/${ficha.id}/revision`, { method: 'PATCH', body: { requiere_revision } });
      toast(
        requiere_revision
          ? { titulo: 'Revisión activada', texto: `Los productos de ${ficha.nombre} se revisan antes de publicarse.` }
          : { titulo: 'Revisión desactivada', texto: `Los productos de ${ficha.nombre} siguen la regla de cada tienda.` }
      );
      onCambio();
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="card stack admin-bloque">
      <h2>Revisión de moderación</h2>
      {error && <Alert>{error}</Alert>}
      {ficha.requiere_revision ? (
        <>
          <p>
            Cada producto que se publique acá{ficha.subcategorias.length > 0 && ' o en sus subcategorías'} pasa por
            moderación antes de verse en el sitio, sin importar la tienda. También vuelve a revisión si le cambian el
            nombre, la descripción o la categoría.
          </p>
          <div className="actions">
            <BotonConfirmar
              label={
                <>
                  <Icon name="shield" size={18} /> Quitar la revisión
                </>
              }
              pregunta="¿Dejar de revisar sus productos?"
              confirmar="Sí, quitar"
              onConfirmar={() => cambiar(false)}
            />
          </div>
        </>
      ) : desde ? (
        <p className="aviso-banda">
          <Icon name="shield" size={18} />
          <span>
            Sus productos ya pasan por moderación porque lo pide{' '}
            <Link href={`/admin/categorias/${desde.id}`}>{desde.nombre}</Link>.
          </span>
        </p>
      ) : (
        <>
          <p>
            Sus productos siguen la regla de cada tienda. Activala para rubros con restricciones, como productos
            veterinarios: cada producto queda en revisión hasta que moderación lo apruebe.
          </p>
          <div className="actions">
            <button className="btn btn-secondary" disabled={enviando} onClick={() => cambiar(true)}>
              <Icon name="shield" size={18} /> Exigir revisión
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function AtributosCategoria({
  ficha,
  conProductos,
  onCambio,
}: {
  ficha: FichaCategoriaAdmin;
  conProductos: boolean;
  onCambio: (f: FichaCategoriaAdmin) => void;
}) {
  const toast = useToast();
  const [catalogo, setCatalogo] = useState<AtributoAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({ atributo: '', obligatorio: false, variante: false });

  useEffect(() => {
    api<AtributoAdmin[]>('/admin/atributos')
      .then(setCatalogo)
      .catch((e) => setError(mensaje(e)));
  }, []);

  const heredados = ficha.atributos.filter((a) => a.desde);
  const propios = ficha.atributos.filter((a) => !a.desde);
  const disponibles = (catalogo ?? []).filter((a) => !ficha.atributos.some((x) => x.id === a.id));
  const elegido = disponibles.find((a) => a.id === nuevo.atributo);
  const puedeVariante = !!elegido && elegido.tipo === 'lista' && elegido.opciones.length > 0 && !conProductos;

  async function guardar(atributoId: string, obligatorio: boolean, define_variante: boolean, aviso: string) {
    setOcupado(atributoId);
    setError(null);
    try {
      const f = await api<FichaCategoriaAdmin>(`/admin/categorias/${ficha.id}/atributos/${atributoId}`, {
        method: 'PUT',
        body: { obligatorio, define_variante },
      });
      onCambio(f);
      toast({ titulo: 'Atributos actualizados', texto: aviso });
      return true;
    } catch (e) {
      setError(mensaje(e));
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function quitar(a: AtributoDeCategoria) {
    setOcupado(a.id);
    setError(null);
    try {
      onCambio(await api<FichaCategoriaAdmin>(`/admin/categorias/${ficha.id}/atributos/${a.id}`, { method: 'DELETE' }));
      toast({ titulo: 'Atributo quitado', texto: `${a.nombre} ya no se pide en ${ficha.nombre}.` });
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setOcupado(null);
    }
  }

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (!elegido) return;
    const variante = nuevo.variante && puedeVariante;
    const ok = await guardar(
      elegido.id,
      nuevo.obligatorio || variante,
      variante,
      `${elegido.nombre} ahora se pide en ${ficha.nombre}${ficha.subcategorias.length ? ' y sus subcategorías' : ''}.`
    );
    if (ok) setNuevo({ atributo: '', obligatorio: false, variante: false });
  }

  return (
    <section className="card stack">
      <div className="bloque-head">
        <h2>Atributos</h2>
        <Link href="/admin/categorias/atributos" className="btn btn-ghost">
          Ver todos los atributos
        </Link>
      </div>
      <p className="muted">
        Son los datos que completa la tienda al cargar un producto. Los que definen variantes (talle, color…) generan
        una combinación con su propio precio y stock. Las subcategorías heredan los atributos de esta.
      </p>
      {conProductos && (
        <p className="aviso-banda">
          <Icon name="lock" size={18} />
          Como ya tiene productos, no se pueden cambiar sus variantes: los productos cargados dejarían de cuadrar.
        </p>
      )}
      {error && <Alert>{error}</Alert>}

      {ficha.atributos.length === 0 ? (
        <p className="muted">Todavía no pide ningún dato extra.</p>
      ) : (
        <ListaScroll as="ul" className="atr-lista" etiqueta="Datos que pide la categoría">
          {heredados.map((a) => (
            <li key={a.id} className="atr-fila atr-fila-heredada">
              <span className="atr-info">
                <strong>{a.nombre}</strong>
                <span className="muted">
                  {etiquetaTipo(a.tipo)}
                  {a.unidad && ` (${a.unidad})`} · heredado de{' '}
                  <Link href={`/admin/categorias/${a.desde!.id}`}>{a.desde!.nombre}</Link>
                </span>
              </span>
              <span className="atr-marcas">
                {a.define_variante && <span className="tag">Variante</span>}
                {a.obligatorio && <span className="tag">Obligatorio</span>}
              </span>
            </li>
          ))}
          {propios.map((a) => {
            const bloqueaVariante = conProductos;
            const enUso = a.enUso ?? 0;
            const motivoQuitar =
              a.define_variante && conProductos
                ? 'Define variantes y la categoría ya tiene productos.'
                : enUso > 0
                  ? `${plural(enUso, 'producto lo tiene', 'productos lo tienen')} cargado.`
                  : null;
            return (
              <li key={a.id} className="atr-fila">
                <span className="atr-info">
                  <strong>{a.nombre}</strong>
                  <span className="muted">
                    {etiquetaTipo(a.tipo)}
                    {a.unidad && ` (${a.unidad})`}
                    {a.tipo === 'lista' && ` · ${plural(a.opciones, 'opción', 'opciones')}`}
                    {enUso > 0 && ` · cargado en ${plural(enUso, 'producto', 'productos')}`}
                  </span>
                </span>
                <span className="atr-marcas">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={a.obligatorio}
                      disabled={ocupado !== null || a.define_variante}
                      onChange={(e) =>
                        guardar(
                          a.id,
                          e.target.checked,
                          a.define_variante,
                          `${a.nombre} ahora es ${e.target.checked ? 'obligatorio' : 'opcional'}.`
                        )
                      }
                    />
                    Obligatorio
                  </label>
                  <label className="check" title={bloqueaVariante ? 'La categoría ya tiene productos' : undefined}>
                    <input
                      type="checkbox"
                      checked={a.define_variante}
                      disabled={ocupado !== null || bloqueaVariante || (a.tipo !== 'lista' && !a.define_variante)}
                      onChange={(e) =>
                        guardar(
                          a.id,
                          a.obligatorio || e.target.checked,
                          e.target.checked,
                          e.target.checked
                            ? `Cada ${a.nombre.toLowerCase()} va a tener su precio y stock.`
                            : `${a.nombre} ya no define variantes.`
                        )
                      }
                    />
                    Define variantes
                  </label>
                </span>
                <button
                  className="btn btn-ghost btn-link-peligro"
                  disabled={ocupado !== null || !!motivoQuitar}
                  title={motivoQuitar ?? undefined}
                  onClick={() => quitar(a)}
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ListaScroll>
      )}

      {catalogo && (
        <form className="atr-agregar" onSubmit={agregar}>
          <label className="field">
            Agregar atributo
            <select
              value={nuevo.atributo}
              onChange={(e) => setNuevo({ atributo: e.target.value, obligatorio: false, variante: false })}
            >
              <option value="">Elegí un atributo…</option>
              {disponibles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({etiquetaTipo(a.tipo).toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={nuevo.obligatorio || (nuevo.variante && puedeVariante)}
              disabled={nuevo.variante && puedeVariante}
              onChange={(e) => setNuevo({ ...nuevo, obligatorio: e.target.checked })}
            />
            Obligatorio
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={nuevo.variante && puedeVariante}
              disabled={!puedeVariante}
              onChange={(e) => setNuevo({ ...nuevo, variante: e.target.checked })}
            />
            Define variantes
          </label>
          <button className="btn" disabled={!elegido || ocupado !== null}>
            Agregar
          </button>
          {elegido && elegido.tipo === 'lista' && elegido.opciones.length === 0 && (
            <small className="muted atr-agregar-nota">
              Para usarlo como variante, primero cargale opciones en{' '}
              <Link href="/admin/categorias/atributos">Atributos</Link>.
            </small>
          )}
          {disponibles.length === 0 && (
            <small className="muted atr-agregar-nota">
              Ya pide todos los atributos que existen. Podés crear otro en{' '}
              <Link href="/admin/categorias/atributos">Atributos</Link>.
            </small>
          )}
        </form>
      )}
    </section>
  );
}
