'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, type CategoriaAdmin } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { ListaScroll } from '@/components/ui/lista-scroll';
import { EncabezadoAdmin } from '@/components/admin/encabezado';
import { numero } from '@/components/admin/controles';
import { CatalogoTabs, arbolDeCategorias, opcionesDeCategorias, type NodoCategoria } from '@/components/admin/catalogo';

export default function AdminCategoriesPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Categorias />
    </Suspense>
  );
}

function Categorias() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const [lista, setLista] = useState<CategoriaAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);

  const nueva = params.get('nueva');
  const abrirNueva = (padre: string) => {
    router.replace(`${pathname}?nueva=${padre || 'raiz'}`, { scroll: false });
  };
  const cerrarNueva = () => router.replace(pathname, { scroll: false });

  const cargar = useCallback(() => {
    api<CategoriaAdmin[]>('/admin/categorias')
      .then(setLista)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, []);

  useEffect(cargar, [cargar]);

  const arbol = useMemo(() => (lista ? arbolDeCategorias(lista) : []), [lista]);

  async function mover(c: CategoriaAdmin, direccion: 'subir' | 'bajar') {
    setMoviendo(c.id);
    setError(null);
    try {
      setLista(await api<CategoriaAdmin[]>(`/admin/categorias/${c.id}/orden`, { method: 'PATCH', body: { direccion } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setMoviendo(null);
    }
  }

  const ocultas = lista?.filter((c) => !c.activa).length ?? 0;

  return (
    <div className="stack">
      <EncabezadoAdmin
        titulo="Categorías y atributos"
        descripcion="Ordená el menú del sitio, creá subcategorías y elegí qué datos completa cada producto."
      >
        {nueva === null && (
          <button className="btn" onClick={() => abrirNueva('')}>
            <Icon name="plus" size={18} /> Nueva categoría
          </button>
        )}
      </EncabezadoAdmin>

      <CatalogoTabs />

      {error && <Alert>{error}</Alert>}

      {lista && nueva !== null && (
        <NuevaCategoria
          lista={lista}
          padreInicial={nueva === 'raiz' ? '' : nueva}
          onCancelar={cerrarNueva}
          onCreada={(c) => {
            toast({ titulo: 'Categoría creada', texto: `${c.nombre} ya está en el menú. Sumale los atributos que necesite.` });
            router.push(`/admin/categorias/${c.id}`);
          }}
        />
      )}

      {!lista ? (
        <p>Cargando…</p>
      ) : lista.length === 0 ? (
        <EmptyState icono="grid" titulo="Todavía no hay categorías">
          Creá la primera para que las tiendas puedan cargar productos.
        </EmptyState>
      ) : (
        <>
          <p className="muted admin-total">
            {numero(lista.length)} {lista.length === 1 ? 'categoría' : 'categorías'}
            {ocultas > 0 && ` · ${numero(ocultas)} ${ocultas === 1 ? 'oculta' : 'ocultas'}`}
          </p>
          <div className="card cat-arbol-card">
            <ListaScroll etiqueta="Árbol de categorías">
              <Ramas
                nodos={arbol}
                moviendo={moviendo}
                onMover={mover}
                onNuevaSub={(c) => {
                  abrirNueva(c.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </ListaScroll>
          </div>
        </>
      )}
    </div>
  );
}

function Ramas({
  nodos,
  moviendo,
  onMover,
  onNuevaSub,
}: {
  nodos: NodoCategoria[];
  moviendo: string | null;
  onMover: (c: CategoriaAdmin, direccion: 'subir' | 'bajar') => void;
  onNuevaSub: (c: CategoriaAdmin) => void;
}) {
  return (
    <ul className="cat-arbol">
      {nodos.map((c, i) => (
        <li key={c.id}>
          <div className={c.activa ? 'cat-nodo' : 'cat-nodo cat-nodo-oculta'}>
            <span className="cat-orden">
              <button
                className="icon-btn icon-btn-sm"
                aria-label={`Subir ${c.nombre}`}
                title="Subir"
                disabled={i === 0 || moviendo !== null}
                onClick={() => onMover(c, 'subir')}
              >
                <Icon name="chevron-up" size={16} />
              </button>
              <button
                className="icon-btn icon-btn-sm"
                aria-label={`Bajar ${c.nombre}`}
                title="Bajar"
                disabled={i === nodos.length - 1 || moviendo !== null}
                onClick={() => onMover(c, 'bajar')}
              >
                <Icon name="chevron-down" size={16} />
              </button>
            </span>
            <span className="cat-nodo-info">
              <Link href={`/admin/categorias/${c.id}`}>
                <strong>{c.nombre}</strong>
              </Link>
              <span className="muted">
                {numero(c.productos.publicados)} {c.productos.publicados === 1 ? 'publicado' : 'publicados'}
                {c.atributos > 0 && ` · ${numero(c.atributos)} ${c.atributos === 1 ? 'atributo' : 'atributos'}`}
                {` · comisión ${numero(c.comision_pct)} %`}
              </span>
            </span>
            {c.requiere_revision && (
              <span className="badge badge-producto-revision" title="Sus productos pasan por moderación antes de publicarse">
                Con revisión
              </span>
            )}
            {!c.activa && <span className="badge badge-archivada">Oculta</span>}
            <button
              className="btn btn-ghost cat-sub"
              aria-label={`Nueva subcategoría de ${c.nombre}`}
              onClick={() => onNuevaSub(c)}
            >
              <Icon name="plus" size={16} /> Subcategoría
            </button>
          </div>
          {c.hijos.length > 0 && (
            <Ramas nodos={c.hijos} moviendo={moviendo} onMover={onMover} onNuevaSub={onNuevaSub} />
          )}
        </li>
      ))}
    </ul>
  );
}

function NuevaCategoria({
  lista,
  padreInicial,
  onCancelar,
  onCreada,
}: {
  lista: CategoriaAdmin[];
  padreInicial: string;
  onCancelar: () => void;
  onCreada: (c: { id: string; nombre: string }) => void;
}) {
  const opciones = useMemo(() => opcionesDeCategorias(lista), [lista]);
  const padreValido = lista.some((c) => c.id === padreInicial) ? padreInicial : '';
  const [nombre, setNombre] = useState('');
  const [padre, setPadre] = useState(padreValido);
  const [comision, setComision] = useState(() => String(lista.find((c) => c.id === padreValido)?.comision_pct ?? 10));
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPadre(padreValido);
    const madre = lista.find((c) => c.id === padreValido);
    if (madre) setComision(String(madre.comision_pct));
    nombreRef.current?.focus();
  }, [padreValido, lista]);

  const madre = lista.find((c) => c.id === padre);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2) {
      setError('El nombre tiene que tener al menos 2 caracteres.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const creada = await api<{ id: string; nombre: string }>('/admin/categorias', {
        method: 'POST',
        body: { nombre: nombre.trim(), padre_id: padre || null, comision_pct: Number(comision) },
      });
      onCreada(creada);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado');
      setEnviando(false);
    }
  }

  return (
    <form className="card stack" onSubmit={enviar} noValidate>
      <h2>{madre ? `Nueva subcategoría de ${madre.nombre}` : 'Nueva categoría'}</h2>
      {error && <Alert>{error}</Alert>}
      <div className="form-grid-3">
        <label className="field">
          Nombre
          <input ref={nombreRef} value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
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
        </label>
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
          <span className="field-hint">Lo que cobra la plataforma por cada venta.</span>
        </label>
      </div>
      {madre && !madre.activa && (
        <p className="aviso-banda">
          <Icon name="info" size={18} />
          {madre.nombre} está oculta, así que la nueva también nace oculta.
        </p>
      )}
      <div className="actions">
        <button className="btn" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear categoría'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
