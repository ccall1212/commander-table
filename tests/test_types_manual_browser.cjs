/* Real-browser check of adding types by hand (two real players and a local relay): Statuses & abilities has a Types section; a type added there shows in the
 * Types row for both players, counts for "Elves you control", can be removed, "All types" works, bad input is cleaned, and it applies to a whole selection.
 * Needs the page on 8107 and the relay on 8112. */
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
      { id: 'bear', name: 'Test Bear', face: 'Test Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' },
      { id: 'bear2', name: 'Test Bear 2', face: 'Test Bear 2', type: 'Creature — Bear', oracle: '', pt: '2/2' },
      { id: 'archer', name: 'Jagged-Scar Archers', face: 'Jagged-Scar Archers', type: 'Creature — Elf Archer', oracle: 'Jagged-Scar Archers\'s power and toughness are each equal to the number of Elves you control.', pt: '*/*' }
    ]);
    await play(dad, ['lord', 'bear', 'bear2', 'archer']);
    const iid = id => dad.evaluate(i => CT.S.pid + '_g' + i, id);
    const stat = (pg, i) => pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); const pt = el && el.querySelector('.badges .pt'); return pt ? (pt.querySelectorAll('.pt-stat').length === 2 ? [...pt.querySelectorAll('.pt-stat')].map(b => b.textContent.trim()).join('/') : pt.textContent.replace(/\s+/g, '')) : ''; }, i);
    const tags = (pg, i) => pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); return el ? [...el.querySelectorAll('.ctypes .cmark')].map(m => m.textContent.trim()).filter(Boolean).sort().join(',') : null; }, i);
    const waitFor = async (get, want, why) => { for (const pg of [dad, son]) { const t0 = Date.now(); while ((await get(pg)) !== want) { if (Date.now() - t0 > 15000) throw new Error(why + ' (' + pg.playerName + ') expected [' + want + '] got [' + (await get(pg)) + ']'); await pg.waitForTimeout(100); } } };
    const waitStat = async (id, text, why) => { const i = await iid(id); await waitFor(pg => stat(pg, i), text, why); };
    const waitTags = async (id, text, why) => { const i = await iid(id); await waitFor(pg => tags(pg, i), text, why); };
    await dad.evaluate(() => { CT.S.view = 'side'; CT.render(); });
    const openDialog = async id => {
      await dad.locator(`#myBf .card[data-iid="${await iid(id)}"]`).dispatchEvent('contextmenu', { button: 2, clientX: 400, clientY: 300, bubbles: true });
      await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Statuses & abilities/ }).first().click();
      const dlg = dad.locator('.w-marks-dialog'); await dlg.waitFor(); return dlg;
    };
    const closeDialog = async () => { await dad.keyboard.press('Escape'); await dad.locator('.w-marks-dialog').waitFor({ state: 'detached' }); };

    await waitStat('bear', '2/2', 'a Bear is 2/2'); await waitStat('archer', '3/3', 'the Archers count two Elves (the lord and themselves) = 2, plus the lord bonus +1');
    // ---- 1. The Types section exists, and a type added there shows in the Types row for both players. ----
    let dlg = await openDialog('bear');
    assert.equal(await dlg.locator('legend', { hasText: 'Types' }).count(), 1, 'the dialog has a Types section');
    await dlg.locator('.type-input').fill('Elf'); await dlg.locator('.type-add').click();
    await waitTags('bear', 'Elf', 'Elf tag on both screens');
    assert.equal(await dlg.locator('.type-manual-list .mark-row').count(), 1, 'it is listed with a Remove button');
    await waitStat('bear', '3/3', 'a Bear marked as an Elf gets the Elf bonus');
    await closeDialog();
    await waitStat('archer', '4/4', 'and counts as an Elf for "number of Elves you control": 3 Elves, plus the lord bonus');
    // ---- 2. Removing it. ----
    dlg = await openDialog('bear');
    await dlg.locator('[data-remove-type="Elf"]').click();
    await waitTags('bear', '', 'tag removed'); await waitStat('bear', '2/2', 'bonus gone'); await closeDialog(); await waitStat('archer', '3/3', 'and the count');
    // ---- 3. All types, typed with sloppy input; bad characters are cleaned. ----
    dlg = await openDialog('bear');
    await dlg.locator('[data-alltypes]').check();
    await waitTags('bear', 'All types', 'All types tag'); await waitStat('bear', '3/3', 'a card with All types is an Elf too');
    await dlg.locator('.type-input').fill('<b>frog 123</b>'); await dlg.locator('.type-input').press('Enter');
    await waitTags('bear', 'All types,Bfrog B', 'cleaned (letters only, capitalised): ' + 'Bfrog B');
    await closeDialog();
    // ---- 4. Nothing else changed, and the types stay with the card but go when it leaves. ----
    const stored = await dad.evaluate(() => JSON.stringify(CT.S.me.zones.battlefield.find(c => c.iid === CT.S.pid + '_gbear').tys));
    assert.equal(stored, JSON.stringify(['All types', 'Bfrog B']), 'saved on the card: ' + stored);
    await dad.evaluate(() => CT.doMove(CT.S.pid + '_gbear', 'hand')); await dad.evaluate(() => CT.doMove(CT.S.pid + '_gbear', 'battlefield'));
    await waitTags('bear', '', 'a card that leaves the battlefield forgets its manual types');
    // ---- 5. A whole selection at once. ----
    await dad.evaluate(() => { CT.S.selected.clear(); ['bear', 'bear2'].forEach(i => CT.S.selected.add(CT.S.pid + '_g' + i)); CT.render(); });
    await dad.locator(`#myBf .card[data-iid="${await iid('bear')}"]`).dispatchEvent('contextmenu', { button: 2, clientX: 400, clientY: 300, bubbles: true });
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Statuses & abilities/ }).first().click();
    dlg = dad.locator('.w-marks-dialog'); await dlg.waitFor();
    await dlg.locator('.type-input').fill('Wizard'); await dlg.locator('.type-add').click();
    await waitTags('bear', 'Wizard', 'first selected card'); await waitTags('bear2', 'Wizard', 'second selected card');
    await closeDialog();
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS types by hand: the Statuses window has a Types section; a type added there shows in the Types row for both players and counts for tribal effects and counting; All types works; bad input is cleaned; it can be removed, applies to a selection, and goes when the card leaves');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
