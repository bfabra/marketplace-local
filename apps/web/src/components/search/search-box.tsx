'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api, type Sugerencias } from '@/lib/api-client';
import { useLocation } from '@/hooks/use-location';
import { useClickOutside } from '@/hooks/use-click-outside';
import { formatPrice } from '@/lib/utils';
import { iniciales, raizDeRuta, visualCategoria } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';

const CLAVE_RECIENTES = 'tcl_busquedas';
const ESPERA_MS = 180;

type Opcion =
  | { tipo: 'buscar'; texto: string; href: string }
  | { tipo: 'reciente'; texto: string; href: string }
  | { tipo: 'producto'; item: Sugerencias['productos'][number]; href: string }
  | { tipo: 'tienda'; item: Sugerencias['tiendas'][number]; href: string }
  | { tipo: 'categoria'; item: Sugerencias['categorias'][number]; href: string };

const hrefBusqueda = (texto: string) => `/buscar?q=${encodeURIComponent(texto)}`;

function leerRecientes(): string[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
    return Array.isArray(lista) ? lista.filter((t): t is string => typeof t === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function recordar(texto: string) {
  const lista = [texto, ...leerRecientes().filter((t) => t.toLowerCase() !== texto.toLowerCase())].slice(0, 5);
  localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista));
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Resalta la parte del texto que coincide con lo buscado. */
function Resaltado({ texto, buscado }: { texto: string; buscado: string }) {
  const i = sinAcentos(texto).indexOf(sinAcentos(buscado.trim()));
  if (!buscado.trim() || i < 0) return <>{texto}</>;
  const fin = i + buscado.trim().length;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, fin)}</mark>
      {texto.slice(fin)}
    </>
  );
}

/** Buscador con autocompletado: productos, tiendas y categorías mientras escribís. */
export function SearchBox({ className = '', autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { localidad } = useLocation();
  const id = useId();
  const contenedor = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);

  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencias | null>(null);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [recientes, setRecientes] = useState<string[]>([]);

  // En la página de resultados, el buscador muestra lo que se buscó.
  useEffect(() => {
    setTexto(pathname === '/buscar' ? params.get('q') ?? '' : '');
  }, [pathname, params]);

  useEffect(() => {
    setAbierto(false);
  }, [pathname, params]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setActivo(-1);
  }, []);
  useClickOutside(contenedor, abierto, cerrar);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setSugerencias(null);
      setCargando(false);
      return;
    }
    setCargando(true);
    const numero = ++pedido.current;
    const espera = window.setTimeout(() => {
      const query = new URLSearchParams({ q });
      if (localidad) query.set('localidad', localidad.id);
      api<Sugerencias>(`/catalog/sugerencias?${query}`)
        .then((s) => numero === pedido.current && setSugerencias(s))
        .catch(() => numero === pedido.current && setSugerencias(null))
        .finally(() => numero === pedido.current && setCargando(false));
    }, ESPERA_MS);
    return () => window.clearTimeout(espera);
  }, [texto, localidad]);

  const q = texto.trim();
  const opciones = useMemo<Opcion[]>(() => {
    if (q.length < 2) return recientes.map((r) => ({ tipo: 'reciente', texto: r, href: hrefBusqueda(r) }));
    const lista: Opcion[] = [{ tipo: 'buscar', texto: q, href: hrefBusqueda(q) }];
    if (!sugerencias) return lista;
    sugerencias.categorias.forEach((c) => lista.push({ tipo: 'categoria', item: c, href: `/buscar?categoria=${c.id}` }));
    sugerencias.productos.forEach((p) =>
      lista.push({ tipo: 'producto', item: p, href: `/tiendas/${p.tiendaSlug}/${p.slug}` })
    );
    sugerencias.tiendas.forEach((t) => lista.push({ tipo: 'tienda', item: t, href: `/tiendas/${t.slug}` }));
    return lista;
  }, [q, sugerencias, recientes]);

  function ir(opcion: Opcion) {
    if (opcion.tipo === 'buscar' || opcion.tipo === 'reciente') recordar(opcion.texto);
    cerrar();
    input.current?.blur();
    router.push(opcion.href);
  }

  function onSubmit(e: FormEvent | KeyboardEvent) {
    e.preventDefault();
    if (activo >= 0 && opciones[activo]) return ir(opciones[activo]);
    if (!q) return input.current?.focus();
    ir({ tipo: 'buscar', texto: q, href: hrefBusqueda(q) });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) setAbierto(true);
      const n = opciones.length;
      if (n === 0) return;
      setActivo((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      onSubmit(e);
    } else if (e.key === 'Escape') {
      cerrar();
    }
  }

  const listaId = `${id}-lista`;
  const opcionId = (i: number) => `${id}-op-${i}`;
  const mostrarPanel = abierto && (opciones.length > 0 || (q.length >= 2 && cargando));
  const sinResultados =
    q.length >= 2 && !cargando && sugerencias !== null && opciones.length === 1;

  const renderOpcion = (o: Opcion, i: number) => {
    const props = {
      id: opcionId(i),
      role: 'option' as const,
      'aria-selected': activo === i,
      className: `sugerencia${activo === i ? ' is-activa' : ''}`,
      onMouseEnter: () => setActivo(i),
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
      onClick: () => ir(o),
    };
    switch (o.tipo) {
      case 'buscar':
        return (
          <li key="buscar" {...props}>
            <span className="sugerencia-icono">
              <Icon name="search" size={16} />
            </span>
            <span className="sugerencia-texto">
              Buscar <strong>“{o.texto}”</strong>
              {localidad && <span className="muted"> en {localidad.nombre}</span>}
            </span>
          </li>
        );
      case 'reciente':
        return (
          <li key={`r-${o.texto}`} {...props}>
            <span className="sugerencia-icono">
              <Icon name="history" size={16} />
            </span>
            <span className="sugerencia-texto">{o.texto}</span>
          </li>
        );
      case 'categoria': {
        const visual = visualCategoria(raizDeRuta(o.item.ruta));
        return (
          <li key={`c-${o.item.id}`} {...props}>
            <span className="sugerencia-icono" style={{ background: visual.tono.bg, color: visual.tono.fg }}>
              <Icon name={visual.icono} size={16} />
            </span>
            <span className="sugerencia-texto">
              <Resaltado texto={o.item.nombre} buscado={q} />
              <span className="muted"> · Categoría</span>
            </span>
          </li>
        );
      }
      case 'producto':
        return (
          <li key={`p-${o.item.id}`} {...props}>
            {o.item.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.item.imagen} alt="" className="sugerencia-img" />
            ) : (
              <span className="sugerencia-img sugerencia-img-vacia">
                <Icon name="image" size={16} />
              </span>
            )}
            <span className="sugerencia-texto">
              <span className="sugerencia-nombre">
                <Resaltado texto={o.item.nombre} buscado={q} />
              </span>
              <span className="muted sugerencia-sub">{o.item.tienda}</span>
            </span>
            {o.item.precio !== null && (
              <span className="sugerencia-precio">{formatPrice(o.item.precio_oferta ?? o.item.precio)}</span>
            )}
          </li>
        );
      case 'tienda':
        return (
          <li key={`t-${o.item.id}`} {...props}>
            <span className="sugerencia-icono sugerencia-tienda">{iniciales(o.item.nombre)}</span>
            <span className="sugerencia-texto">
              <span className="sugerencia-nombre">
                <Resaltado texto={o.item.nombre} buscado={q} />
              </span>
              <span className="muted sugerencia-sub">Tienda · {o.item.localidad}</span>
            </span>
          </li>
        );
    }
  };

  // Agrupa visualmente sin romper el índice continuo para el teclado.
  const grupos: { titulo: string | null; desde: number; hasta: number }[] = [];
  let indice = 0;
  const agregarGrupo = (titulo: string | null, cantidad: number) => {
    if (cantidad > 0) grupos.push({ titulo, desde: indice, hasta: indice + cantidad });
    indice += cantidad;
  };
  if (q.length < 2) agregarGrupo('Búsquedas recientes', opciones.length);
  else {
    agregarGrupo(null, 1);
    agregarGrupo('Categorías', sugerencias?.categorias.length ?? 0);
    agregarGrupo('Productos', sugerencias?.productos.length ?? 0);
    agregarGrupo('Tiendas', sugerencias?.tiendas.length ?? 0);
  }

  return (
    <form ref={contenedor} role="search" className={`search ${className}`} onSubmit={onSubmit}>
      <Icon name="search" size={17} className="search-lupa" />
      <input
        ref={input}
        type="search"
        className="search-input"
        placeholder="Buscar tiendas, rubros o productos"
        aria-label="Buscar tiendas, rubros o productos"
        role="combobox"
        aria-expanded={mostrarPanel}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={activo >= 0 ? opcionId(activo) : undefined}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setActivo(-1);
          setAbierto(true);
        }}
        onFocus={() => {
          setRecientes(leerRecientes());
          setAbierto(true);
        }}
        onKeyDown={onKeyDown}
      />
      {texto && (
        <button
          type="button"
          className="search-limpiar"
          aria-label="Borrar búsqueda"
          onClick={() => {
            setTexto('');
            input.current?.focus();
          }}
        >
          <Icon name="x" size={16} />
        </button>
      )}
      <button type="submit" className="search-boton">
        <span className="sr-only">Buscar</span>
        <Icon name="chevron-right" size={15} />
      </button>

      {mostrarPanel && (
        <div className="search-panel">
          <ul id={listaId} role="listbox" aria-label="Sugerencias">
            {grupos.map((g) => (
              <li key={`${g.titulo}-${g.desde}`} role="presentation" className="sugerencia-grupo">
                {g.titulo && <span className="sugerencia-titulo">{g.titulo}</span>}
                <ul role="group">{opciones.slice(g.desde, g.hasta).map((o, k) => renderOpcion(o, g.desde + k))}</ul>
              </li>
            ))}
          </ul>
          {cargando && q.length >= 2 && (
            <p className="search-estado">
              <span className="spinner" /> Buscando…
            </p>
          )}
          {sinResultados && (
            <p className="search-estado">
              No encontramos coincidencias{localidad ? ` en ${localidad.nombre}` : ''}. Probá con otra palabra.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
