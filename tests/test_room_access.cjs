/* Run with Node: node tests/test_room_access.cjs. No packages or browser required.
 * Room access: lock the room, ask before anyone joins, block removed players by browser ID and by name. */
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
const prompts = [];         // join-request questions shown to the host
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
  Deck: { slimDef: d => ({ id: d.id, name: d.name }) },
  UI: {
    toast() {},
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
source = source.replace(marker, 'window.CT = { hostRecv, tableOp, cleanTable, handleUnadmittedPub, isAdmitted, joinGate, startNet, isBlockedName, cleanBlockedNames, handleClientModeration, S,');
vm.runInContext(source, context);

const CT = context.CT;
const { S } = CT;
const plain = x => JSON.parse(JSON.stringify(x)); // arrays made inside the fake page are a different 'realm', so compare plain copies
const flush = () => new Promise(resolve => setImmediate(resolve));
const flushTimers = () => { while (timers.length) timers.shift()(); };
const SEATKEY = 'a'.repeat(32);
const newcomerPub = name => ({ t: 'pub', seatKey: SEATKEY, p: { name, zones: {} } });
const messagesTo = pid => sent.filter(([to]) => to === pid).map(([, m]) => m);
const reset = () => { sent.length = 0; dropped.length = 0; timers.length = 0; prompts.length = 0; confirmAnswer = true; };

// A host with two seated players, then start the host's network session to capture its callbacks.
S.pid = 'host'; S.role = 'host'; S.room = 'ABCDE'; S.me = { name: 'Host', defs: {}, cmdrs: [], zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [] } };
S.table = CT.cleanTable({ room: 'ABCDE', seats: ['host', 'alice'], order: ['host', 'alice'], hostPid: 'host', started: false, rev: 1 });
S.players = { host: { name: 'Host', zones: {} }, alice: { name: 'Alice', zones: {} } };
S.log = []; S.chat = []; S.online = { host: true, alice: true }; S.seatKeys = {};
CT.startNet();
assert.equal(typeof startCfg.onJoin, 'function', 'the app registered its join callback');
assert.equal(typeof startCfg.canReceive, 'function', 'the app registered a canReceive check for broadcasts');

(async () => {
  // ---- Open room: today's behaviour is unchanged. ----
  reset();
  startCfg.onJoin('guest1');
  assert.equal(messagesTo('guest1').filter(m => m.t === 'snap').length, 1, 'open room: a new connection gets the table');
  assert.equal(CT.isAdmitted('guest1'), true, 'open room: the new connection is admitted');
  assert.equal(startCfg.canReceive('guest1'), true, 'open room: broadcasts reach them');
  assert.equal(startCfg.canReceive('nobody'), false, 'an unknown connection receives no broadcasts');
  assert.equal(startCfg.canReceive('alice'), true, 'a seated player receives broadcasts');

  // ---- Only the host can change room access. ----
  CT.tableOp({ k: 'access', locked: true, askJoin: false }, 'alice');
  assert.equal(S.table.locked, false, 'a seated player cannot lock the room');
  CT.tableOp({ k: 'moderator', pid: 'alice', enabled: true }, 'host');
  CT.tableOp({ k: 'access', locked: true, askJoin: false }, 'alice');
  assert.equal(S.table.locked, false, 'a moderator cannot lock the room either');

  // ---- Locked room. ----
  reset();
  CT.tableOp({ k: 'access', locked: true, askJoin: false }, 'host');
  assert.equal(S.table.locked, true, 'the host can lock the room');
  startCfg.onJoin('stranger');
  assert.deepEqual(messagesTo('stranger').map(m => m.t), ['join-refused'], 'locked: a stranger is only told the room is locked');
  assert.equal(messagesTo('stranger')[0].reason, 'locked');
  assert.equal(sent.some(([, m]) => m.t === 'snap' && m === messagesTo('stranger')[0]), false, 'locked: no table snapshot for a stranger');
  assert.equal(CT.isAdmitted('stranger'), false, 'locked: the stranger is not admitted');
  assert.equal(startCfg.canReceive('stranger'), false, 'locked: broadcasts do not reach the stranger');
  flushTimers();
  assert.ok(dropped.includes('stranger'), 'locked: the stranger\'s connection is closed');

  reset();
  startCfg.onJoin('alice');
  assert.equal(messagesTo('alice').filter(m => m.t === 'snap').length, 1, 'locked: a seated player can still reconnect');
  CT.hostRecv({ t: 'chat', text: 'hello' }, 'stranger');
  assert.equal(sent.some(([to, m]) => to === 'all' && m.t === 'chat'), false, 'locked: messages from a stranger are ignored');
  CT.handleUnadmittedPub('stranger', newcomerPub('Stranger'));
  assert.equal(S.players.stranger, undefined, 'locked: a stranger\'s public view is not accepted');
  assert.equal(S.table.seats.includes('stranger'), false, 'locked: the stranger gets no seat');
  assert.ok(messagesTo('stranger').some(m => m.t === 'join-refused' && m.reason === 'locked'), 'locked: a late first message is refused too');

  // ---- Unlocking lets people in again. ----
  reset();
  CT.tableOp({ k: 'access', locked: false, askJoin: false }, 'host');
  startCfg.onJoin('latecomer');
  assert.equal(CT.isAdmitted('latecomer'), true, 'unlocked: a new connection is admitted again');

  // ---- Ask before anyone joins: Let in. ----
  reset();
  CT.tableOp({ k: 'access', locked: false, askJoin: true }, 'host');
  startCfg.onJoin('bob');
  assert.deepEqual(messagesTo('bob').map(m => m.t), ['join-wait'], 'ask: a new connection is told to wait');
  assert.equal(CT.isAdmitted('bob'), false, 'ask: not admitted before the host answers');
  confirmAnswer = true;
  CT.handleUnadmittedPub('bob', newcomerPub('Bob'));
  await flush();
  assert.equal(prompts.length, 1, 'ask: the host is asked once');
  assert.match(prompts[0], /Bob wants to join/, 'ask: the question names the player');
  assert.equal(CT.isAdmitted('bob'), true, 'ask: Let in admits them');
  assert.ok(messagesTo('bob').some(m => m.t === 'snap'), 'ask: Let in sends them the table');
  assert.ok(S.pendingSeats && S.pendingSeats.bob, 'ask: Let in continues the normal join, so they now choose a color');
  CT.tableOp({ k: 'joincolor', color: 'white' }, 'bob');
  assert.ok(S.table.seats.includes('bob'), 'ask: after choosing a color they are seated');
  assert.equal(S.players.bob.name, 'Bob');

  // ---- Ask before anyone joins: Decline. ----
  reset();
  startCfg.onJoin('carol');
  confirmAnswer = false;
  CT.handleUnadmittedPub('carol', newcomerPub('Carol'));
  await flush();
  assert.equal(CT.isAdmitted('carol'), false, 'ask: Decline does not admit');
  assert.ok(messagesTo('carol').some(m => m.t === 'join-refused' && m.reason === 'declined'), 'ask: Decline tells them');
  assert.equal(S.table.seats.includes('carol'), false, 'ask: Decline gives no seat');
  flushTimers(); assert.ok(dropped.includes('carol'), 'ask: Decline closes their connection');

  // ---- Two requests are asked one at a time. ----
  reset();
  startCfg.onJoin('dave'); startCfg.onJoin('erin');
  confirmAnswer = true;
  CT.handleUnadmittedPub('dave', newcomerPub('Dave')); CT.handleUnadmittedPub('erin', newcomerPub('Erin'));
  await flush(); await flush();
  assert.equal(prompts.length, 2, 'ask: each waiting player gets their own question');
  assert.ok(S.pendingSeats.dave && S.pendingSeats.erin, 'ask: both were let in');
  CT.tableOp({ k: 'joincolor', color: 'lime' }, 'dave'); CT.tableOp({ k: 'joincolor', color: 'pink' }, 'erin');
  assert.ok(S.table.seats.includes('dave') && S.table.seats.includes('erin'), 'ask: both are seated after choosing colors');

  // ---- Settings change while someone waits. ----
  reset();
  startCfg.onJoin('frank');
  S.joinRequests.frank = { name: 'Frank', msg: newcomerPub('Frank'), asked: true }; // waiting on an open question
  CT.tableOp({ k: 'access', locked: true, askJoin: true }, 'host');
  assert.ok(messagesTo('frank').some(m => m.t === 'join-refused' && m.reason === 'locked'), 'locking refuses anyone waiting');
  assert.equal(S.joinRequests.frank, undefined);
  reset();
  CT.tableOp({ k: 'access', locked: false, askJoin: true }, 'host');
  startCfg.onJoin('gina');
  S.joinRequests.gina = { name: 'Gina', msg: newcomerPub('Gina'), asked: true };
  CT.tableOp({ k: 'access', locked: false, askJoin: false }, 'host');
  assert.equal(CT.isAdmitted('gina'), true, 'turning off ask-first admits anyone waiting');
  CT.tableOp({ k: 'joincolor', color: 'orange' }, 'gina');
  assert.ok(S.table.seats.includes('gina'), 'and they can finish joining');

  // ---- A flood of strangers cannot bury the host in questions. ----
  reset();
  CT.tableOp({ k: 'access', locked: false, askJoin: true }, 'host');
  S.joinRequests = {};
  for (let i = 0; i < 8; i++) { startCfg.onJoin('spam' + i); S.joinRequests['spam' + i] = { name: 'Spam ' + i, msg: newcomerPub('Spam ' + i), asked: true }; }
  startCfg.onJoin('spam-extra');
  CT.handleUnadmittedPub('spam-extra', newcomerPub('Spam extra'));
  assert.equal(Object.keys(S.joinRequests).length, 8, 'at most eight join requests wait at once');
  assert.ok(messagesTo('spam-extra').some(m => m.t === 'join-refused'), 'the ninth is turned away');
  assert.equal(prompts.length, 0, 'and the host is not asked about it');
  S.joinRequests = {}; CT.tableOp({ k: 'access', locked: false, askJoin: false }, 'host');

  // ---- Leaving while waiting leaves nothing behind. ----
  reset();
  CT.tableOp({ k: 'access', locked: false, askJoin: true }, 'host');
  startCfg.onJoin('hank');
  S.joinRequests.hank = { name: 'Hank', msg: newcomerPub('Hank'), asked: false };
  sent.length = 0;
  startCfg.onLeave('hank');
  assert.equal(S.joinRequests.hank, undefined, 'a waiting player who leaves is forgotten');
  assert.equal(sent.some(([, m]) => m.t === 'log'), false, 'and nothing is logged about them');
  CT.tableOp({ k: 'access', locked: false, askJoin: false }, 'host');

  // ---- Kicking blocks the browser ID and the name. ----
  reset();
  CT.tableOp({ k: 'kick', pid: 'alice' }, 'host');
  assert.equal(S.table.seats.includes('alice'), false, 'kick removes the seat');
  assert.ok(S.table.kicked.includes('alice'), 'kick blocks that browser ID');
  assert.deepEqual(plain(S.table.blockedNames), ['Alice'], 'kick blocks the display name');
  assert.ok(messagesTo('alice').some(m => m.t === 'moderation-exit'), 'the player is told');
  flushTimers(); assert.ok(dropped.includes('alice'), 'kick closes their connection');
  assert.equal(startCfg.canReceive('alice'), false, 'a removed player no longer receives broadcasts');

  reset();
  startCfg.onJoin('alice');
  assert.deepEqual(messagesTo('alice').map(m => m.t), ['join-refused'], 'the same browser ID is refused');
  assert.equal(messagesTo('alice')[0].reason, 'blocked');

  // Same name from a brand-new browser ID (the kicked player's browser makes a new ID on its own).
  reset();
  startCfg.onJoin('alice-new');
  assert.equal(CT.isAdmitted('alice-new'), true, 'open room: a new ID connects');
  CT.hostRecv(newcomerPub('  ALICE '), 'alice-new');
  assert.equal(S.table.seats.includes('alice-new'), false, 'but the blocked name gets no seat, whatever the capitalisation');
  assert.ok(!(S.pendingSeats || {})['alice-new'], 'and is not even offered a color');
  assert.ok(messagesTo('alice-new').some(m => m.t === 'join-refused' && m.reason === 'blocked'), 'and is told it is blocked');
  assert.equal(CT.isAdmitted('alice-new'), false, 'and is no longer admitted');

  // The blocked name is also caught when ask-first is on.
  reset();
  CT.tableOp({ k: 'access', locked: false, askJoin: true }, 'host');
  startCfg.onJoin('alice-ask');
  CT.handleUnadmittedPub('alice-ask', newcomerPub('Alice'));
  await flush();
  assert.equal(prompts.length, 0, 'ask: a blocked name never even reaches the host as a question');
  assert.ok(messagesTo('alice-ask').some(m => m.reason === 'blocked'));
  CT.tableOp({ k: 'access', locked: false, askJoin: false }, 'host');

  // ---- Unblock is host only. ----
  CT.tableOp({ k: 'unblock', name: 'alice' }, 'bob');
  assert.deepEqual(plain(S.table.blockedNames), ['Alice'], 'a seated player cannot unblock');
  CT.tableOp({ k: 'moderator', pid: 'bob', enabled: true }, 'host');
  CT.tableOp({ k: 'unblock', name: 'alice' }, 'bob');
  assert.deepEqual(plain(S.table.blockedNames), ['Alice'], 'a moderator cannot unblock');
  CT.tableOp({ k: 'unblock', name: 'alice' }, 'host');
  assert.deepEqual(plain(S.table.blockedNames), [], 'the host can unblock (case-insensitive)');
  reset();
  startCfg.onJoin('alice-back');
  CT.hostRecv(newcomerPub('Alice'), 'alice-back');
  CT.tableOp({ k: 'joincolor', color: 'teal' }, 'alice-back');
  assert.ok(S.table.seats.includes('alice-back'), 'after unblocking, the name can join again');

  // ---- A moderator's kick also blocks the name. ----
  reset();
  CT.tableOp({ k: 'kick', pid: 'dave' }, 'bob');
  assert.ok(S.table.blockedNames.some(n => n === 'Dave'), 'a moderator\'s kick blocks the name too');

  // ---- The table keeps these settings when it is cleaned (saved, resumed, sent to guests). ----
  const cleaned = CT.cleanTable({ room: 'ABCDE', seats: ['host'], locked: 1, askJoin: 'yes', blockedNames: ['Zed', ' zed ', 'ZED', 'Amy', 7, null, '', 'x'.repeat(80)] });
  assert.equal(cleaned.locked, true); assert.equal(cleaned.askJoin, true);
  assert.deepEqual(plain(cleaned.blockedNames), ['Zed', 'Amy', 'x'.repeat(40)], 'blocked names are trimmed, de-duplicated without regard to case, and limited in length');
  assert.equal(CT.cleanTable({ room: 'ABCDE', seats: ['host'] }).locked, false, 'older saved tables default to an open room');
  assert.equal(CT.cleanBlockedNames(Array.from({ length: 200 }, (_, i) => 'n' + i)).length, 64, 'the blocked list is capped');

  // ---- What a refused player's page does. ----
  // (The screens themselves are checked in a real browser; here we only check the messages are recognised.)
  S.role = 'client'; S.me = null;
  assert.equal(CT.handleClientModeration({ t: 'join-refused', reason: 'locked' }), true, 'a guest page understands join-refused');
  assert.equal(CT.handleClientModeration({ t: 'join-refused', reason: 'something-new' }), true, 'and falls back safely for a reason it does not know');

  console.log('PASS room access: lock, ask-first (Let in / Decline), blocking by ID and name, unblock, host-only settings, broadcast gating, table cleaning');
})().catch(err => { console.error(err); process.exit(1); });
