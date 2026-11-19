/* Real-browser check of abilities an Equipment takes away or gives conditionally, and of counters a permanent enters with (two real players and a local
 * relay): Colossus Hammer hides flying, a frog Aura hides every ability, Champion's Helm gives hexproof to legendary creatures only, and "enters with N
 * counters" cards arrive with them (X counters are left alone). Needs the page on 8107 and the relay on 8112. */
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





    const defs = {
      bear: { id: 'bear', name: 'Test Bear', face: 'Test Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' },
      legend: { id: 'legend', name: 'Test Legend', face: 'Test Legend', type: 'Legendary Creature — Human', oracle: '', pt: '2/2' },
      hammer: { id: 'hammer', name: 'Colossus Hammer', face: 'Colossus Hammer', type: 'Artifact — Equipment', oracle: 'Equipped creature gets +10/+10 and loses flying.\nEquip {8}' },
      helm: { id: 'helm', name: 'Champion\'s Helm', face: 'Champion\'s Helm', type: 'Artifact — Equipment', oracle: 'Equipped creature gets +2/+2.\nAs long as equipped creature is legendary, it has hexproof.\nEquip {1}' },
      frog: { id: 'frog', name: 'Frogify', face: 'Frogify', type: 'Enchantment — Aura', oracle: 'Enchant creature\nEnchanted creature loses all abilities and is a blue Frog with base power and toughness 1/1.' },
      fert: { id: 'fert', name: 'Test Fertilid', face: 'Test Fertilid', type: 'Creature — Elemental', oracle: 'This creature enters with two +1/+1 counters on it.', pt: '1/1' },
      hydra: { id: 'hydra', name: 'Test Hydra', face: 'Test Hydra', type: 'Creature — Hydra', oracle: 'This creature enters with X +1/+1 counters on it.', pt: '0/0' },
      vivid: { id: 'vivid', name: 'Vivid Test', face: 'Vivid Test', type: 'Land', oracle: 'This land enters tapped with two charge counters on it.\n{T}: Add {C}.' },
      kick: { id: 'kick', name: 'Test Kicker', face: 'Test Kicker', type: 'Creature — Elf', oracle: 'This creature enters with a +1/+1 counter on it for each time it was kicked.', pt: '1/1' }
    };
    await dad.evaluate(d => { const m = CT.S.me; CT.act(() => { Object.values(d).forEach(def => { def.tokens = []; def.ci = []; m.defs[def.id] = def; m.zones.hand.push({ iid: CT.S.pid + '_g' + def.id, id: def.id, own: CT.S.pid, t: 0, fl: 0, fd: 0, c: {} }); }); }); ['bear', 'legend', 'hammer', 'helm', 'frog'].forEach(id => CT.doMove(CT.S.pid + '_g' + id, 'battlefield')); CT.act(() => { CT.S.me.zones.battlefield.forEach(c => { c.st = (c.st || []).filter(x => x !== 'sick'); }); const bear = CT.S.me.zones.battlefield.find(c => c.iid === CT.S.pid + '_gbear'); bear.st = ['flying', 'vigilance']; }); }, defs);
    const iid = id => dad.evaluate(i => CT.S.pid + '_g' + i, id);
    const stat = async (pg, id) => { const i = await iid(id); return pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); const pt = el && el.querySelector('.badges .pt'); return pt ? (pt.querySelectorAll('.pt-stat').length === 2 ? [...pt.querySelectorAll('.pt-stat')].map(b => b.textContent.trim()).join('/') : pt.textContent.replace(/\s+/g, '')) : ''; }, i); };
    const waitStat = async (id, text, why) => { for (const pg of [dad, son]) { const t0 = Date.now(); while ((await stat(pg, id)) !== text) { if (Date.now() - t0 > 15000) throw new Error(why + ' (' + pg.playerName + ') expected ' + text + ' got ' + (await stat(pg, id))); await pg.waitForTimeout(100); } } };
    const icons = async (pg, id) => { const i = await iid(id); return pg.evaluate(x => { const el = [...document.querySelectorAll('.card')].find(c => c.dataset.iid === x); return el ? [...el.querySelectorAll('.cmark')].map(m => (m.getAttribute('title') || m.getAttribute('data-tip') || '').split(' — ')[0]).filter(Boolean).sort().join(',') : null; }, i); };
    const waitIcons = async (id, text, why) => { for (const pg of [dad, son]) { const t0 = Date.now(); while ((await icons(pg, id)) !== text) { if (Date.now() - t0 > 15000) throw new Error(why + ' (' + pg.playerName + ') expected [' + text + '] got [' + (await icons(pg, id)) + ']'); await pg.waitForTimeout(100); } } };
    const attach = (what, to) => dad.evaluate(([a, t]) => { const f = CT.S.me.zones.battlefield; const A = f.find(c => c.iid === CT.S.pid + '_g' + a), T = f.find(c => c.iid === CT.S.pid + '_g' + t); CT.act(() => { A.att = t ? { p: CT.S.pid, i: T.iid } : null; }); }, [what, to]);

    // ---- 1. Colossus Hammer: +10/+10 and the flying icon goes away (vigilance stays). ----
    await waitIcons('bear', 'Flying,Vigilance', 'a bear with flying and vigilance');
    await attach('hammer', 'bear');
    await waitStat('bear', '12/12', 'Colossus Hammer gives +10/+10');
    await waitIcons('bear', 'Vigilance', 'the Hammer takes flying away; vigilance stays');
    await attach('hammer', null);
    await waitIcons('bear', 'Flying,Vigilance', 'flying comes back when the Hammer comes off'); await waitStat('bear', '2/2', 'and the number');
    // ---- 2. A frog Aura hides every ability icon, and sets 1/1. ----
    await attach('frog', 'bear');
    await waitIcons('bear', 'Frog', 'a frog loses all abilities (only its Frog type tag is left)'); await waitStat('bear', '1/1', 'a 1/1 frog');
    await attach('frog', null);
    await waitIcons('bear', 'Flying,Vigilance', 'abilities come back');
    // ---- 3. Champion's Helm: +2/+2 for everyone, hexproof only for a legendary creature. ----
    await attach('helm', 'legend');
    await waitStat('legend', '4/4', 'the Helm gives +2/+2'); await waitIcons('legend', 'Hexproof', 'and hexproof to a legendary creature');
    await attach('helm', 'bear');
    await waitStat('bear', '4/4', 'the Helm on a bear gives +2/+2'); await waitIcons('bear', 'Flying,Vigilance', 'but no hexproof to a non-legendary creature');
    await waitIcons('legend', '', 'and it is gone from the legend once the Helm moves');
    await attach('helm', null);
    // ---- 4. Counters a permanent enters with. ----
    const play = id => dad.evaluate(i => { CT.doMove(CT.S.pid + '_g' + i, 'battlefield'); const c = CT.S.me.zones.battlefield.find(x => x.iid === CT.S.pid + '_g' + i); return JSON.stringify({ c: c.c, t: !!c.t }); }, id);
    assert.deepEqual(JSON.parse(await play('fert')), { c: { '+1/+1': 2 }, t: false }, 'a creature that enters with two +1/+1 counters');
    await waitStat('fert', '3/3', '1/1 with two counters');
    assert.deepEqual(JSON.parse(await play('hydra')), { c: {}, t: false }, 'X counters are left for the player');
    assert.deepEqual(JSON.parse(await play('vivid')), { c: { Charge: 2 }, t: true }, 'a Vivid land: tapped, with two charge counters');
    assert.deepEqual(JSON.parse(await play('kick')), { c: {}, t: false }, '"for each time it was kicked" is left alone');
    const log = await dad.evaluate(() => JSON.stringify(CT.S.table.log || CT.S.log || []));
    assert.match(log, /played \{0\} with 2 \+1\/\+1 counters/, 'the log mentions the counters');
    assert.match(log, /played \{0\} tapped with 2 Charge counters/, 'and the Vivid land');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS loses abilities and enters-with counters: Colossus Hammer hides flying (and gives +10/+10), a frog Aura hides every ability, Champion\'s Helm gives hexproof to legendary creatures only, fixed "enters with" counters are added and X counters are not');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
