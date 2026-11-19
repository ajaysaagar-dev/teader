import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAuthToken, setStoredAuth, clearStoredAuth, authFetch } from '@/lib/api-client';
import { GET as getProjectHandler } from '@/app/api/projects/[id]/route';

// In-memory mock for localStorage in Node.js test environment
const memoryStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => memoryStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    memoryStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete memoryStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(memoryStorage)) {
      delete memoryStorage[key];
    }
  },
};

describe('API Client & Auth Header Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal('window', { localStorage: localStorageMock });
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stores and retrieves authentication tokens in localStorage', () => {
    expect(getAuthToken()).toBeNull();
    setStoredAuth({ id: 1, name: 'Alice' }, 'jwt_sample_token_xyz');
    expect(getAuthToken()).toBe('jwt_sample_token_xyz');
    expect(JSON.parse(localStorageMock.getItem('teader_user') || '{}')).toEqual({ id: 1, name: 'Alice' });

    clearStoredAuth();
    expect(getAuthToken()).toBeNull();
    expect(localStorageMock.getItem('teader_user')).toBeNull();
  });

  it('automatically injects Authorization Bearer header into authFetch calls', async () => {
    setStoredAuth({ id: 1 }, 'test_bearer_token');

    let capturedInit: RequestInit | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const res = await authFetch('/api/test-endpoint');
    expect(res.status).toBe(200);

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('Authorization')).toBe('Bearer test_bearer_token');
    expect(capturedInit?.credentials).toBe('same-origin');
  });

  it('preserves custom Authorization header if already supplied', async () => {
    setStoredAuth({ id: 1 }, 'stored_token');

    let capturedInit: RequestInit | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await authFetch('/api/test-endpoint', {
      headers: { Authorization: 'Bearer custom_token' },
    });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('Authorization')).toBe('Bearer custom_token');
  });
});

describe('GET /api/projects/[id] Route Handler', () => {
  it('returns 401 when no session is present', async () => {
    const req = new Request('http://localhost:3000/api/projects/1', { method: 'GET' });
    const res = await getProjectHandler(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });
});
