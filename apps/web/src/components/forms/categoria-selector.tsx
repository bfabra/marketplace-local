'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Categoria } from '@/lib/api-client';
import { Icon } from '@/components/ui/icon';

const NIVELES = [
  { label: 'Categoría', placeholder: 'Elegí una categoría' },
  { label: 'Subcategoría', placeholder: 'Elegí la subcategoría' },
  { label: 'Tipo', placeholder: 'Elegí el tipo' },
];

/** Subcategorías de cada categoría; la clave '' agrupa las principales. */
function hijasPorPadre(categorias: Categoria[]) {
  const mapa = new Map<string, Categoria[]>();
  for (const c of categorias) {
    const clave = c.padre_id ?? '';
    mapa.set(clave, [...(mapa.get(clave) ?? []), c]);
  }
  return mapa;
}

/** Ids desde la categoría principal hasta `id`. */
function caminoDe(categorias: Categoria[], id: string) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const camino: string[] = [];
  for (let c = porId.get(id); c; c = c.padre_id ? porId.get(c.padre_id) : undefined) camino.unshift(c.id);
  return camino;
}

/** Un producto solo puede ir en el último nivel: una subcategoría sin subcategorías propias. */
export function esCategoriaFinal(categorias: Categoria[], id: string) {
  const categoria = categorias.find((c) => c.id === id);
  return !!categoria && categoria.padre_id !== null && !categorias.some((c) => c.padre_id === id);
}

interface CategoriaSelectorProps {
  categorias: Categoria[];
  /** Id de la categoría final, o '' mientras falte elegir algún nivel. */
  value: string;
  onChange: (id: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

/** Categoría, subcategoría y (si corresponde) tipo, uno debajo del otro y todos obligatorios. */
export function CategoriaSelector({ categorias, value, onChange, error, hint, disabled }: CategoriaSelectorProps) {
  const hijas = useMemo(() => hijasPorPadre(categorias), [categorias]);
  const [camino, setCamino] = useState<string[]>(() => caminoDe(categorias, value));

  useEffect(() => {
    if (value && camino[camino.length - 1] !== value) setCamino(caminoDe(categorias, value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, categorias]);

  function elegir(nivel: number, id: string) {
    setCamino([...camino.slice(0, nivel), ...(id ? [id] : [])]);
    onChange(id && nivel > 0 && !hijas.has(id) ? id : '');
  }

  const niveles: { opciones: Categoria[]; elegida: string }[] = [];
  for (let padre = ''; ; ) {
    const opciones = hijas.get(padre) ?? [];
    if (opciones.length === 0) break;
    const elegida = camino[niveles.length] ?? '';
    niveles.push({ opciones, elegida });
    if (!elegida) break;
    padre = elegida;
  }

  const revision = !!value && categorias.find((c) => c.id === value)?.revision;

  return (
    <div className="cat-selector">
      <div className="cat-selector-niveles">
        {categorias.length === 0 ? (
          <label className="field">
            <span>{NIVELES[0].label}</span>
            <select disabled>
              <option>Cargando…</option>
            </select>
          </label>
        ) : (
          niveles.map((n, i) => {
            const nivel = NIVELES[Math.min(i, NIVELES.length - 1)];
            return (
              <label className="field" key={i}>
                <span>{nivel.label}</span>
                <select
                  name={i === 0 ? 'categoria_id' : undefined}
                  value={n.elegida}
                  onChange={(e) => elegir(i, e.target.value)}
                  aria-invalid={!!error && !n.elegida}
                  disabled={disabled}
                  required
                >
                  <option value="">{nivel.placeholder}</option>
                  {n.opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>
            );
          })
        )}
      </div>
      {error && <small className="field-error">{error}</small>}
      {!error && hint && <small className="field-hint">{hint}</small>}
      {revision && (
        <p className="cat-selector-revision">
          <Icon name="shield" size={16} />
          Los productos de esta categoría los revisa el equipo de Tu Comercio Local antes de publicarse.
        </p>
      )}
    </div>
  );
}
