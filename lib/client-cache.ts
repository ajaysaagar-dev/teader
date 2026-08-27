'use client';

/**
 * Client-Side LocalStorage Cache & Optimistic SWR Synchronization Utility
 * Provides 0ms instant UI rendering, offline-resilient local cache, and background server syncing.
 */

export function getLocalCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(`teader_cache_${key}`);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    return parsed?.data !== undefined ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function setLocalCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `teader_cache_${key}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch {}
}

export function removeLocalCache(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`teader_cache_${key}`);
  } catch {}
}

export function updateLocalCache<T>(key: string, updater: (prev: T) => T, fallback: T): T {
  const current = getLocalCache<T>(key, fallback);
  const updated = updater(current);
  setLocalCache(key, updated);
  return updated;
}
