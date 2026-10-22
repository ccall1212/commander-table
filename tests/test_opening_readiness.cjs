/* Run with Node: node tests/test_opening_readiness.cjs. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const sent = [], notices = [], data = Object.create(null);
const storage = {
  getItem: k => Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null,
  setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; }
};
const context = vm.createContext({
  console, URL, URLSearchParams, Set, Map, Uint32Array, performance,
  innerWidth: 1200, innerHeight: 900,
  location: { search: '?nettest', protocol: 'http:', href: 'http://localhost/?nettest' },
  document: { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ setAttribute() {}, querySelectorAll: () => [], remove() {}, classList: { add() {}, remove() {} } }), body: { classList: { toggle() {} }, appendChild() {} } },
  localStorage: storage, sessionStorage: storage,
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1,
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  Net: { send: msg => sent.push(msg), sendTo: (pid, msg) => sent.push([pid, msg]), stop() {} },
  Deck: { slimDef: d => ({ id: d.id, name: d.name }) },
  UI: { toast: msg => notices.push(msg), confirm: async () => true, prompt: async () => { throw new Error('blocked token creation should not prompt'); }, modal: () => ({ close() {} }) }
});
context.window = context;
context.crypto = { getRandomValues: a => { a.fill(3); return a; } };
context.matchMedia = () => ({ matches: true });
context.CTAppearance = { normalizePrefs: x => x || {}, getCustom: () => ({}), boardBackgroundStyle: () => '' };
context.UI.cardBackHTML = () => '';
for (const file of ['targeting.js', 'mulligan.js', 'player-colors.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
}
let source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
source = source.replace('window.CT = { S,', 'window.CT = { S, tableOp, openingPending, cleanPub, publicView, moveCard, insertCard, createToken, createTokenQuantity, copyCard, giveControl, giveControlGroup, returnControl, takeBack, hostRecv, canEnterBattlefield, undo, afterTable, keepHand,');
vm.runInContext(source, context);

const CT = context.CT, { S } = CT;
S.pid = 'host'; S.role = 'host'; S.room = 'ABCDE'; S.log = []; S.chat = []; S.online = {};
S.me = { pid: 'host', name: 'Host', openingDeal: 'deal-current', kept: false, zones: { battlefield: [], hand: [], library: [], graveyard: [], exile: [], command: [] }, defs: {}, tokens: [],
  life: 40, poison: 0, ctr: {}, cmdDmg: {}, casts: {}, cmdrs: [], layout: [], mull: 0 };
S.table = { room: 'ABCDE', seats: ['host', 'guest', 'out'], order: [], active: null, turn: 0, turnSeq: 0, phase: 3,
  started: false, openingDeal: 'deal-current', openingMode: 'london', openingAllowances: {}, out: { out: true }, hostPid: 'host', mods: [], kicked: [], handoffs: {} };
S.players = {
  host: { pid: 'host', name: 'Host', kept: false, openingDeal: 'deal-current', zones: { battlefield: [] } },
  guest: { pid: 'guest', name: 'Guest', kept: false, openingDeal: 'deal-current', zones: { battlefield: [] } },
  out: { pid: 'out', name: 'Out', kept: false, openingDeal: 'old-deal', zones: { battlefield: [] } }
};

const pending = CT.openingPending();
assert.deepEqual(Array.from(pending), ['host', 'guest'], 'all live players without a kept current hand are pending');
CT.tableOp({ k: 'start' }, 'host');
assert.equal(S.table.started, false, 'host cannot start while a live player has not kept');
assert.match(notices.at(-1), /Host, Guest.*current opening hand/);

// A stale kept flag from an earlier deal still blocks Start.
S.players.host.kept = true; S.players.guest.kept = true; S.players.guest.openingDeal = 'old-deal';
CT.tableOp({ k: 'start' }, 'host');
assert.equal(S.table.started, false, 'kept status from an old deal cannot satisfy readiness');
assert.deepEqual(Array.from(CT.openingPending()), ['guest']);

// The current deal and decision are public status only; hidden card identities remain private.
S.me.kept = true;
S.me.zones.hand.push({ iid: 'host_card', id: 'card', own: 'host' });
const pub = CT.publicView();
assert.equal(pub.openingDeal, 'deal-current');
assert.equal(pub.kept, true);
assert.equal(pub.hand, 1, 'public view exposes the hand count only');
assert.equal(Object.hasOwn(pub, 'library'), false, 'public view does not expose library cards');
assert.equal(CT.cleanPub(pub, 'host').openingDeal, 'deal-current');

// The low-level move and insert functions reject battlefield entry before the host starts.
assert.equal(CT.moveCard('host_card', 'battlefield'), null);
assert.equal(S.me.zones.hand.length, 1, 'a blocked move leaves the card in hand');
assert.equal(S.me.zones.battlefield.length, 0);
assert.equal(CT.insertCard({ iid: 'token', id: 'token', own: 'host' }, 'battlefield'), false);
assert.equal(S.me.zones.battlefield.length, 0, 'direct token/copy insertion is blocked too');
CT.createToken({ id: 'token', name: 'Token' });
CT.copyCard({ id: 'card', name: 'Card' });
assert.equal(S.me.zones.battlefield.length, 0, 'token creation and copies cannot bypass the gate');
CT.giveControl('host_card', 'guest');
CT.giveControlGroup([{ iid: 'host_card', x: 0, y: 0 }], 'guest', { x: 10, y: 10 });
CT.returnControl('host_card');
CT.takeBack('guest', 'guest_card');
assert.equal(S.me.zones.hand.length, 1, 'pre-start control changes do not remove cards before sending requests');
const sentBeforeBlockedRequest = sent.length;
CT.hostRecv({ t: 'req', to: 'guest', req: { k: 'give', card: { iid: 'foreign_card' } } }, 'host');
CT.hostRecv({ t: 'req', to: 'guest', req: { k: 'take', iid: 'foreign_card' } }, 'host');
CT.hostRecv({ t: 'req', to: 'guest', req: { k: 'return', zone: 'battlefield', card: { iid: 'foreign_card' } } }, 'host');
assert.equal(sent.length, sentBeforeBlockedRequest, 'host does not forward pre-start battlefield control requests');

assert.equal(CT.canEnterBattlefield(), false, 'Practice also waits for its Start action before battlefield moves');
S.role = 'solo';
assert.equal(CT.insertCard({ iid: 'solo_card', id: 'card', own: 'host', c: {} }, 'battlefield'), false);
const earlyToken = CT.createTokenQuantity({ id: 'token', name: 'Token' });
S.role = 'host';

S.players.host.kept = true; S.players.guest.kept = true; S.players.guest.openingDeal = 'deal-current';
S.me.kept = true;
S.undo = [JSON.stringify({ ...S.me, kept: false })];
CT.tableOp({ k: 'start' }, 'host');
assert.equal(S.table.started, true, 'host can start after every live seat keeps the current deal');
assert.equal(S.undo.filter(entry => entry.kind !== 'checkpoint').length, 0, 'the opening-hand undo actions are cleared when this deal starts');
CT.undo();
assert.equal(S.me.kept, true, 'undo after Start cannot restore the unkept snapshot');
const rollCount = sent.filter(message => message.t === 'firstroll').length;
CT.tableOp({ k: 'start' }, 'host');
assert.equal(sent.filter(message => message.t === 'firstroll').length, rollCount, 'repeated Start does not reroll turn order');

S.table.started = true;
assert.equal(CT.insertCard({ iid: 'after_start', id: 'card', own: 'host', c: {} }, 'battlefield'), true);
assert.equal(S.me.zones.battlefield.length, 1, 'battlefield insertion works after Start');
S.me.kept = false;
CT.keepHand();
assert.equal(S.me.kept, true, 'a player joining after Start can still keep their opening hand');

earlyToken.then(result => {
  assert.equal(result, false, 'token quantity picker rejects creation before prompting');
  console.log('opening readiness and pre-start movement checks passed');
}).catch(error => { console.error(error); process.exitCode = 1; });
