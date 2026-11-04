/* Real-browser check that only the active player or the host can pass the turn (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_pass_turn_browser.cjs
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
    const host = await hostGame('Dad', 'gold');
    const guest = await joinGame('Son', await host.evaluate(() => CT.S.room), 'red');
    await host.waitForFunction(() => CT.S.table.seats.length === 2);
    for (const pg of [host, guest]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await host.locator('button[data-a="start"]:not([disabled])').click();
    await guest.waitForFunction(() => CT.S.table && CT.S.table.started && CT.S.table.active, null, { timeout: 60000 });
    for (const pg of [host, guest]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const hostPid = await pidOf(host), guestPid = await pidOf(guest);
    const active = () => host.evaluate(() => CT.S.table.active);
    const waitActive = pid => Promise.all([host, guest].map(pg => pg.waitForFunction(p => CT.S.table.active === p, pid)));
    const passBtn = pg => pg.locator('button[data-a="pass"]').first();
    const toasts = pg => pg.evaluate(() => [...document.querySelectorAll('.w-toast')].map(t => t.innerText));

    // Make it the HOST's turn (use the host's own pass if needed), then the guest tries to pass it.
    if ((await active()) !== hostPid) { await passBtn(guest).click(); await waitActive(hostPid); }
    assert.equal(await passBtn(guest).isDisabled(), true, 'the guest cannot press Pass turn on the host\'s turn');
    assert.match(await passBtn(guest).getAttribute('title'), /Only the host can pass/);
    await guest.keyboard.press('Space');
    await guest.waitForFunction(() => [...document.querySelectorAll('.w-toast')].some(t => /Only the host can pass it/.test(t.innerText)));
    // A hand-made pass from the guest (an old page, or someone poking at the console) is ignored by the host.
    await host.waitForTimeout(500);
    assert.equal(await active(), hostPid, 'the host\'s turn is untouched');
    if (process.env.CT_SHOTS) await guest.screenshot({ path: process.env.CT_SHOTS + '/pass-guest.png', clip: { x: 0, y: 0, width: 800, height: 50 } });

    // The host passes his own turn, then passes the guest's turn for him (with the confirmation).
    await passBtn(host).click(); await waitActive(guestPid);
    assert.equal(await passBtn(guest).isDisabled(), false, 'on his own turn the guest can press it');
    await passBtn(host).click();
    await host.locator('.w-confirm-text', { hasText: /Pass it for them/ }).waitFor();
    await host.getByRole('button', { name: 'Pass their turn' }).click();
    await waitActive(hostPid);
    // And the guest passes his own turn normally.
    await passBtn(host).click(); await waitActive(guestPid);
    await passBtn(guest).click(); await waitActive(hostPid);
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS pass turn (two real browsers): a guest cannot pass the host\'s turn (disabled button, message), the host can pass for the guest after confirming, the guest passes his own turn');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
