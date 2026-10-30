#!/usr/bin/env node
/* Make "saved data" fixtures from real older releases, to prove the current game can still open what they saved.
 *
 *   NODE_PATH=<folder with playwright> node tools/make-saved-data-fixture.cjs v0.3.0 v0.20.5 v0.45.1
 *
 * For each release tag it: unpacks that release, opens it in headless Chromium (no internet needed),
 * builds decks with that release's own Deck code from made-up Scryfall data (a commander, a double-faced card,
 * a planeswalker, tokens...), starts a practice game and plays a few moves, then records everything the release
 * put in the browser's storage (plus a backup file when that release has the backup feature).
 * Output: tests/fixtures/saved-data/<tag>.json. Needs git and Playwright; it never touches the network or Cloudflare.
 * Set CT_CHROMIUM to a Chromium/Chrome executable if it is not at /usr/bin/chromium. */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'fixtures', 'saved-data');

// Made-up card data in Scryfall's shape. Only what Deck.toDef reads matters; the pictures are never fetched.
const card = o => Object.assign({
  object: 'card', layout: 'normal', cmc: 0, colors: [], color_identity: [], mana_cost: '', oracle_text: '', rarity: 'common',
  set: 'tst', set_name: 'Test Set', collector_number: '1', released_at: '2024-01-01', legalities: { commander: 'legal' },
  prices: { usd: '0.10' }, scryfall_uri: 'https://scryfall.com/card/tst/1', keywords: [],
  image_uris: { normal: 'https://cards.scryfall.io/normal/front/0/0/' + o.id + '.jpg' }
}, o);
const CARDS = {
  commander: card({ id: '00000000-0000-4000-8000-000000000001', name: 'Fixture the Tidecaller', type_line: 'Legendary Creature — Merfolk Wizard', mana_cost: '{2}{U}', cmc: 3, colors: ['U'], color_identity: ['U'], oracle_text: 'Flying\nWhenever you draw a card, scry 1.', power: '3', toughness: '3' }),
  dfc: card({ id: '00000000-0000-4000-8000-000000000002', name: 'Fixture Werewolf // Fixture Moonbeast', layout: 'transform', type_line: 'Creature — Human Werewolf // Creature — Werewolf', cmc: 3, colors: ['G'], color_identity: ['G'], image_uris: undefined,
    card_faces: [
      { name: 'Fixture Werewolf', type_line: 'Creature — Human Werewolf', mana_cost: '{2}{G}', oracle_text: 'Daybound', power: '2', toughness: '3', image_uris: { normal: 'https://cards.scryfall.io/normal/front/0/0/00000000-0000-4000-8000-000000000002a.jpg' } },
      { name: 'Fixture Moonbeast', type_line: 'Creature — Werewolf', mana_cost: '', oracle_text: 'Nightbound', power: '4', toughness: '5', image_uris: { normal: 'https://cards.scryfall.io/normal/back/0/0/00000000-0000-4000-8000-000000000002b.jpg' } }] }),
  adventure: card({ id: '00000000-0000-4000-8000-000000000003', name: 'Fixture Knight // Fixture Quest', layout: 'adventure', type_line: 'Creature — Human Knight // Sorcery — Adventure', mana_cost: '{1}{W}', cmc: 2, colors: ['W'], color_identity: ['W'],
    card_faces: [{ name: 'Fixture Knight', type_line: 'Creature — Human Knight', mana_cost: '{1}{W}', oracle_text: 'Vigilance', power: '2', toughness: '2' }, { name: 'Fixture Quest', type_line: 'Sorcery — Adventure', mana_cost: '{W}', oracle_text: 'Gain 2 life.' }] }),
  walker: card({ id: '00000000-0000-4000-8000-000000000004', name: 'Fixture Sage', type_line: 'Legendary Planeswalker — Fixture', mana_cost: '{3}{U}', cmc: 4, colors: ['U'], color_identity: ['U'], oracle_text: '+1: Scry 2.', loyalty: '4' }),
  artifact: card({ id: '00000000-0000-4000-8000-000000000005', name: 'Fixture Rock', type_line: 'Artifact', mana_cost: '{2}', cmc: 2, oracle_text: '{T}: Add one mana of any color.' }),
  instant: card({ id: '00000000-0000-4000-8000-000000000006', name: 'Fixture Bolt', type_line: 'Instant', mana_cost: '{R}', cmc: 1, colors: ['R'], color_identity: ['R'], oracle_text: 'Fixture Bolt deals 3 damage to any target.' }),
  sorcery: card({ id: '00000000-0000-4000-8000-000000000007', name: 'Fixture Harvest', type_line: 'Sorcery', mana_cost: '{3}{G}', cmc: 4, colors: ['G'], color_identity: ['G'], oracle_text: 'Search your library for a basic land card.' }),
  enchantment: card({ id: '00000000-0000-4000-8000-000000000008', name: 'Fixture Aura', type_line: 'Enchantment — Aura', mana_cost: '{1}{U}', cmc: 2, colors: ['U'], color_identity: ['U'], oracle_text: 'Enchant creature' }),
  star: card({ id: '00000000-0000-4000-8000-000000000009', name: 'Fixture Wurm', type_line: 'Creature — Wurm', mana_cost: '{4}{G}', cmc: 5, colors: ['G'], color_identity: ['G'], oracle_text: "Fixture Wurm's power is equal to the number of lands you control.", power: '*', toughness: '1+*' }),
  island: card({ id: '00000000-0000-4000-8000-000000000010', name: 'Island', type_line: 'Basic Land — Island', color_identity: ['U'], oracle_text: '({T}: Add {U}.)' }),
  forest: card({ id: '00000000-0000-4000-8000-000000000011', name: 'Forest', type_line: 'Basic Land — Forest', color_identity: ['G'], oracle_text: '({T}: Add {G}.)' }),
  token: card({ id: '00000000-0000-4000-8000-000000000020', name: 'Goblin', layout: 'token', type_line: 'Token Creature — Goblin', colors: ['R'], power: '1', toughness: '1' })
};

async function makeFixture(browser, tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-fixture-' + tag + '-'));
  const tar = execFileSync('git', ['archive', '--format=tar', tag], { cwd: ROOT, maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(dir, 'index.html'));
  await page.waitForTimeout(600);

  // 1) Decks, built with this release's own Deck code.
  const decks = await page.evaluate(cards => {
    const d = c => Deck.toDef(c);
    const first = Deck.save({ name: 'Fixture Tidecaller deck', commanders: [d(cards.commander)], tokens: [d(cards.token)], cards: [
      { qty: 1, def: d(cards.dfc) }, { qty: 1, def: d(cards.adventure) }, { qty: 1, def: d(cards.walker) }, { qty: 1, def: d(cards.artifact) },
      { qty: 1, def: d(cards.instant) }, { qty: 1, def: d(cards.sorcery) }, { qty: 1, def: d(cards.enchantment) }, { qty: 1, def: d(cards.star) },
      { qty: 14, def: d(cards.island) }, { qty: 6, def: d(cards.forest) }] });
    Deck.save({ name: 'Fixture no-commander deck', commanders: [], tokens: [], cards: [{ qty: 3, def: d(cards.artifact) }, { qty: 12, def: d(cards.island) }] });
    return { ok: !!first, list: Deck.list() };
  }, CARDS);

  await page.reload(); // so the start screen lists the decks just saved
  await page.waitForTimeout(600);

  // 2) A practice game with a few moves, so the release saves a game too.
  await page.locator('#nameIn').fill('Fixture Player');
  await page.waitForTimeout(200);
  const rows = page.locator('#deckList .deck-row');
  const wanted = rows.filter({ hasText: 'Fixture Tidecaller deck' }).first();
  if (await wanted.count()) await wanted.click();
  await page.locator('#soloBtn').click();
  await page.waitForTimeout(1500);
  let played = false;
  try {
    played = await page.evaluate(() => {
      if (!window.CT || !CT.S || !CT.S.me || !CT.act) return false;
      const z = CT.S.me.zones;
      CT.act(() => {
        for (let i = 0; i < 3 && z.hand.length; i++) { const c = z.hand.shift(); c.x = 40 + i * 120; c.y = 30; c.t = i === 1; z.battlefield.push(c); }
        // what real games leave on cards: tapped, counters, face down
        if (z.battlefield[0]) z.battlefield[0].t = true;
        if (z.battlefield[1]) z.battlefield[1].c = { '+1/+1': 3, loyalty: 2 };
        if (z.battlefield[2]) z.battlefield[2].fd = true;
        if (z.library.length) z.graveyard.push(z.library.shift());
        CT.S.me.life = 33; CT.S.me.poison = 1;
        return ['fixture moves'];
      });
      return true;
    });
  } catch (e) { errors.push('moves: ' + e.message); }
  await page.waitForTimeout(900);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload'))); // make sure the game is saved
  await page.waitForTimeout(300);

  // 3) Record what this release stored, plus a backup file if it has the feature.
  const dump = await page.evaluate(() => {
    const local = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); local[k] = localStorage.getItem(k); }
    const session = {}; for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); session[k] = sessionStorage.getItem(k); }
    let backup = null;
    try { if (window.CTBackup) backup = JSON.stringify(CTBackup.create(localStorage)); } catch (e) { backup = null; }
    return { version: (document.querySelector('meta[name="app-version"]') || {}).content || '', local, session, backup };
  });
  await ctx.close();
  fs.rmSync(dir, { recursive: true, force: true });
  return {
    release: tag, pageVersion: dump.version, madeWith: 'tools/make-saved-data-fixture.cjs',
    note: 'Made-up card data saved by a real ' + tag + ' page; used by tests/test_saved_data_upgrade*.cjs',
    playedMoves: played, deckList: decks.list, localStorage: dump.local, sessionStorage: dump.session, backupFile: dump.backup,
    pageErrorsWhileMaking: errors.slice(0, 5)
  };
}

(async () => {
  const tags = process.argv.slice(2);
  if (!tags.length) { console.error('Usage: node tools/make-saved-data-fixture.cjs <tag> [<tag>...]'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  let failed = 0;
  for (const tag of tags) {
    try {
      const fx = await makeFixture(browser, tag);
      const sessKeys = Object.keys(fx.localStorage).filter(k => k.startsWith('ct.sess.'));
      fs.writeFileSync(path.join(OUT, tag + '.json'), JSON.stringify(fx));
      console.log(`${tag.padEnd(8)} decks=${fx.deckList.length} savedGames=${sessKeys.length} moves=${fx.playedMoves} backup=${fx.backupFile ? 'yes' : 'no'} keys=${Object.keys(fx.localStorage).length} size=${Math.round(fs.statSync(path.join(OUT, tag + '.json')).size / 1024)}KB pageErrors=${fx.pageErrorsWhileMaking.length}`);
    } catch (e) { failed++; console.error(tag, 'FAILED:', e.message.split('\n')[0]); }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
