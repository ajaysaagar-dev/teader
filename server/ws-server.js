const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.WS_PORT || process.env.PORT_WS || 3001);
const HOST = process.env.WS_HOST || '0.0.0.0';

// Global singleton to survive hot-reloads in Next.js development
const globalForWs = global;
if (!globalForWs.__teaderWsState) {
  globalForWs.__teaderWsState = {
    server: null,
    wss: null,
    clients: new Map(),
    isInitialized: false,
  };
}

const state = globalForWs.__teaderWsState;

function broadcastToClients(event, targetRoom, excludeClientId) {
  let count = 0;
  const messageStr = JSON.stringify({
    type: 'EVENT',
    data: event,
    timestamp: Date.now(),
  });

  for (const [ws, info] of state.clients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (excludeClientId && info.clientId === excludeClientId) continue;

    const isSubscribed =
      !targetRoom ||
      targetRoom === 'global' ||
      info.rooms.has('all') ||
      info.rooms.has('global') ||
      info.rooms.has(targetRoom);

    if (isSubscribed) {
      try {
        ws.send(messageStr);
        count++;
      } catch (err) {
        console.warn('[WS Broadcast Client Error]:', err.message);
      }
    }
  }

  return count;
}

function initWebSocketServer() {
  if (state.isInitialized && state.server) {
    return { server: state.server, wss: state.wss, broadcastToClients };
  }

  try {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            service: 'Teader Realtime WebSocket Hub (Integrated)',
            connectedClients: state.clients.size,
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      if (req.url === '/broadcast' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const event = payload.event || payload;
            const room = payload.room || (event.projectId ? `project:${event.projectId}` : 'global');

            const broadcastCount = broadcastToClients(event, room, payload.excludeClientId);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                broadcastCount,
                connectedClients: state.clients.size,
                room,
              })
            );
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Invalid JSON' }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const clientRooms = new Set(['global', 'all']);

      state.clients.set(ws, {
        clientId,
        rooms: clientRooms,
        connectedAt: Date.now(),
        isAlive: true,
        ip: req.socket.remoteAddress,
      });

      ws.send(
        JSON.stringify({
          type: 'CONNECTED',
          clientId,
          serverTime: Date.now(),
          rooms: Array.from(clientRooms),
        })
      );

      ws.on('pong', () => {
        const info = state.clients.get(ws);
        if (info) info.isAlive = true;
      });

      ws.on('message', (messageRaw) => {
        try {
          const msg = JSON.parse(messageRaw.toString());
          const info = state.clients.get(ws);

          switch (msg.type) {
            case 'PING':
              ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
              break;

            case 'SUBSCRIBE':
              if (msg.room && info) {
                info.rooms.add(String(msg.room));
                ws.send(
                  JSON.stringify({
                    type: 'SUBSCRIBED',
                    room: msg.room,
                    rooms: Array.from(info.rooms),
                  })
                );
              }
              break;

            case 'UNSUBSCRIBE':
              if (msg.room && info) {
                info.rooms.delete(String(msg.room));
                ws.send(
                  JSON.stringify({
                    type: 'UNSUBSCRIBED',
                    room: msg.room,
                    rooms: Array.from(info.rooms),
                  })
                );
              }
              break;

            case 'BROADCAST':
              if (msg.event) {
                const room = msg.room || (msg.event.projectId ? `project:${msg.event.projectId}` : 'global');
                broadcastToClients(msg.event, room, info?.clientId);
              }
              break;

            default:
              break;
          }
        } catch (err) {
          console.warn('[WS Inbound Message Parse Error]:', err.message);
        }
      });

      ws.on('close', () => {
        state.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.warn('[WS Socket Error]:', err.message);
        state.clients.delete(ws);
      });
    });

    const heartbeatInterval = setInterval(() => {
      for (const [ws, info] of state.clients.entries()) {
        if (!info.isAlive) {
          ws.terminate();
          state.clients.delete(ws);
          continue;
        }
        info.isAlive = false;
        ws.ping();
      }
    }, 15000);

    wss.on('close', () => {
      clearInterval(heartbeatInterval);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Teader WS] Port ${PORT} is in use (reusing existing hub).`);
        state.isInitialized = true;
      } else {
        console.warn('[Teader WS Server Error]:', err.message);
      }
    });

    server.listen(PORT, HOST, () => {
      console.log(`🚀 [Teader Realtime WebSocket Hub] running on ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
      console.log(`📡 Broadcast API endpoint ready at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/broadcast`);
    });

    state.server = server;
    state.wss = wss;
    state.isInitialized = true;

    return { server, wss, broadcastToClients };
  } catch (err) {
    console.warn('[Teader WS Init Warning]:', err.message);
    state.isInitialized = true;
    return { broadcastToClients };
  }
}

// Auto-run if executed directly as standalone script (e.g. node server/ws-server.js)
if (require.main === module) {
  initWebSocketServer();
}

module.exports = {
  initWebSocketServer,
  broadcastToClients,
  clients: state.clients,
};
