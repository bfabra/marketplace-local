import type { Equipo, Usuario } from './api-client';
import { safeNext } from './redirect';
import { panelVendedor } from './vendedor';

export const esEquipo = (user: Usuario | null | undefined) => !!user?.rolesPlataforma.length;

/** Seed de #merchant-panel → Roles y Empleados (merchant.js → getStoreEmployees). */
export function equipoEjemploDeTienda(): Equipo {
  const rolAtencion = {
    id: 'ejemplo-rol-atencion',
    nombre: 'Atención al cliente',
    propio: false,
    permisos: ['pedidos.ver', 'preguntas.responder'],
    enUso: 1,
  };
  const rolCatalogo = {
    id: 'ejemplo-rol-catalogo',
    nombre: 'Catálogo',
    propio: false,
    permisos: ['productos.ver', 'productos.editar'],
    enUso: 0,
  };
  const rolPedidos = {
    id: 'ejemplo-rol-pedidos',
    nombre: 'Pedidos',
    propio: false,
    permisos: ['pedidos.ver', 'pedidos.gestionar'],
    enUso: 1,
  };

  return {
    plan: { nombre: 'Plan Demo', max_empleados: 5 },
    activos: 1,
    miembros: [
      {
        id: 'ejemplo-miembro-1',
        nombre: 'Empleado Demo',
        email: 'empleado1@comercio.com',
        rol: { id: rolAtencion.id, nombre: `${rolAtencion.nombre}, ${rolPedidos.nombre}` },
        estado: 'activo',
        creado_en: '2026-10-01T12:00:00.000Z',
      },
    ],
    invitaciones: [],
    roles: [rolAtencion, rolCatalogo, rolPedidos],
    permisos: [
      { codigo: 'pedidos.ver', area: 'Pedidos', descripcion: 'Ver pedidos de la tienda' },
      { codigo: 'pedidos.gestionar', area: 'Pedidos', descripcion: 'Gestionar estados de pedidos' },
      { codigo: 'productos.ver', area: 'Catálogo', descripcion: 'Ver productos' },
      { codigo: 'productos.editar', area: 'Catálogo', descripcion: 'Editar productos' },
      { codigo: 'preguntas.responder', area: 'Atención', descripcion: 'Responder preguntas' },
    ],
  };
}

/**
 * El equipo de la plataforma entra a su panel. El resto va a finalizar la compra si armó
 * un carrito antes de ingresar; si no, quien tiene tiendas (propias o como empleado) entra
 * al panel de vendedor (con una sola, directo a su resumen) y el comprador, a buscar.
 * Si venía de otra página, vuelve a esa.
 */
export function destinoAlIngresar(user: Usuario, nextParam: string | null, conCarrito: boolean) {
  const equipo = esEquipo(user);
  const inicio = equipo
    ? '/admin'
    : conCarrito
      ? '/checkout'
      : user.tiendas.length
        ? panelVendedor(user, { recordar: false })
        : '/buscar';
  const next = safeNext(nextParam, inicio);
  return equipo && next === '/cuenta' ? '/admin' : next;
}
