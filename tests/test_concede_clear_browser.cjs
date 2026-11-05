/* Real-browser check that conceding with 'put my cards back' ticked sends hand, battlefield, graveyard and exile to the
 * library and the commander to the command zone (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_concede_clear_browser.cjs
 * Set CT_CHROMIUM if Chromium is not at /usr/bin/chromium. Never touches Cloudflare. */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const mkDeck = who => ({
  id: 'share-' + who, name: who + ' deck', commanders: who === 'Son' ? [{ id: 'son-cmd', name: 'Son Commander', face: 'Son Commander', type: 'Legendary Creature', ci: ['R'], tokens: [], img: 'https://cards.scryfall.io/normal/front/x/sc.jpg' }] : [], tokens: [], createdAt: '2026-11-02', source: '',
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
    const son = await joinGame('Son', await dad.evaluate(() => CT.S.room), 'red');
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    assert.equal(await son.evaluate(() => CT.S.me.zones.command.length), 1, 'Son starts with his commander in the command zone');
    const total = await son.evaluate(() => Object.values(CT.S.me.zones).reduce((n, z) => n + z.length, 0));
    // Spread his cards around: commander to the battlefield, cards into graveyard and exile, two on the battlefield.
    await son.evaluate(() => { const m = CT.S.me; CT.act(() => {
      m.zones.battlefield.push(m.zones.command.pop());
      m.zones.graveyard.push(m.zones.hand.pop(), m.zones.hand.pop());
      m.zones.exile.push(m.zones.hand.pop());
      m.zones.battlefield.push(m.zones.hand.pop());
    }); });
    const spread = await son.evaluate(() => Object.fromEntries(Object.entries(CT.S.me.zones).map(([k, v]) => [k, v.length])));
    assert.ok(spread.graveyard === 2 && spread.exile === 1 && spread.battlefield === 2 && spread.command === 0, JSON.stringify(spread));
    await menu(son).click();
    await son.locator('.w-menu-item', { hasText: 'Concede game' }).first().click();
    const box = son.locator('.w-concede-dialog'); await box.waitFor();
    assert.match(await box.innerText(), /library.*command zone/s, 'the box says what ticking it does');
    await box.locator('[data-concede="yes"]').click();
    await son.waitForFunction(() => CT.S.me.zones.battlefield.length === 0 && CT.S.me.zones.graveyard.length === 0);
    const after = await son.evaluate(() => ({ z: Object.fromEntries(Object.entries(CT.S.me.zones).map(([k, v]) => [k, v.length])), cmd: CT.S.me.zones.command.map(c => !!c.cmd) }));
    assert.deepEqual([after.z.hand, after.z.battlefield, after.z.graveyard, after.z.exile], [0, 0, 0, 0]);
    assert.equal(after.z.command, 1, 'the commander is back in the command zone'); assert.deepEqual(after.cmd, [true]);
    assert.equal(after.z.library, total - 1, 'every other card is back in the library');
    const sonId = await pidOf(son);
    await dad.waitForFunction(([p, n]) => (CT.S.players[p].zones.command || []).length === 1 && CT.S.players[p].lib === n, [sonId, total - 1]);
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS concede with cards put back (two real browsers): hand, battlefield, graveyard and exile go to the library, the commander returns to the command zone');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
