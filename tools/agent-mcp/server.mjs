#!/usr/bin/env node
// Minimal stdio MCP server plus a loopback-only browser bridge. No npm packages required.
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const port = Number(process.env.CT_AGENT_PORT || 8787);
const maxFrame = 2 * 1024 * 1024;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
let browser = null;
const pending = new Map();

function log(message) { process.stderr.write(`[commander-table-mcp] ${message}\n`); }
function sendMcp(message) { process.stdout.write(JSON.stringify(message) + '\n'); }
function mcpError(id, code, message) { sendMcp({ jsonrpc: '2.0', id, error: { code, message } }); }
function result(id, value) { sendMcp({ jsonrpc: '2.0', id, result: value }); }

function frame(opcode, data = Buffer.alloc(0)) {
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let header;
  if (body.length < 126) { header = Buffer.from([0x80 | opcode, body.length]); }
  else if (body.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(body.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(body.length), 2); }
  return Buffer.concat([header, body]);
}
function bridgeSend(message) {
  if (!browser || browser.destroyed) throw new Error('No game tab is connected. Open the local game page with ?agent=1.');
  browser.write(frame(1, JSON.stringify(message)));
}
function callPage(tool, args) {
  return new Promise((resolve, reject) => {
    if (!browser || browser.destroyed) return reject(new Error('No game tab is connected. Open http://127.0.0.1:' + port + '/index.html?agent=1 and join a shared game.'));
    const id = randomUUID();
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('The game page did not answer. Check that its tab is still open and connected.')); }, 30000);
    pending.set(id, { resolve, reject, timeout });
    try { bridgeSend({ type: 'call', id, tool, arguments: args }); }
    catch (error) { clearTimeout(timeout); pending.delete(id); reject(error); }
  });
}

const tools = [
  { name: 'agent_status', description: 'Check whether the connected game tab has joined a shared table and is ready for agent control.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'observe_game', description: 'Read the game state from this seat. Includes this player’s hand, public opponent zones, life, counters, recent chat and log. Opponents’ hidden hand and library identities are never returned.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'send_chat', description: 'Send a message to everyone at the table. Tell the human your plan before taking a consequential action, and wait for their reply when you need their choice.', inputSchema: { type: 'object', properties: { text: { type: 'string', minLength: 1, maxLength: 280 } }, required: ['text'], additionalProperties: false } },
  { name: 'draw_cards', description: 'Draw 1–5 cards from your own library into your private hand. The game is a freeform tabletop and does not verify Magic rules or costs.', inputSchema: { type: 'object', properties: { count: { type: 'integer', minimum: 1, maximum: 5 } }, additionalProperties: false } },
  { name: 'move_card', description: 'Move one of your own cards between hand, battlefield, graveyard, exile, or command. This is a tabletop action and does not validate whether a play is legal under Magic rules. Use the card instance id (iid) from observe_game.', inputSchema: { type: 'object', properties: { iid: { type: 'string' }, destination: { type: 'string', enum: ['hand', 'battlefield', 'graveyard', 'exile', 'command'] } }, required: ['iid', 'destination'], additionalProperties: false } },
  { name: 'tap_card', description: 'Set one of your battlefield cards tapped or untapped.', inputSchema: { type: 'object', properties: { iid: { type: 'string' }, tapped: { type: 'boolean' } }, required: ['iid', 'tapped'], additionalProperties: false } },
  { name: 'untap_all', description: 'Untap all cards on your battlefield.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'pass_turn', description: 'Pass your turn if it is currently yours.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }
];

async function handleMcp(message) {
  const { id, method, params = {} } = message;
  if (method === 'initialize') {
    return result(id, { protocolVersion: params.protocolVersion || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'commander-table-agent', version: '0.1.0' }, instructions: 'You control one normal Commander Table seat through its open browser tab. Observe before acting. The game is a freeform tabletop, so it does not enforce Magic rules; reason about costs and legal plays yourself. Use send_chat to explain plans and ask the human when a choice is theirs. Hidden opponent hands and libraries are not available.' });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'ping') return result(id, {});
  if (method === 'tools/list') return result(id, { tools });
  if (method === 'tools/call') {
    const tool = tools.find(item => item.name === params.name);
    if (!tool) return result(id, { isError: true, content: [{ type: 'text', text: `Unknown tool: ${params.name || ''}` }] });
    try {
      const value = await callPage(tool.name, params.arguments || {});
      return result(id, { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
    } catch (error) {
      return result(id, { isError: true, content: [{ type: 'text', text: String(error.message || error) }] });
    }
  }
  if (typeof id !== 'undefined') mcpError(id, -32601, `Method not found: ${method}`);
}

const mimeIndex = (file) => mime[path.extname(file).toLowerCase()] || 'application/octet-stream';
const server = createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  const relative = path.relative(root, file);
  const parts = relative.split(path.sep);
  if (!['index.html', 'admin.html', 'css', 'js', 'assets'].includes(parts[0]) || parts.some(part => part.startsWith('.'))) { res.writeHead(403).end('Forbidden'); return; }
  let info;
  try { info = statSync(file); if (!info.isFile()) throw new Error('not a file'); }
  catch { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': mimeIndex(file), 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
});

server.on('upgrade', (req, socket) => {
  const origin = req.headers.origin;
  const allowedOrigin = origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
  const remote = socket.remoteAddress || '';
  const localOnly = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
  const key = req.headers['sec-websocket-key'];
  if (req.url !== '/agent-bridge' || !allowedOrigin || !localOnly || req.headers['sec-websocket-version'] !== '13' || !key) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  if (browser && browser !== socket && !browser.destroyed) browser.end(frame(8));
  browser = socket;
  let buffer = Buffer.alloc(0);
  function closeBridge() {
    if (browser !== socket) return;
    browser = null;
    for (const [id, item] of pending) { clearTimeout(item.timeout); item.reject(new Error('The game tab disconnected.')); pending.delete(id); }
  }
  socket.on('close', closeBridge); socket.on('end', closeBridge); socket.on('error', closeBridge);
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const b0 = buffer[0], b1 = buffer[1], opcode = b0 & 0x0f, masked = !!(b1 & 0x80);
      let length = b1 & 0x7f, offset = 2;
      if (!masked) { socket.end(frame(8)); return; }
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (buffer.length < 10) return; const big = buffer.readBigUInt64BE(2); if (big > BigInt(maxFrame)) { socket.end(frame(8)); return; } length = Number(big); offset = 10; }
      if (length > maxFrame) { socket.end(frame(8)); return; }
      if (buffer.length < offset + 4 + length) return;
      const mask = buffer.subarray(offset, offset + 4); offset += 4;
      const body = Buffer.from(buffer.subarray(offset, offset + length)); buffer = buffer.subarray(offset + length);
      for (let i = 0; i < body.length; i++) body[i] ^= mask[i % 4];
      if (opcode === 8) { socket.end(frame(8, body)); return; }
      if (opcode === 9) { socket.write(frame(10, body)); continue; }
      if (opcode !== 1) { socket.end(frame(8)); return; }
      let message;
      try { message = JSON.parse(body.toString('utf8')); } catch { continue; }
      if (message && message.type === 'hello') { log(`Game tab connected (${message.status && message.status.name || 'not seated yet'}).`); continue; }
      if (message && message.type === 'result' && typeof message.id === 'string') {
        const item = pending.get(message.id); if (!item) continue;
        clearTimeout(item.timeout); pending.delete(message.id);
        if (message.ok) item.resolve(message.result); else item.reject(new Error(message.error || 'Game action failed.'));
      }
    }
  });
});

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { mcpError(null, -32700, 'Parse error'); return; }
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') { mcpError(message && message.id, -32600, 'Invalid request'); return; }
  handleMcp(message).catch(error => mcpError(message.id, -32603, String(error.message || error)));
});
lines.on('close', () => { if (browser && !browser.destroyed) browser.end(frame(8)); server.close(); process.exit(0); });

if (!Number.isInteger(port) || port < 1024 || port > 65535) { log('CT_AGENT_PORT must be a port from 1024 to 65535.'); process.exit(1); }
server.listen(port, '127.0.0.1', () => log(`Ready. Open http://127.0.0.1:${port}/index.html?agent=1 in the game tab.`));
