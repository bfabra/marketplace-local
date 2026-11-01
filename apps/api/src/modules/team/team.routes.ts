import { Router } from 'express';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { uuidParam, validarIds } from '../../common/middlewares/ids.middleware.js';
import { responder } from '../../common/utils/responder.js';
import { TeamService } from './team.service.js';
import { inviteSchema, memberSchema } from './team.schema.js';

// Montado en /api/stores/:storeId/team
export const teamRoutes = Router({ mergeParams: true });

teamRoutes.use(authenticate, validarIds('storeId'));
for (const p of ['invitationId', 'memberId']) teamRoutes.param(p, uuidParam);

teamRoutes.get('/', responder((req) => TeamService.detail(req.user!.id, req.params.storeId)));
teamRoutes.post(
  '/invitaciones',
  validate(inviteSchema),
  responder((req) => TeamService.invite(req.user!.id, req.params.storeId, req.body), 201)
);
teamRoutes.delete(
  '/invitaciones/:invitationId',
  responder((req) => TeamService.cancelInvitation(req.user!.id, req.params.storeId, req.params.invitationId))
);
teamRoutes.patch(
  '/miembros/:memberId',
  validate(memberSchema),
  responder((req) => TeamService.updateMember(req.user!.id, req.params.storeId, req.params.memberId, req.body))
);
// Montado en /api/invitations: el invitado ve la invitación sin sesión y la acepta con sesión.
export const invitationRoutes = Router();

invitationRoutes.get('/:token', responder((req) => TeamService.invitation(req.params.token)));
invitationRoutes.post(
  '/:token/aceptar',
  authenticate,
  responder((req) => TeamService.accept(req.user!.id, req.params.token))
);
