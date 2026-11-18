/* Automatic checks for the pre-con decks (js/precons.js): every list parses with the normal importer into exactly 100 cards with
 * the expected commander(s), nothing is skipped, ids and names are unique, and names that Scryfall would not find
 * (a slash without spaces) are not used. Run: node tests/test_precons.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = { window: {}, console };
ctx.self = ctx.window; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['deck.js', 'precons.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), ctx, { filename: f });
const Deck = ctx.window.Deck || ctx.Deck, P = ctx.window.CTPrecons;
assert.ok(Deck && Deck.parse, 'Deck loaded'); assert.ok(Array.isArray(P) && P.length >= 10, 'at least ten ready-made decks');

const ids = new Set(), names = new Set(), report = [];
const BASIC = /^(Plains|Island|Swamp|Mountain|Forest)$/;
for (const p of P) {
  assert.ok(/^[a-z0-9-]+$/.test(p.id) && !ids.has(p.id), 'unique id: ' + p.id); ids.add(p.id);
  assert.ok(p.name && !names.has(p.name), 'unique name: ' + p.name); names.add(p.name);
  assert.equal(p.commander, p.name);
  const r = Deck.parse(p.text);
  assert.equal((r.warnings || []).length, 0, p.name + ': nothing skipped: ' + JSON.stringify(r.warnings));
  const cmd = r.commanders.map(c => c.name).join(' + ');
  assert.equal(cmd, p.name, p.name + ': the commander(s) are read from the Commander block');
  assert.ok(r.commanders.length >= 1 && r.commanders.length <= 2 && r.commanders.every(c => c.qty === 1));
  const main = r.main.reduce((n, e) => n + e.qty, 0), total = main + r.commanders.length;
  report.push(p.name + ': ' + total);
  assert.equal(total, 100, p.name + ' has ' + total + ' cards, not 100');
  // singleton: only basic lands may repeat, and a commander must not also be in the 99
  for (const e of r.main) { if (!BASIC.test(e.name)) assert.equal(e.qty, 1, p.name + ': ' + e.name + ' x' + e.qty); }
  for (const c of r.commanders) assert.ok(!r.main.some(e => e.name === c.name), p.name + ': commander also in the 99');
  // a name like "Dusk/Dawn" (no spaces) would not be found on Scryfall; split cards must be written "A // B"
  for (const e of r.main) assert.ok(!/\S\/\S/.test(e.name), p.name + ': ' + e.name + ' (write split cards as "A // B")');
}
console.log(report.join('\n'));
console.log('PASS precons: ' + P.length + ' pre-con decks, each 100 cards with its commander(s), singleton apart from basic lands');
