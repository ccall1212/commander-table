/* Real-browser check that the Reminders panel is sorted by when things happen (two real players and a local relay): upkeep, draw step,
 * main phase, beginning of combat, combat, end step, spells cast, other triggers, always on; every "At the beginning of combat" line is
 * under one heading, and lines that read alike are next to each other. Needs the page on 8107 and the relay on 8112. */
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
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const cards = [
      ['c1', 'Combat Zed', 'At the beginning of each combat, create a 1/1 token.'],
      ['e1', 'End Card', 'At the beginning of your end step, draw a card.'],
      ['c2', 'Combat Alpha', 'At the beginning of combat on your turn, put a +1/+1 counter on target creature.'],
      ['u1', 'Upkeep Card', 'At the beginning of your upkeep, scry 1.'],
      ['w1', 'Event Card', 'Whenever a creature enters under your control, you gain 1 life.'],
      ['c3', 'Combat Beta', 'At the beginning of combat on your turn, untap target land.\nWhenever you cast a creature spell, scry 1.'],
      ['a1', 'Attack Card', 'Whenever this creature attacks, draw a card.'],
      ['d1', 'Damage Card', 'Whenever a creature you control deals combat damage to a player, scry 1.'],
      ['m2', 'Second Main', 'At the beginning of your postcombat main phase, add {G}.'],
      ['s1', 'Scales', 'If one or more +1/+1 counters would be put on a creature you control, that many plus one are put on it instead.']
    ];
    await dad.evaluate(list => {
      const m = CT.S.me;
      CT.act(() => {
        list.forEach(([id, name, oracle], k) => {
          m.defs[id] = { id, name, face: name, type: 'Creature', oracle, img: '', tokens: [], ci: [] };
          m.zones.battlefield.push({ iid: CT.S.pid + '_o' + id, id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {}, x: 20 + k * 90, y: 40 });
        });
      });
    }, cards);
    await dad.locator('#remTab').click();
    await dad.waitForFunction(() => document.querySelectorAll('#remPanel .rem-tbl').length >= 11);
    // Headings (#...) and card boxes, in the order they appear in the panel.
    const flat = await dad.evaluate(() => [...document.querySelectorAll('#remPanel .rem-scroll > *')]
      .filter(e => e.matches('.rem-sub, .rem-tbl'))
      .map(e => (e.classList.contains('rem-sub') ? '#' + e.textContent : e.querySelector('.rem-who b').textContent)));
    const want = ['#Upkeep', 'Upkeep Card', '#Beginning of combat', 'Combat Alpha', 'Combat Beta', 'Combat Zed', '#Declare attackers and blockers', 'Attack Card', '#Combat damage', 'Damage Card', '#Main phase 2', 'Second Main', '#End step', 'End Card',
      '#When spells are cast', 'Combat Beta', '#Other triggers', 'Event Card', '#Always on', 'Scales'];
    assert.deepEqual(flat, want, 'sorted by when it matters, alike lines together: ' + JSON.stringify(flat));
    assert.equal(flat.filter(x => x === '#Beginning of combat').length, 1, 'all beginning-of-combat lines sit under one heading');
    console.log('PASS reminders order: upkeep, beginning of combat (all together, alike wording side by side), end step, spells cast, other triggers, always on');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
