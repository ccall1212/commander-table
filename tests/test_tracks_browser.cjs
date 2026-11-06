/* Real-browser check of the step trackers for Sagas, Classes and Rooms (two real players): numbered dots on the card, clickable by the owner, driven by lore counters, shown to the other player, chapter-only reminders, and an automatic lore counter each turn. Needs the page and the relay running first,
 * like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_tracks_browser.cjs
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
    const dadPid = await pidOf(dad);
    for (const pg of [dad, son]) await pg.locator('button[data-a="keep"]').click().catch(() => {});
    await dad.locator('button[data-a="start"]:not([disabled])').click();
    await son.waitForFunction(() => CT.S.table && CT.S.table.started, null, { timeout: 60000 });
    for (const pg of [dad, son]) await pg.evaluate(() => { const o = document.querySelector('#firstRollOverlay'); if (o) o.remove(); });
    const defs = [
      ['saga', 'Enchantment Creature — Saga Unicorn', 'Summon: Ixion', '(As this Saga enters and after your draw step, add a lore counter.)\nI — Exile target creature.\nII, III — Gain 2 life.\nFirst Strike'],
      ['cls', 'Enchantment — Class', 'Test Class', '{2}{G}: Level 2\nLevel 2\nSomething\n{3}{G}: Level 3\nLevel 3\nSomething else'],
      ['room', 'Enchantment — Room', 'Bottomless Pool // Locker Room', '']
    ];
    await dad.evaluate(defs => { const m = CT.S.me; CT.act(() => { defs.forEach(([id, type, name, oracle], i) => { m.defs[id] = { id, name, face: name.split(' // ')[0], type, oracle, img: '', tokens: [], ci: [] }; m.zones.hand.push({ iid: CT.S.pid + '_t' + id, id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); defs.forEach(([id]) => CT.doMove(CT.S.pid + '_t' + id, 'battlefield')); }, defs);
    const dots = async (pg, name) => pg.evaluate(([pid, name]) => { const iid = pid + '_t' + name; const c = document.querySelector('.card[data-iid="' + iid + '"] .ctrack'); return c ? [...c.querySelectorAll('.tstep')].map(x => (x.classList.contains('on') ? 'o' : '-') + (x.classList.contains('cur') ? '*' : '')).join(' ') : null; }, [dadPid, name]);
    const wait = (pg, name, want) => pg.waitForFunction(([pid, name, want]) => { const c = document.querySelector('.card[data-iid="' + pid + '_t' + name + '"] .ctrack'); return c && [...c.querySelectorAll('.tstep')].map(x => (x.classList.contains('on') ? 'o' : '-') + (x.classList.contains('cur') ? '*' : '')).join(' ') === want; }, [dadPid, name, want], { timeout: 10000 });
    // A Saga enters with its first lore counter; the other player sees the same dots.
    await wait(dad, 'saga', 'o* - -'); await wait(son, 'saga', 'o* - -');
    assert.equal(await dad.evaluate(pid => CT.S.me.zones.battlefield.find(c => c.id === 'saga').c.Lore, dadPid), 1, 'the lore counter is a real counter');
    const chip = pg => pg.evaluate(pid => { const e = document.querySelector('.card[data-iid="' + pid + '_tsaga"] .ctrs .ctr[data-ctr="Lore"]'); return e ? e.textContent : null; }, dadPid);
    assert.equal(await chip(dad), '1 Lore', 'the Lore counter shows at the top right of the card');
    await son.waitForFunction(pid => { const e = document.querySelector('.card[data-iid="' + pid + '_tsaga"] .ctrs .ctr[data-ctr="Lore"]'); return e && e.textContent === '1 Lore'; }, dadPid);
    // Clicking a dot moves there; clicking the current one steps back; the other player follows.
    const dot = (pg, name, n) => pg.locator('.card[data-iid="' + dadPid + '_t' + name + '"] .ctrack .tstep[data-step="' + n + '"]');
    await dot(dad, 'saga', 3).click(); await wait(dad, 'saga', 'o o o*'); await wait(son, 'saga', 'o o o*');
    await dot(dad, 'saga', 3).click(); await wait(dad, 'saga', 'o o* -');
    // Counters moved by other means (Tidus, Yuna's Guardian) move the dots.
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 'saga'); CT.act(() => { c.c.Lore = 1; }); });
    await wait(dad, 'saga', 'o* - -');
    // The other player cannot click my dots.
    await dot(son, 'saga', 3).click({ force: true }).catch(() => {});
    await dad.waitForTimeout(400);
    assert.equal(await dad.evaluate(() => CT.S.me.zones.battlefield.find(x => x.id === 'saga').c.Lore), 1, 'only the owner moves it');
    // Reminders show only the chapter it is on.
    await dad.locator('#remTab').click();
    await dad.evaluate(() => { const p = document.querySelector('#remPanel'); p.style.left = (innerWidth - 340) + 'px'; p.style.top = '60px'; });
    const rem = async () => (await dad.locator('#remPanel').innerText()).replace(/\s+/g, ' ');
    let txt = await rem();
    assert.ok(/I — Exile target creature/.test(txt) && !/II, III — Gain 2 life/.test(txt), 'chapter I only: ' + txt);
    await dot(dad, 'saga', 2).click(); await wait(dad, 'saga', 'o o* -');
    await dad.waitForFunction(() => /II, III — Gain 2 life/.test(document.querySelector('#remPanel').innerText) && !/I — Exile target creature/.test(document.querySelector('#remPanel').innerText.replace(/II, III/g, '')));
    // Class: three levels, starts at Level 1.
    await wait(dad, 'cls', 'o* - -');
    await dot(dad, 'cls', 2).click(); await wait(son, 'cls', 'o o* -');
    // Room: two doors, each unlocked or locked.
    const doors = pg => pg.evaluate(pid => [...document.querySelectorAll('.card[data-iid="' + pid + '_troom"] .ctrack .tstep')].map(x => x.textContent).join(''), dadPid);
    assert.equal(await doors(dad), '🔒🔒');
    await dot(dad, 'room', 1).click(); await son.waitForFunction(pid => [...document.querySelectorAll('.card[data-iid="' + pid + '_troom"] .ctrack .tstep')].map(x => x.textContent).join('') === '🔓🔒', dadPid);
    // The card menu has next / previous.
    await dad.evaluate(() => { CT.cardMenu(300, 300, CT.S.pid + '_tsaga'); });
    await dad.getByText('Add a lore counter (next chapter)').click();
    await wait(dad, 'saga', 'o o o*');
    // A lore counter is added automatically when my next turn starts (after the other player passes back).
    await dad.evaluate(() => { const c = CT.S.me.zones.battlefield.find(x => x.id === 'saga'); CT.act(() => { c.c.Lore = 1; }); });
    await dad.locator('button[data-a="pass"]').first().click();
    await son.waitForFunction(() => CT.S.table.active === CT.S.pid, null, { timeout: 15000 });
    await son.locator('button[data-a="pass"]').first().click();
    await dad.waitForFunction(() => CT.S.me.zones.battlefield.find(x => x.id === 'saga').c.Lore === 2, null, { timeout: 15000 });
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS step trackers: a Saga enters with a lore counter, dots follow lore counters and clicks for both players, only the owner can move them, reminders show only the current chapter, Class levels, Room doors, menu steps, lore counter added at my next turn');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
