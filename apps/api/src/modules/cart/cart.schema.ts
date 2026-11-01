import { z } from 'zod';

const cantidad = z.coerce
  .number({ invalid_type_error: 'La cantidad debe ser un número' })
  .int('La cantidad debe ser un número entero')
  .min(1, 'La cantidad tiene que ser al menos 1')
  .max(999, 'Máximo 999 unidades');

const item = z.object({ variante_id: z.string().uuid('Producto inválido'), cantidad });
const items = z.array(item).max(100, 'El carrito puede tener hasta 100 productos distintos');

export const itemsSchema = z.object({ body: z.object({ items }) });
export const addItemSchema = z.object({ body: item });
export const quantitySchema = z.object({ body: z.object({ cantidad }) });

export type CartItem = z.infer<typeof item>;
