/* Run with Node: node tests/test_moderation.cjs. No packages or browser required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sent = [];
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
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1,
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  Net: { send: msg => sent.push(['all', structuredClone(msg)]), sendTo: (pid, msg) => sent.push([pid, structuredClone(msg)]), stop() {} },
  Deck: { slimDef: d => ({ id: d.id, name: d.name }) },
  UI: { toast() {}, confirm: async () => true, modal: () => ({ el: { querySelector: () => ({}) }, close() {} }) }
});
context.window = context;
context.crypto = { getRandomValues: a => { a.fill(3); return a; } };
context.CTAppearance = { normalizePrefs: x => x || {}, getCustom: () => ({}), boardBackgroundStyle: () => '' };
context.UI.cardBackHTML = () => '';
vm.runInContext(fs.readFileSync(path.join(root, 'js/targeting.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/mulligan.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/player-colors.js'), 'utf8'), context);
let source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
source = source.replace('window.CT = { S,', 'window.CT = { reconcileOpeningDeal, tableOp, cleanTable, cleanPrivateBoard, remapBoardReferences, publicView, savedRoomSession, saveNow, snapFor, authorizeClientMessage, seatKey, loadSession, resume, beginBoardTransfer, handleHostBoardTransfer, handleClientModeration, isModerator, pendingTransfer: () => pendingBoardTransfer, S,');
vm.runInContext(source, context);

const CT = context.CT;
const { S } = CT;
S.pid = 'host'; S.role = 'host'; S.room = 'ABCDE'; S.me = { name: 'Host', zones: {} };
S.table = { room: 'ABCDE', seats: ['host', 'mod', 'member', 'out'], order: ['host', 'mod', 'member', 'out'], active: 'host', turn: 1, turnSeq: 1, phase: 3, started: true, out: { out: true }, hostPid: 'host', mods: ['mod'], kicked: [], handoffs: {} };
S.players = {
  host: { name: 'Host', zones: { battlefield: [], graveyard: [], exile: [] } },
  mod: { name: 'Mod', zones: { battlefield: [], graveyard: [], exile: [] } },
  member: { name: 'Member', zones: { battlefield: [], graveyard: [], exile: [] } },
  out: { name: 'Out', zones: { battlefield: [], graveyard: [], exile: [] } }
};
S.log = []; S.chat = []; S.online = { host: true, mod: true, member: true, out: true };
const clone = x => JSON.parse(JSON.stringify(x));

// Only the host may grant/revoke moderators; an ordinary member cannot invoke moderation.
const beforeGrant = clone(S.table);
CT.tableOp({ k: 'moderator', pid: 'member', enabled: true }, 'member');
assert.deepEqual(clone(S.table), beforeGrant, 'member cannot grant moderator status');
CT.tableOp({ k: 'moderator', pid: 'member', enabled: true }, 'host');
assert.ok(S.table.mods.includes('member'), 'host can grant a seated player');
CT.tableOp({ k: 'moderator', pid: 'member', enabled: false }, 'host');
assert.ok(!S.table.mods.includes('member'), 'host can revoke a moderator');
CT.tableOp({ k: 'moderator', pid: 'host', enabled: true }, 'host');
assert.ok(!S.table.mods.includes('host'), 'host cannot add itself to the mod list');

// Mod can reinstate and kick; a regular member and outsider cannot.
CT.tableOp({ k: 'reinstate', pid: 'out' }, 'member');
assert.equal(S.table.out.out, true, 'member cannot undo concession');
CT.tableOp({ k: 'reinstate', pid: 'out' }, 'intruder');
assert.equal(S.table.out.out, true, 'outsider cannot undo concession');
CT.tableOp({ k: 'reinstate', pid: 'out' }, 'mod');
assert.equal(S.table.out.out, undefined, 'moderator can reinstate conceded player');
CT.tableOp({ k: 'kick', pid: 'member' }, 'member');
assert.ok(S.table.seats.includes('member'), 'member cannot kick');
CT.tableOp({ k: 'kick', pid: 'mod' }, 'intruder');
assert.ok(S.table.seats.includes('mod'), 'outsider cannot kick');
CT.tableOp({ k: 'kick', pid: 'member' }, 'mod');
assert.ok(!S.table.seats.includes('member'));
assert.ok(S.table.kicked.includes('member'), 'kick is persistently blocked');
const sentBeforeKickPub = sent.length;
context.CT.hostRecv({ t: 'pub', p: { name: 'Member', zones: {} } }, 'member');
assert.ok(!S.table.seats.includes('member'), 'a kicked player pub cannot silently reseat them');
assert.equal(sent.length, sentBeforeKickPub + 1, 'kicked player is sent moderation exit');

// Table sanitation keeps authority fields bounded and filters mods to current seats.
const clean = CT.cleanTable({ room: 'ABCDE', seats: ['host', 'mod'], hostPid: 'host', mods: ['mod', 'gone'], kicked: ['gone'], handoffs: { mod: { id: 'h1', source: 'gone' } } });
assert.equal(clean.hostPid, 'host');
assert.deepEqual(clone(clean.mods), ['mod']);
assert.deepEqual(clone(clean.kicked), ['gone']);
assert.equal(clean.handoffs.mod.source, 'gone');

// A private board is validated, re-owned by the recipient, and all owner references remap.
const raw = { pid: 'owner', name: 'Owner', seq: 5, mull: 1, life: 25, poison: 2, ctr: {}, casts: { owner_c4: 2 }, cmdDmg: { 'owner:owner_c4': 4 }, revealTopOnce: 'owner_c3', revealHand: false, defs: { card: { id: 'card', name: 'Card' } }, zones: Object.fromEntries(['battlefield', 'hand', 'library', 'graveyard', 'exile', 'command'].map(z => [z, []])) };
raw.zones.battlefield.push({ iid: 'owner_c1', id: 'card', own: 'owner', att: { p: 'owner', i: 'owner_c1' } });
raw.zones.hand.push({ iid: 'owner_c2', id: 'card', own: 'owner', rvh: true }, { iid: 'owner_c5', id: 'card', own: 'owner' });
raw.zones.library.push({ iid: 'owner_c3', id: 'card' });
raw.zones.command.push({ iid: 'owner_c4', id: 'card', cmd: true });
raw.cmdrs = [{ iid: 'owner_c4', name: 'Card' }];
const privateBoard = CT.cleanPrivateBoard(raw, 'owner', 'recipient');
assert.ok(privateBoard);
assert.equal(privateBoard.pid, 'recipient');
assert.equal(privateBoard.zones.battlefield[0].iid, 'recipient_c1');
assert.equal(privateBoard.zones.battlefield[0].own, 'recipient');
assert.equal(privateBoard.zones.battlefield[0].att.p, 'recipient');
assert.equal(privateBoard.zones.battlefield[0].att.i, 'recipient_c1');
assert.equal(privateBoard.cmdrs[0].iid, 'recipient_c4', 'commander identity follows the new owner prefix');
assert.equal(privateBoard.casts.recipient_c4, 2, 'commander tax follows its rekeyed commander');
assert.equal(privateBoard.cmdDmg['recipient:recipient_c4'], 4, 'commander damage keys remap both owner and card identity');
assert.equal(privateBoard.zones.hand[0].iid, 'recipient_c2');
assert.equal(privateBoard.zones.library[0].iid, 'recipient_c3');
assert.equal(privateBoard.revealTopOnce, 'recipient_c3', 'one-shot library reveal follows the rekeyed top card');
S.me = privateBoard; S.pid = 'recipient';
const transferredPublic = CT.publicView();
assert.deepEqual(clone(transferredPublic.revCards.map(c => c.iid)), ['recipient_c2'], 'partial hand reveal publishes the remapped revealed card only');
assert.equal(transferredPublic.hand, 2, 'partial reveal still publishes the full hidden hand count');
S.pid = 'host'; S.role = 'host'; S.me = { name: 'Host', zones: {} };
assert.equal(CT.cleanPrivateBoard({ ...raw, pid: 'attacker' }, 'owner', 'recipient'), null, 'capture cannot claim a different source');
assert.equal(CT.cleanPrivateBoard({ ...raw, zones: { ...raw.zones, library: [{ iid: '<bad>', id: 'card' }] } }, 'owner', 'recipient'), null, 'malformed hidden cards are rejected');
assert.equal(CT.cleanPrivateBoard({ ...raw, defs: { card: { id: 'another-card', name: 'Card' } } }, 'owner', 'recipient'), null, 'cards cannot reference a mismatched or discarded definition');

// Capture completion must come from the selected live source, and a bad capture aborts.
S.table.seats = ['host', 'mod', 'source', 'recipient']; S.table.mods = ['mod'];
S.players.source = { name: 'Source', zones: { battlefield: [], graveyard: [], exile: [] } };
S.players.recipient = { name: 'Recipient', zones: { battlefield: [], graveyard: [], exile: [] } };
S.online.source = true; S.online.recipient = true; S.online.mod = true;
CT.beginBoardTransfer('source', 'recipient', 'mod');
const handoff = CT.pendingTransfer();
assert.equal(handoff.stage, 'capture');
assert.equal(CT.handleHostBoardTransfer({ t: 'board-captured', id: handoff.id, me: raw }, 'recipient'), true);
assert.equal(handoff.stage, 'capture', 'a non-source cannot provide a live board capture');
assert.deepEqual(clone(S.table.handoffs), {}, 'unverified capture cannot commit ownership');
CT.handleHostBoardTransfer({ t: 'board-captured', id: handoff.id, me: { ...raw, pid: 'forged' } }, 'source');
assert.equal(CT.pendingTransfer(), null, 'invalid source data aborts instead of transferring');
assert.deepEqual(clone(S.table.handoffs), {}, 'invalid private data never changes table ownership');

// The recovery selector only returns a fresh saved session for this room.
const session = { v: 2, at: Date.now(), role: 'client', room: 'ABCDE', me: { name: 'Saved', zones: { hand: [{ iid: 'hidden' }] } } };
storage.setItem('ct.sess.savedpid', JSON.stringify(session));
storage.setItem('ct.sess.otherroom', JSON.stringify({ ...session, room: 'ZZZZZ' }));
assert.equal(CT.savedRoomSession('ABCDE').pid, 'savedpid');
assert.equal(CT.savedRoomSession('NOPE!'), null, 'saved seats are never offered across room codes');
storage.setItem('ct.sess.expired', JSON.stringify({ ...session, at: Date.now() - 25 * 3600 * 1000 }));
assert.notEqual(CT.savedRoomSession('ABCDE').pid, 'expired', 'expired recovery sessions are ignored');

// Remote senders cannot claim host identity, and each client must bind a private seat key on its first public snapshot.
S.pid = 'host'; S.room = 'ABCDE'; S.role = 'host'; S.table.seats.push('authclient');
S.players.authclient = { name: 'Auth client', zones: { battlefield: [], graveyard: [], exile: [] } };
S.seatKeys = {};
assert.equal(CT.authorizeClientMessage({ t: 'op', seatKey: 'a'.repeat(32) }, 'host'), false, 'remote host-id spoof is rejected');
assert.equal(CT.authorizeClientMessage({ t: 'pub' }, 'authclient'), false, 'missing seat key is rejected');
assert.equal(CT.authorizeClientMessage({ t: 'pub', seatKey: 'not-a-key' }, 'authclient'), false, 'malformed seat key is rejected');
assert.equal(CT.authorizeClientMessage({ t: 'op', seatKey: 'a'.repeat(32) }, 'newclient'), false, 'unknown clients cannot send operations before their first public snapshot');
const seatSecret = 'a'.repeat(32); // fixed test fixture only; no generated runtime key is logged
assert.equal(CT.authorizeClientMessage({ t: 'pub', seatKey: seatSecret }, 'authclient'), true, 'initial pub binds the per-seat key');
assert.equal(S.seatKeys.authclient, seatSecret);
const phaseBeforeBadKey = S.table.phase;
assert.equal(CT.authorizeClientMessage({ t: 'op', op: { k: 'phase', v: 6 }, seatKey: 'b'.repeat(32) }, 'authclient'), false, 'wrong key cannot send later operations');
assert.equal(S.table.phase, phaseBeforeBadKey);
const validOp = { t: 'op', op: { k: 'phase', v: 4 }, seatKey: seatSecret };
assert.equal(CT.authorizeClientMessage(validOp, 'authclient'), true, 'correct bound key authenticates later operations');
CT.hostRecv(validOp, 'authclient');
assert.equal(S.table.phase, 4, 'an authenticated later operation reaches the host table');
CT.saveNow();
assert.equal(JSON.parse(data['ct.sess.host']).seatKeys.authclient, seatSecret, 'host session persists the private seat-key map');
assert.equal(Object.hasOwn(CT.snapFor(), 'seatKeys'), false, 'private seat keys are not included in public join snapshots');

// A saved kept hand from an earlier game must adopt a host-confirmed new deal
// even if this browser missed the one-time newgame broadcast.
const openingDeck = { name: 'Opening fixture', cards: [{ def: { id: 'land', name: 'Island', type: 'Basic Land — Island' }, qty: 20 }], commanders: [], tokens: [] };
context.Deck.get = () => openingDeck;
context.Deck.buildLibrary = deck => deck.cards.flatMap(r => Array.from({ length: r.qty }, () => r.def));
context.CTAppearance.getPrefs = () => ({});
S.me = clone(privateBoard); S.me.kept = true; S.me.openingDeal = 'old-deal';
S.me.layout = [{ k: 'creatures', x: 0, y: 0, w: 1000, h: 300 }];
CT.reconcileOpeningDeal({ openingMode: 'london', openingDeal: 'new-deal' });
assert.equal(S.me.openingDeal, 'new-deal', 'new deal survives a missed newgame event for a kept player');
assert.equal(S.me.kept, false, 'new hand needs its own keep decision');
assert.equal(S.me.zones.battlefield.length, 0, 'previous-game battlefield cannot survive a confirmed new deal');
const currentHand = S.me.zones.hand.map(c => c.iid).join(','); S.me.kept = true;
CT.reconcileOpeningDeal({ openingMode: 'london', openingDeal: 'new-deal' });
assert.equal(S.me.zones.hand.map(c => c.iid).join(','), currentHand, 'same-deal snapshots leave a kept hand untouched');

// Authenticate an initial public snapshot before color admission, without adding a
// duplicate or reserving a color until the authoritative choice succeeds.
S.pid = 'host'; S.role = 'host'; S.table = { room: 'ABCDE', seats: ['host'], order: [], active: null, turn: 0, turnSeq: 0, phase: 3, started: false, out: {}, hostPid: 'host', mods: [], kicked: [], handoffs: {}, colorVersion: 1, colors: { host: 'red' } };
S.players = { host: { name: 'Host' } }; S.pendingSeats = {}; S.online = { host: true, newcomer: true };
const candidate = clone(transferredPublic); candidate.name = 'New player'; candidate.zones.battlefield = []; candidate.zones.graveyard = []; candidate.zones.exile = [];
CT.hostRecv({ t: 'pub', p: candidate }, 'newcomer');
assert.equal(S.table.seats.includes('newcomer'), false, 'a new player chooses before being seated');
assert.equal(S.pendingSeats.newcomer.selectingColor, true);
CT.tableOp({ k: 'joincolor', color: 'blue' }, 'outsider');
assert.equal(S.table.seats.includes('outsider'), false, 'unregistered color claims cannot create a seat');
CT.tableOp({ k: 'joincolor', color: 'red' }, 'newcomer');
assert.equal(S.table.seats.includes('newcomer'), false, 'taken colors leave the entry pending');
CT.tableOp({ k: 'joincolor', color: 'blue' }, 'newcomer');
assert.equal(S.table.colors.newcomer, 'blue');
assert.equal(S.pendingSeats.newcomer, undefined);
CT.hostRecv({ t: 'pub', p: candidate }, 'duplicate');
assert.equal(S.pendingSeats.duplicate.claimSource, 'newcomer');
CT.tableOp({ k: 'joincolor', color: 'green' }, 'duplicate');
assert.equal(S.table.seats.includes('duplicate'), false, 'same-name recovery candidates cannot bypass approval by choosing a color');

console.log('PASS moderation: host/mod/member authorization, concession restore, persistent kick block, sanitized authority state, private board validation/remap, capture sender checks and room-scoped recovery lookup');
