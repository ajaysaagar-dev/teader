const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.WS_PORT || process.env.PORT_WS || 3001);
const HOST = process.env.WS_HOST || '0.0.0.0';

// Store client subscriptions (socket -> info)
const clients = new Map();

const server = http.createServer((req, res) => {
  // CORS Headers for HTTP broadcast trigger from Next.js API routes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        service: 'Teader Realtime WebSocket Hub',
        connectedClients: clients.size,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // HTTP broadcast endpoint: allows any Next.js backend API route to broadcast events to all connected clients
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
            connectedClients: clients.size,
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

function broadcastToClients(event, targetRoom, excludeClientId) {
  let count = 0;
  const messageStr = JSON.stringify({
    type: 'EVENT',
    data: event,
    timestamp: Date.now(),
  });

  for (const [ws, info] of clients.entries()) {
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

wss.on('connection', (ws, req) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const clientRooms = new Set(['global', 'all']);

  clients.set(ws, {
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
    const info = clients.get(ws);
    if (info) info.isAlive = true;
  });

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw.toString());
      const info = clients.get(ws);

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
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.warn('[WS Socket Error]:', err.message);
    clients.delete(ws);
  });
});

const heartbeatInterval = setInterval(() => {
  for (const [ws, info] of clients.entries()) {
    if (!info.isAlive) {
      ws.terminate();
      clients.delete(ws);
      continue;
    }
    info.isAlive = false;
    ws.ping();
  }
}, 15000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(PORT, HOST, () => {
  console.log(`[Teader Realtime WebSocket Hub] running on ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Broadcast API endpoint ready at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/broadcast`);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
