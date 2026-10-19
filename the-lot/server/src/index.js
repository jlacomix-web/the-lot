// The Lot game server (step 3): accounts + avatars over /api, authenticated live game over /ws.
import http from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { q, migrate } from './db.js';
import { handleApi, sessionFromCookie } from './routes.js';
import { createGame } from './game.js';

for (let i = 0; ; i++) { // the database container may still be starting
  try { await q('select 1'); break; } catch (e) { if (i > 40) throw e; await new Promise((r) => setTimeout(r, 1500)); }
}
await migrate();
const game = createGame(q);
const lag = monitorEventLoopDelay({ resolution: 20 }); lag.enable();

const server = http.createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) return;
    if (req.url === '/healthz') {
      let db = 'down'; try { await q('select 1'); db = 'ok'; } catch { /* leave down */ }
      res.writeHead(200, { 'content-type': 'application/json' });
      const loopLagMs = Math.round(lag.percentile(99) / 1e4) / 100; lag.reset(); // p99 event-loop delay since the last check
      res.end(JSON.stringify({ ok: true, db, players: game.count(), loopLagMs, memMB: Math.round(process.memoryUsage().rss / 1048576) }));
      return;
    }
    res.writeHead(404); res.end();
  } catch (e) { console.error(e); if (!res.headersSent) { res.writeHead(500); res.end(); } }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
const refuse = (socket, line) => { socket.write(`HTTP/1.1 ${line}\r\n\r\n`); socket.destroy(); };

server.on('upgrade', async (req, socket, head) => {
  if (!req.url.startsWith('/ws')) return socket.destroy();
  const o = req.headers.origin;
  if (o && o !== config.publicUrl) return refuse(socket, '403 Forbidden');
  let session = null;
  try { session = await sessionFromCookie(req.headers.cookie); } catch { /* treated as signed out */ }
  if (!session) return refuse(socket, '401 Unauthorized'); // no guests
  wss.handleUpgrade(req, socket, head, (ws) => game.connect(ws, session));
});

server.listen(config.port, () => console.log(`game server listening on :${config.port}`));
