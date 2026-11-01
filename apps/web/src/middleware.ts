import { NextResponse, type NextRequest } from 'next/server';

// Misma cookie que pone el API (apps/api/src/common/utils/session-cookie.ts).
const SESSION_COOKIE = 'tcl_sesion';

// Solo revisa que haya sesión; si el token venció o falta un rol, lo resuelve el API
// y cada página reacciona a la respuesta.
export function middleware(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL('/login', req.url);
  login.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    '/cuenta/:path*',
    '/vendor/:path*',
    '/admin/:path*',
    '/checkout/:path*',
    '/mis-compras/:path*',
    '/pago-simulado/:path*',
  ],
};
