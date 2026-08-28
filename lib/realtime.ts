export type RealtimeEventType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASKS_REORDERED'
  | 'TASK_DELETED'
  | 'SUBTASK_UPDATED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'MEMBER_JOINED'
  | 'MEMBER_LEFT'
  | 'MESSAGE_SENT'
  | 'MESSAGE_DELETED';

export interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  projectId?: number | string;
  payload: T;
  timestamp?: number;
  senderSessionId?: string | number;
}

const WS_PORT = process.env.WS_PORT || process.env.PORT_WS || '3001';
const WS_HOST = process.env.WS_HOST || '127.0.0.1';
const BROADCAST_ENDPOINT = `http://${WS_HOST}:${WS_PORT}/broadcast`;

/**
 * Broadcasts an event to the local WebSocket server to instantly notify all connected clients.
 * This is non-blocking and fails gracefully if the WS server is not running.
 */
export async function broadcastRealtimeEvent(event: RealtimeEvent): Promise<void> {
  try {
    const payload = {
      event: {
        ...event,
        timestamp: event.timestamp || Date.now(),
      },
      room: event.projectId ? `project:${event.projectId}` : 'global',
    };

    // Use a short timeout so API responses are never delayed
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);

    fetch(BROADCAST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
  } catch (err: any) {
    // Gracefully handle any broadcast failure
    console.warn('[Realtime Broadcast Note]:', err.message);
  }
}
