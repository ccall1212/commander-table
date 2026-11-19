/* Real-browser check of card types and creature types (two real players and a local relay): an Aura that makes a creature a Frog shows a Frog tag and
 * takes away its old creature types (so it no longer gets "Elves you control" bonuses), "All lands are Islands" tags every land, a Changeling is every type
 * (tag "All types", counts as an Elf), and both players see the same. Needs the page on 8107 and the relay on 8112. */
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
      { id: 'lord', name: 'Elf Lord', face: 'Elf Lord', type: 'Creature — Elf', oracle: 'Elves you control get +1/+1.', pt: '2/2' },
      { id: 'elf', name: 'Test Elf', face: 'Test Elf', type: 'Creature — Elf Warrior', oracle: '', pt: '1/1' },
      { id: 'ling', name: 'Changeling Outcast', face: 'Changeling Outcast', type: 'Creature — Shapeshifter', oracle: 'Changeling (This card is every creature type.)', pt: '1/1' },
      { id: 'archer', name: 'Jagged-Scar Archers', face: 'Jagged-Scar Archers', type: 'Creature — Elf Archer', oracle: 'Jagged-Scar Archers\'s power and toughness are each equal to the number of Elves you control.', pt: '*/*' },
      { id: 'frog', name: 'Frogify', face: 'Frogify', type: 'Enchantment — Aura', oracle: 'Enchant creature\nEnchanted creature loses all abilities and is a blue Frog with base power and toughness 1/1.' },
      { id: 'tide', name: 'Stormtide Leviathan', face: 'Stormtide Leviathan', type: 'Creature — Leviathan', oracle: 'All lands are Islands in addition to their other types.', pt: '8/8' },
      { id: 'plains', name: 'Test Plains', face: 'Test Plains', type: 'Basic Land — Plains', oracle: '' },
      { id: 'moon', name: 'Imprisoned in the Moon', face: 'Imprisoned in the Moon', type: 'Enchantment — Aura', oracle: 'Enchant creature, land, or planeswalker\nEnchanted permanent is a colorless land with "{T}: Add {C}" and loses all other card types and abilities.' },
      { id: 'bear', name: 'Test Bear', face: 'Test Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' }
    ]);
    await mk(son, [{ id: 'splains', name: 'Son Plains', face: 'Son Plains', type: 'Basic Land — Plains', oracle: '' }]);
    const iid = id => dad.evaluate(i => CT.S.pid + '_g' + i, id), siid = id => son.evaluate(i => CT.S.pid + '_g' + i, id);
    const stat = (pg, i) => pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); const pt = el && el.querySelector('.badges .pt'); return pt ? (pt.querySelectorAll('.pt-stat').length === 2 ? [...pt.querySelectorAll('.pt-stat')].map(b => b.textContent.trim()).join('/') : pt.textContent.replace(/\s+/g, '')) : ''; }, i);
    const tags = (pg, i) => pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); return el ? [...el.querySelectorAll('.cwords .cmark')].map(m => m.textContent.trim()).filter(Boolean).sort().join(',') : null; }, i);
    const waitFor = async (get, want, why) => { for (const pg of [dad, son]) { const t0 = Date.now(); while ((await get(pg)) !== want) { if (Date.now() - t0 > 15000) throw new Error(why + ' (' + pg.playerName + ') expected [' + want + '] got [' + (await get(pg)) + ']'); await pg.waitForTimeout(100); } } };
    const waitStat = async (id, text, why) => { const i = await iid(id); await waitFor(pg => stat(pg, i), text, why); };
    const waitTags = async (id, text, why) => { const i = await iid(id); await waitFor(pg => tags(pg, i), text, why); };
    const attach = (what, to) => dad.evaluate(([a, t]) => { const f = CT.S.me.zones.battlefield; const A = f.find(c => c.iid === CT.S.pid + '_g' + a), T = f.find(c => c.iid === CT.S.pid + '_g' + t); CT.act(() => { A.att = t ? { p: CT.S.pid, i: T.iid } : null; }); }, [what, to]);

    // ---- 1. A Changeling is every type: an "All types" tag, and it counts as an Elf. ----
    await play(dad, ['lord', 'elf', 'ling', 'bear']);
    await waitTags('ling', 'All types', 'Changeling shows an All types tag');
    await waitTags('elf', '', 'an ordinary Elf has no type tag');
    await waitStat('elf', '2/2', 'an Elf gets the lord bonus');
    await waitStat('ling', '2/2', 'a Changeling counts as an Elf: it gets the lord bonus too');
    await waitStat('bear', '2/2', 'a Bear does not (no Elf bonus)');
    // ---- 2. Counting Elves includes the Changeling. ----
    await play(dad, ['archer']);
    await waitStat('archer', '5/5', 'Lord, Elf, Changeling and Archers itself are Elves (4), plus the lord bonus +1 on the Archers');
    // ---- 3. A frog Aura: a Frog tag, base 1/1, and it stops being an Elf. ----
    await play(dad, ['frog']);
    await attach('frog', 'elf');
    await waitTags('elf', 'Frog', 'a Frog tag');
    await waitStat('elf', '1/1', 'base 1/1 and no more Elf bonus (a Frog is not an Elf)');
    await waitStat('archer', '4/4', 'the Frog is no longer an Elf, so one fewer Elf (3) plus the lord bonus');
    await attach('frog', null);
    await waitTags('elf', '', 'the tag goes away with the Aura'); await waitStat('archer', '5/5', 'and the Elf count comes back');
    // ---- 4. "All lands are Islands in addition": every land of every player is tagged. ----
    await play(dad, ['plains', 'tide']); await play(son, ['splains']);
    await waitTags('plains', 'Island', 'Dad\'s Plains is also an Island');
    const sp = await siid('splains');
    await waitFor(pg => tags(pg, sp), 'Island', 'and so is Son\'s');
    // ---- 5. A type-setting Aura on a permanent: Imprisoned in the Moon turns a creature into a land. ----
    await play(dad, ['moon']);
    await attach('moon', 'bear');
    await waitTags('bear', 'Land', 'the Bear is now a Land (and, with the Leviathan out, an Island is shown for lands only)');
    const stored = await dad.evaluate(() => JSON.stringify(CT.S.me.zones.battlefield.filter(c => /_g(?:bear|elf|ling)$/.test(c.iid)).map(c => [c.st || [], c.pb || '', c.dp || 0])));
    assert.equal(stored, JSON.stringify([[[], '', 0], [[], '', 0], [[], '', 0]]), 'nothing was stored on the cards: ' + stored);
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS card types: a Changeling is every type, a frog Aura changes a creature\'s types, "All lands are Islands" tags every land, an Aura can turn a creature into a land, tribal effects follow the new types, both players agree, nothing saved');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
