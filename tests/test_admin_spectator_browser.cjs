/* Real Chromium read-only spectator check with a simulated relay snapshot. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const snapshot = {
  table: { room: 'ABCDE', seats: ['p1', 'p2'], order: ['p1', 'p2'], active: 'p2', started: true,
    turn: 2, turnSeq: 2, phase: 3, hostPid: 'p1', out: {}, colors: { p1: 'gold', p2: 'blue' } },
  players: {
    p1: { pid: 'p1', name: 'Chris', bw: 1000, life: 40, hand: 7, lib: 92, kept: true, zones: {
      battlefield: [{ iid: 'p1_one', id: 'c1', x: 40, y: 40 }], graveyard: [], exile: [], command: [] },
      defs: { c1: { id: 'c1', name: 'Public Creature', type: 'Creature' } } },
    p2: { pid: 'p2', name: 'Friend', bw: 1000, life: 38, hand: 6, lib: 91, kept: true, zones: {
      battlefield: [{ iid: 'p2_one', id: 'c2', x: 60, y: 50 }], graveyard: [], exile: [], command: [] },
      defs: { c2: { id: 'c2', name: 'Another Creature', type: 'Creature' } } }
  },
  log: [{ ts: Date.now(), pid: 'p2', name: 'Friend', text: 'played a creature', cards: [] }],
  chat: [{ ts: Date.now(), pid: 'p1', name: 'Chris', text: 'hello from chat' }], online: { p1: true, p2: true }, arrows: []
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [], calls = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem('ct.admin.passphrase', 'private-test-passphrase'));
    await page.route('**/admin/rooms/ABCDE/spectate', async route => {
      calls.push(route.request().headers().authorization);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto('http://127.0.0.1:8099/index.html?adminSpectate=ABCDE');
    await page.locator('#game:not(.hidden) .card[data-iid="p1_one"]:visible').first().waitFor();
    assert.equal(await page.locator('#game .card[data-iid="p2_one"]').count() > 0, true);
    assert.equal(await page.getByText('Public Creature').count() > 0, true);
    assert.equal(await page.locator('#chatForm').isVisible(), false);
    assert.equal(await page.locator('#responseBtn').isVisible(), false);
    assert.equal(await page.locator('#spectatorBack').isVisible(), true);
    assert.equal(await page.evaluate(() => CT.S.table.seats.length), 2, 'spectator never takes a seat');
    assert.equal(await page.evaluate(() => CT.S.players.p2.zones.battlefield[0].x), 60, 'already normalized board positions are not scaled twice');
    await page.locator('#opps .opp[data-opp="p2"] .ohead').click();
    assert.equal(await page.evaluate(() => CT.S.focus), 'p2', 'spectator can view another player');
    const hostTile = page.locator('#opps .opp.youtile');
    assert.equal(await hostTile.locator('.boardwrap.tile').count(), 1, 'host uses a fitted public miniature');
    assert.equal(await hostTile.locator('.card[data-iid="p1_one"]').count(), 1, 'host card remains visible in miniature');
    assert.match(await hostTile.locator('.boardwrap.tile').getAttribute('style'), /background-image:/, 'host miniature keeps its playmat');
    assert.equal(await hostTile.locator('.tag.you').count(), 0, 'host is not labelled YOU for admin');
    // Re-render the same two-board snapshot as a regular player to cover the shared miniature path.
    await page.evaluate(() => { CT.S.role = 'host'; CT.render(); });
    await hostTile.locator('.boardwrap.thumb.tile').waitFor();
    assert.equal(await hostTile.locator('.boardwrap.thumb.tile').count(), 1, 'regular player gets a fitted own-board miniature');
    assert.match(await hostTile.locator('.boardwrap.thumb.tile').getAttribute('style'), /background-image:/, 'regular miniature keeps its playmat');
    assert.equal(await hostTile.locator('[data-arrow-iid="p1_one"]').count(), 1, 'regular miniature keeps a read-only arrow anchor');
    assert.equal(await hostTile.locator('.tag.you').count(), 1, 'regular player keeps the YOU label');
    await page.evaluate(() => { CT.S.role = 'spectator'; CT.render(); });
    await hostTile.locator('.boardwrap.tile:not(.thumb)').waitFor();
    await hostTile.locator('.ohead').click();
    assert.equal(await page.evaluate(() => CT.S.focus), null, 'host board can be selected again');
    await page.locator('#chatBtn').click();
    await page.getByText('hello from chat').waitFor();
    await page.locator('#sideBtn').click();
    await page.getByText('played a creature').waitFor();
    await page.locator('.viewsw [data-v="grid"]').click();
    assert.equal(await page.locator('#table').evaluate(el => el.classList.contains('view-grid')), true);
    assert.equal(await page.locator('#opps .opp.mytile .card[data-iid="p1_one"]').count(), 1, 'host board remains visible in Grid');
    assert.equal(await page.locator('#opps .opp.mytile .tag.you').count(), 0, 'Grid does not label host YOU');
    await page.keyboard.press('d');
    assert.equal(await page.evaluate(() => CT.S.me.zones.hand.length), 7, 'draw hotkey cannot change spectator state');
    assert.equal(await page.evaluate(() => CT.S.me.zones.hand.every(card => !card.id)), true, 'unrevealed hand cards remain hidden');
    await page.reload();
    await page.locator('#game:not(.hidden) .card[data-iid="p1_one"]:visible').first().waitFor();
    assert.equal(await page.locator('#lobby').isVisible(), false, 'spectator reload never asks for a player seat');
    assert.deepEqual(errors, []);
    assert.ok(calls.length && calls.every(value => value === 'Bearer private-test-passphrase'));
    const lobby = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    lobby.on('pageerror', error => errors.push(error.message));
    await lobby.goto('http://127.0.0.1:8099/index.html');
    assert.equal(await lobby.locator('#adminEntry').isVisible(), false);
    await lobby.locator('#cardBackPicker [data-appearance-id="tree-of-life"]').click();
    await lobby.locator('#cardBackPicker [data-appearance-id="obsidian-gem"]').click();
    assert.equal(await lobby.locator('#adminEntry').isVisible(), false, 'out-of-order card backs do not reveal the link');
    for (const id of ['tree-of-life', 'dragon-flame', 'obsidian-gem', 'gilded-knight']) {
      await lobby.locator(`#cardBackPicker [data-appearance-id="${id}"]`).click();
    }
    assert.equal(await lobby.locator('#adminEntry').isVisible(), true);
    assert.equal(await lobby.locator('#adminEntry').getAttribute('href'), 'admin.html');
    assert.deepEqual(errors, []);
    const unavailable = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await unavailable.addInitScript(() => sessionStorage.setItem('ct.admin.passphrase', 'private-test-passphrase'));
    let deployed = false;
    await unavailable.route('**/admin/rooms/ABCDE/spectate', route => route.fulfill({
      status: deployed ? 200 : 404, contentType: deployed ? 'application/json' : 'text/plain',
      body: deployed ? JSON.stringify(snapshot) : 'Not found',
      headers: { 'Access-Control-Allow-Origin': '*' }
    }));
    await unavailable.goto('http://127.0.0.1:8099/index.html?adminSpectate=ABCDE');
    await unavailable.getByText('Spectating is not available yet').waitFor();
    assert.equal(await unavailable.locator('#table').isVisible(), false, 'unsupported relay never shows an empty game board');
    assert.equal(await unavailable.getByText('Return to Admin rooms').isVisible(), true);
    deployed = true;
    await unavailable.locator('#game .card[data-iid="p1_one"]:visible').first().waitFor({ timeout: 7000 });
    assert.equal(await unavailable.locator('#spectatorStatus').isVisible(), false, 'spectator recovers automatically after relay update');
    await unavailable.close();
    console.log('PASS admin spectator browser: public boards and host miniature, chat/log, grid, no seat/action, no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
