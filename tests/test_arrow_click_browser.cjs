/* Real-browser check that a targeting arrow can be aimed at an opponent's miniature board even when the mouse moves a little
 * between press and release, or the table redraws while the button is down (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_arrow_click_browser.cjs
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
    const sonPid = await pidOf(son), dadPid = await pidOf(dad);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const play = async pg => { const c = pg.locator('#myHand .card').first(); await c.hover(); await pg.keyboard.press('b'); };
    await play(dad); await play(son);
    await dad.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).length === 1, sonPid);
    await son.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).length === 1, dadPid);
    const arrowCount = pg => pg.evaluate(() => CT.S.targetArrows.length);
    // Aim an arrow from my own card at one of the opponent's targets with a given amount of jitter and an optional redraw mid-press.
    async function aim(from, pid, target, dx, dy, redrawWhileDown) {
      await from.locator('#myBf .card[data-zone="battlefield"]').first().hover();
      await from.keyboard.press('w');
      const sel = target === 'board' ? `.opp.tile[data-opp="${pid}"] .obf` : `.opp.tile[data-opp="${pid}"] .card[data-zone="battlefield"]`;
      const box = await from.locator(sel).first().boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const before = await arrowCount(from);
      await from.mouse.move(cx, cy); await from.mouse.down();
      if (dx || dy) await from.mouse.move(cx + dx, cy + dy);
      if (redrawWhileDown) { await from.evaluate(() => { CT.render(); }); await from.waitForTimeout(250); }
      await from.mouse.up();
      return before;
    }
    // Remove all arrows between attempts so each one is a new arrow (the host ignores an exact duplicate).
    const reset = async () => { await dad.evaluate(() => { const T = CT.S.table; CT.hostRecv({ t: 'arrows', k: 'clear' }, CT.S.pid); }); await dad.waitForFunction(() => CT.S.targetArrows.length === 0); await son.waitForFunction(() => CT.S.targetArrows.length === 0); };
    const cases = [[0, 0, false], [1, 1, false], [3, 4, false], [0, 0, true], [2, 2, true]];
    for (const target of ['board', 'card']) for (const [dx, dy, redraw] of cases) {
      await reset();
      const before = await aim(dad, sonPid, target, dx, dy, redraw);
      await dad.waitForFunction(n => CT.S.targetArrows.length === n + 1, before, { timeout: 5000 }).catch(() => {});
      assert.equal(await arrowCount(dad), before + 1, `host -> guest ${target}, jitter ${dx},${dy}${redraw ? ', redraw while pressed' : ''}: the arrow was placed`);
      assert.equal(await dad.evaluate(() => !!CT.S.arrowPick), false, 'and arrow mode ended');
      await son.waitForFunction(n => CT.S.targetArrows.length === n + 1, before, { timeout: 5000 });
    }
    // A guest aiming at the host's board works too.
    await reset();
    const b2 = await aim(son, dadPid, 'board', 2, 3, true);
    await son.waitForFunction(n => CT.S.targetArrows.length === n + 1, b2, { timeout: 5000 });
    // A drag (press, move far, release) still draws an arrow, and a click on the controls does not pick anything.
    await reset();
    const b3 = await aim(dad, sonPid, 'card', 30, 12, false);
    await dad.waitForFunction(n => CT.S.targetArrows.length === n + 1, b3, { timeout: 5000 });
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS arrow click (two real browsers): an arrow can be aimed at an opponent board or card with a steady click, a slightly moving mouse, a redraw while the button is down, a guest aiming at the host, and a drag');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
