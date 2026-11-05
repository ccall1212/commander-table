/* Real-browser check that power/toughness can be set to big numbers (10000/7) through the Power / Toughness menu and that
 * the other player sees them (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_big_power_browser.cjs
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
    const dadPid = await pidOf(dad);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const c = dad.locator('#myHand .card').first(); await c.hover(); await dad.keyboard.press('b');
    await dad.waitForFunction(() => CT.S.me.zones.battlefield.length === 1);
    await dad.mouse.move(5, 5);
    const setPT = async text => {
      await dad.locator('#myBf .card[data-zone="battlefield"]').first().dispatchEvent('contextmenu', { button: 2, clientX: 400, clientY: 300, bubbles: true });
      await dad.locator('.w-menu-item', { hasText: 'Power / Toughness' }).first().hover();
      await dad.locator('.w-menu-item', { hasText: 'Set power/toughness…' }).first().click();
      const input = dad.locator('.w-dialog input').first(); await input.fill(text); await dad.keyboard.press('Enter');
    };
    await setPT('10000/7');
    await dad.waitForFunction(() => CT.S.me.zones.battlefield[0].pb === '10000/7');
    const badge = pg => pg.evaluate(() => [...document.querySelectorAll('.card .badges .pt')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
    await dad.waitForFunction(() => [...document.querySelectorAll('.card .badges .pt')].some(b => /10000/.test(b.innerText)));
    assert.match((await badge(dad))[0], /10000\s*7/, 'the badge shows 10000 and 7');
    await son.waitForFunction(p => (CT.S.players[p].zones.battlefield[0] || {}).pb === '10000/7', dadPid);
    // The badge still fits inside the card and the clicks still change a stat by one.
    const fits = await dad.evaluate(() => { const card = document.querySelector('#myBf .card'), pt = card.querySelector('.badges .pt'); const c = card.getBoundingClientRect(), p = pt.getBoundingClientRect(); return p.left >= c.left - 6 && p.right <= c.right + 6; });
    assert.ok(fits, 'a five-digit power still fits on the card');
    if (process.env.CT_SHOTS) { await dad.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); const z = CT.S.me.zones.battlefield[0]; CT.act(() => { z.x = 300; z.y = 160; }); }); await dad.waitForTimeout(300); await dad.screenshot({ path: process.env.CT_SHOTS + '/bigpt.png', clip: { x: 200, y: 100, width: 400, height: 260 } }); }
    await dad.locator('#myBf .card .badges .pt-stat-toughness').first().click();
    await dad.waitForFunction(() => CT.S.me.zones.battlefield[0].dt === 1);
    // Set again with a negative and the biggest allowed numbers; one more digit is refused.
    await setPT('-5/999999');
    await dad.waitForFunction(() => CT.S.me.zones.battlefield[0].pb === '-5/999999');
    await setPT('1000000/1');
    await dad.waitForFunction(() => [...document.querySelectorAll('.w-toast')].some(t => /up to 999999/.test(t.innerText)));
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield[0].pb), '-5/999999', 'seven digits is refused and nothing changed');
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS big power/toughness (two real browsers): 10000/7 and 999999 can be set, the other player sees them, the badge fits, 7 digits is refused');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
