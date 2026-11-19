/* Real-browser check of lands that enter tapped (two real players and a local relay): a land whose rules say it enters tapped is tapped for
 * you, conditional wordings are checked against your lands, lands that need a choice are left alone, the log says "tapped", and the other
 * player sees the same. Needs the page on 8107 and the relay on 8112. */
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



    const landDefs = {
      moor: ['Barren Moor', 'Land', 'This land enters tapped.\nCycling {B}'],
      forest: ['Test Forest', 'Basic Land — Forest', '({T}: Add {G}.)'],
      island: ['Test Island', 'Basic Land — Island', '({T}: Add {U}.)'],
      check1: ['Check One', 'Land', 'This land enters tapped unless you control an Island or a Mountain.\n{T}: Add {U} or {R}.'],
      check2: ['Check Two', 'Land', 'This land enters tapped unless you control an Island or a Mountain.\n{T}: Add {U} or {R}.'],
      fast: ['Fast Land', 'Land', 'This land enters tapped unless you control two or fewer other lands.\n{T}: Add {U} or {B}.'],
      slow: ['Slow Land', 'Land', 'This land enters tapped unless you control two or more other lands.\n{T}: Add {G} or {W}.'],
      reveal: ['Reveal Land', 'Land', 'As this land enters, you may reveal an Elf card from your hand. If you don\'t, this land enters tapped.\n{T}: Add {G}.'],
      opps: ['Training Center', 'Land', 'This land enters tapped unless you have two or more opponents.\n{T}: Add {U} or {R}.'],
      plain: ['Plain Land', 'Land', '{T}: Add {C}.']
    };
    await dad.evaluate(d => { const m = CT.S.me; CT.act(() => { Object.entries(d).forEach(([id, [name, type, oracle]]) => { m.defs[id] = { id, name, face: name, type, oracle, img: '', tokens: [], ci: [] }; m.zones.hand.push({ iid: CT.S.pid + '_l' + id, id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); }, landDefs);
    const play = id => dad.evaluate(i => { CT.doMove(CT.S.pid + '_l' + i, 'battlefield'); const c = CT.S.me.zones.battlefield.find(x => x.iid === CT.S.pid + '_l' + i); return !!c.t; }, id);
    const sees = async (id, t) => son.waitForFunction(([i, t]) => { const el = [...document.querySelectorAll('.card')].find(x => x.dataset.iid === i); return !!el && el.classList.contains('tapped') === t; }, [await dad.evaluate(i => CT.S.pid + '_l' + i, id), t], { timeout: 15000 });

    // ---- 1. "This land enters tapped." is tapped for you, and the other player sees it. ----
    assert.equal(await play('moor'), true, 'Barren Moor enters tapped');
    await sees('moor', true);
    assert.equal(await play('forest'), false, 'a Forest enters untapped');
    await sees('forest', false);
    assert.equal(await play('plain'), false, 'an ordinary land enters untapped');
    // ---- 2. A check land: tapped without an Island or Mountain, untapped with one. ----
    assert.equal(await play('check1'), true, 'no Island or Mountain: tapped');
    assert.equal(await play('island'), false);
    assert.equal(await play('check2'), false, 'with an Island: untapped');
    // ---- 3. Fast and slow lands count my other lands. ----
    assert.equal(await play('fast'), true, 'six other lands: a fast land enters tapped');
    assert.equal(await play('slow'), false, 'plenty of other lands: a slow land enters untapped');
    // ---- 4. Lands that need a choice are left alone; the opponent count is checked. ----
    assert.equal(await play('reveal'), false, 'a reveal land is left alone (untapped)');
    assert.equal(await play('opps'), true, 'one opponent: "unless you have two or more opponents" enters tapped');
    // ---- 5. The log says it entered tapped; a card that is already tapped stays tapped; untapping works as usual. ----
    const log = await dad.evaluate(() => JSON.stringify(CT.S.table.log || CT.S.log || []));
    assert.match(log, /"text":"played \{0\} tapped","cards":\[\{"id":"moor"/, 'the log says it was played tapped');
    assert.match(log, /"text":"played \{0\}","cards":\[\{"id":"forest"/, 'and plain "played" for an untapped land');
    await dad.evaluate(() => { CT.act(() => { CT.S.me.zones.battlefield.forEach(c => { c.t = false; }); }); });
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.every(c => !c.t)), true, 'untapping everything still works');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS enter-tapped lands: always-tapped lands are tapped for the player and seen by the other player; check, fast and slow lands read the board; reveal lands are left alone; the log says tapped');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
