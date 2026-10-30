/* Run with Node: node tests/test_saved_data_upgrade.cjs. No packages or browser required.
 * Saved-data upgrade check: decks and backups that REAL older releases saved (tests/fixtures/saved-data/*.json,
 * made by tools/make-saved-data-fixture.cjs) must still load, list, build a library and round-trip through the
 * current code. The browser version (saved games, Resume, Deck Builder) is tests/test_saved_data_upgrade_browser.cjs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.join(__dirname, '..');
const dir = path.join(__dirname, 'fixtures', 'saved-data');
const files = fs.readdirSync(dir).filter(f => /^v\d+\.\d+\.\d+\.json$/.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
assert.ok(files.length >= 10, 'there are saved-data fixtures from many releases (' + files.length + ' found)');

class Store {
  constructor(values = {}) { this.data = new Map(Object.entries(values)); }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
  keys() { return [...this.data.keys()]; }
}
const plain = v => JSON.parse(JSON.stringify(v)); // arrays made in another vm context are a different "realm"

// Fresh copies of the current Deck and Backup code, each wired to a given storage.
function loadDeck(store) {
  const window = {}; const ctx = { window, localStorage: store, console, URL, URLSearchParams };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/deck.js'), 'utf8'), ctx);
  return window.Deck;
}
function loadBackup() {
  const window = { crypto: webcrypto, CTAppearance: { backOptions: [{ id: 'ruby-sigil' }], backgroundOptions: [{ id: 'haunted-ruins' }] } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/chat-panel.js'), 'utf8'), { window });
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/backup.js'), 'utf8'), { window, Blob, console });
  return window.CTBackup;
}
const CTBackup = loadBackup();
const total = deck => (deck.cards || []).reduce((n, r) => n + (r.qty || 0), 0) + (deck.commanders || []).length;

let checks = 0;
for (const file of files) {
  const fx = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const tag = fx.release;
  assert.match(tag, /^v\d+\.\d+\.\d+$/);
  const store = new Store(fx.localStorage);
  const Deck = loadDeck(store);

  // 1. The decks that release saved are all listed, with the same names, commanders and card counts.
  const list = plain(Deck.list());
  assert.equal(list.length, fx.deckList.length, `${tag}: every saved deck is listed`);
  for (const old of fx.deckList) {
    const now = list.find(d => d.id === old.id);
    assert.ok(now, `${tag}: deck "${old.name}" is still there`);
    assert.equal(now.name, old.name, `${tag}: name kept`);
    assert.deepEqual(now.commanderNames, old.commanderNames, `${tag}: commanders kept`);
    assert.equal(now.count, old.count, `${tag}: card count kept (${old.name})`);
  }

  // 2. Each deck opens and its cards are real: a library can be built and every card has what the table needs.
  for (const item of list) {
    const deck = Deck.get(item.id);
    assert.ok(deck, `${tag}: ${item.name} opens`);
    const library = Deck.buildLibrary(deck);
    assert.equal(library.length, deck.cards.reduce((n, r) => n + r.qty, 0), `${tag}: library size matches the quantities`);
    for (const def of [...library, ...deck.commanders, ...(deck.tokens || [])]) {
      assert.equal(typeof def.id, 'string', `${tag}: card has an id`);
      assert.ok(def.id.length > 0, `${tag}: card id is not empty`);
      assert.equal(typeof def.name, 'string', `${tag}: card has a name`);
      assert.ok(def.name.length > 0, `${tag}: card name is not empty`);
      assert.equal(typeof def.type, 'string', `${tag}: ${def.name} has a type line`);
    }
  }
  const main = Deck.get(fx.deckList.find(d => d.commanderNames.length).id);
  assert.equal(main.commanders.length, 1, `${tag}: the commander is still a commander`);
  assert.ok(main.cards.some(r => /\/\//.test(r.def.name)), `${tag}: the double-faced and adventure cards survived`);

  // 3. The current code can still save over an old deck and make a backup of it.
  const before = plain(Deck.get(main.id));
  Deck.save(plain(before));
  assert.deepEqual(plain(Deck.get(main.id)).cards.map(r => r.qty), before.cards.map(r => r.qty), `${tag}: re-saving an old deck keeps its quantities`);
  const backup = CTBackup.create(store);
  const reparsed = CTBackup.parse(JSON.stringify(backup));
  assert.equal(reparsed.decks.length, fx.deckList.length, `${tag}: today's backup of this old data includes every deck`);
  const restored = new Store();
  CTBackup.restore(restored, reparsed, true);
  const decksAgain = JSON.parse(restored.getItem('ct.decks.v1'));
  assert.deepEqual(decksAgain.map(d => total(d)).sort(), fx.deckList.map(d => d.count).sort(), `${tag}: backup then restore keeps every deck's card total`);

  // 4. A backup file made by that release itself (releases from v0.39.0 on) still restores in the current code.
  if (fx.backupFile) {
    const parsed = CTBackup.parse(fx.backupFile);
    assert.equal(parsed.decks.length, fx.deckList.length, `${tag}: its own backup file is still readable`);
    const dest = new Store();
    const plan = CTBackup.plan(dest, parsed);
    assert.equal(plan.added, fx.deckList.length, `${tag}: restoring its backup into an empty browser adds every deck`);
    CTBackup.restore(dest, parsed, false);
    assert.equal(JSON.parse(dest.getItem('ct.decks.v1')).length, fx.deckList.length, `${tag}: decks restored from its backup`);
    // Restoring it again must not duplicate anything.
    const again = CTBackup.plan(dest, CTBackup.parse(fx.backupFile));
    assert.equal(again.added, 0, `${tag}: restoring the same backup twice adds nothing new`);
  }
  checks++;
  console.log('PASS ' + tag + ': ' + fx.deckList.length + ' decks load, build libraries, re-save and back up' + (fx.backupFile ? '; its own backup file restores' : ''));
}
console.log(`PASS saved-data upgrade: decks and backups from ${checks} real releases (${files[0].replace('.json', '')} to ${files.at(-1).replace('.json', '')}) work in the current code`);
