import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

// Public routes that never require authentication
const PUBLIC_PAGE_ROUTES = ['/', '/login', '/register'];
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/swagger',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow public static assets and public pages
  if (
    PUBLIC_PAGE_ROUTES.includes(pathname) ||
    PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/data/')
  ) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(req);

  // 2. Protect workspace pages: if not logged in, redirect to /login immediately
  const isWorkspacePage =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/conversations') ||
    pathname.startsWith('/my-work') ||
    pathname.startsWith('/initiatives') ||
    pathname.startsWith('/issue') ||
    pathname.startsWith('/task');

  if (isWorkspacePage && !session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Protect all other /api/* routes
  if (pathname.startsWith('/api/') && !session) {
    return NextResponse.json(
      { error: 'Unauthorized — valid session required' },
      { status: 401 }
    );
  }

  // Attach session headers for downstream handlers
  const res = NextResponse.next();
  if (session) {
    res.headers.set('x-user-id', String(session.id));
    res.headers.set('x-user-email', session.email);
  }
  return res;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/dashboard',
    '/projects/:path*',
    '/projects',
    '/my-work/:path*',
    '/my-work',
    '/initiatives/:path*',
    '/initiatives',
    '/issue/:path*',
    '/task/:path*',
    '/task',
  ],
};
