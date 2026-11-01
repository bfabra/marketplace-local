import type { EstadoPedidoTienda } from '@/lib/api-client';
import { COLOR_PEDIDO, ESTADO_PEDIDO } from '@/lib/pedidos';

export function OrderStatus({ estado }: { estado: EstadoPedidoTienda }) {
  return <span className={`badge ${COLOR_PEDIDO[estado]}`}>{ESTADO_PEDIDO[estado]}</span>;
}
