/* Real-browser check of Deck Builder -> "Use one set..." with a pretend Scryfall (no internet): find a set, preview the
 * confirmation, switch the deck, see the saved result, and Undo. Needs the page served first:
 *   python3 -m http.server 8107 --bind 127.0.0.1     Run: NODE_PATH=<folder with playwright> node tests/test_set_assign_browser.cjs */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const img = id => 'https://cards.scryfall.io/normal/front/x/' + id + '.jpg';
const sc = (id, name, over = {}) => ({ id, name, layout: 'normal', type_line: over.type || 'Basic Land — Forest', oracle_text: '', color_identity: [], mana_cost: '', set: 'fin', set_name: 'Final Fantasy', collector_number: id, released_at: '2025-06-13', image_uris: { normal: img(id) } });
const old = (id, name) => ({ id, name, face: name, type: 'Basic Land — Forest', oracle: '', mana: '', cmc: 0, ci: [], img: img(id), tokens: [], set: 'old', cn: id });
const deck = { id: 'dk1', name: 'Green stuff', commanders: [], tokens: [], createdAt: '2026-11-03', source: '',
  cards: [{ def: old('o1', 'Forest'), qty: 12 }, { def: old('o2', 'Sol Ring'), qty: 1 }, { def: old('o3', 'Counterspell'), qty: 1 }] };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', e => errors.push(e.message));
    const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    await page.route('https://cards.scryfall.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await page.route('https://api.scryfall.com/**', r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/sets') return r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ data: [
        { code: 'fin', name: 'Final Fantasy', set_type: 'expansion', released_at: '2025-06-13', card_count: 5 },
        { code: 'lea', name: 'Limited Edition Alpha', set_type: 'core', released_at: '1993-08-05', card_count: 295 }] }) });
      if (u.pathname === '/cards/search' && /e:fin/.test(u.searchParams.get('q'))) return r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ has_more: false,
        data: [sc('fa', 'Forest'), sc('fb', 'Forest'), sc('fc', 'Forest'), sc('fs', 'Sol Ring', { type: 'Artifact' })] }) });
      return r.fulfill({ status: 404, headers: cors, body: JSON.stringify({ details: 'none' }) });
    });
    await page.addInitScript(d => { if (!localStorage.getItem('ct.decks.v1')) localStorage.setItem('ct.decks.v1', JSON.stringify([d])); }, deck);
    await page.goto(BASE);
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ct.decks.v1'))[0]);

    await page.locator('#editDeckBtn').click();
    await page.getByRole('button', { name: 'Use one set…' }).click();
    const dlg = page.locator('.w-set-dialog');
    await dlg.waitFor();
    assert.equal(await dlg.locator('.set-row').count(), 2, 'both sets are listed');
    await dlg.locator('.set-filter').fill('final');
    assert.equal(await dlg.locator('.set-row').count(), 1, 'typing narrows the list');
    if (process.env.CT_SHOTS) await page.screenshot({ path: process.env.CT_SHOTS + '/setpick.png' });
    await dlg.locator('.set-filter').fill('LEA');
    assert.equal(await dlg.locator('.set-row').count(), 1, 'a set code works too');
    await dlg.locator('.set-row').click();
    await dlg.locator('.set-note', { hasText: 'None of the cards in this deck were printed in Limited Edition Alpha' }).waitFor();
    assert.equal((await saved()).cards.every(e => e.def.set === 'old'), true, 'nothing changes when no card is in the set');

    await dlg.locator('.set-filter').fill('final');
    await dlg.locator('.set-row').click();
    const confirm = page.locator('.w-confirm-text');
    await confirm.waitFor();
    if (process.env.CT_SHOTS) await page.screenshot({ path: process.env.CT_SHOTS + '/setconfirm.png' });
    const text = await confirm.innerText();
    assert.match(text, /Switch 13 cards to Final Fantasy/); assert.match(text, /1 card is not in this set .*Counterspell/);
    await page.getByRole('button', { name: 'Switch to Final Fantasy' }).click();
    await page.locator('.w-toast', { hasText: '13 cards now use Final Fantasy' }).waitFor();

    let d = await saved();
    const forests = d.cards.filter(e => e.def.name === 'Forest');
    assert.equal(forests.reduce((n, e) => n + e.qty, 0), 12, 'all twelve Forests are still there');
    assert.ok(forests.every(e => e.def.set === 'fin' && ['fa', 'fb', 'fc'].includes(e.def.id)), 'every Forest is a Final Fantasy one');
    assert.equal(d.cards.find(e => e.def.name === 'Sol Ring').def.set, 'fin');
    assert.equal(d.cards.find(e => e.def.name === 'Counterspell').def.set, 'old', 'a card not in the set is left alone');

    await page.getByRole('button', { name: 'Undo' }).click();
    await page.locator('.w-toast', { hasText: 'Put the previous printings back' }).waitFor();
    d = await saved();
    assert.ok(d.cards.every(e => e.def.set === 'old'), 'Undo puts every old printing back');
    assert.equal(d.cards.find(e => e.def.name === 'Forest').qty, 12);
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS use one set (real browser, pretend Scryfall): list and filter, nothing-to-change message, confirmation text, deck saved with random versions, missing card left alone, Undo');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
