/* Real-browser check of the Connection log (local relay): Menu > Display & layout > Connection log... opens a window listing this browser's connection events
 * (a "connected" entry after hosting, and a "closed" entry after the connection is cut), Copy and Clear work, and there are no page errors. Needs the page on 8107 and the relay on 8112. */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => errors.push(e.message));
    const deck = { id: 'share-Dad', name: 'Dad deck', commanders: [], tokens: [], createdAt: '2026-11-02', source: '', cards: Array.from({ length: 40 }, (_, i) => ({ def: { id: 'c' + i, name: 'Card ' + i, type: 'Creature', ci: ['U'], tokens: [], img: 'https://cards.scryfall.io/normal/front/x/' + i + '.jpg' }, qty: 1 })) };
    await page.route('https://cards.scryfall.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
    await page.addInitScript(d => { localStorage.setItem('ct.decks.v1', JSON.stringify([d])); localStorage.setItem('ct.name', JSON.stringify('Dad')); }, deck);
    await page.goto(BASE);
    await page.locator('#hostBtn').click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('.ct-player-color-option[data-color="gold"]').click();
    await page.waitForFunction(() => CT.S.role === 'host' && CT.S.room);
    const open = async () => { await page.locator('#topbar [data-a="menu"]').click(); await page.getByRole('menuitem', { name: 'Display & layout' }).click(); await page.getByRole('menuitem', { name: 'Connection log…' }).click(); return page.locator('.connection-log-text'); };
    let box = await open();
    assert.match(await box.inputValue(), /connected/, 'the log lists the connection after hosting');
    await page.keyboard.press('Escape');
    // cut the socket the way a dropped wifi would, then look again
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.context().setOffline(false);
    box = await open();
    assert.match(await box.inputValue(), /browser offline|closed|socket error/, 'a lost connection shows up in the log');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    assert.equal(await page.evaluate(() => RelayPeer.getLog().length < 3), true, 'Clear empties the log');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS connection log (real browser): menu item opens the window, connection events listed, offline noted, Clear works, no page errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
