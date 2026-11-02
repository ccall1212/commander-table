/* Run with Node: node tests/test_share_hand.cjs. No packages or browser required.
 * Share my hand with one player: what the sender sends (and does not put in the public view), what the host
 * forwards, and what the receiving player accepts and shows. The screens are checked in a real browser
 * (tests/test_share_hand_browser.cjs). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sent = [];         // everything sent through Net: [target, message]; target is 'all' for a broadcast
const timers = [];
const toasts = [];
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
  document: { querySelector: sel => sel === '#game' ? { classList: { contains: () => true } } : null, querySelectorAll: () => [], body: { classList: { toggle() {} } } }, // the game screen counts as hidden
  localStorage, sessionStorage: storage,
  setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval: () => 1,
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  Net: { send: msg => sent.push(['all', structuredClone(msg)]), sendTo: (pid, msg) => sent.push([pid, structuredClone(msg)]), drop() {}, stop() {}, adminPresence() {}, state: () => 'online' },
  Deck: { slimDef: d => ({ id: d.id, name: d.name, type: d.type, img: d.img }) },
  UI: { toast: (t) => toasts.push(t), confirm: async () => true, modal: () => ({ el: { querySelector: () => ({}) }, close() {} }), cardBackHTML: () => '' }
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
source = source.replace(marker, 'window.CT = { setShare, toggleShareCard, syncShare, publicView, cleanPeek, viewOf, hostRecv, onReq, doPublish, findCard, moveCard, shareTarget, S,');
vm.runInContext(source, context);

const CT = context.CT, { S } = CT;
const plain = v => JSON.parse(JSON.stringify(v));
const reset = () => { sent.length = 0; timers.length = 0; toasts.length = 0; };
const flush = () => { while (timers.length) timers.shift()(); };
const peeksTo = pid => sent.filter(([to, m]) => to === pid && m.t === 'req' && m.req.k === 'peek').map(([, m]) => m.req);
const viaHost = () => sent.filter(([to, m]) => to === 'all' && m.t === 'req' && m.req.k === 'peek').map(([, m]) => m);
const names = ['Secret Alpha', 'Secret Beta', 'Secret Gamma'];
const mkCard = (n, id) => ({ iid: 'son_' + n, id, own: 'son', t: false, fl: false, fd: false, c: {} });
const mkDef = (id, name) => ({ id, name, type: 'Creature', img: '' });

// ---------- The sender: "son" is a guest at a table with "dad" (host) and "mom" ----------
S.pid = 'son'; S.role = 'client'; S.room = 'ABCDE';
S.table = plain({ room: 'ABCDE', seats: ['dad', 'son', 'mom'], order: ['dad', 'son', 'mom'], hostPid: 'dad', started: true, phase: 3, turn: 1, turnSeq: 1, out: {}, colors: {} });
S.players = { dad: { name: 'Dad', hand: 7, zones: {} }, son: { name: 'Son', zones: {} }, mom: { name: 'Mom', hand: 7, zones: {} } };
S.online = { dad: true, son: true, mom: true }; S.log = []; S.chat = [];
S.me = { pid: 'son', name: 'Son', life: 40, poison: 0, ctr: {}, cmdDmg: {}, casts: {}, mull: 0, kept: true, defs: {}, cmdrs: [], tokens: [], appearance: {}, revealHand: false, revealTop: false, bh: 560, layoutAuto: true,
  layout: [{ k: 'creatures', label: 'Creatures', x: 0, y: 0, w: 1000, h: 170 }, { k: 'lands', label: 'Lands', x: 0, y: 180, w: 540, h: 250 }, { k: 'permanents', label: 'Permanents', x: 550, y: 180, w: 450, h: 250 }],
  zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [] } };
names.forEach((n, i) => { S.me.defs['d' + i] = mkDef('d' + i, n); S.me.zones.hand.push(mkCard(i + 1, 'd' + i)); });
S.me.zones.library.push(mkCard(9, 'd0'));

// The public view never carries the hand, even while it is being shared.
let pub = JSON.stringify(CT.publicView());
for (const n of names) assert.ok(!pub.includes(n), 'before sharing: the public view does not contain ' + n);

// ---- Share the whole hand with dad ----
reset();
CT.setShare('dad', true); flush();
assert.equal(S.me.shareTo, 'dad'); assert.equal(S.me.shareAll, true);
let to = viaHost();
assert.equal(to.length, 1, 'one private message was sent');
assert.equal(to[0].to, 'dad', 'addressed to dad only');
assert.equal(to[0].req.p.all, true); assert.equal(to[0].req.p.cards.length, 3, 'all three cards are in it');
assert.deepEqual(plain(to[0].req.p.cards.map(c => S.me.defs[c.id].name)), names, 'with their identities, in hand order');
assert.equal(to[0].req.p.hand, 3);
pub = JSON.stringify(sent.filter(([, m]) => m.t === 'pub'));
for (const n of names) assert.ok(!pub.includes(n), 'while sharing: the public view still does not contain ' + n);
const logged = JSON.stringify(sent.filter(([, m]) => m.t === 'log'));
assert.match(logged, /showing their whole hand to Dad/, 'everyone can see in the log that something is being shown, and to whom');
for (const n of names) assert.ok(!logged.includes(n), 'but the log never names a card');
assert.ok(!JSON.stringify(sent.filter(([, m]) => m.t !== 'req')).includes('Secret'), 'no message other than the private one mentions a card');

// ---- No change, no message ----
reset(); CT.doPublish(); assert.equal(viaHost().length, 0, 'nothing is re-sent when nothing changed');

// ---- Drawing a card updates what dad sees ----
reset();
S.me.defs.d3 = mkDef('d3', 'Secret Delta'); S.me.zones.hand.push(mkCard(4, 'd3')); CT.doPublish();
to = viaHost(); assert.equal(to.length, 1, 'a draw sends the update'); assert.equal(to[0].req.p.cards.length, 4);

// ---- Switch to "only the cards I pick" ----
reset(); CT.setShare('dad', false); flush();
to = viaHost(); assert.equal(to.at(-1).req.p.all, false); assert.equal(to.at(-1).req.p.cards.length, 0, 'nothing is shown until cards are picked');
reset(); CT.toggleShareCard('son_2'); flush();
to = viaHost(); assert.equal(to.at(-1).req.p.cards.length, 1); assert.equal(S.me.defs[to.at(-1).req.p.cards[0].id].name, 'Secret Beta');
assert.equal(to.at(-1).req.p.cards[0].hIndex, 1, 'with its place in the hand');
assert.match(JSON.stringify(sent.filter(([, m]) => m.t === 'log')), /showed a card from their hand to Dad/);
assert.ok(!JSON.stringify(sent.filter(([, m]) => m.t === 'log')).includes('Secret'), 'the log does not say which card');
reset(); CT.toggleShareCard('son_9'); flush(); assert.equal(viaHost().length, 0, 'a card that is not in the hand cannot be shown');

// ---- A card that leaves the hand stops being shown ----
reset(); CT.moveCard('son_2', 'battlefield'); CT.doPublish();
assert.ok(!('rvp' in S.me.zones.battlefield[0]), 'the show flag is gone once the card is played');
to = viaHost(); assert.equal(to.at(-1).req.p.cards.length, 0, 'dad is no longer shown it');

// ---- Switch to mom: dad is told to stop, mom is shown ----
reset(); CT.toggleShareCard('son_1'); flush(); reset();
CT.setShare('mom', false); flush();
assert.ok(viaHost().some(m => m.to === 'dad' && m.req.off === true), 'dad is told to stop showing');
const toMom = viaHost().filter(m => m.to === 'mom'); assert.equal(toMom.length, 1, 'mom is sent the picked card'); assert.equal(toMom[0].req.p.cards.length, 1);
assert.match(JSON.stringify(sent.filter(([, m]) => m.t === 'log')), /stopped showing their hand to Dad and started showing chosen cards from their hand to Mom/);

// ---- Recipient goes offline and comes back: they are sent it again ----
reset(); S.online.mom = false; CT.doPublish(); assert.equal(viaHost().length, 0, 'nothing is sent to someone who is offline');
S.online.mom = true; CT.doPublish(); assert.equal(viaHost().filter(m => m.to === 'mom').length, 1, 'when they return they are sent it again');

// ---- Stop sharing ----
reset(); CT.setShare('', false); flush();
assert.equal(S.me.shareTo, ''); assert.ok(viaHost().some(m => m.to === 'mom' && m.req.off === true), 'mom is told to stop');
assert.ok(S.me.zones.hand.every(c => !('rvp' in c)), 'the picked-card flags are cleared');
reset(); CT.doPublish(); assert.equal(viaHost().length, 0, 'and nothing more is sent');
reset(); CT.setShare('son', true); assert.equal(S.me.shareTo, '', 'you cannot share with yourself'); CT.setShare('nobody-here', true); assert.equal(S.me.shareTo, '', 'or with someone who is not seated');

// ---- The person leaves the table ----
CT.setShare('dad', true); flush(); reset();
S.table.seats = ['son', 'mom']; CT.doPublish();
assert.equal(S.me.shareTo, '', 'sharing stops when they leave'); assert.match(toasts.join(' '), /Dad is no longer at the table/);

// ---------- The host forwards a private message to its one recipient only ----------
S.pid = 'dad'; S.role = 'host'; S.me = null;
S.table = plain({ room: 'ABCDE', seats: ['dad', 'son', 'mom'], order: ['dad', 'son', 'mom'], hostPid: 'dad', started: true, phase: 3, out: {}, colors: {} });
S.admitted = new Set(['son', 'mom']);
const peekReq = { k: 'peek', p: { all: true, hand: 1, cards: [], defs: {} } };
reset(); CT.hostRecv({ t: 'req', to: 'mom', req: peekReq }, 'son');
assert.deepEqual(plain(sent), [['mom', { t: 'req', from: 'son', req: peekReq }]], 'forwarded to mom and nobody else (no broadcast)');
reset(); CT.hostRecv({ t: 'req', to: 'son', req: peekReq }, 'son'); assert.equal(sent.length, 0, 'not to yourself');
reset(); CT.hostRecv({ t: 'req', to: 'ghost', req: peekReq }, 'son'); assert.equal(sent.length, 0, 'not to someone who is not seated');
S.admitted.add('ghost'); reset(); CT.hostRecv({ t: 'req', to: 'mom', req: peekReq }, 'ghost'); assert.equal(sent.length, 0, 'not from someone who is not seated');

// ---------- The receiver: "dad" accepts only well-formed data from a seated player ----------
S.pid = 'dad'; S.role = 'client'; S.peeks = {};
S.me = { pid: 'dad', name: 'Dad', defs: {}, zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [] }, cmdrs: [], ctr: {}, cmdDmg: {}, casts: {} };
S.players = { son: { pid: 'son', name: 'Son', hand: 3, zones: { battlefield: [], graveyard: [], exile: [], command: [] }, defs: {}, revHand: null, revCards: [] } };
const card = (n, id, extra = {}) => Object.assign({ iid: 'son_' + n, id, own: 'son', t: 0, fl: 0, c: {}, tok: 0 }, extra);
const defs = { d0: mkDef('d0', 'Secret Alpha'), d1: mkDef('d1', 'Secret Beta'), d2: mkDef('d2', 'Secret Gamma') };
CT.onReq({ k: 'peek', p: { all: true, hand: 3, cards: [card(1, 'd0'), card(2, 'd1'), card(3, 'd2')], defs } }, 'son');
assert.ok(S.peeks.son, 'a whole-hand share is accepted');
let v = CT.viewOf('son');
assert.equal(v.privateReveal, true); assert.equal(v.revHand.length, 3, 'the whole hand shows face up');
assert.equal(v.defs.d1.name, 'Secret Beta', 'with the card details');
assert.equal(S.players.son.revHand, null, 'but the shared public information is untouched');
assert.equal(JSON.stringify(S.players).includes('Secret'), false, 'and holds none of it');
// partial shares merge with what is public, by place in the hand
CT.onReq({ k: 'peek', p: { all: false, hand: 3, cards: [card(2, 'd1', { hIndex: 1 })], defs } }, 'son');
v = CT.viewOf('son'); assert.equal(v.revCards.length, 1); assert.equal(v.revCards[0].hIndex, 1); assert.equal(v.revHand, null);
S.players.son.revCards = [card(1, 'd0', { hIndex: 0 })];
v = CT.viewOf('son'); assert.deepEqual(plain(v.revCards.map(c => c.hIndex).sort()), [0, 1], 'cards revealed to everyone and cards shown to me both appear');
// a hand revealed to everyone already shows in full
S.players.son.revHand = [card(1, 'd0'), card(2, 'd1'), card(3, 'd2')];
assert.equal(CT.viewOf('son').privateReveal, undefined, 'when the whole hand is already public nothing changes');
S.players.son.revHand = null; S.players.son.revCards = [];
// bad data
const keep = JSON.stringify(plain(S.peeks.son));
CT.onReq({ k: 'peek', p: { all: false, hand: 3, cards: [card(1, 'd0', { hIndex: 0 })], defs } }, 'mom'); // mom is not seated at this table here
S.table.seats = ['dad', 'son', 'mom'];
CT.onReq({ k: 'peek', p: { all: true, hand: 1, cards: [{ iid: 'mom_5', id: 'd0' }], defs } }, 'son');
assert.equal(CT.viewOf('son').revHand.filter(c => c.iid.startsWith('mom_')).length, 0, 'a card that is not the sender\'s own is dropped');
CT.onReq({ k: 'peek', p: { all: false, hand: 3, cards: [card(2, 'd1', { hIndex: 7 })], defs } }, 'son');
assert.equal(CT.viewOf('son').revCards.length, 0, 'a place outside the hand is dropped');
CT.onReq({ k: 'peek', p: { all: true, hand: 99, cards: Array.from({ length: 200 }, (_, i) => card(i, 'd0')), defs } }, 'son');
assert.ok(CT.viewOf('son').revHand.length <= 60, 'at most 60 cards are accepted');
CT.onReq({ k: 'peek', p: 'garbage' }, 'son'); CT.onReq({ k: 'peek' }, 'son');
CT.onReq({ k: 'peek', p: { all: true, hand: 1, cards: [card(1, 'd0')], defs } }, 'dad'); assert.ok(!S.peeks.dad, 'cannot show yourself yourself');
CT.onReq({ k: 'peek', p: { all: true, hand: 1, cards: [card(1, 'd0')], defs } }, 'ghost'); assert.ok(!S.peeks.ghost, 'nothing is kept from someone who is not seated');
// stop
CT.onReq({ k: 'peek', off: true }, 'son'); assert.ok(!S.peeks.son, 'the sender can stop showing');
assert.equal(CT.viewOf('son').privateReveal, undefined);
// they leave: what was shown no longer appears
CT.onReq({ k: 'peek', p: { all: true, hand: 1, cards: [card(1, 'd0')], defs } }, 'son');
S.table.seats = ['dad', 'mom']; assert.equal(CT.viewOf('son').privateReveal, undefined, 'it disappears when they leave the table');

console.log('PASS share hand: only the chosen player is sent the cards, the public view and log never contain them, updates on draw/play/switch/stop/reconnect, host forwards to one seated player, receiver validates and merges without touching shared state');
