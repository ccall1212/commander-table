/* Run with Node: node tests/test_reminders.cjs. Pure helpers of the reminders list. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = vm.createContext({ window: {}, Math, Set, String, Array, Object });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/reminders.js'), 'utf8'), ctx);
const R = ctx.window.CTReminders;
const plain = x => JSON.parse(JSON.stringify(x));

const omnath = 'Landfall — Whenever a land you control enters, you gain 4 life.\nIf you have 4 life or more, add {R}.';
const rhystic = 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.';
const etb = 'When Elvish Visionary enters the battlefield, draw a card.';
const upkeep = 'At the beginning of your upkeep, scry 1.';
const myOnly = 'Whenever you cast a creature spell, put a +1/+1 counter on target creature you control.';
const both = 'At the beginning of each player\'s upkeep, that player loses 1 life.';

assert.deepEqual(plain(R.triggerLines(omnath, true)), ['Landfall — Whenever a land you control enters, you gain 4 life.'], 'a landfall line is found, other text is not');
assert.deepEqual(plain(R.triggerLines(etb, true)), [], 'a one-time enters-the-battlefield line is not a reminder');
assert.deepEqual(plain(R.triggerLines(upkeep, true)), [upkeep], 'my own upkeep trigger');
assert.deepEqual(plain(R.triggerLines(rhystic, false)), [rhystic], 'an opponent trigger that mentions opponents is shown');
assert.deepEqual(plain(R.triggerLines(myOnly, false)), [], 'an opponent trigger that only concerns them is not');
assert.deepEqual(plain(R.triggerLines(upkeep, false)), [], 'their own upkeep trigger is not shown');
assert.deepEqual(plain(R.triggerLines(both, false)), [both], 'an each-player trigger can affect me, so it is shown');
const mikey = 'Ward {2}\nYou may look at the top card of your library any time.\nYou may play lands and cast Mutant, Ninja, or Turtle spells from the top of your library. If you cast a creature spell this way, that creature enters with a +1/+1 counter on it.';
const mk = plain(R.triggerLines(mikey, true));
assert.equal(mk.length, 1, 'a play-from-the-library permission is a reminder; plain keywords like Ward are not');
assert.ok(mk.some(l => /enters with a \+1\/\+1 counter on it/.test(l)), 'the whole permission line, including the enters-with part, is kept');
assert.deepEqual(plain(R.triggerLines('Flying\nHaste\nWard {2}', true)), [], 'plain keywords are not reminders');
assert.deepEqual(plain(R.triggerLines(mikey, false)), [], 'an opponent\'s own permission does not concern me');
assert.deepEqual(plain(R.triggerLines('Each creature you control enters with an additional +1/+1 counter on it.', true)).length, 1, 'an enters-with effect');
const quilled = 'Trample\nWhenever a creature you control deals combat damage during your turn, put that many +1/+1 counters on it. (It must survive to get the counters.)\nYou may cast this card from your graveyard by removing six counters from among creatures you control in addition to paying its other costs.';
assert.deepEqual(plain(R.triggerLines(quilled, true)).length, 1, 'in play: only its trigger, not the graveyard permission');
assert.deepEqual(plain(R.zoneLines(quilled, 'graveyard')), ['You may cast this card from your graveyard by removing six counters from among creatures you control in addition to paying its other costs.'], 'in my graveyard: the line about casting it from there');
assert.deepEqual(plain(R.zoneLines('If this card is in your graveyard at the beginning of your upkeep, you may return it to your hand.', 'graveyard')).length, 1, 'an if-this-card-is-in-your-graveyard line');
assert.deepEqual(plain(R.zoneLines('Flashback {2}{R}\nDeal 3 damage.', 'graveyard')), ['Flashback {2}{R}'], 'Flashback is a reminder in the graveyard');
assert.deepEqual(plain(R.zoneLines('Flying\nTrample', 'graveyard')), [], 'nothing for a card with no graveyard abilities');
assert.deepEqual(plain(R.zoneLines('Foretell {1}{U}\nDraw a card.', 'exile')), ['Foretell {1}{U}'], 'Foretell in exile');
assert.deepEqual(plain(R.zoneLines('You may cast this card from exile.', 'exile')).length, 1);
assert.deepEqual(plain(R.zoneLines(quilled, 'library')), []);
assert.deepEqual(plain(R.triggerLines(null, true)), [], 'no rules text');
assert.deepEqual(plain(R.triggerLines('Flying\nWhenever this creature attacks, draw a card.\n—\nWhenever another creature dies, scry 1.', true)).length, 2, 'two-faced text with a separator');
assert.ok(R.triggerLines('Whenever ' + 'x'.repeat(900), true)[0].length <= 400, 'long lines are shortened');

const cleaned = plain(R.cleanList([{ id: 'a b!', text: '  Landfall:   draw 2  ', when: 'each land' }, { text: '' }, null, 5, { id: 'a b!', text: 'dup id', when: 'y'.repeat(100) }, { text: 'x'.repeat(500) }]));
assert.equal(cleaned.length, 3, 'empty and bad entries are dropped');
assert.equal(cleaned[0].text, 'Landfall: draw 2'); assert.equal(cleaned[0].id, 'ab'); assert.equal(cleaned[0].when, 'each land');
assert.notEqual(cleaned[1].id, cleaned[0].id, 'ids stay unique'); assert.equal(cleaned[1].when.length, 24);
assert.equal(cleaned[2].text.length, 240);
assert.equal(plain(R.cleanList(Array.from({ length: 100 }, (_, i) => ({ text: 'r' + i })))).length, 60, 'at most 60 reminders');
assert.deepEqual(plain(R.cleanList('nope')), []);
// Keyword abilities that are triggers (Gyre Sage's Evolve) are listed, quoted as printed.
{
  const gyre = 'Evolve (Whenever a creature enters the battlefield under your control, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.)\n{T}: Add {G} for each +1/+1 counter on this creature.';
  const l = R.triggerLines(gyre, true);
  assert.equal(l.length, 1); assert.match(l[0], /^Evolve \(Whenever a creature enters/);
  assert.equal(R.triggerLines(gyre, false).length, 0, 'an opponent\'s keyword is not listed');
  assert.equal(R.triggerLines('Flying, prowess\nVigilance', true).length, 1, 'a keyword sharing a line is found');
  assert.match(R.triggerLines('Flying, prowess', true)[0], /^Prowess \(Whenever you cast a noncreature spell/);
  assert.match(R.triggerLines('Annihilator 2', true)[0], /^Annihilator 2 \(.*sacrifices 2 permanents/);
  assert.match(R.triggerLines('Exalted', true)[0], /^Exalted \(/);
  assert.equal(R.triggerLines('Flying\nVigilance\nWard {2}\nFlash', true).length, 0, 'plain keywords are not reminders');
  assert.equal(R.leadingKeyword('Evolve (Whenever…)'), 'Evolve'); assert.equal(R.leadingKeyword('Annihilator 2').trim(), 'Annihilator'); assert.equal(R.leadingKeyword('Flying'), '');
}
console.log('PASS reminders: trigger lines are found and filtered for opponents, saved reminders are cleaned and limited');
