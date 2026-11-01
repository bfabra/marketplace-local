import type { RolPlataforma } from '@/lib/api-client';
import type { IconName } from '@/components/ui/icon';

export interface SeccionAdmin {
  href: string;
  label: string;
  icon: IconName;
  /** Roles que la ven además del superadmin. Vacío: cualquier rol de plataforma. */
  roles: RolPlataforma[];
  /** Las que todavía no están hechas se muestran como "Pronto". */
  lista: boolean;
}

export const GRUPOS_ADMIN: { titulo: string; secciones: SeccionAdmin[] }[] = [
  {
    titulo: 'General',
    secciones: [{ href: '/admin', label: 'Dashboard', icon: 'home', roles: [], lista: true }],
  },
  {
    titulo: 'Marketplace',
    secciones: [
      { href: '/admin/usuarios', label: 'Usuarios', icon: 'users', roles: ['soporte'], lista: true },
      { href: '/admin/tiendas', label: 'Tiendas', icon: 'store', roles: ['moderacion'], lista: true },
      { href: '/admin/productos', label: 'Productos y moderación', icon: 'package', roles: ['moderacion'], lista: true },
      { href: '/admin/pedidos', label: 'Pedidos', icon: 'receipt', roles: ['soporte', 'finanzas', 'logistica'], lista: true },
      { href: '/admin/suscripciones', label: 'Suscripciones y planes', icon: 'card', roles: ['finanzas'], lista: true },
    ],
  },
  {
    titulo: 'Catálogo y territorio',
    secciones: [
      { href: '/admin/categorias', label: 'Categorías y atributos', icon: 'grid', roles: ['moderacion'], lista: true },
      { href: '/admin/rubros', label: 'Rubros', icon: 'tag', roles: ['superadmin'], lista: true },
      { href: '/admin/ubicaciones', label: 'Provincias y localidades', icon: 'pin', roles: ['logistica'], lista: true },
    ],
  },
  {
    titulo: 'Plataforma',
    secciones: [
      { href: '/admin/configuracion', label: 'Configuración general', icon: 'sliders', roles: ['superadmin'], lista: true },
      { href: '/admin/actividad', label: 'Actividad', icon: 'history', roles: ['superadmin'], lista: true },
      { href: '/admin/roles', label: 'Roles de plataforma', icon: 'shieldAdmin', roles: ['superadmin'], lista: true },
      { href: '/admin/roles-tienda', label: 'Roles de las tiendas', icon: 'shield', roles: ['superadmin'], lista: true },
    ],
  },
];

export function puedeVer(seccion: SeccionAdmin, roles: RolPlataforma[]) {
  if (roles.includes('superadmin')) return true;
  if (seccion.roles.length === 0) return roles.length > 0;
  return seccion.roles.some((r) => roles.includes(r));
}

export function grupoDe(seccion: SeccionAdmin) {
  return GRUPOS_ADMIN.find((g) => g.secciones.includes(seccion))?.titulo;
}

/** Sección a la que pertenece una ruta del panel (la más específica). */
export function seccionDe(path: string) {
  return GRUPOS_ADMIN.flatMap((g) => g.secciones)
    .filter((s) => path === s.href || (s.href !== '/admin' && path.startsWith(`${s.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
