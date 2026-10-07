import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'bl_session';

// Protected routes require a valid session
const PROTECTED_PREFIXES = ['/me', '/review', '/committee', '/admin', '/events'];

/**
 * Middleware for session-based routing: redirect unauthenticated users away from protected paths,
 * and authenticated users away from auth pages.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  // Check if path is protected (match segment boundary to avoid /membership being treated as /me)
  // Public exception: /events/:id/bracket is a public page (demo-slice-3 B1)
  const isBracketPath = /^\/events\/[^/]+\/bracket(?:\/.*)?$/.test(pathname);
  const isProtected =
    !isBracketPath &&
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
    );

  // Rule 1: Protected path without session → redirect to /login with next parameter
  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url, { status: 307 });
  }

  // Rule 2: Auth pages with session → redirect to /me
  if (hasSession && (pathname === '/login' || pathname === '/register')) {
    const url = req.nextUrl.clone();
    url.pathname = '/events';
    url.search = '';
    return NextResponse.redirect(url, { status: 307 });
  }

  // Rule 3: Otherwise allow the request
  return NextResponse.next();
}

export const config = {
  // Exclude Next.js internals, API routes (they're rewritten), and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp|woff2?)).*)'],
};
