/* Real-browser check of "gets +1/+1 for each …" (two real players and a local relay): Moon-Vigil Adherents counts the creatures you control and the
 * creature cards in your graveyard, an Aura (Crown of Skemfar) counts Elves, counters add on top, the other player's creatures do not count, both players
 * see the same. Needs the page on 8107 and the relay on 8112. */
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
      { id: 'moon', name: 'Moon-Vigil Adherents', face: 'Moon-Vigil Adherents', type: 'Creature — Elf Druid', oracle: 'Trample\nThis creature gets +1/+1 for each creature you control and each creature card in your graveyard.', pt: '0/0' },
      { id: 'bear', name: 'Test Bear', face: 'Test Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' }, { id: 'bear2', name: 'Test Bear 2', face: 'Test Bear 2', type: 'Creature — Bear', oracle: '', pt: '2/2' },
      { id: 'elf1', name: 'Test Elf', face: 'Test Elf', type: 'Creature — Elf', oracle: '', pt: '1/1' }, { id: 'elf2', name: 'Test Elf 2', face: 'Test Elf 2', type: 'Creature — Elf', oracle: '', pt: '1/1' },
      { id: 'crown', name: 'Crown of Skemfar', face: 'Crown of Skemfar', type: 'Enchantment — Aura', oracle: 'Enchant creature\nEnchanted creature gets +1/+1 for each Elf you control and has reach.' }
    ]);
    await mk(son, [{ id: 'sbear', name: 'Son Bear', face: 'Son Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' }]);
    const iid = id => dad.evaluate(i => CT.S.pid + '_g' + i, id);
    const stat = (pg, i) => pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); const pt = el && el.querySelector('.badges .pt'); return pt ? (pt.querySelectorAll('.pt-stat').length === 2 ? [...pt.querySelectorAll('.pt-stat')].map(b => b.textContent.trim()).join('/') : pt.textContent.replace(/\s+/g, '')) : ''; }, i);
    const waitStat = async (id, text, why) => { const i = await iid(id); for (const pg of [dad, son]) { const t0 = Date.now(); while ((await stat(pg, i)) !== text) { if (Date.now() - t0 > 15000) throw new Error(why + ' (' + pg.playerName + ') expected ' + text + ' got ' + (await stat(pg, i))); await pg.waitForTimeout(100); } } };
    const hasIcon = async (pg, id, label) => { const i = await iid(id); return pg.evaluate(([x, l]) => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); return !!el && [...el.querySelectorAll('.cmark')].some(m => (m.getAttribute('title') || m.getAttribute('data-tip') || '').startsWith(l)); }, [i, label]); };

    await play(dad, ['moon']);
    await waitStat('moon', '1/1', 'alone: it counts itself');
    await play(dad, ['bear']);
    await waitStat('moon', '2/2', 'two creatures you control');
    await dad.evaluate(() => CT.doMove(CT.S.pid + '_gbear', 'graveyard'));
    await waitStat('moon', '2/2', 'the Bear moved to the graveyard: still counted (as a creature card there)');
    await play(dad, ['bear2']);
    await waitStat('moon', '3/3', 'Moon and Bear 2 on the battlefield (2) plus the Bear card in the graveyard (1)');
    await play(son, ['sbear']);
    await waitStat('moon', '3/3', 'Son\'s Bear does not count');
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.iid === CT.S.pid + '_gmoon'); CT.act(() => { c.c = { '+1/+1': 1 }; }); });
    await waitStat('moon', '4/4', 'a +1/+1 counter adds on top');
    const title = await dad.evaluate(i => [...document.querySelectorAll('.card')].find(c => c.dataset.iid === i).querySelector('.badges .pt').getAttribute('title'), await iid('moon'));
    assert.match(title, /Includes \+3\/\+3 counted from the card's own text/, 'the badge explains it: ' + title);
    // An Aura that counts Elves: Moon-Vigil Adherents is itself an Elf, so it counts too.
    await play(dad, ['elf1', 'elf2', 'crown']);
    await dad.evaluate(() => { const f = CT.S.me.zones.battlefield, A = f.find(c => c.iid === CT.S.pid + '_gcrown'), T = f.find(c => c.iid === CT.S.pid + '_gmoon'); CT.act(() => { A.att = { p: CT.S.pid, i: T.iid }; }); });
    await waitStat('moon', '9/9', 'creatures: Moon, Bear 2, 2 Elves = 4, +1 graveyard card = 5; counter +1; Crown: 3 Elves (Moon and two Elves) = +3');
    assert.equal(await hasIcon(son, 'moon', 'Reach'), true, 'and reach, on Son\'s screen too');
    const stored = await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.iid === CT.S.pid + '_gmoon'); return [c.dp || 0, c.dt || 0, c.pb || ''].join(','); });
    assert.equal(stored, '0,0,', 'nothing stored on the card: ' + stored);
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS gets +1/+1 for each: Moon-Vigil Adherents counts creatures you control and creature cards in your graveyard, counters add on top, Son\'s creatures do not count, an Aura counts Elves, both players agree, nothing saved');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
