import { Router } from 'express';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { uuidParam } from '../../common/middlewares/ids.middleware.js';
import { responder } from '../../common/utils/responder.js';
import { CartService } from './cart.service.js';
import { addItemSchema, itemsSchema, quantitySchema } from './cart.schema.js';

const router = Router();
router.param('varianteId', uuidParam);

// Sin sesión: el navegador manda su carrito y recibe los datos actualizados.
router.post('/vista-previa', validate(itemsSchema), responder((req) => CartService.preview(req.body.items)));

router.use(authenticate);
router.get('/', responder((req) => CartService.get(req.user!.id)));
router.post('/items', validate(addItemSchema), responder((req) => CartService.add(req.user!.id, req.body)));
router.patch(
  '/items/:varianteId',
  validate(quantitySchema),
  responder((req) => CartService.setQuantity(req.user!.id, req.params.varianteId, req.body.cantidad))
);
router.delete('/items/:varianteId', responder((req) => CartService.remove(req.user!.id, req.params.varianteId)));
router.post('/unir', validate(itemsSchema), responder((req) => CartService.merge(req.user!.id, req.body.items)));

export default router;
