import { Issue } from './types';

/**
 * Centralized de-duplication reconciler for tasks and folders.
 * Replaces optimistic/temporary placeholder items with real server-persisted
 * issues, updates existing issues in place, and prevents duplicate stacked entries.
 */
export function reconcileCreatedIssue(prev: Issue[], created: Issue): Issue[] {
  if (!created || !created.id) return prev;

  // 1. If the exact ID already exists in the list, update it in place
  const existingByIdIdx = prev.findIndex((iss) => iss.id === created.id);
  if (existingByIdIdx !== -1) {
    const updated = [...prev];
    updated[existingByIdIdx] = { ...updated[existingByIdIdx], ...created };
    return updated;
  }

  // 2. If this is a real server-persisted issue, replace any matching temporary optimistic issue
  if (!String(created.id).startsWith('temp_')) {
    const tempMatchIdx = prev.findIndex(
      (iss) =>
        String(iss.id).startsWith('temp_') &&
        (iss.title === created.title || (created.key && iss.key === created.key))
    );
    if (tempMatchIdx !== -1) {
      const updated = [...prev];
      updated[tempMatchIdx] = created;
      return updated;
    }
  }

  // 3. Prevent duplicate temporary issues if already added
  const filtered = prev.filter(
    (iss) =>
      iss.id !== created.id &&
      !(
        String(iss.id).startsWith('temp_') &&
        String(created.id).startsWith('temp_') &&
        iss.title === created.title
      )
  );

  return [created, ...filtered];
}
