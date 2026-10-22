/* Node-only checks for admin authentication, room listing, host consent, and close. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../relay/worker.js'), 'utf8')
  .replace('import { DurableObject } from "cloudflare:workers";', '')
  .replace('export default {', 'const Worker = {')
  .replace('export class Room extends DurableObject', 'class Room extends DurableObject')
  .replace('export class RoomDirectory extends DurableObject', 'class RoomDirectory extends DurableObject');
class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
const { Worker, Room, RoomDirectory } = new Function('DurableObject', 'crypto', 'WebSocketRequestResponsePair', source + '\nreturn { Worker, Room, RoomDirectory };')(DurableObject, webcrypto, class {});
function context() {
  const values = new Map(), sockets = [];
  return { sockets, storage: {
    get: async key => values.get(key), put: async (key, value) => { values.set(key, value); },
    delete: async key => { values.delete(key); },
    list: async ({ prefix }) => new Map([...values].filter(([key]) => key.startsWith(prefix))),
  }, getWebSockets: () => sockets, waitUntil: promise => promise, setWebSocketAutoResponse() {} };
}
const registryContext = context();
const registry = new RoomDirectory(registryContext, {});
const registryBinding = { idFromName: name => name, get: () => ({ fetch: (input, options) => registry.fetch(input instanceof Request ? input : new Request(input, options)) }) };
const roomContext = context();
const room = new Room(roomContext, { DIRECTORY: registryBinding });
const roomBinding = { idFromName: name => name, get: () => ({ fetch: (input, options) => room.fetch(input instanceof Request ? input : new Request(input, options)) }) };
const secret = 'test-only-private-admin-passphrase-long-enough';
const env = { ADMIN_PASSPHRASE: secret, ROOMS: roomBinding, DIRECTORY: registryBinding };
function request(method, path, pass = secret) {
  return new Request('https://relay.example' + path, { method, headers: pass ? { Authorization: 'Bearer ' + pass, Origin: 'https://ccall1212.github.io' } : { Origin: 'https://ccall1212.github.io' } });
}
(async () => {
  assert.equal((await Worker.fetch(request('GET', '/admin/rooms', 'wrong'), env)).status, 401);
  assert.equal((await Worker.fetch(request('GET', '/admin/rooms', ''), env)).status, 401);
  const host = { sent: [], closed: false, deserializeAttachment: () => ({ room: 'ABCDE', id: 'ctable-v1-abcde', key: 'host-key', links: {} }),
    serializeAttachment(next) { this.attachment = next; this.deserializeAttachment = () => this.attachment; },
    send(value) { this.sent.push(JSON.parse(value)); }, close() { this.closed = true; } };
  roomContext.sockets.push(host);
  await room.onAdminPresence(host, { host: 'Chris', started: true, players: [{ name: 'Chris', connected: true }, { name: 'Friend', connected: false }], hidden: 'no cards' });
  let response = await Worker.fetch(request('GET', '/admin/rooms'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://ccall1212.github.io');
  let data = await response.json();
  assert.equal(data.count, 1); assert.equal(data.rooms[0].host, 'Chris');
  assert.deepEqual(data.rooms[0].players.map(p => p.name), ['Chris', 'Friend']);
  assert.equal(JSON.stringify(data).includes('hidden'), false, 'directory stores only the public roster');
  response = await Worker.fetch(request('POST', '/admin/rooms/ABCDE/join'), env);
  assert.equal(response.status, 200); data = await response.json();
  assert.equal(host.sent.at(-1).op, 'admin-join-request');
  assert.equal(host.sent.at(-1).id, data.id);
  assert.equal((await Worker.fetch(request('POST', '/admin/rooms/ABCDE/join'), env)).status, 409, 'duplicate pending join request is blocked');
  await room.onAdminJoinDecision(host, { id: data.id, allow: true });
  response = await Worker.fetch(request('GET', '/admin/rooms/ABCDE/join/' + data.id), env);
  assert.equal((await response.json()).status, 'approved');
  assert.equal((await Worker.fetch(request('POST', '/admin/rooms/ABCDE/close', 'bad'), env)).status, 401);
  response = await Worker.fetch(request('POST', '/admin/rooms/ABCDE/close'), env);
  assert.equal(response.status, 200); assert.equal(host.closed, true);
  assert.equal((await (await Worker.fetch(request('GET', '/admin/rooms'), env)).json()).count, 0);
  response = await room.fetch(new Request('https://internal/room/ABCDE', { headers: { Upgrade: 'websocket' } }));
  assert.equal(response.status, 410, 'closed room code cannot immediately reconnect');
  console.log('PASS admin worker: protected list, limited roster, join approval, protected close, reconnect lock');
})().catch(error => { console.error(error); process.exitCode = 1; });
