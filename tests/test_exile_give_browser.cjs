/* Real-browser check of "Exile, and give to player" (two real players): the card lands in the other player's exile marked playable, face down it stays secret from everyone else, playing it clears the mark, and it goes home to its owner when it leaves. Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_exile_give_browser.cjs
 * Set CT_CHROMIUM if Chromium is not at /usr/bin/chromium. Never touches Cloudflare. */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const mkDeck = who => ({
  id: 'share-' + who, name: who + ' deck', commanders: [], tokens: [], createdAt: '2026-11-02', source: '',
  cards: Array.from({ length: 40 }, (_, i) => ({ def: { id: who + '-c' + i, name: `${who} Card ${String(i).padStart(2, '0')}`, type: 'Creature', ci: ['U'], tokens: [], img: 'https://cards.scryfall.io/normal/front/x/' + who + i + '.jpg' }, qty: 1 }))
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];

  async function player(name) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.route('https://cards.scryfall.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
    page.setDefaultTimeout(30000);
    const frames = [];
    page.on('websocket', ws => ws.on('framereceived', f => frames.push(typeof f.payload === 'string' ? f.payload : '')));
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.addInitScript(({ deck, name }) => {
      localStorage.setItem('ct.decks.v1', JSON.stringify([deck]));
      localStorage.setItem('ct.name', JSON.stringify(name));
    }, { deck: mkDeck(name), name });
    await page.goto(BASE);
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    return Object.assign(page, { frames, playerName: name });
  }
  const pickColor = async (page, color) => { await page.locator(`.ct-player-color-option[data-color="${color}"]`).click(); };
  async function hostGame(name, color) {
    const page = await player(name);
    await page.locator('#hostBtn').click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await pickColor(page, color);
    await page.waitForFunction(() => CT.S.role === 'host' && CT.S.room && CT.S.table.colors[CT.S.pid]);
    return page;
  }
  const pidOf = page => page.evaluate(() => CT.S.pid);
  async function joinGame(name, room, color) {
    const page = await player(name);
    await page.locator('#joinIn').fill(room);
    await page.locator('#joinBtn').click();
    await page.getByRole('button', { name: 'Join game', exact: true }).click();
    await pickColor(page, color);
    await page.waitForFunction(() => CT.S.table && CT.S.table.seats.includes(CT.S.pid));
    return page;
  }


  try {
    const dad = await hostGame('Dad', 'gold');
    const son = await joinGame('Son', await dad.evaluate(() => CT.S.room), 'red');
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    const dadPid = await pidOf(dad), sonPid = await pidOf(son);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const libTop = async (pg, n) => pg.evaluate(n => CT.S.me.zones.library.slice(0, n).map(c => c.iid), n);
    const [a, b] = await libTop(dad, 2);
    // Face up: Son gets it in his exile, marked playable, and its name is in the log.
    await dad.evaluate(iid => CT.giveToExile(iid, CT.S.table.seats.find(p => p !== CT.S.pid), false), a);
    await son.waitForFunction(iid => CT.S.me.zones.exile.some(c => c.iid === iid && c.xp && !c.fd), a);
    assert.equal(await dad.evaluate(iid => !CT.S.me.zones.library.concat(CT.S.me.zones.exile).some(c => c.iid === iid), a), true, 'it left the giver\'s zones');
    // Face down: only Son can tell what it is.
    await dad.evaluate(iid => CT.giveToExile(iid, CT.S.table.seats.find(p => p !== CT.S.pid), true), b);
    await son.waitForFunction(iid => CT.S.me.zones.exile.some(c => c.iid === iid && c.xp && c.fd), b);
    await dad.waitForFunction(([pid, iid]) => ((CT.S.players[pid] || { zones: { exile: [] } }).zones.exile || []).some(x => x.iid === iid), [sonPid, b]);
    const seenByDad = await dad.evaluate(([pid, iid]) => { const c = CT.S.players[pid].zones.exile.find(x => x.iid === iid); return c && { id: c.id, fd: c.fd, xp: c.xp }; }, [sonPid, b]);
    assert.ok(seenByDad && seenByDad.fd && !seenByDad.id, 'the giver and everyone else only see a face-down card: ' + JSON.stringify(seenByDad));
    assert.equal(await son.evaluate(iid => !!CT.S.me.defs[CT.S.me.zones.exile.find(c => c.iid === iid).id], b), true, 'the receiver knows what it is');
    const log = await dad.evaluate(() => CT.S.log.map(l => JSON.stringify(l)).join('\n'));
    assert.ok(/gave it to Son/.test(log), 'logged');
    // Reminders for the receiver.
    await son.waitForFunction(() => /Reminders · 2/.test((document.querySelector('#remTab') || {}).textContent || ''), null, { timeout: 8000 });
    await son.locator('#remTab').click();
    const txt = (await son.locator('#remPanel').innerText()).replace(/\s+/g, ' ');
    assert.ok(/in exile\).*You may play this card from exile \(owned by Dad\)/.test(txt), 'play-from-exile reminder: ' + txt);
    // Playing it: leaves exile onto the battlefield face up, mark cleared.
    await son.evaluate(iid => CT.doMove(iid, 'battlefield'), b);
    const played = await son.evaluate(iid => { const c = CT.S.me.zones.battlefield.find(x => x.iid === iid); return c && { fd: c.fd, xp: c.xp, own: c.own }; }, b);
    assert.ok(played && !played.fd && !played.xp && played.own === dadPid, 'played face up, no longer marked: ' + JSON.stringify(played));
    // Leaving to the graveyard sends the face-up one home to its owner.
    await son.evaluate(iid => CT.doMove(iid, 'graveyard'), a);
    await dad.waitForFunction(iid => CT.S.me.zones.graveyard.some(c => c.iid === iid && !c.xp), a);
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS exile and give: lands in the receiver\'s exile marked playable, face down stays secret, reminder shown, playing clears the mark, leaving exile goes home to the owner');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
