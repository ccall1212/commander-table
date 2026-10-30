/* Real-browser saved-data upgrade check. Needs Playwright and a Chromium; opens the page straight from the file
 * (no server, no relay, no internet), the same way a downloaded ZIP is opened:
 *   NODE_PATH=<folder with playwright> node tests/test_saved_data_upgrade_browser.cjs
 * Set CT_CHROMIUM to a Chromium/Chrome executable if it is not at /usr/bin/chromium.
 *
 * For every release in tests/fixtures/saved-data/ (made by tools/make-saved-data-fixture.cjs) it loads what that real
 * release saved into a fresh browser and checks the CURRENT game: the deck list, the Deck Builder, resuming the saved
 * practice game (every zone, life, cards drawn), starting a new game from the old deck, restoring that release's own
 * backup file, and old preference values that no longer exist. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'index.html');
const dir = path.join(__dirname, 'fixtures', 'saved-data');
const files = fs.readdirSync(dir).filter(f => /^v\d+\.\d+\.\d+\.json$/.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const only = process.argv[2]; // optional: run a single release, e.g. v0.20.5

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];

  async function open(label, local, session = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
    await page.addInitScript(({ local, session }) => {
      if (sessionStorage.getItem('__seeded')) return; // seed once, not again after the Resume button reloads the page
      sessionStorage.setItem('__seeded', '1');
      for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, v);
    }, { local, session });
    await page.goto(PAGE);
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    await page.waitForFunction(() => window.CT && document.querySelector('#deckList'));
    return Object.assign(page, { ctx });
  }
  const ZONES = () => Object.fromEntries(['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command'].map(z => [z, (CT.S.me.zones[z] || []).length])); // runs inside the page
  const zoneCounts = me => Object.fromEntries(['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command'].map(z => [z, (me.zones[z] || []).length]));

  for (const file of files) {
    const tag = file.replace('.json', '');
    if (only && only !== tag) continue;
    const fx = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const sessKey = Object.keys(fx.localStorage).find(k => k.startsWith('ct.sess.'));
    const saved = JSON.parse(fx.localStorage[sessKey]);
    const expectZones = zoneCounts(saved.me), expectLife = saved.me.life;
    const mainDeck = fx.deckList.find(d => d.commanderNames.length), plainDeck = fx.deckList.find(d => !d.commanderNames.length);
    const local = { ...fx.localStorage };
    // Games older than 24 hours are not offered again, so refresh the saved game's clock: the one thing that is meant to differ.
    saved.at = Date.now(); local[sessKey] = JSON.stringify(saved);

    // ---- 1. Start screen: the old decks are listed with their names and counts; the Deck Builder opens them. ----
    let page = await open(tag + ' lobby', local);
    const rows = await page.locator('#deckList .deck-row').allInnerTexts();
    for (const d of fx.deckList) assert.ok(rows.some(r => r.includes(d.name) && r.includes(d.count + ' cards')), `${tag}: "${d.name}" (${d.count} cards) is listed`);
    assert.ok(await page.locator('#resumeBox').isVisible(), `${tag}: the saved game is offered for resuming`);
    assert.match(await page.locator('#resumeBox').innerText(), /Practice game/, `${tag}: it is the practice game`);
    await page.locator('#deckList .deck-row', { hasText: mainDeck.name }).click();
    await page.locator('#editDeckBtn').click();
    const builder = page.locator('.w-dialog').first();
    await builder.waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.w-dialog .w-vcard').length > 0);
    assert.ok(await page.locator('.w-dialog .w-vcard').count() >= 9, `${tag}: the Deck Builder shows the old deck's cards`);
    assert.match(await builder.innerText(), /Fixture Werewolf/, `${tag}: including the double-faced card`);
    await page.keyboard.press('Escape');

    // ---- 2. Resume the saved practice game: every zone, life and the cards on the table are back. ----
    await page.locator('#resumeBtn').click();
    await page.waitForFunction(() => window.CT && CT.S.role === 'solo' && CT.S.me && CT.S.me.zones);
    assert.deepEqual(await page.evaluate(ZONES), expectZones, `${tag}: all six zones come back with the same number of cards`);
    assert.equal(await page.evaluate(() => CT.S.me.life), expectLife, `${tag}: life total comes back`);
    assert.equal(await page.evaluate(() => CT.S.me.poison), saved.me.poison || 0, `${tag}: poison comes back`);
    await page.waitForFunction(n => document.querySelectorAll('#myBf .card[data-zone="battlefield"], .card[data-zone="battlefield"]').length >= n, expectZones.battlefield);
    const onTable = await page.evaluate(() => CT.S.me.zones.battlefield.map(c => { const d = CT.S.me.defs[c.id]; return d && d.name; }));
    assert.ok(onTable.every(n => typeof n === 'string' && n.length), `${tag}: every card on the table still resolves to a real card`);
    const resumed = await page.evaluate(() => CT.S.me.zones.battlefield.map(c => ({ iid: c.iid, t: !!c.t, fd: !!c.fd, c: c.c || {}, x: c.x, y: c.y })));
    for (const old of saved.me.zones.battlefield) {
      const now = resumed.find(c => c.iid === old.iid);
      assert.ok(now, `${tag}: card ${old.iid} is still on the battlefield`);
      assert.equal(now.t, !!old.t, `${tag}: tapped state kept`);
      assert.equal(now.fd, !!old.fd, `${tag}: face-down state kept`);
      assert.deepEqual(now.c, old.c || {}, `${tag}: counters kept`);
      assert.ok(Number.isFinite(now.x) && Number.isFinite(now.y) && now.x >= 0 && now.x <= 1000, `${tag}: the card still has a sensible position`);
    }
    assert.ok(resumed.some(c => c.t) && resumed.some(c => c.fd) && resumed.some(c => Object.keys(c.c).length), `${tag}: the saved game really had a tapped, a face-down and a countered card`);
    const drawn = await page.evaluate(() => [...document.querySelectorAll('.card[data-zone="battlefield"]')].map(c => c.dataset.iid));
    for (const c of saved.me.zones.battlefield) assert.ok(drawn.includes(c.iid), `${tag}: saved battlefield card ${c.iid} is drawn on the table`);
    // The resumed game still works: draw a card with the real game code path and see the zones change.
    const before = await page.evaluate(() => CT.S.me.zones.hand.length);
    await page.evaluate(() => { const me = CT.S.me; CT.act(() => { me.zones.hand.push(me.zones.library.shift()); return ['drew a card']; }); });
    assert.equal(await page.evaluate(() => CT.S.me.zones.hand.length), before + 1, `${tag}: the resumed game can still be played`);
    await page.ctx.close();

    // ---- 3. A brand-new game from the old deck deals correctly (no saved game in the way). ----
    const decksOnly = Object.fromEntries(Object.entries(local).filter(([k]) => !k.startsWith('ct.sess.') && k !== 'ct.last'));
    page = await open(tag + ' new game', decksOnly);
    await page.locator('#deckList .deck-row', { hasText: mainDeck.name }).click();
    await page.locator('#soloBtn').click();
    await page.waitForFunction(() => window.CT && CT.S.role === 'solo' && CT.S.me && CT.S.me.zones.hand.length);
    const fresh = await page.evaluate(ZONES);
    assert.equal(fresh.hand, 7, `${tag}: a new game deals seven cards`);
    assert.equal(fresh.command, 1, `${tag}: the commander starts in the command zone`);
    assert.equal(fresh.hand + fresh.library, mainDeck.count - 1, `${tag}: hand plus library is the whole deck apart from the commander`);
    assert.ok(await page.evaluate(() => Object.values(CT.S.me.defs).every(d => d && d.name)), `${tag}: every card has its definition`);
    await page.ctx.close();

    // ---- 4. The second old deck has no commander and still starts. ----
    page = await open(tag + ' no-commander', decksOnly);
    await page.locator('#deckList .deck-row', { hasText: plainDeck.name }).click();
    await page.locator('#soloBtn').click();
    await page.waitForFunction(() => window.CT && CT.S.role === 'solo' && CT.S.me && CT.S.me.zones.hand.length);
    const bare = await page.evaluate(ZONES);
    assert.equal(bare.command, 0); assert.equal(bare.hand + bare.library, plainDeck.count, `${tag}: a deck with no commander deals its whole list`);
    await page.ctx.close();

    // ---- 5. That release's own backup file restores into an empty browser. ----
    if (fx.backupFile) {
      page = await open(tag + ' backup', { 'ct.name': JSON.stringify('Restorer') });
      assert.equal(await page.locator('#deckList .deck-row').count(), 0, `${tag}: the new browser starts with no decks`);
      const restored = await page.evaluate(text => { const b = CTBackup.parse(text); const plan = CTBackup.plan(localStorage, b); CTBackup.restore(localStorage, b, false); return plan.added; }, fx.backupFile);
      assert.equal(restored, fx.deckList.length, `${tag}: the backup adds every deck`);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#deckList'));
      const rows2 = await page.locator('#deckList .deck-row').allInnerTexts();
      for (const d of fx.deckList) assert.ok(rows2.some(r => r.includes(d.name) && r.includes(d.count + ' cards')), `${tag}: "${d.name}" came back from its own backup`);
      await page.ctx.close();
    }
    console.log('PASS ' + tag + ': decks listed, Deck Builder, saved game resumed (' + JSON.stringify(expectZones) + ', life ' + expectLife + '), new games deal correctly' + (fx.backupFile ? ', own backup restores' : ''));
  }

  // ---- 6. Preferences that no longer exist (removed card backs, removed layouts) fall back safely. ----
  const base = JSON.parse(fs.readFileSync(path.join(dir, files.at(-1)), 'utf8'));
  const legacy = { 'ct.decks.v1': base.localStorage['ct.decks.v1'], 'ct.name': JSON.stringify('Legacy'), 'ct.selDeck': base.localStorage['ct.selDeck'],
    'ct.appearance': JSON.stringify({ cardBack: 'arcane-star', background: 'a-background-that-was-removed' }),
    'ct.view': JSON.stringify('focus'), 'ct.layout': JSON.stringify([{ nonsense: true }]), 'ct.openingMode': JSON.stringify('an-old-rule') };
  const page = await open('legacy prefs', legacy);
  const prefs = await page.evaluate(() => CTAppearance.getPrefs());
  assert.equal(prefs.cardBack, 'ruby-sigil', 'a removed card back falls back to Ruby Sigil');
  assert.ok(await page.locator('#backgroundPicker .selected').count() >= 1, 'a removed background still leaves one selected');
  await page.locator('#deckList .deck-row').first().click();
  await page.locator('#soloBtn').click();
  await page.waitForFunction(() => window.CT && CT.S.role === 'solo' && CT.S.me && CT.S.me.zones.hand.length);
  assert.ok(['side', 'grid'].includes(await page.evaluate(() => CT.S.view)), 'a removed layout falls back to Sidebar or Grid');
  await page.ctx.close();

  await browser.close();
  assert.deepEqual(errors, [], 'no page errors anywhere');
  console.log(`PASS saved-data upgrade (real browser, opened from file://): ${only ? only : files.length + ' releases from ' + files[0].replace('.json', '') + ' to ' + files.at(-1).replace('.json', '')}, plus removed preference values`);
})().catch(error => { console.error(error); process.exit(1); });
