/* Real-browser check of the sync code window. Needs the page and a local copy of the relay (with the SYNC binding)
 * running first, like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112, ROOMS + DIRECTORY + SYNC bindings>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_sync_browser.cjs
 * Set CT_CHROMIUM if Chromium is not at /usr/bin/chromium. Never touches Cloudflare. */
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('playwright');

const PAGE = relay => 'http://127.0.0.1:8107/index.html?relay=' + encodeURIComponent(relay);
const RELAY = 'http://127.0.0.1:8112';
const card = (id, name) => ({ id, name, type: 'Creature', ci: ['U'], img: '', oracle: 'Rules text', tokens: [] });
const deck = (id, name, n) => ({ id, name, createdAt: '2026-10-30T00:00:00Z', source: '', tokens: [], commanders: [card('cmd-' + id, 'Commander of ' + name)],
  cards: Array.from({ length: n }, (_, i) => ({ def: card(id + '-c' + i, 'Card ' + i + ' of ' + name), qty: 2 })) });
const alpha = deck('sync-alpha', 'Alpha deck', 4), beta = deck('sync-beta', 'Beta deck', 6);
// A real 1x1 WebP, standing in for a picture uploaded in "Your look" (the game keeps uploads as WebP text).
const TINY = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
const LOOK = { 'ct.appearance': JSON.stringify({ cardBack: 'gilded-knight', background: 'haunted-ruins' }),
  'ct.appearance.custom': JSON.stringify({ cardBack: TINY, cardBackActive: true, background: TINY + 'A'.repeat(0), backgroundActive: true }) };
const countOf = d => d.cards.reduce((n, r) => n + r.qty, 0) + d.commanders.length;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  // A relay that is up but has no sync, to see the "not available yet" message.
  const noSync = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ ok: true, v: 2, features: ['room-vault-v1'] })); });
  await new Promise(r => noSync.listen(8199, '127.0.0.1', r));

  async function computer(name, decks, relay = RELAY, look = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.addInitScript(({ decks, name, look }) => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1'); // seed once, not again after a reload
      for (const [k, v] of Object.entries(look)) localStorage.setItem(k, v);
      if (decks.length) { localStorage.setItem('ct.decks.v1', JSON.stringify(decks)); localStorage.setItem('ct.selDeck', JSON.stringify(decks[0].id)); }
      localStorage.setItem('ct.name', JSON.stringify(name));
    }, { decks, name, look });
    await page.goto(PAGE(relay));
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    await page.waitForFunction(() => window.CT && document.querySelector('#deckList'));
    return Object.assign(page, { ctx, computerName: name });
  }
  // Open the sync window from the Deck Builder (the footer button, or the empty-state button on a computer with no decks).
  async function openSync(page) {
    await page.locator('#editDeckBtn').click();
    const footer = page.getByRole('button', { name: 'Sync across computers…', exact: true });
    await footer.first().click();
    const dialog = page.locator('.w-sync-dialog');
    await dialog.waitFor();
    await dialog.locator('[data-sync-body] button, [data-sync-body] input').first().waitFor(); // "Checking…" is over
    return dialog;
  }
  const status = dialog => dialog.locator('[data-sync-status]');
  const stored = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
  const syncState = async page => JSON.parse((await stored(page, 'ct.sync')) || '{}');
  const closeAll = async page => { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.locator('.w-dialog').first().waitFor({ state: 'detached' }).catch(() => {}); };
  const rowsOf = async page => page.locator('#deckList .deck-row').allInnerTexts();

  try {
    // ---- 1. Computer A has decks and makes a code. ----
    const A = await computer('Computer A', [alpha, beta], RELAY, LOOK);
    let dlg = await openSync(A);
    assert.match(await dlg.innerText(), /Create a sync code/);
    assert.match(await dlg.innerText(), /Already have a code/);
    assert.match(await dlg.innerText(), /the one card back picture and one background picture you can upload in Your look \(the game keeps one of each\)/, 'the window says only two pictures can come along');
    await dlg.getByRole('button', { name: 'Create a sync code' }).click();
    await status(dlg).filter({ hasText: 'Your sync code is' }).waitFor();
    const code = (await dlg.locator('[data-sync-code]').innerText()).trim();
    assert.match(code, /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/, 'a code like K7M-4QX-9TD is shown');
    assert.equal((await syncState(A)).code, code.replace(/-/g, ''), 'computer A remembers the code');
    assert.ok(!(await stored(A, 'ct.decks.v1')).includes(code.replace(/-/g, '')), 'the code is not stored inside the decks');
    await dlg.getByRole('button', { name: 'Hide' }).click();
    assert.equal((await dlg.locator('[data-sync-code]').innerText()).trim(), '•••-•••-•••', 'the code can be hidden');
    await dlg.getByRole('button', { name: 'Show' }).click();
    assert.equal((await dlg.locator('[data-sync-code]').innerText()).trim(), code, 'and shown again');
    await closeAll(A);

    // ---- 2. Computer B is empty and types the code (any capitalization, no hyphens). ----
    const B = await computer('Computer B', []);
    assert.equal((await rowsOf(B)).length, 0, 'computer B starts with no decks');
    dlg = await openSync(B);
    assert.equal(await dlg.getByRole('button', { name: 'Upload this computer\'s decks' }).count(), 0, 'no upload before there is a code');
    await dlg.locator('#ctSyncCodeIn').fill(code.replace(/-/g, '').toLowerCase());
    await dlg.getByRole('button', { name: 'Get my decks' }).click();
    await dlg.locator('.sync-offer').waitFor();
    assert.match(await dlg.locator('.sync-offer').innerText(), /2 decks in sync: 2 to add, 0 already here/, 'B is told what it will get');
    assert.equal(await B.evaluate(() => JSON.parse(localStorage.getItem('ct.decks.v1') || '[]').length), 0, 'nothing is added until B agrees');
    assert.match(await dlg.locator('.sync-offer').innerText(), /including the card back and background picture you uploaded/, 'B is told the synced copy has uploaded pictures');
    assert.equal(await dlg.locator('[data-sync-prefs]').isChecked(), true, 'a computer with no look of its own takes the synced one by default');
    await dlg.getByRole('button', { name: /Add them and continue/ }).click();
    await B.waitForFunction(() => document.querySelectorAll('#deckList .deck-row').length === 2);
    assert.equal(await stored(B, 'ct.appearance.custom'), LOOK['ct.appearance.custom'], 'the uploaded card back and background arrived on computer B');
    assert.equal(await stored(B, 'ct.appearance'), LOOK['ct.appearance'], 'and so did the chosen card back and background');
    assert.equal(await B.locator('#cardBackPicker [data-appearance-id="custom-local"]').count(), 1, 'B shows "Your upload" in the card back choices');
    assert.equal(await B.locator('#backgroundPicker [data-appearance-id="custom-local"]').count(), 1, 'and in the background choices');
    const rows = await rowsOf(B);
    assert.ok(rows.some(r => r.includes('Alpha deck') && r.includes(countOf(alpha) + ' cards')) && rows.some(r => r.includes('Beta deck') && r.includes(countOf(beta) + ' cards')), 'B now has A\'s decks with the right card counts');
    assert.equal((await syncState(B)).code, code.replace(/-/g, ''), 'B remembers the code too');
    assert.ok((await syncState(B)).downloadedAt > 0);

    // ---- 3. A deck from B can start a game (the copy is a real, playable deck). ----
    await B.locator('#deckList .deck-row', { hasText: 'Alpha deck' }).click();
    await B.locator('#soloBtn').click();
    await B.waitForFunction(() => window.CT && CT.S.role === 'solo' && CT.S.me && CT.S.me.zones.hand.length === 7);
    await B.getByRole('button', { name: /^(☰|Menu)/ }).first().click(); // back to the start screen
    await B.locator('text=/^Leave game$/').click();
    await B.getByRole('button', { name: 'Leave', exact: true }).click();
    await B.waitForFunction(() => !document.querySelector('#lobby').classList.contains('hidden'));

    // ---- 4. B makes a new code: A's old code stops working. ----
    dlg = await openSync(B);
    assert.match(await dlg.locator('[data-sync-code]').innerText(), /•••/, 'the code starts hidden on a computer that already has one');
    await dlg.locator('summary', { hasText: 'More' }).click();
    await dlg.getByRole('button', { name: 'Make a new code…' }).click();
    await B.getByRole('button', { name: 'Make a new code', exact: true }).click();
    await status(dlg).filter({ hasText: 'Your new sync code is' }).waitFor();
    const code2 = (await dlg.locator('[data-sync-code]').innerText()).trim();
    assert.notEqual(code2, code, 'a different code');
    assert.match(await status(dlg).innerText(), /old code no longer works/);
    assert.equal((await syncState(B)).code, code2.replace(/-/g, ''), 'B now remembers the new code');
    await closeAll(B);

    // ---- 5. A still has the old code: it is told it was replaced, and switches to the new code. ----
    dlg = await openSync(A);
    await dlg.getByRole('button', { name: 'Download decks from sync' }).click();
    await status(dlg).filter({ hasText: 'replaced by a newer one' }).waitFor();
    assert.equal(await A.evaluate(() => document.activeElement && document.activeElement.id), 'ctSyncCodeIn', 'the box for the new code is ready to type in');
    await dlg.locator('#ctSyncCodeIn').fill(code2);
    await dlg.locator('#ctSyncCodeIn').press('Enter'); // Enter works, not just the button
    await dlg.locator('.sync-offer').waitFor();
    assert.match(await dlg.locator('.sync-offer').innerText(), /2 decks in sync: 0 to add, 2 already here/, 'A already has these decks, so nothing is added');
    assert.equal(await dlg.locator('[data-sync-prefs]').isChecked(), false, 'a computer that has its own look is asked, not overwritten');
    assert.match(await dlg.locator('.sync-offer').innerText(), /replaces this computer's current card back/);
    await dlg.getByRole('button', { name: /Remember this code and continue/ }).click();
    await A.waitForFunction(() => document.querySelector('#deckList'));
    await A.waitForFunction(c => JSON.parse(localStorage.getItem('ct.sync') || '{}').code === c, code2.replace(/-/g, ''));
    assert.equal((await rowsOf(A)).length, 2, 'A lost nothing');

    // ---- 6. Typing mistakes and unknown codes give clear messages. ----
    dlg = await openSync(A);
    await dlg.locator('summary', { hasText: 'More' }).click();
    await dlg.locator('#ctSyncCodeIn').fill('ABC-DEF-GH0');
    await dlg.getByRole('button', { name: 'Get my decks' }).click();
    await status(dlg).filter({ hasText: 'never contains "0"' }).waitFor();
    await dlg.locator('#ctSyncCodeIn').fill('ABC-DEF');
    await dlg.getByRole('button', { name: 'Get my decks' }).click();
    await status(dlg).filter({ hasText: 'has 9 letters and numbers; this has 6' }).waitFor();
    await dlg.locator('#ctSyncCodeIn').fill('ABC-DEF-GHJ');
    await dlg.getByRole('button', { name: 'Get my decks' }).click();
    await status(dlg).filter({ hasText: 'No decks were found for that code' }).waitFor();
    assert.equal((await syncState(A)).code, code2.replace(/-/g, ''), 'a failed attempt does not change the remembered code');
    await closeAll(A);

    // ---- 7. Uploading warns before it would drop decks the other computer has. ----
    await A.evaluate(() => { const d = JSON.parse(localStorage.getItem('ct.decks.v1')); localStorage.setItem('ct.decks.v1', JSON.stringify(d.filter(x => x.id !== 'sync-beta'))); });
    dlg = await openSync(A);
    await dlg.getByRole('button', { name: 'Upload this computer\'s decks' }).click();
    const warning = A.locator('.w-dialog', { hasText: 'Replace the synced copy?' });
    await warning.waitFor();
    assert.match(await warning.innerText(), /1 deck this computer does not have \(Beta deck\)/, 'it names the deck that would be removed from sync');
    await warning.getByRole('button', { name: 'Cancel', exact: true }).click();
    await status(dlg).filter({ hasText: 'Nothing was uploaded' }).waitFor();
    await closeAll(A);
    dlg = await openSync(B);
    await dlg.getByRole('button', { name: 'Download decks from sync' }).click();
    await dlg.locator('.sync-offer').waitFor();
    assert.match(await dlg.locator('.sync-offer').innerText(), /2 decks in sync/, 'cancelling left the synced copy untouched');
    await closeAll(B);
    dlg = await openSync(A);
    await dlg.getByRole('button', { name: 'Upload this computer\'s decks' }).click();
    await A.locator('.w-dialog', { hasText: 'Replace the synced copy?' }).getByRole('button', { name: 'Replace anyway' }).click();
    await status(dlg).filter({ hasText: 'Uploaded 1 deck and your uploaded pictures.' }).waitFor(); // A has uploaded pictures, so the message says they went too
    await closeAll(A);
    dlg = await openSync(B);
    await dlg.getByRole('button', { name: 'Download decks from sync' }).click();
    await dlg.locator('.sync-offer').waitFor();
    assert.match(await dlg.locator('.sync-offer').innerText(), /1 deck in sync/, '"Replace anyway" replaced the synced copy');
    await closeAll(B);

    // ---- 8. Stop syncing, and delete the synced copy. ----
    dlg = await openSync(A);
    await dlg.locator('summary', { hasText: 'More' }).click();
    await dlg.getByRole('button', { name: 'Stop syncing on this computer' }).click();
    assert.deepEqual(await syncState(A), {}, 'this computer forgets the code');
    await status(dlg).filter({ hasText: 'no longer syncs' }).waitFor();
    assert.match(await dlg.innerText(), /Create a sync code/, 'and offers to start again');
    await closeAll(A);
    dlg = await openSync(B);
    await dlg.locator('summary', { hasText: 'More' }).click();
    await dlg.getByRole('button', { name: 'Delete the synced copy…' }).click();
    await B.getByRole('button', { name: 'Delete', exact: true }).click();
    await status(dlg).filter({ hasText: 'synced copy was deleted' }).waitFor();
    assert.deepEqual(await syncState(B), {}, 'B forgets the code too');
    assert.equal((await rowsOf(B)).length, 2, 'B still has its decks');
    await closeAll(B);
    dlg = await openSync(A);
    await dlg.locator('#ctSyncCodeIn').fill(code2);
    await dlg.getByRole('button', { name: 'Get my decks' }).click();
    await status(dlg).filter({ hasText: 'No decks were found for that code' }).waitFor();

    // ---- 9. No connection, and a server without sync. ----
    const off = await computer('Offline', [alpha], 'http://127.0.0.1:9');
    dlg = await openSync(off);
    await dlg.getByText(/Can't reach the game's server/).waitFor();
    assert.equal(await dlg.getByRole('button', { name: 'Create a sync code' }).count(), 0, 'no buttons that cannot work');
    const old = await computer('Old server', [alpha], 'http://127.0.0.1:8199');
    dlg = await openSync(old);
    await dlg.getByText(/Sync isn't available on the game's server yet/).waitFor();
    assert.equal(await dlg.getByRole('button', { name: 'Try again' }).count(), 1);

    // ---- 10. A computer with no decks cannot make a code. ----
    const empty = await computer('Empty', []);
    dlg = await openSync(empty);
    await dlg.getByRole('button', { name: 'Create a sync code' }).click();
    await status(dlg).filter({ hasText: "don't have any decks on this computer yet" }).waitFor();

    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS sync (real browsers + local relay): create, get decks on a second computer, new code replaces the old one, replaced / wrong / mistyped codes, upload warning, stop syncing, delete, offline, no sync on the server, no decks');
  } finally {
    noSync.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
