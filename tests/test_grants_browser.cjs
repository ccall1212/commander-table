/* Real-browser check of abilities granted by another permanent (two real players): a Sphere Grid-style card gives reach and trample to creatures with a +1/+1 counter, shown as granted icons to both players, following the counter, never saved on the card. Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_grants_browser.cjs
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
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    const dadPid = await pidOf(dad);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const defs = [
      ['grid', 'Enchantment', 'Sphere Grid', 'Each creature you control with a +1/+1 counter on it has reach and trample.'],
      ['bearA', 'Creature — Bear', 'Bear A', ''],
      ['bearB', 'Creature — Bear', 'Bear B', '']
    ];
    await dad.evaluate(defs => { const m = CT.S.me; CT.act(() => { defs.forEach(([id, type, name, oracle], i) => { m.defs[id] = { id, name, face: name, type, oracle, img: '', tokens: [], ci: [] }; m.zones.hand.push({ iid: CT.S.pid + '_g' + id, id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); defs.forEach(([id]) => CT.doMove(CT.S.pid + '_g' + id, 'battlefield')); }, defs);
    const granted = (pg, id) => pg.evaluate(([pid, id]) => [...document.querySelectorAll('.card[data-iid="' + pid + '_g' + id + '"] .cmark.granted')].map(x => x.getAttribute('aria-label')).join('|'), [dadPid, id]);
    const waitGranted = (pg, id, want) => pg.waitForFunction(([pid, id, want]) => [...document.querySelectorAll('.card[data-iid="' + pid + '_g' + id + '"] .cmark.granted')].map(x => x.getAttribute('aria-label')).join('|') === want, [dadPid, id, want], { timeout: 10000 });
    // Nobody has a counter yet.
    await dad.waitForTimeout(400);
    assert.equal(await granted(dad, 'bearA'), '', 'no counter, no granted abilities');
    // A +1/+1 counter on Bear A: both players see Reach and Trample on it, and only on it.
    await dad.evaluate(pid => { const c = CT.S.me.zones.battlefield.find(x => x.id === 'bearA'); CT.act(() => { c.c['+1/+1'] = 1; }); }, dadPid);
    await waitGranted(dad, 'bearA', 'Reach (granted by Sphere Grid)|Trample (granted by Sphere Grid)');
    await waitGranted(son, 'bearA', 'Reach (granted by Sphere Grid)|Trample (granted by Sphere Grid)');
    assert.equal(await granted(son, 'bearB'), '', 'a creature without a counter gets nothing');
    assert.equal(await granted(son, 'grid'), '', 'the enchantment is not a creature');
    // Not saved on the card, so nothing else changes.
    assert.equal(await dad.evaluate(() => (CT.S.me.zones.battlefield.find(x => x.id === 'bearA').st || []).length), 0, 'granted abilities are never saved on the card');
    // The Statuses window shows the granted abilities as ticked; unticking one switches it off for that creature only.
    const openDlg = async () => { await dad.evaluate(pid => { CT.cardMenu(300, 300, pid + '_gbearA'); }, dadPid); await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Statuses & abilities/ }).first().click(); return dad.locator('.w-marks-dialog'); };
    let dlg = await openDlg();
    assert.equal(await dlg.locator('input[data-mark="trample"]').isChecked(), true, 'granted Trample is ticked');
    assert.equal(await dlg.locator('input[data-mark="reach"]').isChecked(), true, 'granted Reach is ticked');
    assert.equal(await dlg.locator('input[data-mark="flying"]').isChecked(), false, 'something not granted is not');
    await dlg.locator('input[data-mark="trample"]').uncheck();
    await waitGranted(dad, 'bearA', 'Reach (granted by Sphere Grid)'); await waitGranted(son, 'bearA', 'Reach (granted by Sphere Grid)');
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.find(x => x.id === 'bearA').sx.join()), 'trample', 'the switched-off ability is remembered');
    await dlg.locator('input[data-mark="trample"]').check();
    await waitGranted(dad, 'bearA', 'Reach (granted by Sphere Grid)|Trample (granted by Sphere Grid)');
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.find(x => x.id === 'bearA').sx), undefined, 'ticking it again forgets that');
    await dad.keyboard.press('Escape');
    // A creature that already HAS trample printed (turned on by hand) and is also granted it: unticking removes it completely.
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 'bearA'); CT.act(() => { c.st = ['trample']; }); });
    await waitGranted(dad, 'bearA', 'Reach (granted by Sphere Grid)');
    dlg = await openDlg();
    assert.equal(await dlg.locator('input[data-mark="trample"]').isChecked(), true);
    await dlg.locator('input[data-mark="trample"]').uncheck();
    await waitGranted(son, 'bearA', 'Reach (granted by Sphere Grid)');
    assert.equal(await son.evaluate(pid => [...document.querySelectorAll('.card[data-iid="' + pid + '_gbearA"] .cmark')].map(x => x.getAttribute('aria-label')).join('|'), dadPid), 'Reach (granted by Sphere Grid)', 'no Trample at all, hand-made or granted');
    await dad.keyboard.press('Escape');
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 'bearA'); CT.act(() => { delete c.sx; c.st = []; }); });
    await waitGranted(dad, 'bearA', 'Reach (granted by Sphere Grid)|Trample (granted by Sphere Grid)');
    // A hand-made Reach on the same card is not duplicated; the hand-made one stays when the grant ends.
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 'bearA'); CT.act(() => { c.st = ['reach']; }); });
    await waitGranted(dad, 'bearA', 'Trample (granted by Sphere Grid)');
    // Remove the counter: the grant goes away by itself for both players.
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 'bearA'); CT.act(() => { c.c = {}; }); });
    await waitGranted(dad, 'bearA', ''); await waitGranted(son, 'bearA', '');
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.find(x => x.id === 'bearA').st.join()), 'reach', 'the ability turned on by hand is still there');
    // ---- Equipment / Auras (attached), "All creatures", and effects on opponents' creatures ----
    const sonPid = await son.evaluate(() => CT.S.pid);
    const mk = (pg, list) => pg.evaluate(list => { const m = CT.S.me; CT.act(() => { list.forEach(([id, type, name, oracle]) => { m.defs[id] = { id, name, face: name, type, oracle, img: '', tokens: [], ci: [] }; m.zones.hand.push({ iid: CT.S.pid + '_g' + id, id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); list.forEach(([id]) => CT.doMove(CT.S.pid + '_g' + id, 'battlefield')); }, list);
    await mk(son, [['sonBear', 'Creature — Bear', 'Son Bear', ''], ['sonBear2', 'Creature — Bear', 'Son Bear 2', '']]);
    await mk(dad, [['sword', 'Artifact — Equipment', 'Test Sword', 'Equipped creature gets +2/+2 and has trample.'], ['wings', 'Enchantment — Aura', 'Test Wings', 'Enchanted creature has flying.']]);
    const label = (pg, pid, id) => pg.evaluate(([pid, id]) => [...document.querySelectorAll('.card[data-iid="' + pid + '_g' + id + '"] .cmark')].map(x => x.getAttribute('aria-label')).join('|'), [pid, id]);
    const waitLabel = (pg, pid, id, want) => pg.waitForFunction(([pid, id, want]) => [...document.querySelectorAll('.card[data-iid="' + pid + '_g' + id + '"] .cmark')].map(x => x.getAttribute('aria-label')).join('|') === want, [pid, id, want], { timeout: 10000 });
    // An unattached Sword and Aura give nothing.
    await dad.waitForTimeout(400);
    assert.equal(await label(dad, dadPid, 'bearB'), '', 'unattached Equipment/Aura grant nothing');
    // The Sword is attached to my Bear B, the Aura to the other player's bear.
    await dad.evaluate(([dp, sp]) => { const m = CT.S.me; CT.act(() => { m.zones.battlefield.find(x => x.id === 'sword').att = { p: dp, i: dp + '_gbearB' }; m.zones.battlefield.find(x => x.id === 'wings').att = { p: sp, i: sp + '_gsonBear' }; }); }, [dadPid, sonPid]);
    await waitLabel(dad, dadPid, 'bearB', 'Trample (granted by Test Sword)'); await waitLabel(son, dadPid, 'bearB', 'Trample (granted by Test Sword)');
    await waitLabel(son, sonPid, 'sonBear', 'Flying (granted by Test Wings)'); await waitLabel(dad, sonPid, 'sonBear', 'Flying (granted by Test Wings)');
    assert.equal(await label(son, sonPid, 'sonBear2'), '', 'only the creature the Aura is attached to');
    // Unattaching ends it for everyone.
    await dad.evaluate(() => { const m = CT.S.me; CT.act(() => { m.zones.battlefield.find(x => x.id === 'sword').att = null; }); });
    await waitLabel(dad, dadPid, 'bearB', ''); await waitLabel(son, dadPid, 'bearB', '');
    // "All creatures have haste" reaches every board; an opponent-only card reaches only the other player's creatures.
    await mk(dad, [['cross', 'Enchantment', 'Test Crossroads', 'All creatures have haste.'], ['wall', 'Creature — Wall', 'Test Wall', 'Creatures your opponents control have defender.']]);
    await waitLabel(dad, dadPid, 'bearB', 'Haste (granted by Test Crossroads)'); await waitLabel(son, sonPid, 'sonBear2', 'Defender (granted by Test Wall)|Haste (granted by Test Crossroads)');
    assert.equal(await label(son, dadPid, 'wall'), 'Haste (granted by Test Crossroads)', 'the Wall does not give defender to its own side');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS granted abilities: Sphere Grid-style grant appears for both players on creatures with a +1/+1 counter only, follows the counter, is never saved, and does not duplicate a hand-made ability');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
