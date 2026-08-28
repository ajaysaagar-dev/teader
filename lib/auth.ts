import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// ─── Secrets ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required but not set. Add it to .env');
}
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

export async function signSession(user: SessionUser, expiresIn: string = '30d'): Promise<string> {
  return new SignJWT({ id: user.id, name: user.name, email: user.email, avatar: user.avatar })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET_KEY);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      id: payload.id as number,
      name: payload.name as string,
      email: payload.email as string,
      avatar: payload.avatar as string | undefined,
    };
  } catch {
    return null;
  }
}

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

const COOKIE_NAME = 'teader_session';

export async function setSessionCookie(user: SessionUser, remember: boolean = true): Promise<string> {
  const expiresIn = remember ? '30d' : '24h';
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days or 1 day
  const token = await signSession(user, expiresIn);
  const cookieStore = await cookies();
  const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') || false;
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: isHttps,
    maxAge,
  });
  return token;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionFromCookie(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (cookie?.value) {
      const user = await verifySession(cookie.value);
      if (user) return user;
    }
  } catch {}

  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization') || headerList.get('x-teader-token');
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
      if (token) {
        return verifySession(token);
      }
    }
  } catch {}

  return null;
}

/** Read session from a NextRequest (used in middleware) */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    const user = await verifySession(token);
    if (user) return user;
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('x-teader-token');
  if (authHeader) {
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
    if (bearerToken) {
      return verifySession(bearerToken);
    }
  }

  return null;
}

// ─── Password Helpers ─────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  // Support old sha256 hashed passwords during migration window
  if (/^[a-f0-9]{64}$/.test(hashed)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256Hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return sha256Hex === hashed;
  }
  return bcrypt.compare(plain, hashed);
}


// ─── Route Auth Guard ─────────────────────────────────────────────────────────

/**
 * Call at the top of any protected API route handler.
 * Returns the session user or throws a 401 NextResponse.
 * Usage:
 *   const user = await requireAuth();
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionFromCookie();
  if (!user) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  return user;
}

/** Helper to wrap a 401 as a proper NextResponse for route handlers */
export function unauthorized(msg = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: msg }, { status: 401 });
}
