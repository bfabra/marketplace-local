import { z } from 'zod';

const uuidOpcional = z
  .string()
  .uuid('Identificador inválido')
  .optional()
  .or(z.literal('').transform(() => undefined));

const texto = z.string().trim().max(80, 'La búsqueda puede tener hasta 80 caracteres').optional();

export const inicioQuery = z.object({ localidad: uuidOpcional });

export const sugerenciasQuery = z.object({ q: texto, localidad: uuidOpcional });

export const buscarQuery = z.object({
  q: texto,
  localidad: uuidOpcional,
  categoria: uuidOpcional,
  orden: z.enum(['relevancia', 'recientes', 'precio_asc', 'precio_desc']).default('relevancia'),
  pagina: z.coerce.number().int().min(1).max(20).default(1),
});

export type BuscarQuery = z.infer<typeof buscarQuery>;
