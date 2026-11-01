import { z } from 'zod';
import { contador, uuid } from './comunes.js';

/** pkg_catalogo.rubros(): lista para elegir, rubro → subrubros → especialidades (solo activos). */
export const opcionRubro = z.object({
  id: uuid,
  nombre: z.string(),
  slug: z.string(),
  descripcion: z.string().nullable(),
  subrubros: z.array(
    z.object({
      id: uuid,
      nombre: z.string(),
      slug: z.string(),
      especialidades: z.array(z.object({ id: uuid, nombre: z.string() })),
    })
  ),
});
export const opcionesRubro = z.array(opcionRubro);
export type OpcionRubro = z.infer<typeof opcionRubro>;

/** pkg_catalogo.rubro(): el rubro declarado que ve el público. */
export const rubro = z.object({
  nombre: z.string(),
  slug: z.string(),
  subrubro: z.string().nullable().optional(),
  especialidades: z.array(z.string()).optional(),
});
export type Rubro = z.infer<typeof rubro>;

/** Rubro de cada tienda en el panel de administración. */
export const rubroAdmin = z.object({
  nombre: z.string(),
  subrubro: z.string().nullable(),
});
export type RubroAdmin = z.infer<typeof rubroAdmin>;

/** Un rubro de la lista completa del superadmin; la web arma el árbol con padre_id. */
export const rubroLista = z.object({
  id: uuid,
  padre_id: uuid.nullable(),
  nombre: z.string(),
  slug: z.string(),
  descripcion: z.string().nullable(),
  nivel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  orden: z.number().int(),
  activo: z.boolean(),
  tiendas: contador,
});
export type RubroLista = z.infer<typeof rubroLista>;

/** pkg_admin.rubros(): todos los rubros (también inactivos) y cuántas tiendas no eligieron. */
export const rubrosAdmin = z.object({
  rubros: z.array(rubroLista),
  sinRubro: contador,
});
export type RubrosAdmin = z.infer<typeof rubrosAdmin>;
