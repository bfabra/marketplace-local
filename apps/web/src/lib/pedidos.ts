import type { EstadoPago, EstadoPedidoTienda, Modalidad, Venta } from './api-client';

export const ESTADO_PEDIDO: Record<EstadoPedidoTienda, string> = {
  pendiente: 'Esperando el pago',
  pago_confirmado: 'Pago confirmado',
  en_preparacion: 'En preparación',
  listo_para_recoleccion: 'Listo, espera al repartidor',
  listo_para_retiro: 'Listo para retirar en el local',
  recolectado: 'Retirado por el repartidor',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  rechazado: 'Pago rechazado',
};

// Color de la etiqueta: reutiliza los estilos de los estados de tienda.
export const COLOR_PEDIDO: Record<EstadoPedidoTienda, string> = {
  pendiente: 'badge-pendiente',
  pago_confirmado: 'badge-activa',
  en_preparacion: 'badge-pendiente',
  listo_para_recoleccion: 'badge-pendiente',
  listo_para_retiro: 'badge-pendiente',
  recolectado: 'badge-pendiente',
  en_camino: 'badge-pendiente',
  entregado: 'badge-activa',
  cancelado: 'badge-suspendida',
  rechazado: 'badge-suspendida',
};

/** Badges de estado del panel comerciante (#merchant-panel → renderOrdersTab). */
export const MP_BADGE_PEDIDO: Partial<Record<EstadoPedidoTienda, string>> = {
  pago_confirmado: 'mp-badge-preparar',
  en_preparacion: 'mp-badge-preparar',
  listo_para_recoleccion: 'mp-badge-listo',
  listo_para_retiro: 'mp-badge-listo',
  entregado: 'mp-badge-entregado',
  cancelado: 'mp-badge-cancelado',
  rechazado: 'mp-badge-cancelado',
};

/** Etiquetas cortas como en la maqueta. */
export const MP_ESTADO_PEDIDO: Partial<Record<EstadoPedidoTienda, string>> = {
  pago_confirmado: 'Por preparar',
  en_preparacion: 'Por preparar',
  listo_para_recoleccion: 'Listo para retirar / enviar',
  listo_para_retiro: 'Listo para retirar / enviar',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: 'Pago pendiente',
  aprobado: 'Pagado',
  rechazado: 'Pago rechazado',
  reembolsado_parcial: 'Reembolsado en parte',
  reembolsado: 'Reembolsado',
};

export const COLOR_PAGO: Record<EstadoPago, string> = {
  pendiente: 'badge-pendiente',
  aprobado: 'badge-activa',
  rechazado: 'badge-suspendida',
  reembolsado_parcial: 'badge-archivada',
  reembolsado: 'badge-archivada',
};

export const MODALIDAD: Record<Modalidad, string> = {
  entrega_plataforma: 'Envío a domicilio',
  retiro_en_local: 'Retiro en el local',
};

// Botones del comercio para cada estado al que puede pasar el pedido.
export const ACCION_COMERCIO: Partial<Record<EstadoPedidoTienda, string>> = {
  en_preparacion: 'Empezar a preparar',
  listo_para_recoleccion: 'Listo para el repartidor',
  listo_para_retiro: 'Listo para retirar',
  entregado: 'Marcar entregado',
  cancelado: 'Cancelar',
};

/** Pedidos seed de #merchant-panel (merchant.js → getMerchantOrders). */
export const esPedidoEjemplo = (id: string) => id.startsWith('ejemplo-');

function accionesEjemplo(estado: EstadoPedidoTienda, modalidad: Modalidad): EstadoPedidoTienda[] {
  if (estado === 'pago_confirmado') return ['en_preparacion', 'cancelado'];
  if (estado === 'en_preparacion') {
    return modalidad === 'retiro_en_local'
      ? ['listo_para_retiro', 'cancelado']
      : ['listo_para_recoleccion', 'cancelado'];
  }
  if (estado === 'listo_para_retiro') return ['entregado', 'cancelado'];
  return [];
}

/** Pedido vigente de ejemplo por tienda (Mariana Gómez / envío a domicilio). */
export function pedidosEjemploDeTienda(tiendaId: string): Venta[] {
  const subtotal = 45900;
  const comision = 4590;
  return [
    {
      id: `ejemplo-${tiendaId}-ord`,
      numero: 4821,
      creado_en: '2026-10-20T13:45:00.000Z',
      estado: 'pago_confirmado',
      modalidad: 'entrega_plataforma',
      subtotal,
      comision,
      motivo_cancelacion: null,
      listo_en: null,
      comprador: { nombre: 'Mariana Gómez', telefono: '+54 9 264 5123984' },
      items: [
        {
          nombre: 'Producto Destacado Sucursal',
          variante: null,
          precio: subtotal,
          cantidad: 1,
          subtotal,
        },
      ],
      acciones: accionesEjemplo('pago_confirmado', 'entrega_plataforma'),
    },
  ];
}

/** Incluye el pedido vigente + la venta archivada de la maqueta (Esteban Carrizo). */
export function ventasEjemploDeTienda(tiendaId: string): Venta[] {
  const subtotal = 89000;
  const comision = 8900;
  return [
    ...pedidosEjemploDeTienda(tiendaId),
    {
      id: `ejemplo-${tiendaId}-venta`,
      numero: 4105,
      creado_en: '2026-10-20T18:20:00.000Z',
      estado: 'entregado',
      modalidad: 'retiro_en_local',
      subtotal,
      comision,
      motivo_cancelacion: null,
      listo_en: '2026-10-20T18:20:00.000Z',
      comprador: { nombre: 'Esteban Carrizo', telefono: null },
      items: [
        {
          nombre: 'Artículo de Venta Local',
          variante: null,
          precio: subtotal,
          cantidad: 1,
          subtotal,
        },
      ],
      acciones: [],
    },
  ];
}

/** Aplica un cambio de estado solo en memoria (modo ejemplo de la plantilla). */
export function aplicarEstadoEjemplo(venta: Venta, estado: EstadoPedidoTienda, motivo: string | null): Venta {
  return {
    ...venta,
    estado,
    motivo_cancelacion: estado === 'cancelado' ? motivo : venta.motivo_cancelacion,
    listo_en:
      estado === 'listo_para_recoleccion' || estado === 'listo_para_retiro' || estado === 'entregado'
        ? new Date().toISOString()
        : venta.listo_en,
    acciones: accionesEjemplo(estado, venta.modalidad),
  };
}
