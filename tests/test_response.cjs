/* In-response cue authorization, repeat, shortcut and transient-state checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sent = [], notices = [], timers = new Map();
let timerId = 0, modal = false;
const slot = { firstElementChild: null, replaceChildren(...nodes) { this.firstElementChild = nodes[0] || null; } };
const game = { classList: { contains: () => false } };
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const node = () => ({ dataset: {}, children: [], append(...children) { this.children.push(...children); } });
const context = vm.createContext({ console, URL, URLSearchParams, Set, Map, Uint32Array, performance,
  innerWidth: 1920, innerHeight: 1080,
  location: { search: '?nettest', protocol: 'http:', href: 'http://localhost/?nettest' },
  document: { querySelector: s => s === '#responseNotice' ? slot : s === '#game' ? game : s === '.w-backdrop' && modal ? {} : null,
    querySelectorAll: () => [], createElement: node, body: { classList: { toggle() {} } } },
  localStorage: storage, sessionStorage: storage,
  setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id), setInterval: () => 1,
  requestAnimationFrame: () => 1,
  Net: { send: msg => sent.push(structuredClone(msg)), sendTo() {} },
  UI: { toast: msg => notices.push(msg) }
});
context.window = context; context.crypto = { getRandomValues: a => { a.fill(3); return a; } };
for (const file of ['targeting', 'mulligan', 'player-colors']) vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), 'utf8'), context);
let source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
source = source.replace('window.CT = { S,', 'window.CT = { sendResponse, showResponseNotice, clearResponseNotice, onKey, seedTurnNotice, resetForNewGame, snapFor, S,');
vm.runInContext(source, context);
const CT = context.CT, S = CT.S;
S.pid = 'host'; S.role = 'host'; S.room = 'CUE01'; S.net = { state: 'online' };
S.me = { pid: 'host', name: 'Host', openingDeal: 'deal', zones: { hand: [{ id: 'private-card' }] } };
S.table = { room: 'CUE01', started: true, openingDeal: 'deal', seats: ['host', 'guest'], out: {}, active: 'host', turn: 1, turnSeq: 1, phase: 3 };
S.players = { host: { name: 'Host' }, guest: { name: '<Guest & friend>' } };
S.log = []; S.undo = [{ state: 'existing history' }];
const before = JSON.stringify({ me: S.me, table: S.table, players: S.players, undo: S.undo, log: S.log });
CT.hostRecv({ t: 'response', deal: 'deal', pid: 'host', name: 'forged' }, 'guest');
assert.equal(sent.length, 1); assert.equal(sent[0].pid, 'guest');
assert.deepEqual(Object.keys(sent[0]).sort(), ['deal', 'id', 'name', 'pid', 't'], 'broadcast contains only public cue metadata');
assert.equal(sent[0].name, '<Guest & friend>', 'host uses the seated sender name, not supplied identity');
const first = slot.firstElementChild;
assert.ok(first); assert.equal(first.children[0].textContent, 'IN RESPONSE!');
assert.equal(first.children[1].textContent, '<Guest & friend>', 'name is rendered as text, never markup');
const staleTimer = [...timers.values()].at(-1);
CT.hostRecv({ t: 'response', deal: 'deal' }, 'guest');
const second = slot.firstElementChild;
assert.notEqual(first, second, 'a second press replaces the element to restart animation');
assert.notEqual(sent[0].id, sent[1].id);
assert.equal(timers.size, 1, 'repeated cues replace the fade timer instead of accumulating a queue');
staleTimer(); assert.equal(slot.firstElementChild, second, 'older fade callback cannot erase a newer cue');
CT.showResponseNotice(sent[1]); assert.equal(slot.firstElementChild, second, 'duplicate event cannot replay');
for (const [sender, deal] of [['outsider', 'deal'], ['guest', 'old']]) CT.hostRecv({ t: 'response', deal }, sender);
S.table.out.guest = true; CT.hostRecv({ t: 'response', deal: 'deal' }, 'guest'); delete S.table.out.guest;
S.table.started = false; CT.hostRecv({ t: 'response', deal: 'deal' }, 'guest'); S.table.started = true;
assert.equal(sent.length, 2, 'unseated, conceded, old-deal and pre-game cues are rejected');
assert.equal(JSON.stringify({ me: S.me, table: S.table, players: S.players, undo: S.undo, log: S.log }), before,
  'cue does not change cards, turn, player data, Undo history or log');
const snap = CT.snapFor(); assert.equal('response' in snap, false, 'joining snapshot never replays a cue');
[...timers.values()].at(-1)(); assert.equal(slot.firstElementChild, null, 'cue fades out');

S.role = 'client'; S.pid = 'guest';
let count = sent.length;
CT.sendResponse(); assert.equal(sent.length, ++count); assert.equal(sent.at(-1).deal, 'deal');
assert.match(sent.at(-1).seatKey, /^[a-f0-9]{32}$/, 'request uses the normal seat authentication');
S.net.state = 'offline'; CT.sendResponse(); assert.equal(sent.length, count, 'offline button/shortcut never sends');
S.net.state = 'online'; S.table.out.guest = true; CT.sendResponse(); assert.equal(sent.length, count); delete S.table.out.guest;
S.role = 'solo'; S.pid = 'host'; S.net.state = 'offline'; CT.sendResponse();
assert.ok(slot.firstElementChild, 'Practice goes through host validation and shows the cue locally');
CT.clearResponseNotice(); assert.equal(slot.firstElementChild, null);

S.role = 'client'; S.pid = 'guest'; S.net.state = 'online';
const target = blocked => ({ closest: selector => blocked && selector.includes(blocked) ? {} : null });
function key(props = {}, blocked = '') {
  const event = { key: 'r', code: 'KeyR', target: target(blocked), preventDefault() { this.prevented = true; }, ...props };
  CT.onKey(event); return event;
}
count = sent.length;
assert.equal(key().prevented, true); key(); assert.equal(sent.length, count + 2, 'each distinct R press sends');
count = sent.length;
key({ repeat: true }); key({ ctrlKey: true }); key({ metaKey: true }); key({ altKey: true });
for (const blocked of ['input', 'textarea', 'select', '[contenteditable]', '#chatPanel']) key({}, blocked);
modal = true; key(); modal = false;
assert.equal(sent.length, count, 'held keys, browser modifiers, text/chat fields and dialogs are ignored');
CT.showResponseNotice({ t: 'response', pid: 'host', name: 'Host', deal: 'deal', id: 'reset-test' });
CT.seedTurnNotice(S.table); assert.equal(slot.firstElementChild, null, 'resume/snapshot seeding clears transient cues');
CT.showResponseNotice({ t: 'response', pid: 'host', name: 'Host', deal: 'deal', id: 'reset-test2' });
CT.resetForNewGame(); assert.equal(slot.firstElementChild, null, 'New Game clears a visible cue');
console.log('PASS response cue: host identity/seat/deal guards, repeat replay, fade/dedup, no state/history/log changes, authenticated send, Practice, shortcut/focus/modifier guards, reset');
