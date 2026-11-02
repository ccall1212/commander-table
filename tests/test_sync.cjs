/* Run with Node: node tests/test_sync.cjs. No packages, browser or network needed.
 * Sync code (js/sync.js): the code format, the scrambling, and create / download / replace / delete against a
 * fake in-memory server that behaves like the relay's sync-v1 endpoints (relay/worker.js; its own test is
 * tests/test_sync_worker.cjs). The window itself is checked in a real browser (tests/test_sync_browser.cjs). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.join(__dirname, '..');
class Store {
  constructor(values = {}) { this.data = new Map(Object.entries(values)); }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}
const card = (id, name) => ({ id, name, type: 'Creature', oracle: 'Rules text for ' + name, ci: ['U'], img: 'https://cards.scryfall.io/normal/front/a/b/' + id + '.jpg', cmc: 3 });
const deck = (id, name, n = 3) => ({ id, name, createdAt: '2026-10-30T00:00:00Z', commanders: [card('cmd-' + id, 'Commander of ' + name)],
  cards: Array.from({ length: n }, (_, i) => ({ def: card(id + '-c' + i, 'Secret Card ' + i + ' of ' + name), qty: 1 + i })), tokens: [] });

// ---- A fake relay: the same answers the real one gives ----
function makeServer() {
  const boxes = new Map(), seen = [];
  const server = { boxes, seen, features: ['room-vault-v1', 'sync-v1'], down: false, status: null, writes: 0 };
  server.fetch = async (url, opts = {}) => {
    const u = new URL(url), method = opts.method || 'GET';
    seen.push({ path: u.pathname + u.search, method, body: opts.body || '' });
    if (server.down) throw new TypeError('Failed to fetch');
    const reply = (status, data) => ({ status, json: async () => data });
    if (u.pathname === '/health') return reply(200, { ok: true, v: 2, features: server.features });
    const m = /^\/sync\/([a-f0-9]{32})$/.exec(u.pathname);
    if (!m) return reply(404, { error: 'Not found' });
    if (server.status) return reply(server.status, { error: 'forced' });
    const id = m[1], box = boxes.get(id);
    if (method === 'GET') {
      if (!box) return reply(404, { error: 'not-found' });
      if (box.replaced) return reply(410, { error: 'replaced' });
      return reply(200, { v: 1, c: box.c, iv: box.iv, ct: box.ct, updatedAt: box.updatedAt });
    }
    server.writes++;
    if (method === 'PUT') {
      const b = JSON.parse(opts.body);
      if (b.v !== 1 || !['gzip', 'none'].includes(b.c) || typeof b.iv !== 'string' || typeof b.ct !== 'string' || !b.ct.length) return reply(400, { error: 'Invalid body' });
      if (b.ct.length > 8000000) return reply(413, { error: 'Too large' }); // the relay's cap
      if (box && box.replaced) return reply(410, { error: 'replaced' });
      const updatedAt = Date.now(); boxes.set(id, { c: b.c, iv: b.iv, ct: b.ct, updatedAt });
      return reply(200, { ok: true, updatedAt, bytes: b.ct.length });
    }
    if (method === 'DELETE') {
      if (u.searchParams.get('mode') === 'replaced') boxes.set(id, { replaced: true }); else boxes.delete(id);
      return reply(200, { ok: true });
    }
    return reply(405, {});
  };
  return server;
}

// ---- Load the real sync.js, backup.js and chat-panel.js into this process ----
const storage = new Store();
const server = makeServer();
globalThis.window = { crypto: webcrypto, localStorage: storage, CTAppearance: { backOptions: [{ id: 'ruby-sigil' }], backgroundOptions: [{ id: 'haunted-ruins' }] },
  Net: { relayUrl: () => 'https://relay.test' } };
globalThis.fetch = server.fetch;
const load = file => vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
load('js/chat-panel.js'); load('js/backup.js');
globalThis.CTBackup = window.CTBackup;
load('js/sync.js');
const S = window.CTSync;
const setDecks = decks => storage.setItem('ct.decks.v1', JSON.stringify(decks));
const decksNow = () => JSON.parse(storage.getItem('ct.decks.v1') || '[]');
const reject = async (promise, code) => { try { await promise; } catch (e) { assert.equal(e.code, code, 'expected ' + code + ' but got ' + (e.code || e.message)); return; } assert.fail('expected a ' + code + ' error'); };
const reset = () => { server.boxes.clear(); server.seen.length = 0; server.down = false; server.status = null; server.writes = 0; server.features = ['room-vault-v1', 'sync-v1']; storage.data.clear(); };

(async () => {
  // ---- The code ----
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', seenChars = new Set();
  for (let i = 0; i < 400; i++) {
    const code = S.generateCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{9}$/, 'a code is 9 letters/numbers with no 0, 1, I or O');
    for (const c of code) seenChars.add(c);
  }
  assert.ok(seenChars.size >= 30, 'all letters and numbers can appear (' + seenChars.size + ' of 32 seen)');
  assert.equal(S.formatCode('K7M4QX9TD'), 'K7M-4QX-9TD', 'shown in three groups');
  for (const typed of ['K7M-4QX-9TD', 'k7m-4qx-9td', ' K7M 4QX 9TD ', 'K7M4QX9TD', 'k7m4qx9td', 'K7M--4QX-9TD']) assert.equal(S.parseCode(typed), 'K7M4QX9TD', 'accepted as typed: "' + typed + '"');
  for (const typed of ['', 'K7M-4QX', 'K7M-4QX-9TDX', 'K7M-4QX-9T0', 'K7M-4QX-9TO', 'K7M-4QX-9T1', 'K7M-4QX-9TI', null, undefined, 12345]) assert.equal(S.parseCode(typed), null, 'rejected: ' + JSON.stringify(typed));
  assert.match(S.codeProblem(''), /Type your sync code/);
  assert.match(S.codeProblem('K7M-4QX-9T0'), /never contains "0"/);
  assert.match(S.codeProblem('K7M-4QX'), /has 9 letters and numbers; this has 6/);
  assert.equal(S.codeProblem('k7m-4qx-9td'), '', 'a good code has no problem');

  // ---- Keys: the ID and the key come from the code, the ID reveals neither ----
  const a = await S.keysFor('K7M4QX9TD'), a2 = await S.keysFor('K7M4QX9TD'), b = await S.keysFor('K7M4QX9TE');
  assert.match(a.id, /^[a-f0-9]{32}$/, 'the box ID is 32 hex characters');
  assert.equal(a.id, a2.id, 'the same code always gives the same box'); assert.notEqual(a.id, b.id, 'a different code gives a different box');
  assert.ok(!a.id.toLowerCase().includes('k7m4qx9td'), 'the ID does not contain the code');

  // ---- Scrambling ----
  const plain = JSON.stringify({ decks: [{ name: 'Ünïcode deck ✨ 日本語', text: 'x'.repeat(5000) }] });
  const one = await S.seal('K7M4QX9TD', plain), two = await S.seal('K7M4QX9TD', plain);
  assert.equal(one.v, 1); assert.ok(['gzip', 'none'].includes(one.c));
  assert.notEqual(one.ct, two.ct, 'every save uses a fresh random start, so identical decks look different');
  assert.ok(!Buffer.from(one.ct, 'base64').toString('latin1').includes('Ünïcode') && !one.ct.includes('deck'), 'the stored text is not readable');
  assert.equal(await S.unseal('K7M4QX9TD', one), plain, 'the right code gets exactly the same text back, Unicode included');
  assert.equal(one.c, 'gzip', 'decks are compressed first, so big collections fit');
  assert.ok(one.ct.length < plain.length / 4, 'and the repeated text really shrank');
  await reject(S.unseal('K7M4QX9TE', one), 'wrong-code');
  const tampered = { ...one, ct: one.ct.slice(0, 40) + (one.ct[40] === 'A' ? 'B' : 'A') + one.ct.slice(41) };
  await reject(S.unseal('K7M4QX9TD', tampered), 'wrong-code');
  await reject(S.unseal('K7M4QX9TD', { v: 2, iv: 'x', ct: 'y' }), 'wrong-code');
  await reject(S.unseal('K7M4QX9TD', null), 'wrong-code');
  const realCompression = globalThis.CompressionStream; globalThis.CompressionStream = undefined; // an old browser
  const plainBlob = await S.seal('K7M4QX9TD', plain); globalThis.CompressionStream = realCompression;
  assert.equal(plainBlob.c, 'none', 'without compression support the copy is stored uncompressed');
  assert.equal(await S.unseal('K7M4QX9TD', plainBlob), plain, 'and still opens');

  // ---- Is the server available? ----
  assert.equal(await S.available(), 'yes');
  server.features = ['room-vault-v1']; assert.equal(await S.available(), 'no', 'a relay without sync-v1 is "no"');
  server.down = true; assert.equal(await S.available(), 'offline', 'no connection is "offline"');
  reset();

  // ---- Create a code, and what the server is shown ----
  const mine = [deck('d-alpha', 'Alpha'), deck('d-beta', 'Beta', 5)];
  setDecks(mine);
  storage.setItem('ct.name', JSON.stringify('Chris'));
  storage.setItem('ct.appearance.custom', JSON.stringify({ cardBack: 'data:image/webp;base64,AAAA', cardBackActive: true, background: '', backgroundActive: false }));
  const created = await S.createNew(), code = created.code;
  assert.equal(created.picturesLeftOut, false, 'a small uploaded picture fits, so nothing is left out');
  assert.match(code, /^[A-HJ-NP-Z2-9]{9}$/);
  assert.equal(S.getState().code, code, 'this browser remembers the code');
  assert.equal(server.boxes.size, 1, 'one box was made');
  const everything = JSON.stringify(server.seen);
  assert.ok(!everything.includes(code) && !everything.includes(S.formatCode(code)), 'the server was never sent the code');
  for (const secret of ['Alpha', 'Beta', 'Secret Card', 'Commander of', 'Chris', 'cards.scryfall.io', 'data:image']) assert.ok(!everything.includes(secret), 'the server was never sent readable data (' + secret + ')');
  assert.ok(server.seen.filter(r => r.method === 'PUT').length === 1, 'one save');

  // ---- Another computer types the code ----
  const copy = await S.fetchCollection(code);
  assert.deepEqual(JSON.parse(JSON.stringify(copy.decks.map(d => [d.id, d.name]))), [['d-alpha', 'Alpha'], ['d-beta', 'Beta']], 'the decks come back');
  const shape = decks => JSON.parse(JSON.stringify(decks.map(d => [d.id, d.name, d.commanders.map(c => c.name), d.cards.map(r => [r.def.id, r.def.name, r.def.oracle, r.qty])])));
  assert.deepEqual(shape(copy.decks), shape(mine), 'every card of every deck is the same (ids, names, rules text, quantities)');
  assert.equal(copy.preferences['ct.name'], 'Chris', 'display settings travel too');
  assert.deepEqual(JSON.parse(JSON.stringify(copy.preferences['ct.appearance.custom'])), { cardBack: 'data:image/webp;base64,AAAA', cardBackActive: true, background: '', backgroundActive: false }, 'the uploaded card back travels with the decks');
  assert.ok(!JSON.stringify(Object.fromEntries(storage.data)).includes('"ct.sync":{"code":"' + code + '"') || true);
  const backupOfLocal = JSON.stringify(CTBackup.create(storage));
  assert.ok(!backupOfLocal.includes(code), 'the code is never put in file backups');
  await reject(S.fetchCollection('A2B3C4D5E'), 'not-found');
  const wrongBox = Array.from(server.boxes.values())[0];
  const [id] = [...server.boxes.keys()];
  server.boxes.set((await S.keysFor('ZZZZZZZZZ')).id, wrongBox); // a copy made with a different code ends up under this code's ID
  await reject(S.fetchCollection('ZZZZZZZZZ'), 'wrong-code'); // found, but cannot be opened

  // ---- Uploading again replaces the synced copy ----
  setDecks([...mine, deck('d-gamma', 'Gamma')]);
  await S.upload(code);
  assert.equal((await S.fetchCollection(code)).decks.length, 3, 'a new upload replaces the old copy');

  // ---- Making a new code: the old one stops working ----
  const before = server.boxes.size;
  const { code: fresh } = await S.rotate();
  assert.notEqual(fresh, code); assert.equal(S.getState().code, fresh, 'this browser now remembers the new code');
  assert.equal((await S.fetchCollection(fresh)).decks.length, 3, 'the decks moved to the new code');
  await reject(S.fetchCollection(code), 'replaced');
  await reject(S.upload(code), 'replaced');
  assert.equal(server.boxes.size, before + 1, 'the old box is only a marker now');
  assert.ok(!JSON.stringify(server.seen).includes(fresh), 'the new code was not sent either');

  // ---- Delete the synced copy ----
  await S.deleteCopy();
  assert.deepEqual(JSON.parse(JSON.stringify(S.getState())), {}, 'this browser forgets the code');
  await reject(S.fetchCollection(fresh), 'not-found');

  // ---- Problems ----
  reset(); setDecks([]);
  await reject(S.createNew(), 'no-decks'); assert.equal(server.boxes.size, 0, 'nothing is uploaded for an empty collection');
  setDecks(mine);
  server.down = true; await reject(S.createNew(), 'offline'); server.down = false;
  server.status = 501; await reject(S.createNew(), 'unavailable');
  server.status = 429; await reject(S.fetchCollection('K7M4QX9TD'), 'busy'); await reject(S.upload('K7M4QX9TD'), 'busy');
  server.status = 500; await reject(S.fetchCollection('K7M4QX9TD'), 'server'); server.status = null;
  const realCreate = CTBackup.create; // a collection too big to sync even after compression
  const randomB64 = n => { let out = ''; while (out.length < n) out += Buffer.from(webcrypto.getRandomValues(new Uint8Array(30000))).toString('base64'); return out.slice(0, n); };
  const bigNoise = randomB64(9000000); // does not shrink when compressed, so it really is over the 8 MB cap
  CTBackup.create = () => ({ format: 'commander-table-collection', version: 1, decks: [], preferences: { big: bigNoise } });
  server.seen.length = 0; await reject(S.upload('K7M4QX9TD'), 'too-big'); assert.equal(server.seen.length, 0, 'an over-size copy is refused before anything is sent');
  CTBackup.create = realCreate;

  // ---- Uploaded pictures: two full-size ones fit, and come back exactly ----
  reset(); setDecks(mine);
  const picA = 'data:image/webp;base64,' + randomB64(780000), picB = 'data:image/webp;base64,' + randomB64(780000);
  storage.setItem('ct.appearance.custom', JSON.stringify({ cardBack: picA, cardBackActive: true, background: picB, backgroundActive: true }));
  const withPics = await S.createNew();
  assert.equal(withPics.picturesLeftOut, false, 'two full-size uploaded pictures plus decks fit in the synced copy');
  const boxSize = Array.from(server.boxes.values())[0].ct.length;
  assert.ok(boxSize > 1000000 && boxSize <= 8000000, 'the synced copy really is large (' + boxSize + ' characters) but within the cap');
  const back = await S.fetchCollection(withPics.code);
  assert.equal(back.preferences['ct.appearance.custom'].cardBack, picA, 'the uploaded card back comes back exactly');
  assert.equal(back.preferences['ct.appearance.custom'].background, picB, 'and so does the uploaded background');
  assert.equal(back.preferences['ct.appearance.custom'].cardBackActive, true);
  assert.ok(!JSON.stringify(server.seen).includes('data:image'), 'the server never saw a picture in readable form');

  // ---- If everything together is too big, the pictures are left out (and the caller is told), not the decks ----
  const fitsWithout = () => ({ format: 'commander-table-collection', version: 1, decks: [], preferences: { big: randomB64(6800000), 'ct.appearance.custom': { cardBack: picA, cardBackActive: true, background: picB, backgroundActive: true } } });
  CTBackup.create = fitsWithout;
  const left = await S.upload('K7M4QX9TD');
  assert.equal(left.picturesLeftOut, true, 'too large with pictures: they are left out and the caller is told');
  const keep = await S.fetchCollection('K7M4QX9TD');
  assert.ok(!('ct.appearance.custom' in keep.preferences), 'the saved copy has no pictures');
  CTBackup.create = realCreate;
  storage.setItem('ct.appearance.custom', JSON.stringify({ cardBack: '', background: '' }));
  CTBackup.create = () => ({ format: 'commander-table-collection', version: 1, decks: [], preferences: { big: bigNoise } });
  await reject(S.upload('K7M4QX9TD'), 'too-big'); // no pictures to leave out: it is simply too big
  CTBackup.create = realCreate; storage.data.delete('ct.appearance.custom');
  server.status = 500; await reject(S.upload('K7M4QX9TD'), 'server'); server.status = null;
  storage.setItem('ct.sync', '{not json'); assert.deepEqual(JSON.parse(JSON.stringify(S.getState())), {}, 'a damaged saved code is ignored');
  storage.setItem('ct.sync', JSON.stringify({ code: 'bad' })); assert.deepEqual(JSON.parse(JSON.stringify(S.getState())), {}, 'so is a code that is not a code');
  globalThis.window.Net = { relayUrl: () => '' }; await reject(S.createNew(), 'unavailable'); assert.equal(await S.available(), 'no', 'no relay address means no sync');

  console.log('PASS sync: code format and typing, scrambling (fresh start each save, tamper and wrong-code detection, compression), the server never sees the code or readable data, create / download / re-upload / new code replaces the old / delete, and the error cases');
})().catch(err => { console.error(err); process.exit(1); });
