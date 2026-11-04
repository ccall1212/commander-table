/* Real-browser check of the Victory screen: it appears for every player when all but one have conceded, not before, can be
 * closed, offers a new game only to the host, and goes away if a concession is undone (three real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_victory_browser.cjs
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
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
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
  const menu = page => page.getByRole('button', { name: /^(☰|Menu)/ }).first();
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
    const room = await dad.evaluate(() => CT.S.room);
    const son = await joinGame('Son', room, 'red');
    const mom = await joinGame('Mom', room, 'blue');
    await dad.waitForFunction(() => CT.S.table.seats.length === 3);
    const dadPid = await pidOf(dad), momPid = await pidOf(mom);
    for (const pg of [dad, son, mom]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son, mom]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const concede = async pg => {
      await menu(pg).click();
      await pg.locator('.w-menu-item', { hasText: 'Concede game' }).first().click();
      await pg.getByRole('button', { name: 'Concede', exact: true }).click();
    };
    const overlay = pg => pg.locator('#victoryOverlay');

    await concede(son);
    await dad.waitForFunction(() => CT.S.table.out && Object.keys(CT.S.table.out).length === 1);
    await dad.waitForTimeout(800);
    for (const pg of [dad, son, mom]) assert.equal(await overlay(pg).count(), 0, 'no victory while two players are still in');
    // Death screen: the player who conceded sees their own board go dark with a skull, and the others see it on their tile.
    const sonPid = await pidOf(son);
    await son.waitForFunction(() => document.body.classList.contains('me-out') && document.querySelector('#myBf.defeated'));
    const skull = (pg, sel) => pg.evaluate(q => { const el = document.querySelector(q); return !!el && getComputedStyle(el, '::after').backgroundImage.includes('death-skull.png'); }, sel);
    assert.equal(await skull(son, '#myBf.defeated'), true, 'Son sees a skull and crossbones over his own board');
    assert.equal(await dad.evaluate(() => document.body.classList.contains('me-out')), false, 'players still in the game are not darkened');
    for (const pg of [dad, mom]) {
      await pg.waitForFunction(p => document.querySelector(`.opp.tile[data-opp="${p}"].out`), sonPid);
      assert.equal(await skull(pg, `.opp.tile[data-opp="${sonPid}"].out .obf`), true, 'the others see a skull over the board of the player who conceded');
    }
    assert.equal(await dad.evaluate(p => getComputedStyle(document.querySelector(`.opp.tile[data-opp="${p}"].out .boardwrap`)).filter !== 'none', sonPid), true, 'and that board is greyed out');
    // Grid layout: the player's own quadrant gets the skull too.
    await son.evaluate(() => { CT.S.view = 'grid'; CT.render(); });
    await son.waitForFunction(() => document.querySelector('.opp.mytile.out'));
    assert.equal(await skull(son, '.opp.mytile.out .obf'), true, 'in Grid the skull covers the player\'s own quadrant');
    await son.evaluate(() => { CT.S.view = 'side'; CT.render(); });
    if (process.env.CT_SHOTS) { await son.screenshot({ path: process.env.CT_SHOTS + '/death-self.png' }); await dad.screenshot({ path: process.env.CT_SHOTS + '/death-others.png' }); }

    await concede(mom);
    for (const pg of [dad, son, mom]) await overlay(pg).waitFor();
    assert.match(await overlay(dad).innerText(), /VICTORY[\s\S]*You are the last one standing/, 'the winner is told they won');
    assert.match(await overlay(son).innerText(), /Dad wins!/, 'a player who conceded sees who won');
    assert.match(await overlay(mom).innerText(), /Dad wins!/);
    assert.match(await overlay(dad).innerText(), /Everyone else conceded: (Son, Mom|Mom, Son)/);
    assert.equal(await overlay(dad).locator('button', { hasText: 'Start a new game' }).count(), 1, 'the host can start a new game from it');
    assert.equal(await overlay(son).locator('button', { hasText: 'Start a new game' }).count(), 0, 'guests cannot');
    assert.ok(await overlay(dad).locator('.victory-confetti i').count() > 20, 'there is confetti');
    assert.ok((await dad.evaluate(() => CT.S.log.some(e => /Dad wins the game/.test(e.text)))), 'the log records the win');
    if (process.env.CT_SHOTS) await dad.screenshot({ path: process.env.CT_SHOTS + '/victory.png' });
    // Closing: the Close button and Escape.
    await overlay(dad).locator('button', { hasText: 'Close' }).click();
    assert.equal(await overlay(dad).count(), 0, 'Close works');
    await son.keyboard.press('Escape');
    assert.equal(await overlay(son).count(), 0, 'Escape closes it');
    assert.equal(await overlay(mom).count(), 1, 'closing is per player');
    // Undoing a concession takes the victory back, and conceding again shows it again.
    await dad.evaluate(pid => CT.hostRecv({ t: 'op', op: { k: 'reinstate', pid } }, CT.S.pid), momPid);
    await mom.waitForFunction(() => !document.querySelector('#victoryOverlay'));
    await mom.waitForFunction(() => !document.body.classList.contains('me-out') && !document.querySelector('#myBf.defeated'));
    await dad.evaluate(pid => CT.hostRecv({ t: 'op', op: { k: 'concede' } }, pid), momPid);
    await mom.locator('#victoryOverlay').waitFor();
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS victory screen (three real browsers): none while two remain, shown to everyone when the others have conceded with the winner named, host-only new game, Close/Escape, taken back when a concession is undone');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
