import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

// `sub` es el id de auth.users, el mismo campo que usan los tokens de Supabase.
export interface TokenPayload {
  sub: string;
}

export const generateToken = (payload: TokenPayload, segundos = 7 * 24 * 60 * 60): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: segundos,
  });
};

/** `iat`: cuándo se emitió (segundos), para rechazar sesiones anteriores a un cambio de contraseña. */
export const verifyToken = (token: string): TokenPayload & { iat: number } => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload & { iat: number };
};
