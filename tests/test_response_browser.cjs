/* Real-browser integration check for the transient In response cue.
   Uses two local Chromium contexts, the local app, and the local Miniflare relay. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const APP = 'http://127.0.0.1:8104/index.html?relay=http%3A%2F%2F127.0.0.1%3A8114&net=relay';
const land = { id: 'response-island', name: 'Response Island', type: 'Basic Land — Island', ci: ['U'], tokens: [] };
const commander = { id: 'response-cmd', name: 'Response Commander', type: 'Legendary Creature', ci: ['U'], tokens: [] };
const deck = { id: 'response-deck', name: 'Response test deck', commanders: [commander], cards: [{ def: land, qty: 99 }], tokens: [], createdAt: '2026-10-21', source: '' };

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
    const host = await player('Response host');
    await host.locator('#hostBtn').click();
    await host.getByRole('button', { name: 'Continue', exact: true }).click();
    await host.locator('.ct-player-color-option[data-color="blue"]').click();
    await host.waitForFunction(() => CT.S.room && CT.S.net.state === 'online');
    const room = await host.evaluate(() => CT.S.room);
    const guest = await player('Response guest');
    await guest.locator('#joinIn').fill(room); await guest.locator('#joinBtn').click();
    await guest.locator('.ct-player-color-option[data-color="red"]').click();
    await host.waitForFunction(() => CT.S.table?.seats.length === 2 && Object.keys(CT.S.players).length === 2);
    await guest.waitForFunction(() => CT.S.table?.seats.length === 2 && Object.keys(CT.S.players).length === 2);
    await host.waitForFunction(() => document.querySelector('#topbar .ct-opening-rule'));
    await guest.waitForFunction(() => document.querySelector('#topbar .ct-opening-rule'));
    assert.equal(await host.locator('#topbar .ct-opening-rule').count(), 1, 'host sees the opening rule before keeping');
    assert.equal(await guest.locator('#topbar .ct-opening-rule').count(), 1, 'guest sees the opening rule before keeping');
    await host.locator('[data-a="keep"]').click(); await guest.locator('[data-a="keep"]').click();
    await host.locator('#topbar [data-a="start"]').click();
    await host.waitForFunction(() => CT.S.table?.started && CT.S.table.active);
    await guest.waitForFunction(() => CT.S.table?.started && CT.S.table.active);
    await host.waitForFunction(() => !document.querySelector('#topbar .ct-opening-rule'));
    await guest.waitForFunction(() => !document.querySelector('#topbar .ct-opening-rule'));
    assert.equal(await host.locator('#topbar .ct-opening-rule').count(), 0, 'host no longer sees the opening rule after the game starts');
    assert.equal(await guest.locator('#topbar .ct-opening-rule').count(), 0, 'guest no longer sees the opening rule after the game starts');
    // The host appends start/roll log entries after the shared table arrives.
    await host.waitForFunction(() => CT.S.log.length >= 5);
    await guest.waitForFunction(() => CT.S.log.length >= 5);
    await host.waitForFunction(() => CT.S.net.state === 'online');
    await guest.waitForFunction(() => CT.S.net.state === 'online');
    await host.waitForTimeout(300);
    await guest.waitForTimeout(300);

    const captureState = page => page.evaluate(() => {
      const me = { ...CT.S.me };
      // Layout fitting and turn-start bookkeeping can update independently of the cue.
      delete me.layout; delete me.layoutAuto; delete me.lastTurn; delete me.lastTurnSeq;
      delete me.roomSaveRevision; // the room-save relay can ack an earlier public snapshot asynchronously
      return { me: JSON.stringify(me), undo: JSON.stringify(CT.S.undo), log: JSON.stringify(CT.S.log), table: JSON.stringify(CT.S.table) };
    });
    const hostPid = await host.evaluate(() => CT.S.pid);
    const guestPid = await guest.evaluate(() => CT.S.pid);
    const assertNoMutation = async (page, expected) => {
      const now = await captureState(page);
      const beforeMe = JSON.parse(expected.me), afterMe = JSON.parse(now.me);
      const changedMe = [...new Set([...Object.keys(beforeMe), ...Object.keys(afterMe)])].filter(k => JSON.stringify(beforeMe[k]) !== JSON.stringify(afterMe[k]));
      assert.deepEqual(changedMe, [], `cue does not change player data (changed keys: ${changedMe.join(', ')})`);
      assert.equal(now.undo, expected.undo, 'cue does not add Undo entries');
      assert.equal(now.log, expected.log, 'cue does not write to the game log');
      assert.equal(now.table, expected.table, 'cue does not change shared table state');
    };
    const notice = page => page.locator('#responseNotice .ct-response-notice');
    const checkCue = async (page, pid, name, id, color) => {
      try { await page.waitForFunction(({ pid, name, id }) => {
        const el = document.querySelector('#responseNotice .ct-response-notice');
        return el?.dataset.responseId === id && el.textContent.includes('IN RESPONSE!') && el.textContent.includes(name);
      }, { pid, name, id }, { timeout: 5000 }); } catch (e) {
        const state = await page.evaluate(() => ({ html: document.querySelector('#responseNotice')?.innerHTML, pid: CT.S.pid, deal: CT.S.table?.openingDeal, role: CT.S.role, online: CT.S.net.state }));
        const sender = await guest.evaluate(() => ({ pid: CT.S.pid, started: CT.S.table?.started, seated: CT.S.table?.seats.includes(CT.S.pid), deal: CT.S.table?.openingDeal, out: CT.S.table?.out[CT.S.pid], online: CT.S.net.state, disabled: document.querySelector('#responseBtn')?.disabled, modal: !!document.querySelector('.w-backdrop'), arrowPick: !!CT.S.arrowPick, focus: document.activeElement?.tagName, key: window.__lastRKey }));
        throw new Error(`cue expected ${JSON.stringify({ pid, name, id })}; receiver=${JSON.stringify(state)} sender=${JSON.stringify(sender)}; ${e.message}`);
      }
      assert.equal(await notice(page).getAttribute('data-response-id'), id);
      assert.equal(await notice(page).evaluate(el => el.querySelector('.ct-response-name').textContent), name);
      assert.equal(await notice(page).evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      const renderedColors = await notice(page).evaluate(el => {
        const style = getComputedStyle(el);
        return { text: style.color, background: style.backgroundImage, token: el.style.getPropertyValue('--ct-response-color'), glow: el.style.getPropertyValue('--ct-response-glow') };
      });
      const rgb = color.match(/[\da-f]{2}/gi).map(part => parseInt(part, 16)).join(', ');
      assert.equal(renderedColors.text, `rgb(${rgb})`, `${name}'s cue uses their locked player color for text`);
      assert.ok(renderedColors.background.includes(`rgba(${rgb},`), `${name}'s cue background gradient uses their locked player color: ${renderedColors.background}`);
      assert.equal(renderedColors.token, color, `${name}'s cue color token matches their locked player color`);
      assert.equal(renderedColors.glow, `${color}3d`, `${name}'s cue glow token matches their locked player color`);
      const rect = await notice(page).evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight }; });
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.right <= rect.w && rect.bottom <= rect.h, `cue fits viewport: ${JSON.stringify(rect)}`);
    };
    const getId = page => page.evaluate(() => document.querySelector('#responseNotice .ct-response-notice')?.dataset.responseId || null);

    // Guest shortcut is authoritative, named by the host's seated-player record,
    // visible to both seats, and each separate press produces a fresh cue id.
    await guest.evaluate(() => { document.activeElement?.blur(); document.body.tabIndex = -1; document.body.focus(); });
    await guest.evaluate(() => document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') window.__lastRKey = { prevented: e.defaultPrevented, target: e.target.tagName, repeat: e.repeat }; }));
    let hostBefore = await captureState(host), guestBefore = await captureState(guest);
    await guest.keyboard.press('r');
    await guest.waitForFunction(() => !!document.querySelector('#responseNotice .ct-response-notice'));
    const firstId = await getId(guest);
    await checkCue(host, guestPid, 'Response guest', firstId, '#e5534b');
    await assertNoMutation(host, hostBefore); await assertNoMutation(guest, guestBefore);
    await guest.waitForTimeout(250);
    hostBefore = await captureState(host); guestBefore = await captureState(guest);
    await guest.keyboard.press('r');
    await guest.waitForFunction(id => document.querySelector('#responseNotice .ct-response-notice')?.dataset.responseId !== id, firstId);
    const secondId = await getId(guest);
    await checkCue(host, guestPid, 'Response guest', secondId, '#e5534b');
    assert.notEqual(secondId, firstId, 'separate presses are not deduped');
    await assertNoMutation(host, hostBefore); await assertNoMutation(guest, guestBefore);

    // The host's toolbar button also reaches the guest and host.
    hostBefore = await captureState(host); guestBefore = await captureState(guest);
    await host.locator('#responseBtn').click();
    await checkCue(guest, hostPid, 'Response host', await getId(host), '#4f8cff');
    await checkCue(host, hostPid, 'Response host', await getId(host), '#4f8cff');
    await assertNoMutation(host, hostBefore); await assertNoMutation(guest, guestBefore);

    // Current animation can be replayed while active; holding R sends once only.
    const beforeHold = await getId(host);
    hostBefore = await captureState(host); guestBefore = await captureState(guest);
    await guest.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true })));
    await guest.waitForFunction(id => document.querySelector('#responseNotice .ct-response-notice')?.dataset.responseId !== id, beforeHold);
    const afterFirstDown = await getId(guest);
    await guest.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', repeat: true, bubbles: true, cancelable: true })));
    assert.notEqual(afterFirstDown, beforeHold);
    assert.equal(await getId(guest), afterFirstDown, 'repeated keydown while held does not send again');
    await checkCue(host, guestPid, 'Response guest', afterFirstDown, '#e5534b');
    await assertNoMutation(host, hostBefore); await assertNoMutation(guest, guestBefore);

    // Switching layouts while active does not move the viewport-level cue under a board.
    for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
      await guest.setViewportSize(size);
      for (const mode of ['side', 'grid']) {
        await guest.locator(`[data-a="view"][data-v="${mode}"]`).click();
        const oldId = await getId(guest);
        hostBefore = await captureState(host); guestBefore = await captureState(guest);
        await host.keyboard.press('r');
        await guest.waitForFunction(id => document.querySelector('#responseNotice .ct-response-notice')?.dataset.responseId !== id, oldId);
        await guest.waitForTimeout(650); // animation has settled at its full viewport size
        assert.ok(await notice(guest).count(), `cue remains visible in ${mode} at ${size.width}x${size.height}`);
        const rect = await notice(guest).evaluate(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.right, r.bottom, innerWidth, innerHeight]; });
        assert.ok(rect[0] >= 0 && rect[1] >= 0 && rect[2] <= rect[4] && rect[3] <= rect[5], `cue stays in viewport (${mode} ${size.width}x${size.height}): ${JSON.stringify(rect)}`);
        const other = mode === 'side' ? 'grid' : 'side';
        await guest.locator(`[data-a="view"][data-v="${other}"]`).click();
        await guest.waitForTimeout(100);
        assert.ok(await notice(guest).count(), `cue survives switching board focus from ${mode} to ${other}`);
        await assertNoMutation(host, hostBefore); await assertNoMutation(guest, guestBefore);
      }
      const responseRect = await guest.locator('#responseBtn').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight }; });
      assert.ok(responseRect.x >= 0 && responseRect.y >= 0 && responseRect.right <= responseRect.w && responseRect.bottom <= responseRect.h,
        `response button stays in viewport: ${JSON.stringify(responseRect)}`);
      for (const selector of ['#topbar [data-a="undo"]', '#topbar [data-a="menu"]']) {
        const b = await guest.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight }; });
        assert.ok(b.x >= 0 && b.y >= 0 && b.right <= b.w && b.bottom <= b.h, `${selector} stays in viewport: ${JSON.stringify(b)}`);
      }
      await guest.locator('#topbar [data-a="menu"]').click();
      const menuRect = await guest.locator('.w-menu').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight }; });
      assert.ok(menuRect.x >= 0 && menuRect.y >= 0 && menuRect.right <= menuRect.w && menuRect.bottom <= menuRect.h,
        `menu opens within viewport: ${JSON.stringify(menuRect)}`);
      await guest.keyboard.press('Escape');
    }

    // Exercise the actual focused-opponent board in both layouts and viewport sizes.
    // Clicking the opponent tile here is important: changing the layout alone leaves
    // the viewer on their own board and does not cover #40's reported state.
    for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
      await guest.setViewportSize(size);
      for (const mode of ['side', 'grid']) {
        await guest.locator(`[data-a="view"][data-v="${mode}"]`).click();
        await guest.locator(`#opps .opp[data-opp="${hostPid}"]`).click();
        assert.deepEqual(await guest.evaluate(() => ({ focus: CT.S.focus, pid: CT.S.pid })),
          { focus: hostPid, pid: guestPid }, `guest is viewing host's actual focused board in ${mode} at ${size.width}x${size.height}`);

        const buttonRect = await guest.locator('#responseBtn').evaluate(el => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight, disabled: el.disabled };
        });
        assert.equal(buttonRect.disabled, false, 'response button remains enabled while viewing the opponent');
        assert.ok(buttonRect.x >= 0 && buttonRect.y >= 0 && buttonRect.right <= buttonRect.w && buttonRect.bottom <= buttonRect.h,
          `response button is reachable while viewing the opponent: ${JSON.stringify(buttonRect)}`);

        for (const method of ['button', 'r key']) {
          const oldId = await getId(guest);
          hostBefore = await captureState(host); guestBefore = await captureState(guest);
          if (method === 'button') await guest.locator('#responseBtn').click();
          else {
            await guest.evaluate(() => { document.activeElement?.blur(); document.body.tabIndex = -1; document.body.focus(); });
            await guest.keyboard.press('r');
          }
          await guest.waitForFunction(id => document.querySelector('#responseNotice .ct-response-notice')?.dataset.responseId !== id, oldId);
          const id = await getId(guest);
          assert.notEqual(id, oldId, `${method} creates a fresh cue while focused on the opponent`);
          await checkCue(guest, guestPid, 'Response guest', id, '#e5534b');
          await checkCue(host, guestPid, 'Response guest', id, '#e5534b');
          await assertNoMutation(host, hostBefore); await assertNoMutation(guest, guestBefore);
          await guest.waitForTimeout(250);
          assert.equal(await guest.evaluate(() => CT.S.focus), hostPid, `cue leaves focused board intact (${mode}, ${method})`);
        }

        // Return with the layout's rendered control, then confirm focus is local again.
        if (mode === 'grid') await guest.locator('#opps [data-a="viewme"]').click();
        else await guest.locator('#opps .opp.youtile').click();
        await guest.waitForFunction(() => CT.S.focus == null);
      }
    }
    await guest.waitForFunction(() => !document.querySelector('#responseNotice').firstElementChild, { timeout: 5000 });

    // Editable focus, chat and dialogs suppress R; Ctrl+R remains available to the browser.
    await guest.locator('#chatBtn').click();
    const chatInput = guest.locator('#chatInput');
    if (await chatInput.count()) {
      await chatInput.focus();
      await chatInput.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true })));
      assert.equal(await notice(guest).count(), 0, 'R in chat input is ignored');
    }
    await guest.locator('#chatClose').click();
    await guest.locator('[data-a="menu"]').click();
    await guest.getByRole('menuitem', { name: /Hotkey list/ }).click();
    const modalCueBefore = await getId(guest);
    await guest.keyboard.press('r');
    assert.equal(await getId(guest), modalCueBefore, 'R while a modal is open is ignored');
    await guest.keyboard.press('Escape');
    const ctrlR = await guest.evaluate(() => {
      const e = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(e); return e.defaultPrevented;
    });
    assert.equal(ctrlR, false, 'Ctrl+R is not captured or prevented');

    // Reduced motion still renders the static cue and uses the normal dismissal timer.
    await guest.emulateMedia({ reducedMotion: 'reduce' });
    hostBefore = await captureState(host); guestBefore = await captureState(guest);
    await host.keyboard.press('r');
    await checkCue(guest, hostPid, 'Response host', await getId(host), '#4f8cff');
    assert.equal(await notice(guest).evaluate(el => getComputedStyle(el).animationName), 'none', 'reduced motion disables the cue animation');
    assert.equal(await notice(guest).evaluate(el => getComputedStyle(el).opacity), '1', 'reduced motion keeps the cue static and visible');
    await guest.waitForFunction(() => !document.querySelector('#responseNotice').firstElementChild, { timeout: 5000 });
    await assertNoMutation(host, hostBefore); await assertNoMutation(guest, guestBefore);

    // Deliberate local transport shutdown confirms the disconnected UI disables the cue.
    await host.evaluate(() => Net.stop());
    await guest.waitForFunction(() => CT.S.net.state !== 'online' && document.querySelector('#responseBtn')?.disabled);
    assert.equal(await guest.locator('#responseBtn').isDisabled(), true);
    const priorHost = await getId(host);
    await guest.keyboard.press('r');
    assert.equal(await getId(host), priorHost, 'offline cue is dropped rather than queued to the host');

    assert.deepEqual(errors, [], errors.join('\n'));
    console.log('PASS local Chromium + Miniflare relay: two players; host and guest cues/name; repeat presses get unique event ids while held-key repeat is ignored; Sidebar/Grid at 1920x1080 and 1366x768; cue is centered in viewport, click-through and auto-dismisses; reduced motion; no app/table/Undo/log mutation; Ctrl+R not prevented; offline guest control disabled; no page errors.');
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
