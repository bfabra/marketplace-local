'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, type Carrito, type ItemCarrito } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { CartContext } from '@/hooks/use-cart';
const CLAVE = 'tcl_carrito';
const VACIO: Carrito = { tiendas: [], cantidad: 0, subtotal: 0, listo: false };

function leerLocal(): ItemCarrito[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    if (!Array.isArray(items)) return [];
    return items.filter(
      (i): i is ItemCarrito => typeof i?.variante_id === 'string' && Number.isInteger(i?.cantidad) && i.cantidad > 0
    );
  } catch {
    return [];
  }
}

function guardarLocal(items: ItemCarrito[]) {
  if (items.length) localStorage.setItem(CLAVE, JSON.stringify(items));
  else localStorage.removeItem(CLAVE);
}

const lineaDe = (c: Carrito, varianteId: string) =>
  c.tiendas.flatMap((t) => t.items).find((i) => i.variante_id === varianteId);

const vistaPrevia = (items: ItemCarrito[]) =>
  items.length ? api<Carrito>('/cart/vista-previa', { method: 'POST', body: { items } }) : Promise.resolve(VACIO);

/**
 * Sin sesión, el carrito vive en el navegador (localStorage) y la pantalla se arma
 * con vista-previa. Al ingresar, se suma al carrito guardado y se borra del navegador.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [carrito, setCarrito] = useState<Carrito>(VACIO);
  const [listo, setListo] = useState(false);
  const [version, setVersion] = useState(0);
  // Las sincronizaciones van en fila: si se pisaran, el carrito del navegador se uniría dos veces.
  const fila = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (loading) return;
    let vigente = true;
    setListo(false);

    const sincronizar = async () => {
      const locales = leerLocal();
      if (!userId) return vistaPrevia(locales);
      if (!locales.length) return api<Carrito>('/cart');
      guardarLocal([]);
      try {
        return await api<Carrito>('/cart/unir', { method: 'POST', body: { items: locales } });
      } catch (e) {
        guardarLocal(locales);
        throw e;
      }
    };

    const tarea = fila.current.then(sincronizar);
    fila.current = tarea.catch(() => undefined);
    tarea
      .then((c) => vigente && setCarrito(c))
      .catch((e) => console.error(e))
      .finally(() => vigente && setListo(true));

    return () => {
      vigente = false;
    };
  }, [userId, loading, version]);

  const agregar = useCallback(
    async (varianteId: string, cantidad: number) => {
      if (userId) {
        setCarrito(await api<Carrito>('/cart/items', { method: 'POST', body: { variante_id: varianteId, cantidad } }));
        return;
      }
      const locales = leerLocal();
      const actual = locales.find((i) => i.variante_id === varianteId);
      const nuevos = actual
        ? locales.map((i) => (i === actual ? { ...i, cantidad: i.cantidad + cantidad } : i))
        : [...locales, { variante_id: varianteId, cantidad }];
      const c = await vistaPrevia(nuevos);
      const linea = lineaDe(c, varianteId);
      if (!linea) throw new ApiError('Este producto ya no está a la venta', 404);
      if (!linea.ok) {
        throw new ApiError(
          actual ? `${linea.aviso} y ya tenés ${actual.cantidad} en el carrito` : (linea.aviso ?? 'No hay stock suficiente'),
          409
        );
      }
      guardarLocal(nuevos);
      setCarrito(c);
    },
    [userId]
  );

  const cambiar = useCallback(
    async (varianteId: string, cantidad: number) => {
      if (userId) {
        setCarrito(await api<Carrito>(`/cart/items/${varianteId}`, { method: 'PATCH', body: { cantidad } }));
        return;
      }
      const nuevos = leerLocal().map((i) => (i.variante_id === varianteId ? { ...i, cantidad } : i));
      guardarLocal(nuevos);
      setCarrito(await vistaPrevia(nuevos));
    },
    [userId]
  );

  const quitar = useCallback(
    async (varianteId: string) => {
      if (userId) {
        setCarrito(await api<Carrito>(`/cart/items/${varianteId}`, { method: 'DELETE' }));
        return;
      }
      const nuevos = leerLocal().filter((i) => i.variante_id !== varianteId);
      guardarLocal(nuevos);
      setCarrito(await vistaPrevia(nuevos));
    },
    [userId]
  );

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ carrito, listo, agregar, cambiar, quitar, recargar }),
    [carrito, listo, agregar, cambiar, quitar, recargar]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
