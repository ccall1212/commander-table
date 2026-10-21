const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const pages = new Map();
let calls = [];
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
const base = (id, opts = {}) => ({
  id, name: opts.name || 'Goblin', layout: opts.layout || 'token',
  type_line: opts.type || 'Token Creature — Goblin', oracle_text: opts.oracle || 'Haste\r\n\nThis creature attacks each combat if able.',
  power: opts.power || '1', toughness: opts.toughness || '1', colors: opts.colors || ['R'],
  color_identity: opts.ci || ['R'], mana_cost: '', oracle_id: opts.oracleId || id,
  set: 'tst', collector_number: id, image_uris: { normal: 'https://cards.scryfall.io/normal/front/x/' + id + '.jpg' },
  ...(opts.faces ? { card_faces: opts.faces } : {})
});
const result = data => ({ data, has_more: false });

(async () => {
  const chosen = base('chosen');
  const d = Deck.toDef(chosen);
  assert.ok(Deck.tokenKey(d));
  assert.equal(Deck.toDef({ ...chosen, layout: 'normal', type_line: 'Creature — Goblin' }).tokenLayout, undefined,
    'extra identity fields are token-only');
  const slim = Deck.slimDef(d);
  assert.equal(Deck.tokenKey(slim), Deck.tokenKey(d), 'transferred token definition retains semantic identity');
  assert.equal(Deck.tokenKey(Deck.slimDef({ id: 'ordinary', type: 'Creature', name: 'Goblin' })), '',
    'ordinary slim definitions gain no token identity');

  const search = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('!"Goblin"') +
    '&unique=prints&order=released&dir=desc&include_extras=true&include_variations=true';
  pages.set(search, { data: [
    base('same-id-diff-oracle', { oracleId: 'other' }),
    base('wrong-stats', { power: '2' }),
    base('wrong-ability', { oracle: 'Vigilance' }),
    base('wrong-colors', { colors: ['B'], ci: ['B'] }),
    { ...base('ordinary'), layout: 'normal', type_line: 'Creature — Goblin' },
    base('back-collision', { name: 'Goblin // Dragon', layout: 'double_faced_token', faces: [
      { name: 'Goblin', type_line: 'Token Creature — Goblin', oracle_text: 'Haste This creature attacks each combat if able.', power: '1', toughness: '1', colors: ['R'] },
      { name: 'Dragon', type_line: 'Token Creature — Dragon', oracle_text: 'Flying', power: '4', toughness: '4', colors: ['R'] }
    ] })
  ], has_more: true, next_page: 'https://api.scryfall.com/page2' });
  pages.set('https://api.scryfall.com/page2', result([base('same-semantics', { oracleId: 'yet-another' })]));
  const prints = await Deck.fetchTokenPrints(d);
  assert.equal(JSON.stringify(prints.map(x => x.id)), JSON.stringify(['same-id-diff-oracle', 'same-semantics']),
    'all pages retain semantic matches across differing oracle IDs and exclude mismatches');
  assert.equal(calls.filter(x => x === search).length, 1, 'queries exact token name across printings');

  // A legacy saved definition gets hydrated from its Scryfall ID before comparison.
  calls = [];
  pages.set('https://api.scryfall.com/cards/legacy', { ...chosen, id: 'legacy' });
  const legacy = { id: 'legacy', name: 'Goblin', isToken: true };
  const legacyPrints = await Deck.fetchTokenPrints(legacy);
  assert.equal(legacyPrints.length, 2);
  assert.ok(calls[0].endsWith('/cards/legacy'));

  const noMetadata = await Deck.fetchTokenPrints({ id: 'missing', name: 'Goblin', isToken: true });
  assert.equal(noMetadata.length, 0, 'unknown metadata never claims token equivalence');
  assert.equal((await Deck.fetchTokenPrints({ id: 'x', name: 'Widget', isToken: false })).length, 0, 'ordinary cards do not use token lookup');

  // Ordinary card printing behaviour still excludes token layouts.
  calls = [];
  const normalSearch = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('!"Lightning Bolt"') +
    '&unique=prints&order=released&dir=desc&include_extras=true&include_variations=true';
  pages.set(normalSearch, result([
    { ...base('token-bolt'), name: 'Lightning Bolt', layout: 'token' },
    { ...base('bolt-card'), name: 'Lightning Bolt', layout: 'normal', type_line: 'Instant', oracle_text: 'Deal 3 damage.', power: undefined, toughness: undefined }
  ]));
  assert.equal(JSON.stringify((await Deck.fetchPrints('Lightning Bolt')).map(x => x.id)), JSON.stringify(['bolt-card']));

  // The face-back identity is part of the key even when the front is identical.
  const doubleA = Deck.toDef({ ...base('double-a', { name: 'Goblin // Dragon', layout: 'double_faced_token' }), card_faces: [
    { name: 'Goblin', type_line: 'Token Creature — Goblin', oracle_text: 'Haste', power: '1', toughness: '1', colors: ['R'] },
    { name: 'Dragon', type_line: 'Token Creature — Dragon', oracle_text: 'Flying', power: '4', toughness: '4', colors: ['R'] }
  ] });
  const doubleB = Deck.toDef({ ...base('double-b', { name: 'Goblin // Wolf', layout: 'double_faced_token' }), card_faces: [
    { name: 'Goblin', type_line: 'Token Creature — Goblin', oracle_text: 'Haste', power: '1', toughness: '1', colors: ['R'] },
    { name: 'Wolf', type_line: 'Token Creature — Wolf', oracle_text: 'Menace', power: '2', toughness: '2', colors: ['R'] }
  ] });
  assert.notEqual(Deck.tokenKey(doubleA), Deck.tokenKey(doubleB));
  const doubleBlueBack = Deck.toDef({ ...base('double-blue', { name: 'Goblin // Dragon', layout: 'double_faced_token' }), card_faces: [
    { name: 'Goblin', type_line: 'Token Creature — Goblin', oracle_text: 'Haste', power: '1', toughness: '1', colors: ['R'] },
    { name: 'Dragon', type_line: 'Token Creature — Dragon', oracle_text: 'Flying', power: '4', toughness: '4', colors: ['U'] }
  ] });
  assert.notEqual(Deck.tokenKey(doubleA), Deck.tokenKey(doubleBlueBack), 'back-face color distinguishes token printings');
  const abilityDiff = Deck.toDef({ ...chosen, id: 'ability-diff', oracle_text: 'Vigilance' });
  assert.notEqual(Deck.tokenKey(d), Deck.tokenKey(abilityDiff), 'oracle abilities distinguish token printings');
  const legacyTypeOnly = { id: 'legacy', name: 'Goblin', type: 'Token Creature — Goblin' };
  assert.match(Deck.tokenKey(legacyTypeOnly), /^unknown:legacy$/, 'sparse token-looking defs get a per-ID fallback');
  assert.equal((await Deck.fetchTokenPrints(legacyTypeOnly)).length, 2,
    'legacy token-looking definitions hydrate before token validation');
  console.log('PASS token printings: paginated semantic matching, legacy hydration, unsupported and mismatched tokens, double-face distinction, and ordinary card regression');
})().catch(e => { console.error(e); process.exitCode = 1; });
