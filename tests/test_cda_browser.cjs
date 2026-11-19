/* Real-browser check of power/toughness counted from the card's own text (two real players and a local relay): Bronze Guardian counts artifacts you
 * control, Avalanche of Sector 7 counts the opponents' artifacts, a Goyf counts creature cards in all graveyards, a hand-size creature follows the hand;
 * Equipment and counters add on top of the count; a base set by hand wins; both players see the same. Needs the page on 8107 and the relay on 8112. */
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






    const mk = (pg, list) => pg.evaluate(d => { const m = CT.S.me; CT.act(() => { d.forEach(def => { def.tokens = []; def.ci = []; m.defs[def.id] = def; m.zones.hand.push({ iid: CT.S.pid + '_g' + def.id, id: def.id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); }, list);
    const play = (pg, ids) => pg.evaluate(a => { a.forEach(id => CT.doMove(CT.S.pid + '_g' + id, 'battlefield')); CT.act(() => { CT.S.me.zones.battlefield.forEach(c => { c.st = (c.st || []).filter(x => x !== 'sick'); }); }); }, ids);
    await mk(dad, [
      { id: 'guard', name: 'Bronze Guardian', face: 'Bronze Guardian', type: 'Artifact Creature — Golem', oracle: 'Bronze Guardian\'s power is equal to the number of artifacts you control.\nOther artifacts you control have ward {2}.', pt: '*/4' },
      { id: 'rock1', name: 'Rock One', face: 'Rock One', type: 'Artifact', oracle: '' }, { id: 'rock2', name: 'Rock Two', face: 'Rock Two', type: 'Artifact', oracle: '' },
      { id: 'sword', name: 'Test Sword', face: 'Test Sword', type: 'Artifact — Equipment', oracle: 'Equipped creature gets +2/+2.' },
      { id: 'aval', name: 'Avalanche of Sector 7', face: 'Avalanche of Sector 7', type: 'Legendary Creature — Human Rebel', oracle: 'Avalanche of Sector 7\'s power is equal to the number of artifacts your opponents control.', pt: '*/3' },
      { id: 'mort', name: 'Mortivore', face: 'Mortivore', type: 'Creature — Lhurgoyf', oracle: 'Mortivore\'s power and toughness are each equal to the number of creature cards in all graveyards.', pt: '*/*' },
      { id: 'hand', name: 'Body of Knowledge', face: 'Body of Knowledge', type: 'Creature — Avatar', oracle: 'Body of Knowledge\'s power and toughness are each equal to the number of cards in your hand.', pt: '*/*' },
      { id: 'bear', name: 'Test Bear', face: 'Test Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' },
      { id: 'filler1', name: 'Filler One', face: 'Filler One', type: 'Instant', oracle: '' }, { id: 'filler2', name: 'Filler Two', face: 'Filler Two', type: 'Instant', oracle: '' }
    ]);
    await mk(son, [
      { id: 'srock1', name: 'Son Rock One', face: 'Son Rock One', type: 'Artifact', oracle: '' }, { id: 'srock2', name: 'Son Rock Two', face: 'Son Rock Two', type: 'Artifact', oracle: '' },
      { id: 'sbear', name: 'Son Bear', face: 'Son Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' }
    ]);
    const iid = id => dad.evaluate(i => CT.S.pid + '_g' + i, id), siid = id => son.evaluate(i => CT.S.pid + '_g' + i, id);
    const stat = (pg, i) => pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); const pt = el && el.querySelector('.badges .pt'); return pt ? (pt.querySelectorAll('.pt-stat').length === 2 ? [...pt.querySelectorAll('.pt-stat')].map(b => b.textContent.trim()).join('/') : pt.textContent.replace(/\s+/g, '')) : ''; }, i);
    const waitStat = async (id, text, why, who) => { const i = await iid(id); for (const pg of [dad, son]) { const t0 = Date.now(); while ((await stat(pg, i)) !== text) { if (Date.now() - t0 > 15000) throw new Error(why + ' (' + pg.playerName + ') expected ' + text + ' got ' + (await stat(pg, i))); await pg.waitForTimeout(100); } } };

    // ---- 1. Bronze Guardian: power counts artifacts you control (itself is one), toughness stays 4. ----
    await play(dad, ['guard']);
    await waitStat('guard', '1/4', 'only the Guardian itself is an artifact');
    await play(dad, ['rock1', 'rock2']);
    await waitStat('guard', '3/4', 'two more artifacts');
    // ---- 2. Equipment is an artifact (it counts) and adds on top; so do counters. ----
    await play(dad, ['sword', 'bear']);
    await waitStat('guard', '4/4', 'the Sword is an artifact too');
    await dad.evaluate(() => { const f = CT.S.me.zones.battlefield, A = f.find(c => c.iid === CT.S.pid + '_gsword'), T = f.find(c => c.iid === CT.S.pid + '_gguard'); CT.act(() => { A.att = { p: CT.S.pid, i: T.iid }; }); });
    await waitStat('guard', '6/6', 'the count is the base: 4 + 2 from the Sword, toughness 4 + 2');
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.iid === CT.S.pid + '_gguard'); CT.act(() => { c.c = { '+1/+1': 1 }; }); });
    await waitStat('guard', '7/7', 'and a +1/+1 counter on top');
    // ---- 3. The opponent's artifacts do not count for "you control", and a change on the other board counts for "your opponents control". ----
    await play(son, ['srock1']);
    await waitStat('guard', '7/7', 'Son\'s artifact does not count for Bronze Guardian');
    await play(dad, ['aval']);
    await waitStat('aval', '1/3', 'Avalanche counts Son\'s one artifact');
    await play(son, ['srock2']);
    await waitStat('aval', '2/3', 'and Son\'s second artifact, live');
    // ---- 4. Graveyards: creature cards in ALL graveyards (both players'). ----
    await play(dad, ['mort']);
    await waitStat('mort', '0/0', 'no creature cards in graveyards yet');
    await dad.evaluate(() => CT.doMove(CT.S.pid + '_gbear', 'graveyard'));
    await waitStat('mort', '1/1', 'Dad\'s Bear is in the graveyard');
    await play(son, ['sbear']); await son.evaluate(() => CT.doMove(CT.S.pid + '_gsbear', 'graveyard'));
    await waitStat('mort', '2/2', 'and Son\'s Bear counts too');
    // ---- 5. Cards in your hand. ----
    await play(dad, ['hand']);
    const handNow = await dad.evaluate(() => CT.S.me.zones.hand.length);
    await waitStat('hand', handNow + '/' + handNow, 'the hand size');
    await dad.evaluate(() => CT.doMove(CT.S.pid + '_gfiller1', 'battlefield'));
    await waitStat('hand', (handNow - 1) + '/' + (handNow - 1), 'one card fewer in hand');
    // ---- 6. A base set by hand wins over the count (counters and bonuses still add). ----
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.iid === CT.S.pid + '_gguard'); CT.act(() => { c.pb = '9/9'; }); });
    await waitStat('guard', '12/12', 'a base 9/9 set by hand, +2/+2 Sword, +1/+1 counter');
    const title = await dad.evaluate(i => [...document.querySelectorAll('.card')].find(c => c.dataset.iid === i).querySelector('.badges .pt').getAttribute('title'), await iid('mort'));
    assert.match(title, /counted from the card's own text/, 'the badge explains where the number comes from: ' + title);
    // ---- 7. Nothing is saved on the cards: the count is drawn, not stored. ----
    const stored = await dad.evaluate(() => JSON.stringify(CT.S.me.zones.battlefield.filter(c => /_gaval|_gmort|_ghand/.test(c.iid)).map(c => [c.dp || 0, c.dt || 0, c.pb || ''])));
    assert.equal(stored, JSON.stringify([[0, 0, ''], [0, 0, ''], [0, 0, '']]), 'no number was stored on the counting cards: ' + stored);
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS counted power/toughness: Bronze Guardian, Avalanche of Sector 7, a Goyf and a hand-size creature follow their counts live for both players, Equipment and counters add on top, a hand-set base wins, nothing is saved');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
