'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, type Pedido } from '@/lib/api-client';
import { useCart } from '@/hooks/use-cart';
import { formatPrice } from '@/lib/utils';
import { ESTADO_PAGO } from '@/lib/pedidos';
import { Alert } from '@/components/ui/alert';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CheckoutSteps } from '@/components/checkout/checkout-steps';

// Reemplaza el checkout de Mercado Pago mientras no hay integración real.
export default function SimulatedPaymentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { recargar } = useCart();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<'aprobar' | 'rechazar' | null>(null);

  useEffect(() => {
    api<Pedido>(`/orders/${params.id}`)
      .then(setPedido)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [params.id]);

  async function resolver(aprobado: boolean) {
    setEnviando(aprobado ? 'aprobar' : 'rechazar');
    setError(null);
    try {
      await api(`/orders/${params.id}/pago-simulado`, { method: 'POST', body: { aprobado } });
      if (aprobado) {
        router.push(`/mis-compras/${params.id}?pago=aprobado`);
      } else {
        recargar();
        router.push('/carrito?pago=rechazado');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
      setEnviando(null);
    }
  }

  if (error && !pedido) return <Alert>{error}</Alert>;
  if (!pedido) return <PageSkeleton />;

  if (pedido.estado_pago !== 'pendiente') {
    return (
      <section className="card stack">
        <h1>Pedido #{pedido.numero}</h1>
        <Alert kind="info">Este pedido ya no espera el pago: {ESTADO_PAGO[pedido.estado_pago].toLowerCase()}.</Alert>
        <div className="actions">
          <Link href={`/mis-compras/${pedido.id}`} className="btn">
            Ver el pedido
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      <CheckoutSteps actual={2} />
      <section className="card form stack pago-simulado">
        <span className="badge badge-pendiente">Mercado Pago simulado · solo desarrollo</span>
        <h1>Pagar pedido #{pedido.numero}</h1>
        <p className="price-grande">{formatPrice(pedido.total)}</p>
        <p className="muted">
          {pedido.partes.length === 1
            ? `Compra en ${pedido.partes[0].tienda?.nombre ?? 'una tienda'}`
            : `Compra en ${pedido.partes.length} tiendas`}
          {pedido.costo_envio > 0 ? `, con envío de ${formatPrice(pedido.costo_envio)}` : ''}.
        </p>
        {pedido.reservaHasta && (
          <p className="muted">
            El stock está reservado hasta las{' '}
            {new Date(pedido.reservaHasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {error && <Alert>{error}</Alert>}
        <div className="actions">
          <button className="btn btn-accent" onClick={() => resolver(true)} disabled={enviando !== null}>
            {enviando === 'aprobar' ? 'Aprobando…' : 'Aprobar el pago'}
          </button>
          <button className="btn btn-secondary" onClick={() => resolver(false)} disabled={enviando !== null}>
            {enviando === 'rechazar' ? 'Rechazando…' : 'Rechazar el pago'}
          </button>
        </div>
        <p className="muted">Si lo rechazás, los productos vuelven a tu carrito.</p>
      </section>
    </div>
  );
}
