/* Real-browser check of card statuses and abilities: icons hang beside the card (outside it, top-right), everyone sees
 * them, they follow a tapped card, clear when the card leaves the battlefield (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_card_marks_browser.cjs
 * Set CT_CHROMIUM if Chromium is not at /usr/bin/chromium. Never touches Cloudflare. */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const mkDeck = who => ({
  id: 'share-' + who, name: who + ' deck', commanders: [], tokens: [], createdAt: '2026-11-02', source: '',
  cards: Array.from({ length: 40 }, (_, i) => ({ def: { id: who + '-c' + i, name: `${who} Card ${String(i).padStart(2, '0')}`, type: 'Creature', ci: ['U'], tokens: [] }, qty: 1 }))
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];

  async function player(name) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
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
    const room = await dad.evaluate(() => CT.S.room);
    const son = await joinGame('Son', room, 'red');
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    const dadPid = await pidOf(dad);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    const card = dad.locator('#myHand .card').first();
    await card.hover(); await dad.keyboard.press('b');
    await dad.waitForFunction(() => CT.S.me.zones.battlefield.length === 1);
    await dad.evaluate(() => { CT.S.view = 'side'; CT.render(); });
    const bf = dad.locator('#myBf .card[data-zone="battlefield"]').first();
    const ctxMenu = () => bf.dispatchEvent('contextmenu', { button: 2, clientX: 400, clientY: 300, bubbles: true });

    await ctxMenu();
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Statuses & abilities/ }).first().click();
    const dlg = dad.locator('.w-marks-dialog');
    await dlg.waitFor();
    await dlg.locator('label.mark-row', { hasText: 'Flying' }).locator('input').check();
    await dlg.locator('label.mark-row', { hasText: 'Goaded' }).locator('input').check();
    await dlg.locator('.mark-custom-input').fill('Cursed');
    await dlg.locator('.mark-custom-add').click();
    await dad.waitForFunction(() => CT.S.me.zones.battlefield[0].st.length === 3);
    assert.deepEqual(await dad.evaluate(() => CT.S.me.zones.battlefield[0].st), ['goaded', 'flying', 'x:Cursed'], 'known markers first, in list order, then custom');
    await dlg.locator('input[data-mark="flying"]').uncheck();
    await dlg.locator('input[data-mark="flying"]').check();
    await dlg.locator('.mark-custom-input').fill('<b>x</b>'); await dlg.locator('.mark-custom-add').click();
    assert.ok((await dad.evaluate(() => CT.S.me.zones.battlefield[0].st)).includes('x:bx/b'), 'angle brackets are stripped from custom names');
    await dlg.locator('[data-remove-mark="x:bx/b"]').click();
    await dad.keyboard.press('Escape');

    // The icons are drawn beside the card, outside it, starting at its top, for the owner and for the other player.
    const geom = page => page.evaluate(iid => {
      const c = [...document.querySelectorAll('.card[data-zone="battlefield"]')].find(x => x.querySelector('.cstat'));
      if (!c) return null;
      const r = c.getBoundingClientRect(), icons = [...c.querySelectorAll('.cmark')].map(i => i.getBoundingClientRect());
      return { n: icons.length, outside: icons.every(i => i.left >= r.right - 1 || i.right <= r.left + 1), topAligned: Math.abs(icons[0].top - r.top) < 3, stacked: icons.every((i, k) => k === 0 || i.top > icons[k - 1].top), w: icons[0].width, cardW: r.width };
    });
    for (const pg of [dad, son]) {
      await pg.waitForFunction(() => document.querySelectorAll('.card .cstat .cmark').length === 3, null, { timeout: 10000 });
      const g = await geom(pg);
      assert.equal(g.n, 3); assert.ok(g.outside, 'icons are outside the card'); assert.ok(g.topAligned, 'icons start at the top of the card'); assert.ok(g.stacked, 'icons stack downwards');
      assert.ok(g.w >= 12, 'icons are big enough to read (' + g.w + 'px)');
    }
    assert.deepEqual(await son.evaluate(p => CT.S.players[p].zones.battlefield[0].st, dadPid), ['goaded', 'flying', 'x:Cursed'], 'the other player received them');
    const names = await son.evaluate(() => [...document.querySelectorAll('.card .cstat .cmark')].map(i => i.title));
    assert.deepEqual(names, ['Goaded', 'Flying', 'Cursed']);
    await dad.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); const f = CT.S.me.zones.battlefield[0]; CT.act(() => { f.x = 300; f.y = 150; }); });
    await dad.waitForTimeout(400);
    if (process.env.CT_SHOTS) await dad.screenshot({ path: process.env.CT_SHOTS + '/marks.png' });

    // Tapped card: the icons stay readable and next to the card.
    await dad.evaluate(() => { const f = CT.S.me.zones.battlefield[0]; CT.act(() => { f.t = 1; }); });
    await dad.waitForFunction(() => document.querySelector('#myBf .card.tapped .cstat'));
    if (process.env.CT_SHOTS) await dad.screenshot({ path: process.env.CT_SHOTS + '/marks-tapped.png' });

    // The card leaves the battlefield: markers are forgotten.
    await dad.evaluate(() => { const f = CT.S.me.zones.battlefield[0]; CT.act(() => { CT.S.me.zones.graveyard.push(CT.S.me.zones.battlefield.splice(0, 1)[0]); }); });
    await dad.waitForFunction(() => document.querySelectorAll('.cstat').length === 0);
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS statuses & abilities (two real browsers): checklist and custom status, icons hang outside the card from its top for both players, bad names cleaned, tapped card, removal');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
