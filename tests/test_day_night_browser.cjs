/* Real-browser check of the Day / Night marker (two real players and a local relay): the player who starts it keeps it, everyone sees a
 * Day / Night chip beside the round number, only the keeper can click the sun or the moon, nobody else can start a second marker, the
 * keeper can remove it (and then someone else can start one), and a daybound card offers to start it. Needs the page on 8107 and the
 * relay on 8112, like the other *_browser tests. */
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
    await page.addInitScript(() => { window.__played = []; window.Audio = class { constructor(src) { this.src = String(src); this.volume = 1; } play() { window.__played.push({ src: this.src, volume: this.volume }); return Promise.resolve(); } }; }); // records sounds instead of playing them
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

    const chip = pg => pg.evaluate(() => { const c = document.querySelector('#turnBox .ct-daynight'); return c ? c.textContent.trim() : ''; });
    const waitChip = (pg, text) => pg.waitForFunction(t => { const c = document.querySelector('#turnBox .ct-daynight'); return (c ? c.textContent.trim() : '') === t; }, text, { timeout: 15000 });
    const openMenu = async pg => { await pg.getByRole('button', { name: /^(☰|Menu)/ }).first().click(); };
    const menuLabel = pg => pg.evaluate(() => [...document.querySelectorAll('.w-menu-item .w-menu-label')].map(x => x.textContent.trim()).find(t => /^Day \/ Night|^Start Day/.test(t)) || '');

    // ---- 1. No marker yet: no chip; Dad starts one from the menu. ----
    assert.equal(await chip(dad), '', 'no chip before a marker exists');
    await openMenu(dad);
    assert.match(await menuLabel(dad), /^Start Day \/ Night marker/);
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Start Day \/ Night marker/ }).click();
    await waitChip(dad, '☀ Day'); await waitChip(son, '☀ Day');
    const mine = await dad.evaluate(() => CT.S.me.zones.battlefield.filter(c => c.id === 'ct-daynight').length);
    assert.equal(mine, 1, 'Dad has exactly one marker on his battlefield');

    assert.equal(await dad.locator('.card:has(.ctrack.daynight) .tk').count(), 0, 'it is a reminder card, so it has no TOKEN label');
    assert.equal(await son.locator('.card:has(.ctrack.daynight) .tk').count(), 0, 'and no label on the other screen either');

    // ---- 2. Son sees it but cannot change it or start another. ----
    await openMenu(son);
    const sonLabel = await menuLabel(son);
    assert.match(sonLabel, /^Day \/ Night: Dad keeps it \(day\)/, 'Son is told who keeps it: ' + sonLabel);
    assert.equal(await son.evaluate(() => { const el = [...document.querySelectorAll('.w-menu-item')].find(x => /^Day \/ Night:/.test(x.textContent.trim())); return !!el && (el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled') || el.hasAttribute('disabled')); }), true, 'and the entry is disabled');
    await son.keyboard.press('Escape');
    assert.equal(await son.locator('.card .ctrack.daynight.mine').count(), 0, 'Son cannot click the sun or moon on Dad\'s marker');
    assert.equal(await son.locator('.ctrack.daynight .tstep').count() >= 2, true, 'but he can see both on Dad\'s board');

    // ---- 3. Dad clicks the moon: night for everyone; the sun brings day back. ----
    await dad.evaluate(() => { CT.S.view = 'side'; CT.render(); });
    await dad.locator('#myBf .ctrack.daynight.mine .tstep[data-step="2"]').click();
    await waitChip(dad, '☾ Night'); await waitChip(son, '☾ Night');
    assert.equal(await dad.evaluate(() => !!CT.S.me.zones.battlefield.find(c => c.id === 'ct-daynight').fl), true, 'night is the flipped card');
    const faceSrc = pg => pg.evaluate(() => { const el = [...document.querySelectorAll('.card')].find(x => x.querySelector('.ctrack.daynight')); const im = el && el.querySelector('img'); return im ? im.getAttribute('src') : ''; });
    assert.match(await faceSrc(dad), /\/back\//, 'Dad sees the Night face');
    assert.match(await faceSrc(son), /\/back\//, 'Son sees the Night face too');
    await dad.locator('#myBf .ctrack.daynight.mine .tstep[data-step="1"]').click();
    await waitChip(dad, '☀ Day'); await waitChip(son, '☀ Day');
    assert.match(await faceSrc(dad), /\/front\//, 'the card is back on its Day face');
    assert.match(await faceSrc(son), /\/front\//);

    // Sounds: nothing played when the marker appeared; the moon plays the (quiet) wolf, the sun the rooster, for both players.
    const played = pg => pg.evaluate(() => window.__played.map(p => p.src.replace(/\?.*$/, '').split('/').pop() + '@' + p.volume).join());
    assert.equal(await played(dad), 'night-wolf.mp3@0.6,day-rooster.mp3@0.6', 'Dad heard the wolf then the rooster, at 60% volume');
    assert.equal(await played(son), 'night-wolf.mp3@0.6,day-rooster.mp3@0.6', 'Son heard both too (nothing when the marker first appeared)');
    await son.evaluate(() => localStorage.setItem('ct.dayNightSound', 'false'));
    await dad.locator('#myBf .ctrack.daynight.mine .tstep[data-step="2"]').click();
    await waitChip(son, '☾ Night');
    assert.equal((await played(dad)).split(',').length, 3, 'Dad hears the next change');
    assert.equal((await played(son)).split(',').length, 2, 'Son switched the sounds off, so he hears nothing');
    await dad.locator('#myBf .ctrack.daynight.mine .tstep[data-step="1"]').click();
    await waitChip(son, '☀ Day');
    await son.evaluate(() => localStorage.removeItem('ct.dayNightSound'));

    // ---- 4. The log says what happened; the right-click menu can also change it. ----
    const log = await dad.evaluate(() => JSON.stringify(CT.S.table.log || CT.S.log || []));
    assert.match(log, /changed it to night/, 'the table log records the change');
    await dad.locator('#myBf .card:has(.ctrack.daynight)').first().dispatchEvent('contextmenu', { button: 2, clientX: 300, clientY: 300, bubbles: true });
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Change to night/ }).first().click();
    await waitChip(son, '☾ Night');

    // ---- 5. Removing the marker clears the chip for everyone, and then Son can start his own. ----
    await openMenu(dad);
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Day \/ Night marker/ }).click();
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Remove the marker/ }).click();
    await waitChip(dad, ''); await waitChip(son, '');
    await openMenu(son);
    await son.locator('.w-menu-item .w-menu-label', { hasText: /^Start Day \/ Night marker/ }).click();
    await waitChip(son, '☀ Day'); await waitChip(dad, '☀ Day');
    assert.equal(await dad.locator('.ctrack.daynight.mine').count(), 0, 'now Dad cannot change it');

    // ---- 6. A daybound card entering offers to start the marker (once), but not while one exists. ----
    await openMenu(son);
    await son.locator('.w-menu-item .w-menu-label', { hasText: /^Day \/ Night marker/ }).click();
    await son.locator('.w-menu-item .w-menu-label', { hasText: /^Remove the marker/ }).click();
    await waitChip(dad, '');
    await dad.evaluate(() => { const m = CT.S.me; CT.act(() => { m.defs.dbw = { id: 'dbw', name: 'Test Wolf', face: 'Test Wolf', type: 'Creature — Human Werewolf', oracle: 'Daybound (If a player casts no spells during their own turn, it becomes night next turn.)', img: '', tokens: [], ci: [] }; m.zones.hand.push({ iid: CT.S.pid + '_dbw', id: 'dbw', own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); CT.doMove(CT.S.pid + '_dbw', 'battlefield'); });
    await dad.locator('.w-toast', { hasText: 'A daybound card entered' }).waitFor();
    await dad.locator('.w-toast-btn', { hasText: 'Start Day / Night' }).click();
    await waitChip(son, '☀ Day');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS day/night marker: the keeper starts it from the menu or a daybound offer, everyone sees the Day/Night chip, only the keeper can click the sun or moon (or use the menu), the log records changes, removing it lets someone else start one');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
