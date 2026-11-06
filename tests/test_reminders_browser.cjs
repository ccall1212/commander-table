/* Real-browser check of the trigger reminders panel: my own reminders (saved with the deck) and the
 * triggers quoted from cards in play, including an opponent's trigger that mentions opponents (two real players). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_reminders_browser.cjs
 * Set CT_CHROMIUM if Chromium is not at /usr/bin/chromium. Never touches Cloudflare. */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const mkDeck = who => ({
  id: 'share-' + who, name: who + ' deck', commanders: [], tokens: [], createdAt: '2026-11-02', source: '',
  cards: Array.from({ length: 40 }, (_, i) => ({ def: { id: who + '-c' + i, name: `${who} Card ${String(i).padStart(2, '0')}`, type: 'Creature', ci: ['U'], tokens: [], img: 'https://cards.scryfall.io/normal/front/x/' + who + i + '.jpg' }, qty: 1 }))
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];

  async function player(name) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.route('https://cards.scryfall.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
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
    const son = await joinGame('Son', await dad.evaluate(() => CT.S.room), 'red');
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    const dadPid = await pidOf(dad), sonPid = await pidOf(son);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const give = (pg, defs) => pg.evaluate(list => { const m = CT.S.me; CT.act(() => { list.forEach((d, i) => { m.defs[d.id] = d; m.zones.battlefield.push({ iid: CT.S.pid + '_t' + i, id: d.id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {}, x: 60 + i * 100, y: 60 }); }); }); }, defs);
    const card = (id, name, oracle) => ({ id, name, face: name, type: 'Creature', oracle, img: '', tokens: [], ci: [] });
    await give(dad, [card('omn', 'Omnath, Locus of Mana', 'Landfall — Whenever a land you control enters, you gain 4 life.\nIf you have 4 life or more, add {R}.'), card('etb', 'Elvish Visionary', 'When Elvish Visionary enters the battlefield, draw a card.'), card('mine', 'Dad Only Trigger', 'Whenever you cast a creature spell, scry 1.\nAt the beginning of combat on your turn, put a +1/+1 counter on target creature.'), card('mik', 'Mikey & Don', 'Ward {2}\nYou may play lands and cast Mutant, Ninja, or Turtle spells from the top of your library. If you cast a creature spell this way, that creature enters with a +1/+1 counter on it.')]);
    await give(son, [card('rhy', 'Rhystic Study', 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.'), card('self', 'Son Own Upkeep', 'At the beginning of your upkeep, scry 1.')]);
    await dad.waitForFunction(p => (CT.S.players[p].zones.battlefield || []).length === 2, sonPid);
    // The tab, then the panel.
    const tab = dad.locator('#remTab'); await tab.waitFor();
    await dad.waitForFunction(() => /Reminders · 5/.test((document.querySelector('#remTab') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    assert.match(await tab.innerText(), /Reminders · 5/, 'all of Dad\'s lines and Rhystic Study are counted');
    await tab.click();
    const panel = dad.locator('#remPanel'); await panel.waitFor();
    const tbl = async () => (await panel.locator('.rem-tbl').allInnerTexts()).map(t => t.replace(/\s+/g, ' '));
    let lines = await tbl();
    assert.equal(lines.length, 4, 'one box per card: ' + JSON.stringify(lines));
    assert.equal(await panel.locator('.rem-tbl', { hasText: 'Dad Only Trigger' }).locator('.rem-line').count(), 2, 'a card\'s triggers sit together in one box');
    assert.ok(lines.some(l => /Mikey & Don.*You may play lands and cast Mutant, Ninja, or Turtle spells from the top of your library\. If you cast a creature spell this way, that creature enters with a \+1\/\+1 counter on it/.test(l)), 'the play-from-the-library permission with its enters-with part is listed');
    assert.equal((await panel.locator('.rem-kw').allInnerTexts()).join('|'), 'Landfall', 'the ability word is highlighted');
    assert.ok((await panel.locator('.rem-cond').allInnerTexts()).some(t => t === 'At the beginning of combat on your turn') && (await panel.locator('.rem-cond').allInnerTexts()).some(t => t === 'Whenever a land you control enters'), 'the trigger conditions are highlighted');
    assert.ok(lines.some(l => /Omnath.*Landfall — Whenever a land you control enters/.test(l)), 'my landfall trigger is quoted');
    assert.ok(lines.some(l => /Dad Only Trigger.*scry 1/.test(l)), 'and my other trigger');
    assert.ok(lines.some(l => /Rhystic Study \(Son\).*Whenever an opponent casts a spell/.test(l)), 'the opponent\'s trigger that affects me is shown with whose it is');
    assert.ok(!lines.some(l => /Elvish Visionary|Son Own Upkeep/.test(l)), 'a one-time enters-the-battlefield trigger and an opponent\'s own upkeep trigger are not shown');
    // Opponents' triggers can be switched off.
    assert.equal(await panel.locator('.rem-form').isVisible(), false, 'the add form is hidden until you want it');
    assert.equal(await panel.locator('.rem-opts').isVisible(), false, 'and so are the options');
    await panel.locator('[data-rem="show-opts"]').click();
    await panel.locator('[data-rem="opp"]').click();
    assert.equal(await panel.locator('[data-rem="opp"]').innerText(), 'Off');
    await dad.waitForFunction(() => document.querySelectorAll('#remPanel .rem-tbl').length === 3);
    await panel.locator('[data-rem="opp"]').click();
    assert.equal(await panel.locator('[data-rem="opp"]').innerText(), 'On');
    await dad.waitForFunction(() => document.querySelectorAll('#remPanel .rem-tbl').length === 4);
    // A card of mine in the graveyard whose text works from there is listed; it is not listed while it sits in play.
    await dad.evaluate(() => { const m = CT.S.me, d = { id: 'qg', name: 'Quilled Greatwurm', face: 'Quilled Greatwurm', type: 'Creature', oracle: 'Trample\nWhenever a creature you control deals combat damage during your turn, put that many +1/+1 counters on it.\nYou may cast this card from your graveyard by removing six counters from among creatures you control in addition to paying its other costs.', img: '', tokens: [], ci: [] }; CT.act(() => { m.defs.qg = d; m.zones.graveyard.push({ iid: CT.S.pid + '_qg', id: 'qg', own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); });
    await dad.waitForFunction(() => document.querySelectorAll('#remPanel .rem-tbl').length === 5);
    const gy = (await tbl()).find(l => /Quilled Greatwurm/.test(l));
    assert.ok(/in graveyard.*You may cast this card from your graveyard/.test(gy) && !/Whenever a creature you control deals/.test(gy), 'the graveyard line only: ' + gy);
    await dad.evaluate(() => { const m = CT.S.me; CT.act(() => { m.zones.graveyard.length = 0; }); });
    await dad.waitForFunction(() => document.querySelectorAll('#remPanel .rem-tbl').length === 4);
    // Layout: a long reminder with a tag, in a narrow window, never overflows or overlaps inside the panel.
    await panel.locator('[data-rem="show-add"]').click();
    await panel.locator('.rem-text').fill('Can play lands, mutants, ninjas, or turtles from the top of the library'); await panel.locator('.rem-when').fill('Upkeep'); await panel.locator('[data-rem="add"]').click();
    await panel.locator('.rem-row:not(.rem-tbl)', { hasText: 'Can play lands' }).waitFor();
    const fit = await dad.evaluate(() => {
      const p = document.querySelector('#remPanel'), r = p.getBoundingClientRect(), bad = [];
      p.querySelectorAll('*').forEach(el => { const b = el.getBoundingClientRect(); if (b.width && (b.right > r.right + 1 || b.left < r.left - 1)) bad.push(el.className || el.tagName); });
      const row = p.querySelector('.rem-row:not(.rem-tbl)'), txt = row.querySelector('.rem-txt').getBoundingClientRect(), pill = row.querySelector('.rem-pill').getBoundingClientRect();
      return { bad, overlap: !(pill.top >= txt.bottom - 1 || pill.bottom <= txt.top + 1 || pill.left >= txt.right - 1 || pill.right <= txt.left + 1), horizontalScroll: p.querySelector('.rem-scroll').scrollWidth > p.querySelector('.rem-scroll').clientWidth + 1 };
    });
    assert.deepEqual(fit.bad, [], 'nothing sticks out of the panel: ' + fit.bad);
    assert.equal(fit.overlap, false, 'the tag does not overlap the reminder text'); assert.equal(fit.horizontalScroll, false);
    if (process.env.CT_SHOTS) await dad.locator('#remPanel').screenshot({ path: process.env.CT_SHOTS + '/reminders-panel.png' });
    await panel.locator('[data-rem="del"]').first().click();
    await dad.waitForFunction(() => !document.querySelector('#remPanel .rem-row:not(.rem-tbl)'));
    // Hide one line.
    await panel.locator('.rem-tbl', { hasText: 'Dad Only Trigger' }).locator('[data-rem="hide"]').click();
    await dad.waitForFunction(() => document.querySelectorAll('#remPanel .rem-tbl').length === 3);

    // My own reminders are saved with the deck.
    await panel.locator('[data-rem="show-add"]').click();
    await panel.locator('.rem-text').fill('Landfall: draw 2 cards and gain 1 life'); await panel.locator('.rem-when').fill('each land'); await panel.locator('[data-rem="add"]').click();
    await panel.locator('.rem-row:not(.rem-tbl)', { hasText: 'Landfall: draw 2' }).waitFor();
    assert.match(await panel.locator('.rem-pill').first().innerText(), /each land/);
    const saved = () => dad.evaluate(() => { const d = JSON.parse(localStorage.getItem('ct.decks.v1')).find(x => x.id === CT.S.deckId); return d && d.reminders; });
    let stored = await saved();
    assert.equal(stored.length, 1); assert.equal(stored[0].text, 'Landfall: draw 2 cards and gain 1 life'); assert.equal(stored[0].when, 'each land');
    assert.ok((await dad.evaluate(() => CTBackup.create(window.localStorage).decks.find(d => d.reminders))).reminders.length === 1, 'a backup keeps the reminders');
    // Edit by clicking the text.
    await panel.locator('.rem-txt').first().click();
    await dad.locator('.w-dialog input').first().fill('Landfall: draw 2, gain 1'); await dad.keyboard.press('Enter');
    await dad.waitForFunction(() => /draw 2, gain 1/.test(document.querySelector('#remPanel .rem-txt').innerText));
    assert.equal(await panel.locator('input[type=checkbox]').count(), 0, 'there are no tick boxes');
    // Remove it again, and collapse to the tab.
    await panel.locator('[data-rem="del"]').first().click();
    await dad.waitForFunction(() => !document.querySelector('#remPanel .rem-row:not(.rem-tbl)'));
    assert.deepEqual(await saved(), [], 'removed from the deck too');
    await panel.locator('[data-rem="close"]').click();
    assert.equal(await dad.locator('#remPanel').isVisible(), false); assert.equal(await dad.locator('#remTab').isVisible(), true);
    if (process.env.CT_SHOTS) { await dad.locator('#remTab').click(); await dad.waitForTimeout(300); await dad.screenshot({ path: process.env.CT_SHOTS + '/reminders.png' }); }
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS reminders (two real browsers): table triggers quoted (mine, and an opponent trigger that affects me), one-time and opponent-only triggers left out, opponents toggle, hide, my own reminders saved with the deck and in backups, edit, no tick boxes, collapse to a tab');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
