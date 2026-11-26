import { createHash, randomInt } from 'node:crypto';

const MINUTOS = 10;
const COOLDOWN_MS = 60_000;

type Entrada = { hash: string; expira: number; pedidoEn: number };

const codigos = new Map<string, Entrada>();

const hashCodigo = (codigo: string) => createHash('sha256').update(codigo, 'utf8').digest('hex');

/** Genera un código de 6 dígitos para cambio de contraseña (2FA). */
export function emitirCodigo2fa(userId: string): { codigo: string; reintentoEn: number } {
  const actual = codigos.get(userId);
  const ahora = Date.now();
  if (actual && ahora - actual.pedidoEn < COOLDOWN_MS) {
    return { codigo: '', reintentoEn: Math.ceil((COOLDOWN_MS - (ahora - actual.pedidoEn)) / 1000) };
  }
  const codigo = String(randomInt(100000, 1000000));
  codigos.set(userId, {
    hash: hashCodigo(codigo),
    expira: ahora + MINUTOS * 60_000,
    pedidoEn: ahora,
  });
  return { codigo, reintentoEn: 0 };
}

/** Valida y consume el código 2FA (un solo uso). */
export function consumirCodigo2fa(userId: string, codigo: string): boolean {
  const entrada = codigos.get(userId);
  if (!entrada) return false;
  if (entrada.expira < Date.now()) {
    codigos.delete(userId);
    return false;
  }
  const ok = entrada.hash === hashCodigo(codigo.trim());
  if (ok) codigos.delete(userId);
  return ok;
}
