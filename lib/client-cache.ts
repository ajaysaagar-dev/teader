'use client';

import { Issue, ProjectDoc } from './types';

/**
 * Client-Side LocalStorage Cache & Fine-Grained In-Place Diffing / Reconciliation Utility
 * Provides 0ms instant UI rendering, offline-resilient local cache, and background server syncing
 * with surgical element-level updates to prevent full page or component re-renders.
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

export function clearAllLocalCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('teader_cache_') || key.startsWith('teader_') || key.includes('projects') || key.includes('issues'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

/**
 * Fine-grained deep equality check between two issues.
 * Returns true if all fields and recursive subtasks are identical.
 */
export function areIssuesEqual(a: Issue, b: Issue): boolean {
  if (
    a.id !== b.id ||
    a.key !== b.key ||
    a.title !== b.title ||
    a.status !== b.status ||
    a.priority !== b.priority ||
    a.description !== b.description ||
    a.assigneeName !== b.assigneeName ||
    a.epic !== b.epic ||
    a.estimatedHours !== b.estimatedHours ||
    a.loggedHours !== b.loggedHours ||
    a.dueDate !== b.dueDate
  ) {
    return false;
  }

  // Compare subtask tree recursively
  const areSubtreesEqual = (list1: any[], list2: any[]): boolean => {
    if (list1.length !== list2.length) return false;
    for (let i = 0; i < list1.length; i++) {
      const s1 = list1[i];
      const s2 = list2[i];
      if (
        s1.id !== s2.id ||
        s1.title !== s2.title ||
        Boolean(s1.completed) !== Boolean(s2.completed) ||
        Boolean(s1.isFolder) !== Boolean(s2.isFolder)
      ) {
        return false;
      }
      if (!areSubtreesEqual(s1.subtasks || [], s2.subtasks || [])) return false;
    }
    return true;
  };

  if (!areSubtreesEqual(a.subtasks || [], b.subtasks || [])) return false;

  // Compare blockedBy array safely
  const aBlocked = Array.isArray(a.blockedBy) ? a.blockedBy : [];
  const bBlocked = Array.isArray(b.blockedBy) ? b.blockedBy : [];
  if (aBlocked.length !== bBlocked.length) return false;
  for (let i = 0; i < aBlocked.length; i++) {
    if (aBlocked[i] !== bBlocked[i]) return false;
  }

  return true;

}

/**
 * Surgically reconciles incoming server data with current state.
 * Preserves exact object references for unchanged tasks so React.memo skips re-rendering!
 */
export function reconcileIssues(prev: Issue[], incoming: Issue[]): Issue[] {
  if (prev.length === 0) return incoming;
  if (incoming.length === 0) return prev;

  let hasAnyChange = false;
  const prevMap = new Map<string, Issue>();
  prev.forEach((item) => prevMap.set(String(item.id), item));

  const reconciled: Issue[] = [];
  const incomingIds = new Set<string>();

  for (const item of incoming) {
    const itemId = String(item.id);
    incomingIds.add(itemId);

    const existing = prevMap.get(itemId);
    if (!existing) {
      // New item added on server
      reconciled.push(item);
      hasAnyChange = true;
    } else if (areIssuesEqual(existing, item)) {
      // Unchanged item - preserve exact object reference!
      reconciled.push(existing);
    } else {
      // Modified item - surgical in-place update
      reconciled.push(item);
      hasAnyChange = true;
    }
  }

  // Check if any items were removed or reordered
  if (prev.length !== incoming.length) {
    hasAnyChange = true;
  } else {
    for (let i = 0; i < prev.length; i++) {
      if (prev[i].id !== incoming[i].id) {
        hasAnyChange = true;
        break;
      }
    }
  }

  return hasAnyChange ? reconciled : prev;
}

/**
 * Reconciles project docs list surgically
 */
export function reconcileDocs(prev: ProjectDoc[], incoming: ProjectDoc[]): ProjectDoc[] {
  if (!incoming || incoming.length === 0) return incoming || [];
  if (!prev || prev.length === 0) return incoming;

  let hasChange = false;
  const prevMap = new Map<string, ProjectDoc>();
  prev.forEach((d) => {
    if (d && d.id) prevMap.set(String(d.id), d);
  });

  const reconciled: ProjectDoc[] = [];
  for (const inc of incoming) {
    if (!inc) continue;
    const existing = prevMap.get(String(inc.id));
    if (!existing) {
      reconciled.push(inc);
      hasChange = true;
    } else if (
      existing.title === inc.title &&
      existing.fileName === inc.fileName &&
      existing.updatedAt === inc.updatedAt &&
      (existing.folder || 'Start') === (inc.folder || 'Start') &&
      (inc.content === undefined || inc.content === existing.content)
    ) {
      reconciled.push(existing);
    } else {
      reconciled.push({ ...existing, ...inc });
      hasChange = true;
    }
  }

  if (prev.length !== incoming.length) hasChange = true;

  return hasChange ? reconciled : prev;
}
