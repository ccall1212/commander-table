/* Real-browser integration check for personal Undo/history.
   Uses the local app + local Miniflare relay only. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const APP = 'http://127.0.0.1:8105/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const land = { id: 'undo-island', name: 'Undo Island', type: 'Basic Land — Island', ci: ['U'], tokens: [] };
const commander = { id: 'undo-cmd', name: 'Undo Commander', type: 'Legendary Creature', ci: ['U'], tokens: [] };
const deck = { id: 'undo-deck', name: 'Undo test deck', commanders: [commander], cards: [{ def: land, qty: 99 }], tokens: [], createdAt: '2026-10-21', source: '' };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const contexts = [];
  try {
    async function player(name, viewport = { width: 1920, height: 1080 }) {
      const context = await browser.newContext({ viewport }); contexts.push(context);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
      await page.addInitScript(({ deck, name }) => {
        localStorage.setItem('ct.decks.v1', JSON.stringify([deck]));
        localStorage.setItem('ct.name', JSON.stringify(name));
      }, { deck, name });
      await page.goto(APP);
      return page;
    }
    const host = await player('Undo host');
    await host.locator('#hostBtn').click();
    await host.getByRole('button', { name: 'Continue', exact: true }).click();
    await host.locator('.ct-player-color-option[data-color="blue"]').click();
    await host.waitForFunction(() => CT.S.room && CT.S.net.state === 'online');
    const room = await host.evaluate(() => CT.S.room);
    const guest = await player('Undo guest');
    await guest.locator('#joinIn').fill(room); await guest.locator('#joinBtn').click();
    await guest.locator('.ct-player-color-option[data-color="red"]').click();
    await host.waitForFunction(() => CT.S.table?.seats.length === 2 && Object.keys(CT.S.players).length === 2);
    await guest.waitForFunction(() => CT.S.table?.seats.length === 2 && Object.keys(CT.S.players).length === 2);
    await host.locator('[data-a="keep"]').click(); await guest.locator('[data-a="keep"]').click();
    await host.locator('#topbar [data-a="start"]').click();
    await host.waitForFunction(() => CT.S.table?.started && CT.S.table.active);
    await guest.waitForFunction(() => CT.S.table?.started && CT.S.table.active);

    const activePid = await host.evaluate(() => CT.S.table.active);
    const active = activePid === await host.evaluate(() => CT.S.pid) ? host : guest;
    const passive = active === host ? guest : host;
    const passivePid = await passive.evaluate(() => CT.S.pid);
    const baseline = await active.evaluate(() => CT.S.me.life);

    // Actual toolbar Undo and dropdown restore: create two local actions, undo newest,
    // then restore the earlier action from its labeled history row.
    await active.evaluate(() => { CT.act(() => { CT.S.me.life -= 3; }); CT.act(() => { CT.S.me.poison += 1; }); });
    assert.equal(await active.evaluate(() => CT.S.undo.filter(e => e.kind === 'action').length), 2);
    await active.locator('#topbar [data-a="undo"]').click();
    await active.waitForFunction(() => CT.S.me.poison === 0 && CT.S.me.life === CT.S.players[CT.S.pid].life);
    assert.equal(await active.evaluate(() => CT.S.me.life), baseline - 3);
    await active.locator('#topbar [data-a="undohistory"]').click();
    await active.getByRole('menuitem', { name: /Before: Life .* → .*/ }).click();
    await active.getByRole('button', { name: 'Restore my board' }).waitFor();
    // Room backup metadata can advance while this confirmation is open; it must not
    // make an otherwise unchanged personal board look stale.
    await active.waitForTimeout(1800);
    await active.getByRole('button', { name: 'Restore my board' }).click();
    await active.waitForFunction(life => CT.S.me.life === life, baseline);
    assert.equal(await active.evaluate(() => CT.S.table.phase), 3);
    await passive.waitForFunction(({ pid, life }) => CT.S.players[pid]?.life === life,
      { pid: await active.evaluate(() => CT.S.pid), life: baseline });
    assert.equal(await passive.evaluate(pid => CT.S.players[pid].life, await active.evaluate(() => CT.S.pid)), baseline,
      'remote view of the active player converges after personal restore');

    // Save an explicit Combat checkpoint from the history submenu, mutate the local
    // board, then move shared phase to Main 2. Restore must leave shared state intact.
    const activePidAgain = await active.evaluate(() => CT.S.pid);
    await host.evaluate(({ activePid }) => CT.hostRecv({ t: 'op', op: { k: 'phase', v: 4 } }, activePid), { activePid: activePidAgain });
    await active.waitForFunction(() => CT.S.table.phase === 4);
    await active.locator('#topbar [data-a="undohistory"]').click();
    await active.getByRole('menuitem', { name: 'Save phase checkpoint' }).click();
    await active.getByRole('menuitem', { name: 'Combat', exact: true }).click();
    await active.waitForFunction(() => CT.S.undo.some(e => e.kind === 'checkpoint' && e.label === 'Combat checkpoint'));
    const checkpointLife = await active.evaluate(() => CT.S.me.life);
    await active.evaluate(() => CT.act(() => { CT.S.me.life -= 7; }));
    const otherPid = await passive.evaluate(() => CT.S.pid);
    const otherBoardBefore = await active.evaluate(pid => JSON.stringify(CT.S.players[pid]), otherPid);
    await host.evaluate(({ activePid }) => CT.hostRecv({ t: 'op', op: { k: 'phase', v: 5 } }, activePid), { activePid: activePidAgain });
    await active.waitForFunction(() => CT.S.table.phase === 5);
    await active.locator('#topbar [data-a="undohistory"]').click();
    await active.getByRole('menuitem', { name: /Combat checkpoint/ }).click();
    await active.getByRole('button', { name: 'Restore my board' }).click();
    await active.waitForFunction(life => CT.S.me.life === life, checkpointLife);
    assert.equal(await active.evaluate(() => CT.S.table.phase), 5, 'checkpoint does not rewind shared phase');
    assert.equal(await active.evaluate(pid => JSON.stringify(CT.S.players[pid]), otherPid), otherBoardBefore,
      'personal restore does not change the other player\'s public board');

    // Add a real local battlefield card and transfer it through the UI menu. Both source
    // and recipient histories must clear when the remote card movement is applied.
    await passive.evaluate(() => CT.act(() => { CT.S.me.life -= 1; }));
    const iid = await active.evaluate(() => {
      let id;
      CT.act(() => {
        const m = CT.S.me; id = `${m.pid}_${++m.seq}`;
        m.defs['undo-board-card'] = { id: 'undo-board-card', name: 'Undo boundary card', type: 'Creature' };
        m.zones.battlefield.push({ iid: id, id: 'undo-board-card', own: m.pid, t: false, fl: false, fd: false, c: {}, x: 160, y: 100 });
      });
      return id;
    });
    await active.evaluate(() => CT.act(() => { CT.S.me.life -= 1; }));
    await active.locator(`.card[data-iid="${iid}"]`).click({ button: 'right' });
    await active.getByRole('menuitem', { name: 'Give control to' }).click();
    await active.getByRole('menuitem', { name: await passive.evaluate(() => CT.S.me.name) }).click();
    await passive.waitForFunction(iid => CT.S.me.zones.battlefield.some(c => c.iid === iid), iid);
    assert.equal(await active.evaluate(() => CT.S.undo.length), 0, 'outgoing transfer clears source history');
    assert.equal(await passive.evaluate(() => CT.S.undo.length), 0, 'incoming transfer clears recipient history');

    // A life adjustment sent from the other seat is also an incoming boundary.
    await passive.evaluate(() => CT.act(() => { CT.S.me.life -= 2; }));
    await active.locator(`[data-a="olife"][data-pid="${passivePid}"][data-d="-1"]`).click();
    await passive.waitForFunction(() => CT.S.undo.length === 0);

    // Fill enough history to exercise clipping/scrolling and opening near the viewport
    // edge at both supported sizes and both layouts.
    for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
      await active.setViewportSize(size);
      for (const mode of ['side', 'grid']) {
        await active.locator(`[data-a="view"][data-v="${mode}"]`).click();
        await active.waitForTimeout(350); // allow responsive board geometry to settle
        await active.evaluate(() => { for (let i = 0; i < 45; i++) CT.act(() => { CT.S.me.ctr.undoBrowser = (CT.S.me.ctr.undoBrowser || 0) + 1; }); });
        assert.equal(await active.evaluate(() => CT.S.undo.length), 40);
        await active.locator('#topbar [data-a="undohistory"]').click();
        const dimensions = await active.locator('.w-menu').evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, vh: innerHeight }));
        assert.ok(dimensions.bottom <= dimensions.vh && dimensions.top >= 0, `history menu stays in viewport at ${size.width}x${size.height} ${mode}: ${JSON.stringify(dimensions)}`);
        assert.ok(dimensions.client <= dimensions.vh, 'menu is viewport bounded');
        assert.ok(dimensions.scroll > dimensions.client, `long history scrolls at ${size.width}x${size.height} ${mode}`);
        await active.keyboard.press('Escape');
      }
    }
    assert.deepEqual(errors, [], errors.join('\n'));
    console.log('PASS local Chromium + Miniflare relay: two real player contexts; toolbar Undo/history restore; checkpoint preserves shared phase and other board; UI card-control transfer and incoming life request clear history; history menu scrolls within viewport in Sidebar/Grid at 1920x1080 and 1366x768; no page errors.');
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
