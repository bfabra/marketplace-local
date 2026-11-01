'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type Checkout, type Direccion } from '@/lib/api-client';
import { useCart } from '@/hooks/use-cart';
import { formatPrice } from '@/lib/utils';
import { plural } from '@/lib/visual';
import { Alert } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { AddressForm } from '@/components/forms/address-form';
import { StoreAvatar } from '@/components/catalog/store-avatar';
import { CheckoutSteps } from '@/components/checkout/checkout-steps';

const textoDireccion = (d: Direccion) =>
  `${d.calle} ${d.numero}${d.piso_depto ? `, ${d.piso_depto}` : ''} · ${d.localidad.nombre}`;

const elegirDireccion = (lista: Direccion[]) =>
  (lista.find((d) => d.es_principal && d.costo_envio !== null) ?? lista.find((d) => d.costo_envio !== null))?.id ?? null;

/**
 * Checkout alineado visualmente a la maqueta.
 * Regla de envío: un solo costo por dirección (no por tienda). Pago solo Mercado Pago.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { listo, recargar } = useCart();
  const [datos, setDatos] = useState<Checkout | null>(null);
  const [retiro, setRetiro] = useState<Set<string>>(new Set());
  const [direccionId, setDireccionId] = useState<string | null>(null);
  const [nuevaDireccion, setNuevaDireccion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const cargado = useRef(false);

  useEffect(() => {
    if (!listo || cargado.current) return;
    cargado.current = true;
    api<Checkout>('/orders/checkout')
      .then((d) => {
        setDatos(d);
        setDireccionId(elegirDireccion(d.direcciones));
        setNuevaDireccion(d.direcciones.length === 0);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [listo]);

  if (error && !datos) {
    return (
      <div className="market-container market-page">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!datos) return <PageSkeleton />;

  const { carrito, direcciones } = datos;
  if (carrito.tiendas.length === 0) {
    return (
      <div className="market-container market-page">
        <EmptyState
          icono="cart"
          titulo="No tenés productos para comprar"
          acciones={
            <Link href="/tiendas" className="market-primary-button">
              Explorar tiendas
            </Link>
          }
        >
          Agregá productos de tus comercios locales favoritos antes de pasar por el checkout.
        </EmptyState>
      </div>
    );
  }

  const conEnvio = carrito.tiendas.filter((t) => !retiro.has(t.id));
  const direccion = direcciones.find((d) => d.id === direccionId);
  const costoEnvio = conEnvio.length === 0 ? 0 : (direccion?.costo_envio ?? null);
  const puedePagar = carrito.listo && costoEnvio !== null && !pagando;
  const faltante = !carrito.listo
    ? 'Revisá el carrito: hay productos sin stock.'
    : costoEnvio === null
      ? 'Elegí o cargá una dirección de entrega.'
      : null;
  const total = carrito.subtotal + (costoEnvio ?? 0);

  function alternarRetiro(tiendaId: string, retirar: boolean) {
    setRetiro((actual) => {
      const nuevo = new Set(actual);
      if (retirar) nuevo.add(tiendaId);
      else nuevo.delete(tiendaId);
      return nuevo;
    });
  }

  async function pagar() {
    setPagando(true);
    setError(null);
    try {
      const pedido = await api<{ id: string; pago: string }>('/orders', {
        method: 'POST',
        body: { direccion_id: conEnvio.length ? direccionId : null, tiendas_retiro: Array.from(retiro) },
      });
      recargar();
      router.push(pedido.pago);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
      setPagando(false);
    }
  }

  return (
    <div className="market-container market-page checkout-page">
      <nav className="checkout-breadcrumb" aria-label="Navegación">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">›</span>
        <Link href="/carrito">Carrito</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Finalizar compra</span>
      </nav>

      <CheckoutSteps actual={1} />

      <div className="market-page-heading checkout-heading">
        <h1>Finalizar compra</h1>
        <p>Completá la entrega en San Juan y aboná con Mercado Pago.</p>
      </div>

      {datos.pagoSimulado && (
        <div className="checkout-demo" role="status">
          <Icon name="info" size={20} />
          <div>
            <strong>Modo demostración</strong>
            <p>En el siguiente paso simulás si Mercado Pago aprueba o rechaza el pago. No se cobran cargos reales.</p>
          </div>
        </div>
      )}

      {!carrito.listo && (
        <Alert>
          Algunos productos cambiaron de stock o ya no están a la venta. <Link href="/carrito">Revisá el carrito</Link>.
        </Alert>
      )}

      <div className="checkout-layout">
        <div className="checkout-main">
          <section className="checkout-card" aria-labelledby="titulo-entrega">
            <h2 id="titulo-entrega">
              <Icon name="truck" size={18} /> 1. Modalidad de entrega
            </h2>
            {carrito.tiendas.map((t) => (
              <fieldset key={t.id} className="fieldset-plain checkout-tienda">
                <legend>
                  <StoreAvatar nombre={t.nombre} className="store-avatar-sm" />
                  <span>
                    <strong>{t.nombre}</strong>
                    <span className="muted">
                      {' '}
                      · {plural(t.items.reduce((n, i) => n + i.cantidad, 0), 'unidad', 'unidades')} ·{' '}
                      {formatPrice(t.subtotal)}
                    </span>
                  </span>
                </legend>
                <div className="opciones-tarjeta">
                  <label className="opcion-tarjeta">
                    <input
                      type="radio"
                      name={`entrega-${t.id}`}
                      checked={!retiro.has(t.id)}
                      onChange={() => alternarRetiro(t.id, false)}
                    />
                    <span className="opcion-tarjeta-icono">
                      <Icon name="truck" size={20} />
                    </span>
                    <span className="opcion-tarjeta-texto">
                      <strong>Envío a domicilio</strong>
                      <span className="muted">Lo lleva un repartidor de la plataforma.</span>
                    </span>
                  </label>
                  {datos.retiroHabilitado && (
                    <label className="opcion-tarjeta">
                      <input
                        type="radio"
                        name={`entrega-${t.id}`}
                        checked={retiro.has(t.id)}
                        onChange={() => alternarRetiro(t.id, true)}
                      />
                      <span className="opcion-tarjeta-icono">
                        <Icon name="store" size={20} />
                      </span>
                      <span className="opcion-tarjeta-texto">
                        <strong>Retiro en el local · Sin costo</strong>
                        <span className="muted">
                          {t.direccion}, {t.localidad}
                        </span>
                      </span>
                    </label>
                  )}
                </div>
              </fieldset>
            ))}
            {conEnvio.length > 1 && (
              <p className="checkout-aviso">
                <Icon name="info" size={16} />
                Los envíos de varias tiendas llegan juntos y pagás un solo costo de envío.
              </p>
            )}
          </section>

          {conEnvio.length > 0 && (
            <section className="checkout-card" aria-labelledby="titulo-direccion">
              <h2 id="titulo-direccion">
                <Icon name="pin" size={18} /> 2. Dirección de entrega
              </h2>
              {direcciones.length > 0 && (
                <div className="opciones-tarjeta" role="radiogroup" aria-labelledby="titulo-direccion">
                  {direcciones.map((d) => (
                    <label key={d.id} className={`opcion-tarjeta${d.costo_envio === null ? ' is-deshabilitada' : ''}`}>
                      <input
                        type="radio"
                        name="direccion"
                        checked={direccionId === d.id}
                        disabled={d.costo_envio === null}
                        onChange={() => setDireccionId(d.id)}
                      />
                      <span className="opcion-tarjeta-icono">
                        <Icon name="pin" size={20} />
                      </span>
                      <span className="opcion-tarjeta-texto">
                        <strong>{d.alias ?? textoDireccion(d)}</strong>
                        {d.alias && <span className="muted">{textoDireccion(d)}</span>}
                        {d.costo_envio === null && (
                          <span className="field-error">Todavía no hacemos envíos a esta localidad</span>
                        )}
                      </span>
                      {d.costo_envio !== null && (
                        <span className="opcion-tarjeta-precio">{formatPrice(d.costo_envio)}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {nuevaDireccion ? (
                <AddressForm
                  existentes={direcciones.map((d) => d.id)}
                  onCancel={direcciones.length ? () => setNuevaDireccion(false) : undefined}
                  onSaved={(lista, nueva) => {
                    setDatos({ ...datos, direcciones: lista });
                    setDireccionId(nueva && nueva.costo_envio !== null ? nueva.id : elegirDireccion(lista));
                    setNuevaDireccion(false);
                  }}
                />
              ) : (
                <button type="button" className="btn btn-secondary btn-agregar" onClick={() => setNuevaDireccion(true)}>
                  <Icon name="plus" size={18} /> Agregar otra dirección
                </button>
              )}
            </section>
          )}

          <section className="checkout-card" aria-labelledby="titulo-pago">
            <h2 id="titulo-pago">
              <Icon name="card" size={18} /> 3. Forma de pago
            </h2>
            <label className="opcion-tarjeta checkout-pago-mp">
              <input type="radio" name="pago" checked readOnly />
              <span className="opcion-tarjeta-icono">
                <Icon name="shield" size={20} />
              </span>
              <span className="opcion-tarjeta-texto">
                <strong>Mercado Pago</strong>
                <span className="muted">Dinero en cuenta, débito o crédito. No guardamos tu tarjeta.</span>
              </span>
            </label>
          </section>
        </div>

        <aside className="checkout-resumen" aria-label="Resumen de la compra">
          <h2>Resumen de tu pedido</h2>

          <div className="checkout-resumen-tiendas">
            {carrito.tiendas.map((t) => (
              <div key={t.id} className="checkout-resumen-tienda">
                <strong>
                  <Icon name="store" size={13} /> {t.nombre}
                  {retiro.has(t.id) ? ' · Retiro' : ''}
                </strong>
                {t.items.map((i) => (
                  <div key={i.variante_id}>
                    <span>
                      {i.cantidad}× {i.nombre}
                    </span>
                    <span>{formatPrice(i.precio * i.cantidad)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <dl className="checkout-resumen-lineas">
            <div>
              <dt>Subtotal productos</dt>
              <dd>{formatPrice(carrito.subtotal)}</dd>
            </div>
            <div>
              <dt>Envío a domicilio{conEnvio.length > 0 ? ' (un solo costo)' : ''}</dt>
              <dd>
                {costoEnvio === null ? (
                  <span className="muted">Elegí una dirección</span>
                ) : costoEnvio === 0 ? (
                  <span className="ok">Sin costo</span>
                ) : (
                  formatPrice(costoEnvio)
                )}
              </dd>
            </div>
            <div className="checkout-resumen-total">
              <dt>Total a abonar</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          {error && <Alert>{error}</Alert>}

          <button type="button" className="market-primary-button checkout-pagar" onClick={pagar} disabled={!puedePagar}>
            {pagando ? (
              <>
                <span className="spinner" /> Preparando el pago…
              </>
            ) : (
              <>
                <Icon name="lock" size={17} /> Pagar con Mercado Pago
              </>
            )}
          </button>

          <Link href="/carrito" className="checkout-volver">
            ← Volver al carrito
          </Link>

          {faltante && <p className="checkout-faltante">{faltante}</p>}

          <ul className="checkout-confianza">
            <li>
              <Icon name="shield" size={15} /> Pagás en Mercado Pago: no guardamos tu tarjeta.
            </li>
            <li>
              <Icon name="clock" size={15} /> Reservamos el stock 15 minutos mientras pagás.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
