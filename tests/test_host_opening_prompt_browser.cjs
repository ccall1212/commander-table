/* Real-browser check for Objective #39. Start the local page and relay first:
 *   python3 -m http.server 8107 --bind 127.0.0.1
 *   NODE_PATH=/tmp/ct-vault-runtime/node_modules node /tmp/ct-host-opening-relay.cjs
 * Then run:
 *   node tests/test_host_opening_prompt_browser.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const deck = {
  id: 'host-opening-browser-test', name: 'Host opening browser test', commanders: [],
  cards: [
    { def: { id: 'host-opening-land', name: 'Island', type: 'Basic Land — Island', ci: ['U'], tokens: [] }, qty: 40 },
    { def: { id: 'host-opening-spell', name: 'Test instant', type: 'Instant', ci: ['U'], tokens: [] }, qty: 60 }
  ], tokens: [], createdAt: '2026-10-22', source: ''
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const contexts = [];

  async function player(name, savedPrefs = {}, savedDeck = deck) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    contexts.push(ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    await page.addInitScript(({ savedDeck, playerName, savedPrefs }) => {
      localStorage.setItem('ct.decks.v1', JSON.stringify([savedDeck]));
      localStorage.setItem('ct.name', JSON.stringify(playerName));
      Object.entries(savedPrefs).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    }, { savedDeck, playerName: name, savedPrefs });
    await page.goto(process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay');
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    return page;
  }

  async function assertDialogFits(dialog, width, height) {
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height,
      `prompt fits the ${width}×${height} viewport`);
  }

  try {
    const host = await player('Prompt host', { 'ct.openingMode': 'london' });
    assert.equal(await host.locator('#hostMulligan').count(), 0, 'mulligan selector is removed from the lobby');
    await host.locator('#hostBtn').focus();
    await host.locator('#hostBtn').click();
    const dialog = host.locator('.ct-host-opening-dialog');
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /You can change this after joining the game\./);
    assert.equal(await dialog.locator('input[name="host-opening-mode"]').count(), 3, 'all three opening rules are available');
    assert.equal(await host.evaluate(() => CT.S.room), null, 'room is not created before the rule is confirmed');
    assert.equal(await host.evaluate(() => CT.S.role), null, 'no host session starts before confirmation');
    assert.equal(await host.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('ct.sess.')).length), 0, 'no session is saved before confirmation');
    assert.equal(await host.evaluate(() => JSON.parse(localStorage.getItem('ct.openingMode'))), 'london');
    await assertDialogFits(dialog, 1366, 768);
    await host.locator('input[name="host-opening-mode"][value="three-lands"]').check();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await host.evaluate(() => document.activeElement.id), 'hostBtn', 'Cancel restores focus to Host a game');
    assert.equal(await host.evaluate(() => CT.S.room), null, 'Cancel leaves the user in the lobby');
    assert.equal(await host.evaluate(() => JSON.parse(localStorage.getItem('ct.openingMode'))), 'london', 'Cancel does not change the saved choice');

    await host.setViewportSize({ width: 1920, height: 1080 });
    await host.locator('#hostBtn').evaluate(button => { button.click(); button.click(); });
    await dialog.waitFor();
    assert.equal(await host.locator('.ct-host-opening-dialog').count(), 1, 'repeated Host clicks open only one prompt');
    assert.equal(await host.locator('input[name="host-opening-mode"][value="london"]').isChecked(), true, 'saved preference is selected when the prompt reopens');
    await assertDialogFits(dialog, 1920, 1080);
    await host.screenshot({ path: '/tmp/ct-host-opening-prompt.png' });
    await host.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await host.evaluate(() => document.activeElement.id), 'hostBtn', 'Escape restores focus to Host a game');
    assert.equal(await host.evaluate(() => CT.S.room), null, 'Escape leaves the user in the lobby');
    assert.equal(await host.evaluate(() => JSON.parse(localStorage.getItem('ct.openingMode'))), 'london', 'cancel does not change the saved choice');

    await host.setViewportSize({ width: 1366, height: 768 });
    const modes = [
      { mode: 'london', hand: 7, color: 'blue', landsOnly: false },
      { mode: 'three-lands', hand: 7, color: 'red', landsOnly: true },
      { mode: 'ten-bottom-three', hand: 10, color: 'green', landsOnly: false }
    ];
    for (const [index, option] of modes.entries()) {
      const savedDeck = option.landsOnly ? { ...deck, id: 'host-opening-three-lands', cards: [
        { def: { id: 'host-opening-only-land', name: 'Island', type: 'Basic Land — Island', ci: ['U'], tokens: [] }, qty: 3 },
        { def: { id: 'host-opening-spell', name: 'Test instant', type: 'Instant', ci: ['U'], tokens: [] }, qty: 97 }
      ] } : deck;
      const session = await player(`Mode host ${index + 1}`, { 'ct.openingMode': 'london' }, savedDeck);
      await session.locator('#hostBtn').click();
      await session.locator(`input[name="host-opening-mode"][value="${option.mode}"]`).check();
      await session.getByRole('button', { name: 'Continue', exact: true }).click();
      await session.locator(`.ct-player-color-option[data-color="${option.color}"]`).waitFor();
      assert.equal(await session.evaluate(() => JSON.parse(localStorage.getItem('ct.openingMode'))), option.mode, `${option.mode} becomes the saved preference`);
      assert.equal(await session.evaluate(() => CT.S.table.openingMode), option.mode, `${option.mode} is used for the table`);
      assert.equal(await session.evaluate(() => CT.S.me.zones.hand.length), option.hand, `${option.mode} deals ${option.hand} cards`);
      if (option.landsOnly) {
        const lands = await session.evaluate(() => CT.S.me.zones.hand.filter(card => /\bLand\b/.test(CT.S.me.defs[card.id]?.type || '')).length);
        assert.ok(lands >= 3, 'Three Lands deals a hand with at least three lands when the deck has enough');
      }
      await session.locator(`.ct-player-color-option[data-color="${option.color}"]`).click();
      await session.waitForFunction(color => CT.S.table.colors[CT.S.pid] === color, option.color);
      assert.equal(await session.locator('.ct-host-opening-dialog').count(), 0, 'rule prompt closes before the existing color flow');
    }

    const ruleHost = await player('Rule-change host', { 'ct.openingMode': 'london' });
    await ruleHost.locator('#hostBtn').click();
    await ruleHost.getByRole('button', { name: 'Continue', exact: true }).click();
    await ruleHost.locator('.ct-player-color-option[data-color="gold"]').click();
    await ruleHost.waitForFunction(() => CT.S.role === 'host' && CT.S.room && CT.S.table.colors[CT.S.pid] === 'gold');
    const room = await ruleHost.evaluate(() => CT.S.room);

    const ruleGuest = await player('Rule-change guest');
    await ruleGuest.locator('#joinIn').fill(room);
    await ruleGuest.locator('#joinBtn').click();
    await ruleGuest.locator('.ct-player-color-option[data-color="red"]').waitFor();
    await ruleGuest.locator('.ct-player-color-option[data-color="red"]').click();
    await ruleHost.waitForFunction(() => Object.keys(CT.S.players).length === 2, { timeout: 30000 });
    await ruleGuest.waitForFunction(() => CT.S.table?.seats.length === 2, { timeout: 30000 });
    const oldDeal = await ruleHost.evaluate(() => CT.S.table.openingDeal);
    await ruleHost.locator('.ct-opening-rule[data-a="openingrule"]').click();
    await ruleHost.getByText('Draw 10, bottom 3', { exact: true }).click();
    await ruleHost.getByRole('button', { name: 'Redeal everyone', exact: true }).click();
    await ruleHost.waitForFunction(() => CT.S.table.openingMode === 'ten-bottom-three' && CT.S.me.zones.hand.length === 10, { timeout: 20000 });
    await ruleGuest.waitForFunction(() => CT.S.table.openingMode === 'ten-bottom-three' && CT.S.me.zones.hand.length === 10, { timeout: 20000 });
    for (const page of [ruleHost, ruleGuest]) {
      assert.equal(await page.evaluate(() => CT.S.table.seats.length), 2, 'both players remain in the table');
      assert.notEqual(await page.evaluate(() => CT.S.table.openingDeal), oldDeal, 'rule change advances the opening deal');
      assert.equal(await page.evaluate(() => CT.S.me.openingDeal), await page.evaluate(() => CT.S.table.openingDeal), 'both boards receive the new opening deal');
      assert.equal(await page.evaluate(() => CT.S.me.kept), false, 'both players return to choosing an opening hand');
    }

    const solo = await player('Solo player');
    await solo.locator('#soloBtn').click();
    await solo.waitForFunction(() => CT.S.role === 'solo' && CT.S.me);
    assert.equal(await solo.locator('.ct-host-opening-dialog').count(), 0, 'solo play skips the host rule prompt');
    assert.equal(await solo.evaluate(() => CT.S.table.openingMode), 'london', 'solo keeps its existing London opening rule');
    assert.deepEqual(errors, [], errors.join('\n'));
    console.log('PASS Host Game opening prompt: Cancel/Escape preserve preference and focus; prompt is single-instance and fits both viewport sizes; all three confirmed rules save and deal correctly; two-player rule change redeals both hands; solo skips the prompt. Screenshot: /tmp/ct-host-opening-prompt.png');
  } finally {
    for (const ctx of contexts) {
      try { await ctx.pages()[0]?.evaluate(() => Net.stop()); } catch {}
      await ctx.close();
    }
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
