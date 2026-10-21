/* Personal history boundaries and restoration. Run with Node; no packages required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sent = [], notices = [];
let confirm;
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const context = vm.createContext({ console, URL, URLSearchParams, Set, Map, Uint32Array, performance,
  innerWidth: 1920, innerHeight: 1080,
  location: { search: '?nettest', protocol: 'http:', href: 'http://localhost/?nettest' },
  document: { querySelector: () => null, querySelectorAll: () => [] },
  localStorage: storage, sessionStorage: storage,
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, requestAnimationFrame: () => 1,
  Net: { send: msg => sent.push(msg), sendTo() {} },
  Deck: { slimDef: d => d },
  UI: { toast: msg => notices.push(msg), confirm: () => new Promise(resolve => { confirm = resolve; }) }
});
context.window = context;
context.crypto = { getRandomValues: a => { a.fill(3); return a; } };
context.CTAppearance = { normalizePrefs: x => x || {} };
for (const file of ['targeting', 'mulligan', 'player-colors']) vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), 'utf8'), context);
let source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
source = source.replace('window.CT = { S,', 'window.CT = { undo, restorePersonalEntry, choosePersonalEntry, savePersonalCheckpoint, pushUndo, clearUndo, preparePersonalHistory, recordPhaseCheckpoint, onReq, giveControl, returnControl, moveCard, createToken, afterTable, S,');
vm.runInContext(source, context);
const CT = context.CT, S = CT.S;
const clone = x => JSON.parse(JSON.stringify(x));
const card = (iid, own = 'me') => ({ iid, own, id: 'd', t: false, c: {}, x: 20, y: 40 });
function reset() {
  S.pid = 'me'; S.role = 'client'; S.room = 'UNDO1'; S.undo = []; S.selected.clear();
  S.table = { room: 'UNDO1', seats: ['me', 'other'], out: {}, started: true, openingDeal: 'deal', turn: 1, turnSeq: 1, phase: 3, active: 'me', order: ['me', 'other'] };
  S.me = { pid: 'me', name: 'Me', seq: 2, life: 40, poison: 0, mull: 0, kept: true, lastTurn: 1, lastTurnSeq: 1, autoDraw: false, autoUntap: false,
    layout: [{ k: 'creatures', x: 0, y: 0, w: 1000, h: 430 }], ctr: {}, cmdDmg: {}, casts: {}, defs: { d: { id: 'd', name: 'Test Card', type: 'Creature' } },
    zones: { battlefield: [card('me_1')], library: [card('me_2')], hand: [], command: [], exile: [], graveyard: [] } };
  S.players = { other: { name: 'Other', life: 40, zones: { battlefield: [] } } };
  CT.preparePersonalHistory();
}
(async () => {
  reset();
  const other = clone(S.players.other), table = clone(S.table);
  CT.act(() => { S.me.life = 35; });
  assert.match(S.undo[0].label, /40 → 35/);
  const first = S.undo[0];
  CT.act(() => { S.me.zones.battlefield[0].t = true; return ['tapped {0}', [S.me.defs.d]]; });
  assert.equal(S.undo[1].label, 'tapped Test Card');
  S.me.seq = 25; S.me.defs.extra = { id: 'extra', name: 'New definition' };
  S.selected.add('me_1');
  assert.equal(CT.restorePersonalEntry(first), true);
  assert.equal(S.me.life, 40); assert.equal(S.me.zones.battlefield[0].t, false);
  assert.equal(S.me.seq, 25, 'card IDs never rewind'); assert.ok(S.me.defs.extra);
  assert.equal(S.selected.size, 0); assert.equal(S.undo.length, 0);
  assert.deepEqual(clone(S.players.other), other); assert.deepEqual(clone(S.table), table);
  assert.equal(CT.restorePersonalEntry(first), false, 'discarded menu entries cannot replay');

  reset(); CT.act(() => { S.me.life--; });
  CT.onReq({ k: 'life', d: -3 }, 'other');
  assert.equal(S.me.life, 36); assert.equal(S.undo.length, 0, 'incoming life effect clears older history');
  CT.undo(); assert.equal(S.me.life, 36);
  CT.act(() => { S.me.life++; });
  CT.onReq({ k: 'cmddmg', key: 'other:cmd', d: 2 }, 'other');
  assert.equal(S.me.life, 35); assert.equal(S.me.cmdDmg['other:cmd'], 2);
  assert.equal(S.undo.length, 0, 'incoming commander damage cannot be undone');

  reset(); CT.act(() => { S.me.life--; });
  CT.giveControl('me_1', 'other');
  assert.equal(S.me.zones.battlefield.length, 0); assert.equal(S.undo.length, 0);
  CT.undo(); assert.equal(S.me.zones.battlefield.length, 0, 'giving control cannot duplicate a card');
  assert.ok(sent.some(m => m.t === 'req' && m.req.k === 'give'));
  CT.act(() => { S.me.life--; });
  CT.onReq({ k: 'give', card: card('other_1', 'other'), def: S.me.defs.d }, 'other');
  assert.equal(S.undo.length, 0); assert.equal(S.me.zones.battlefield.length, 1);
  CT.act(() => { S.me.life--; });
  CT.moveCard('other_1', 'graveyard');
  assert.equal(S.me.zones.battlefield.length, 0); assert.equal(S.undo.length, 0, 'foreign-owned card return is a boundary');

  reset();
  S.me.zones.battlefield.push(card('other_1', 'other'));
  CT.act(() => { S.me.life--; }); CT.returnControl('other_1');
  assert.equal(S.undo.length, 0); assert.equal(S.me.zones.battlefield.length, 1);
  CT.act(() => { S.me.life--; });
  CT.onReq({ k: 'take', iid: 'me_1' }, 'other');
  assert.ok(S.undo.length, 'invalid take does not erase history');
  S.me.zones.battlefield[0].own = 'other';
  CT.onReq({ k: 'take', iid: 'me_1' }, 'other');
  assert.equal(S.undo.length, 0); assert.equal(S.me.zones.battlefield.length, 0);

  reset(); CT.savePersonalCheckpoint(4);
  assert.equal(S.undo[0].label, 'Combat checkpoint');
  assert.equal(S.table.phase, 3, 'saving a named checkpoint never advances shared phase');
  const manual = S.undo[0]; CT.act(() => { S.me.life = 25; });
  assert.equal(CT.restorePersonalEntry(manual), true); assert.equal(S.me.life, 40);
  S.table.active = 'other'; CT.savePersonalCheckpoint(4); assert.equal(S.undo.length, 0, 'cannot save checkpoint on another turn');

  reset(); CT.afterTable();
  assert.equal(S.undo[0].kind, 'checkpoint');
  const checkpoint = S.undo[0]; CT.afterTable(); assert.equal(S.undo.length, 1, 'same phase does not duplicate checkpoints');
  CT.act(() => { S.me.life = 30; }); S.table.phase = 4; CT.afterTable();
  assert.equal(S.undo.filter(e => e.kind === 'checkpoint').length, 2);
  assert.equal(CT.restorePersonalEntry(checkpoint), true); assert.equal(S.me.life, 40);
  assert.equal(S.table.phase, 4, 'phase checkpoint does not rewind shared phase');
  CT.act(() => { S.me.life--; }); const stale = S.undo[0]; S.table.turnSeq++;
  assert.equal(CT.restorePersonalEntry(stale), false, 'stale context rejects restore even before table handler');
  S.table.active = 'other'; CT.afterTable(); assert.equal(S.undo.length, 0);
  S.table.active = 'me'; S.table.turnSeq++; S.me.autoDraw = true; CT.afterTable();
  assert.equal(S.me.zones.hand.length, 1);
  assert.equal(JSON.parse(S.undo[0].state).zones.hand.length, 1, 'checkpoint is after automatic turn draw');
  CT.act(() => { S.me.life--; }); CT.undo();
  assert.equal(S.me.lastTurnSeq, S.table.turnSeq); CT.afterTable(); assert.equal(S.me.zones.hand.length, 1, 'undo cannot repeat auto draw');

  reset(); for (let i = 0; i < 50; i++) CT.act(() => { S.me.life--; });
  assert.equal(S.undo.length, 40, 'history is bounded');
  const count = S.undo.length; CT.act(() => null); assert.equal(S.undo.length, count, 'no-op does not add history');
  const target = S.undo[0], pending = CT.choosePersonalEntry(target);
  S.me.life--; confirm(true); await pending;
  assert.equal(S.undo.length, 40, 'changed board cannot restore from stale confirmation');
  const pendingTransfer = CT.choosePersonalEntry(target);
  CT.clearUndo(); confirm(true); await pendingTransfer;
  assert.equal(S.undo.length, 0, 'cleared history cannot restore from an open confirmation');
  console.log('PASS personal Undo: labels, local-only restore, IDs/defs, incoming effects, both transfer directions, stale entries/dialogs, checkpoints/automation, bounds');
})().catch(e => { console.error(e); process.exitCode = 1; });
