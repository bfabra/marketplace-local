import { Router } from 'express';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { uuidParam, validarIds } from '../../common/middlewares/ids.middleware.js';
import { responder } from '../../common/utils/responder.js';
import { SalesService } from './sales.service.js';
import { orderStatusSchema } from './sales.schema.js';

// Montado en /api/stores/:storeId/orders
const router = Router({ mergeParams: true });
router.use(authenticate, validarIds('storeId'));
router.param('orderId', uuidParam);

router.get('/', responder((req) => SalesService.list(req.user!.id, req.params.storeId)));
router.patch(
  '/:orderId',
  validate(orderStatusSchema),
  responder((req) => SalesService.changeStatus(req.user!.id, req.params.storeId, req.params.orderId, req.body))
);

export default router;
