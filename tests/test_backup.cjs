/* Run with node tests/test_backup.cjs. No network or browser needed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const window = { crypto: webcrypto, CTAppearance: { backOptions: [{ id: 'ruby-sigil' }], backgroundOptions: [{ id: 'haunted-ruins' }] } };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../js/backup.js'), 'utf8'), { window, Blob, console });
const api = window.CTBackup;
const plain = v => JSON.parse(JSON.stringify(v));
const card = { id: 'card-1', name: 'Test Commander', type: 'Legendary Creature', oracle: 'Rules text', ci: ['U'], img: 'https://cards.scryfall.io/normal/front/a/b/test.jpg', imgBack: null, pt: '2/2', set: 'test', cn: '12', mana: '{U}', cmc: 1, tokens: ['token-1'] };
const deck = { id: 'deck-1', name: 'My deck', createdAt: '2026-10-21T00:00:00Z', commanders: [card], cards: [{ def: { ...card, id: 'card-2', name: 'Test Island', ci: [] }, qty: 10 }], tokens: [{ ...card, id: 'token-1', name: 'Test Token', isToken: true }], source: 'Commander\n1 Test Commander\nDeck\n10 Test Island' };
class Store {
  constructor(values = {}) { this.data = new Map(Object.entries(values)); this.failKey = null; this.failed = false; }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { if (this.failKey === k && !this.failed) { this.failed = true; throw new Error('QuotaExceededError'); } this.data.set(k, v); }
  removeItem(k) { this.data.delete(k); }
}
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const fixture = () => new Store({ 'ct.decks.v1': JSON.stringify([deck]), 'ct.name': '"Chris"', 'ct.handCw': '94', 'ct.chatSound': 'true', 'ct.appearance': JSON.stringify({ cardBack: 'ruby-sigil', background: 'haunted-ruins' }), 'ct.appearance.custom': JSON.stringify({ cardBack: 'data:image/webp;base64,UklGRg==', cardBackActive: false, background: '', backgroundActive: false }), 'ct.sess.player': '{"private":"secret"}', 'ct.last': '"player"', 'ct.pid': '"player"' });
test('round trip preserves all saved card data, printings, tokens and preferences', () => {
  const source = fixture(), backup = api.create(source), dest = new Store();
  const loaded = api.parse(JSON.stringify(backup));
  api.restore(dest, loaded, true);
  assert.deepEqual(JSON.parse(dest.getItem('ct.decks.v1')), plain(backup.decks));
  assert.deepEqual(plain(backup.decks[0].commanders[0]), card);
  for (const [key, value] of Object.entries(backup.preferences)) assert.deepEqual(JSON.parse(dest.getItem(key)), plain(value));
});
test('excludes active sessions and player identities', () => {
  const text = JSON.stringify(api.create(fixture()));
  assert(!text.includes('secret')); assert(!text.includes('ct.sess')); assert(!text.includes('ct.pid')); assert(!text.includes('ct.last'));
});
test('preview never writes; repeat restore skips exact matching decks', () => {
  const storage = fixture(), before = [...storage.data], backup = api.create(storage);
  const result = api.plan(storage, backup);
  assert.equal(result.skipped, 1); assert.equal(result.added, 0); assert.deepEqual([...storage.data], before);
  api.restore(storage, backup, false); api.restore(storage, backup, false);
  assert.equal(JSON.parse(storage.getItem('ct.decks.v1')).length, 1);
});
test('changed IDs restore as copies and preserve the existing deck', () => {
  const storage = fixture(), backup = plain(api.create(storage)); backup.decks[0].name = 'Changed deck';
  const result = api.restore(storage, backup, false), saved = JSON.parse(storage.getItem('ct.decks.v1'));
  assert.equal(result.copies, 1); assert.equal(saved.length, 2); assert.deepEqual(saved[0], deck);
  assert.notEqual(saved[1].id, deck.id); assert.equal(saved[1].name, 'Changed deck (restored)');
});
test('preferences are opt-in, missing preferences stay untouched', () => {
  const backup = api.create(fixture()), dest = new Store({ 'ct.name': '"Other"', 'ct.touchMode': 'true' });
  api.restore(dest, backup, false); assert.equal(dest.getItem('ct.name'), '"Other"');
  api.restore(dest, backup, true); assert.equal(dest.getItem('ct.name'), '"Chris"'); assert.equal(dest.getItem('ct.touchMode'), 'true');
});
test('quota failure rolls back decks, preferences and missing keys', () => {
  const backup = api.create(fixture()), dest = new Store({ 'ct.decks.v1': '[]', 'ct.name': '"Before"', 'ct.sess.keep': 'unchanged' });
  const before = [...dest.data]; dest.failKey = 'ct.appearance.custom';
  assert.throws(() => api.restore(dest, backup, true), /previous collection and preferences were kept/);
  assert.deepEqual([...dest.data], before);
});
test('malformed data and unsupported versions fail without writes', () => {
  const backup = plain(api.create(fixture())), storage = fixture(), before = [...storage.data];
  for (const mutate of [b => b.version = 2, b => b.decks[0].cards[0].qty = 1.5, b => b.decks[0].commanders[0].img = 'javascript:alert(1)', b => b.preferences['ct.view'] = 'bogus', b => b.decks.push(b.decks[0]), b => b.decks[0].cards = null]) {
    const bad = plain(backup); mutate(bad); assert.throws(() => api.restore(storage, bad, true)); assert.deepEqual([...storage.data], before);
  }
  assert.throws(() => api.parse('invalid'), /not valid JSON/); assert.throws(() => api.parse(' '.repeat(20 * 1024 * 1024 + 1)), /20 MB/);
});
test('unrecognized storage keys and card fields cannot be restored', () => {
  const backup = plain(api.create(fixture())), dest = new Store();
  backup.preferences['ct.sess.injected'] = { private: 'hidden' }; backup.decks[0].commanders[0].onclick = 'alert(1)';
  api.restore(dest, backup, true);
  assert.equal(dest.getItem('ct.sess.injected'), null); assert(!JSON.parse(dest.getItem('ct.decks.v1'))[0].commanders[0].onclick);
});
test('corrupt saved decks block backup and restore instead of overwriting them', () => {
  const storage = new Store({ 'ct.decks.v1': 'broken' }), backup = api.create(fixture());
  assert.throws(() => api.create(storage), /could not be read/); assert.throws(() => api.restore(storage, backup, false), /could not be read/);
  assert.equal(storage.getItem('ct.decks.v1'), 'broken');
});
console.log(checks + ' backup checks passed.');
