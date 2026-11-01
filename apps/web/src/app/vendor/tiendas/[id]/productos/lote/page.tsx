'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ApiError,
  api,
  type AtributoCategoria,
  type Categoria,
  type DatosProducto,
  type ProductoEdicion,
  type ProductoListado,
  type Tienda,
} from '@/lib/api-client';
import { Alert } from '@/components/ui/alert';
import { Field, SelectField, TextAreaField } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { PageSkeleton } from '@/components/ui/skeleton';
import { BarraUso, EncabezadoPanel } from '@/components/vendor/panel-tienda';
import { ImportarProductos } from '@/components/vendor/importar-productos';
import { CategoriaSelector, esCategoriaFinal } from '@/components/forms/categoria-selector';
import { combinar, numero, recordarCategoria, valoresDeFicha } from '@/components/forms/product-form';
import { useFormErrors } from '@/components/forms/use-form-errors';

const MAX_LOTE = 500;
const MAX_FOTOS = 8;

interface Cargado {
  id: string;
  nombre: string;
  aviso?: string;
}

interface Lote {
  categoriaId: string;
  cantidad: number;
  elegidas: Record<string, string[]>;
  ficha: Record<string, string>;
  publicar: boolean;
  cargados: Cargado[];
}

const mensaje = (e: unknown) => (e instanceof ApiError ? e.message : 'Error inesperado');
const claveLote = (tiendaId: string) => `tcl:lote:${tiendaId}`;

function leerLote(tiendaId: string): Lote | null {
  try {
    const texto = localStorage.getItem(claveLote(tiendaId));
    return texto ? (JSON.parse(texto) as Lote) : null;
  } catch {
    return null;
  }
}

function guardarLote(tiendaId: string, lote: Lote | null) {
  try {
    if (lote) localStorage.setItem(claveLote(tiendaId), JSON.stringify(lote));
    else localStorage.removeItem(claveLote(tiendaId));
  } catch {
    // Sin almacenamiento: el lote sigue funcionando mientras la página esté abierta.
  }
}

function useAtributos(categoriaId: string) {
  const [cargados, setCargados] = useState<{ categoriaId: string; atributos: AtributoCategoria[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoriaId) return;
    let vigente = true;
    setError(null);
    api<AtributoCategoria[]>(`/catalog/categorias/${categoriaId}/atributos`)
      .then((atributos) => vigente && setCargados({ categoriaId, atributos }))
      .catch((e) => vigente && setError(mensaje(e)));
    return () => {
      vigente = false;
    };
  }, [categoriaId]);

  return { atributos: cargados?.categoriaId === categoriaId ? cargados.atributos : null, error };
}

export default function CargaPorLotePage({ params }: { params: { id: string } }) {
  const tiendaId = params.id;
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lote, setLote] = useState<Lote | null>(null);
  const [configurando, setConfigurando] = useState(true);
  const [modo, setModo] = useState<'importar' | 'manual'>('importar');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Tienda>(`/stores/${tiendaId}`), api<Categoria[]>('/catalog/categorias')])
      .then(([t, lista]) => {
        setTienda(t);
        setCategorias(lista);
        const guardado = leerLote(tiendaId);
        if (guardado && esCategoriaFinal(lista, guardado.categoriaId)) {
          setLote(guardado);
          setConfigurando(false);
          setModo('manual');
        }
      })
      .catch((e) => setError(mensaje(e)));
  }, [tiendaId]);

  function actualizar(nuevo: Lote | null) {
    setLote(nuevo);
    guardarLote(tiendaId, nuevo);
  }

  if (error) {
    return (
      <div className="stack">
        <Alert>{error}</Alert>
        <Link href={`/vendor/tiendas/${tiendaId}/productos`}>Volver a productos</Link>
      </div>
    );
  }
  if (!tienda) return <PageSkeleton />;

  const puedeEditar = tienda.permisos.includes('productos.editar');
  const puedePublicar = tienda.permisos.includes('productos.publicar');

  return (
    <section className="mp-panel">
      <EncabezadoPanel
        tienda={tienda}
        titulo="Carga por lote"
        icono="package"
        descripcion="Importá desde Excel/CSV o cargá uno a uno: la categoría define los atributos dinámicos de la ficha y las variantes."
      >
        <Link href={`/vendor/tiendas/${tiendaId}/productos`} className="mp-btn-secundario">
          Volver a productos
        </Link>
      </EncabezadoPanel>

      {puedeEditar && (
        <div className="tabs" role="group" aria-label="Cómo cargar los productos">
          <button type="button" className="tab" aria-pressed={modo === 'importar'} onClick={() => setModo('importar')}>
            Importar desde Excel
          </button>
          <button type="button" className="tab" aria-pressed={modo === 'manual'} onClick={() => setModo('manual')}>
            Cargar uno por uno
            {lote && <span className="tab-cuenta">{`${lote.cargados.length}/${lote.cantidad}`}</span>}
          </button>
        </div>
      )}

      {puedeEditar && (
        <div hidden={modo !== 'importar'}>
          <ImportarProductos tiendaId={tiendaId} categorias={categorias} puedePublicar={puedePublicar} />
        </div>
      )}

      {!puedeEditar ? (
        <Alert>No tenés permiso para cargar productos en esta tienda.</Alert>
      ) : modo === 'importar' ? null : configurando || !lote ? (
        <ConfigurarLote
          categorias={categorias}
          inicial={lote}
          puedePublicar={puedePublicar}
          onCancelar={lote ? () => setConfigurando(false) : undefined}
          onListo={(nuevo) => {
            actualizar(nuevo);
            setConfigurando(false);
          }}
        />
      ) : (
        <CargarProductos
          tiendaId={tiendaId}
          lote={lote}
          categorias={categorias}
          onCambiar={actualizar}
          onEditar={() => setConfigurando(true)}
          onTerminar={() => actualizar(null)}
        />
      )}
    </section>
  );
}

function CamposFicha({
  atributos,
  ficha,
  errores,
  onChange,
}: {
  atributos: AtributoCategoria[];
  ficha: Record<string, string>;
  errores: Record<string, string>;
  onChange: (ficha: Record<string, string>) => void;
}) {
  return (
    <div className="row">
      {atributos.map((a) => {
        const props = {
          label: `${a.nombre}${a.unidad ? ` (${a.unidad})` : ''}${a.obligatorio ? '' : ' (opcional)'}`,
          name: `atributo-${a.id}`,
          value: ficha[a.id] ?? '',
          error: errores[`ficha.${a.id}`],
          onChange: (e: { target: { value: string } }) => onChange({ ...ficha, [a.id]: e.target.value }),
        };
        if (a.tipo === 'lista' || a.tipo === 'si_no') {
          const opciones =
            a.tipo === 'lista'
              ? a.opciones.map((o) => ({ value: o.id, label: o.valor }))
              : [
                  { value: 'Sí', label: 'Sí' },
                  { value: 'No', label: 'No' },
                ];
          return <SelectField key={a.id} {...props} placeholder="Elegí una opción" options={opciones} />;
        }
        return <Field key={a.id} {...props} type={a.tipo === 'numero' ? 'number' : 'text'} />;
      })}
    </div>
  );
}

function ConfigurarLote({
  categorias,
  inicial,
  puedePublicar,
  onCancelar,
  onListo,
}: {
  categorias: Categoria[];
  inicial: Lote | null;
  puedePublicar: boolean;
  onCancelar?: () => void;
  onListo: (lote: Lote) => void;
}) {
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? '');
  const [cantidad, setCantidad] = useState(inicial ? String(inicial.cantidad) : '');
  const [elegidas, setElegidas] = useState(inicial?.elegidas ?? {});
  const [ficha, setFicha] = useState(inicial?.ficha ?? {});
  const [publicar, setPublicar] = useState(inicial?.publicar ?? false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const { atributos, error } = useAtributos(categoriaId);

  const deVariante = atributos?.filter((a) => a.define_variante) ?? [];
  const deFicha = atributos?.filter((a) => !a.define_variante) ?? [];
  const combinaciones = atributos ? combinar(deVariante, elegidas) : [];
  const yaCargados = inicial && inicial.categoriaId === categoriaId ? inicial.cargados.length : 0;

  function cambiarCategoria(id: string) {
    setCategoriaId(id);
    setElegidas({});
    setFicha({});
    setErrores({});
  }

  function alternar(atributoId: string, opcionId: string) {
    const resto = { ...errores };
    delete resto[`variante.${atributoId}`];
    setErrores(resto);
    const lista = elegidas[atributoId] ?? [];
    setElegidas({
      ...elegidas,
      [atributoId]: lista.includes(opcionId) ? lista.filter((id) => id !== opcionId) : [...lista, opcionId],
    });
  }

  function empezar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nuevos: Record<string, string> = {};
    if (!esCategoriaFinal(categorias, categoriaId)) {
      nuevos.categoria = 'Elegí la categoría y todos sus niveles: los productos van en el último.';
    }
    const total = Number(cantidad);
    if (!Number.isInteger(total) || total < 1 || total > MAX_LOTE) {
      nuevos.cantidad = `Poné un número entre 1 y ${MAX_LOTE}.`;
    } else if (total <= yaCargados) {
      nuevos.cantidad = `Ya cargaste ${yaCargados} en este lote: poné un número mayor.`;
    }
    for (const a of deVariante) {
      if (!elegidas[a.id]?.length) nuevos[`variante.${a.id}`] = `Marcá al menos una opción de ${a.nombre}.`;
    }
    for (const a of deFicha) {
      if (a.obligatorio && !ficha[a.id]?.trim()) nuevos[`ficha.${a.id}`] = 'Este dato es obligatorio.';
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || !atributos) return;

    onListo({
      categoriaId,
      cantidad: total,
      elegidas,
      ficha,
      publicar: puedePublicar && publicar,
      cargados: yaCargados ? inicial!.cargados : [],
    });
  }

  return (
    <form className="card form form-wide" onSubmit={empezar} noValidate>
      <div className="stack">
        <div>
          <h2>1. Prepará el lote</h2>
          <p className="muted">
            Todo lo que elijas acá se repite en cada producto del lote. Lo podés cambiar después, y si cerrás la
            página el lote te espera en este navegador.
          </p>
        </div>
        {error && <Alert>{error}</Alert>}

        <CategoriaSelector
          categorias={categorias}
          value={categoriaId}
          onChange={cambiarCategoria}
          error={errores.categoria}
        />
        <Field
          label="¿Cuántos productos vas a cargar?"
          name="cantidad"
          type="number"
          min={1}
          max={MAX_LOTE}
          step={1}
          inputMode="numeric"
          placeholder="Ej.: 100"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          error={errores.cantidad}
          required
        />

        {categoriaId && !atributos && !error && <p className="muted">Cargando los datos de la categoría…</p>}

        {deVariante.length > 0 && (
          <>
            <h3>Variantes de todos los productos</h3>
            <p className="muted">
              Marcá las opciones de {deVariante.map((a) => a.nombre).join(' y ')} que tienen todos los productos del
              lote. Cada producto usa el mismo precio y stock para todas las combinaciones.
            </p>
            {deVariante.map((a) => (
              <div key={a.id} className="field">
                <span>{a.nombre}</span>
                <div className="chips">
                  {a.opciones.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="chip"
                      aria-pressed={elegidas[a.id]?.includes(o.id) ?? false}
                      onClick={() => alternar(a.id, o.id)}
                    >
                      {o.valor}
                    </button>
                  ))}
                </div>
                {errores[`variante.${a.id}`] && <small className="field-error">{errores[`variante.${a.id}`]}</small>}
              </div>
            ))}
            {combinaciones.length > 0 && (
              <p className="field-hint">
                Cada producto se va a cargar con {combinaciones.length}{' '}
                {combinaciones.length === 1 ? 'variante' : 'variantes'}.
                {combinaciones.length > 1 &&
                  ' Si cada opción tiene otro precio (por ejemplo, por día y por semana), hacé un lote por opción o ajustá los precios después en cada producto.'}
              </p>
            )}
          </>
        )}

        {deFicha.length > 0 && (
          <>
            <h3>Ficha técnica de todos los productos</h3>
            <CamposFicha atributos={deFicha} ficha={ficha} errores={errores} onChange={setFicha} />
          </>
        )}

        {puedePublicar && (
          <label className="check">
            <input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} />
            <span>
              Publicar cada producto apenas lo guardo
              <small className="field-hint">Si no lo marcás, quedan como borradores y los publicás después.</small>
            </span>
          </label>
        )}

        <div className="actions">
          <button className="btn" type="submit" disabled={!!categoriaId && !atributos}>
            {inicial ? 'Guardar y seguir cargando' : 'Empezar a cargar'}
          </button>
          {onCancelar && (
            <button type="button" className="btn btn-secondary" onClick={onCancelar}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function FotosLote({ fotos, onChange }: { fotos: File[]; onChange: (fotos: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  return (
    <div className="field">
      <span>Fotos (opcional)</span>
      {fotos.length > 0 && (
        <ul className="fotos lote-fotos">
          {urls.map((url, i) => (
            <li key={url} className="foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${i + 1}`} />
              {i === 0 && <span className="badge badge-activa foto-principal">Principal</span>}
              <div className="foto-acciones">
                <button
                  type="button"
                  className="btn-link btn-link-peligro"
                  onClick={() => onChange(fotos.filter((_, j) => j !== i))}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {fotos.length < MAX_FOTOS && (
        <div className="actions">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              const nuevas = Array.from(e.target.files ?? []);
              e.target.value = '';
              onChange([...fotos, ...nuevas].slice(0, MAX_FOTOS));
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>
            <Icon name="image" size={16} /> Agregar fotos
          </button>
          <small className="field-hint">
            Hasta {MAX_FOTOS}, JPG, PNG o WEBP de hasta 5 MB cada una. La primera es la principal.
          </small>
        </div>
      )}
    </div>
  );
}

function CargarProductos({
  tiendaId,
  lote,
  categorias,
  onCambiar,
  onEditar,
  onTerminar,
}: {
  tiendaId: string;
  lote: Lote;
  categorias: Categoria[];
  onCambiar: (lote: Lote) => void;
  onEditar: () => void;
  onTerminar: () => void;
}) {
  const base = `/stores/${tiendaId}/products`;
  const errors = useFormErrors();
  const { atributos, error } = useAtributos(lote.categoriaId);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [enviando, setEnviando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // En .tsx, querySelector<T>() se parsea como JSX; castear el resultado.
  const enfocarNombre = () => {
    const el = formRef.current?.querySelector('input[name="nombre"]');
    (el as HTMLInputElement | null)?.focus();
  };

  const categoria = categorias.find((c) => c.id === lote.categoriaId);
  const deVariante = atributos?.filter((a) => a.define_variante) ?? [];
  const deFicha = atributos?.filter((a) => !a.define_variante) ?? [];
  const combinaciones = atributos ? combinar(deVariante, lote.elegidas) : [];
  const hechos = lote.cargados.length;
  const completo = hechos >= lote.cantidad;

  const resumen = [
    ...deVariante.map((a) => ({
      nombre: a.nombre,
      valor: a.opciones
        .filter((o) => lote.elegidas[a.id]?.includes(o.id))
        .map((o) => o.valor)
        .join(', '),
    })),
    ...deFicha
      .filter((a) => lote.ficha[a.id]?.trim())
      .map((a) => ({
        nombre: a.nombre,
        valor: a.tipo === 'lista' ? (a.opciones.find((o) => o.id === lote.ficha[a.id])?.valor ?? '') : lote.ficha[a.id],
      })),
  ];

  function terminar() {
    if (!completo && !window.confirm('¿Terminar el lote? Los productos que ya cargaste quedan guardados.')) return;
    onTerminar();
  }

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    errors.clear();
    if (!nombre.trim()) {
      errors.field('nombre', 'Escribí el nombre del producto.');
      enfocarNombre();
      return;
    }
    if (!atributos || combinaciones.length === 0) return;

    const datos: DatosProducto = {
      categoria_id: lote.categoriaId,
      nombre: nombre.trim(),
      descripcion,
      atributos: valoresDeFicha(deFicha, lote.ficha),
      variantes: combinaciones.map((c) => ({
        opciones: c.opciones.map((o) => ({ atributo_id: o.atributo.id, opcion_id: o.opcion.id })),
        precio: numero(precio),
        precio_oferta: null,
        stock: numero(stock),
        sku: '',
      })),
    };

    setEnviando(true);
    try {
      const creado = await api<ProductoEdicion>(base, { method: 'POST', body: datos });
      const avisos: string[] = [];
      if (fotos.length > 0) {
        try {
          const form = new FormData();
          fotos.forEach((foto) => form.append('fotos', foto));
          await api(`${base}/${creado.id}/imagenes`, { method: 'POST', body: form });
        } catch (err) {
          avisos.push(`Se guardó sin fotos: ${mensaje(err)}`);
        }
      }
      if (lote.publicar) {
        try {
          const r = (await api(`${base}/${creado.id}/estado`, {
            method: 'PATCH',
            body: { estado: 'publicado' },
          })) as Pick<ProductoListado, 'motivo_pausa'>;
          if (r.motivo_pausa === 'revision') avisos.push('Espera la revisión de moderación.');
        } catch (err) {
          avisos.push(`Quedó como borrador: ${mensaje(err)}`);
        }
      }
      recordarCategoria(tiendaId, lote.categoriaId);
      onCambiar({
        ...lote,
        cargados: [...lote.cargados, { id: creado.id, nombre: creado.nombre, aviso: avisos.join(' ') || undefined }],
      });
      setNombre('');
      setDescripcion('');
      setFotos([]);
      enfocarNombre();
    } catch (err) {
      errors.set(err);
    } finally {
      setEnviando(false);
    }
  }

  const f = errors.fields;
  const errorDe = (campo: string) => {
    if (f[campo]) return f[campo];
    const prefijo = `variantes.`;
    const sufijo = `.${campo}`;
    const hallado = Object.entries(f).find(([k]) => {
      if (!k.startsWith(prefijo) || !k.endsWith(sufijo)) return false;
      const medio = k.slice(prefijo.length, k.length - sufijo.length);
      return /^\d+$/.test(medio);
    });
    return hallado?.[1];
  };

  return (
    <div className="lote">
      <aside className="card stack lote-resumen">
        <div className="page-head">
          <h2>Lote</h2>
          <button type="button" className="btn-link" onClick={onEditar}>
            Cambiar
          </button>
        </div>
        <dl className="lote-datos">
          {[
            { nombre: 'Categoría', valor: categoria?.etiqueta ?? '—' },
            ...resumen,
            { nombre: 'Al guardar', valor: lote.publicar ? 'Se publica' : 'Queda como borrador' },
          ].map((r) => (
            <div key={r.nombre}>
              <dt>{r.nombre}</dt>
              <dd>{r.valor}</dd>
            </div>
          ))}
        </dl>
        {categoria?.revision && (
          <p className="cat-selector-revision">
            <Icon name="shield" size={16} />
            Los productos de esta categoría pasan por moderación antes de publicarse.
          </p>
        )}

        <div>
          <p className="pt-uso">
            <strong>{hechos}</strong> de {lote.cantidad} cargados
          </p>
          <BarraUso usado={hechos} maximo={lote.cantidad} label="Avance del lote" />
        </div>

        {hechos > 0 && (
          <ListaScroll as="ul" className="lote-cargados" etiqueta="Productos cargados en este lote" alto="18rem">
            {[...lote.cargados].reverse().map((p) => (
              <li key={p.id}>
                <Link href={`/vendor/tiendas/${tiendaId}/productos/${p.id}`}>{p.nombre}</Link>
                {p.aviso && <small className="field-hint">{p.aviso}</small>}
              </li>
            ))}
          </ListaScroll>
        )}
        <button type="button" className="btn btn-secondary" onClick={terminar}>
          Terminar lote
        </button>
      </aside>

      {completo ? (
        <section className="card stack lote-fin">
          <Icon name="check" size={32} />
          <h2>
            ¡Listo! Cargaste {hechos} {hechos === 1 ? 'producto' : 'productos'}
          </h2>
          <p className="muted">
            {lote.publicar
              ? 'Se publicaron al guardarlos; los que pasan por moderación se ven apenas el equipo los apruebe.'
              : 'Quedaron como borradores: publicalos desde la lista de productos.'}
          </p>
          <div className="actions">
            <Link href={`/vendor/tiendas/${tiendaId}/productos`} className="btn">
              Ir a mis productos
            </Link>
            <button type="button" className="btn btn-secondary" onClick={onEditar}>
              Sumar más a este lote
            </button>
            <button type="button" className="btn btn-secondary" onClick={onTerminar}>
              Empezar otro lote
            </button>
          </div>
        </section>
      ) : (
        <form ref={formRef} className="card form form-wide" onSubmit={guardar} noValidate>
          <fieldset className="fieldset-plain" disabled={enviando}>
            <div className="stack">
              <div className="page-head">
                <h2>
                  2. Producto {hechos + 1} de {lote.cantidad}
                </h2>
              </div>
              {(error || errors.message) && <Alert>{error ?? errors.message}</Alert>}
              {!atributos && !error && <p className="muted">Cargando los datos de la categoría…</p>}
              {atributos && combinaciones.length === 0 && (
                <Alert>
                  Las opciones elegidas para las variantes ya no existen en esta categoría.{' '}
                  <button type="button" className="btn-link" onClick={onEditar}>
                    Elegí otras
                  </button>
                </Alert>
              )}

              <Field
                label="Nombre"
                name="nombre"
                value={nombre}
                onChange={(e) => {
                  errors.dismiss('nombre');
                  setNombre(e.target.value);
                }}
                placeholder="Ej.: Sustrato universal 50 L"
                autoFocus
                required
                error={f.nombre}
              />
              <TextAreaField
                label="Descripción (opcional)"
                name="descripcion"
                rows={4}
                value={descripcion}
                onChange={(e) => {
                  errors.dismiss('descripcion');
                  setDescripcion(e.target.value);
                }}
                placeholder="Materiales, medidas, cuidados, qué incluye…"
                error={f.descripcion}
              />
              <FotosLote fotos={fotos} onChange={setFotos} />
              <div className="row">
                <Field
                  label={combinaciones.length > 1 ? 'Precio (todas las variantes)' : 'Precio'}
                  name="precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  required
                  error={errorDe('precio')}
                />
                <Field
                  label={combinaciones.length > 1 ? 'Stock de cada variante' : 'Stock'}
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                  error={errorDe('stock')}
                />
              </div>
              <small className="field-hint">El precio y el stock quedan cargados para el próximo producto.</small>

              <div className="actions">
                <button className="btn" type="submit" disabled={!atributos || combinaciones.length === 0}>
                  {enviando ? 'Guardando…' : hechos + 1 < lote.cantidad ? 'Guardar y seguir' : 'Guardar y terminar'}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
