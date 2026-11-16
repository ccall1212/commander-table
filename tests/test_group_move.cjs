/* Selected battlefield cards use every Move to menu action together, with one Undo.
 * Shuffle-then-bottom first shuffles the existing library, then appends chosen cards. No browser or packages required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const data = Object.create(null);
const storage = {
  getItem: k => data[k] || null,
  setItem: (k, v) => { data[k] = String(v); },
  removeItem: k => { delete data[k]; }
};
let menu = [];
const sent = [];
const toasts = [];
let viewer = null;
const context = vm.createContext({
  console, URL, URLSearchParams, Set, Map, Uint32Array, performance,
  innerWidth: 1200, innerHeight: 900,
  location: { search: '?nettest', protocol: 'http:', href: 'http://localhost/?nettest' },
  document: { querySelector: () => null, querySelectorAll: () => [], body: { classList: { toggle() {} } } },
  localStorage: storage, sessionStorage: storage,
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1,
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  Peer: function Peer() {},
  Net: { send: msg => sent.push(msg), sendTo() {}, stop() {}, state: () => 'online' },
  Deck: { slimDef: d => d, get: () => null, save() {}, list: () => [] },
  UI: { toast: text => toasts.push(text), menu: (_x, _y, items) => { menu = items; },
    viewer: opts => { viewer = opts; return { update() {}, close() {} }; }, cardBackHTML: () => '' },
  CTHotkeys: { key: () => '' }
});
context.window = context;
// Force a visible permutation of the existing library without relying on chance.
context.crypto = { getRandomValues: a => { a.fill(0); return a; } };
context.CTAppearance = { normalizePrefs: x => x || {}, getCustom: () => ({}), boardBackgroundStyle: () => '' };
for (const file of ['mulligan.js', 'player-colors.js', 'targeting.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
}
let source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const commit = 'function commit() { publish(); saveSoon(); render(); }';
assert.equal(source.split(commit).length, 2, 'commit test anchor is unique');
source = source.replace(commit, 'function commit() {}'); // keep movement/Undo logic; omit DOM rendering in this unit harness
const exportAnchor = 'window.CT = { S,';
assert.equal(source.split(exportAnchor).length, 2, 'test export anchor is unique');
source = source.replace(exportAnchor, 'window.CT = { S, runMove, cardMenu, viewZone,');
vm.runInContext(source, context);

const { S, runMove, cardMenu, viewZone } = context.CT;
const ids = ['a', 'b', 'c', 'outside'];
function reset() {
  S.pid = 'me'; S.role = 'client'; S.net = { state: 'online' };
  S.table = { room: 'TEST', openingDeal: 'test', started: true, turn: 1, turnSeq: 1, active: 'me', phase: 3, seats: ['me'], out: {} };
  S.me = {
    pid: 'me', name: 'Me', defs: Object.fromEntries([...ids, 'old1', 'old2'].map(id => [id, { id, name: id, type: 'Creature' }])),
    casts: {}, zones: {
      library: ['old1', 'old2'].map(id => ({ iid: id, id, own: 'me', c: {} })),
      hand: [], battlefield: ids.map(id => ({ iid: id, id, own: 'me', c: {}, x: 100, y: 100 })),
      graveyard: [], exile: [], command: []
    }
  };
  S.players = { me: { name: 'Me' } };
  S.selected = new Set(ids.slice(0, 3)); S.undo = []; S.viewers = new Set();
  menu = []; viewer = null; sent.length = 0; toasts.length = 0;
}
const zoneIds = zone => S.me.zones[zone].map(c => c.iid);
for (const [key, zone] of [['hand', 'hand'], ['graveyard', 'graveyard'], ['exile', 'exile'],
  ['top', 'library'], ['bottom', 'library'], ['command', 'command']]) {
  reset();
  runMove(key, 'a');
  assert.equal(S.me.zones[zone].filter(c => ['a', 'b', 'c'].includes(c.iid)).length, 3, `${key} moved every selected card`);
  assert.deepEqual(zoneIds('battlefield'), ['outside'], `${key} left an unselected card alone`);
  assert.equal(S.undo.length, 1, `${key} is one Undo step`);
  const before = JSON.parse(S.undo[0].state);
  assert.equal(before.zones.battlefield.length, 4, `${key} Undo snapshot contains all four cards`);
}

reset();
cardMenu(100, 100, 'a');
const moves = menu.find(item => item.label === 'Move to');
assert(moves && moves.sub.some(item => item.label === 'Shuffle library, then put on bottom'), 'card menu offers shuffle-then-bottom');
moves.sub.find(item => item.label === 'Shuffle library, then put on bottom').onClick();
assert.deepEqual(zoneIds('library'), ['old2', 'old1', 'a', 'b', 'c'], 'the old library was shuffled first; selected cards were appended afterward');
assert.deepEqual(zoneIds('battlefield'), ['outside']);
assert.equal(S.undo.length, 1, 'shuffle-then-bottom is one Undo step');
assert.deepEqual(JSON.parse(S.undo[0].state).zones.library.map(c => c.iid), ['old1', 'old2'], 'Undo restores the original library order');
assert.deepEqual(sent.filter(m => m.t === 'log').map(m => m.text),
  ['shuffled their library, then put 3 cards on the bottom'], 'the log describes the right order of operations');

for (const zone of ['graveyard', 'exile']) {
  reset();
  S.me.zones[zone].push(S.me.zones.battlefield.shift());
  cardMenu(100, 100, 'a');
  assert(menu.find(item => item.label === 'Move to').sub.some(item => item.label === 'Shuffle library, then put on bottom'),
    `${zone} card right-click menu offers shuffle-then-bottom`);
  viewZone('me', zone);
  const action = viewer.actions.find(a => a.key === 'shufflebottom');
  assert(action, `${zone} viewer offers shuffle-then-bottom for a card`);
  viewer.onAction('shufflebottom', 'a');
  assert.deepEqual(zoneIds('library'), ['old2', 'old1', 'a'], `${zone} card goes under the shuffled library`);
  assert.equal(S.undo.length, 1, `${zone} action is one Undo step`);
}

reset();
viewZone('me', 'library');
assert(viewer.actions.some(a => a.key === 'shufflebottom'), 'a chosen library card can use shuffle-then-bottom too');
viewer.onAction('shufflebottom', 'old1');
assert.deepEqual(zoneIds('library'), ['old2', 'old1'], 'a chosen library card is put on bottom after the shuffle');
assert.equal(S.undo.length, 1);

reset();
S.me.zones.battlefield[0].own = 'other';
runMove('shufflebottom', 'a');
assert.deepEqual(zoneIds('library'), ['old1', 'old2'], 'another owner\'s card does not shuffle the wrong library');
assert.match(toasts[0], /Only the card owner can shuffle/);

reset();
runMove('graveyard', 'outside');
assert.deepEqual(zoneIds('battlefield'), ['a', 'b', 'c'], 'acting on an unselected card leaves the group alone');
assert.deepEqual(zoneIds('graveyard'), ['outside']);

console.log('PASS group Move to: one Undo for selected cards; shuffle library first, then put chosen battlefield/graveyard/exile cards on its bottom');
