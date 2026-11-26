'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ApiError,
  api,
  descargar,
  type Categoria,
  type DatosProducto,
  type ProductoEdicion,
  type ResultadoImportacion,
} from '@/lib/api-client';
import { formatearPrecioInput, parsearPrecioInput } from '@/lib/utils';
import { useFormErrors } from '@/components/forms/use-form-errors';
import { esCategoriaFinal } from '@/components/forms/categoria-selector';
import { ModalPortal } from '@/components/vendor/modal-portal';

/** Tope UI alineado a la maqueta; el API acepta hasta 8. */
const MAX_FOTOS_UI = 10;
const MAX_FOTOS_API = 8;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

type FotoLocal = { id: string; preview: string; archivo?: File; url?: string };

function principalesDe(categorias: Categoria[]) {
  return categorias.filter((c) => c.padre_id == null).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Hojas bajo un padre (subcategoría o tipo final), como el 2º select de la maqueta. */
function hojasBajo(categorias: Categoria[], padreId: string): Categoria[] {
  const hijas = categorias.filter((c) => c.padre_id === padreId);
  if (hijas.length === 0) {
    const self = categorias.find((c) => c.id === padreId);
    return self && esCategoriaFinal(categorias, self.id) ? [self] : [];
  }
  return hijas.flatMap((h) => {
    const nietas = categorias.filter((c) => c.padre_id === h.id);
    return nietas.length === 0 ? [h] : hojasBajo(categorias, h.id);
  });
}

/**
 * Modal #merchant-panel → add-product-modal (apariencia y campos de la maqueta).
 */
export function ModalPublicar({
  tiendaId,
  tiendaNombre,
  abierto,
  onCerrar,
  onPublicado,
  puedePublicar = false,
}: {
  tiendaId: string;
  tiendaNombre: string;
  abierto: boolean;
  onCerrar: () => void;
  onPublicado?: () => void;
  puedePublicar?: boolean;
}) {
  const errors = useFormErrors();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState('');
  const [precioTxt, setPrecioTxt] = useState('');
  const [sku, setSku] = useState('');
  const [marca, setMarca] = useState('');
  const [condicion, setCondicion] = useState('Nuevo');
  const [stock, setStock] = useState('10');
  const [categoriaPrincipal, setCategoriaPrincipal] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [errorFotos, setErrorFotos] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [loteArchivo, setLoteArchivo] = useState<File | null>(null);
  const [loteOcupado, setLoteOcupado] = useState<'plantilla' | 'revisando' | 'importando' | null>(null);
  const [loteRevision, setLoteRevision] = useState<ResultadoImportacion | null>(null);
  const [loteError, setLoteError] = useState<string | null>(null);
  const [lotePublicar, setLotePublicar] = useState(false);

  const principales = useMemo(() => principalesDe(categorias), [categorias]);
  const subcategorias = useMemo(
    () => (categoriaPrincipal ? hojasBajo(categorias, categoriaPrincipal) : []),
    [categorias, categoriaPrincipal]
  );

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    errors.clear();
    setNombre('');
    setPrecioTxt('');
    setSku('');
    setMarca('');
    setCondicion('Nuevo');
    setStock('10');
    setCategoriaPrincipal('');
    setCategoriaId('');
    setDescripcion('');
    setFotos((prev) => {
      prev.forEach((f) => {
        if (f.archivo) URL.revokeObjectURL(f.preview);
      });
      return [];
    });
    setErrorFotos(null);
    setLoteArchivo(null);
    setLoteOcupado(null);
    setLoteRevision(null);
    setLoteError(null);
    setLotePublicar(false);
    api<Categoria[]>('/catalog/categorias').then(setCategorias).catch(errors.set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tiendaId]);

  if (!abierto) return null;

  const f = errors.fields;
  const categoriaLista = esCategoriaFinal(categorias, categoriaId);

  async function bajarPlantilla() {
    setLoteError(null);
    if (!categoriaLista) {
      setLoteError('Elegí categoría y subcategoría para descargar la plantilla.');
      return;
    }
    setLoteOcupado('plantilla');
    try {
      await descargar(
        `/stores/${tiendaId}/products/plantilla?categoria=${categoriaId}`,
        'plantilla-productos.xlsx'
      );
    } catch (e) {
      setLoteError(e instanceof ApiError ? e.message : 'No pudimos descargar la plantilla');
    } finally {
      setLoteOcupado(null);
    }
  }

  async function enviarLote(file: File, confirmar: boolean, conPublicar = lotePublicar) {
    setLoteError(null);
    setLoteOcupado(confirmar ? 'importando' : 'revisando');
    const form = new FormData();
    form.append('archivo', file);
    form.append('publicar', String(puedePublicar && conPublicar));
    form.append('confirmar', String(confirmar));
    if (categoriaId) form.append('categoria_id', categoriaId);
    try {
      const r = await api<ResultadoImportacion>(`/stores/${tiendaId}/products/importar`, {
        method: 'POST',
        body: form,
      });
      if (r.categoria?.id) {
        const hoja = categorias.find((c) => c.id === r.categoria.id);
        if (hoja?.padre_id) {
          const padre = categorias.find((c) => c.id === hoja.padre_id);
          const raiz = padre?.padre_id
            ? categorias.find((c) => c.id === padre.padre_id)?.id ?? padre.id
            : padre?.id ?? '';
          setCategoriaPrincipal(raiz || hoja.padre_id);
        }
        setCategoriaId(r.categoria.id);
      }
      if (confirmar && r.guardado) {
        onPublicado?.();
        onCerrar();
        return;
      }
      setLoteRevision(r);
    } catch (e) {
      setLoteRevision(null);
      setLoteError(e instanceof ApiError ? e.message : 'No pudimos leer el archivo');
    } finally {
      setLoteOcupado(null);
    }
  }

  function elegirLote(file: File | undefined) {
    if (!file) return;
    setLoteRevision(null);
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setLoteArchivo(null);
      setLoteError('Subí la plantilla en Excel (.xlsx) o CSV.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLoteArchivo(null);
      setLoteError('El archivo puede pesar hasta 5 MB.');
      return;
    }
    setLoteArchivo(file);
    void enviarLote(file, false);
  }

  function onPrecio(valor: string) {
    errors.dismiss('variantes');
    setPrecioTxt(formatearPrecioInput(valor));
  }

  function agregarArchivos(e: ChangeEvent<HTMLInputElement>) {
    const lista = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!lista.length) return;
    setErrorFotos(null);
    const cupo = Math.min(MAX_FOTOS_UI, MAX_FOTOS_API) - fotos.length;
    if (cupo <= 0) {
      setErrorFotos(`Máximo ${MAX_FOTOS_API} fotos`);
      return;
    }
    const validas: FotoLocal[] = [];
    for (const archivo of lista.slice(0, cupo)) {
      if (!TIPOS_FOTO.includes(archivo.type)) {
        setErrorFotos('Las fotos tienen que ser JPG, PNG o WEBP');
        continue;
      }
      if (archivo.size > MAX_BYTES) {
        setErrorFotos('Cada foto puede pesar hasta 5 MB');
        continue;
      }
      validas.push({
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        preview: URL.createObjectURL(archivo),
        archivo,
      });
    }
    if (validas.length) setFotos((actual) => [...actual, ...validas]);
  }

  function agregarPorUrl() {
    const url = window.prompt('Ingrese la URL de la imagen del producto:')?.trim();
    if (!url) return;
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo');
    } catch {
      setErrorFotos('La URL de la imagen no es válida');
      return;
    }
    if (fotos.length >= Math.min(MAX_FOTOS_UI, MAX_FOTOS_API)) {
      setErrorFotos(`Máximo ${MAX_FOTOS_API} fotos`);
      return;
    }
    setErrorFotos(null);
    setFotos((actual) => [
      ...actual,
      {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        preview: url,
        url,
      },
    ]);
  }

  function quitarFoto(id: string) {
    setFotos((actual) => {
      const foto = actual.find((x) => x.id === id);
      if (foto?.archivo) URL.revokeObjectURL(foto.preview);
      return actual.filter((x) => x.id !== id);
    });
  }

  async function archivoDesdeUrl(url: string): Promise<File> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch');
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('tipo');
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `foto.${ext}`, { type: blob.type });
  }

  async function publicar(e: FormEvent) {
    e.preventDefault();
    errors.clear();
    setErrorFotos(null);

    const precio = parsearPrecioInput(precioTxt);
    const stockNum = Number(stock);
    const err: { path: string; message: string }[] = [];
    if (nombre.trim().length < 3) err.push({ path: 'nombre', message: 'El nombre debe tener al menos 3 caracteres' });
    if (!Number.isFinite(precio) || precio < 0) err.push({ path: 'variantes.0.precio', message: 'Ingresá el precio' });
    if (!marca.trim()) err.push({ path: 'marca', message: 'Ingresá la marca' });
    if (!Number.isInteger(stockNum) || stockNum < 0) err.push({ path: 'variantes.0.stock', message: 'Ingresá el stock' });
    if (!categoriaPrincipal) err.push({ path: 'categoria_principal', message: 'Seleccioná una categoría' });
    if (!categoriaId || !esCategoriaFinal(categorias, categoriaId)) {
      err.push({ path: 'categoria_id', message: 'Seleccioná una subcategoría' });
    }
    if (err.length) {
      errors.set(new ApiError('Por favor completa todos los campos obligatorios del producto.', 400, err));
      return;
    }

    const extras = [`Marca: ${marca.trim()}.`, `Estado: ${condicion}.`].join(' ');
    const desc = [descripcion.trim(), extras].filter(Boolean).join('\n');

    const datos: DatosProducto = {
      categoria_id: categoriaId,
      nombre: nombre.trim(),
      descripcion: desc || undefined,
      atributos: [],
      variantes: [
        {
          opciones: [],
          precio,
          stock: stockNum,
          sku: sku.trim() || null,
        },
      ],
    };

    setEnviando(true);
    try {
      const creado = await api<ProductoEdicion>(`/stores/${tiendaId}/products`, {
        method: 'POST',
        body: datos,
      });

      if (fotos.length > 0) {
        const form = new FormData();
        for (const foto of fotos.slice(0, MAX_FOTOS_API)) {
          if (foto.archivo) {
            form.append('fotos', foto.archivo);
          } else if (foto.url) {
            try {
              form.append('fotos', await archivoDesdeUrl(foto.url));
            } catch {
              setErrorFotos(
                'El producto se creó, pero no pudimos bajar una foto por URL. Subila desde la ficha del producto.'
              );
            }
          }
        }
        if ([...form.keys()].length > 0) {
          await api(`/stores/${tiendaId}/products/${creado.id}/imagenes`, {
            method: 'POST',
            body: form,
          }).catch(() => {
            setErrorFotos('El producto se creó, pero falló la subida de fotos. Completalas en la ficha.');
          });
        }
      }

      onPublicado?.();
      onCerrar();
    } catch (error) {
      errors.set(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ModalPortal>
      <div className="mp-modal-overlay" role="presentation">
        <div
          className="mp-modal mp-modal-producto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mp-modal-publicar-titulo"
        >
          <header className="mp-modal-cabecera mp-modal-producto-cabecera">
            <div>
              <h3 id="mp-modal-publicar-titulo">Publicar Producto o Carga Masiva</h3>
              <span>
                Sucursal: <strong>{tiendaNombre}</strong>
              </span>
            </div>
            <button
              type="button"
              className="mp-modal-cerrar mp-modal-cerrar-texto"
              onClick={() => !enviando && onCerrar()}
              aria-label="Cerrar"
            >
              ×
            </button>
          </header>

          <div className="mp-modal-cuerpo mp-modal-producto-cuerpo">
            {errors.message && (
              <p className="mp-modal-tienda-aviso" role="alert">
                {errors.message}
              </p>
            )}

            <div className="mp-modal-excel">
              <div>
                <h4>Carga Masiva Automática (Excel / CSV)</h4>
                <p>
                  Elegí la categoría, descargá la plantilla, completala y subila con el botón verde. No te lleva a otra
                  página.
                </p>
              </div>
              <div className="mp-modal-excel-cats">
                <label className="mp-prod-field">
                  <span>Categoría para la plantilla *</span>
                  <select
                    value={categoriaPrincipal}
                    onChange={(e) => {
                      setCategoriaPrincipal(e.target.value);
                      setCategoriaId('');
                      setLoteError(null);
                    }}
                  >
                    <option value="">Seleccione una categoría...</option>
                    {principales.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mp-prod-field">
                  <span>Subcategoría *</span>
                  <select
                    value={categoriaId}
                    disabled={!categoriaPrincipal}
                    onChange={(e) => {
                      setCategoriaId(e.target.value);
                      setLoteError(null);
                    }}
                  >
                    <option value="">
                      {categoriaPrincipal ? 'Seleccione una subcategoría...' : 'Primero seleccione una categoría'}
                    </option>
                    {subcategorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mp-modal-excel-acciones">
                <button
                  type="button"
                  className="mp-modal-excel-plantilla"
                  onClick={bajarPlantilla}
                  disabled={loteOcupado !== null}
                >
                  {loteOcupado === 'plantilla' ? 'Preparando plantilla…' : 'Descargar plantilla (Excel)'}
                </button>
                <label className="mp-modal-excel-btn" htmlFor="mp-lote-file-input">
                  {loteOcupado === 'revisando'
                    ? 'Revisando…'
                    : loteArchivo
                      ? loteArchivo.name
                      : 'Seleccionar Archivo Excel (.xlsx / .csv)'}
                  <input
                    id="mp-lote-file-input"
                    type="file"
                    accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    className="mp-modal-logo-input"
                    disabled={loteOcupado !== null}
                    onChange={(e) => {
                      elegirLote(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {loteError && (
                <small className="mp-modal-excel-err" role="alert">
                  {loteError}
                </small>
              )}
              {loteRevision && loteArchivo && (
                <div className="mp-modal-excel-revision">
                  <p>
                    <strong>{loteRevision.productos.length}</strong> producto
                    {loteRevision.productos.length === 1 ? '' : 's'} · categoría{' '}
                    <strong>{loteRevision.categoria.etiqueta}</strong>
                    {loteRevision.errores.length > 0 && (
                      <>
                        {' '}
                        · <span className="mp-modal-excel-err-inline">{loteRevision.errores.length} problema(s)</span>
                      </>
                    )}
                  </p>
                  {loteRevision.errores.length > 0 ? (
                    <ul className="mp-modal-excel-errores">
                      {loteRevision.errores.slice(0, 5).map((e, i) => (
                        <li key={i}>
                          {e.fila != null ? `Fila ${e.fila}` : 'Archivo'}
                          {e.columna ? ` · ${e.columna}` : ''}: {e.mensaje}
                        </li>
                      ))}
                      {loteRevision.errores.length > 5 && (
                        <li>…y {loteRevision.errores.length - 5} más. Corregí el archivo y volvé a subirlo.</li>
                      )}
                    </ul>
                  ) : (
                    <>
                      {puedePublicar && (
                        <label className="mp-modal-excel-check">
                          <input
                            type="checkbox"
                            checked={lotePublicar}
                            disabled={loteOcupado !== null}
                            onChange={(e) => {
                              setLotePublicar(e.target.checked);
                              void enviarLote(loteArchivo, false, e.target.checked);
                            }}
                          />
                          Publicar los productos al importarlos
                        </label>
                      )}
                      <button
                        type="button"
                        className="mp-modal-excel-confirmar"
                        disabled={loteOcupado !== null}
                        onClick={() => void enviarLote(loteArchivo, true)}
                      >
                        {loteOcupado === 'importando' ? 'Importando…' : 'Confirmar importación'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mp-modal-o">
              <hr />
              <span>O CARGAR / EDITAR PRODUCTO INDIVIDUAL</span>
              <hr />
            </div>

            <form id="mp-create-product-form" className="mp-prod-form" onSubmit={publicar} noValidate>
              <div className="mp-prod-form-grid-nombre">
                <label className={`mp-prod-field${f.nombre ? ' is-error' : ''}`}>
                  <span>Nombre del Producto / Pack / Servicio *</span>
                  <input
                    type="text"
                    value={nombre}
                    maxLength={120}
                    placeholder="Ej. Zapatillas Urbanas Pro"
                    onChange={(e) => {
                      errors.dismiss('nombre');
                      setNombre(e.target.value);
                    }}
                  />
                  {f.nombre && <small role="alert">{f.nombre}</small>}
                </label>
                <label className={`mp-prod-field${f['variantes.0.precio'] ? ' is-error' : ''}`}>
                  <span>Precio ($ARS) *</span>
                  <div className="mp-prod-precio">
                    <span aria-hidden="true">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={precioTxt}
                      placeholder="0,00"
                      autoComplete="off"
                      onChange={(e) => onPrecio(e.target.value)}
                    />
                  </div>
                  {f['variantes.0.precio'] && <small role="alert">{f['variantes.0.precio']}</small>}
                </label>
              </div>

              <div className="mp-prod-form-grid-4">
                <label className="mp-prod-field">
                  <span>SKU / Código</span>
                  <input
                    type="text"
                    value={sku}
                    maxLength={60}
                    placeholder="Ej. ZAP-001"
                    onChange={(e) => setSku(e.target.value)}
                  />
                </label>
                <label className={`mp-prod-field${f.marca ? ' is-error' : ''}`}>
                  <span>Marca *</span>
                  <input
                    type="text"
                    value={marca}
                    maxLength={80}
                    placeholder="Ej. Nike / Local"
                    onChange={(e) => {
                      errors.dismiss('marca');
                      setMarca(e.target.value);
                    }}
                  />
                  {f.marca && <small role="alert">{f.marca}</small>}
                </label>
                <label className="mp-prod-field">
                  <span>Estado *</span>
                  <select value={condicion} onChange={(e) => setCondicion(e.target.value)}>
                    <option value="Nuevo">Nuevo</option>
                    <option value="Usado">Usado</option>
                    <option value="Reacondicionado">Reacondicionado</option>
                  </select>
                </label>
                <label className={`mp-prod-field${f['variantes.0.stock'] ? ' is-error' : ''}`}>
                  <span>Stock *</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={stock}
                    onChange={(e) => {
                      errors.dismiss('variantes.0.stock');
                      setStock(e.target.value.replace(/\D/g, ''));
                    }}
                  />
                  {f['variantes.0.stock'] && <small role="alert">{f['variantes.0.stock']}</small>}
                </label>
              </div>

              <div className="mp-prod-form-grid-2">
                <label className={`mp-prod-field${f.categoria_principal ? ' is-error' : ''}`}>
                  <span>Categoría Principal *</span>
                  <select
                    value={categoriaPrincipal}
                    onChange={(e) => {
                      errors.dismiss('categoria_principal');
                      errors.dismiss('categoria_id');
                      setCategoriaPrincipal(e.target.value);
                      setCategoriaId('');
                    }}
                  >
                    <option value="">Seleccione una categoría...</option>
                    {principales.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  {f.categoria_principal && <small role="alert">{f.categoria_principal}</small>}
                </label>
                <label className={`mp-prod-field${f.categoria_id ? ' is-error' : ''}`}>
                  <span>Subcategoría *</span>
                  <select
                    value={categoriaId}
                    disabled={!categoriaPrincipal}
                    onChange={(e) => {
                      errors.dismiss('categoria_id');
                      setCategoriaId(e.target.value);
                    }}
                  >
                    <option value="">
                      {categoriaPrincipal ? 'Seleccione una subcategoría...' : 'Primero seleccione una categoría'}
                    </option>
                    {subcategorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  {f.categoria_id && <small role="alert">{f.categoria_id}</small>}
                </label>
              </div>

              <label className="mp-prod-field">
                <span>Descripción Detallada</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={descripcion}
                  placeholder="Detalles, materiales, tamaños, condiciones..."
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </label>

              <div className="mp-prod-fotos">
                <div className="mp-prod-fotos-cabecera">
                  <strong>Fotografías del Producto (Hasta {MAX_FOTOS_UI})</strong>
                  <span>
                    {fotos.length} de {MAX_FOTOS_UI} añadidas
                  </span>
                </div>
                <div className="mp-prod-fotos-acciones">
                  <label className="mp-prod-fotos-local" htmlFor="mp-prod-fotos-input">
                    Subir desde Computadora
                    <input
                      id="mp-prod-fotos-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="mp-modal-logo-input"
                      onChange={agregarArchivos}
                    />
                  </label>
                  <button type="button" className="mp-prod-fotos-url" onClick={agregarPorUrl}>
                    Agregar por URL de Imagen
                  </button>
                </div>
                {errorFotos && (
                  <small className="mp-modal-logo-err" role="alert">
                    {errorFotos}
                  </small>
                )}
                {fotos.length > 0 && (
                  <ul className="mp-prod-fotos-grid">
                    {fotos.map((foto) => (
                      <li key={foto.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.preview} alt="" />
                        <button type="button" aria-label="Quitar foto" onClick={() => quitarFoto(foto.id)}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
          </div>

          <footer className="mp-modal-pie mp-modal-producto-pie">
            <button
              type="button"
              className="mp-modal-pie-cancelar"
              onClick={() => !enviando && onCerrar()}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="mp-create-product-form"
              className="mp-modal-pie-primary mp-modal-producto-submit"
              disabled={enviando}
            >
              {enviando ? 'Publicando…' : 'Publicar Producto / Servicio'}
            </button>
          </footer>
        </div>
      </div>
    </ModalPortal>
  );
}
