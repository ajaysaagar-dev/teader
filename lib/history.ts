import { logProjectHistoryDB, getProjectByIdDB } from './db';
import { broadcastRealtimeEvent } from './realtime';
import { HistoryEntry } from './types';

export interface LogHistoryParams {
  projectId: number | string;
  projectKey?: string;
  userId?: number | string;
  userName?: string;
  userAvatar?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  details?: Record<string, any>;
  broadcast?: boolean;
  senderSessionId?: number | string;
}

/**
 * Log a user or system action to the project history audit trail.
 * Resolves projectKey automatically if not provided.
 * Fails safely and non-blockingly so primary operations never fail due to audit logging.
 */
export async function logHistory(params: LogHistoryParams): Promise<HistoryEntry | null> {
  try {
    let key = params.projectKey;
    if (!key) {
      const proj = await getProjectByIdDB(params.projectId);
      key = proj?.key || `PRJ-${params.projectId}`;
    }
    const resolvedKey = key || `PRJ-${params.projectId}`;

    const entry = await logProjectHistoryDB({
      projectId: params.projectId,
      projectKey: resolvedKey,
      userId: params.userId,
      userName: params.userName || 'System',
      userAvatar: params.userAvatar,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityTitle: params.entityTitle,
      details: params.details,
    });

    if (params.broadcast !== false) {
      broadcastRealtimeEvent({
        type: 'PROJECT_UPDATED',
        projectId: params.projectId,
        payload: {
          type: 'HISTORY_LOGGED',
          historyEntry: entry,
        },
        senderSessionId: params.senderSessionId,
      });
    }

    return entry;
  } catch (err) {
    console.warn('[history] Failed to log project history entry:', err);
    return null;
  }
}
