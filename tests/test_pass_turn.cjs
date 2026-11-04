/* Run with Node: node tests/test_pass_turn.cjs. No packages or browser required.
 * Pass turn: only the player whose turn it is, or the host, can pass the turn; nobody else can pass it for another player. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sent = [];            // everything the host sent: [target, message]; target is 'all' for a broadcast
const dropped = [];         // connections the host closed
const timers = [];          // callbacks passed to setTimeout, run by flushTimers()
let startCfg = null;        // the callbacks the app gave Net.start
let confirmAnswer = true;   // what the host "clicks" on a join request
const prompts = [];         // confirm questions shown
const toasts = [];          // toasts shown         // join-request questions shown to the host
const data = Object.create(null);
const storage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
  setItem(k, v) { data[k] = String(v); },
  removeItem(k) { delete data[k]; }
};
const localStorage = new Proxy(storage, { ownKeys: () => Reflect.ownKeys(data), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
const context = vm.createContext({
  console, URL, URLSearchParams, Set, Map, Uint32Array, performance,
  innerWidth: 1200, innerHeight: 900,
  location: { search: '?nettest', protocol: 'http:', href: 'http://localhost/?nettest' },
  document: { querySelector: () => null, querySelectorAll: () => [], body: { classList: { toggle() {} } } },
  localStorage, sessionStorage: storage,
  setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval: () => 1,
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  Peer: function Peer() {},
  Net: {
    start: cfg => { startCfg = cfg; },
    send: msg => sent.push(['all', structuredClone(msg)]),
    sendTo: (pid, msg) => sent.push([pid, structuredClone(msg)]),
    drop: pid => dropped.push(pid),
    stop() {}, adminPresence() {}, adminJoinDecision() {}, state: () => 'online', roomVault: () => Promise.resolve({})
  },
  Deck: { slimDef: d => ({ id: d.id, name: d.name }), get: () => null, save() {}, list: () => [] },
  UI: {
    toast: (text, o) => { toasts.push(text); },
    confirm: async text => { prompts.push(text); return confirmAnswer; },
    modal: () => ({ el: { querySelector: () => ({}) }, close() {} }),
    cardBackHTML: () => ''
  }
});
context.window = context;
context.crypto = { getRandomValues: a => { a.fill(3); return a; } };
context.CTAppearance = { normalizePrefs: x => x || {}, getCustom: () => ({}), boardBackgroundStyle: () => '' };
vm.runInContext(fs.readFileSync(path.join(root, 'js/targeting.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/mulligan.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/player-colors.js'), 'utf8'), context);
let source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const marker = 'window.CT = { S,';
assert.equal(source.split(marker).length, 2, 'test export anchor is unique');
source = source.replace(marker, 'window.CT = { passTurn, passBtn, hostRecv, tableOp, cleanTable, handleUnadmittedPub, isAdmitted, joinGate, startNet, isBlockedName, cleanBlockedNames, handleClientModeration, S,');
vm.runInContext(source, context);

const CT = context.CT;
const { S } = CT;
const plain = x => JSON.parse(JSON.stringify(x));
const flush = () => new Promise(resolve => setImmediate(resolve));
const reset = () => { sent.length = 0; toasts.length = 0; prompts.length = 0; confirmAnswer = true; };

const seats = ['host', 'alice', 'bob'];
S.pid = 'host'; S.role = 'host'; S.room = 'ABCDE';
S.me = { name: 'Host', defs: {}, cmdrs: [], zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [] } };
S.players = { host: { name: 'Host', zones: {} }, alice: { name: 'Alice', zones: {} }, bob: { name: 'Bob', zones: {} } };
S.log = []; S.chat = []; S.online = { host: true, alice: true, bob: true }; S.seatKeys = {};
const startTable = active => { S.table = CT.cleanTable({ room: 'ABCDE', seats, order: seats, hostPid: 'host', started: true, active, turn: 1, turnSeq: 1, phase: 3, rev: 1, out: {} }); };
const pass = (from, seq) => CT.hostRecv({ t: 'op', op: { k: 'pass', turn: seq, turnSeq: seq } }, from);

(async () => {
  // ---- Host side: who may pass. ----
  startTable('alice');
  pass('bob', 1);
  assert.equal(S.table.active, 'alice', 'another player cannot pass Alice\'s turn');
  assert.equal(S.table.turnSeq, 1);
  pass('stranger', 1);
  assert.equal(S.table.active, 'alice', 'someone who is not even at the table cannot either');
  pass('alice', 1);
  assert.equal(S.table.active, 'bob', 'the active player can pass their own turn');
  assert.equal(S.table.turnSeq, 2);
  pass('alice', 2);
  assert.equal(S.table.active, 'bob', 'Alice can no longer pass: it is Bob\'s turn now');
  pass('host', 2);
  assert.equal(S.table.active, 'host', 'the host can pass another player\'s turn');
  pass('host', 3);
  assert.equal(S.table.active, 'alice', 'and the host can pass their own');
  assert.equal(S.table.turn, 2, 'a full round counted');
  // A stale pass is still ignored.
  pass('alice', 1);
  assert.equal(S.table.active, 'alice', 'a late or duplicate pass changes nothing');
  pass('host', 4);
  assert.equal(S.table.active, 'bob', 'the host passes Alice\'s turn on to Bob');
  assert.match(S.log[S.log.length - 1].text, /Bob's turn \(passed by Host\)/, 'and the log says the host did it');

  // ---- Client side (this browser is a guest, Bob; it is Alice\'s turn). ----
  reset();
  S.pid = 'bob'; S.role = 'client';
  startTable('alice');
  await CT.passTurn();
  assert.equal(sent.length, 0, 'a guest sends nothing when it is someone else\'s turn');
  assert.equal(prompts.length, 0, 'and is not offered the "pass it for them" question');
  assert.equal(toasts.length, 1); assert.match(toasts[0], /Only the host can pass it/);
  assert.match(CT.passBtn(), /disabled/, 'the Pass turn button is disabled for a guest on someone else\'s turn');
  assert.match(CT.passBtn(), /Only the host can pass another player/, 'with a tooltip that says why');
  startTable('bob');
  assert.doesNotMatch(CT.passBtn(), /disabled/, 'on their own turn the guest can press it');
  assert.match(CT.passBtn(), /primary/);
  S.table.started = false;
  assert.match(CT.passBtn(), /disabled/, 'and before the game starts nobody can');
  S.table.started = true;

  // The host may pass another player\'s turn, after the existing confirmation.
  reset();
  S.pid = 'host'; S.role = 'host';
  startTable('alice');
  assert.doesNotMatch(CT.passBtn(), /disabled/, 'the host\'s button works on anyone\'s turn');
  S.net = { state: 'online' };
  confirmAnswer = false; await CT.passTurn();
  assert.equal(prompts.length, 1); assert.match(prompts[0], /Alice's turn\. Pass it for them\?/);
  assert.equal(S.table.active, 'alice', 'declining the question passes nothing');
  confirmAnswer = true; await CT.passTurn(); await flush();
  assert.equal(S.table.active, 'bob', 'confirming passes Alice\'s turn');
  assert.equal(toasts.length, 0);
  console.log('PASS pass turn: the host ignores a pass from anyone but the active player or the host; guests get a button that is disabled and a clear message; the host still gets the confirmation');
})().catch(e => { console.error(e); process.exit(1); });
