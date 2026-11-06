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
console.log('PASS reminders: trigger lines are found and filtered for opponents, saved reminders are cleaned and limited');
