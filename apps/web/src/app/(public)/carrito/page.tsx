'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Direccion, type LineaCarrito } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import { plural } from '@/lib/visual';
import { Icon } from '@/components/ui/icon';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { enlaceProducto } from '@/components/catalog/market-product-card';

/**
 * Carrito alineado a la maqueta (docs/diseno #cart).
 * Regla de envío: un solo costo por dirección al finalizar (no $2.999 × tienda).
 */
export default function CartPage() {
  const { user } = useAuth();
  const { carrito, listo, cambiar, quitar } = useCart();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pagoRechazado, setPagoRechazado] = useState(false);
  const [envioEstimado, setEnvioEstimado] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    setPagoRechazado(new URLSearchParams(window.location.search).get('pago') === 'rechazado');
  }, []);

  useEffect(() => {
    if (!user || carrito.tiendas.length === 0) {
      setEnvioEstimado(undefined);
      return;
    }
    let vigente = true;
    api<Direccion[]>('/addresses')
      .then((lista) => {
        if (!vigente) return;
        const d =
          lista.find((x) => x.es_principal && x.costo_envio !== null) ??
          lista.find((x) => x.costo_envio !== null);
        setEnvioEstimado(d?.costo_envio ?? null);
      })
      .catch(() => vigente && setEnvioEstimado(null));
    return () => {
      vigente = false;
    };
  }, [user, carrito.tiendas.length]);

  async function hacer(varianteId: string, accion: () => Promise<void>, aviso?: string) {
    setOcupado(varianteId);
    setError(null);
    try {
      await accion();
      if (aviso) toast({ tipo: 'info', titulo: aviso });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setOcupado(null);
    }
  }

  const finalizar = user ? '/checkout' : `/login?next=${encodeURIComponent('/checkout')}`;
  const cargando = !listo && carrito.cantidad === 0;
  const envioConocido = envioEstimado != null && !!user;
  const total =
    envioConocido && envioEstimado != null ? carrito.subtotal + envioEstimado : carrito.subtotal;

  return (
    <div className="market-container market-page cart-page">
      {cargando ? (
        <>
          <h1 className="cart-titulo">Carrito de Compras</h1>
          <div className="cart-layout" role="status" aria-label="Cargando carrito">
            <div className="cart-store cart-vacio-cargando" />
            <div className="cart-summary cart-vacio-cargando" />
          </div>
        </>
      ) : carrito.tiendas.length === 0 ? (
        <div className="cart-vacio">
          <h1>Tu carrito está vacío</h1>
          <p>
            Explorá los comercios de San Juan, descubrí ofertas y armá tu pedido: el envío a
            domicilio se cobra una sola vez por dirección.
          </p>
          <Link href="/tiendas" className="market-primary-button">
            Explorar marketplace
          </Link>
        </div>
      ) : (
        <>
          <h1 className="cart-titulo">Carrito de Compras</h1>

          {pagoRechazado && (
            <p className="cart-aviso" role="status">
              <Icon name="info" size={17} /> El pago fue rechazado. Tus productos siguen en el
              carrito para que lo intentes de nuevo.
            </p>
          )}
          {error && (
            <p className="cart-aviso cart-aviso-error" role="alert">
              <Icon name="alert" size={17} /> {error}
            </p>
          )}

          <div className="cart-layout">
            <div className="cart-stores">
              {carrito.tiendas.map((t) => (
                <section key={t.id} className="cart-store" aria-label={`Productos de ${t.nombre}`}>
                  <header>
                    <div>
                      <span className="cart-store-label">Comercio local</span>
                      <Link href={`/tiendas/${t.slug}`}>{t.nombre}</Link>
                    </div>
                    <span className="cart-store-envio">Envío a domicilio</span>
                  </header>
                  <ul>
                    {t.items.map((i) => (
                      <Linea
                        key={i.variante_id}
                        tiendaSlug={t.slug}
                        item={i}
                        ocupado={ocupado === i.variante_id}
                        onCantidad={(n) => hacer(i.variante_id, () => cambiar(i.variante_id, n))}
                        onQuitar={() =>
                          hacer(i.variante_id, () => quitar(i.variante_id), `Quitaste ${i.nombre}`)
                        }
                      />
                    ))}
                  </ul>
                  <p className="cart-store-entrega">
                    <Icon name="clock" size={14} /> Tiempo estimado de entrega: 24 a 48 hs
                  </p>
                </section>
              ))}
            </div>

            <aside className="cart-summary" aria-label="Resumen de la compra">
              <h2>Resumen del pedido</h2>
              <dl>
                <div>
                  <dt>Subtotal productos ({plural(carrito.cantidad, 'ítem', 'ítems')}):</dt>
                  <dd>{formatPrice(carrito.subtotal)}</dd>
                </div>
                <div>
                  <dt>Envío a domicilio (un solo costo):</dt>
                  <dd>
                    {envioEstimado === undefined && user ? (
                      <span className="cart-summary-muted">…</span>
                    ) : !envioConocido ? (
                      <span className="cart-summary-muted">Se calcula al finalizar</span>
                    ) : envioEstimado === 0 ? (
                      <span className="cart-summary-ok">Sin costo</span>
                    ) : (
                      formatPrice(envioEstimado!)
                    )}
                  </dd>
                </div>
                <div className="cart-summary-total">
                  <dt>Total a pagar:</dt>
                  <dd>{formatPrice(total)}</dd>
                </div>
              </dl>

              {!carrito.listo && (
                <p className="cart-summary-nota cart-summary-alerta">
                  Hay productos sin stock suficiente o que ya no están a la venta. Ajustalos para
                  continuar.
                </p>
              )}

              {carrito.listo ? (
                <Link href={finalizar} className="market-primary-button">
                  Finalizar compra
                </Link>
              ) : (
                <button type="button" className="market-primary-button" disabled>
                  Finalizar compra
                </button>
              )}

              <div className="cart-summary-seguro">
                <Icon name="lock" size={15} /> Compra protegida. Al finalizar, coordinaremos la
                entrega a domicilio en San Juan.
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Linea({
  tiendaSlug,
  item,
  ocupado,
  onCantidad,
  onQuitar,
}: {
  tiendaSlug: string;
  item: LineaCarrito;
  ocupado: boolean;
  onCantidad: (n: number) => void;
  onQuitar: () => void;
}) {
  const oferta = item.precio < item.precio_lista;

  return (
    <li className={`cart-line${ocupado ? ' is-ocupada' : ''}`}>
      <Link
        href={enlaceProducto(tiendaSlug, item.slug)}
        className="cart-line-img"
        tabIndex={-1}
        aria-hidden="true"
      >
        {item.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imagen} alt="" />
        ) : (
          <Icon name="image" size={22} />
        )}
      </Link>
      <div className="cart-line-info">
        <Link href={enlaceProducto(tiendaSlug, item.slug)}>{item.nombre}</Link>
        {item.variante && <small>{item.variante}</small>}
        <span>
          {formatPrice(item.precio)}
          {oferta && <del>{formatPrice(item.precio_lista)}</del>}
          <em className="cart-line-cu"> c/u</em>
        </span>
        {item.aviso && <em>{item.aviso}</em>}
      </div>
      <div className="cart-line-actions">
        <QuantityStepper
          size="sm"
          valor={item.cantidad}
          max={Math.max(1, item.disponibles)}
          disabled={ocupado || !item.disponibles}
          onChange={(n) => n !== item.cantidad && onCantidad(n)}
        />
        <strong>{formatPrice(item.precio * item.cantidad)}</strong>
        <button type="button" onClick={onQuitar} disabled={ocupado} aria-label={`Quitar ${item.nombre}`}>
          <Icon name="x" size={18} />
        </button>
      </div>
    </li>
  );
}
