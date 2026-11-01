import { Response, NextFunction } from 'express';
import { StoresService } from './stores.service.js';
import { AuthenticatedRequest } from '../../common/middlewares/auth.middleware.js';

export class StoresController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await StoresService.create(req.user!.id, req.body);
      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async detail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await StoresService.detail(req.user!.id, req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await StoresService.update(req.user!.id, req.params.id, req.body);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async linkTestMercadoPago(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await StoresService.linkTestMercadoPago(req.user!.id, req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
