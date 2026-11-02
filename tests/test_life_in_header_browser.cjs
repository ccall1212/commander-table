/* Real-browser check that the life total sits in each miniature's name bar, never on top of the board, and still works
 * (four real players, Sidebar and Grid, two screen sizes). Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_life_in_header_browser.cjs
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
    const host = await hostGame('Dad', 'gold');
    const room = await host.evaluate(() => CT.S.room);
    const pages = [host];
    for (const [n, c] of [['Son', 'red'], ['Mom', 'blue'], ['John', 'green']]) pages.push(await joinGame(n, room, c));
    for (const pg of pages) await pg.waitForFunction(() => CT.S.table.seats.length === 4);

    const geometry = (page) => page.evaluate(() => [...document.querySelectorAll('#opps .opp.tile')].map(t => {
      const r = x => { const b = x.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const life = t.querySelector('.ohead .hlife .lifebox'), head = t.querySelector('.ohead'), board = t.querySelector('.boardwrap');
      return { who: t.dataset.opp || 'me', life: life && r(life), head: head && r(head), board: board && r(board), overflow: head ? head.scrollWidth - head.clientWidth : 0, onBoard: !!t.querySelector('.boardwrap .lifebox') };
    }));

    for (const [w, h] of [[1366, 768], [1920, 1080]]) {
      for (const view of ['grid', 'side']) {
        await host.setViewportSize({ width: w, height: h });
        await host.evaluate(v => { CT.S.view = v; CT.render(); }, view);
        await host.waitForTimeout(400);
        const tiles = await geometry(host);
        assert.ok(tiles.length >= 3, `${view} ${w}: miniature tiles are shown`);
        for (const t of tiles) {
          const tag = `${view} ${w}x${h} ${t.who}`;
          assert.ok(t.life, tag + ': life total is in the name bar');
          assert.equal(t.onBoard, false, tag + ': no life total on the board');
          assert.ok(t.life.b <= t.board.t + 1, tag + ': life total ends above the board (' + t.life.b + ' vs ' + t.board.t + ')');
          assert.ok(t.life.l >= t.head.l - 1 && t.life.r <= t.head.r + 1, tag + ': life total fits inside the bar');
          assert.ok(t.overflow <= 1, tag + ': name bar does not overflow by ' + t.overflow);
        }
        await host.screenshot({ path: process.env.CT_SHOTS ? `${process.env.CT_SHOTS}/life-${view}-${w}.png` : '/dev/null' }).catch(() => {});
      }
    }

    // It still works: change an opponent's life from the bar, my own life, and open the counters menu.
    await host.setViewportSize({ width: 1366, height: 768 });
    await host.evaluate(() => { CT.S.view = 'grid'; CT.render(); });
    const sonPid = await pidOf(pages[1]);
    const before = await pages[1].evaluate(() => CT.S.me.life);
    await host.locator(`.opp.tile[data-opp="${sonPid}"] .hlife button[data-d="-1"]`).click();
    await pages[1].waitForFunction(b => CT.S.me.life === b - 1, before);
    await host.locator(`.opp.tile[data-opp="${sonPid}"] .hlife button[data-d="1"]`).click();
    await pages[1].waitForFunction(b => CT.S.me.life === b, before);
    const mine = await host.evaluate(() => CT.S.me.life);
    await host.locator('.opp.mytile .hlife button[data-d="1"]').click();
    await host.waitForFunction(b => CT.S.me.life === b + 1, mine);
    await host.locator(`.opp.tile[data-opp="${sonPid}"] .hlife .lifeN`).click();
    await host.locator('.w-dialog input').first().fill('33');
    await host.keyboard.press('Enter');
    await pages[1].waitForFunction(() => CT.S.me.life === 33);
    await host.locator(`.opp.tile[data-opp="${sonPid}"] .hlife button.more`).click();
    await host.locator('#oppPanel').waitFor();

    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS life total in the name bar (four real browsers): never on the board in Grid/Sidebar at 1366x768 and 1920x1080, fits the bar, +/-, set life and the counters menu work for opponents and me');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
