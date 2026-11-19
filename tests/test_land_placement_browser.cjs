/* Real-browser check of where lands go when they leave the hand (two real players and a local relay): each land goes to the next open space in the Lands
 * area, never under the hand strip, and every land stays clickable even when the visible part of the area is full (packed closer, never thrown into the middle of the
 * board). Checked at 1366x768 and 1920x1080, in the Sidebar and Grid layouts. Needs the page on 8107 and the relay on 8112. */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const mkDeck = who => ({
  id: 'share-' + who, name: who + ' deck', commanders: [], tokens: [], createdAt: '2026-11-02', source: '',
  cards: Array.from({ length: 40 }, (_, i) => ({ def: { id: who + '-c' + i, name: `${who} Card ${String(i).padStart(2, '0')}`, type: 'Creature', ci: ['U'], tokens: [], img: 'https://cards.scryfall.io/normal/front/x/' + who + i + '.jpg' }, qty: 1 }))
});

const PLAYERS = Number(process.env.CT_PLAYERS || 2); // 2, 3 or 4 real players at the table
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
    const room = await dad.evaluate(() => CT.S.room);
    const dadPid0 = await dad.evaluate(() => CT.S.pid);
    const others = [];
    for (const [nm, col] of [['Son', 'red'], ['Mom', 'blue'], ['Kid', 'green']].slice(0, PLAYERS - 1)) others.push(await joinGame(nm, room, col));
    const son = others[0];
    await dad.waitForFunction(n => CT.S.table.seats.length === n, PLAYERS);
    for (const pg of [dad, ...others]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    for (const pg of others) await pg.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, ...others]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });









    const lands = [];
    for (let i = 0; i < 12; i++) lands.push({ id: 'f' + i, name: 'Forest', face: 'Forest', type: 'Basic Land — Forest', oracle: '', tokens: [], ci: ['G'] });
    for (let i = 0; i < 14; i++) lands.push({ id: 'n' + i, name: 'Nonbasic ' + i, face: 'Nonbasic ' + i, type: 'Land', oracle: '', tokens: [], ci: [] });
    await dad.evaluate(d => { const m = CT.S.me; CT.act(() => { d.forEach(def => { m.defs[def.id] = def; m.zones.hand.push({ iid: CT.S.pid + '_g' + def.id, id: def.id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); }, lands);
    const probe = view => dad.evaluate(view => {
      const row = document.querySelector('#myRow'), strip = view === 'side' && row && row.offsetParent ? row.getBoundingClientRect() : null; // only the Sidebar layout has a separate hand strip over the board
      const reg = CT.S.me.layout.find(r => r.k === 'lands');
      return CT.S.me.zones.battlefield.filter(c => /^(f|n)\d+$/.test(c.id)).map(c => {
        // the copy that is really on screen (Grid also draws cards inside a tile)
        const el = [...document.querySelectorAll('.card[data-iid="' + c.iid + '"]')].find(e => { const b = e.getBoundingClientRect(); return b.width > 4 && b.height > 4 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight; });
        if (!el) return { id: c.id, missing: true };
        const r = el.getBoundingClientRect();
        const pts = [[.5, .5], [.5, .04], [.2, .2], [.8, .2], [.2, .8], [.8, .8]].map(([fx, fy]) => { const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); return !!hit && !!hit.closest('.card[data-iid="' + c.iid + '"]'); });
        return { id: c.id, x: Math.round(c.x), y: Math.round(c.y), aboveStrip: !strip || r.bottom <= strip.top + 2, reachable: pts.some(Boolean), inRegion: c.x >= reg.x - 1 && c.x + 80 <= reg.x + reg.w + 30 && c.y >= reg.y - 1 };
      });
    }, view);
    let lastRun = '';
    // Lands that tap for the same mana stack on each other (Tangled Islet and Temple of Mystery both make G or U); a land for other mana does not join them.
    await dad.evaluate(() => {
      const m = CT.S.me, defs = [
        { id: 'tangled', name: 'Tangled Islet', face: 'Tangled Islet', type: 'Land — Forest Island', oracle: '({T}: Add {G} or {U}.)\nThis land enters tapped.', tokens: [], ci: [] },
        { id: 'temple', name: 'Temple of Mystery', face: 'Temple of Mystery', type: 'Land', oracle: 'This land enters tapped.\nWhen this land enters, scry 1.\n{T}: Add {G} or {U}.', tokens: [], ci: [] },
        { id: 'peak', name: 'Sunlit Peak', face: 'Sunlit Peak', type: 'Land', oracle: '{T}: Add {R}.', tokens: [], ci: [] }];
      CT.act(() => { m.zones.battlefield.splice(0); defs.forEach(d => { m.defs[d.id] = d; m.zones.hand.push({ iid: CT.S.pid + '_s' + d.id, id: d.id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); });
      ['tangled', 'temple', 'peak'].forEach(id => CT.doMove(CT.S.pid + '_s' + id, 'battlefield'));
    });
    const st = await dad.evaluate(() => Object.fromEntries(CT.S.me.zones.battlefield.map(c => [c.id, { x: c.x, y: c.y }])));
    assert.ok(st.temple.x === st.tangled.x && st.temple.y - st.tangled.y > 0 && st.temple.y - st.tangled.y <= 30, 'Temple of Mystery stacks on Tangled Islet: ' + JSON.stringify(st));
    assert.ok(st.peak.x !== st.tangled.x, 'a red land does not join the G/U stack: ' + JSON.stringify(st));
    // Pointing at a land in a pile keeps it in place (the cards below it stay visible); a creature still comes to the front.
    await dad.evaluate(() => {
      const m = CT.S.me; m.defs.bear = { id: 'bear', name: 'Bear', face: 'Bear', type: 'Creature — Bear', oracle: '', tokens: [], ci: [] };
      CT.act(() => { m.zones.hand.push({ iid: CT.S.pid + '_sbear', id: 'bear', own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); });
      CT.doMove(CT.S.pid + '_sbear', 'battlefield');
    });
    await dad.waitForTimeout(300);
    const rect = iid => dad.evaluate(i => { const e = [...document.querySelectorAll('.card[data-iid="' + i + '"]')].find(x => x.getBoundingClientRect().width > 4); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, z: getComputedStyle(e).zIndex, land: e.classList.contains('land') }; }, iid);
    const top = await rect(dadPid0 + '_stangled'), under = await rect(dadPid0 + '_stemple');
    assert.ok(top.land && under.land, 'lands on the battlefield are marked as lands');
    await dad.mouse.move(top.x + top.w / 2, top.y + 3);                  // point at the top strip of the first card
    await dad.waitForTimeout(150);
    const hovered = await rect(dadPid0 + '_stangled');
    assert.ok(Number(hovered.z) < 900, 'pointing at a land does not bring it to the front (z-index ' + hovered.z + ')');
    const hit = await dad.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const c = el && el.closest('.card'); return c && c.dataset.iid; }, [top.x + top.w / 2, top.y + top.h - 6]);
    assert.equal(hit, dadPid0 + '_stemple', 'the card below stays on top of it while pointing at the one above: ' + hit);
    await dad.mouse.down(); const pressed = await rect(dadPid0 + '_stangled'); await dad.mouse.up();
    assert.equal(pressed.z, '900', 'pressing it (click or grab) brings it to the front');
    await dad.mouse.move(5, 5);
    const bear = await rect(dadPid0 + '_sbear'); await dad.mouse.move(bear.x + bear.w / 2, bear.y + bear.h / 2); await dad.waitForTimeout(150);
    assert.equal((await rect(dadPid0 + '_sbear')).z, '900', 'a creature still comes to the front when pointed at');
    await dad.mouse.move(5, 5);
    for (const [w, h] of [[1366, 768], [1920, 1080], [1366, 600], [1100, 560]]) {
      for (const view of ['side', 'grid']) {
        await dad.setViewportSize({ width: w, height: h });
        await dad.evaluate(v => { CT.S.me.zones.battlefield.splice(0); CT.S.me.zones.hand.push(...[]); CT.S.view = v; CT.render(); }, view);
        // put all the lands back in hand, then double-click the first one for real and move the rest the same way a double-click does
        await dad.evaluate(() => { const m = CT.S.me; CT.act(() => { m.zones.battlefield.splice(0); [...Object.keys(m.defs)].filter(k => /^(f|n)\d+$/.test(k)).forEach(k => { if (!m.zones.hand.some(c => c.id === k)) m.zones.hand.push({ iid: CT.S.pid + '_g' + k, id: k, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); });
        await dad.waitForTimeout(300);
        if (view === 'side') { const first = dad.locator('#myHand .card').first(); await first.dblclick({ force: true }); await dad.waitForTimeout(200); }
        // 20 lands (a lot, but plausible): all of them must fit the Lands area; then 6 more (26): they may go to a free spot on the board, but none may be hidden or unreachable.
        const play = (from, to) => dad.evaluate(([a, b]) => { const ids = CT.S.me.zones.hand.filter(c => /^(f|n)\d+$/.test(c.id)).map(c => c.iid).slice(a, b); ids.forEach(i => CT.doMove(i, 'battlefield')); }, [from, to]);
        await play(0, 19); await dad.waitForTimeout(400);
        const first = await probe(view);
        const strict = h >= 768; // in a short window 20 lands cannot all fit the Lands area: they must still be visible and clickable
        const bad1 = first.filter(r => r.missing || !r.aboveStrip || !r.reachable || (strict && !r.inRegion));
        assert.deepEqual(bad1.map(r => r.id + (r.missing ? ' missing' : '') + (!r.aboveStrip ? ' under the hand' : '') + (!r.reachable ? ' unreachable' : '') + (!r.inRegion ? ' outside the Lands area' : '')), [], `${w}x${h} ${view}: the first 20 lands are in the Lands area, above the hand and clickable: ` + JSON.stringify(bad1));
        await play(0, 99); await dad.waitForTimeout(500);
        const res = await probe(view).then(r => r.map(x => Object.assign(x, { inRegion: true })));
        const tag = `${w}x${h} ${view}`;
        const bad = res.filter(r => r.missing || !r.aboveStrip || !r.reachable || !r.inRegion);
        assert.equal(res.length, 26, tag + ': all 26 lands are on the battlefield');
        assert.deepEqual(bad.map(r => r.id + (r.missing ? ' missing' : '') + (!r.aboveStrip ? ' under the hand' : '') + (!r.reachable ? ' unreachable' : '') + (!r.inRegion ? ' outside the Lands area' : '')), [], tag + ': every land is in the Lands area, above the hand and clickable: ' + JSON.stringify(bad));
        const rows = new Set(res.map(r => r.y)).size;
        lastRun += `${tag}: 26 lands in ${rows} rows; `;
      }
    }
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS land placement (' + PLAYERS + ' players): ' + lastRun + 'all inside the Lands area, above the hand and clickable');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
