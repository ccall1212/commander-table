/* Real-browser check of Temporary effects: +1/+1 and statuses/abilities on a selected group that wear off when the turn passes,
 * seen by the other player, while permanent changes stay (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_temporary_effects_browser.cjs
 * Set CT_CHROMIUM if Chromium is not at /usr/bin/chromium. Never touches Cloudflare. */
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
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
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
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    const dadPid = await pidOf(dad), sonPid = await pidOf(son);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    for (let i = 0; i < 4; i++) { const c = dad.locator('#myHand .card').first(); await c.hover(); await dad.keyboard.press('b'); await dad.waitForFunction(n => CT.S.me.zones.battlefield.length === n, i + 1); }
    await dad.mouse.move(5, 5);
    const cards = () => dad.evaluate(() => CT.S.me.zones.battlefield.map(c => ({ iid: c.iid, tp: c.tp || 0, tt: c.tt || 0, dp: c.dp || 0, ts: c.ts || [], st: c.st || [] })));
    const ids = (await cards()).map(c => c.iid), sel = ids.slice(0, 3), outsider = ids[3];
    const select = list => dad.evaluate(l => { CT.S.selected.clear(); l.forEach(i => CT.S.selected.add(i)); CT.render(); }, list);
    const ctx = iid => dad.locator(`#myBf .card[data-iid="${iid}"]`).dispatchEvent('contextmenu', { button: 2, clientX: 400, clientY: 300, bubbles: true });
    const menuItem = async (text) => dad.locator('.w-menu-item', { hasText: text }).first();

    // Permanent marker on one card, to check it survives the end of turn.
    await dad.evaluate(i => { const c = CT.S.me.zones.battlefield.find(x => x.iid === i); CT.act(() => { c.st = ['flying']; }); }, sel[0]);

    // Temporary +1/+1 for the whole selection through the right-click menu.
    await select(sel); await ctx(sel[0]);
    await (await menuItem('Temporary (until end of turn)')).hover();
    await (await menuItem('+1/+1 until end of turn · 3 selected')).click();
    await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => c.tp === 1 && c.tt === 1), sel);
    let st = await cards();
    assert.deepEqual(st.map(c => c.tp), [1, 1, 1, 0], 'three selected cards got +1 power, the outsider did not');
    assert.deepEqual(st.map(c => c.dp), [0, 0, 0, 0], 'it is separate from the permanent +1/+1 modifier');
    await dad.waitForFunction(() => document.querySelectorAll('#myBf .card .badges .pt.temp').length === 3);
    // A temporary ability on the same group through the dialog.
    await select(sel); await ctx(sel[1]);
    await (await menuItem('Temporary (until end of turn)')).hover();
    await (await menuItem('Statuses & abilities until end of turn…')).click();
    const dlg = dad.locator('.w-marks-dialog'); await dlg.waitFor();
    assert.match(await dlg.locator('legend').first().innerText() + await dlg.innerText(), /wear off when the turn passes/);
    await dlg.locator('label.mark-row', { hasText: 'Vigilance' }).locator('input').check();
    await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => (c.ts || []).includes('vigilance')), sel);
    await dad.keyboard.press('Escape');
    st = await cards();
    assert.deepEqual(st.map(c => c.ts.length), [1, 1, 1, 0], 'Vigilance on the three selected cards only');
    assert.deepEqual(st[0].st, ['flying'], 'the permanent marker is untouched');
    await dad.waitForFunction(() => document.querySelectorAll('#myBf .card .cmark.temp').length === 3);
    // The other player sees them (marked as temporary) on the small board.
    await son.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).filter(c => c.tp === 1 && (c.ts || []).includes('vigilance')).length === 3, dadPid);
    await son.waitForFunction(() => document.querySelectorAll('.opp.tile .card .cmark.temp').length === 3);
    if (process.env.CT_SHOTS) { await dad.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); }); await dad.waitForTimeout(300); await dad.screenshot({ path: process.env.CT_SHOTS + '/temp.png' }); }

    // One Undo steps back the last group change only (the Vigilance), not the +1/+1.
    await dad.mouse.move(5, 5); await dad.keyboard.press('Control+z'); await dad.waitForTimeout(300);
    st = await cards();
    assert.deepEqual(st.map(c => c.ts.length), [0, 0, 0, 0], 'Undo removed the temporary Vigilance from all three at once');
    assert.deepEqual(st.map(c => c.tp), [1, 1, 1, 0], 'and kept the +1/+1');
    await select(sel); await ctx(sel[1]);
    await (await menuItem('Temporary (until end of turn)')).hover();
    await (await menuItem('Statuses & abilities until end of turn…')).click();
    await dad.locator('.w-marks-dialog label.mark-row', { hasText: 'Vigilance' }).locator('input').check();
    await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => (c.ts || []).includes('vigilance')), sel);
    await dad.keyboard.press('Escape');

    // Set power and toughness (typed) until end of turn on the whole group.
    await select(sel); await ctx(sel[2]);
    await (await menuItem('Temporary (until end of turn)')).hover();
    await (await menuItem('Set power/toughness until end of turn… · 3 selected')).click();
    const pti = dad.locator('.w-dialog input').first(); await pti.fill('10000/7'); await dad.keyboard.press('Enter');
    await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => c.tb === '10000/7'), sel);
    assert.deepEqual((await dad.evaluate(() => CT.S.me.zones.battlefield.map(c => c.tb || null))), ['10000/7', '10000/7', '10000/7', null], 'typed power/toughness applied to the three selected cards only');
    await dad.waitForFunction(() => [...document.querySelectorAll('#myBf .card .badges .pt.temp')].filter(b => /10001\s*8/.test(b.innerText)).length === 3);
    await son.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).filter(c => c.tb === '10000/7').length === 3, dadPid);

    // The turn passes: every temporary effect disappears, permanent ones stay, for both players.
    const active = () => dad.evaluate(() => CT.S.table.active);
    const waitActive = pid => Promise.all([dad, son].map(pg => pg.waitForFunction(p => CT.S.table.active === p, pid)));
    if ((await active()) !== dadPid) { await dad.locator('button[data-a="pass"]').first().click(); await dad.locator('button', { hasText: 'Pass their turn' }).click().catch(() => {}); await waitActive(dadPid).catch(() => {}); }
    const before = await dad.evaluate(() => CT.S.table.turnSeq);
    if ((await active()) === dadPid) await dad.locator('button[data-a="pass"]').first().click();
    else { await dad.locator('button[data-a="pass"]').first().click(); await dad.locator('button', { hasText: 'Pass their turn' }).click(); }
    await dad.waitForFunction(b => CT.S.table.turnSeq > b, before);
    await dad.waitForFunction(() => CT.S.me.zones.battlefield.every(c => !c.tp && !c.tt && !c.tb && !(c.ts || []).length), null, { timeout: 8000 });
    st = await cards();
    assert.deepEqual(st[0].st, ['flying'], 'the permanent marker survived the turn change');
    await son.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).every(c => !c.tp && !(c.ts || []).length), dadPid);
    await dad.waitForFunction(() => document.querySelectorAll('#myBf .card .cmark.temp, #myBf .card .badges .pt.temp').length === 0);
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS temporary effects (two real browsers): +1/+1 and Vigilance on a selected group, shown to the other player as temporary, one Undo, gone when the turn passes while permanent markers stay');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
