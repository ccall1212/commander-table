/* Real Chromium check of the browser-local Hotkeys dialog and hovered-card copy. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const land = { id: 'hotkey-island', name: 'Hotkey Island', type: 'Basic Land — Island', ci: ['U'], tokens: [] };
const deck = { id: 'hotkey-deck', name: 'Hotkey test deck', commanders: [], cards: [{ def: land, qty: 99 }], tokens: [], createdAt: '2026-10-22', source: '' };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => {
      localStorage.setItem('ct.decks.v1', JSON.stringify([value]));
      localStorage.setItem('ct.name', JSON.stringify('Hotkey player'));
    }, deck);
    await page.goto('http://127.0.0.1:8099/index.html');
    await page.locator('#soloBtn').click();
    await page.locator('[data-a="keep"]').click();
    await page.locator('#topbar [data-a="start"]').click();
    await page.waitForFunction(() => CT.S.table?.started);
    const copies = () => page.evaluate(() => CT.S.me.zones.battlefield.filter(c => c.cp).length);
    const hoverOpponent = async () => {
      await page.mouse.move(0, 0);
      await page.locator('#opps .opp[data-opp="hotkey-opponent"] .card[data-iid="opponent-card"]').hover();
      await page.waitForFunction(() => CT.S.hover?.pid === 'hotkey-opponent' && CT.S.hover.iid === 'opponent-card');
    };
    await page.locator('#myHand .card').first().hover();
    await page.keyboard.press('c');
    assert.equal(await copies(), 0, 'C does not copy a card from hand without a Copy menu action');
    await page.keyboard.press('b');
    await page.locator('#myBf .card').first().waitFor();
    await page.locator('#myBf .card').first().hover();
    await page.keyboard.press('c');
    assert.equal(await copies(), 1, 'C copies a hovered battlefield card');
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', repeat: true, bubbles: true, cancelable: true })));
    assert.equal(await copies(), 1, 'held C does not flood the board with copies');
    await page.locator('[data-a="menu"]').click();
    await page.getByRole('menuitem', { name: 'Hotkeys' }).click();
    const dialog = page.locator('.w-hotkey-list-dialog');
    await dialog.locator('[data-hotkey-set="copy"]').click();
    await page.keyboard.press('g');
    assert.equal(await dialog.locator('[data-hotkey="copy"] kbd').innerText(), 'G');
    assert.equal(await dialog.locator('[data-hotkey="graveyard"] kbd').innerText(), 'Unassigned', 'occupied key moves to the new action');
    await dialog.locator('[data-hotkey-clear="copy"]').click();
    assert.equal(await dialog.locator('[data-hotkey="copy"] kbd').innerText(), 'Unassigned', 'Clear removes the shortcut');
    await dialog.locator('[data-hotkey-set="copy"]').click();
    await page.keyboard.press('p');
    assert.equal(await dialog.locator('[data-hotkey="copy"] kbd').innerText(), 'P');
    await page.keyboard.press('Escape');
    await page.locator('#myBf .card').first().hover();
    await page.keyboard.press('c');
    assert.equal(await copies(), 1, 'old C binding stops working');
    await page.keyboard.press('p');
    assert.equal(await copies(), 2, 'new P binding copies the card');
    await page.evaluate(() => {
      const s = CT.S, pid = 'hotkey-opponent';
      s.table.seats.push(pid); s.table.order.push(pid);
      s.players[pid] = { pid, name: 'Opponent', life: 40, hand: 0, lib: 0, kept: true,
        layout: s.me.layout.map(r => ({ ...r })), bh: s.me.bh, defs: { 'hotkey-island': { id: 'hotkey-island', name: 'Hotkey Island', type: 'Basic Land — Island' } },
        zones: { battlefield: [{ iid: 'opponent-card', id: 'hotkey-island', x: 200, y: 100 }], graveyard: [], exile: [], command: [] } };
      CT.render();
    });
    await hoverOpponent();
    await page.keyboard.press('p');
    assert.equal(await copies(), 3, 'custom shortcut copies a visible opponent card in Sidebar');
    await page.locator('#opps .opp[data-opp="hotkey-opponent"] .card[data-iid="opponent-card"]').click({ button: 'right' });
    assert.match(await page.getByRole('menuitem', { name: /Copy this card/ }).innerText(), /P/, 'card menu shows custom shortcut');
    await page.keyboard.press('Escape');
    await page.locator('.viewsw [data-v="grid"]').click();
    await hoverOpponent();
    await page.keyboard.press('p');
    assert.equal(await copies(), 4, 'custom shortcut copies a visible opponent card in Grid');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await hoverOpponent();
    await page.keyboard.press('p');
    assert.equal(await copies(), 5, 'custom shortcut also works in Grid at 1920×1080');
    await page.evaluate(() => { CT.S.players['hotkey-opponent'].zones.battlefield[0].fd = 1; CT.render(); });
    await hoverOpponent();
    await page.keyboard.press('p');
    assert.equal(await copies(), 5, 'face-down opponent card cannot be copied');
    assert.equal(await page.evaluate(() => CTHotkeys.set('lens', 'Shift+Q')), '');
    await page.keyboard.down('Shift');
    await page.keyboard.down('q');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('lens-on')), true, 'custom hold key activates magnifier');
    await page.keyboard.up('Shift');
    await page.keyboard.up('q');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('lens-on')), false, 'releasing the key deactivates magnifier even after Shift');
    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'hotkey-test-input'; document.body.appendChild(input); input.focus(); });
    await page.keyboard.press('p');
    assert.equal(await copies(), 5, 'typing in an input does not copy a card');
    await page.evaluate(() => { CT.S.role = 'host'; CT.S.net.state = 'online'; document.querySelector('#hotkey-test-input').blur(); });
    await page.keyboard.press('Backquote');
    assert.equal(await page.locator('#chatPanel').evaluate(el => !el.classList.contains('hidden')), true, 'backtick opens Chat');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'chatInput', 'Chat input is focused immediately');
    await page.keyboard.type('Test chat message');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#chatInput').inputValue(), '', 'Enter sends and clears the Chat input');
    await page.keyboard.press('Backquote');
    assert.equal(await page.locator('#chatPanel').evaluate(el => el.classList.contains('hidden')), true, 'backtick closes Chat after sending');
    await page.evaluate(() => { CT.S.role = 'solo'; });
    await page.reload();
    assert.equal(await page.evaluate(() => CTHotkeys.key('copy')), 'P', 'custom key persists across reloads');
    assert.deepEqual(errors, []);
    console.log('PASS hotkeys browser: card context, C copy, occupied-key move and Clear, Sidebar/Grid opponent copy, hidden-card block, typing, Chat focus/send/close and persistence');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
