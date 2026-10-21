/* Node only; no packages. Exercises the actual app helpers, HTML and action/undo pipeline. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({
  console, URLSearchParams, Set, Map, Uint32Array,
  location: { search: '?nettest', protocol: 'file:' },
  document: { querySelector: () => null },
  setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1,
  CTAppearance: { normalizePrefs: p => p || {}, getCustom: () => ({}) },
  CTMulligan: {
    CAP: 7, MAX_EXTRA: 20, MAX_LIMIT: 21,
    normalizeMode: mode => mode || 'london',
    extraLimit: n => Math.max(0, Math.min(20, Math.floor(Number(n) || 0))),
    limit: (mode, grants = 0) => mode === 'london' ? 7 : 1 + Math.max(0, Math.min(20, Math.floor(Number(grants) || 0)))
  },
  UI: { cardBackHTML: () => '<div class="back"></div>' }
});
context.window = context;
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const marker = 'window.CT = { S,';
assert.equal(source.split(marker).length, 2, 'test export anchor is unique');
vm.runInContext(source.replace(marker,
  'window.CT = { effPT, cardHTML, changePT, resetPT, pubCard, cleanPub, S,'), context);
const { S, effPT, cardHTML, changePT, resetPT, pubCard, cleanPub } = context.CT;
S.pid = 'p1'; S.role = 'solo';
S.me = { name: 'Tester', defs: {}, zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [] } };
const options = { pid: 'p1', mine: true, zone: 'battlefield' };
const statValue = (html, stat) => {
  const m = html.match(new RegExp('data-pt-stat="' + stat + '"[^>]*>(-?\\d+)</button>'));
  assert.ok(m, stat + ' has a numeric adjustment button');
  return +m[1];
};
const cases = [
  ['*/5', '0/5'], ['*/*', '0/0'], ['3/*', '3/0'], ['*/0', '0/0'],
  ['*+1/*', '0/0'], ['X/5', '0/5'], ['∞/∞', '0/0'],
  ['-2/5', '-2/5'], ['3/5', '3/5'], ['0/0', '0/0'], [' * / 5 ', '0/5']
];
for (const [printed, expected] of cases) {
  const c = { iid: 'p1_1', id: 'creature', c: {} };
  const def = { id: 'creature', name: 'Test creature', type: 'Creature', pt: printed };
  S.me.defs = { creature: def }; S.me.zones.battlefield = [c]; S.undo = [];
  assert.equal(effPT(c, def).text, expected, printed + ' starts at the expected value');
  assert.equal(effPT(c, def).modified, false);
  const html = cardHTML(c, def, options);
  assert.equal(statValue(html, 'power'), +expected.split('/')[0]);
  assert.equal(statValue(html, 'toughness'), +expected.split('/')[1]);
  assert.ok(html.includes('(printed ' + printed + ')'), 'printed value remains available');
  changePT(c.iid, 1, 0);
  assert.equal(effPT(c, def).text, `${+expected.split('/')[0] + 1}/${expected.split('/')[1]}`);
  changePT(c.iid, -2, 0);
  changePT(c.iid, 0, -1);
  assert.equal(effPT(c, def).text, `${+expected.split('/')[0] - 1}/${+expected.split('/')[1] - 1}`);
  assert.equal(effPT(c, def).modified, true);
  const received = cleanPub({ pid: 'p1', bw: 1000, defs: { creature: def }, zones: { battlefield: [pubCard(c)] } }, 'p1');
  assert.equal(effPT(received.zones.battlefield[0], received.defs.creature).text, effPT(c, def).text,
    'public serialization preserves stat changes');
  c.c = { '+1/+1': 3, '-1/-1': 1 };
  assert.equal(effPT(c, def).text, `${+expected.split('/')[0] + 1}/${+expected.split('/')[1] + 1}`);
  c.pb = '4/7';
  assert.equal(effPT(c, def).text, '5/8', 'numeric base override plus modifiers/counters');
  resetPT(c.iid);
  assert.equal(effPT(c, def).text, `${+expected.split('/')[0] + 2}/${+expected.split('/')[1] + 2}`,
    'reset restores zero/numeric printed baselines but retains real counters');
  assert.equal(def.pt, printed, 'printed card definition is not mutated');
  const beforeUndo = S.undo.length;
  changePT(c.iid, 1, 0);
  assert.equal(S.undo.length, beforeUndo + 1, 'stat changes enter the existing undo pipeline');
  // Restore the actual snapshot without running undo's unrelated room-log/UI feedback.
  const restored = JSON.parse(S.undo.pop()).zones.battlefield[0];
  assert.equal(effPT(restored, def).text, effPT({ ...c, dp: 0 }, def).text);
}
const facedown = { iid: 'p1_fd', fd: true, c: {} };
assert.equal(effPT(facedown, { pt: '*/*' }).text, '2/2');
assert.equal(cardHTML(facedown, { pt: '*/*', name: 'Hidden' }, options).includes('data-pt-stat'), false);
assert.equal(effPT({ c: {} }, { type: 'Land', pt: null }).text, '');
assert.equal(cardHTML({ iid: 'p1_land', c: {} }, { type: 'Land', name: 'Land' }, options).includes('data-pt-stat'), false);
S.me.zones.hand = [{ iid: 'p1_hand', id: 'creature', c: {} }];
changePT('p1_hand', 1, 1);
assert.equal(S.me.zones.hand[0].dp, undefined, 'non-battlefield card cannot be adjusted');
assert.equal(cardHTML(S.me.zones.hand[0], S.me.defs.creature, { ...options, zone: 'hand' }).includes('data-pt-stat'), false);
console.log('PASS power/toughness: symbolic and numeric baselines, numeric buttons, independent changes, counters, overrides/reset, public-state roundtrip, undo snapshots and hidden/non-creature exclusions');
