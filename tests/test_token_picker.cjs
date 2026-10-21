// Exercises the current gallery / printing helpers from app.js with mocked UI and Scryfall.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const deckContext = vm.createContext({ window: {}, URLSearchParams, Set, Map, Uint32Array,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout: fn => { fn(); return 1; }, fetch: async () => { throw new Error('unexpected network'); } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/deck.js'), 'utf8'), deckContext);
const Deck = deckContext.window.Deck;
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

function extract(name) {
  const re = new RegExp('(?:async )?function ' + name + '\\s*\\(');
  const m = re.exec(app);
  assert.ok(m, name + ' exists in app.js');
  const start = m.index;
  const brace = app.indexOf('{', m.index + m[0].length);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('Could not find end of ' + name);
}

function bindFunction(name, deps) {
  const source = extract(name).replace(/^async function /, 'async function ').replace(/^function /, 'function ');
  try { return Function(...Object.keys(deps), 'return (' + source + ');')(...Object.values(deps)); }
  catch (e) { console.error('failed extraction', name, source); throw e; }
}

const mkToken = (id, changes = {}) => Deck.toDef({
  id, name: 'Goblin', layout: 'token', type_line: 'Token Creature — Goblin',
  oracle_text: 'Haste', power: '1', toughness: '1', colors: ['R'], color_identity: ['R'],
  oracle_id: id, image_uris: { normal: 'https://cards.scryfall.io/normal/x/' + id + '.jpg' }, ...changes
});

async function main() {
  const owner = { defs: {}, zones: { battlefield: [], hand: [], graveyard: [], exile: [], command: [] }, tokens: [] };
  const views = [];
  const gallerySet = new Set();
  let promptValue = 1, created = [], toastCount = 0;
  const S = { me: owner };
  const UI = {
    prompt: async () => promptValue,
    toast: () => { toastCount++; return { close() {} }; },
    viewer: config => {
      const view = { config, cards: config.cards, closed: false,
        close: null,
        update(cards) { this.cards = cards; } };
      view.close = () => { if (!view.closed) { view.closed = true; config.onClose(); } };
      views.push(view); return view;
    },
    printPicker: config => { UI.picker = config; }
  };
  const createToken = (def, n) => created.push([def.id, n]);
  const quantity = bindFunction('createTokenQuantity', { S, UI, createToken, dname: d => d.name });
  let tokenGallery;
  tokenGallery = bindFunction('tokenGallery', {
    S, Deck, UI, tokenGalleries: gallerySet, dname: d => d.name,
    createTokenQuantity: quantity, preview() {}, hidePreview() {},
    searchTokens() { tokenGallery([mkToken('nested-goblin')], 'Search results'); }
  });

  tokenGallery([mkToken('goblin-a')], 'Deck tokens', true);
  const rootView = views[0];
  await rootView.config.onFooter();
  assert.equal(views.length, 2, 'search can open a nested token gallery');
  await views[1].config.onCardClick(views[1].cards[0].def);
  assert.deepEqual(created, [['nested-goblin', 1]], 'valid Create produces tokens');
  assert.ok(views[0].closed && views[1].closed, 'successful Create closes all nested galleries owned by the player');

  for (const result of [null, 0, 61, 1.5, '2']) {
    const fresh = new Set();
    const localQuantity = bindFunction('createTokenQuantity', {
      S, UI: { ...UI, prompt: async () => result }, createToken, dname: d => d.name
    });
    const localGallery = bindFunction('tokenGallery', {
      S, Deck, UI: { ...UI, viewer: UI.viewer }, tokenGalleries: fresh,
      dname: d => d.name, createTokenQuantity: localQuantity,
      preview() {}, hidePreview() {}, searchTokens() {}
    });
    const before = created.length, beforeViews = views.length;
    localGallery([mkToken('goblin-' + String(result))], 'Keep open');
    await views[beforeViews].config.onCardClick(views[beforeViews].cards[0].def);
    assert.equal(created.length, before, 'cancel / invalid quantity creates nothing: ' + String(result));
    assert.equal(views[beforeViews].closed, false, 'cancel / invalid quantity keeps gallery open: ' + String(result));
  }

  // Owner can change while the prompt is open; the old table must not receive a token.
  let resolvePrompt;
  const delayedUI = { ...UI, prompt: () => new Promise(resolve => { resolvePrompt = resolve; }) };
  const delayedCreate = bindFunction('createTokenQuantity', {
    S, UI: delayedUI, createToken, dname: d => d.name
  });
  const delayedGallery = bindFunction('tokenGallery', {
    S, Deck, UI: delayedUI, tokenGalleries: new Set(), dname: d => d.name,
    createTokenQuantity: delayedCreate, preview() {}, hidePreview() {}, searchTokens() {}
  });
  const beforeDelayed = created.length, viewIndex = views.length;
  delayedGallery([mkToken('owner-race')], 'Owner race');
  const pending = views[viewIndex].config.onCardClick(views[viewIndex].cards[0].def);
  S.me = { defs: {}, zones: { battlefield: [] }, tokens: [] };
  resolvePrompt(1);
  await pending;
  assert.equal(created.length, beforeDelayed, 'ownership change during prompt blocks token creation');
  assert.equal(views[viewIndex].closed, false, 'old gallery remains open after ownership change');
  S.me = owner;

  // Gallery groups prints only by the semantic Deck token identity, not their names.
  const equivalent = mkToken('goblin-b', { oracle_id: 'different-oracle', oracle_text: 'Haste\r\n' });
  const differentRules = mkToken('goblin-c', { oracle_text: 'Vigilance' });
  const groupedAt = views.length;
  tokenGallery([mkToken('goblin-a'), equivalent, differentRules], 'Grouping');
  assert.equal(views[groupedAt].cards.length, 2, 'same-token printings group while rules-distinct token remains separate');

  const printedToken = bindFunction('printedToken', {});
  const samePrintingGroup = bindFunction('samePrintingGroup', { Deck, printedToken });
  const a = mkToken('group-a'), b = mkToken('group-b', { oracle_id: 'other' });
  assert.equal(samePrintingGroup({ tok: true }, a, { tok: true }, b), true, 'semantic equivalent tokens match across IDs');
  for (const changed of [
    mkToken('power', { power: '2' }),
    mkToken('rules', { oracle_text: 'Deathtouch' }),
    mkToken('color', { colors: ['B'], color_identity: ['B'] }),
    mkToken('type', { type_line: 'Token Creature — Goblin Warrior' })
  ]) assert.equal(samePrintingGroup({ tok: true }, changed, { tok: true }, a), false,
    'different token metadata does not group (' + changed.id + ')');
  assert.equal(samePrintingGroup({ tok: true, cp: true }, { id: 'regular', type: 'Creature', isToken: false },
    { tok: true, cp: true }, { id: 'regular', type: 'Creature', isToken: false }), false,
    'ordinary token copies are excluded from token artwork grouping');
  assert.equal(samePrintingGroup({ tok: true, cp: true }, a, { tok: true, cp: true }, b), true,
    'copies of an actual token retain its semantic token identity');

  // Verify switchPrinting chooses endpoint based on the actual printed definition.
  const ownerCard = { tok: true, cp: true, iid: 'copy', id: 'regular' };
  const regularDef = { id: 'regular', name: 'Shapeshifter', type: 'Creature', isToken: false };
  const regularOwner = { defs: { regular: regularDef }, zones: { battlefield: [ownerCard] } };
  const switchState = { me: regularOwner };
  let fetched = '';
  const switchDeck = {
    fetchPrints: async () => { fetched = 'normal'; return [{ id: 'regular' }]; },
    fetchTokenPrints: async () => { fetched = 'token'; return [{ id: 'regular' }]; }, tokenKey: Deck.tokenKey
  };
  const findCard = () => ({ card: ownerCard, zone: 'battlefield' });
  const switchPrinting = bindFunction('switchPrinting', {
    S: switchState, Deck: switchDeck, UI, findCard, defOf: card => regularOwner.defs[card.id],
    printedToken, samePrintingGroup, ZONES: ['battlefield'], dname: d => d.name
  });
  await switchPrinting('copy');
  assert.equal(fetched, 'normal', 'ordinary card copies use normal printing search');
  ownerCard.id = 'actual';
  regularOwner.defs.actual = a;
  await switchPrinting('copy');
  assert.equal(fetched, 'token', 'copies of actual token definitions use token printing search');

  console.log('PASS token picker: nested gallery close, cancel/invalid prompts, owner race, semantic grouping, token copies, and lookup routing');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
