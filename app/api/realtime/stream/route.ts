import { NextRequest } from 'next/server';
import { realtimeBus } from '@/lib/realtime-bus';
import type { RealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * High-performance Server-Sent Events (SSE) stream.
 * Provides instant real-time synchronization over standard HTTP/HTTPS (port 443/80/3000),
 * bypassing corporate firewalls and SSL WebSocket port proxying restrictions.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const room = searchParams.get('room') || (projectId ? `project:${projectId}` : 'global');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const send = (payload: any) => {
        if (isClosed) return;
        try {
          const formatted = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(formatted));
        } catch {
          cleanup();
        }
      };

      // 1. Send immediate connection confirmation
      send({
        type: 'CONNECTED',
        stream: true,
        room,
        serverTime: Date.now(),
      });

      // 2. Event listener for real-time broadcasts
      const handleEvent = (data: { event: RealtimeEvent; room?: string }) => {
        if (isClosed) return;
        const targetRoom = data.room || 'global';
        if (
          room === 'global' ||
          room === 'all' ||
          targetRoom === 'global' ||
          targetRoom === 'all' ||
          targetRoom === room
        ) {
          send({
            type: 'EVENT',
            data: data.event,
            timestamp: Date.now(),
          });
        }
      };

      realtimeBus.on('realtime_event', handleEvent);

      // 3. Keep-alive heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          cleanup();
        }
      }, 15000);

      // 4. Cleanup on abort/disconnect
      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        realtimeBus.removeListener('realtime_event', handleEvent);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {}
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in Nginx
    },
  });
}
