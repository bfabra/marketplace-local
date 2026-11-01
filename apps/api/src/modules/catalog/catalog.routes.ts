import { Router, Request, Response, NextFunction } from 'express';
import { CatalogService } from './catalog.service.js';
import { buscarQuery, inicioQuery, sugerenciasQuery } from './catalog.schema.js';

const router = Router();

// Rutas públicas: no requieren sesión.
const responder =
  (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await fn(req));
    } catch (error) {
      next(error);
    }
  };

router.get('/categorias', responder(() => CatalogService.categorias()));
router.get('/categorias/:id/atributos', responder((req) => CatalogService.atributos(req.params.id)));
router.get('/rubros', responder(() => CatalogService.rubros()));
router.get('/inicio', responder((req) => CatalogService.inicio(inicioQuery.parse(req.query).localidad)));
router.get(
  '/sugerencias',
  responder((req) => {
    const { q, localidad } = sugerenciasQuery.parse(req.query);
    return CatalogService.sugerencias(q, localidad);
  })
);
router.get('/buscar', responder((req) => CatalogService.buscar(buscarQuery.parse(req.query))));
router.get('/tiendas', responder(() => CatalogService.tiendas()));
router.get('/tiendas/:slug', responder((req) => CatalogService.tienda(req.params.slug)));
router.get(
  '/tiendas/:slug/productos/:producto',
  responder((req) => CatalogService.producto(req.params.slug, req.params.producto))
);

export default router;
