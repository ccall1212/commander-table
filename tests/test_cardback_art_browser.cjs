/* Real-browser check that a chosen card back is drawn on top of the built-in gold emblem (the gold oval used to sit over
 * the artwork of libraries and face-down cards). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_cardback_art_browser.cjs
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
    const son = await joinGame('Son', await dad.evaluate(() => CT.S.room), 'red');
    await dad.waitForFunction(() => CT.S.table.seats.length === 2);
    await dad.waitForFunction(() => document.querySelector('.zbox[data-pile="library"] .w-cardback-art'));
    // The built-in gold emblem is the ::before / ::after of .w-cardback. The chosen picture must be stacked above both.
    const top = page => page.evaluate(() => [...document.querySelectorAll('.w-cardback')].map(b => {
      const art = b.querySelector(':scope > .w-cardback-art'); if (!art) return null;
      const z = el => { const v = getComputedStyle(el).zIndex; return v === 'auto' ? 0 : +v; }, zp = (el, p) => { const v = getComputedStyle(el, p).zIndex; return v === 'auto' ? 0 : +v; };
      return { where: (b.closest('[data-pile],.oback,.card,.tpile,.w-dialog') || b.parentElement).className.toString().slice(0, 24), artOnTop: z(art) > zp(b, '::before') && z(art) > zp(b, '::after') && getComputedStyle(b, '::before').zIndex !== undefined, before: getComputedStyle(b, '::before').zIndex, art: z(art) };
    }).filter(Boolean));
    const mine = await top(dad);
    assert.ok(mine.length >= 1, 'my library shows a chosen card back');
    assert.ok(mine.every(x => x.artOnTop), 'the chosen back covers the built-in emblem everywhere on my screen: ' + JSON.stringify(mine));
    const theirs = await top(son);
    assert.ok(theirs.length >= 1 && theirs.every(x => x.artOnTop), 'and on the other player screen: ' + JSON.stringify(theirs));
    // The fallback is still there underneath when the picture is missing.
    const fallback = await dad.evaluate(() => { const b = document.querySelector('.zbox[data-pile="library"] .w-cardback'); return getComputedStyle(b, '::before').content !== 'none' && getComputedStyle(b, '::before').display !== 'none'; });
    assert.ok(fallback, 'the built-in emblem is still there underneath as the fallback');
    if (process.env.CT_SHOTS) { await dad.evaluate(() => document.querySelectorAll('.w-toast').forEach(t => t.remove())); await dad.locator('.zbox[data-pile="library"]').screenshot({ path: process.env.CT_SHOTS + '/cardback.png' }); }
    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS card back art on top of the built-in emblem (two real browsers), fallback kept');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
