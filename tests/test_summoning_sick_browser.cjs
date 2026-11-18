/* Real-browser check of summoning sickness (two real players and a local relay): creatures and Vehicles get the "Summoning sick" status when
 * they arrive, lands do not; the icon hides while the creature is tapped or has haste (printed, temporary or granted); it can be changed
 * in the Statuses window; it clears when the controller's next turn begins (not before, and not when someone else's turn begins); and
 * giving control away and back makes it sick again. Needs the page on 8107 and the relay on 8112, like the other *_browser tests. */
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
    // Helper installed in each page: where a card is (anyone's battlefield), whether it carries the status, and whether the icon is drawn.
    for (const pg of [dad, son]) await pg.evaluate(() => {
      window.__sick = iid => {
        let card = CT.S.me.zones.battlefield.find(c => c.iid === iid);
        for (const p of Object.values(CT.S.players)) if (!card && p && p.zones) card = (p.zones.battlefield || []).find(c => c.iid === iid);
        const el = document.querySelector('.card[data-iid="' + iid + '"]');
        return { present: !!card, stored: !!(card && (card.st || []).includes('sick')), shown: !!(el && [...el.querySelectorAll('.cmark')].some(x => /Summoning sick/.test(x.getAttribute('aria-label') || x.textContent || ''))) };
      };
    });
    const expectSick = async (pg, iid, stored, shown, why) => {
      try { await pg.waitForFunction(([i, s, h]) => { const r = window.__sick(i); return r.present && r.stored === s && r.shown === h; }, [iid, stored, shown], { timeout: 8000 }); }
      catch (e) { throw new Error(why + ': wanted stored=' + stored + ' shown=' + shown + ' but got ' + JSON.stringify(await pg.evaluate(i => window.__sick(i), iid))); }
    };
    const both = async (iid, stored, shown, why) => { await expectSick(dad, iid, stored, shown, why + ' (on Dad\'s screen)'); await expectSick(son, iid, stored, shown, why + ' (on Son\'s screen)'); };
    const mk = (pg, list, opts) => pg.evaluate(([list, opts]) => {
      const m = CT.S.me;
      CT.act(() => { list.forEach(([id, type, name, oracle]) => { m.defs[id] = { id, name, face: name, type, oracle, img: '', tokens: [], ci: [] }; m.zones.hand.push({ iid: CT.S.pid + '_s' + id, id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); });
      list.forEach(([id]) => CT.doMove(CT.S.pid + '_s' + id, 'battlefield', opts && opts.faceDown ? { faceDown: true } : {}));
    }, [list, opts]);
    const change = (pg, id, fn) => pg.evaluate(([iid, src]) => { const c = CT.S.me.zones.battlefield.find(x => x.iid === iid); CT.act(() => { new Function('c', src)(c); }); }, [id, fn]);
    const active = () => dad.evaluate(() => CT.S.table.active);
    const pass = async pg => { await pg.locator('button[data-a="pass"]').first().click(); };
    const waitActive = pid => dad.waitForFunction(p => CT.S.table.active === p, pid, { timeout: 15000 });
    if ((await active()) !== dadPid) { await pass(son); await waitActive(dadPid); }
    const D = id => dadPid + '_s' + id, S = id => sonPid + '_s' + id;

    // ---- 1. Which permanents get it. ----
    await mk(dad, [['cre', 'Creature — Bear', 'Test Bear', ''], ['hasty', 'Creature — Elf', 'Test Hasty', 'Haste\nWhenever this creature attacks, draw a card.'],
      ['land', 'Land', 'Test Land', ''], ['veh', 'Artifact — Vehicle', 'Test Vehicle', 'Crew 1'], ['greaves', 'Artifact — Equipment', 'Test Greaves', 'Equipped creature has haste and shroud.\nEquip {0}']]);
    await both(D('cre'), true, true, 'a creature that just arrived is sick and shows the icon');
    await both(D('hasty'), true, false, 'a creature with printed haste is sick on paper but the icon is hidden');
    await both(D('land'), false, false, 'a land is never marked');
    await both(D('veh'), true, true, 'a Vehicle is marked');
    await both(D('greaves'), false, false, 'an Equipment is not marked');
    await mk(dad, [['hid', 'Creature — Bear', 'Test Hidden', '']], { faceDown: true });
    await both(D('hid'), true, true, 'a face-down creature is marked');

    // ---- 2. Hidden while tapped, back when untapped. ----
    await change(dad, D('cre'), 'c.t = true;');
    await both(D('cre'), true, false, 'tapped: icon hidden, status kept');
    await change(dad, D('cre'), 'c.t = false;');
    await both(D('cre'), true, true, 'untapped again: icon is back');

    // ---- 3. Haste hides it: temporary, then granted by an Equipment. ----
    await change(dad, D('cre'), "c.ts = ['haste'];");
    await both(D('cre'), true, false, 'temporary haste hides the icon');
    await change(dad, D('cre'), 'c.ts = [];');
    await both(D('cre'), true, true, 'when the temporary haste ends, the icon is back');
    await change(dad, D('greaves'), 'c.att = { p: "' + dadPid + '", i: "' + D('cre') + '" };');
    await both(D('cre'), true, false, 'haste granted by an Equipment hides it for everyone');
    await change(dad, D('greaves'), 'c.att = null;');
    await both(D('cre'), true, true, 'unattached: the icon is back');

    // ---- 4. The Statuses window: ticked, can be unticked and ticked, and not offered as a temporary status. ----
    const openMenu = async iid => { await dad.evaluate(i => CT.cardMenu(300, 300, i), iid); };
    await openMenu(D('cre'));
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Statuses & abilities/ }).first().click();
    const dlg = dad.locator('.w-marks-dialog');
    assert.equal(await dlg.locator('input[data-mark="sick"]').isChecked(), true, 'the status is ticked in the Statuses window');
    await dlg.locator('input[data-mark="sick"]').uncheck();
    await both(D('cre'), false, false, 'unticked by hand: gone for everyone');
    await dlg.locator('input[data-mark="sick"]').check();
    await both(D('cre'), true, true, 'ticked by hand: back');
    await dad.keyboard.press('Escape');
    await openMenu(D('cre'));
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Temporary/ }).first().hover();
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Statuses & abilities until end of turn/ }).first().click();
    assert.equal(await dad.locator('.w-marks-dialog input[data-mark="sick"]').count(), 0, 'it is not offered as a temporary status');
    await dad.keyboard.press('Escape');

    // ---- 5. Turns: still sick during the opponent's turn, cleared exactly when MY next turn begins. ----
    await pass(dad); await waitActive(sonPid);
    await both(D('cre'), true, true, 'still sick during the opponent\'s turn');
    await both(D('veh'), true, true, 'the Vehicle too');
    await mk(son, [['scre', 'Creature — Bear', 'Son Bear', '']]);
    await both(S('scre'), true, true, 'a creature played on the opponent\'s turn is sick');
    await pass(son); await waitActive(dadPid);
    for (const id of ['cre', 'hasty', 'veh', 'hid']) await both(D(id), false, false, id + ' is cleared when Dad\'s turn begins');
    await both(S('scre'), true, true, 'Son\'s creature is NOT cleared by Dad\'s turn');
    await pass(dad); await waitActive(sonPid);
    await both(S('scre'), false, false, 'Son\'s creature is cleared when Son\'s turn begins');

    // ---- 6. Control changes make it sick again, both ways. ----
    await both(D('cre'), false, false, 'not sick before it changes hands');
    await dad.evaluate(([i, to]) => CT.giveControl(i, to), [D('cre'), sonPid]);
    await both(D('cre'), true, true, 'a creature given to another player is sick for its new controller');
    await son.evaluate(i => CT.returnControl(i), D('cre'));
    await both(D('cre'), true, true, 'and sick again when it goes back');
    assert.equal(await dad.evaluate(i => CT.S.me.zones.battlefield.some(c => c.iid === i), D('cre')), true, 'it is back on Dad\'s board');

    // ---- 7. Even a status ticked by hand never stays: it clears when the controller's next turn begins. ----
    await change(dad, D('land'), "c.st = (c.st || []).concat('sick')");
    await both(D('land'), true, true, 'a land can be marked sick by hand');
    await pass(son); await waitActive(dadPid);
    await both(D('land'), false, false, 'a status ticked by hand also clears when the controller\'s next turn begins');

    // ---- 8. "Take an extra turn" (the arrow beside Pass turn): same player again, new turn starts, sickness clears. ----
    await mk(dad, [['xcre', 'Creature — Bear', 'Extra Bear', '']]);
    await both(D('xcre'), true, true, 'a creature played this turn is sick');
    const seqBefore = await dad.evaluate(() => CT.S.table.turnSeq), roundBefore = await dad.evaluate(() => CT.S.table.turn);
    await dad.locator('button[data-a="passmenu"]').first().click();
    await dad.locator('.w-menu-item .w-menu-label', { hasText: /^Take an extra turn/ }).first().click();
    await dad.waitForFunction(n => CT.S.table.turnSeq > n, seqBefore, { timeout: 15000 });
    assert.equal(await dad.evaluate(() => CT.S.table.active), dadPid, 'the same player is still active');
    assert.equal(await dad.evaluate(() => CT.S.table.turn), roundBefore, 'an extra turn is not a new round');
    await both(D('xcre'), false, false, 'the extra turn is a new turn for its controller, so sickness clears');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS summoning sickness: creatures and Vehicles get the status, lands do not; hidden while tapped or hasty (printed, temporary, granted); editable in the Statuses window and not offered as temporary; cleared when the controller\'s own next turn begins and not before; control changes make it sick again');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
