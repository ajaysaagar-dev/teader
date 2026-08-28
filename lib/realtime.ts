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
  | 'MESSAGE_DELETED'
  | 'DOC_CREATED'
  | 'DOC_UPDATED'
  | 'DOC_DELETED';

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

let wsModule: any = null;

async function getWsModule() {
  if (!wsModule && typeof window === 'undefined') {
    try {
      wsModule = await import('../server/ws-server');
      if (wsModule && wsModule.initWebSocketServer) {
        wsModule.initWebSocketServer();
      }
    } catch {}
  }
  return wsModule;
}

/**
 * Broadcasts an event to all connected WebSocket clients.
 * Integrates directly inside the Next.js process for zero latency, with HTTP fallback.
 */
export async function broadcastRealtimeEvent(event: RealtimeEvent): Promise<void> {
  try {
    const enrichedEvent: RealtimeEvent = {
      ...event,
      timestamp: event.timestamp || Date.now(),
    };
    const room = enrichedEvent.projectId ? `project:${enrichedEvent.projectId}` : 'global';

    // 1. Direct In-Process Dispatch (0ms, same Next.js process)
    try {
      const mod = await getWsModule();
      if (mod && typeof mod.broadcastToClients === 'function') {
        mod.broadcastToClients(enrichedEvent, room);
      }
    } catch {}

    // 2. HTTP Endpoint Dispatch (covers cluster / multi-process)
    const payload = {
      event: enrichedEvent,
      room,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);

    fetch(BROADCAST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
  } catch (err: any) {
    console.warn('[Realtime Broadcast Note]:', err.message);
  }
}
