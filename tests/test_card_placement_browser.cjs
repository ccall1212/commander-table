/* Real-browser check of where new cards appear: a copy lands right beside the card it copies, and a card coming back from the
 * graveyard or exile appears in the middle of the visible board, never under the hand strip (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_card_placement_browser.cjs
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
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    for (let i = 0; i < 3; i++) { const c = dad.locator('#myHand .card').first(); await c.hover(); await dad.keyboard.press('b'); await dad.waitForFunction(n => CT.S.me.zones.battlefield.length === n, i + 1); }
    await dad.mouse.move(5, 5);
    const bf = () => dad.evaluate(() => CT.S.me.zones.battlefield.map(c => ({ iid: c.iid, x: c.x, y: c.y, cp: !!c.cp })));
    const [a, b, c] = (await bf()).map(x => x.iid);
    await dad.evaluate(([a, b, c]) => { const z = CT.S.me.zones.battlefield; CT.act(() => { const f = i => z.find(x => x.iid === i); f(a).x = 300; f(a).y = 160; f(b).x = 700; f(b).y = 160; f(c).x = 60; f(c).y = 300; }); }, [a, b, c]);
    const visible = async iid => dad.evaluate(i => {
      document.querySelectorAll('.w-toast, .ct-turn-notice, #rollPopup').forEach(n => n.remove()); // transient banners can sit over a card for a moment
      const el = document.querySelector(`#myBf .card[data-iid="${i}"]`); if (!el) return { found: false };
      const r = el.getBoundingClientRect(), row = document.querySelector('#myRow').getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { found: true, aboveStrip: r.bottom <= row.top + 2, touchable: !!hit && !!hit.closest(`.card[data-iid="${i}"]`) };
    }, iid);

    // 1. A copy made with C appears right beside the card it copies.
    await dad.locator(`#myBf .card[data-iid="${a}"]`).hover(); await dad.keyboard.press('c');
    await dad.waitForFunction(() => CT.S.me.zones.battlefield.some(x => x.cp));
    let copy = (await bf()).find(x => x.cp);
    assert.ok(Math.abs(copy.x - (300 + 86)) < 2 && Math.abs(copy.y - 160) < 2, `the copy is right beside the original (${copy.x},${copy.y})`);
    assert.deepEqual(await visible(copy.iid), { found: true, aboveStrip: true, touchable: true }, 'and can be reached');
    // 2. With the spot to the right taken, it goes to the next free side.
    await dad.evaluate(() => { CT.S.me.zones.battlefield.forEach(x => { if (x.cp) { x.x = 0; x.y = 0; } }); });
    await dad.mouse.move(5, 5);
    await dad.locator(`#myBf .card[data-iid="${b}"]`).hover(); await dad.keyboard.press('c');
    await dad.waitForFunction(() => CT.S.me.zones.battlefield.filter(x => x.cp).length === 2);
    const second = (await bf()).filter(x => x.cp).pop();
    assert.ok(Math.abs(second.x - (700 + 86)) < 2 && Math.abs(second.y - 160) < 2, 'a second copy beside the second card');

    // 3. Cards coming back from the graveyard or exile appear in the middle of the visible board.
    for (const zone of ['graveyard', 'exile']) {
      await dad.evaluate(([i, z]) => { CT.doMove(i, z); }, [c, zone]);
      await dad.waitForFunction(([i, z]) => CT.S.me.zones[z].some(x => x.iid === i), [c, zone]);
      await dad.evaluate(i => { CT.doMove(i, 'battlefield'); }, c);
      await dad.waitForFunction(i => CT.S.me.zones.battlefield.some(x => x.iid === i), c);
      const back = (await bf()).find(x => x.iid === c);
      assert.ok(Math.abs((back.x + 40) - 500) < 130, `from the ${zone} it is near the middle of the board (x=${back.x})`);
      assert.deepEqual(await visible(c), { found: true, aboveStrip: true, touchable: true }, `and reachable (${zone})`);
    }
    // The other player sees the copy and the returned card on the right board.
    await son.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).filter(x => x.cp).length === 2, await pidOf(dad));
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS card placement (two real browsers): a copy lands right beside the original, and cards returning from the graveyard or exile appear in the middle of the board where they can be clicked');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
