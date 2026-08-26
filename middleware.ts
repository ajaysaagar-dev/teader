import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

// Routes that never require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/swagger',
  '/login',
  '/register',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow all non-API routes and explicitly public routes through
  if (!pathname.startsWith('/api/') || PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // All remaining /api/* routes require a valid session
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized — valid session required' },
      { status: 401 }
    );
  }

  // Attach user id as a header for downstream route handlers
  const res = NextResponse.next();
  res.headers.set('x-user-id', String(session.id));
  res.headers.set('x-user-email', session.email);
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
