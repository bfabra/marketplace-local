'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  api,
  type AtributoCategoria,
  type Categoria,
  type DatosProducto,
  type OpcionAtributo,
  type ProductoEdicion,
  type ValorAtributo,
} from '@/lib/api-client';
import { Field, SelectField, TextAreaField } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { CategoriaSelector, esCategoriaFinal } from './categoria-selector';
import { useFormErrors } from './use-form-errors';

interface Fila {
  precio: string;
  precio_oferta: string;
  stock: string;
  sku: string;
}

export interface Combinacion {
  clave: string;
  opciones: { atributo: AtributoCategoria; opcion: OpcionAtributo }[];
}

const FILA_VACIA: Fila = { precio: '', precio_oferta: '', stock: '', sku: '' };

// Identifica una variante por su combinación de opciones, igual que el API.
const claveDe = (opcionIds: string[]) => [...opcionIds].sort().join('|') || 'unica';

/** Todas las combinaciones de las opciones elegidas (ej. 2 talles × 3 colores = 6 variantes). */
export function combinar(atributos: AtributoCategoria[], elegidas: Record<string, string[]>): Combinacion[] {
  let combinaciones: Combinacion['opciones'][] = [[]];
  for (const atributo of atributos) {
    const opciones = atributo.opciones.filter((o) => elegidas[atributo.id]?.includes(o.id));
    combinaciones = combinaciones.flatMap((c) => opciones.map((opcion) => [...c, { atributo, opcion }]));
  }
  return combinaciones.map((opciones) => ({ clave: claveDe(opciones.map((o) => o.opcion.id)), opciones }));
}

export const numero = (valor: string) => (valor.trim() === '' ? undefined : Number(valor.replace(',', '.')));

/** Valores de la ficha técnica tal como los espera el API (los vacíos no se mandan). */
export function valoresDeFicha(deFicha: AtributoCategoria[], ficha: Record<string, string>): ValorAtributo[] {
  return deFicha.flatMap((a): ValorAtributo[] => {
    const valor = ficha[a.id]?.trim();
    if (!valor) return [];
    if (a.tipo === 'lista') return [{ atributo_id: a.id, opcion_id: valor }];
    if (a.tipo === 'numero') return [{ atributo_id: a.id, valor_numero: numero(valor) }];
    return [{ atributo_id: a.id, valor_texto: valor }];
  });
}

const claveUltimaCategoria = (tiendaId: string) => `tcl:ultima-categoria:${tiendaId}`;

export function recordarCategoria(tiendaId: string, categoriaId: string) {
  try {
    localStorage.setItem(claveUltimaCategoria(tiendaId), categoriaId);
  } catch {
    // Sin almacenamiento (modo privado): simplemente no se recuerda.
  }
}

export function ultimaCategoria(tiendaId: string) {
  try {
    return localStorage.getItem(claveUltimaCategoria(tiendaId));
  } catch {
    return null;
  }
}

function estadoInicial(producto?: ProductoEdicion) {
  const ficha: Record<string, string> = {};
  for (const a of producto?.atributos ?? []) {
    ficha[a.atributo_id] = a.opcion_id ?? (a.valor_numero != null ? String(a.valor_numero) : (a.valor_texto ?? ''));
  }
  const elegidas: Record<string, string[]> = {};
  const filas: Record<string, Fila> = {};
  for (const v of producto?.variantes ?? []) {
    for (const o of v.opciones) {
      elegidas[o.atributo_id] = [...new Set([...(elegidas[o.atributo_id] ?? []), o.opcion_id])];
    }
    filas[claveDe(v.opciones.map((o) => o.opcion_id))] = {
      precio: String(v.precio),
      precio_oferta: v.precio_oferta === null ? '' : String(v.precio_oferta),
      stock: String(v.stock),
      sku: v.sku ?? '',
    };
  }
  return { ficha, elegidas, filas };
}

interface ProductFormProps {
  tiendaId: string;
  producto?: ProductoEdicion;
  puedeEditar?: boolean;
  onSaved: (producto: ProductoEdicion) => void;
}

export function ProductForm({ tiendaId, producto, puedeEditar = true, onSaved }: ProductFormProps) {
  const errors = useFormErrors();
  const inicial = useMemo(() => estadoInicial(producto), [producto]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState(producto?.categoria_id ?? '');
  const [cargados, setCargados] = useState<{ categoriaId: string; atributos: AtributoCategoria[] }>({
    categoriaId: '',
    atributos: [],
  });
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [ficha, setFicha] = useState(inicial.ficha);
  const [elegidas, setElegidas] = useState(inicial.elegidas);
  const [filas, setFilas] = useState(inicial.filas);
  const [masivo, setMasivo] = useState({ precio: '', stock: '' });
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recordada, setRecordada] = useState('');

  useEffect(() => {
    api<Categoria[]>('/catalog/categorias')
      .then((lista) => {
        setCategorias(lista);
        const ultima = producto ? null : ultimaCategoria(tiendaId);
        if (ultima && esCategoriaFinal(lista, ultima)) {
          setCategoriaId((actual) => actual || ultima);
          setRecordada(ultima);
        }
      })
      .catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!categoriaId) return;
    let vigente = true;
    api<AtributoCategoria[]>(`/catalog/categorias/${categoriaId}/atributos`)
      .then((atributos) => vigente && setCargados({ categoriaId, atributos }))
      .catch(errors.set);
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId]);

  const listos = !!categoriaId && cargados.categoriaId === categoriaId;
  const atributos = listos ? cargados.atributos : [];
  const deVariante = atributos.filter((a) => a.define_variante);
  const deFicha = atributos.filter((a) => !a.define_variante);
  const combinaciones = listos ? combinar(deVariante, elegidas) : [];

  function cambiarCategoria(id: string) {
    errors.dismiss('categoria_id');
    errors.dismiss('variantes');
    setCategoriaId(id);
    setFicha({});
    setElegidas({});
  }

  function alternarOpcion(atributoId: string, opcionId: string) {
    // Las filas cambian de posición: los errores por índice dejan de corresponder.
    errors.dismiss('variantes');
    setElegidas((actual) => {
      const lista = actual[atributoId] ?? [];
      return {
        ...actual,
        [atributoId]: lista.includes(opcionId) ? lista.filter((id) => id !== opcionId) : [...lista, opcionId],
      };
    });
  }

  function editarFila(indice: number, clave: string, campo: keyof Fila, valor: string) {
    errors.dismiss(`variantes.${indice}.${campo}`);
    setFilas((actual) => ({ ...actual, [clave]: { ...FILA_VACIA, ...actual[clave], [campo]: valor } }));
  }

  function aplicarATodas() {
    setFilas((actual) => {
      const nuevas = { ...actual };
      for (const c of combinaciones) {
        nuevas[c.clave] = {
          ...FILA_VACIA,
          ...actual[c.clave],
          ...(masivo.precio && { precio: masivo.precio }),
          ...(masivo.stock && { stock: masivo.stock }),
        };
      }
      return nuevas;
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    errors.clear();
    setSaved(false);

    if (!esCategoriaFinal(categorias, categoriaId)) {
      errors.field('categoria_id', 'Elegí la categoría y todos sus niveles: el producto va en el último.');
      return;
    }
    if (!listos) return;
    if (combinaciones.length === 0) {
      errors.field('variantes', `Elegí al menos una opción de ${deVariante.map((a) => a.nombre).join(' y ')}`);
      return;
    }

    const datos: DatosProducto = {
      categoria_id: categoriaId,
      nombre,
      descripcion,
      atributos: valoresDeFicha(deFicha, ficha),
      variantes: combinaciones.map((c) => {
        const fila = { ...FILA_VACIA, ...filas[c.clave] };
        return {
          opciones: c.opciones.map((o) => ({ atributo_id: o.atributo.id, opcion_id: o.opcion.id })),
          precio: numero(fila.precio),
          precio_oferta: numero(fila.precio_oferta) ?? null,
          stock: numero(fila.stock),
          sku: fila.sku,
        };
      }),
    };

    setSending(true);
    try {
      const base = `/stores/${tiendaId}/products`;
      const guardado = producto
        ? await api<ProductoEdicion>(`${base}/${producto.id}`, { method: 'PUT', body: datos })
        : await api<ProductoEdicion>(base, { method: 'POST', body: datos });
      setSaved(true);
      if (!producto) recordarCategoria(tiendaId, categoriaId);
      onSaved(guardado);
    } catch (error) {
      errors.set(error);
    } finally {
      setSending(false);
    }
  }

  const f = errors.fields;
  const errorVariantes = Object.entries(f).some(([k]) => k.startsWith('variantes.'));

  return (
    <form className="card form form-wide" onSubmit={handleSubmit} noValidate>
      <fieldset className="fieldset-plain" disabled={!puedeEditar}>
        <div className="stack">
          <h2>Datos del producto</h2>
          {errors.message && <Alert>{errors.message}</Alert>}
          {saved && producto && <Alert kind="success">Cambios guardados</Alert>}

          <Field
            label="Nombre"
            name="nombre"
            value={nombre}
            onChange={(e) => {
              errors.dismiss('nombre');
              setNombre(e.target.value);
            }}
            placeholder="Ej.: Remera básica de algodón"
            required
            error={f.nombre}
          />
          <CategoriaSelector
            categorias={categorias}
            value={categoriaId}
            onChange={cambiarCategoria}
            error={f.categoria_id}
            hint={
              recordada && categoriaId === recordada
                ? 'Te dejamos la última categoría que usaste. Si este producto es de otra, cambiala.'
                : undefined
            }
          />
          <TextAreaField
            label="Descripción (opcional)"
            name="descripcion"
            rows={5}
            value={descripcion}
            onChange={(e) => {
              errors.dismiss('descripcion');
              setDescripcion(e.target.value);
            }}
            placeholder="Materiales, medidas, cuidados, qué incluye…"
            error={f.descripcion}
          />

          {deFicha.length > 0 && (
            <>
              <h3>Ficha técnica</h3>
              <div className="row">
                {deFicha.map((a) => {
                  const label = `${a.nombre}${a.unidad ? ` (${a.unidad})` : ''}${a.obligatorio ? '' : ' (opcional)'}`;
                  const props = {
                    label,
                    name: `atributo-${a.id}`,
                    value: ficha[a.id] ?? '',
                    onChange: (e: { target: { value: string } }) => setFicha({ ...ficha, [a.id]: e.target.value }),
                  };
                  if (a.tipo === 'lista') {
                    return (
                      <SelectField
                        key={a.id}
                        {...props}
                        placeholder="Elegí una opción"
                        options={a.opciones.map((o) => ({ value: o.id, label: o.valor }))}
                      />
                    );
                  }
                  if (a.tipo === 'si_no') {
                    return (
                      <SelectField
                        key={a.id}
                        {...props}
                        placeholder="Elegí una opción"
                        options={[
                          { value: 'Sí', label: 'Sí' },
                          { value: 'No', label: 'No' },
                        ]}
                      />
                    );
                  }
                  return <Field key={a.id} {...props} type={a.tipo === 'numero' ? 'number' : 'text'} />;
                })}
              </div>
            </>
          )}

          {categoriaId && !listos && <p className="muted">Cargando los datos de la categoría…</p>}
          {listos && (
            <>
              <h3>{deVariante.length ? 'Variantes, precio y stock' : 'Precio y stock'}</h3>
              {deVariante.length > 0 && (
                <p className="muted">
                  Marcá las opciones de {deVariante.map((a) => a.nombre).join(' y ')} que tenés: se arma una fila
                  por cada combinación, con su propio precio y stock.
                </p>
              )}
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
                        onClick={() => alternarOpcion(a.id, o.id)}
                      >
                        {o.valor}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {f.variantes && <small className="field-error">{f.variantes}</small>}

              {combinaciones.length > 1 && (
                <div className="masivo">
                  <span className="muted">Completar todas:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Precio"
                    aria-label="Precio para todas"
                    value={masivo.precio}
                    onChange={(e) => setMasivo({ ...masivo, precio: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Stock"
                    aria-label="Stock para todas"
                    value={masivo.stock}
                    onChange={(e) => setMasivo({ ...masivo, stock: e.target.value })}
                  />
                  <button type="button" className="btn btn-secondary" onClick={aplicarATodas}>
                    Aplicar
                  </button>
                </div>
              )}

              {combinaciones.length > 0 && (
                <div className="tabla-scroll">
                  <table className="tabla tabla-variantes">
                    <thead>
                      <tr>
                        {deVariante.map((a) => (
                          <th key={a.id}>{a.nombre}</th>
                        ))}
                        <th>Precio</th>
                        <th>Oferta (opcional)</th>
                        <th>Stock</th>
                        <th>SKU (opcional)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinaciones.map((c, i) => {
                        const fila = { ...FILA_VACIA, ...filas[c.clave] };
                        const err = (campo: string) => f[`variantes.${i}.${campo}`];
                        const celda = (campo: keyof Fila, props: Record<string, string>) => (
                          <td>
                            <input
                              {...props}
                              value={fila[campo]}
                              aria-invalid={!!err(campo)}
                              onChange={(e) => editarFila(i, c.clave, campo, e.target.value)}
                            />
                            {err(campo) && <small className="field-error">{err(campo)}</small>}
                          </td>
                        );
                        return (
                          <tr key={c.clave}>
                            {c.opciones.map((o) => (
                              <td key={o.atributo.id} className="tabla-opcion">
                                {o.opcion.valor}
                              </td>
                            ))}
                            {celda('precio', { type: 'number', min: '0', step: '0.01', 'aria-label': 'Precio' })}
                            {celda('precio_oferta', { type: 'number', min: '0', step: '0.01', 'aria-label': 'Oferta' })}
                            {celda('stock', { type: 'number', min: '0', step: '1', 'aria-label': 'Stock' })}
                            {celda('sku', { type: 'text', 'aria-label': 'SKU' })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {errorVariantes && <small className="field-error">Revisá los valores marcados en la tabla.</small>}
            </>
          )}

          {puedeEditar && (
            <div className="actions">
              <button className="btn" type="submit" disabled={sending}>
                {sending ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
              </button>
              {!producto && <small className="field-hint">Se guarda como borrador; lo publicás después.</small>}
            </div>
          )}
        </div>
      </fieldset>
    </form>
  );
}
