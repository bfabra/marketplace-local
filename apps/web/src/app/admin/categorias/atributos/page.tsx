'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, type AtributoAdmin, type TipoAtributo } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { BotonConfirmar, EditarTexto, numero } from '@/components/admin/controles';
import { CatalogoTabs, TIPOS_ATRIBUTO, etiquetaTipo } from '@/components/admin/catalogo';

const mensaje = (e: unknown) => (e instanceof ApiError ? e.message : 'Error inesperado');

export default function AdminAttributesPage() {
  const toast = useToast();
  const [lista, setLista] = useState<AtributoAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    api<AtributoAdmin[]>('/admin/atributos')
      .then(setLista)
      .catch((e) => setError(mensaje(e)));
  }, []);

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Categorías y atributos"
        descripcion="Los atributos son los datos que se piden al cargar un producto. Crealos acá y elegí en cada categoría cuáles usa."
      >
        {!creando && (
          <button className="btn" onClick={() => setCreando(true)}>
            <Icon name="plus" size={18} /> Nuevo atributo
          </button>
        )}
      </EncabezadoAdmin>

      <CatalogoTabs />

      {error && <Alert>{error}</Alert>}

      {creando && (
        <FormAtributo
          onCancelar={() => setCreando(false)}
          onGuardado={(l, nombre) => {
            setLista(l);
            setCreando(false);
            toast({ titulo: 'Atributo creado', texto: `Ahora sumá ${nombre} a las categorías que lo necesiten.` });
          }}
        />
      )}

      {!lista ? (
        <p>Cargando…</p>
      ) : lista.length === 0 ? (
        <EmptyState icono="sliders" titulo="Todavía no hay atributos">
          Creá el primero, por ejemplo Talle o Color.
        </EmptyState>
      ) : (
        <ListaScroll as="ul" className="admin-lista" etiqueta="Atributos">
          {lista.map((a) => (
            <Atributo key={a.id} atributo={a} onLista={setLista} />
          ))}
        </ListaScroll>
      )}
    </div>
  );
}

function FormAtributo({
  atributo,
  onCancelar,
  onGuardado,
}: {
  atributo?: AtributoAdmin;
  onCancelar: () => void;
  onGuardado: (lista: AtributoAdmin[], nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(atributo?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoAtributo>(atributo?.tipo ?? 'lista');
  const [unidad, setUnidad] = useState(atributo?.unidad ?? '');
  const [filtrable, setFiltrable] = useState(atributo?.filtrable ?? false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const tipoFijo =
    !!atributo && (atributo.productos > 0 || atributo.opciones.length > 0 || atributo.categorias.length > 0);
  const conUnidad = tipo === 'numero' || tipo === 'lista';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2) {
      setError('El nombre tiene que tener al menos 2 caracteres.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const lista = await api<AtributoAdmin[]>(atributo ? `/admin/atributos/${atributo.id}` : '/admin/atributos', {
        method: atributo ? 'PUT' : 'POST',
        body: { nombre: nombre.trim(), tipo, unidad: conUnidad && unidad.trim() ? unidad.trim() : null, filtrable },
      });
      onGuardado(lista, nombre.trim());
    } catch (err) {
      setError(mensaje(err));
      setEnviando(false);
    }
  }

  return (
    <form className="card stack" onSubmit={enviar} noValidate>
      <h2>{atributo ? `Editar ${atributo.nombre}` : 'Nuevo atributo'}</h2>
      {error && <Alert>{error}</Alert>}
      <div className="form-grid-3">
        <label className="field">
          Nombre
          <input value={nombre} maxLength={40} autoFocus onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="field">
          Tipo de dato
          <select value={tipo} disabled={tipoFijo} onChange={(e) => setTipo(e.target.value as TipoAtributo)}>
            {TIPOS_ATRIBUTO.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {tipoFijo
              ? 'Ya se usa o tiene opciones, así que el tipo no se puede cambiar.'
              : TIPOS_ATRIBUTO.find((t) => t.tipo === tipo)?.ayuda}
          </span>
        </label>
        {conUnidad && (
          <label className="field">
            Unidad (opcional)
            <input value={unidad} maxLength={10} placeholder="GB, cm, kg…" onChange={(e) => setUnidad(e.target.value)} />
          </label>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={filtrable} onChange={(e) => setFiltrable(e.target.checked)} />
        Se puede usar como filtro en la búsqueda
      </label>
      <div className="actions">
        <button className="btn" disabled={enviando}>
          {enviando ? 'Guardando…' : atributo ? 'Guardar cambios' : 'Crear atributo'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Atributo({ atributo: a, onLista }: { atributo: AtributoAdmin; onLista: (l: AtributoAdmin[]) => void }) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [opcion, setOpcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (editando) {
    return (
      <li>
        <FormAtributo
          atributo={a}
          onCancelar={() => setEditando(false)}
          onGuardado={(l, nombre) => {
            onLista(l);
            setEditando(false);
            toast({ titulo: 'Cambios guardados', texto: `${nombre} quedó actualizado.` });
          }}
        />
      </li>
    );
  }

  async function llamar(ruta: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
    setOcupado(true);
    setError(null);
    try {
      onLista(await api<AtributoAdmin[]>(ruta, { method, body }));
      return true;
    } catch (e) {
      setError(mensaje(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function agregarOpcion(e: FormEvent) {
    e.preventDefault();
    const valor = opcion.trim();
    if (!valor) return;
    if (await llamar(`/admin/atributos/${a.id}/opciones`, 'POST', { valor })) setOpcion('');
  }

  const enUso = a.categorias.length > 0 || a.productos > 0;

  return (
    <li className="card stack atr-card">
      <div className="bloque-head">
        <div>
          <h2>{a.nombre}</h2>
          <p className="muted">
            {etiquetaTipo(a.tipo)}
            {a.unidad && ` · en ${a.unidad}`}
            {a.productos > 0 && ` · cargado en ${numero(a.productos)} ${a.productos === 1 ? 'producto' : 'productos'}`}
          </p>
        </div>
        <span className="actions">
          {a.filtrable && <span className="tag">Filtro de búsqueda</span>}
          <button className="btn btn-ghost" onClick={() => setEditando(true)}>
            <Icon name="pencil" size={16} /> Editar
          </button>
        </span>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="atr-categorias">
        <span className="muted">Lo usan:</span>
        {a.categorias.length === 0 ? (
          <span className="muted">ninguna categoría todavía</span>
        ) : (
          a.categorias.map((c) => (
            <Link key={c.id} href={`/admin/categorias/${c.id}`} className="chip">
              {c.nombre}
              {c.define_variante && ' · variante'}
            </Link>
          ))
        )}
      </div>

      {a.tipo === 'lista' && (
        <div className="stack atr-opciones">
          <h3>Opciones</h3>
          {a.opciones.length === 0 ? (
            <p className="muted">Sin opciones. Cargá al menos una para que la tienda pueda elegir.</p>
          ) : (
            <ListaScroll as="ul" className="opciones-lista" etiqueta={`Opciones de ${a.nombre}`} alto="12rem">
              {a.opciones.map((o) =>
                renombrando === o.id ? (
                  <li key={o.id} className="opcion-editando">
                    <EditarTexto
                      valor={o.valor}
                      label={`Nuevo nombre para ${o.valor}`}
                      maxLength={40}
                      minLength={1}
                      onCancelar={() => setRenombrando(null)}
                      onGuardar={async (valor) => {
                        onLista(
                          await api<AtributoAdmin[]>(`/admin/atributos/${a.id}/opciones/${o.id}`, {
                            method: 'PUT',
                            body: { valor },
                          })
                        );
                        setRenombrando(null);
                      }}
                    />
                  </li>
                ) : (
                  <li key={o.id} className="chip opcion">
                    {o.valor}
                    <button
                      className="chip-quitar"
                      aria-label={`Renombrar ${o.valor}`}
                      title="Renombrar"
                      disabled={ocupado}
                      onClick={() => setRenombrando(o.id)}
                    >
                      <Icon name="pencil" size={12} />
                    </button>
                    <button
                      className="chip-quitar"
                      aria-label={`Borrar ${o.valor}`}
                      title={o.enUso ? 'Hay productos que la usan' : 'Borrar'}
                      disabled={ocupado || o.enUso}
                      onClick={() => llamar(`/admin/atributos/${a.id}/opciones/${o.id}`, 'DELETE')}
                    >
                      ×
                    </button>
                  </li>
                )
              )}
            </ListaScroll>
          )}
          <form className="opcion-agregar" onSubmit={agregarOpcion}>
            <label className="sr-only" htmlFor={`opcion-${a.id}`}>
              Nueva opción para {a.nombre}
            </label>
            <input
              id={`opcion-${a.id}`}
              className="input"
              value={opcion}
              maxLength={40}
              placeholder="Nueva opción"
              onChange={(e) => setOpcion(e.target.value)}
            />
            <button className="btn btn-secondary" disabled={ocupado || !opcion.trim()}>
              <Icon name="plus" size={16} /> Agregar
            </button>
          </form>
        </div>
      )}

      <div className="atr-pie">
        {enUso ? (
          <span className="muted">
            {a.categorias.length > 0
              ? 'Para borrarlo, primero quitalo de las categorías que lo usan.'
              : 'No se puede borrar: hay productos que lo tienen cargado.'}
          </span>
        ) : (
          <BotonConfirmar
            label={
              <>
                <Icon name="trash" size={16} /> Borrar atributo
              </>
            }
            className="btn btn-ghost btn-link-peligro"
            pregunta={`¿Borrar ${a.nombre}?`}
            confirmar="Sí, borrar"
            peligro
            onConfirmar={async () => {
              if (await llamar(`/admin/atributos/${a.id}`, 'DELETE')) {
                toast({ titulo: 'Atributo borrado', texto: `${a.nombre} ya no existe.` });
              }
            }}
          />
        )}
      </div>
    </li>
  );
}
