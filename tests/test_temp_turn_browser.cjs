/* Real-browser check that temporary effects end with the turn they were placed in (three real players and a local relay): cleared when
 * the turn passes, not cleared by a repeated check, cleared at once when left over from an earlier turn (reload / reconnect), and an
 * effect placed during another player's turn ends when that turn ends. Needs the page and the relay running first, like the other
 * *_browser tests (page on 8107, relay on 8112). */
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
    const mom = await joinGame('Mom', await dad.evaluate(() => CT.S.room), 'green');
    await dad.waitForFunction(() => CT.S.table.seats.length === 3);
    for (const pg of [dad, son, mom]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son, mom]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const active = () => dad.evaluate(() => CT.S.table.active);
    const pids = {}; for (const [n, pg] of [['dad', dad], ['son', son], ['mom', mom]]) pids[n] = await pg.evaluate(() => CT.S.pid);
    const byPid = Object.fromEntries(Object.entries(pids).map(([n, p]) => [p, { dad, son, mom }[n]]));
    const playCard = pg => pg.evaluate(() => { const m = CT.S.me; CT.act(() => { m.defs.t1 = { id: 't1', name: 'T', face: 'T', type: 'Creature', oracle: '', img: '', tokens: [], ci: [] }; m.zones.battlefield.push({ iid: CT.S.pid + '_t1', id: 't1', own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {}, x: 100, y: 60 }); }); });
    for (const pg of [dad, son, mom]) await playCard(pg);
    const tempOf = pg => pg.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 't1'); return (c.ts || []).join() + '|' + (c.tp || 0); });
    const setTemp = pg => pg.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 't1'); CT.act(() => { c.ts = ['flying']; c.tp = 1; }); CT.clearTempOnTurnChange(CT.S.table); });
    const pass = async () => { const a = await active(); const pg = byPid[a]; await pg.locator('button[data-a="pass"]').first().click(); await dad.waitForFunction(a => CT.S.table.active !== a, a); return a; };
    // 1. Everyone sets a temporary effect on their own creature (stamped with this turn); the current player passes: all gone.
    const first = await active();
    for (const pg of [dad, son, mom]) await setTemp(pg);
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.find(x => x.id === 't1').tn !== undefined), true, 'the card remembers the turn it was placed in');
    await dad.evaluate(() => CT.clearTempOnTurnChange(CT.S.table));
    assert.equal(await tempOf(dad), 'flying|1', 'a temporary effect placed this turn is NOT cleared by a repeated check');
    await pass();
    await dad.waitForTimeout(800);
    const after = {}; for (const n of ['dad', 'son', 'mom']) after[n] = await tempOf({ dad, son, mom }[n]);
    assert.deepEqual(after, { dad: '|0', son: '|0', mom: '|0' }, 'every temporary effect is gone as soon as the turn passes: ' + JSON.stringify(after));
    // 2. A temporary effect left over from an EARLIER turn (a reload, a reconnect or a turn that passed while the page was closed)
    //    is cleared the moment the table is checked, without waiting for another turn change.
    await setTemp(dad);
    await dad.evaluate(() => { CT.S.me.zones.battlefield.find(x => x.id === 't1').tn = 'some-earlier-turn'; });
    await dad.evaluate(() => CT.clearTempOnTurnChange(CT.S.table));
    assert.equal(await tempOf(dad), '|0', 'an effect from an earlier turn is cleared at once');
    // 3. Placed during ANOTHER player's turn: it ends when that turn ends.
    const cur = await active();
    const other = cur === pids.dad ? son : dad; const otherPid = cur === pids.dad ? pids.son : pids.dad;
    const bystander = byPid[otherPid];
    await setTemp(bystander);
    await pass();
    await bystander.waitForFunction(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 't1'); return !(c.ts && c.ts.length) && !c.tp; }, null, { timeout: 8000 });
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS temporary effects end with the turn they were placed in: cleared when the turn passes (3 players, host and guests), not by a repeated check, cleared at once when left over from an earlier turn, and an effect placed during another player\'s turn ends when that turn ends');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
