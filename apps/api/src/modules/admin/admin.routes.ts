import { Router } from 'express';
import { AdminService } from './admin.service.js';
import catalogoRoutes from './catalogo-admin.routes.js';
import operacionesRoutes from './operaciones-admin.routes.js';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate, authorizeAdmin } from '../../common/middlewares/auth.middleware.js';
import { responder } from '../../common/utils/responder.js';
import {
  changeStoreStateSchema,
  assignRoleSchema,
  removeRoleSchema,
  createStoreRoleSchema,
  updateStoreRoleSchema,
  saveSettingSchema,
  activityFilters,
  activityQuery,
  storesQuery,
  idParamsSchema,
  reviewPolicySchema,
  productsQuery,
  moderateProductSchema,
} from './admin.schema.js';

const router = Router();

router.use(authenticate);

// Sin roles = cualquier rol de plataforma; la base arma el tablero según cada uno.
router.get('/tablero', authorizeAdmin(), responder((req) => AdminService.dashboard(req.user!.id)));

const moderacion = authorizeAdmin('moderacion');

router.get('/stores', moderacion, responder((req) => AdminService.stores(storesQuery.parse(req.query))));
router.get(
  '/stores/:id',
  moderacion,
  validate(idParamsSchema),
  responder((req) => AdminService.store(req.params.id))
);
router.patch(
  '/stores/:id/estado',
  moderacion,
  validate(changeStoreStateSchema),
  responder((req) => AdminService.changeStoreState(req.user!.id, req.params.id, req.body))
);
router.patch(
  '/stores/:id/revision',
  moderacion,
  validate(reviewPolicySchema),
  responder((req) => AdminService.setReviewPolicy(req.user!.id, req.params.id, req.body.politica))
);

router.get('/products', moderacion, responder((req) => AdminService.products(productsQuery.parse(req.query))));
router.get(
  '/products/:id',
  moderacion,
  validate(idParamsSchema),
  responder((req) => AdminService.product(req.params.id))
);
router.post(
  '/products/:id/moderacion',
  moderacion,
  validate(moderateProductSchema),
  responder((req) => AdminService.moderateProduct(req.user!.id, req.params.id, req.body))
);

router.get('/roles', authorizeAdmin('superadmin'), responder(() => AdminService.platformRoles()));
router.post(
  '/roles',
  authorizeAdmin('superadmin'),
  validate(assignRoleSchema),
  responder((req) => AdminService.assignRole(req.user!.id, req.body), 201)
);
router.delete(
  '/roles/:usuarioId/:rol',
  authorizeAdmin('superadmin'),
  validate(removeRoleSchema),
  responder((req) => AdminService.removeRole(req.user!.id, req.params.usuarioId, req.params.rol))
);

router.get('/roles-tienda', authorizeAdmin('superadmin'), responder(() => AdminService.storeRoles()));
router.post(
  '/roles-tienda',
  authorizeAdmin('superadmin'),
  validate(createStoreRoleSchema),
  responder((req) => AdminService.saveStoreRole(req.user!.id, null, req.body), 201)
);
router.put(
  '/roles-tienda/:id',
  authorizeAdmin('superadmin'),
  validate(updateStoreRoleSchema),
  responder((req) => AdminService.saveStoreRole(req.user!.id, req.params.id, req.body))
);
router.delete(
  '/roles-tienda/:id',
  authorizeAdmin('superadmin'),
  validate(idParamsSchema),
  responder((req) => AdminService.removeStoreRole(req.user!.id, req.params.id))
);

router.get('/configuracion', authorizeAdmin('superadmin'), responder(() => AdminService.settings()));
router.put(
  '/configuracion/:clave',
  authorizeAdmin('superadmin'),
  validate(saveSettingSchema),
  responder((req) => AdminService.saveSetting(req.user!.id, req.params.clave, req.body.valor))
);

router.get(
  '/actividad',
  authorizeAdmin('superadmin'),
  responder((req) => AdminService.activity(activityQuery.parse(req.query)))
);
router.get(
  '/actividad/exportar',
  authorizeAdmin('superadmin'),
  responder((req) => AdminService.exportActivity(activityFilters.parse(req.query)))
);

router.use(catalogoRoutes);
router.use(operacionesRoutes);

export default router;
