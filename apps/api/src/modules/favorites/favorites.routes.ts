import { Router } from 'express';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { uuidParam } from '../../common/middlewares/ids.middleware.js';
import { responder } from '../../common/utils/responder.js';
import { FavoritesService } from './favorites.service.js';
import { idsSchema } from './favorites.schema.js';

const router = Router();
router.param('productoId', uuidParam);

// Sin sesión: el navegador manda sus favoritos y recibe las tarjetas.
router.post('/vista-previa', validate(idsSchema), responder((req) => FavoritesService.preview(req.body.ids)));

router.use(authenticate);
router.get('/', responder((req) => FavoritesService.get(req.user!.id)));
router.get('/ids', responder((req) => FavoritesService.ids(req.user!.id)));
router.put('/:productoId', responder((req) => FavoritesService.add(req.user!.id, req.params.productoId)));
router.delete('/:productoId', responder((req) => FavoritesService.remove(req.user!.id, req.params.productoId)));
router.post('/unir', validate(idsSchema), responder((req) => FavoritesService.merge(req.user!.id, req.body.ids)));

export default router;
