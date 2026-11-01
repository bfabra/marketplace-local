import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { StoresController } from './stores.controller.js';
import { StoresService, TipoImagen } from './stores.service.js';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { uuidParam } from '../../common/middlewares/ids.middleware.js';
import { AppError } from '../../common/errors/app-error.js';
import { TIPOS_IMAGEN } from '../../common/utils/images.js';
import { responder } from '../../common/utils/responder.js';
import { changePlanSchema, createStoreSchema, googleMapsSchema, updateStoreSchema } from './stores.schema.js';
import { buscarEnGoogleMaps } from './google-maps.js';

const router = Router();

// Cada búsqueda en Google Maps tiene costo: un tope por conexión.
const googleMapsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Hiciste muchas búsquedas en Google Maps. Probá de nuevo en un rato' },
});

// En memoria: el archivo se escribe recién después de verificar los permisos.
const leerFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    file.mimetype in TIPOS_IMAGEN ? cb(null, true) : cb(new AppError('Solo se aceptan fotos JPG, PNG o WEBP', 400)),
}).single('foto');

const subirFoto = (req: Request, res: Response, next: NextFunction) =>
  leerFoto(req, res, (err?: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(new AppError(err.code === 'LIMIT_FILE_SIZE' ? 'La foto puede pesar hasta 5 MB' : 'Subí una sola foto', 400));
    }
    if (!err && !req.file) return next(new AppError('Elegí una foto', 400));
    next(err);
  });

router.use(authenticate);
router.param('id', uuidParam);
router.param('tipo', (_req, _res, next, tipo: string) =>
  next(tipo === 'portada' || tipo === 'logo' ? undefined : new AppError('Tipo de imagen inválido', 400))
);

router.post('/', validate(createStoreSchema), StoresController.create);
router.get(
  '/google-maps',
  googleMapsLimiter,
  validate(googleMapsSchema),
  responder((req) => buscarEnGoogleMaps(String(req.query.q)))
);
router.get('/:id', StoresController.detail);
router.patch('/:id', validate(updateStoreSchema), StoresController.update);
router.post(
  '/:id/imagen/:tipo',
  subirFoto,
  responder((req) => StoresService.changeImage(req.user!.id, req.params.id, req.params.tipo as TipoImagen, req.file))
);
router.delete(
  '/:id/imagen/:tipo',
  responder((req) => StoresService.changeImage(req.user!.id, req.params.id, req.params.tipo as TipoImagen))
);
router.post('/:id/mercadopago/prueba', StoresController.linkTestMercadoPago);
router.get('/:id/seguidores', responder((req) => StoresService.followers(req.user!.id, req.params.id)));
router.get('/:id/planes', responder((req) => StoresService.plans(req.user!.id, req.params.id)));
router.post(
  '/:id/plan',
  validate(changePlanSchema),
  responder((req) => StoresService.changePlan(req.user!.id, req.params.id, req.body.plan_id))
);

export default router;
