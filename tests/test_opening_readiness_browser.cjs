/*
 * Real-browser check for Objective #37. Start the repository over HTTP first:
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
    await page.goto('http://127.0.0.1:8106/index.html?relay=http%3A%2F%2F127.0.0.1%3A8111&net=relay');
    return { ctx, page };
  }

  async function keepDrawTen(page) {
    await page.locator('[data-a="keep"]').click();
    const cards = page.locator('.w-viewer-dialog .w-vcard');
    await cards.first().waitFor();
    assert.equal(await cards.count(), 10, 'Draw 10 presents ten cards for the bottom-three choice');
    for (let i = 0; i < 3; i++) await cards.nth(i).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.waitForFunction(() => CT.S.me.kept);
  }

  try {
    host = await player('Ready host', 1920, 1080);
    await host.page.locator('#hostMulligan').selectOption('ten-bottom-three');
    await host.page.locator('#hostBtn').click();
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
        assert.match(await host.page.locator('#turnBox').innerText(), /Ready host, Ready guest to keep/);
        assert.equal(await host.page.locator('[data-a="start"]').isDisabled(), true);
      }
    }

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
    await host.page.waitForFunction(() => document.querySelector('#turnBox')?.innerText.includes('Ready guest to keep'));
    assert.equal(await host.page.locator('[data-a="start"]').isDisabled(), true, 'host keep leaves guest pending');

    await guest.page.reload();
    await guest.page.waitForFunction(() => CT.S.me && CT.S.table?.seats.length === 2, { timeout: 30000 });
    await guest.page.waitForFunction(() => CT.S.net.state === 'online', { timeout: 30000 });
    assert.equal(await guest.page.evaluate(() => CT.S.me.kept), false, 'reload keeps the current unkept deal pending');
    assert.match(await host.page.locator('#turnBox').innerText(), /Ready guest to keep/);

    await keepDrawTen(guest.page);
    await host.page.waitForFunction(() => document.querySelector('#turnBox')?.innerText.includes('Everyone has kept'));
    assert.equal(await host.page.locator('[data-a="start"]').isDisabled(), false);

    await host.page.locator('[data-a="start"]').click();
    await host.page.waitForFunction(() => CT.S.table.started, { timeout: 20000 });
    await guest.page.waitForFunction(() => CT.S.table.started, { timeout: 20000 });
    for (const session of [host, guest]) {
      assert.equal(await session.page.locator('.ct-opening-rule').count(), 0, 'opening-hand rule is hidden after Start for both players');
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
    for (const session of [host, guest]) await session.page.locator('.ct-opening-rule').waitFor();
    await host.page.waitForFunction(() => document.querySelector('[data-a="start"]')?.disabled);
    assert.match(await host.page.locator('#turnBox').innerText(), /Ready host, Ready guest to keep/);
    assert.deepEqual(errors, [], errors.join('\n'));
    console.log('PASS opening readiness browser flow: layouts/sizes, pregame rule visible to both players, post-Start rule hidden for both, Draw 10 bottoming, pre-start B/menu, reload, post-start B, New Game restores rule; no page errors.');
  } finally {
    for (const session of [guest, host]) {
      if (!session) continue;
      try { await session.page.evaluate(() => Net.stop()); } catch {}
      await session.ctx.close();
    }
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
