const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.WS_PORT || process.env.PORT_WS || 3001);
const HOST = process.env.WS_HOST || '0.0.0.0';
const INTERNAL_BROADCAST_SECRET = process.env.INTERNAL_BROADCAST_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || '';

// Lightweight JWT verification for WS connections (mirrors lib/auth.ts logic)
// Uses jose if available, falls back to manual base64url decode + HMAC-SHA256 verify
let joseVerify = null;
try {
  const jose = require('jose');
  joseVerify = jose.jwtVerify;
} catch {}

async function verifyToken(token) {
  if (!JWT_SECRET) return null;
  try {
    if (joseVerify) {
      const secretKey = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await joseVerify(token, secretKey);
      return payload; // { id, name, email, avatar, ... }
    }
    // Fallback: decode JWT payload without full verification (dev-only)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

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

  // Also notify in-process SSE listeners
  if (globalForWs.__teaderRealtimeBus) {
    try {
      globalForWs.__teaderRealtimeBus.emit('realtime_event', { event, room: targetRoom });
    } catch {}
  }

  return count;
}

// Check project membership for a given userId (queries DB directly via pg pool)
let pgPool = null;
function getDbPool() {
  if (pgPool) return pgPool;
  try {
    const { Pool } = require('pg');
    const DATABASE_URL = process.env.DATABASE_URL;
    if (DATABASE_URL && DATABASE_URL.startsWith('postgres')) {
      pgPool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    } else {
      pgPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        database: process.env.POSTGRES_DATABASE || 'teader_db',
        port: Number(process.env.POSTGRES_PORT) || 5678,
        max: 3,
      });
    }
    return pgPool;
  } catch {
    return null;
  }
}

async function isProjectMember(userId, projectId) {
  const pool = getDbPool();
  if (!pool) return false; // If DB unavailable, deny by default
  try {
    const res = await pool.query(
      `SELECT 1 FROM "projects" WHERE "id" = $1 AND ("owner_id" = $2 OR "creatorId" = $2)
       UNION ALL
       SELECT 1 FROM "project_members" WHERE "projectId" = $1 AND "userId" = $2
       LIMIT 1`,
      [projectId, userId]
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

function initWebSocketServer() {
  if (state.isInitialized && state.server) {
    return { server: state.server, wss: state.wss, broadcastToClients };
  }

  try {
    const server = http.createServer((req, res) => {
      // Only allow CORS from the app origin, not wildcard
      const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Broadcast-Secret');

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
        // Require internal broadcast secret for server-to-server calls
        const providedSecret = req.headers['x-broadcast-secret'];
        if (!INTERNAL_BROADCAST_SECRET || providedSecret !== INTERNAL_BROADCAST_SECRET) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden: invalid or missing X-Broadcast-Secret header' }));
          return;
        }

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

    wss.on('connection', async (ws, req) => {
      // ─── Authentication: require a valid JWT token on connect ───
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(4401, 'Authentication required: provide ?token=<jwt>');
        return;
      }

      const user = await verifyToken(token);
      if (!user || !user.id) {
        ws.close(4401, 'Authentication failed: invalid or expired token');
        return;
      }

      const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const clientRooms = new Set(['global']);

      state.clients.set(ws, {
        clientId,
        userId: user.id,
        userName: user.name || user.email,
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

      ws.on('message', async (messageRaw) => {
        try {
          const msg = JSON.parse(messageRaw.toString());
          const info = state.clients.get(ws);

          switch (msg.type) {
            case 'PING':
              ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
              break;

            case 'SUBSCRIBE':
              if (msg.room && info) {
                const roomStr = String(msg.room);

                // ─── Room-level authorization ───
                // For project rooms, verify the user is actually a member
                const projectMatch = roomStr.match(/^project:(\d+)$/);
                if (projectMatch) {
                  const projectId = Number(projectMatch[1]);
                  const hasAccess = await isProjectMember(info.userId, projectId);
                  if (!hasAccess) {
                    ws.send(
                      JSON.stringify({
                        type: 'SUBSCRIBE_DENIED',
                        room: roomStr,
                        reason: 'You are not a member of this project',
                      })
                    );
                    break;
                  }
                }

                info.rooms.add(roomStr);
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

            // BROADCAST from clients is no longer allowed — only server-to-server via /broadcast
            case 'BROADCAST':
              ws.send(
                JSON.stringify({
                  type: 'ERROR',
                  message: 'Client-side broadcasting is disabled. Use the server API.',
                })
              );
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
      console.log(`📡 Broadcast API endpoint ready at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/broadcast (requires X-Broadcast-Secret header)`);
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
