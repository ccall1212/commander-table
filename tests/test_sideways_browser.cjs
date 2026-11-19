/* Real-browser check of sideways cards (two real players and a local relay): split cards, Rooms and a Battle's front are shown upright
 * (turned like a tapped card, so tapping one shows the plain picture); Aftermath, Adventure and double-faced cards are not turned;
 * the other player sees the same; the hover preview shows a sideways card in a landscape frame. Needs the page on 8107 and the relay on 8112. */
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
    await page.addInitScript(() => { window.__played = []; window.Audio = class { constructor(src) { this.src = String(src); this.volume = 1; } play() { window.__played.push({ src: this.src, volume: this.volume }); return Promise.resolve(); } }; }); // records sounds instead of playing them
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


    const png = 'https://cards.scryfall.io/normal/front/';
    const defs = {
      wear: { id: 'wear', name: 'Wear // Tear', face: 'Wear', type: 'Instant', oracle: 'Destroy target artifact.\n—\nDestroy target enchantment.\nFuse', img: png + 'w/wear.jpg', lay: 'split' },
      room: { id: 'room', name: 'Dazzling Theater // Prop Room', face: 'Dazzling Theater', type: 'Enchantment — Room', oracle: 'Creature spells you cast have convoke.', img: png + 'r/room.jpg', lay: 'split' },
      after: { id: 'after', name: 'Commit // Memory', face: 'Commit', type: 'Instant', oracle: 'Put target spell into its owner\'s library.\n—\nAftermath (Cast this spell only from your graveyard.)', img: png + 'c/commit.jpg', lay: 'split' },
      adv: { id: 'adv', name: 'Bonecrusher Giant // Stomp', face: 'Bonecrusher Giant', type: 'Creature — Giant', oracle: 'Whenever this creature becomes the target of a spell, it deals 2 damage to that spell\'s controller.', img: png + 'b/giant.jpg', lay: 'adventure' },
      battle: { id: 'battle', name: 'Invasion of Zendikar // Awakened Skyclave', face: 'Invasion of Zendikar', backName: 'Awakened Skyclave', type: 'Battle — Siege', backType: 'Creature — Elemental', oracle: 'When this Siege enters, search your library for two basic lands.\n—\nHaste', img: png + 'i/invasion.jpg', imgBack: 'https://cards.scryfall.io/normal/back/i/invasion.jpg', lay: 'transform' },
      bear: { id: 'bear', name: 'Test Bear', face: 'Test Bear', type: 'Creature — Bear', oracle: '', img: png + 't/bear.jpg', lay: 'normal' }
    };
    await dad.evaluate(d => { const m = CT.S.me; CT.act(() => { Object.values(d).forEach((def, i) => { def.tokens = []; def.ci = []; m.defs[def.id] = def; m.zones.hand.push({ iid: CT.S.pid + '_h' + def.id, id: def.id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); Object.values(d).forEach(def => CT.doMove(CT.S.pid + '_h' + def.id, 'battlefield')); }, defs);
    const iidOf = async id => (await dad.evaluate(i => CT.S.pid + '_h' + i, id));
    const classes = (pg, iid) => pg.evaluate(i => { const el = [...document.querySelectorAll('.card')].find(x => x.dataset.iid === i); return el ? { sideways: el.classList.contains('sideways'), tapped: el.classList.contains('tapped') } : null; }, iid);
    const both = async (id, sideways, tapped, why) => {
      const iid = await iidOf(id);
      await dad.waitForFunction(([i, s, t]) => { const el = [...document.querySelectorAll('.card')].find(x => x.dataset.iid === i); return !!el && el.classList.contains('sideways') === s && el.classList.contains('tapped') === t; }, [iid, sideways, tapped], { timeout: 15000 }).catch(async () => { throw new Error(why + ' (Dad) got ' + JSON.stringify(await classes(dad, iid))); });
      await son.waitForFunction(([i, s, t]) => { const el = [...document.querySelectorAll('.card')].find(x => x.dataset.iid === i); return !!el && el.classList.contains('sideways') === s && el.classList.contains('tapped') === t; }, [iid, sideways, tapped], { timeout: 15000 }).catch(async () => { throw new Error(why + ' (Son) got ' + JSON.stringify(await classes(son, iid))); });
    };
    const change = (id, fn) => dad.evaluate(([i, src]) => { const c = CT.S.me.zones.battlefield.find(x => x.iid === CT.S.pid + '_h' + i); CT.act(() => { new Function('c', src)(c); }); }, [id, fn]);

    // ---- 1. Untapped: sideways cards are turned upright (the tapped turn), other cards are left alone, for both players. ----
    await both('wear', true, true, 'a split card is turned upright');
    await both('room', true, true, 'a Room is turned upright');
    await both('battle', true, true, 'the front of a Battle is turned upright');
    await both('after', false, false, 'an Aftermath card is left alone');
    await both('adv', false, false, 'an Adventure is left alone');
    await both('bear', false, false, 'an ordinary card is left alone');

    // ---- 2. Tapping: a sideways card shows its plain picture; an ordinary card turns sideways as always. ----
    await change('wear', 'c.t = true');
    await both('wear', true, false, 'a tapped split card shows the plain picture');
    await change('bear', 'c.t = true');
    await both('bear', false, true, 'a tapped ordinary card turns as before');
    await change('wear', 'c.t = false');
    await both('wear', true, true, 'untapping turns it upright again');

    // ---- 3. Flipping a Battle shows its upright back face. ----
    await change('battle', 'c.fl = true');
    await both('battle', false, false, 'the back of a Battle is upright');
    await change('battle', 'c.fl = false');
    await both('battle', true, true, 'and the front is turned upright again');

    // ---- 4. The hover preview: a landscape frame for a sideways card, the normal picture otherwise. ----
    await dad.evaluate(() => { CT.S.view = 'side'; CT.render(); });
    const hoverPv = async id => { const iid = await iidOf(id); await dad.locator(`#myBf .card[data-iid="${iid}"]`).hover(); await dad.waitForSelector('#pv:not(.hidden) .pv-imgs'); return dad.evaluate(() => ({ side: document.querySelectorAll('#pv .pv-side img').length, imgs: document.querySelectorAll('#pv .pv-imgs img').length })); };
    assert.deepEqual(await hoverPv('wear'), { side: 1, imgs: 1 }, 'a split card previews in a landscape frame');
    assert.deepEqual(await hoverPv('battle'), { side: 1, imgs: 2 }, 'a Battle previews its front sideways and its back upright');
    assert.deepEqual(await hoverPv('after'), { side: 0, imgs: 1 }, 'an Aftermath card previews as it always did');
    assert.deepEqual(await hoverPv('bear'), { side: 0, imgs: 1 }, 'so does an ordinary card');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS sideways cards: split cards, Rooms and a Battle front are turned upright on the board (both players), tapping shows the plain picture, Aftermath/Adventure/ordinary cards are untouched, and the hover preview uses a landscape frame');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
