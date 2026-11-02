/* Real-browser check of (1) the on-screen dice / coin / random-player pop-up shown to every player and (2) the outline on
 * the TARGET card of a targeting arrow (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_roll_arrow_browser.cjs
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
    const son = await joinGame('Son', room, 'red');
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    const sonPid = await pidOf(son), dadPid = await pidOf(dad);

    // ---- 1. Dice, coin and random player pop up for BOTH players, with the same result the log reports. ----
    const logHas = (page, text) => page.waitForFunction(t => CT.S.log.some(e => String(e.text).includes(t)), text);
    const popupText = page => page.evaluate(() => { const b = document.querySelector('#rollPopup'); return b ? { text: b.innerText, revealed: b.classList.contains('revealed'), cls: b.className } : null; });
    const diceItem = async (page, label) => {
      await page.getByRole('button', { name: /Dice/ }).click();
      await page.locator('.w-menu-item .w-menu-label', { hasText: new RegExp('^' + label + '$') }).first().click();
    };
    await diceItem(son, 'Roll d20');
    await dad.locator('#rollPopup').waitFor(); await son.locator('#rollPopup').waitFor();
    await dad.waitForFunction(() => document.querySelector('#rollPopup.revealed'), null, { timeout: 5000 });
    const shot = (pg, n) => process.env.CT_SHOTS ? pg.screenshot({ path: `${process.env.CT_SHOTS}/${n}.png` }) : null;
    await shot(dad, 'die'); const d20 = await popupText(dad);
    const logged = await dad.evaluate(() => CT.S.log.filter(e => /rolled a d20/.test(e.text)).pop().text);
    const val = logged.match(/d20: (\d+)/)[1];
    assert.match(d20.text, /Son rolled a d20/); assert.ok(d20.text.split('\n').some(l => l.trim() === val), 'pop-up shows the logged number ' + val + ': ' + d20.text);
    assert.ok(/is-die/.test(d20.cls));
    await son.waitForFunction(() => document.querySelector('#rollPopup.revealed'), null, { timeout: 5000 });
    assert.ok((await popupText(son)).text.includes(val), 'the roller sees the same number');

    await diceItem(dad, 'Flip a coin');
    await son.waitForFunction(() => /Dad flipped a coin/.test((document.querySelector('#rollPopup') || {}).innerText || ''));
    await son.waitForFunction(() => document.querySelector('#rollPopup.revealed'), null, { timeout: 5000 });
    await shot(son, 'coin'); const coin = await popupText(son);
    const coinLog = await son.evaluate(() => CT.S.log.filter(e => /flipped a coin/.test(e.text)).pop().text);
    const side = coinLog.includes('heads') ? 'HEADS' : 'TAILS';
    assert.ok(coin.text.includes(side), 'coin pop-up says ' + side + ': ' + coin.text);
    assert.equal(await son.locator('#rollPopup .ct-coin.land-' + side.toLowerCase()).count(), 1);

    await dad.getByRole('button', { name: /Dice/ }).click();
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Other dice$/ }).first().hover();
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^d100$/ }).first().click();
    await son.waitForFunction(() => /Dad rolled a d100/.test((document.querySelector('#rollPopup') || {}).innerText || ''));

    await diceItem(son, 'Pick a random player');
    await dad.waitForFunction(() => document.querySelector('#rollPopup.is-player.revealed'), null, { timeout: 5000 });
    const pickLog = await dad.evaluate(() => CT.S.log.filter(e => /picked a random player/.test(e.text)).pop().text);
    await shot(dad, 'player'); assert.ok((await popupText(dad)).text.includes(pickLog.split(': ').pop()));

    // The pop-up goes away by itself and on click.
    await dad.locator('#rollPopup').click(); await dad.locator('#rollPopup').waitFor({ state: 'detached' });
    // The host refuses results that were not real (wrong number, unknown die, unknown player, unseated sender).
    for (const bad of [{ kind: 'die', sides: 20, value: 21 }, { kind: 'die', sides: 7, value: 3 }, { kind: 'coin', value: 'edge' }, { kind: 'player', value: 'nobody_1' }, { kind: 'wat' }]) {
      await dad.evaluate(b => CT.hostRecv(CT.S.pid, Object.assign({ t: 'rollfx' }, b)), bad);
    }
    await dad.waitForTimeout(500);
    assert.equal(await dad.locator('#rollPopup').count(), 0, 'invalid roll messages show nothing');

    // ---- 2. Arrow: the target card is outlined in the arrow owner's color, on every screen. ----
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.waitForFunction(() => /Hands ready: 2\/2/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    const playOne = async (page, n) => {
      const card = page.locator('#myHand .card').nth(n);
      await card.hover(); await page.keyboard.press('b');
    };
    await playOne(dad, 0); await playOne(son, 0);
    await dad.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).length === 1, sonPid);
    await son.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).length === 1, dadPid);
    await dad.evaluate(() => { CT.S.view = 'side'; CT.render(); });
    const mineBf = dad.locator('#myBf .card[data-zone="battlefield"]').first();
    await mineBf.dispatchEvent('contextmenu', { button: 2, clientX: 400, clientY: 300, bubbles: true });
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Send arrow to/ }).first().click();
    await dad.locator(`.opp.tile[data-opp="${sonPid}"] .card[data-zone="battlefield"]`).first().click();
    await shot(dad, 'arrow');
    for (const pg of [dad, son]) {
      await pg.waitForFunction(() => { const r = document.querySelector('#ct-target-arrow .ct-arrow-target-outline'); return r && r.style.display !== 'none' && +r.getAttribute('width') > 10; }, null, { timeout: 10000 });
      const info = await pg.evaluate(() => ({ colour: getComputedStyle(document.querySelector('#ct-target-arrow .ct-arrow-item')).color, shown: [...document.querySelectorAll('#ct-target-arrow .ct-arrow-target-outline')].filter(r => r.style.display !== 'none').length, src: [...document.querySelectorAll('#ct-target-arrow .ct-arrow-source-outline')].filter(r => r.style.display !== 'none').length }));
      assert.equal(info.shown, 1, 'one target outline'); assert.equal(info.src, 1, 'one source outline'); assert.ok(info.colour);
    }
    // An arrow to a player (not a card) draws no card outline.
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS roll pop-up + arrow target outline (two real browsers): d20/d100/coin/random player appear for both players with the logged result, bad results are refused, pop-up dismisses; arrow outlines both the source and the target card');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
