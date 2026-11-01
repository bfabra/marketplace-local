import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { llamar, withUser } from '../../config/db.js';

const router = Router();

// Localidades habilitadas, para los formularios. Lectura pública (rol anon).
router.get('/localidades', async (_req, res, next) => {
  try {
    const localidades = await withUser(null, (tx) =>
      llamar(tx, Prisma.sql`select pkg_ubicacion.localidades() as r`)
    );
    res.json(localidades);
  } catch (error) {
    next(error);
  }
});

export default router;
