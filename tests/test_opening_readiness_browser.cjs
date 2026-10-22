/*
 * Real-browser check for Objective #41. Start the repository over HTTP first:
 *   python3 -m http.server 8106 --bind 127.0.0.1
 * Then run with Playwright and Chromium available:
 *   node tests/test_opening_readiness_browser.cjs
 * Uses the configured relay, creates a temporary two-player room, then stops
 * both peers and closes both browser contexts.
 */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const deck = {
  id: 'opening-ready-browser-test', name: 'Opening readiness browser test', commanders: [],
  cards: [
    { def: { id: 'or-browser-land', name: 'Island', type: 'Basic Land — Island', ci: ['U'], tokens: [] }, qty: 40 },
    { def: { id: 'or-browser-spell', name: 'Test instant', type: 'Instant', ci: ['U'], tokens: [] }, qty: 60 }
  ], tokens: [], createdAt: '2026-10-21', source: ''
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  let host, guest;

  async function player(name, width, height) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.addInitScript(({ savedDeck, playerName }) => {
      localStorage.setItem('ct.decks.v1', JSON.stringify([savedDeck]));
      localStorage.setItem('ct.name', JSON.stringify(playerName));
    }, { savedDeck: deck, playerName: name });
    await page.goto(process.env.CT_TEST_URL || 'http://127.0.0.1:8106/index.html?relay=http%3A%2F%2F127.0.0.1%3A8111&net=relay');
    return { ctx, page };
  }

  async function keepDrawTen(page) {
    await page.locator('[data-a="keep"]').click();
    const cards = page.locator('.w-viewer-dialog .w-vcard');
    await cards.first().waitFor();
    assert.equal(await cards.count(), 10, 'Draw 10 presents ten cards for the bottom-three choice');
    assert.equal(await page.evaluate(() => CT.S.me.kept), false, 'choosing bottom cards does not mark the deal ready early');
    assert.match(await page.locator('#turnBox [data-a="openingstatus"]').innerText(), /Hands ready:/);
    for (let i = 0; i < 3; i++) await cards.nth(i).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.waitForFunction(() => CT.S.me.kept);
  }

  async function rosterStatus(page, playerName) {
    const row = page.locator('.ct-opening-roster-dialog .ct-opening-roster-list li').filter({ hasText: playerName });
    await row.waitFor();
    return row.locator('.ct-opening-status').innerText();
  }

  async function openRoster(page) {
    await page.locator('#turnBox [data-a="openingstatus"]').click();
    await page.locator('.ct-opening-roster-dialog').waitFor();
  }

  async function assertTopbarClear(page, label) {
    const collisions = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('#turnBox .ct-opening-rule, #turnBox [data-a="openingstatus"], #turnBox [data-a="start"]')]
        .filter(el => el.getClientRects().length);
      const blockers = [...document.querySelectorAll('#turnActions, #topbar .tb-right')]
        .filter(el => el.getClientRects().length);
      const box = el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const hits = [];
      for (const control of controls) for (const blocker of blockers) {
        const a = box(control), b = box(blocker);
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
          hits.push({ control: `${control.tagName.toLowerCase()}${control.dataset.a ? `[data-a="${control.dataset.a}"]` : '.ct-opening-rule'}`,
            blocker: blocker.id ? `#${blocker.id}` : '.tb-right', controlRect: a, blockerRect: b });
        }
      }
      return hits;
    });
    assert.deepEqual(collisions, [], `${label}: opening controls must not overlap turn actions or topbar right controls: ${JSON.stringify(collisions)}`);
  }

  try {
    host = await player('Ready host', 1920, 1080);
    await host.page.locator('#hostBtn').click();
    await host.page.locator('input[name="host-opening-mode"][value="ten-bottom-three"]').check();
    await host.page.getByRole('button', { name: 'Continue', exact: true }).click();
    await host.page.locator('.ct-player-color-option[data-color="blue"]').click();
    await host.page.waitForFunction(() => CT.S.room, { timeout: 30000 });
    const room = await host.page.evaluate(() => CT.S.room);

    guest = await player('Ready guest', 1366, 768);
    await guest.page.locator('#joinIn').fill(room);
    await guest.page.locator('#joinBtn').click();
    await guest.page.locator('.ct-player-color-option[data-color="red"]').click();
    await host.page.waitForFunction(() => Object.keys(CT.S.players).length === 2, { timeout: 30000 });
    await guest.page.waitForFunction(() => CT.S.table?.seats.length === 2, { timeout: 30000 });
    for (const session of [host, guest]) {
      await session.page.locator('.ct-opening-rule').waitFor();
      assert.match(await session.page.locator('.ct-opening-rule').innerText(), /10 → 7/);
    }

    for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
      await host.page.setViewportSize(size);
      for (const mode of ['side', 'grid']) {
        await host.page.locator(`.viewsw [data-v="${mode}"]`).click();
        await assertTopbarClear(host.page, `${size.width}x${size.height} ${mode}`);
        assert.equal(await host.page.locator('#turnBox [data-a="openingstatus"]').innerText(), 'Hands ready: 0/2');
        assert.equal(await host.page.locator('[data-a="start"]').isDisabled(), true);
        const compactText = await host.page.locator('#turnBox').innerText();
        assert.doesNotMatch(compactText, /Ready host|Ready guest|to keep|Everyone has kept/i, 'inline readiness sentences and names are removed');
        await openRoster(host.page);
        const rect = await host.page.locator('.ct-opening-roster-dialog').evaluate(el => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        });
        assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= size.width && rect.bottom <= size.height,
          `roster dialog fits ${size.width}x${size.height} in ${mode} layout: ${JSON.stringify(rect)}`);
        if ((size.width === 1920 && mode === 'side') || (size.width === 1366 && mode === 'grid')) {
          await host.page.screenshot({ path: `/tmp/opening-roster-${size.width}-${mode}.png`, animations: 'disabled' });
        }
        await host.page.keyboard.press('Escape');
        await host.page.locator('.ct-opening-roster-dialog').waitFor({ state: 'detached' });
      }
    }

    // The readiness control is keyboard accessible and Escape returns focus to it.
    const readiness = host.page.locator('#turnBox [data-a="openingstatus"]');
    await readiness.focus();
    await host.page.keyboard.press('Enter');
    const hostDialog = host.page.locator('.ct-opening-roster-dialog');
    await hostDialog.waitFor();
    assert.equal(await rosterStatus(host.page, 'Ready host'), 'Choosing');
    assert.equal(await rosterStatus(host.page, 'Ready guest'), 'Choosing');
    assert.equal(await hostDialog.locator('.ct-opening-roster-list li').count(), 2);
    await host.page.keyboard.press('Escape');
    await hostDialog.waitFor({ state: 'detached' });
    assert.equal(await readiness.evaluate(el => el === document.activeElement), true, 'Escape restores focus to the readiness button');

    const before = await guest.page.evaluate(() => CT.S.me.zones.battlefield.length);
    const handCard = guest.page.locator('[data-zone="hand"][data-iid]').first();
    await handCard.waitFor();
    await handCard.hover();
    await guest.page.keyboard.press('b');
    await guest.page.waitForTimeout(250);
    assert.equal(await guest.page.evaluate(() => CT.S.me.zones.battlefield.length), before, 'B cannot play a card before Start');
    assert.match(await guest.page.locator('body').innerText(), /battlefield opens when the host starts/i);
    await handCard.click({ button: 'right' });
    await guest.page.getByText('Play', { exact: true }).click();
    assert.equal(await guest.page.evaluate(() => CT.S.me.zones.battlefield.length), before, 'hand menu cannot play a card before Start');

    await keepDrawTen(host.page);
    await host.page.waitForFunction(() => document.querySelector('#turnBox [data-a="openingstatus"]')?.innerText === 'Hands ready: 1/2');
    assert.equal(await host.page.locator('[data-a="start"]').isDisabled(), true, 'host keep leaves guest pending');

    await guest.page.reload();
    await guest.page.waitForFunction(() => CT.S.me && CT.S.table?.seats.length === 2, { timeout: 30000 });
    await guest.page.waitForFunction(() => CT.S.net.state === 'online', { timeout: 30000 });
    assert.equal(await guest.page.evaluate(() => CT.S.me.kept), false, 'reload keeps the current unkept deal pending');
    assert.equal(await host.page.locator('#turnBox [data-a="openingstatus"]').innerText(), 'Hands ready: 1/2');

    // Keep the host roster open while the guest chooses cards. Its row updates live.
    await openRoster(host.page);
    const hostDialogLive = host.page.locator('.ct-opening-roster-dialog');
    assert.equal(await rosterStatus(host.page, 'Ready guest'), 'Choosing');
    await keepDrawTen(guest.page);
    await host.page.waitForFunction(() => document.querySelector('#turnBox [data-a="openingstatus"]')?.innerText === 'Hands ready: 2/2');
    await host.page.waitForFunction(async () => {
      const row = [...document.querySelectorAll('.ct-opening-roster-list li')].find(el => el.textContent.includes('Ready guest'));
      return row?.querySelector('.ct-opening-status')?.textContent.trim() === 'Ready';
    });
    assert.equal(await hostDialogLive.isVisible(), true, 'the open roster stays open until Start');
    assert.equal(await host.page.locator('[data-a="start"]').isDisabled(), false);

    await host.page.keyboard.press('Escape');
    await hostDialogLive.waitFor({ state: 'detached' });
    await host.page.setViewportSize({ width: 1366, height: 768 });
    await host.page.locator('.viewsw [data-v="grid"]').click();
    await assertTopbarClear(host.page, '1366x768 Grid at Start');
    await openRoster(guest.page);
    const guestDialog = guest.page.locator('.ct-opening-roster-dialog');
    assert.equal(await guestDialog.isVisible(), true);
    await host.page.locator('[data-a="start"]').click();
    await host.page.waitForFunction(() => CT.S.table.started, { timeout: 20000 });
    await guest.page.waitForFunction(() => CT.S.table.started, { timeout: 20000 });
    for (const session of [host, guest]) {
      assert.equal(await session.page.locator('.ct-opening-rule').count(), 0, 'opening-hand rule is hidden after Start for both players');
      assert.equal(await session.page.locator('#turnBox [data-a="openingstatus"]').count(), 0, 'compact readiness control is hidden after Start');
      assert.equal(await session.page.locator('.ct-opening-roster-dialog').count(), 0, 'readiness roster closes after Start');
    }
    const playable = guest.page.locator('[data-zone="hand"][data-iid]').first();
    await playable.hover();
    await guest.page.keyboard.press('b');
    await guest.page.waitForFunction(() => CT.S.me.zones.battlefield.length > 0);

    await host.page.locator('#topbar [data-a="menu"]').click();
    await host.page.getByText('Start a new game (everyone)', { exact: true }).click();
    await host.page.getByRole('button', { name: 'New game', exact: true }).click();
    await host.page.waitForFunction(() => !CT.S.table.started && CT.S.me.openingDeal === CT.S.table.openingDeal, { timeout: 15000 });
    await guest.page.waitForFunction(() => !CT.S.table.started && CT.S.me.openingDeal === CT.S.table.openingDeal, { timeout: 15000 });
    for (const session of [host, guest]) {
      await session.page.locator('.ct-opening-rule').waitFor();
      assert.equal(await session.page.locator('#turnBox [data-a="openingstatus"]').innerText(), 'Hands ready: 0/2');
    }
    await host.page.waitForFunction(() => document.querySelector('[data-a="start"]')?.disabled);
    await openRoster(host.page);
    assert.equal(await rosterStatus(host.page, 'Ready host'), 'Choosing');
    assert.equal(await rosterStatus(host.page, 'Ready guest'), 'Choosing');
    assert.deepEqual(errors, [], errors.join('\n'));
    console.log('PASS opening readiness browser flow: compact control and live roster statuses, keyboard open/Escape/focus, layouts/sizes, non-overlapping topbar controls and clickable Start in 1366x768 Grid, Draw 10 bottoming, pre-start B/menu, reload, automatic roster close on Start, post-start control/rule hidden, New Game resets to 0/2; no page errors.');
  } finally {
    for (const session of [guest, host]) {
      if (!session) continue;
      try { await session.page.evaluate(() => Net.stop()); } catch {}
      await session.ctx.close();
    }
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
