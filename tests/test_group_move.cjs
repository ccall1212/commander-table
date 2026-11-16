/* Selected battlefield cards use every Move to menu action together, with one Undo.
 * The shuffled-bottom action randomizes only the selected group. No browser or packages required. */
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
  UI: { toast() {}, menu: (_x, _y, items) => { menu = items; }, cardBackHTML: () => '' },
  CTHotkeys: { key: () => '' }
});
context.window = context;
// Force a visible permutation in the three-card shuffle without relying on chance.
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
source = source.replace(exportAnchor, 'window.CT = { S, runMove, cardMenu,');
vm.runInContext(source, context);

const { S, runMove, cardMenu } = context.CT;
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
  S.selected = new Set(ids.slice(0, 3)); S.undo = [];
  menu = []; sent.length = 0;
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
assert(moves && moves.sub.some(item => item.label === 'Shuffle selected cards to library bottom'), 'group menu offers shuffled-bottom placement');
moves.sub.find(item => item.label === 'Shuffle selected cards to library bottom').onClick();
assert.deepEqual(zoneIds('library'), ['old1', 'old2', 'b', 'c', 'a'], 'only the selected group is shuffled and appended after the existing library');
assert.deepEqual(zoneIds('battlefield'), ['outside']);
assert.equal(S.undo.length, 1, 'shuffled-bottom placement is one Undo step');
assert.deepEqual(sent.filter(m => m.t === 'log').map(m => m.text),
  ['put 3 selected cards on the bottoms of their libraries in random order'],
  'the game log does not reveal the random order of the cards');

reset();
runMove('graveyard', 'outside');
assert.deepEqual(zoneIds('battlefield'), ['a', 'b', 'c'], 'acting on an unselected card leaves the group alone');
assert.deepEqual(zoneIds('graveyard'), ['outside']);

console.log('PASS group Move to: all selected cards move together with one Undo; only the selected group is shuffled onto the library bottom');
