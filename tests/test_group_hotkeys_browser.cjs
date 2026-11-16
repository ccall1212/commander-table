/* Real-browser check that hotkeys act on every selected battlefield card (tap, face-down, graveyard, and W arrows from all of
 * them), as one Undo step, and still act on a single card when the hovered card is not in the selection (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_group_hotkeys_browser.cjs
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
    const sonPid = await pidOf(son);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    for (let i = 0; i < 5; i++) { const c = dad.locator('#myHand .card').first(); await c.hover(); await dad.keyboard.press('b'); await dad.waitForFunction(n => CT.S.me.zones.battlefield.length === n, i + 1); }
    await dad.mouse.move(5, 5);
    const bf = () => dad.evaluate(() => CT.S.me.zones.battlefield.map(c => ({ iid: c.iid, t: !!c.t, fd: !!c.fd })));
    const ids = (await bf()).map(c => c.iid);
    const sel = ids.slice(0, 4), outsider = ids[4];
    const select = list => dad.evaluate(l => { CT.S.selected.clear(); l.forEach(i => CT.S.selected.add(i)); CT.render(); }, list);
    const hoverCard = iid => dad.locator(`#myBf .card[data-iid="${iid}"]`).hover();
    const states = async key => (await bf()).map(c => c[key]);
    const press = async (iid, key) => { await dad.mouse.move(5, 5); await hoverCard(iid); await dad.keyboard.press(key); };
    const undo = async () => { await dad.keyboard.press('Control+z'); await dad.waitForTimeout(300); };
    const moveFromMenu = async label => {
      await select(sel);
      await dad.locator(`#myBf .card[data-iid="${sel[0]}"]`).click({ button: 'right' });
      await dad.locator('.w-menu').first().getByRole('menuitem', { name: /^Move to/ }).click();
      await dad.locator('.w-menu').last().getByRole('menuitem', { name: label, exact: true }).click();
    };

    // In Grid, an empty part of the host's own tile opens the same table menu as Sidebar.
    await dad.locator('button[data-a="view"][data-v="grid"]').click();
    const emptyGridPoint = await dad.locator('.opp.mytile .obf').evaluate(el => {
      const r = el.getBoundingClientRect();
      for (const fy of [0.15, 0.3, 0.5, 0.7]) for (const fx of [0.85, 0.7, 0.5, 0.3, 0.15]) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        const hit = document.elementFromPoint(x, y);
        if (hit && hit.closest('.opp.mytile .obf') === el && !hit.closest('.card, [data-pile], .tstrip, .thand, .tpile, button')) return { x, y };
      }
      return null;
    });
    assert(emptyGridPoint, 'the own Grid tile has a visible empty battlefield point');
    await dad.mouse.click(emptyGridPoint.x, emptyGridPoint.y, { button: 'right' });
    await dad.getByRole('menuitem', { name: /^Draw a card/ }).waitFor();
    await dad.keyboard.press('Escape');
    await dad.locator('button[data-a="view"][data-v="side"]').click();

    // T taps every selected card; T again untaps them all; one Undo steps back the whole group.
    await select(sel); await press(sel[0], 't');
    await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => c.t), sel);
    assert.deepEqual(await states('t'), [true, true, true, true, false], 'T tapped the four selected cards and not the fifth');
    await undo();
    assert.deepEqual(await states('t'), [false, false, false, false, false], 'one Undo untapped all four');
    await select(sel); await hoverCard(sel[0]);
    await press(sel[0], 't'); await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => c.t), sel);
    await press(sel[0], 't'); await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => !c.t), sel);
    // Hovering a card that is NOT in the selection acts on that card only.
    await press(outsider, 't');
    await dad.waitForFunction(i => CT.S.me.zones.battlefield.find(c => c.iid === i).t, outsider);
    assert.deepEqual(await states('t'), [false, false, false, false, true], 'the outsider alone was tapped');
    await press(outsider, 't');
    // Face down for the group.
    await select(sel); await press(sel[1], 'z');
    await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => c.fd), sel);
    assert.deepEqual(await states('fd'), [true, true, true, true, false]);
    await press(sel[1], 'z'); await dad.waitForFunction(l => CT.S.me.zones.battlefield.filter(c => l.includes(c.iid)).every(c => !c.fd), sel);

    // W then a click on an opponent's board: one arrow from every selected card.
    await select(sel); await press(sel[2], 'w');
    await dad.waitForFunction(() => !!CT.S.arrowPick && CT.S.arrowPick.more.length === 3);
    const box = await dad.locator(`.opp.tile[data-opp="${sonPid}"] .obf`).first().boundingBox();
    await dad.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await dad.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await dad.waitForFunction(() => CT.S.targetArrows.length === 4);
    await son.waitForFunction(() => CT.S.targetArrows.length === 4);
    const fromIids = (await dad.evaluate(() => CT.S.targetArrows.map(a => a.from.iid))).sort();
    assert.deepEqual(fromIids, [...sel].sort(), 'an arrow from each of the four selected cards, seen by the other player too');
    await dad.evaluate(() => CT.hostRecv({ t: 'arrows', k: 'clear' }, CT.S.pid));
    // Without a selection W still draws a single arrow.
    await select([]); await press(outsider, 'w');
    await dad.waitForFunction(() => !!CT.S.arrowPick && CT.S.arrowPick.more.length === 0);
    await dad.keyboard.press('Escape');

    // G sends every selected card to the graveyard, and a single Undo brings them all back.
    await select(sel); await press(sel[0], 'g');
    await dad.waitForFunction(() => CT.S.me.zones.graveyard.length === 4);
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.length), 1);
    await undo();
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.length), 5, 'one Undo returned all four cards');
    assert.equal(await dad.evaluate(() => CT.S.me.zones.graveyard.length), 0);

    // The contextual Move to submenu matches the group hotkeys and keeps one Undo step.
    await moveFromMenu('Exile');
    await dad.waitForFunction(() => CT.S.me.zones.exile.length === 4);
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.length), 1);
    await undo();
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.length), 5, 'one Undo restored the whole contextual move');

    // Shuffle the existing library first, then put the selected cards underneath it.
    const libraryBefore = await dad.evaluate(() => CT.S.me.zones.library.map(c => c.iid));
    await moveFromMenu('Shuffle library, then put on bottom');
    await dad.waitForFunction(n => CT.S.me.zones.library.length === n + 4, libraryBefore.length);
    const libraryAfter = await dad.evaluate(() => CT.S.me.zones.library.map(c => c.iid));
    assert.deepEqual(libraryAfter.slice(0, libraryBefore.length).sort(), [...libraryBefore].sort(), 'the old library was shuffled as a set before the cards were added');
    assert.deepEqual(libraryAfter.slice(-4).sort(), [...sel].sort(), 'the selected set is at the bottom');
    await undo();
    assert.deepEqual(await dad.evaluate(() => CT.S.me.zones.library.map(c => c.iid)), libraryBefore, 'one Undo restores the library');
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS group actions (two real browsers): Grid empty-board menu, T/Z/G/W hotkeys, group Move to, library shuffle before bottom placement and one-step Undo');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
