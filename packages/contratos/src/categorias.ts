import { z } from 'zod';
import { contador, uuid } from './comunes.js';

/**
 * pkg_catalogo.categorias(): las categorías visibles, en el orden del menú.
 * El producto va en el último nivel (una categoría sin subcategorías).
 */
export const categoria = z.object({
  id: uuid,
  nombre: z.string(),
  padre_id: uuid.nullable(),
  ruta: z.string(),
  /** Camino completo, ej.: "Alquileres › Inmuebles › Casas". */
  etiqueta: z.string(),
  /** Lo que se publique acá pasa por moderación (propio o heredado). */
  revision: z.boolean(),
  /** Productos publicados de tiendas activas, sumando sus subcategorías. */
  productos: contador,
});
export const categorias = z.array(categoria);
export type Categoria = z.infer<typeof categoria>;
