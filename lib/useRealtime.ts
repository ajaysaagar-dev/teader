'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeEvent, RealtimeEventType } from './realtime';

export type { RealtimeEvent, RealtimeEventType };

// Global browser broadcast channel for instant multi-tab sync
let globalBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    globalBroadcastChannel = new BroadcastChannel('teader_realtime_channel');
    globalBroadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type) {
        dispatchLocalRealtimeEvent(event.data);
      }
    };
  } catch {}
}

function dispatchLocalRealtimeEvent(event: RealtimeEvent) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('teader:realtime', { detail: event }));
  }
}

// Global WebSocket & SSE Hybrid Realtime Manager Instance
class RealtimeSocketManager {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private subscribers = new Set<(event: RealtimeEvent) => void>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private isConnected = false;
  private subscribedRooms = new Set<string>(['global', 'all']);
  private usingSSE = false;
  private wsAttempts = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
      window.addEventListener('online', () => this.connect());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !this.isConnected) {
          this.connect();
        }
      });
    }
  }

  private getWebSocketUrl(): string {
    let token = '';
    if (typeof window !== 'undefined') {
      try {
        token = localStorage.getItem('teader_token') || '';
        if (!token && document.cookie) {
          const match = document.cookie.match(/(?:^|;\s*)teader_session=([^;]+)/);
          if (match) {
            token = decodeURIComponent(match[1]);
          }
        }
      } catch {}
    }

    if (process.env.NEXT_PUBLIC_WS_URL) {
      const base = process.env.NEXT_PUBLIC_WS_URL;
      return token ? `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : base;
    }
    const isHttps = window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss:' : 'ws:';
    const hostname = window.location.hostname || 'localhost';
    const port = process.env.NEXT_PUBLIC_WS_PORT || '3001';

    const baseUrl = `${protocol}//${hostname}:${port}`;
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
  }

  public connect() {
    if (typeof window === 'undefined') return;

    // Clean up any existing dead handles
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.tryWebSocket();
  }

  private tryWebSocket() {
    try {
      const url = this.getWebSocketUrl();
      const ws = new WebSocket(url);
      this.ws = ws;

      let connectionHandled = false;

      // Fallback to SSE if WS doesn't open within 3 seconds
      const wsTimer = setTimeout(() => {
        if (!connectionHandled && ws.readyState !== WebSocket.OPEN) {
          try {
            ws.close();
          } catch {}
          this.fallbackToSSE();
        }
      }, 3000);

      ws.onopen = () => {
        connectionHandled = true;
        clearTimeout(wsTimer);
        this.wsAttempts = 0;
        this.usingSSE = false;
        if (this.sse) {
          try {
            this.sse.close();
          } catch {}
          this.sse = null;
        }

        this.isConnected = true;
        this.notifyStatus(true);

        // Re-subscribe to all active rooms
        for (const room of this.subscribedRooms) {
          this.send({ type: 'SUBSCRIBE', room });
        }

        // Start ping interval
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({ type: 'PING' });
          }
        }, 15000);
      };

      ws.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);
          if (data.type === 'EVENT' && data.data) {
            const realtimeEvent: RealtimeEvent = data.data;
            this.notifySubscribers(realtimeEvent);
          }
        } catch {}
      };

      ws.onclose = () => {
        clearTimeout(wsTimer);
        if (this.ws === ws) {
          this.ws = null;
        }
        if (this.pingInterval) clearInterval(this.pingInterval);

        // If WS dropped, fall back to SSE immediately
        this.fallbackToSSE();
      };

      ws.onerror = () => {
        clearTimeout(wsTimer);
        if (this.ws === ws) {
          try {
            ws.close();
          } catch {}
        }
        this.fallbackToSSE();
      };
    } catch {
      this.fallbackToSSE();
    }
  }

  private fallbackToSSE() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      this.isConnected = false;
      this.notifyStatus(false);
      this.scheduleReconnect();
      return;
    }

    if (this.sse && this.sse.readyState === EventSource.OPEN) {
      this.isConnected = true;
      this.notifyStatus(true);
      return;
    }

    try {
      if (this.sse) {
        try {
          this.sse.close();
        } catch {}
      }

      const sse = new EventSource('/api/realtime/stream?room=global');
      this.sse = sse;
      this.usingSSE = true;

      sse.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
      };

      sse.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);
          if (data.type === 'CONNECTED') {
            this.isConnected = true;
            this.notifyStatus(true);
          } else if (data.type === 'EVENT' && data.data) {
            const realtimeEvent: RealtimeEvent = data.data;
            this.notifySubscribers(realtimeEvent);
          }
        } catch {}
      };

      sse.onerror = () => {
        if (this.sse === sse) {
          this.isConnected = false;
          this.notifyStatus(false);
          try {
            sse.close();
          } catch {}
          this.sse = null;
        }
        this.scheduleReconnect();
      };
    } catch {
      this.isConnected = false;
      this.notifyStatus(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 4000);
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {}
    }
  }

  public subscribeRoom(room: string) {
    this.subscribedRooms.add(room);
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'SUBSCRIBE', room });
    }
  }

  public unsubscribeRoom(room: string) {
    this.subscribedRooms.delete(room);
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'UNSUBSCRIBE', room });
    }
  }

  public broadcast(event: RealtimeEvent) {
    // 1. Send to WebSocket server if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'BROADCAST',
        event,
        room: event.projectId ? `project:${event.projectId}` : 'global',
      });
    }

    // 2. Broadcast across browser tabs
    if (globalBroadcastChannel) {
      try {
        globalBroadcastChannel.postMessage(event);
      } catch {}
    }

    // 3. Dispatch in current window
    dispatchLocalRealtimeEvent(event);
  }

  public addListener(callback: (event: RealtimeEvent) => void) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public addStatusListener(callback: (connected: boolean) => void) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private notifySubscribers(event: RealtimeEvent) {
    this.subscribers.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('[Realtime Listener Error]:', err);
      }
    });
  }

  private notifyStatus(connected: boolean) {
    this.statusListeners.forEach((cb) => {
      try {
        cb(connected);
      } catch {}
    });
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton reference
let socketManagerInstance: RealtimeSocketManager | null = null;
function getSocketManager(): RealtimeSocketManager {
  if (!socketManagerInstance) {
    socketManagerInstance = new RealtimeSocketManager();
  }
  return socketManagerInstance;
}

/**
 * Hook to subscribe to real-time WebSocket events for a specific project or globally.
 */
export function useRealtimeSubscription({
  projectId,
  onEvent,
}: {
  projectId?: string | number | null;
  onEvent: (event: RealtimeEvent) => void;
}) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const manager = getSocketManager();

    const room = projectId ? `project:${projectId}` : 'global';
    manager.subscribeRoom(room);

    // 1. Listen from WebSocket manager
    const unsubscribeSocket = manager.addListener((event) => {
      if (!projectId || !event.projectId || String(event.projectId) === String(projectId)) {
        onEventRef.current(event);
      }
    });

    // 2. Listen from Local DOM CustomEvent dispatcher (covers cross-tab and local mutations)
    const handleCustomEvent = (e: any) => {
      const event: RealtimeEvent = e.detail;
      if (event && (!projectId || !event.projectId || String(event.projectId) === String(projectId))) {
        onEventRef.current(event);
      }
    };
    window.addEventListener('teader:realtime', handleCustomEvent);

    return () => {
      manager.unsubscribeRoom(room);
      unsubscribeSocket();
      window.removeEventListener('teader:realtime', handleCustomEvent);
    };
  }, [projectId]);
}

/**
 * Hook to get real-time connection status
 */
export function useRealtimeStatus(): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const manager = getSocketManager();
    const unsub = manager.addStatusListener((status) => {
      setIsConnected(status);
    });
    return unsub;
  }, []);

  return { isConnected };
}

/**
 * Function to publish a real-time event from the frontend client
 */
export function publishClientRealtimeEvent(event: RealtimeEvent) {
  if (typeof window !== 'undefined') {
    getSocketManager().broadcast(event);
  }
}
