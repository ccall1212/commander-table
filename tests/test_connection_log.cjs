/* Connection log and keepalive: with a fake WebSocket and a fake clock, check that (1) a connection that really goes silent is declared dead and logged, (2) a browser
 * that ran the timer late (background tab / sleep) is NOT declared dead, and (3) closes are logged with their code. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let now = 1000000, timers = [], sockets = [];
class FakeWS {
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
  send(m) { this.sent.push(m); }
  close() { this.readyState = 3; }
}
const store = {};
const sandbox = {
  console: { warn() {}, error() {}, log() {} },
  WebSocket: FakeWS,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } },
  navigator: { onLine: true },
  document: { visibilityState: 'visible', addEventListener() {} },
  setInterval: (fn, ms) => { const t = { fn, ms, next: now + ms }; timers.push(t); return t; },
  clearInterval: t => { timers = timers.filter(x => x !== t); },
  setTimeout: fn => { fn(); return 0; },
  clearTimeout() {},
  Date: Object.assign(function () { return new Date(now); }, { now: () => now }),
};
sandbox.window = sandbox; sandbox.window.addEventListener = () => {};
sandbox.Date.prototype = Date.prototype;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../js/relay-peer.js', 'utf8'), sandbox);
const RP = sandbox.RelayPeer;
const tick = (advance) => { now += advance; timers.slice().forEach(t => t.fn()); };
function connect() {
  RP.clearLog();
  const p = new RP('abc', { url: 'ws://x', label: 'test' });
  const ws = sockets[sockets.length - 1];
  ws.readyState = 1; ws.onopen();
  ws.onmessage({ data: JSON.stringify({ op: 'open', id: 'abc' }) });
  return { p, ws };
}
let gone;

// 1. real silence: pings every 15s, nothing back, dead after 40s
{
  const { p, ws } = connect(); gone = false; p.on('disconnected', () => { gone = true; });
  for (let i = 0; i < 3; i++) tick(15000);           // 45s of silence in regular steps
  tick(15000);
  assert.ok(gone, 'a connection that really goes silent is declared dead');
  assert.ok(RP.getLog().some(e => e.event === 'no data'), 'the log says why: no data');
}
// 2. the timer ran late (hidden tab): 5 minutes pass in one step; the connection must survive that tick and be checked again
{
  const { p, ws } = connect(); gone = false; p.on('disconnected', () => { gone = true; });
  tick(15000);
  tick(300000);                                       // the browser froze the page for 5 minutes
  assert.equal(gone, false, 'a late timer alone does not kill the connection');
  assert.ok(ws.sent.filter(m => m.includes('ping')).length >= 2, 'it asked the server again');
  assert.ok(RP.getLog().some(e => e.event === 'timer ran late'), 'the log notes the late timer');
  ws.onmessage({ data: JSON.stringify({ op: 'pong' }) }); tick(15000);
  assert.equal(gone, false, 'and stays up once the server answers');
}
// 3. a close is logged with its code
{
  const { p, ws } = connect(); gone = false; p.on('disconnected', () => { gone = true; });
  ws.onclose({ code: 1006, reason: '' });
  assert.ok(gone, 'a closed socket reports disconnected');
  const e = RP.getLog().find(x => x.event === 'closed');
  assert.ok(e && /1006/.test(e.detail), 'the close code is logged');
  const log = RP.getLog(); assert.ok(log.length <= 60 && log.every(x => x.t && x.event));
}
console.log('PASS connection log: silence is declared dead and logged, a late timer (background tab / sleep) is not, closes are logged with their code');
