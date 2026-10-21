/* Focused Deck Builder integration check against the local HTTP copy at :8108.
   Run a local server first; this uses real Chromium through Playwright. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const commander = (id, name, ci) => ({ id, name, type: 'Legendary Creature', ci, tokens: [] });
const card = (id, name, type, ci, oracle = '') => ({ id, name, type, ci, oracle, tokens: [] });
const deck = {
  id: 'deck-health-browser', name: 'Deck health browser fixture', createdAt: '2026-10-21', source: '', tokens: [],
  commanders: [commander('c1', 'Azorius Partner A', ['W']), commander('c2', 'Azorius Partner B', ['U'])],
  cards: [
    { def: card('island', 'Island', 'Basic Land — Island', ['U']), qty: 94 },
    { def: card('sol1', 'Sol Ring', 'Artifact', []), qty: 1 },
    { def: card('sol2', 'Sol Ring', 'Artifact', []), qty: 1 },
    { def: card('forest', 'Forest', 'Basic Land — Forest', ['G']), qty: 1 },
    { def: Object.assign(card('sage', 'Grove Sage', 'Legendary Creature — Druid', ['G']), { legendary: true }), qty: 1 },
    { def: card('dwarves', 'Seven Dwarves', 'Creature — Dwarf', [], 'A deck can have up to seven cards named Seven Dwarves.'), qty: 2 },
    { def: card('rats', 'Rat Colony', 'Creature — Rat', [], 'A deck can have any number of cards named Rat Colony.'), qty: 10 },
  ],
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await context.addInitScript(d => localStorage.setItem('ct.decks.v1', JSON.stringify([d])), deck);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8108/index.html');
    await page.locator('#editDeckBtn').click();
    const dialog = page.locator('.w-viewer-dialog');
    await dialog.waitFor();
    const summary = dialog.locator('.deck-health');
    assert.match(await summary.innerText(), /112 cards including commanders/);
    const notes = summary.locator('ul');
    await summary.locator('summary').click();
    assert.match(await notes.innerText(), /Forest is outside the commander color identity \(G\)/);
    assert.match(await notes.innerText(), /Sol Ring appears 2 times/);
    assert.doesNotMatch(await notes.innerText(), /Seven Dwarves appears|Rat Colony appears/);
    await page.getByRole('button', { name: 'Remove one copy of Azorius Partner B' }).click();
    assert.match(await summary.innerText(), /111 cards including commander/);
    await dialog.locator('.w-vcard[aria-label="Grove Sage"]').click({ button: 'right' });
    await page.getByText('Set as commander', { exact: true }).click();
    assert.doesNotMatch(await notes.innerText(), /Forest is outside the commander color identity/);
    assert.match(await notes.innerText(), /Island is outside the commander color identity/);
    assert.equal(await notes.isVisible(), true);
    await summary.getByRole('button', { name: 'Dismiss deck checks' }).click();
    assert.equal(await summary.isHidden(), true);
    await page.getByRole('button', { name: 'Remove one copy of Island' }).click();
    assert.match(await summary.innerText(), /110 cards including commanders/);
    assert.equal(await summary.isHidden(), true, 'dismissing stays in effect while editing');
    await dialog.getByRole('button', { name: 'Close' }).click().catch(async () => {
      await page.keyboard.press('Escape');
    });
    await page.locator('#editDeckBtn').click();
    assert.match(await page.locator('.deck-health').innerText(), /110 cards including commanders/);
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.setViewportSize({ width: 1366, height: 768 });
    assert.equal(await page.locator('.deck-health').isVisible(), true);
    console.log('PASS actual Chromium Deck Builder: partner color union, outside identity warning, count includes commanders, duplicate grouping and printed exceptions, dismiss/edit/reopen updates at 1920x1080 and 1366x768; no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
