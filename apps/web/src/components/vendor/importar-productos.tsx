'use client';

import { useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { ApiError, api, descargar, type Categoria, type ResultadoImportacion } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { CategoriaSelector, esCategoriaFinal } from '@/components/forms/categoria-selector';
import { recordarCategoria, ultimaCategoria } from '@/components/forms/product-form';

type Producto = ResultadoImportacion['productos'][number];

const MAX_MB = 5;
const MAX_FOTOS = 8;
const mensaje = (e: unknown) => (e instanceof ApiError ? e.message : 'Error inesperado');
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Qué le pasa a cada producto al importarlo (o qué le pasó). */
function destino(p: Producto): { clase: string; texto: string; detalle?: string } {
  if (p.estado === 'publicado') return { clase: 'publicado', texto: 'Se publica' };
  if (p.estado === 'pausado' && p.motivo_pausa === 'revision') {
    return { clase: 'revision', texto: 'Pasa por moderación' };
  }
  return { clase: 'borrador', texto: 'Borrador', detalle: p.aviso ?? undefined };
}

const filasDe = (p: Producto) =>
  p.filas.length > 1 ? `${p.filas[0]}–${p.filas[p.filas.length - 1]}` : String(p.filas[0]);

export function ImportarProductos({
  tiendaId,
  categorias,
  puedePublicar,
}: {
  tiendaId: string;
  categorias: Categoria[];
  puedePublicar: boolean;
}) {
  const [categoriaId, setCategoriaId] = useState(() => {
    const ultima = ultimaCategoria(tiendaId);
    return ultima && esCategoriaFinal(categorias, ultima) ? ultima : '';
  });
  const [errorCategoria, setErrorCategoria] = useState<string>();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [publicar, setPublicar] = useState(false);
  const [ocupado, setOcupado] = useState<'plantilla' | 'revisando' | 'importando' | null>(null);
  const [revision, setRevision] = useState<ResultadoImportacion | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const categoria = categorias.find((c) => c.id === categoriaId);

  async function bajarPlantilla() {
    setError(null);
    if (!esCategoriaFinal(categorias, categoriaId)) {
      setErrorCategoria('Elegí la categoría y todos sus niveles: la plantilla es para la última.');
      return;
    }
    setOcupado('plantilla');
    try {
      await descargar(`/stores/${tiendaId}/products/plantilla?categoria=${categoriaId}`, 'plantilla-productos.xlsx');
      recordarCategoria(tiendaId, categoriaId);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setOcupado(null);
    }
  }

  async function enviar(file: File, confirmar: boolean, conPublicar = publicar) {
    setError(null);
    setOcupado(confirmar ? 'importando' : 'revisando');
    const form = new FormData();
    form.append('archivo', file);
    form.append('publicar', String(puedePublicar && conPublicar));
    form.append('confirmar', String(confirmar));
    if (categoriaId) form.append('categoria_id', categoriaId);
    try {
      const r = await api<ResultadoImportacion>(`/stores/${tiendaId}/products/importar`, { method: 'POST', body: form });
      // La plantilla trae su categoría: manda sobre la elegida.
      setCategoriaId(r.categoria.id);
      setErrorCategoria(undefined);
      if (confirmar && r.guardado) {
        recordarCategoria(tiendaId, r.categoria.id);
        setResultado(r);
        setRevision(null);
      } else {
        setRevision(r);
      }
    } catch (e) {
      setRevision(null);
      setError(mensaje(e));
    } finally {
      setOcupado(null);
    }
  }

  function elegir(file: File | undefined) {
    if (!file) return;
    setRevision(null);
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setArchivo(null);
      setError('Subí la plantilla en Excel (.xlsx) o guardada como CSV.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setArchivo(null);
      setError(`El archivo puede pesar hasta ${MAX_MB} MB.`);
      return;
    }
    setArchivo(file);
    void enviar(file, false);
  }

  function soltar(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setArrastrando(false);
    elegir(e.dataTransfer.files[0]);
  }

  function reiniciar() {
    setResultado(null);
    setRevision(null);
    setArchivo(null);
    setError(null);
  }

  if (resultado) return <Resultado tiendaId={tiendaId} resultado={resultado} onOtro={reiniciar} />;

  return (
    <div className="stack importar">
      <section className="card stack importar-paso">
        <header className="importar-cab">
          <span className="importar-num">1</span>
          <div>
            <h2>Descargá la plantilla</h2>
            <p className="muted">
              Viene armada para la categoría que elijas: columnas de variantes y ficha técnica, listas desplegables con
              los valores válidos y una hoja de instrucciones.
            </p>
          </div>
        </header>
        <CategoriaSelector
          categorias={categorias}
          value={categoriaId}
          onChange={(id) => {
            setCategoriaId(id);
            setErrorCategoria(undefined);
          }}
          error={errorCategoria}
        />
        {categoria?.revision && (
          <p className="cat-selector-revision">
            <Icon name="shield" size={16} />
            Los productos de esta categoría pasan por moderación antes de publicarse.
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={bajarPlantilla} disabled={ocupado !== null}>
            <Icon name="download" size={16} /> {ocupado === 'plantilla' ? 'Preparando…' : 'Descargar plantilla (Excel)'}
          </button>
        </div>
      </section>

      <section className="card stack importar-paso">
        <header className="importar-cab">
          <span className="importar-num">2</span>
          <div>
            <h2>Completala y subila</h2>
            <p className="muted">
              Una fila por producto. Si tiene variantes (talles, colores…), una fila por variante con el mismo «Código
              de producto». Antes de guardar vas a ver una vista previa.
            </p>
          </div>
        </header>

        <label
          className="importar-zona"
          data-arrastrando={arrastrando || undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
        >
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            disabled={ocupado !== null}
            onChange={(e) => {
              elegir(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Icon name="planilla" size={28} />
          {archivo ? (
            <span>
              <strong>{archivo.name}</strong>
              <small className="field-hint">
                {Math.max(1, Math.round(archivo.size / 1024))} KB · Hacé clic o arrastrá otro para cambiarlo
              </small>
            </span>
          ) : (
            <span>
              <strong>Arrastrá el archivo acá o hacé clic para elegirlo</strong>
              <small className="field-hint">
                Excel (.xlsx) o CSV, hasta {MAX_MB} MB y 500 productos por archivo
              </small>
            </span>
          )}
        </label>

        {puedePublicar && (
          <label className="check">
            <input
              type="checkbox"
              checked={publicar}
              disabled={ocupado !== null}
              onChange={(e) => {
                setPublicar(e.target.checked);
                if (archivo && revision) void enviar(archivo, false, e.target.checked);
              }}
            />
            <span>
              Publicar los productos al importarlos
              <small className="field-hint">
                Si no lo marcás, quedan como borradores para que les sumes fotos y los publiques después.
              </small>
            </span>
          </label>
        )}
      </section>

      {error && <Alert>{error}</Alert>}
      {ocupado === 'revisando' && (
        <p className="muted importar-estado" role="status">
          Revisando el archivo…
        </p>
      )}

      {revision && archivo && (
        <Revision
          revision={revision}
          importando={ocupado === 'importando'}
          ocupado={ocupado !== null}
          onImportar={() => enviar(archivo, true)}
          onCambiar={() => input.current?.click()}
        />
      )}
    </div>
  );
}

function Revision({
  revision,
  importando,
  ocupado,
  onImportar,
  onCambiar,
}: {
  revision: ResultadoImportacion;
  importando: boolean;
  ocupado: boolean;
  onImportar: () => void;
  onCambiar: () => void;
}) {
  const { productos, errores } = revision;
  const variantes = productos.reduce((total, p) => total + p.variantes, 0);
  const hayErrores = errores.length > 0;
  const enRevision = productos.filter((p) => destino(p).clase === 'revision').length;
  const sinPublicar = productos.filter((p) => p.aviso).length;

  return (
    <section className="card stack importar-paso" aria-live="polite">
      <header className="importar-cab">
        <span className="importar-num">3</span>
        <div>
          <h2>{hayErrores ? 'Corregí el archivo' : 'Revisá y confirmá'}</h2>
          <p className="muted">Categoría: {revision.categoria.etiqueta}</p>
        </div>
      </header>

      <ul className="importar-cifras">
        <li>
          <strong>{productos.length}</strong> {productos.length === 1 ? 'producto' : 'productos'}
        </li>
        <li>
          <strong>{variantes}</strong> {variantes === 1 ? 'variante' : 'variantes'}
        </li>
        <li>
          <strong>{revision.filas}</strong> {revision.filas === 1 ? 'fila' : 'filas'}
        </li>
        {hayErrores && (
          <li className="importar-cifra-error">
            <strong>{errores.length}</strong> {errores.length === 1 ? 'problema' : 'problemas'}
          </li>
        )}
      </ul>

      {revision.avisos.map((a) => (
        <Alert key={a} kind="info">
          {a}
        </Alert>
      ))}

      {hayErrores ? (
        <>
          <Alert>
            No se guardó nada. Corregí estas filas en tu archivo y volvé a subirlo: los números de fila son los de
            Excel.
          </Alert>
          <div className="tabla-scroll importar-tabla">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Columna</th>
                  <th>Qué corregir</th>
                </tr>
              </thead>
              <tbody>
                {errores.map((e, i) => (
                  <tr key={i}>
                    <td>{e.fila ?? '—'}</td>
                    <td>{e.columna ?? '—'}</td>
                    <td>{e.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={onCambiar} disabled={ocupado}>
              <Icon name="upload" size={16} /> Subir el archivo corregido
            </button>
          </div>
        </>
      ) : (
        <>
          {(enRevision > 0 || sinPublicar > 0) && (
            <Alert kind="info">
              {enRevision > 0 && `${plural(enRevision, 'producto pasa', 'productos pasan')} por moderación antes de verse en la tienda. `}
              {sinPublicar > 0 &&
                `${plural(sinPublicar, 'producto queda', 'productos quedan')} en borrador porque no se pueden publicar (mirá el detalle).`}
            </Alert>
          )}
          <div className="tabla-scroll importar-tabla">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Variantes</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Al importar</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => {
                  const d = destino(p);
                  return (
                    <tr key={p.filas[0]}>
                      <td>{filasDe(p)}</td>
                      <td>{p.codigo ?? '—'}</td>
                      <td>{p.nombre}</td>
                      <td>{p.variantes}</td>
                      <td>
                        {p.variantes > 1 && <small className="muted">desde </small>}
                        {formatPrice(p.precio)}
                      </td>
                      <td>{p.stock}</td>
                      <td>
                        <span className={`badge badge-producto-${d.clase}`}>{d.texto}</span>
                        {d.detalle && <small className="field-hint">{d.detalle}</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={onImportar} disabled={ocupado}>
              {importando ? 'Importando…' : `Importar ${plural(productos.length, 'producto', 'productos')}`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCambiar} disabled={ocupado}>
              Elegir otro archivo
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Resultado({
  tiendaId,
  resultado,
  onOtro,
}: {
  tiendaId: string;
  resultado: ResultadoImportacion;
  onOtro: () => void;
}) {
  const { productos } = resultado;
  const publicados = productos.filter((p) => p.estado === 'publicado').length;

  return (
    <div className="stack importar">
      <section className="card stack lote-fin">
        <Icon name="check" size={32} />
        <h2>¡Listo! Importaste {plural(productos.length, 'producto', 'productos')}</h2>
        <p className="muted">
          {publicados === productos.length
            ? 'Ya están publicados. Sumales fotos para que se vean mejor.'
            : publicados > 0
              ? `${plural(publicados, 'quedó publicado', 'quedaron publicados')}; el resto está en borrador o esperando moderación.`
              : 'Quedaron como borradores: sumales fotos y publicalos desde la lista de productos.'}
        </p>
        <div className="actions">
          <Link href={`/vendor/tiendas/${tiendaId}/productos`} className="btn">
            Ir a mis productos
          </Link>
          <button type="button" className="btn btn-secondary" onClick={onOtro}>
            Importar otro archivo
          </button>
        </div>
      </section>

      <section className="card stack">
        <div>
          <h2>Sumá las fotos</h2>
          <p className="muted">Hasta {MAX_FOTOS} por producto, JPG, PNG o WEBP de hasta 5 MB. La primera es la principal.</p>
        </div>
        <ul className="importados">
          {productos.map((p) => (
            <Importado key={p.id ?? p.filas[0]} tiendaId={tiendaId} producto={p} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Importado({ tiendaId, producto }: { tiendaId: string; producto: Producto }) {
  const [fotos, setFotos] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const d = destino(producto);

  async function subir(archivos: File[]) {
    if (!archivos.length || !producto.id) return;
    setError(null);
    setSubiendo(true);
    const form = new FormData();
    archivos.slice(0, MAX_FOTOS - fotos).forEach((f) => form.append('fotos', f));
    try {
      const r = await api<{ imagenes: unknown[] }>(`/stores/${tiendaId}/products/${producto.id}/imagenes`, {
        method: 'POST',
        body: form,
      });
      setFotos(r.imagenes.length);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <li className="importado">
      <div className="importado-info">
        {producto.id ? (
          <Link href={`/vendor/tiendas/${tiendaId}/productos/${producto.id}`}>{producto.nombre}</Link>
        ) : (
          <span>{producto.nombre}</span>
        )}
        <small className="muted">
          {producto.codigo ? `${producto.codigo} · ` : ''}
          {plural(producto.variantes, 'variante', 'variantes')}
        </small>
        {d.detalle && <small className="field-hint">{d.detalle}</small>}
        {error && <small className="field-error">{error}</small>}
      </div>
      <span className={`badge badge-producto-${d.clase}`}>{d.texto === 'Se publica' ? 'Publicado' : d.texto}</span>
      <div className="importado-fotos">
        {fotos > 0 && <small className="muted">{plural(fotos, 'foto', 'fotos')}</small>}
        {fotos < MAX_FOTOS && (
          <>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => {
                void subir(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => input.current?.click()}
              disabled={subiendo || !producto.id}
            >
              <Icon name="image" size={16} /> {subiendo ? 'Subiendo…' : fotos ? 'Sumar más' : 'Agregar fotos'}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
