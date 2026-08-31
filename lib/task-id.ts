import { Issue } from './types';

/**
 * Returns a human-friendly sequential short ID like T1, T2, T3 ... Tn
 * based on the task's chronological order within the project.
 */
export function getTaskShortId(issue: Issue, allIssues?: Issue[]): string {
  if (!issue) return 'T1';
  if (!allIssues || allIssues.length === 0) {
    const numericMatch = issue.key?.match(/\d+/);
    return numericMatch ? `T${numericMatch[0]}` : 'T1';
  }

  // Filter out pure folder entities
  const tasksOnly = allIssues.filter(
    (i) =>
      !i.title.startsWith('📁 ') &&
      !i.title.startsWith('[Folder]') &&
      !(i.labels && Array.isArray(i.labels) && i.labels.some((l) => l.toLowerCase() === 'folder'))
  );

  // Sort chronologically ascending: earliest created is T1, second is T2, etc.
  const sorted = [...tasksOnly].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });

  const idx = sorted.findIndex((i) => String(i.id) === String(issue.id) || String(i.key) === String(issue.key));
  if (idx !== -1) {
    return `T${idx + 1}`;
  }

  const numericMatch = issue.key?.match(/\d+/);
  return numericMatch ? `T${numericMatch[0]}` : 'T1';
}

/**
 * Finds an issue from a short ID (e.g. "T1", "T2") or issue ID/key
 */
export function findIssueByTag(tagOrId: string, allIssues: Issue[]): Issue | undefined {
  if (!tagOrId || !allIssues) return undefined;
  const clean = tagOrId.trim().replace(/^@/, '');

  // Check direct id or key match
  const direct = allIssues.find(
    (i) => String(i.id).toLowerCase() === clean.toLowerCase() || String(i.key).toLowerCase() === clean.toLowerCase()
  );
  if (direct) return direct;

  // Check short ID match (e.g. "T1", "T2")
  const match = clean.match(/^T(\d+)$/i);
  if (match) {
    const targetIdx = parseInt(match[1], 10) - 1;
    const tasksOnly = allIssues.filter(
      (i) =>
        !i.title.startsWith('📁 ') &&
        !i.title.startsWith('[Folder]') &&
        !(i.labels && Array.isArray(i.labels) && i.labels.some((l) => l.toLowerCase() === 'folder'))
    );
    const sorted = [...tasksOnly].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
    if (targetIdx >= 0 && targetIdx < sorted.length) {
      return sorted[targetIdx];
    }
  }

  return undefined;
}
