import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth'];

// Dùng btoa (available trong Edge runtime) thay vì Node crypto
function makeToken(password: string, secret: string): string {
  return btoa(`${password}:${secret}`);
}

function validToken(token: string): boolean {
  const secret = process.env.SESSION_SECRET ?? 'secret';
  const expected = makeToken(process.env.DASHBOARD_PASSWORD ?? '', secret);
  return token === expected;
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('gz_session')?.value;
  if (!token || !validToken(token)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
