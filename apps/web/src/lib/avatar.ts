/** Avatares vectoriales de la maqueta #profile (Dicebear). */
export const AVATARES_PRESET = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Juan',
] as const;

const clave = (userId: string) => `tcl-avatar:${userId}`;

export function leerAvatarLocal(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(clave(userId));
  } catch {
    return null;
  }
}

export function guardarAvatarLocal(userId: string, url: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (url) localStorage.setItem(clave(userId), url);
    else localStorage.removeItem(clave(userId));
  } catch {
    /* ignore quota */
  }
}

/** Preferencia local (foto/preset) o avatar del perfil del API. */
export function avatarVisible(userId: string, avatarApi: string | null | undefined): string | null {
  return leerAvatarLocal(userId) || avatarApi || null;
}
