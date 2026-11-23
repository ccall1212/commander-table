/* Real-browser check of the tab alerts (two real players and a local relay): while Son's page is not in front, it flashes the tab title and swaps the icon when the
 * turn becomes his, when Dad presses In response!, and when Dad aims an arrow at him; nothing happens while the page is in front, for his own actions, or when he has
 * turned the alerts off; everything clears the moment he looks at the page again. Needs the page on 8107 and the relay on 8112. */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const mkDeck = who => ({
  id: 'share-' + who, name: who + ' deck', commanders: [], tokens: [], createdAt: '2026-11-02', source: '',
  cards: Array.from({ length: 40 }, (_, i) => ({ def: { id: who + '-c' + i, name: `${who} Card ${i}`, type: 'Creature', ci: ['U'], tokens: [], img: 'https://cards.scryfall.io/normal/front/x/' + who + i + '.jpg' }, qty: 1 }))
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  async function player(name) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.route('https://cards.scryfall.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.addInitScript(({ deck, name }) => { localStorage.setItem('ct.decks.v1', JSON.stringify([deck])); localStorage.setItem('ct.name', JSON.stringify(name)); }, { deck: mkDeck(name), name });
    await page.goto(BASE);
    return page;
  }
  const pick = async (p, c) => { await p.locator(`.ct-player-color-option[data-color="${c}"]`).click(); };
  try {
    const dad = await player('Dad');
    await dad.locator('#hostBtn').click(); await dad.getByRole('button', { name: 'Continue', exact: true }).click(); await pick(dad, 'gold');
    await dad.waitForFunction(() => CT.S.role === 'host' && CT.S.room && CT.S.table.colors[CT.S.pid]);
    const son = await player('Son');
    await son.locator('#joinIn').fill(await dad.evaluate(() => CT.S.room)); await son.locator('#joinBtn').click();
    await son.getByRole('button', { name: 'Join game', exact: true }).click(); await pick(son, 'red');
    await son.waitForFunction(() => CT.S.table && CT.S.table.seats.includes(CT.S.pid));
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const dadPid = await dad.evaluate(() => CT.S.pid), sonPid = await son.evaluate(() => CT.S.pid);
    // make it Dad's turn first (he is the host and can pass for whoever is active)
    const activeIs = pid => dad.evaluate(p => CT.S.table.active === p, pid);
    if (!(await activeIs(dadPid))) { await dad.locator('button[data-a="pass"]').first().click(); await dad.getByRole('button', { name: /Pass their turn/ }).click(); await dad.waitForFunction(p => CT.S.table.active === p, dadPid); }
    await son.waitForFunction(p => CT.S.table.active === p, dadPid);

    const state = pg => pg.evaluate(() => ({ title: document.title, icon: document.querySelector('link[rel~="icon"]').getAttribute('href').slice(0, 40), dot: /circle/.test(document.querySelector('link[rel~="icon"]').getAttribute('href')) }));
    const away = pg => pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.hasFocus = () => false; });
    const back = pg => pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.hasFocus = () => true; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
    const waitAlert = async (pg, re, why) => { await pg.waitForFunction(r => new RegExp(r).test(document.title), re.source, { timeout: 10000 }).catch(async () => { throw new Error(why + ': title is ' + (await state(pg)).title); }); };
    const baseTitle = (await state(son)).title;

    // 1. page in front: nothing happens for any of the three events
    await dad.evaluate(() => CT.hostRecv({ t: 'response', deal: CT.S.table.openingDeal }, CT.S.pid));
    await dad.evaluate(sp => CT.hostRecv({ t: 'arrows', k: 'add', arrow: { from: { kind: 'player', pid: CT.S.pid }, to: { kind: 'player', pid: sp } } }, CT.S.pid), sonPid);
    await son.waitForTimeout(800);
    assert.equal((await state(son)).title, baseTitle, 'nothing flashes while Son is looking at the page');
    await dad.evaluate(() => CT.hostRecv({ t: 'arrows', k: 'clear' }, CT.S.pid));

    // 2. Son's page is away: Dad passes the turn to him
    await away(son);
    await dad.locator('button[data-a="pass"]').first().click();
    await waitAlert(son, /your turn/i, "it becomes Son's turn");
    let st = await state(son);
    assert.ok(st.dot, 'the tab icon gets a red dot: ' + st.icon);
    await back(son);
    st = await state(son);
    assert.equal(st.title, baseTitle, 'the title is back when Son looks at the page'); assert.equal(st.dot, false, 'and so is the icon');

    // 3. In response! from Dad while Son is away; Son's own In response! does not alert him
    await away(son);
    await dad.evaluate(() => CT.hostRecv({ t: 'response', deal: CT.S.table.openingDeal }, CT.S.pid));
    await waitAlert(son, /Dad.*In response/i, 'Dad says In response');
    await back(son);
    await away(son);
    await son.keyboard.press('r');                                     // Son presses the In response! hotkey himself
    await son.waitForTimeout(1000);
    assert.equal((await state(son)).title, baseTitle, "Son's own In response! does not flash his own tab");

    // 4. an arrow aimed at Son
    await dad.evaluate(sp => CT.hostRecv({ t: 'arrows', k: 'add', arrow: { from: { kind: 'player', pid: CT.S.pid }, to: { kind: 'player', pid: sp } } }, CT.S.pid), sonPid);
    await waitAlert(son, /Dad.*arrow/i, 'an arrow is aimed at Son');
    await back(son);
    // an arrow Son aims at someone else does not alert him
    await away(son);
    await dad.evaluate(() => CT.hostRecv({ t: 'arrows', k: 'clear' }, CT.S.pid));
    await dad.evaluate(sp => CT.hostRecv({ t: 'arrows', k: 'add', arrow: { from: { kind: 'player', pid: sp }, to: { kind: 'player', pid: CT.S.pid } } }, CT.S.pid), sonPid);
    await son.waitForTimeout(800);
    assert.equal((await state(son)).title, baseTitle, 'an arrow between others is not an alert');
    await back(son);

    // 5. Son turns the flashing off: nothing happens while he is away
    await son.evaluate(() => CTTabAlert.set('tab', false)); await away(son);
    await dad.evaluate(() => CT.hostRecv({ t: 'response', deal: CT.S.table.openingDeal }, CT.S.pid));
    await son.waitForTimeout(800);
    assert.equal((await state(son)).title, baseTitle, 'the alerts can be turned off');
    await son.evaluate(() => CTTabAlert.set('tab', true)); await back(son);

    // 6. the menu has the settings
    await son.locator('#topbar [data-a="menu"]').click(); await son.getByRole('menuitem', { name: 'Display & layout' }).click(); await son.getByRole('menuitem', { name: 'Tab alerts' }).click();
    assert.ok(await son.getByRole('menuitem', { name: /Flash this tab/ }).isVisible(), 'the Tab alerts menu lists the options');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS tab alerts (two real browsers): your turn, In response! and an arrow at you flash the tab title and icon only while the page is not in front, nothing for your own actions or when turned off, cleared when you look again, settings in the menu');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
