import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ProductsController } from './products.controller.js';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { AppError } from '../../common/errors/app-error.js';
import { TIPOS_IMAGEN } from '../../common/utils/images.js';
import { productSchema, productStateSchema } from './products.schema.js';

// Montado en /api/stores/:storeId/products
const router = Router({ mergeParams: true });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validarIds = (req: Request, _res: Response, next: NextFunction) => {
  const invalido = ['storeId', 'productId', 'imageId'].some(
    (p) => req.params[p] !== undefined && !UUID.test(req.params[p])
  );
  return next(invalido ? new AppError('Identificador inválido', 400) : undefined);
};

// En memoria: el archivo se escribe recién después de verificar los permisos.
const subirFotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) =>
    file.mimetype in TIPOS_IMAGEN
      ? cb(null, true)
      : cb(new AppError('Solo se aceptan fotos JPG, PNG o WEBP', 400)),
}).array('fotos');

const leerPlanilla = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    /\.(xlsx|csv)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(new AppError('Subí la plantilla en Excel (.xlsx) o CSV', 400)),
}).single('archivo');

// Los mensajes genéricos de multer hablan de fotos.
const subirPlanilla = (req: Request, res: Response, next: NextFunction) =>
  leerPlanilla(req, res, (err?: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(new AppError(err.code === 'LIMIT_FILE_SIZE' ? 'El archivo puede pesar hasta 5 MB' : 'Subí un solo archivo', 400));
    }
    next(err);
  });

router.use(authenticate, validarIds);

router.get('/', ProductsController.list);
router.post('/', validate(productSchema), ProductsController.create);
router.get('/plantilla', ProductsController.template);
router.post('/importar', subirPlanilla, ProductsController.import);
router.get('/:productId', validarIds, ProductsController.detail);
router.put('/:productId', validarIds, validate(productSchema), ProductsController.update);
router.patch('/:productId/estado', validarIds, validate(productStateSchema), ProductsController.changeState);
router.delete('/:productId', validarIds, ProductsController.remove);
router.post('/:productId/imagenes', validarIds, subirFotos, ProductsController.addImages);
router.delete('/:productId/imagenes/:imageId', validarIds, ProductsController.removeImage);
router.post('/:productId/imagenes/:imageId/principal', validarIds, ProductsController.setMainImage);

export default router;
