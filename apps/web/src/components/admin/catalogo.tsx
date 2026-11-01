'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CategoriaAdmin, TipoAtributo } from '@/lib/api-client';

export const TIPOS_ATRIBUTO: { tipo: TipoAtributo; label: string; ayuda: string }[] = [
  { tipo: 'lista', label: 'Lista de opciones', ayuda: 'Talle, color, memoria… Es el único que puede definir variantes.' },
  { tipo: 'texto', label: 'Texto libre', ayuda: 'Material, modelo, origen…' },
  { tipo: 'numero', label: 'Número', ayuda: 'Peso, medidas, capacidad… Podés indicar la unidad.' },
  { tipo: 'si_no', label: 'Sí o no', ayuda: 'Apto lavarropas, incluye cargador…' },
];

export const etiquetaTipo = (tipo: TipoAtributo) => TIPOS_ATRIBUTO.find((t) => t.tipo === tipo)?.label ?? tipo;

export function CatalogoTabs() {
  const pathname = usePathname();
  const enAtributos = pathname.startsWith('/admin/categorias/atributos');
  return (
    <nav className="tabs" aria-label="Catálogo">
      <Link href="/admin/categorias" className="tab" aria-current={!enAtributos ? 'page' : undefined}>
        Categorías
      </Link>
      <Link href="/admin/categorias/atributos" className="tab" aria-current={enAtributos ? 'page' : undefined}>
        Atributos
      </Link>
    </nav>
  );
}

export interface NodoCategoria extends CategoriaAdmin {
  hijos: NodoCategoria[];
}

/** Arma el árbol respetando el orden del menú del sitio. */
export function arbolDeCategorias(lista: CategoriaAdmin[]): NodoCategoria[] {
  const nodos = new Map<string, NodoCategoria>(lista.map((c) => [c.id, { ...c, hijos: [] }]));
  const raices: NodoCategoria[] = [];
  for (const nodo of nodos.values()) {
    const padre = nodo.padre_id ? nodos.get(nodo.padre_id) : undefined;
    (padre ? padre.hijos : raices).push(nodo);
  }
  const ordenar = (hermanos: NodoCategoria[]) => {
    hermanos.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
    hermanos.forEach((h) => ordenar(h.hijos));
  };
  ordenar(raices);
  return raices;
}

/**
 * Opciones para elegir la categoría madre, con sangría por nivel.
 * `excluirRuta` deja afuera una categoría y todo lo que tiene adentro.
 */
export function opcionesDeCategorias(lista: CategoriaAdmin[], excluirRuta?: string) {
  const opciones: { id: string; label: string }[] = [];
  const recorrer = (nodos: NodoCategoria[], nivel: number) => {
    for (const n of nodos) {
      if (excluirRuta && n.ruta.startsWith(excluirRuta)) continue;
      opciones.push({ id: n.id, label: `${'\u00a0\u00a0\u00a0'.repeat(nivel)}${nivel ? '└ ' : ''}${n.nombre}${n.activa ? '' : ' (oculta)'}` });
      recorrer(n.hijos, nivel + 1);
    }
  };
  recorrer(arbolDeCategorias(lista), 0);
  return opciones;
}
