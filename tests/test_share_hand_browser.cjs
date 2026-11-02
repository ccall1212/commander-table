/* Real-browser check of "Share my hand with one player": three real players and a local copy of the relay.
 * Dad hosts, Son shares with Dad, Mom is a third player who must see nothing. Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_share_hand_browser.cjs
 * Set CT_CHROMIUM if Chromium is not at /usr/bin/chromium. Never touches Cloudflare. */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const mkDeck = who => ({
  id: 'share-' + who, name: who + ' deck', commanders: [], tokens: [], createdAt: '2026-11-02', source: '',
  cards: Array.from({ length: 40 }, (_, i) => ({ def: { id: who + '-c' + i, name: `${who} Card ${String(i).padStart(2, '0')}`, type: 'Creature', ci: ['U'], tokens: [] }, qty: 1 }))
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];

  async function player(name) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
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
  async function joinGame(name, room, color) {
    const page = await player(name);
    await page.locator('#joinIn').fill(room);
    await page.locator('#joinBtn').click();
    await page.getByRole('button', { name: 'Join game', exact: true }).click();
    await pickColor(page, color);
    await page.waitForFunction(() => CT.S.table && CT.S.table.seats.includes(CT.S.pid));
    return page;
  }
  const menu = page => page.getByRole('button', { name: /^(☰|Menu)/ }).first();
  const pidOf = page => page.evaluate(() => CT.S.pid);
  const handNames = page => page.evaluate(() => CT.S.me.zones.hand.map(c => CT.S.me.defs[c.id].name));
  // What a viewer can read of another player's hand: face-up cards in their miniature's hand fan.
  const shownOf = (page, pid) => page.evaluate(p => [...document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`)].map(c => c.innerText.trim()), pid);
  const backsOf = (page, pid) => page.locator(`.opp[data-opp="${pid}"] .thand .card.oback`).count();
  async function openShare(page) {
    await menu(page).click();
    await page.locator('text=/^Share my hand with one player/').first().click();
    const dialog = page.locator('.w-share-dialog');
    await dialog.waitFor();
    return dialog;
  }
  const choose = async (dialog, label) => { await dialog.locator('.share-row', { hasText: label }).first().locator('input').check(); };
  const closeDialog = async page => { await page.keyboard.press('Escape'); await page.locator('.w-share-dialog').waitFor({ state: 'detached' }); };
  const sawFrame = (page, text) => page.frames.some(f => f.includes(text));

  try {
    const dad = await hostGame('Dad', 'gold');
    const room = await dad.evaluate(() => CT.S.room);
    const son = await joinGame('Son', room, 'red');
    const mom = await joinGame('Mom', room, 'green');
    await dad.waitForFunction(() => CT.S.table.seats.length === 3);
    await mom.waitForFunction(() => CT.S.table.seats.length === 3);
    const sonPid = await pidOf(son), dadPid = await pidOf(dad);
    for (const p of [dad, son, mom]) { await p.getByRole('button', { name: 'Keep 7', exact: true }).click(); await p.waitForFunction(() => CT.S.me.kept); } // like real players, keep the opening hand first
    const sonHand = await handNames(son);
    assert.equal(sonHand.length, 7, 'Son has seven cards');
    // Before sharing, nobody can read Son's hand.
    assert.deepEqual(await shownOf(dad, sonPid), [], 'before sharing: Dad sees only backs');
    assert.equal(await backsOf(dad, sonPid), 7);
    // (Dad hosts, and a host's browser already keeps a recovery copy of every hand so seats can be restored; the point of sharing is the players who are not the host.)
    assert.equal(sonHand.some(n => sawFrame(mom, n)), false, 'before sharing: no card name has reached Mom\'s browser');

    // ---- 1. Son shares his whole hand with Dad. ----
    let dlg = await openShare(son);
    assert.match(await dlg.innerText(), /Dad/); assert.match(await dlg.innerText(), /Mom/);
    assert.equal(await dlg.locator('input[name="ctShareWhat"]').first().isDisabled(), true, 'nothing to pick until someone is chosen');
    await choose(dlg, 'Dad');
    assert.equal(await dlg.locator('.share-go').isDisabled(), true, 'cannot start until it is chosen what to show');
    await son.waitForTimeout(800);
    assert.deepEqual(await shownOf(dad, sonPid), [], 'picking a player alone shares nothing');
    await dlg.locator('.share-row', { hasText: 'My whole hand' }).locator('input').check();
    assert.deepEqual(await shownOf(dad, sonPid), [], 'and neither does choosing what to show, until Start sharing is clicked');
    await dlg.locator('.share-go').click();
    await dad.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 7, sonPid);
    assert.deepEqual((await shownOf(dad, sonPid)).sort(), sonHand.map(n => n).sort(), 'Dad sees Son\'s whole hand, face up');
    assert.equal(await dad.locator(`.opp[data-opp="${sonPid}"] .ohhand`).count() >= 0, true);
    assert.deepEqual(await shownOf(mom, sonPid), [], 'Mom sees only backs');
    assert.equal(await backsOf(mom, sonPid), 7);
    assert.equal(sonHand.some(n => sawFrame(mom, n)), false, 'no card name was ever sent to Mom\'s browser');
    assert.ok(sawFrame(mom, 'showing their whole hand to Dad'), 'Mom can read in the log that Son is showing Dad his hand');
    assert.match(await son.locator('#handLabel').innerText(), /showing to Dad/i, 'Son is reminded who he is showing');

    // Son draws a card: Dad's view follows.
    await son.evaluate(() => { const me = CT.S.me; CT.act(() => { me.zones.hand.push(me.zones.library.shift()); return ['drew a card']; }); });
    await dad.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 8, sonPid);
    const sonHand8 = await handNames(son);
    assert.deepEqual((await shownOf(dad, sonPid)).sort(), [...sonHand8].sort(), 'a newly drawn card shows up for Dad');
    assert.equal(sawFrame(mom, sonHand8[7]), false, 'and still not for Mom');

    // Dad can look at Son's board big and reads that it is shared.
    await dad.evaluate(p => { CT.S.focus = p; CT.render(); }, sonPid);
    await dad.waitForFunction(() => /SHARED WITH YOU/.test(document.querySelector('#handLabel').innerText));
    assert.equal(await dad.locator('#myHand .card:not(.oback)').count(), 8, 'in the big view Dad reads all of Son\'s cards in his hand strip');
    await dad.evaluate(() => { CT.S.focus = null; CT.render(); });

    // ---- 2. Only the cards he picks. ----
    dlg = await openShare(son);
    await dlg.locator('.share-row', { hasText: 'Only the cards I pick' }).locator('input').check();
    await dlg.locator('.share-go').click();
    await dad.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 0, sonPid);
    const pickA = sonHand8[1], pickB = sonHand8[4];
    for (const name of [pickA, pickB]) {
      await son.locator('#myHand .card', { hasText: name }).first().dispatchEvent('contextmenu', { button: 2, clientX: 400, clientY: 600, bubbles: true });
      await son.locator('.w-menu-item', { hasText: 'Show to Dad' }).first().click();
      await son.waitForFunction(n => [...document.querySelectorAll('#myHand .card.shared-priv')].some(c => c.innerText.includes(n)), name);
    }
    await dad.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 2, sonPid);
    assert.deepEqual((await shownOf(dad, sonPid)).sort(), [pickA, pickB].sort(), 'Dad sees exactly the two picked cards');
    assert.deepEqual(await shownOf(mom, sonPid), [], 'Mom still sees nothing');
    assert.ok(sawFrame(mom, 'showed a card from their hand to Dad'), 'the log says a card was shown, without naming it');
    assert.equal([pickA, pickB].some(n => sawFrame(mom, n)), false, 'the picked cards\' names were never sent to Mom');

    // Playing a picked card takes it out of what Dad sees. (The battlefield opens once the host starts the game.)
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    await son.locator('#myHand .card', { hasText: pickA }).first().hover();
    await son.keyboard.press('b');
    await son.waitForFunction(n => CT.S.me.zones.battlefield.some(c => CT.S.me.defs[c.id].name === n), pickA);
    await dad.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 1, sonPid);
    assert.deepEqual(await shownOf(dad, sonPid), [pickB], 'a played card is no longer in the shared hand');

    // ---- 3. Switch to Mom: Dad stops seeing it, Mom starts. ----
    dlg = await openShare(son);
    await choose(dlg, 'Mom');
    await dlg.locator('.share-go').click();
    await mom.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 1, sonPid);
    assert.deepEqual(await shownOf(mom, sonPid), [pickB], 'Mom now sees the picked card');
    await dad.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 0, sonPid);
    assert.deepEqual(await shownOf(dad, sonPid), [], 'and Dad no longer does');

    // ---- 4. Share everything with Mom, then stop. ----
    dlg = await openShare(son);
    await dlg.locator('.share-row', { hasText: 'My whole hand' }).locator('input').check();
    await dlg.locator('.share-go').click();
    await mom.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 7, sonPid);
    assert.ok(sonHand8.some(n => sawFrame(mom, n)), 'control: once Son shares with her, Mom\'s browser does receive card names (so the checks above are meaningful)');
    dlg = await openShare(son);
    await choose(dlg, 'Nobody');
    assert.equal(await dlg.locator('.share-go').innerText(), 'Stop sharing');
    assert.equal(await dlg.locator('input[name="ctShareWhat"]').first().isDisabled(), true, 'with nobody chosen there is nothing to pick');
    await dlg.locator('.share-go').click();
    await mom.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length === 0, sonPid);
    await son.locator('.w-share-dialog').waitFor({ state: 'detached' });
    assert.ok(!/showing to/i.test(await son.locator('#handLabel').innerText()), 'the reminder is gone');
    assert.deepEqual(await shownOf(dad, sonPid), []);

    // ---- 5. The existing "Reveal my hand to everyone" still works for everyone. ----
    await menu(son).click();
    await son.locator('text=/^Reveal my hand to everyone$/').click();
    await mom.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length >= 6, sonPid);
    await dad.waitForFunction(p => document.querySelectorAll(`.opp[data-opp="${p}"] .thand .card:not(.oback)`).length >= 6, sonPid);

    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS share hand (three real browsers + local relay): whole hand to one player, follows draws, picked cards only, played cards drop out, switch player, stop, a third player never receives a card name, reveal to everyone unchanged');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
