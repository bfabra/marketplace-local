import { Response, NextFunction } from 'express';
import { ProductsService } from './products.service.js';
import { AuthenticatedRequest } from '../../common/middlewares/auth.middleware.js';
import { AppError } from '../../common/errors/app-error.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ProductsController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return res.json(await ProductsService.list(req.user!.id, req.params.storeId));
    } catch (error) {
      next(error);
    }
  }

  static async detail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return res.json(await ProductsService.detail(req.user!.id, req.params.storeId, req.params.productId));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return res.status(201).json(await ProductsService.create(req.user!.id, req.params.storeId, req.body));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { storeId, productId } = req.params;
      return res.json(await ProductsService.update(req.user!.id, storeId, productId, req.body));
    } catch (error) {
      next(error);
    }
  }

  static async template(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categoria = String(req.query.categoria ?? '');
      if (!UUID.test(categoria)) throw new AppError('Elegí una categoría', 400);
      const { archivo, nombre } = await ProductsService.template(categoria);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
      return res.send(archivo);
    } catch (error) {
      next(error);
    }
  }

  static async import(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError('Elegí el archivo con tus productos', 400);
      const categoria = typeof req.body.categoria_id === 'string' ? req.body.categoria_id : '';
      return res.json(
        await ProductsService.import(req.user!.id, req.params.storeId, req.file, {
          categoriaId: UUID.test(categoria) ? categoria : null,
          publicar: req.body.publicar === 'true',
          confirmar: req.body.confirmar === 'true',
        })
      );
    } catch (error) {
      next(error);
    }
  }

  static async changeState(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { storeId, productId } = req.params;
      return res.json(await ProductsService.changeState(req.user!.id, storeId, productId, req.body.estado));
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await ProductsService.remove(req.user!.id, req.params.storeId, req.params.productId);
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  static async addImages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { storeId, productId } = req.params;
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      return res.status(201).json(await ProductsService.addImages(req.user!.id, storeId, productId, files));
    } catch (error) {
      next(error);
    }
  }

  static async removeImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { storeId, productId, imageId } = req.params;
      return res.json(await ProductsService.removeImage(req.user!.id, storeId, productId, imageId));
    } catch (error) {
      next(error);
    }
  }

  static async setMainImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { storeId, productId, imageId } = req.params;
      return res.json(await ProductsService.setMainImage(req.user!.id, storeId, productId, imageId));
    } catch (error) {
      next(error);
    }
  }
}
