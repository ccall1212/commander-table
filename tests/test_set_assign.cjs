/* "Use one set for the whole deck": the set list, the one-set card lookup (several pages), and how a deck is re-assigned
 * (random version per copy, cards missing from the set and cards already in it left alone, tokens kept). No network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const pages = new Map();
const calls = [];
const context = vm.createContext({
  console, URLSearchParams, Set, Map, Uint32Array,
  window: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout: (fn) => { fn(); return 1; },
  fetch: async (url) => {
    calls.push(String(url));
    const body = pages.get(String(url));
    if (!body) return { ok: false, status: 404, json: async () => ({ details: 'missing' }) };
    return { ok: true, status: 200, json: async () => body };
  }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/deck.js'), 'utf8'), context);
const Deck = context.window.Deck;

const card = (id, name, over = {}) => ({
  id, name, layout: 'normal', type_line: over.type || 'Basic Land — Forest', oracle_text: '', color_identity: [], mana_cost: '',
  set: over.set || 'fin', set_name: 'Final Fantasy', collector_number: over.cn || id, released_at: '2025-06-13',
  image_uris: { normal: 'https://cards.scryfall.io/normal/front/x/' + id + '.jpg' }, ...(over.extra || {})
});
const SEARCH = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('e:fin') + '&unique=prints&order=name&include_extras=true&include_variations=true';
pages.set('https://api.scryfall.com/sets', { data: [
  { code: 'fin', name: 'Final Fantasy', set_type: 'expansion', released_at: '2025-06-13', card_count: 700 },
  { code: 'tfin', name: 'Final Fantasy Tokens', set_type: 'token', released_at: '2025-06-13', card_count: 10 },
  { code: 'lea', name: 'Limited Edition Alpha', set_type: 'core', released_at: '1993-08-05', card_count: 295 },
  { code: 'mem', name: 'Memorabilia thing', set_type: 'memorabilia', released_at: '2020-01-01', card_count: 3 }
] });
pages.set(SEARCH, { data: [card('f1', 'Forest'), card('f2', 'Forest', { cn: '2' }), card('f1', 'Forest') /* duplicate id */, card('t1', 'Goblin', { type: 'Token Creature', extra: { layout: 'token' } })], has_more: true, next_page: SEARCH + '&page=2' });
pages.set(SEARCH + '&page=2', { data: [card('f3', 'Forest', { cn: '3' }), card('s1', 'Sol Ring', { type: 'Artifact' }), card('ng', 'No Image', { extra: { image_uris: null } }),
  card('m1', 'Delver of Secrets // Insectile Aberration', { type: 'Creature', extra: { layout: 'transform', card_faces: [
    { name: 'Delver of Secrets', type_line: 'Creature', oracle_text: '', image_uris: { normal: 'https://cards.scryfall.io/normal/front/x/m1a.jpg' } },
    { name: 'Insectile Aberration', type_line: 'Creature', oracle_text: '', image_uris: { normal: 'https://cards.scryfall.io/normal/front/x/m1b.jpg' } }] } })], has_more: false });

const plain = x => JSON.parse(JSON.stringify(x)); // results come from another vm realm, so compare as plain data

(async () => {
  const sets = await Deck.fetchSets();
  assert.deepEqual(plain(sets.map(s => s.code)), ['fin', 'lea'], 'tokens and memorabilia are left out, newest first');

  const map = await Deck.fetchSetPrints('FIN');
  assert.equal(calls.filter(u => u.includes('e%3Afin')).length, 2, 'every page of the set is read');
  assert.deepEqual(plain(map.get('forest').map(d => d.id).sort()), ['f1', 'f2', 'f3'], 'three Forests, the duplicate id once');
  assert.ok(!map.has('goblin') && !map.has('no image'), 'tokens and cards without art are skipped');
  assert.ok(map.has('delver of secrets'), 'a two-faced card is found by its front face');
  assert.equal((await Deck.fetchSetPrints('bad code!')).size, 0, 'a bad set code asks Scryfall nothing');
  assert.equal((await Deck.fetchSetPrints('zzz')).size, 0, 'an unknown set gives nothing');

  const def = (id, name, set = 'old', extra = {}) => ({ id, name, set, img: 'https://cards.scryfall.io/normal/front/x/' + id + '.jpg', tokens: extra.tokens || [], ...extra });
  const deck = {
    commanders: [def('c1', 'Sol Ring'), def('c2', 'Not In Set')],
    cards: [
      { def: def('o1', 'Forest', 'old', { tokens: ['keepme'] }), qty: 30 },
      { def: def('o2', 'Delver of Secrets // Insectile Aberration'), qty: 1 },
      { def: def('o3', 'Counterspell'), qty: 1 },
      { def: def('f2', 'Forest', 'fin'), qty: 2 },
      { def: def('o4', 'Zero copies'), qty: 0 }
    ]
  };
  const before = JSON.stringify(deck);
  let n = 0; const rand = () => [0.0, 0.5, 0.99][n++ % 3]; // cycles through the three Forests
  const plan = Deck.applySetToDeck(deck, map, 'fin', rand);
  assert.equal(JSON.stringify(deck), before, 'the deck passed in is not changed');
  assert.equal(plan.commanders[0].set, 'fin', 'a commander that is in the set switches');
  assert.equal(plan.commanders[1].id, 'c2', 'a commander that is not in the set stays');
  const forests = plan.cards.filter(e => e.def.name === 'Forest');
  const total = forests.reduce((a, e) => a + e.qty, 0);
  assert.equal(total, 32, 'no copy is lost or added');
  assert.deepEqual(plain(forests.map(e => e.def.id).sort()), ['f1', 'f2', 'f3'], 'thirty copies spread over the three versions, one row per printing');
  assert.ok(forests.filter(e => e.def.id !== 'f2').every(e => e.def.tokens.includes('keepme')), 'a deck entry keeps its own token list');
  assert.ok(forests.find(e => e.def.id === 'f2').qty >= 2, 'the two Forests already from the set stay (and are not re-rolled)');
  assert.equal(plan.cards.find(e => e.def.name.startsWith('Delver')).def.set, 'fin', 'a two-faced card switches');
  assert.equal(plan.cards.find(e => e.def.id === 'o3').def.id, 'o3', 'a card not in the set stays as it is');
  assert.deepEqual(plain(plan.missing), ['Counterspell', 'Not In Set'], 'missing cards are listed once, copies of zero are ignored');
  assert.equal(plan.changed, 30 + 1 + 1, 'changed counts every switched copy including the commander');
  assert.equal(plan.already, 2);

  // Nothing in the set matches: nothing changes.
  const none = Deck.applySetToDeck({ commanders: [], cards: [{ def: def('o3', 'Counterspell'), qty: 4 }] }, map, 'fin');
  assert.equal(none.changed, 0); assert.deepEqual(plain(none.missing), ['Counterspell']);
  // Random choice really varies and always picks a real version.
  const seen = new Set();
  for (let i = 0; i < 60; i++) Deck.applySetToDeck({ commanders: [], cards: [{ def: def('o1', 'Forest'), qty: 1 }] }, map, 'fin').cards.forEach(e => seen.add(e.def.id));
  assert.deepEqual(plain(Array.from(seen).sort()), ['f1', 'f2', 'f3'], 'all three versions can be picked');
  console.log('PASS use one set: set list, paged lookup, random version per copy, missing and already-in-set cards left alone, deck not mutated');
})().catch(e => { console.error(e); process.exit(1); });
