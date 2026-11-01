import { z } from 'zod';

const rolId = z.string().uuid('Elegí un rol');

export const inviteSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('El correo no es válido'),
    rol_id: rolId,
  }),
});

export const memberSchema = z.object({
  body: z
    .object({
      rol_id: rolId.optional(),
      estado: z.enum(['activo', 'suspendido', 'retirado'], { errorMap: () => ({ message: 'Estado inválido' }) }).optional(),
    })
    .refine((b) => b.rol_id || b.estado, 'Indicá el rol o el estado'),
});

export type InviteInput = z.infer<typeof inviteSchema>['body'];
export type MemberInput = z.infer<typeof memberSchema>['body'];
