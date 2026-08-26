import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
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

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ id: user.id, name: user.name, email: user.email, avatar: user.avatar })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
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
const COOKIE_OPTS = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionFromCookie(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifySession(cookie.value);
}

/** Read session from a NextRequest (used in middleware) */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

// ─── Password Helpers ─────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  // Support old sha256 hashed passwords during migration window
  if (/^[a-f0-9]{64}$/.test(hashed)) {
    const crypto = await import('crypto');
    const sha256 = crypto.createHash('sha256').update(plain).digest('hex');
    return sha256 === hashed;
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
