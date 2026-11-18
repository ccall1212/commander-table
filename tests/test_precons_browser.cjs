/* Real-browser check of the pre-con decks and the find-a-deck links on the start screen. Scryfall is faked (no internet and no relay
 * needed), so this checks our screen and the saving, not Scryfall. Needs the page running first, like the other *_browser tests:
 *   python3 -m http.server 8107 --bind 127.0.0.1                    (from the project folder)
 * Then run:  NODE_PATH=<folder with playwright> node tests/test_precons_browser.cjs */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const slug = s => 'mock-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', e => errors.push(e.message));

  // Fake Scryfall: answers every requested card name with a simple card, except names in `missing`; mode 'down' makes it unreachable.
  let mode = 'ok', calls = 0; const missing = new Set(), asked = [];
  await page.route('https://cards.scryfall.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route('https://api.scryfall.com/**', async route => {
    if (mode === 'down') return route.abort();
    calls++;
    const body = JSON.parse(route.request().postData() || '{}');
    const data = [], notFound = [];
    for (const i of body.identifiers || []) {
      if (!i.name) { notFound.push(i); continue; }
      asked.push(i.name);
      if (missing.has(i.name)) { notFound.push(i); continue; }
      const basic = /^(Plains|Island|Swamp|Mountain|Forest)$/.test(i.name);
      data.push({ object: 'card', id: slug(i.name), name: i.name, layout: 'normal', cmc: 0, mana_cost: '', color_identity: [], set: 'tst', set_name: 'Test', collector_number: '1',
        type_line: basic ? 'Basic Land — ' + i.name : 'Legendary Creature — Test', oracle_text: '', image_uris: { normal: 'https://cards.scryfall.io/normal/front/m/o/' + slug(i.name) + '.jpg' } });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ object: 'list', not_found: notFound, data }) });
  });

  try {
    await page.goto(BASE);
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });

    // ---- The links and the ready-made decks are on the start screen. ----
    const links = await page.evaluate(() => [...document.querySelectorAll('#lobby a[href*="moxfield.com"], #lobby a[href*="archidekt.com"]')].map(a => [a.textContent, a.href, a.target, a.rel]));
    assert.ok(links.length >= 2, 'links to Moxfield and Archidekt: ' + JSON.stringify(links));
    for (const [text, href, target, rel] of links) { assert.equal(target, '_blank'); assert.match(rel, /noopener/); assert.match(href, /^https:\/\/(moxfield|archidekt)\.com\//, text); }
    assert.ok(links.some(l => l[1].includes('moxfield.com')) && links.some(l => l[1].includes('archidekt.com')));
    const total = await page.evaluate(() => CTPrecons.length);
    assert.ok(total >= 10, 'ready-made decks loaded');
    assert.equal(await page.locator('#readyDeckList').count(), 0, 'the decks are not all listed on the page');
    assert.equal(await page.locator('#readyDeckSelect option').count(), total + 1, 'one dropdown with a placeholder and one entry per deck');
    const groups = await page.locator('#readyDeckSelect optgroup').evaluateAll(gs => gs.map(g => ({ label: g.label, decks: [...g.querySelectorAll('option')].map(o => o.textContent) })));
    assert.equal(groups.length, await page.evaluate(() => new Set(CTPrecons.map(p => p.group)).size), 'one group per set and year');
    assert.equal(groups.reduce((n, g) => n + g.decks.length, 0), total, 'every deck is in a group');
    const ff = groups.find(g => g.label === 'Final Fantasy: 2025');
    assert.ok(ff && ff.decks.length === 4, 'the Final Fantasy: 2025 group shows its four decks: ' + JSON.stringify(ff));
    assert.deepEqual(ff.decks.map(d => d.replace('✓ ', '')).sort(), ['Cloud, Ex-SOLDIER', 'Terra, Herald of Hope', "Tidus, Yuna's Guardian", "Y'shtola, Night's Blessed"]);
    assert.ok(groups[0].label.endsWith(String(new Date().getFullYear())) || /\d{4}/.test(groups[0].label), 'groups are labelled with their year');
    assert.ok(!(await page.evaluate(() => CTPrecons.some(p => p.date < '2016-01-01'))), 'nothing older than 2016');
    assert.equal(await page.locator('#readyDeckSelect option').first().innerText(), 'Choose a pre-con deck…');
    assert.equal(await page.locator('#readySurprise').isVisible(), true);
    const pick = async text => { const id = await page.evaluate(t => (CTPrecons.find(p => p.name === t) || CTPrecons.find(p => p.name.includes(t))).id, text); await page.selectOption('#readyDeckSelect', id); };
    const have = () => page.locator('#readyDeckSelect option', { hasText: '✓' }).count();
    assert.match(await page.locator('#deckList').evaluate(e => getComputedStyle(e, '::after').content), /pre-con/, 'the empty-list note points to the pre-con decks');

    // ---- One click adds a complete deck, selects it, and marks it. ----
    await pick("Tidus, Yuna's Guardian");
    await page.waitForSelector('#deckList .deck-row');
    let rows = await page.locator('#deckList .deck-row').allInnerTexts();
    assert.equal(rows.length, 1);
    assert.match(rows[0].replace(/\s+/g, ' '), /Tidus, Yuna's Guardian.*Tidus, Yuna's Guardian · 100 cards/, 'saved with its commander and 100 cards: ' + rows[0]);
    assert.equal(await page.locator('#deckList .deck-row.sel').count(), 1, 'the new deck is selected');
    assert.ok(asked.includes("Tidus, Yuna's Guardian") && asked.includes('Sol Ring') && asked.includes('Sphere Grid'), 'the whole list is looked up');
    assert.equal(await have(), 1, 'a check mark on the added deck');
    assert.equal(await page.locator('#readyDeckSelect').inputValue(), '', 'the dropdown goes back to its placeholder');
    const saved = await page.evaluate(() => { const d = Deck.get(Deck.list()[0].id); return { commanders: d.commanders.map(c => c.name), cards: d.cards.reduce((n, r) => n + r.qty, 0), source: d.source === 'precon:' + CTPrecons.find(p => p.name === "Tidus, Yuna's Guardian").id }; });
    assert.deepEqual(saved.commanders, ["Tidus, Yuna's Guardian"]); assert.equal(saved.cards, 99); assert.equal(saved.source, true);

    // ---- Picking the same deck again does not make a copy. ----
    const callsBefore = calls;
    await pick("Tidus, Yuna's Guardian");
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#deckList .deck-row').count(), 1, 'no duplicate');
    assert.equal(calls, callsBefore, 'and no new lookup');

    // ---- Surprise me adds a different deck each time (it prefers decks you have not added yet). ----
    const K = 12;
    for (let i = 1; i < K; i++) {
      await page.locator('#readySurprise').click();
      await page.waitForFunction(n => document.querySelectorAll('#deckList .deck-row').length === n, i + 1);
    }
    assert.equal(await page.locator('#deckList .deck-row').count(), K, 'twelve different decks after twelve clicks');
    const names = await page.locator('#deckList .dn').allInnerTexts();
    assert.equal(new Set(names).size, K, 'all different');
    // A two-commander deck keeps both commanders.
    await pick('Frodo, Adventurous Hobbit + Sam, Loyal Attendant');
    await page.waitForFunction(n => document.querySelectorAll('#deckList .deck-row').length === n || /already in your decks/.test(document.body.innerText), K + 1).catch(() => {});
    const pair = (await page.locator('#deckList .deck-row', { hasText: 'Frodo' }).allInnerTexts())[0].replace(/\s+/g, ' ');
    assert.match(pair, /Frodo, Adventurous Hobbit \+ Sam, Loyal Attendant · 100 cards/, 'a two-commander deck keeps both: ' + pair);
    const added = await page.locator('#deckList .deck-row').count();
    assert.equal(await have(), added, 'every saved pre-con is marked in the dropdown');
    // ---- Deleting a deck clears its check mark so it can be added again. ----
    const rowCount = () => page.locator('#deckList .deck-row').count();
    const waitRows = n => page.waitForFunction(n => document.querySelectorAll('#deckList .deck-row').length === n, n);
    const deleteDeck = async text => { await page.locator('#deckList .deck-row', { hasText: text }).locator('[data-del]').click(); await page.getByRole('button', { name: 'Delete', exact: true }).click(); };
    await pick('Galadriel, Elven-Queen');
    await page.locator('#deckList .deck-row', { hasText: 'Galadriel, Elven-Queen' }).waitFor();
    const n0 = await rowCount();
    await deleteDeck('Galadriel, Elven-Queen');
    await waitRows(n0 - 1);
    assert.equal(await have(), n0 - 1, 'the check mark goes away with the deck');

    // ---- A card Scryfall cannot find: the deck is still added, with a warning that names it. ----
    missing.add('Wood Elves');
    await pick('Galadriel, Elven-Queen');
    await waitRows(n0);
    const toast = (await page.locator('.w-toast').allInnerTexts()).join(' ');
    assert.match(toast, /could not be found: Wood Elves/, 'the missing card is named: ' + toast);
    missing.clear();

    // ---- No internet: a clear message, nothing saved, and the buttons work again. ----
    await pick('Cloud, Ex-SOLDIER');
    await page.locator('#deckList .deck-row', { hasText: 'Cloud, Ex-SOLDIER' }).waitFor();
    const n1 = await rowCount();
    await deleteDeck('Cloud, Ex-SOLDIER');
    await waitRows(n1 - 1);
    mode = 'down';
    await pick('Cloud, Ex-SOLDIER');
    await page.waitForFunction(() => /Could not reach Scryfall/.test(document.body.innerText));
    assert.equal(await rowCount(), n1 - 1, 'nothing was saved');
    assert.equal(await page.locator('#readyDeckSelect:not([disabled])').count() + await page.locator('#readySurprise:not([disabled])').count(), 2, 'the dropdown and the button work again');
    mode = 'ok';
    await pick('Cloud, Ex-SOLDIER');
    await waitRows(n1);

    // ---- The deck can really be played: start a practice game with a ready-made deck. ----
    await page.locator('#nameIn').fill('Tester');
    await page.locator('#deckList .deck-row', { hasText: 'Cloud, Ex-SOLDIER' }).locator('.dn').click();
    await page.locator('#soloBtn').click();
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => !!(window.CT && CT.S.me && CT.S.me.zones.hand.length))) break;
      for (const label of ['Continue', 'Start', 'Keep']) { const b = page.getByRole('button', { name: label }).first(); if (await b.count() && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; } }
      const c = page.locator('.ct-player-color-option').first(); if (await c.count() && await c.isVisible().catch(() => false)) await c.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await page.waitForFunction(() => window.CT && CT.S.me && CT.S.me.zones.hand.length, null, { timeout: 20000 });
    const game = await page.evaluate(() => { const z = CT.S.me.zones; return { hand: z.hand.length, library: z.library.length, command: z.command.map(c => CT.S.me.defs[c.id].name) }; });
    assert.equal(game.hand, 7, 'opening hand of 7'); assert.equal(game.hand + game.library, 99, 'the other 99 cards are in hand and library');
    assert.deepEqual(game.command, ['Cloud, Ex-SOLDIER'], 'the commander starts in the command zone');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS pre-con decks: ' + total + ' decks, choosing from the dropdown adds a full deck with its commander(s), a repeat or Surprise me never makes a copy, a missing card is named, no internet is reported cleanly, links to Moxfield and Archidekt open in a new tab');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
