import { Router } from 'express';
import { CatalogAdminService } from './catalogo-admin.service.js';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authorizeAdmin } from '../../common/middlewares/auth.middleware.js';
import { responder } from '../../common/utils/responder.js';
import {
  idSchema,
  createCategorySchema,
  updateCategorySchema,
  activeSchema,
  reviewCategorySchema,
  orderCategorySchema,
  categoryAttributeSchema,
  removeCategoryAttributeSchema,
  createAttributeSchema,
  updateAttributeSchema,
  createOptionSchema,
  updateOptionSchema,
  removeOptionSchema,
  territoryQuery,
  createProvinceSchema,
  updateProvinceSchema,
  createLocalitySchema,
  updateLocalitySchema,
  shippingRateSchema,
  createRubroSchema,
  updateRubroSchema,
} from './catalogo-admin.schema.js';

// Se monta dentro de /api/admin, después de authenticate.
const router = Router();
const moderacion = authorizeAdmin('moderacion');
const logistica = authorizeAdmin('logistica');
const superadmin = authorizeAdmin('superadmin');

// ---------- Categorías ----------
router.get('/categorias', moderacion, responder(() => CatalogAdminService.categories()));
router.get(
  '/categorias/:id',
  moderacion,
  validate(idSchema),
  responder((req) => CatalogAdminService.category(req.params.id))
);
router.post(
  '/categorias',
  moderacion,
  validate(createCategorySchema),
  responder((req) => CatalogAdminService.saveCategory(req.user!.id, null, req.body), 201)
);
router.put(
  '/categorias/:id',
  moderacion,
  validate(updateCategorySchema),
  responder((req) => CatalogAdminService.saveCategory(req.user!.id, req.params.id, req.body))
);
router.patch(
  '/categorias/:id/activa',
  moderacion,
  validate(activeSchema),
  responder((req) => CatalogAdminService.setCategoryActive(req.user!.id, req.params.id, req.body.activa))
);
router.patch(
  '/categorias/:id/revision',
  moderacion,
  validate(reviewCategorySchema),
  responder((req) => CatalogAdminService.setCategoryReview(req.user!.id, req.params.id, req.body.requiere_revision))
);
router.patch(
  '/categorias/:id/orden',
  moderacion,
  validate(orderCategorySchema),
  responder((req) => CatalogAdminService.moveCategory(req.user!.id, req.params.id, req.body.direccion))
);
router.delete(
  '/categorias/:id',
  moderacion,
  validate(idSchema),
  responder((req) => CatalogAdminService.deleteCategory(req.user!.id, req.params.id))
);
router.put(
  '/categorias/:id/atributos/:atributoId',
  moderacion,
  validate(categoryAttributeSchema),
  responder((req) =>
    CatalogAdminService.saveCategoryAttribute(req.user!.id, req.params.id, req.params.atributoId, req.body)
  )
);
router.delete(
  '/categorias/:id/atributos/:atributoId',
  moderacion,
  validate(removeCategoryAttributeSchema),
  responder((req) => CatalogAdminService.removeCategoryAttribute(req.user!.id, req.params.id, req.params.atributoId))
);

// ---------- Atributos ----------
router.get('/atributos', moderacion, responder(() => CatalogAdminService.attributes()));
router.post(
  '/atributos',
  moderacion,
  validate(createAttributeSchema),
  responder((req) => CatalogAdminService.saveAttribute(req.user!.id, null, req.body), 201)
);
router.put(
  '/atributos/:id',
  moderacion,
  validate(updateAttributeSchema),
  responder((req) => CatalogAdminService.saveAttribute(req.user!.id, req.params.id, req.body))
);
router.delete(
  '/atributos/:id',
  moderacion,
  validate(idSchema),
  responder((req) => CatalogAdminService.deleteAttribute(req.user!.id, req.params.id))
);
router.post(
  '/atributos/:id/opciones',
  moderacion,
  validate(createOptionSchema),
  responder((req) => CatalogAdminService.saveOption(req.user!.id, req.params.id, null, req.body.valor), 201)
);
router.put(
  '/atributos/:id/opciones/:opcionId',
  moderacion,
  validate(updateOptionSchema),
  responder((req) => CatalogAdminService.saveOption(req.user!.id, req.params.id, req.params.opcionId, req.body.valor))
);
router.delete(
  '/atributos/:id/opciones/:opcionId',
  moderacion,
  validate(removeOptionSchema),
  responder((req) => CatalogAdminService.deleteOption(req.user!.id, req.params.opcionId))
);

// ---------- Rubros ----------
router.get('/rubros', superadmin, responder(() => CatalogAdminService.rubros()));
router.post(
  '/rubros',
  superadmin,
  validate(createRubroSchema),
  responder((req) => CatalogAdminService.saveRubro(req.user!.id, null, req.body.nombre, req.body.padre_id ?? null), 201)
);
router.put(
  '/rubros/:id',
  superadmin,
  validate(updateRubroSchema),
  responder((req) => CatalogAdminService.updateRubro(req.user!.id, req.params.id, req.body))
);
router.patch(
  '/rubros/:id/activa',
  superadmin,
  validate(activeSchema),
  responder((req) => CatalogAdminService.setRubroActive(req.user!.id, req.params.id, req.body.activa))
);
router.patch(
  '/rubros/:id/orden',
  superadmin,
  validate(orderCategorySchema),
  responder((req) => CatalogAdminService.moveRubro(req.user!.id, req.params.id, req.body.direccion))
);
router.delete(
  '/rubros/:id',
  superadmin,
  validate(idSchema),
  responder((req) => CatalogAdminService.deleteRubro(req.user!.id, req.params.id))
);

// ---------- Territorio ----------
router.get(
  '/territorio',
  logistica,
  responder((req) => CatalogAdminService.territory(territoryQuery.parse(req.query).provincia))
);
router.post(
  '/provincias',
  logistica,
  validate(createProvinceSchema),
  responder((req) => CatalogAdminService.saveProvince(req.user!.id, null, req.body.nombre), 201)
);
router.put(
  '/provincias/:id',
  logistica,
  validate(updateProvinceSchema),
  responder((req) => CatalogAdminService.saveProvince(req.user!.id, req.params.id, req.body.nombre))
);
router.patch(
  '/provincias/:id/activa',
  logistica,
  validate(activeSchema),
  responder((req) => CatalogAdminService.setProvinceActive(req.user!.id, req.params.id, req.body.activa))
);
router.post(
  '/provincias/:id/localidades',
  logistica,
  validate(createLocalitySchema),
  responder((req) => CatalogAdminService.saveLocality(req.user!.id, req.params.id, null, req.body.nombre), 201)
);
router.put(
  '/provincias/:id/localidades/:localidadId',
  logistica,
  validate(updateLocalitySchema),
  responder((req) =>
    CatalogAdminService.saveLocality(req.user!.id, req.params.id, req.params.localidadId, req.body.nombre)
  )
);
router.patch(
  '/localidades/:id/activa',
  logistica,
  validate(activeSchema),
  responder((req) => CatalogAdminService.setLocalityActive(req.user!.id, req.params.id, req.body.activa))
);
router.put(
  '/localidades/:id/tarifa',
  logistica,
  validate(shippingRateSchema),
  responder((req) => CatalogAdminService.setShippingRate(req.user!.id, req.params.id, req.body))
);
router.delete(
  '/localidades/:id',
  logistica,
  validate(idSchema),
  responder((req) => CatalogAdminService.deleteLocality(req.user!.id, req.params.id))
);

export default router;
