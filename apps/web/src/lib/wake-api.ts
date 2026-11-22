import { API_URL } from '@/lib/api-client';

/**
 * Despierta el API en Render Free (cold start ~30–60 s tras ~15 min idle).
 * Fire-and-forget: no espera ni propaga errores.
 */
export function wakeApi(): void {
  if (typeof window === 'undefined') return;
  void fetch(`${API_URL}/health`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => undefined);
}
