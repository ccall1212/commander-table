/* Run with Node: node tests/test_net_drop.cjs. No packages or browser required.
 * Host side of the network layer: cfg.canReceive limits who a broadcast reaches, Net.sendTo still reaches
 * any connected player, and Net.drop closes one player's connection. Uses deterministic fake sockets. */
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
  constructor(pid) { super(); this.metadata = { pid }; this.open = true; this.sent = []; this.closed = false; }
  send(msg) { this.sent.push(msg); }
  close() { this.open = false; this.closed = true; }
}
class Peer extends Emitter {
  constructor() { super(); this.open = false; peers.push(this); }
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

const admitted = new Set(['seated']);
const joined = [], left = [];
Net.start({
  role: 'host', room: 'GATED', pid: 'host',
  canReceive: pid => admitted.has(pid),
  onJoin: pid => joined.push(pid), onLeave: pid => left.push(pid)
});
const peer = peers.at(-1); peer.open = true; peer.emit('open', 'host-net');
assert.equal(Net.state(), 'online');

const connect = pid => { const c = new Connection(pid); peer.emit('connection', c); return c; };
const seated = connect('seated'), stranger = connect('stranger');
assert.deepEqual([...joined], ['seated', 'stranger'], 'both connections reach the app\'s join callback');
const payload = c => c.sent.filter(m => m && m.t === 'table');

// A broadcast reaches only connections the app says may receive it.
Net.send({ t: 'table', n: 1 });
assert.equal(payload(seated).length, 1, 'an admitted connection receives the broadcast');
assert.equal(payload(stranger).length, 0, 'a connection that is not admitted does not');

// A direct message still reaches a connection that is not admitted (that is how it is told "locked" or "wait").
Net.sendTo('stranger', { t: 'join-wait' });
assert.deepEqual(stranger.sent.filter(m => m.t === 'join-wait').length, 1, 'sendTo still reaches a connection that is not admitted');

// Admitting the stranger (for example after "Let in") makes broadcasts reach them.
admitted.add('stranger');
Net.send({ t: 'table', n: 2 });
assert.equal(payload(stranger).length, 1, 'once admitted, broadcasts reach them');

// Taking admission away stops broadcasts again.
admitted.delete('stranger');
Net.send({ t: 'table', n: 3 });
assert.equal(payload(stranger).length, 1, 'removing admission stops broadcasts again');

// Net.drop closes only that connection, and the app hears about it.
Net.drop('stranger');
assert.equal(stranger.closed, true, 'drop closes the connection');
assert.equal(seated.closed, false, 'and leaves everyone else connected');
assert.deepEqual([...left], ['stranger'], 'the app is told the connection ended');
Net.drop('stranger'); Net.drop('nobody-at-all');
assert.deepEqual([...left], ['stranger'], 'dropping twice, or an unknown ID, does nothing');
Net.send({ t: 'table', n: 4 });
assert.equal(payload(seated).length, 4, 'the remaining player received every broadcast');

// A host that gives no canReceive check behaves exactly as before (everyone connected receives broadcasts).
Net.stop();
const peerCount = peers.length;
Net.start({ role: 'host', room: 'OPEN1', pid: 'host2' });
const peer2 = peers.at(-1); assert.ok(peers.length > peerCount); peer2.open = true; peer2.emit('open', 'host2-net');
const a = new Connection('a'); peer2.emit('connection', a);
Net.send({ t: 'table', n: 1 });
assert.equal(payload(a).length, 1, 'without a canReceive check every connection receives broadcasts, as before');

console.log('PASS net drop: broadcast gating by canReceive, direct messages still delivered, drop closes one connection, default behaviour unchanged');
