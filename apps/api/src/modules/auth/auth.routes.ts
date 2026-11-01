import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { validate } from '../../common/middlewares/validate.middleware.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { responder } from '../../common/utils/responder.js';
import {
  registerSchema,
  loginSchema,
  googleSchema,
  recoverSchema,
  resetSchema,
  resetTokenSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './auth.schema.js';

const router = Router();

// Solo cuentan los intentos fallidos: frena a quien prueba contraseñas.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Probá de nuevo en 15 minutos' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados registros desde esta conexión. Probá más tarde' },
});

// Pedir enlaces y usarlos: frena a quien manda correos a terceros o prueba códigos.
const recoverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos. Probá de nuevo en 15 minutos' },
});

router.post('/register', registerLimiter, validate(registerSchema), AuthController.register);
router.post('/login', loginLimiter, validate(loginSchema), AuthController.login);
router.post('/google', loginLimiter, validate(googleSchema), AuthController.google);
router.post('/recuperar', recoverLimiter, validate(recoverSchema), responder((req) => AuthService.recover(req.body.email)));
router.get(
  '/recuperar/:token',
  loginLimiter,
  validate(resetTokenSchema),
  responder((req) => AuthService.resetTokenValid(req.params.token))
);
router.post(
  '/restablecer',
  loginLimiter,
  validate(resetSchema),
  responder((req) => AuthService.reset(req.body.token, req.body.password))
);
router.post('/logout', AuthController.logout);
router.get('/me', authenticate, AuthController.me);
router.patch('/me', authenticate, validate(updateProfileSchema), AuthController.updateProfile);
router.post(
  '/password',
  authenticate,
  loginLimiter,
  validate(changePasswordSchema),
  AuthController.changePassword
);

export default router;
