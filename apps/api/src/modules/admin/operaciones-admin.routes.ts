import { Router } from 'express';
import { OperationsAdminService } from './operaciones-admin.service.js';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authorizeAdmin } from '../../common/middlewares/auth.middleware.js';
import { responder } from '../../common/utils/responder.js';
import {
  idSchema,
  usersQuery,
  blockUserSchema,
  unblockUserSchema,
  ordersQuery,
  cancelPartSchema,
  refundSchema,
  processRefundSchema,
  createPlanSchema,
  updatePlanSchema,
  orderPlanSchema,
  subscriptionsQuery,
  extendSubscriptionSchema,
  subscriptionPaymentSchema,
  cancelSubscriptionSchema,
} from './operaciones-admin.schema.js';

// Se monta dentro de /api/admin, después de authenticate.
const router = Router();
const soporte = authorizeAdmin('soporte');
const finanzas = authorizeAdmin('finanzas');
const verPedidos = authorizeAdmin('soporte', 'finanzas', 'logistica');
const cancelarPedidos = authorizeAdmin('soporte', 'logistica');

// ---------- Usuarios ----------
router.get('/usuarios', soporte, responder((req) => OperationsAdminService.users(usersQuery.parse(req.query))));
router.get(
  '/usuarios/:id',
  soporte,
  validate(idSchema),
  responder((req) => OperationsAdminService.user(req.params.id))
);
router.post(
  '/usuarios/:id/bloqueo',
  soporte,
  validate(blockUserSchema),
  responder((req) => OperationsAdminService.blockUser(req.user!.id, req.params.id, req.body.motivo))
);
router.post(
  '/usuarios/:id/desbloqueo',
  soporte,
  validate(unblockUserSchema),
  responder((req) => OperationsAdminService.unblockUser(req.user!.id, req.params.id, req.body.nota))
);

// ---------- Pedidos ----------
router.get('/pedidos', verPedidos, responder((req) => OperationsAdminService.orders(ordersQuery.parse(req.query))));
router.get(
  '/pedidos/:id',
  verPedidos,
  validate(idSchema),
  responder((req) => OperationsAdminService.order(req.user!.id, req.params.id))
);
router.post(
  '/pedidos/:id/partes/:parteId/cancelacion',
  cancelarPedidos,
  validate(cancelPartSchema),
  responder((req) =>
    OperationsAdminService.cancelPart(req.user!.id, req.params.id, req.params.parteId, req.body.motivo)
  )
);
router.post(
  '/pedidos/:id/reembolsos',
  finanzas,
  validate(refundSchema),
  responder((req) => OperationsAdminService.refund(req.user!.id, req.params.id, req.body))
);
router.patch(
  '/pedidos/:id/reembolsos/:reembolsoId',
  finanzas,
  validate(processRefundSchema),
  responder((req) =>
    OperationsAdminService.processRefund(
      req.user!.id,
      req.params.id,
      req.params.reembolsoId,
      req.body.aprobar,
      req.body.nota
    )
  )
);

// ---------- Planes ----------
router.get('/planes', finanzas, responder(() => OperationsAdminService.plans()));
router.post(
  '/planes',
  finanzas,
  validate(createPlanSchema),
  responder((req) => OperationsAdminService.savePlan(req.user!.id, null, req.body), 201)
);
router.put(
  '/planes/:id',
  finanzas,
  validate(updatePlanSchema),
  responder((req) => OperationsAdminService.savePlan(req.user!.id, req.params.id, req.body))
);
router.post(
  '/planes/:id/orden',
  finanzas,
  validate(orderPlanSchema),
  responder((req) => OperationsAdminService.movePlan(req.user!.id, req.params.id, req.body.direccion))
);

// ---------- Suscripciones ----------
router.get(
  '/suscripciones',
  finanzas,
  responder((req) => OperationsAdminService.subscriptions(subscriptionsQuery.parse(req.query)))
);
router.get(
  '/suscripciones/:id',
  finanzas,
  validate(idSchema),
  responder((req) => OperationsAdminService.subscription(req.params.id))
);
router.post(
  '/suscripciones/:id/extension',
  finanzas,
  validate(extendSubscriptionSchema),
  responder((req) =>
    OperationsAdminService.extendSubscription(req.user!.id, req.params.id, req.body.dias, req.body.motivo)
  )
);
router.post(
  '/suscripciones/:id/pagos',
  finanzas,
  validate(subscriptionPaymentSchema),
  responder((req) => OperationsAdminService.registerSubscriptionPayment(req.user!.id, req.params.id, req.body.referencia))
);
router.post(
  '/suscripciones/:id/cancelacion',
  finanzas,
  validate(cancelSubscriptionSchema),
  responder((req) => OperationsAdminService.cancelSubscription(req.user!.id, req.params.id, req.body.motivo))
);

export default router;
