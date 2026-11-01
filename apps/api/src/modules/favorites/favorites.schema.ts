import { z } from 'zod';

const ids = z.array(z.string().uuid('Producto inválido')).max(100, 'Podés guardar hasta 100 favoritos sin cuenta');

export const idsSchema = z.object({ body: z.object({ ids }) });
