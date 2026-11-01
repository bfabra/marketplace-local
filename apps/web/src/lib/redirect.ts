// Destino después de ingresar. Solo rutas internas, para no redirigir a otro sitio.
export function safeNext(next: string | null, fallback = '/cuenta') {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
