import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { env } from './config/env.js';
import { errorHandler } from './common/errors/errorHandler.js';
import { llamar, prisma } from './config/db.js';
import authRoutes from './modules/auth/auth.routes.js';
import storesRoutes from './modules/stores/stores.routes.js';
import locationsRoutes from './modules/locations/locations.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import catalogRoutes from './modules/catalog/catalog.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import favoritesRoutes from './modules/favorites/favorites.routes.js';
import followingRoutes from './modules/following/following.routes.js';
import { addressRoutes, ordersRoutes } from './modules/orders/orders.routes.js';
import salesRoutes from './modules/sales/sales.routes.js';
import { invitationRoutes, teamRoutes } from './modules/team/team.routes.js';
import { UPLOADS_DIR, usaStorageRemoto } from './common/utils/images.js';
import { correoDisponible } from './common/utils/correo.js';

const app = express();

// Local: Next proxy en la misma máquina → loopback.
// Producción (Render): un hop detrás del proxy de Render → confiar X-Forwarded-*.
app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : 'loopback');

app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Estado del API y de la base
app.get('/api/health', async (_req, res, next) => {
  try {
    const estado = await llamar<{ tablas: number }>(prisma, Prisma.sql`select pkg_sistema.estado() as r`);
    res.json({ ok: true, db: 'conectada', ...estado });
  } catch (error) {
    next(error);
  }
});

// Funciones que dependen de servicios externos: la web solo muestra las configuradas.
app.get('/api/opciones', (_req, res) => {
  res.json({
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    googleMaps: !!env.GOOGLE_MAPS_API_KEY,
    recuperarClave: correoDisponible(),
  });
});

// Montaje de rutas
app.use('/api/auth', authRoutes);
app.use('/api/stores/:storeId/products', productsRoutes);
app.use('/api/stores/:storeId/team', teamRoutes);
app.use('/api/stores/:storeId/orders', salesRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/seguidos', followingRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/addresses', addressRoutes);

// Fotos en disco solo en desarrollo local. En producción van a Supabase Storage.
if (!usaStorageRemoto()) {
  app.use('/api/uploads', express.static(UPLOADS_DIR, { maxAge: '7d', index: false, dotfiles: 'deny' }));
}

// Middleware de errores global (debe ir al final)
app.use(errorHandler);

export default app;