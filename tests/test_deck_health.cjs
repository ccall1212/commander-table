const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/deck-health.js'), 'utf8'), context);
const checks = context.window.CTDeckHealth.checks;
const commander = { name: 'Partners', ci: ['W', 'U'] };
const card = (name, ci = [], extra = {}) => ({ def: { name, ci, ...extra }, qty: 1 });
const result = value => JSON.parse(JSON.stringify(checks(value)));

let got = result({ commanders: [commander], cards: Array.from({ length: 99 }, (_, i) => card('Card ' + i)) });
assert.equal(got.total, 100, 'total includes the commander');
assert.equal(got.messages.length, 0);

got = result({ commanders: [], cards: [card('Off-color', ['R'])] });
assert.ok(got.messages.some(m => m.includes('No commander')));
assert.ok(got.messages.some(m => m.includes('1 card') && m.includes('100')));

got = result({ commanders: [{ name: 'Partner A', ci: ['W'] }, { name: 'Partner B', ci: ['U'] }], cards: [card('Matches either', ['U'])] });
assert.equal(got.messages.some(m => m.includes('Matches either') && m.includes('outside')), false,
  'color identity combines both commanders');
got = result({ commanders: [commander], cards: [card('Off-color', ['B'])] });
assert.ok(got.messages.some(m => m.includes('Off-color') && m.includes('B')));

const dwarves = { name: 'Seven Dwarves', oracle: 'A deck can have up to seven cards named Seven Dwarves.' };
got = result({ commanders: [commander], cards: [{ def: dwarves, qty: 7 }] });
assert.equal(got.messages.some(m => m.includes('Seven Dwarves appears')), false, 'printed up-to-N exception is honored');
got = result({ commanders: [commander], cards: [{ def: dwarves, qty: 8 }] });
assert.ok(got.messages.some(m => m.includes('Seven Dwarves appears 8 times')));

const rats = { name: 'Rat Colony', oracle: 'A deck can have any number of cards named Rat Colony.' };
got = result({ commanders: [commander], cards: [{ def: rats, qty: 30 }] });
assert.equal(got.messages.some(m => m.includes('Rat Colony appears')), false, 'any-number exception is honored');

got = result({ commanders: [commander], cards: [{ def: { name: 'Plains', type: 'Basic Land', ci: ['W'] }, qty: 20 }] });
assert.equal(got.messages.some(m => m.includes('Plains appears')), false, 'basic lands are exempt from duplicate notes');

got = result({ commanders: [commander], cards: [card('Sol Ring'), card('Sol Ring')] });
assert.ok(got.messages.some(m => m.includes('Sol Ring appears 2 times')), 'duplicate printings group by card name');
console.log('PASS deck health: commander-inclusive count, missing commander, combined identity, duplicate grouping and exemptions');
