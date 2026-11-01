import { Router } from 'express';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { uuidParam } from '../../common/middlewares/ids.middleware.js';
import { responder } from '../../common/utils/responder.js';
import { OrdersService } from './orders.service.js';
import { addressSchema, createOrderSchema, simulatedPaymentSchema } from './orders.schema.js';

// Montado en /api/orders: compras del usuario con sesión iniciada.
export const ordersRoutes = Router();
ordersRoutes.use(authenticate);
ordersRoutes.param('id', uuidParam);

ordersRoutes.get('/checkout', responder((req) => OrdersService.checkout(req.user!.id)));
ordersRoutes.get('/', responder((req) => OrdersService.list(req.user!.id)));
ordersRoutes.post('/', validate(createOrderSchema), responder((req) => OrdersService.create(req.user!.id, req.body), 201));
ordersRoutes.get('/:id', responder((req) => OrdersService.detail(req.user!.id, req.params.id)));
ordersRoutes.post(
  '/:id/pago-simulado',
  validate(simulatedPaymentSchema),
  responder((req) => OrdersService.simulatePayment(req.user!.id, req.params.id, req.body.aprobado))
);

// Montado en /api/addresses: direcciones de entrega del usuario.
export const addressRoutes = Router();
addressRoutes.use(authenticate);
addressRoutes.param('id', uuidParam);

addressRoutes.get('/', responder((req) => OrdersService.addresses(req.user!.id)));
addressRoutes.post('/', validate(addressSchema), responder((req) => OrdersService.saveAddress(req.user!.id, null, req.body), 201));
addressRoutes.put('/:id', validate(addressSchema), responder((req) => OrdersService.saveAddress(req.user!.id, req.params.id, req.body)));
addressRoutes.delete('/:id', responder((req) => OrdersService.removeAddress(req.user!.id, req.params.id)));
