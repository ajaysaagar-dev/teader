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

/**
 * Extracts @ tags (e.g. "@T12", "@T87") from a string and returns the cleaned text
 * with tags removed and an array of extracted tags.
 * Example: "@T12 Setup and controls @T87" -> { cleanText: "Setup and controls", tags: ["@T12", "@T87"] }
 */
export function extractTagsAndCleanText(input: string): { cleanText: string; tags: string[] } {
  if (!input) return { cleanText: '', tags: [] };

  const tagRegex = /@(T\d+|[A-Za-z0-9_-]+)/gi;
  const tags: string[] = [];
  let match;

  while ((match = tagRegex.exec(input)) !== null) {
    const raw = match[0];
    const normalized = raw.startsWith('@T') ? `@T${raw.slice(2)}` : raw;
    if (!tags.includes(normalized)) {
      tags.push(normalized);
    }
  }

  const cleanText = input
    .replace(/@(T\d+|[A-Za-z0-9_-]+)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    cleanText: cleanText || input.trim(),
    tags,
  };
}

export interface TaskMentionOption {
  shortId: string;
  key: string;
  title: string;
  id: string;
}

/**
 * Returns available task mention options from an issues list
 */
export function getAvailableTaskMentions(allIssues: Issue[]): TaskMentionOption[] {
  if (!allIssues) return [];
  const tasksOnly = allIssues.filter(
    (i) =>
      !i.title.startsWith('📁 ') &&
      !i.title.startsWith('[Folder]') &&
      !(i.labels && Array.isArray(i.labels) && i.labels.some((l) => l.toLowerCase() === 'folder'))
  );

  return tasksOnly.map((task) => ({
    shortId: getTaskShortId(task, allIssues),
    key: task.key,
    title: task.title,
    id: String(task.id),
  }));
}

/**
 * Detects if the cursor in a text input is inside an active @ mention word.
 * Returns the query (e.g. "T" or "auth") and the start/end replacement indices, or null.
 */
export function getMentionQueryAtCursor(
  text: string,
  cursorPos: number
): { query: string; startIndex: number; endIndex: number } | null {
  if (cursorPos < 0 || cursorPos > text.length) return null;

  const textBeforeCursor = text.slice(0, cursorPos);
  const lastAtIdx = textBeforeCursor.lastIndexOf('@');
  if (lastAtIdx === -1) return null;

  // Make sure @ is at beginning of text or preceded by whitespace
  if (lastAtIdx > 0 && !/\s/.test(text.charAt(lastAtIdx - 1))) {
    return null;
  }

  const queryPart = textBeforeCursor.slice(lastAtIdx + 1);
  // If there are spaces or newlines between @ and cursor, not a mention
  if (/[\s\n]/.test(queryPart)) {
    return null;
  }

  return {
    query: queryPart,
    startIndex: lastAtIdx,
    endIndex: cursorPos,
  };
}

/**
 * Formats task creation timestamp into human-readable relative timing
 * (e.g., "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", "Aug 15", "Jan 12, 2025")
 */
export function formatAddedTiming(dateInput?: string | Date | null): string {
  if (!dateInput) return 'Recently';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return 'Recently';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  if (diffMs < 0) {
    return 'Just now';
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  const isCurrentYear = d.getFullYear() === now.getFullYear();
  if (isCurrentYear) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Returns full detailed localized timestamp for tooltips and headers
 */
export function formatExactDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  return `Added on ${d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} at ${d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
