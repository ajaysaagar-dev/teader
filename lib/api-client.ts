'use client';

/**
 * Universal Client API & Authenticated Fetch Helper
 * 
 * Automatically attaches Authorization Bearer tokens and same-origin credentials
 * to keep user sessions continuous across desktop wrappers, WebViews, and browsers.
 */

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('teader_token');
  } catch {
    return null;
  }
}

export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('teader_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(user: any, token?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem('teader_user', JSON.stringify(user));
    }
    if (token) {
      localStorage.setItem('teader_token', token);
    }
  } catch {}
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('teader_user');
    localStorage.removeItem('teader_token');
  } catch {}
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const mergedInit: RequestInit = {
    ...init,
    headers,
    credentials: init?.credentials || 'same-origin',
  };

  return fetch(input, mergedInit);
}
