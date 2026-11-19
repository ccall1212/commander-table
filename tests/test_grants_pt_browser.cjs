/* Real-browser check of granted power/toughness (two real players and a local relay): an Aura adds its bonus, a frog Aura sets base power/toughness
 * (counters still count on top), plain anthems and "during your turn" grants work, removing the Aura puts things back, and the other player sees the
 * same. Needs the page on 8107 and the relay on 8112. */
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




    const defs = {
      bear: { id: 'bear', name: 'Test Bear', face: 'Test Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' },
      elf1: { id: 'elf1', name: 'Test Elf', face: 'Test Elf', type: 'Creature — Elf', oracle: '', pt: '1/1' },
      elf2: { id: 'elf2', name: 'Other Elf', face: 'Other Elf', type: 'Creature — Elf Warrior', oracle: '', pt: '1/1' },
      vow: { id: 'vow', name: 'Vow of Flight', face: 'Vow of Flight', type: 'Enchantment — Aura', oracle: 'Enchant creature\nEnchanted creature gets +2/+2, has flying, and can\'t attack you or planeswalkers you control.' },
      frog: { id: 'frog', name: 'Frogify', face: 'Frogify', type: 'Enchantment — Aura', oracle: 'Enchant creature\nEnchanted creature loses all abilities and is a blue Frog with base power and toughness 1/1.' },
      lord: { id: 'lord', name: 'Elf Lord', face: 'Elf Lord', type: 'Creature — Elf', oracle: 'Elves you control get +1/+1.', pt: '2/2' },
      cait: { id: 'cait', name: 'Cait, Cage Brawler', face: 'Cait, Cage Brawler', type: 'Legendary Creature — Human', oracle: 'During your turn, Cait has indestructible.', pt: '3/3' }
    };
    await dad.evaluate(d => { const m = CT.S.me; CT.act(() => { Object.values(d).forEach(def => { def.tokens = []; def.ci = []; m.defs[def.id] = def; m.zones.hand.push({ iid: CT.S.pid + '_g' + def.id, id: def.id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); ['bear', 'elf1', 'elf2', 'vow', 'frog'].forEach(id => CT.doMove(CT.S.pid + '_g' + id, 'battlefield')); CT.act(() => { CT.S.me.zones.battlefield.forEach(c => { c.st = (c.st || []).filter(x => x !== 'sick'); }); }); }, defs);
    const iid = id => dad.evaluate(i => CT.S.pid + '_g' + i, id);
    const badge = async (pg, id) => { const i = await iid(id); return pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); const pt = el && el.querySelector('.badges .pt'); return pt ? (pt.querySelectorAll('.pt-stat').length === 2 ? [...pt.querySelectorAll('.pt-stat')].map(b => b.textContent.trim()).join('/') : pt.textContent.replace(/\s+/g, '')) : ''; }, i); };
    const waitBadge = async (id, text, why) => {
      const i = await iid(id);
      for (const pg of [dad, son]) await pg.waitForFunction(([x, t]) => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); const pt = el && el.querySelector('.badges .pt'); const txt = !pt ? '' : (pt.querySelectorAll('.pt-stat').length === 2 ? [...pt.querySelectorAll('.pt-stat')].map(b => b.textContent.trim()).join('/') : pt.textContent.replace(/\s+/g, '')); return txt === t; }, [i, text], { timeout: 15000 }).catch(async () => { throw new Error(why + ' (' + pg.playerName + ') expected ' + text + ' got ' + (await badge(pg, id))); });
    };
    const hasIcon = async (pg, id, label) => { const i = await iid(id); return pg.evaluate(([x, l]) => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); return !!el && [...el.querySelectorAll('.cmark')].some(m => ((m.getAttribute('title') || m.getAttribute('data-tip') || '')).startsWith(l)); }, [i, label]); };
    const attach = (aura, to) => dad.evaluate(([a, t]) => { const f = CT.S.me.zones.battlefield; const A = f.find(c => c.iid === CT.S.pid + '_g' + a), T = f.find(c => c.iid === CT.S.pid + '_g' + t); CT.act(() => { A.att = t ? { p: CT.S.pid, i: T.iid } : null; }); }, [aura, to]);

    // ---- 1. Plain numbers first: printed power/toughness. ----
    await waitBadge('bear', '2/2', 'a bear is 2/2');
    // ---- 2. An Aura adds its bonus and its ability, for both players. ----
    await attach('vow', 'bear');
    await waitBadge('bear', '4/4', 'Vow of Flight gives +2/+2');
    for (const pg of [dad, son]) await pg.waitForFunction(async () => true);
    assert.equal(await hasIcon(dad, 'bear', 'Flying'), true, 'and flying (Dad)');
    assert.equal(await hasIcon(son, 'bear', 'Flying'), true, 'and flying (Son)');
    // ---- 3. A +1/+1 counter counts on top. ----
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.iid === CT.S.pid + '_gbear'); CT.act(() => { c.c = Object.assign({}, c.c, { '+1/+1': 1 }); }); });
    await waitBadge('bear', '5/5', 'a counter counts on top of the Aura');
    // ---- 4. A frog Aura sets base power/toughness 1/1; the +2/+2 Aura and the counter still add. ----
    await attach('frog', 'bear');
    await waitBadge('bear', '4/4', 'base 1/1, then +2/+2 and the counter');
    const title = await dad.evaluate(i => [...document.querySelectorAll('.card')].find(c => c.dataset.iid === i).querySelector('.badges .pt').getAttribute('title'), await iid('bear'));
    assert.match(title, /Includes .*base 1\/1 from Frogify/, 'the badge says where it comes from: ' + title);
    await attach('vow', null);
    await waitBadge('bear', '2/2', 'only the frog Aura and the counter: 1/1 base + counter');
    await attach('frog', null);
    await waitBadge('bear', '3/3', 'no Auras: printed 2/2 plus the counter');
    assert.equal(await hasIcon(dad, 'bear', 'Flying'), false, 'flying goes away with the Aura');
    // ---- 5. A plain anthem: "Elves you control get +1/+1." ----
    await waitBadge('elf1', '1/1', 'an Elf is 1/1');
    await dad.evaluate(() => CT.doMove(CT.S.pid + '_glord', 'battlefield'));
    await waitBadge('elf1', '2/2', 'the anthem');
    await waitBadge('elf2', '2/2', 'a second Elf (Elf Warrior)');
    await waitBadge('lord', '3/3', 'the lord itself is an Elf too (2/2 + 1) (it says "Elves you control", not "other")');
    assert.equal(await badge(dad, 'bear'), '3/3', 'a Bear is not an Elf');
    // ---- 6. "During your turn": Cait has indestructible only on her controller's turn. ----
    await dad.evaluate(() => { CT.doMove(CT.S.pid + '_gcait', 'battlefield'); });
    const active = () => dad.evaluate(() => CT.S.table.active === CT.S.pid);
    if (!(await active())) { await son.locator('button[data-a="pass"]').first().click(); await dad.waitForFunction(() => CT.S.table.active === CT.S.pid); }
    await dad.waitForFunction(i => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === i); return !!el && [...el.querySelectorAll('.cmark')].some(m => ((m.getAttribute('title') || m.getAttribute('data-tip') || '')).startsWith('Indestructible')); }, await iid('cait'));
    assert.equal(await hasIcon(son, 'cait', 'Indestructible'), true, 'Son sees it on Dad\'s turn');
    await dad.locator('button[data-a="pass"]').first().click();
    await dad.waitForFunction(() => CT.S.table.active !== CT.S.pid);
    await dad.waitForFunction(i => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === i); return !!el && ![...el.querySelectorAll('.cmark')].some(m => ((m.getAttribute('title') || m.getAttribute('data-tip') || '')).startsWith('Indestructible')); }, await iid('cait'));
    assert.equal(await hasIcon(son, 'cait', 'Indestructible'), false, 'and not on Son\'s turn');
    // ---- 7. Nothing is saved on the cards: grants are drawn, not stored. ----
    const stored = await dad.evaluate(() => CT.S.me.zones.battlefield.map(c => [c.iid.split('_g')[1], c.dp || 0, c.dt || 0, c.pb || '', (c.st || []).join()].join(':')).join(' '));
    assert.doesNotMatch(stored, /bear:[1-9]|bear:0:[1-9]|:1\/1/, 'no power/toughness or base was stored on the bear: ' + stored);
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS granted power/toughness: an Aura adds its bonus and ability, a frog Aura sets base 1/1 with counters on top, anthems and "during your turn" work, both players agree, nothing is saved on the cards');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
