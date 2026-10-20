/* Run with Node: node tests/test_targeting.cjs. No packages or browser required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sent = [];
const game = { classList: { contains: () => true } };
const context = vm.createContext({
  console, URL, URLSearchParams, Set, Map, Uint32Array, performance,
  location: { search: '?nettest', protocol: 'http:', href: 'http://localhost/?nettest' },
  document: { querySelector: s => s === '#game' ? game : null,
    querySelectorAll: () => [], body: { classList: { toggle() {} } } },
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1,
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  Net: { send: msg => sent.push(JSON.parse(JSON.stringify(msg))) }
});
context.window = context;
vm.runInContext(fs.readFileSync(path.join(root, 'js/targeting.js'), 'utf8'), context);
// Expose only the real endpoint picker to this unit harness; production exports stay unchanged.
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8').replace('window.CT = { S,', 'window.CT = { arrowEndpointAt, S,');
vm.runInContext(appSource, context);
const { S, hostRecv } = context.CT, T = context.CTTargeting;
S.pid = 'p1'; S.role = 'host'; S.me = {};
S.table = { seats: ['p1', 'p2'] };
S.players = {
  p1: { zones: { battlefield: [{ iid: 'p6u6wnase_1', fd: true }] } },
  p2: { zones: { battlefield: [{ iid: 'p2_2' }], hand: [{ iid: 'secret_1' }] } }
};
const element = matches => ({ closest: selector => matches[selector] || null });
const wrap = { firstElementChild: { dataset: { pid: 'p2' } } };
assert.equal(context.CT.arrowEndpointAt(element({'.boardwrap':wrap})).pid, 'p2', 'empty opponent board targets player');
assert.equal(context.CT.arrowEndpointAt(element({'#myBf':{}})).pid, 'p1', 'empty own board targets player');
assert.equal(context.CT.arrowEndpointAt(element({'[data-phead]':{dataset:{phead:'p2'}}})).pid, 'p2', 'name remains a fallback');
assert.equal(context.CT.arrowEndpointAt(element({'.card':{dataset:{zone:'hand',pid:'p1',iid:'hidden'}},'.boardwrap':wrap})),null,'hand never falls back to player board');
assert.equal(context.CT.arrowEndpointAt(element({'.boardwrap':wrap,'[data-pile], .tstrip, .thand, .tpile, #myRow, .lifebox, button, input, textarea, .rlabel, .grip':{}})),null,'life/pile/interactive controls are excluded');
assert.equal(context.CT.arrowEndpointAt(element({'.card':{dataset:{zone:'battlefield',pid:'p2',iid:'p2_2'}},'.boardwrap':wrap})).kind,'card','battlefield cards take priority over board target');
const card = { kind: 'card', pid: 'p1', iid: 'p6u6wnase_1' };
const player = { kind: 'player', pid: 'p2' };
const send = (arrow, from = 'p1') => hostRecv({ t: 'arrow', arrow }, from);
send({ from: card, to: player, by: 'spoof', name: 'secret' });
assert.equal(sent.length, 1);
assert.equal(S.targetArrow.by, 'p1');
assert.deepEqual(Object.keys(sent[0].arrow).sort(), ['by', 'from', 'to']);
assert.equal(sent[0].arrow.from.iid, 'p6u6wnase_1'); // real underscore id, face-down permitted
send({ from: player, to: card }, 'intruder');
assert.equal(sent.length, 1, 'unseated sender rejected');
for (const bad of [
  { from: card, to: card },
  { from: card, to: { kind: 'card', pid: 'p2', iid: 'secret_1' } },
  { from: card, to: { kind: 'card', pid: 'p2', iid: 'missing' } },
  { from: card, to: { kind: 'player', pid: 'intruder' } },
  { from: { kind: 'card', pid: 'p1', iid: '<script>' }, to: player },
  { from: card, to: { kind: 'library', pid: 'p2' } },
  { from: null, to: player }, false, {}
]) send(bad);
assert.equal(sent.length, 1, 'invalid/private endpoints do not broadcast');
send(null, 'intruder');
assert.equal(sent.length, 1, 'unseated sender cannot clear');
send(null, 'p2');
assert.equal(S.targetArrow, null);
assert.equal(sent.at(-1).arrow, null);
S.role = 'solo';
send({ from: player, to: card }); // same host validation path as a network request
assert.equal(S.targetArrow.to.iid, card.iid);
S.players.p1.zones.battlefield = [];
assert.equal(T.clean(S.targetArrow, S.players, S.table.seats), null, 'moved cards invalidate arrow');
S.table.seats = ['p1'];
assert.equal(T.clean({ by: 'p1', from: card, to: player }, S.players, S.table.seats), null);
const a = { left: 10, top: 20, width: 80, height: 112 };
const b = { left: 210, top: 20, width: 80, height: 112 };
const line = T.line(a, b);
assert.equal(line.x1, 90); assert.equal(line.x2, 210);
assert.equal(line.y1, 76); assert.equal(line.y2, 76);
assert.equal(T.line(a, a), null);
assert.equal(T.line(a, { ...a, left: 30 }), null, 'overlapping targets do not produce reversed lines');
const scaled = T.line({ left: 5, top: 10, width: 40, height: 56 }, { left: 105, top: 10, width: 40, height: 56 });
assert.equal(scaled.x1, line.x1 / 2); assert.equal(scaled.x2, line.x2 / 2);
console.log('PASS targeting: empty-board/name/card endpoint picking, hidden/interactive exclusions, host/solo authorization, public endpoints, spoof stripping, clear, removal and scaled geometry');
