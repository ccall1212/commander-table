/* Real-browser check of automatic printed abilities: a card entering the battlefield gets the ability icons printed at the start of its rules text (the end, for a Saga creature), not when face down, and the table-menu switch turns it off. Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_auto_keywords_browser.cjs
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
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    // Put four made-up cards into Dad's hand and play them.
    const cases = [
      ['kim', 'Creature — Dragon', 'Vigilance\nWhenever Kimarhri attacks, draw a card.'],
      ['ixi', 'Enchantment Creature — Saga Knight', 'I — Draw a card.\nII — Gain 2 life.\nIII — Destroy target creature.\nFirst Strike'],
      ['late', 'Creature', 'Whenever you cast a spell, draw a card.\nFlying'],
      ['multi', 'Creature', 'Flying, lifelink\nTrample']
    ];
    const play = (opts) => dad.evaluate(([cases, opts]) => {
      const m = CT.S.me; const out = {};
      CT.act(() => { cases.forEach(([id, type, oracle], i) => { m.defs[id] = { id, name: id, face: id, type, oracle, img: '', tokens: [], ci: [] }; m.zones.hand.push({ iid: CT.S.pid + '_a' + i + opts.tag, id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); });
      cases.forEach(([id], i) => CT.doMove(CT.S.pid + '_a' + i + opts.tag, 'battlefield', opts.faceDown ? { faceDown: true } : {}));
      cases.forEach(([id], i) => { const c = m.zones.battlefield.find(x => x.iid === CT.S.pid + '_a' + i + opts.tag); out[id] = c ? (c.st || []).join(',') : 'missing'; });
      return out;
    }, [cases, opts]);
    let got = await play({ tag: 'x' });
    assert.deepEqual(got, { kim: 'vigilance', ixi: 'first strike', late: '', multi: 'flying,lifelink,trample' }, JSON.stringify(got));
    got = await play({ tag: 'f', faceDown: true });
    assert.deepEqual(got, { kim: '', ixi: '', late: '', multi: '' }, 'face-down cards have no abilities: ' + JSON.stringify(got));
    // The switch in the table menu turns it off.
    await dad.evaluate(() => localStorage.setItem('ct.autoKw', 'false'));
    got = await play({ tag: 'o' });
    assert.deepEqual(got, { kim: '', ixi: '', late: '', multi: '' }, 'switched off: ' + JSON.stringify(got));
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS auto keywords: icons switched on from the start of the rules text (end for a Saga creature), nothing for later lines or face-down cards, and the menu switch turns it off');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
