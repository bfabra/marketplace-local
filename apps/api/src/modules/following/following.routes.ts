import { Router } from 'express';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { uuidParam } from '../../common/middlewares/ids.middleware.js';
import { responder } from '../../common/utils/responder.js';
import { FollowingService } from './following.service.js';

// Montado en /api/seguidos: tiendas que sigue la persona con sesión.
const router = Router();
router.param('tiendaId', uuidParam);

router.use(authenticate);
router.get('/ids', responder((req) => FollowingService.ids(req.user!.id)));
router.get('/sugerencias', responder((req) => FollowingService.suggestions(req.user!.id)));
router.put('/:tiendaId', responder((req) => FollowingService.follow(req.user!.id, req.params.tiendaId)));
router.delete('/:tiendaId', responder((req) => FollowingService.unfollow(req.user!.id, req.params.tiendaId)));

export default router;
