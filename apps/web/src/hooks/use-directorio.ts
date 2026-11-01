'use client';

import { useEffect, useState } from 'react';
import { api, type Inicio, type OpcionRubro, type ResultadosBusqueda, type TarjetaProducto, type TiendaResumen } from '@/lib/api-client';

export interface Directorio {
  rubros: OpcionRubro[];
  tiendas: TiendaResumen[];
  /** Foto de algún producto de cada tienda (por slug): las tiendas todavía no tienen foto de portada. */
  fotos: Map<string, string>;
  /** Productos de la portada (populares + novedades + recientes), sin duplicar. */
  productos: TarjetaProducto[];
}

const VIGENCIA_MS = 60_000;
let pedido: Promise<Directorio> | null = null;
let pedidoEn = 0;

function cargar() {
  if (pedido && Date.now() - pedidoEn < VIGENCIA_MS) return pedido;
  pedidoEn = Date.now();
  pedido = Promise.all([
    api<OpcionRubro[]>('/catalog/rubros'),
    api<TiendaResumen[]>('/catalog/tiendas'),
    api<Inicio>('/catalog/inicio').catch(() => null),
    api<ResultadosBusqueda>('/catalog/buscar?orden=recientes').catch(() => null),
  ])
    .then(([rubros, tiendas, inicio, recientes]) => {
      const fotos = new Map<string, string>();
      const vistos = new Set<string>();
      const productos: TarjetaProducto[] = [];
      for (const p of [...(inicio?.populares ?? []), ...(inicio?.novedades ?? []), ...(recientes?.productos ?? [])]) {
        if (p.imagen && p.tienda && !fotos.has(p.tienda.slug)) fotos.set(p.tienda.slug, p.imagen);
        if (vistos.has(p.id)) continue;
        vistos.add(p.id);
        productos.push(p);
      }
      return { rubros, tiendas, fotos, productos };
    })
    .catch((e) => {
      pedido = null;
      throw e;
    });
  return pedido;
}

/** Rubros, tiendas activas y productos: lo que usan la portada, Rubros y Tiendas. */
export function useDirectorio() {
  const [datos, setDatos] = useState<Directorio | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    cargar()
      .then((d) => vigente && setDatos(d))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, []);

  return { datos, error };
}

/** Cantidad de tiendas por rubro principal (slug). */
export function tiendasPorRubro(tiendas: TiendaResumen[]) {
  const cuenta = new Map<string, number>();
  for (const t of tiendas) if (t.rubro) cuenta.set(t.rubro.slug, (cuenta.get(t.rubro.slug) ?? 0) + 1);
  return cuenta;
}

/** La descripción cargada; si no tiene, «Casas, departamentos, locales y más» a partir de los subrubros. */
export function descripcionRubro(rubro: OpcionRubro) {
  if (rubro.descripcion) return rubro.descripcion;
  const nombres = rubro.subrubros.slice(0, 3).map((s, i) => (i === 0 ? s.nombre : s.nombre.toLowerCase()));
  if (nombres.length === 0) return 'Comercios de la zona';
  return rubro.subrubros.length > 3 ? `${nombres.join(', ')} y más` : nombres.join(', ');
}
