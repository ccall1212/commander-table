/* Exercise the real Net session's queue behavior with deterministic fake sockets. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const peers = [];
class Emitter {
  constructor() { this.handlers = {}; }
  on(name, fn) { (this.handlers[name] ||= []).push(fn); return this; }
  emit(name, ...args) { for (const fn of this.handlers[name] || []) fn(...args); }
}
class Connection extends Emitter {
  constructor() { super(); this.open = false; this.sent = []; this.fail = false; }
  send(msg) { if (this.fail) throw Error('socket lost'); this.sent.push(msg); }
  close() { this.open = false; }
}
class Peer extends Emitter {
  constructor() { super(); this.open = false; peers.push(this); }
  connect() { return this.conn = new Connection(); }
  destroy() { this.open = false; }
}
const context = vm.createContext({
  console: { debug() {}, error: console.error }, URLSearchParams, TextEncoder, Uint32Array,
  Peer, location: { search: '?net=p2p', hostname: 'localhost' },
  document: { addEventListener() {}, visibilityState: 'visible' },
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  addEventListener() {}
});
context.window = context;
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/net.js'), 'utf8'), context);
const Net = context.Net;
Net.start({ role: 'client', room: 'QUEUE', pid: 'guest' });
assert.equal(Net.state(), 'connecting');
Net.send({ t: 'response', deal: 'current' });
assert.equal(Net.diag().queued, 0, 'a response sent before connection is dropped immediately');
Net.send({ t: 'op', op: { k: 'life', d: -1 } });
Net.send({ t: 'pub', p: { life: 40 } });
Net.send({ t: 'pub', p: { life: 39 } });
assert.equal(Net.diag().queued, 2, 'regular actions still queue and public snapshots still coalesce');
let peer = peers.at(-1); peer.open = true; peer.emit('open', 'guest-net');
let conn = peer.conn; conn.open = true; conn.emit('open');
assert.equal(Net.state(), 'online'); assert.equal(Net.diag().queued, 0);
assert.equal(conn.sent.filter(m => m.t === 'response').length, 0, 'connecting never replays the dropped response');
assert.equal(conn.sent.filter(m => m.t === 'op').length, 1);
assert.equal(conn.sent.find(m => m.t === 'pub').p.life, 39);
Net.send({ t: 'response', deal: 'current' });
assert.equal(conn.sent.filter(m => m.t === 'response').length, 1, 'online response is sent normally');
conn.fail = true; Net.send({ t: 'response', deal: 'current' });
assert.equal(Net.diag().queued, 0, 'a response whose send fails is never queued');
Net.send({ t: 'op', op: { k: 'phase', v: 4 } });
assert.equal(Net.diag().queued, 1, 'regular offline actions retain reliable delivery');
Net.stop(); assert.equal(Net.state(), 'offline');
console.log('PASS response transport: absent/failed connections drop cues, no late replay, regular action queue and snapshot coalescing unchanged');
