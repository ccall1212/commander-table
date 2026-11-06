/* Automatic checks for abilities granted to other creatures (js/grants.js). Run: node tests/test_grants.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/grants.js'), 'utf8'), ctx);
const G = ctx.window.CTGrants;
const abil = o => G.parse(o).map(g => g.abilities.join('+')).join('|');

assert.equal(abil('Creatures you control with +1/+1 counters on them have reach and trample.'), 'reach+trample', 'plural wording without an article');
assert.equal(abil('Creatures you control with a charge counter on them have haste.'), 'haste', 'another named counter');
assert.equal(abil('Each creature you control with a +1/+1 counter on it has reach and trample.'), 'reach+trample', 'Sphere Grid wording');
assert.equal(abil('Creatures you control with a +1/+1 counter on them have reach and trample.'), 'reach+trample');
assert.equal(abil('Creatures you control have haste.'), 'haste');
assert.equal(abil('Other Dragons you control have flying.'), 'flying');
assert.equal(abil('Elves you control have vigilance and lifelink.'), 'vigilance+lifelink');
assert.equal(abil('Legendary creatures you control have hexproof, indestructible, and menace.'), 'hexproof+indestructible+menace');
assert.equal(abil('Creatures you control get +1/+1.'), '', 'power/toughness anthems are not grants (phase 2)');
assert.equal(abil('Creatures your opponents control have defender.'), '', 'opponents\' creatures are not handled');
assert.equal(abil('Creatures you control have ward {2}.'), '', 'abilities without an icon are left alone');
assert.equal(abil('Target creature you control gains flying until end of turn.'), '', 'targeted/temporary effects are left alone');
assert.equal(abil('When this enters, creatures you control with a +1/+1 counter on them have reach.'), '', 'a trigger is not a static grant');
assert.equal(abil('Whenever a creature enters, put a +1/+1 counter on it.'), '');
assert.equal(abil('Sphere Grid — Each creature you control with a +1/+1 counter on it has reach and trample. (reminder)'), 'reach+trample', 'a leading ability word is fine');

// Applying to a board.
const sphere = { id: 's', face: 'Sphere Grid', type: 'Enchantment', oracle: 'Each creature you control with a +1/+1 counter on it has reach and trample.' };
const bear = { id: 'b', face: 'Bear', type: 'Creature — Bear', oracle: '' };
const dragon = { id: 'd', face: 'Drake', type: 'Legendary Creature — Dragon', oracle: 'Other Dragons you control have flying.' };
const elf = { id: 'e', face: 'Elf', type: 'Creature — Elf Warrior', oracle: '' };
const e = (iid, def, extra) => ({ c: Object.assign({ iid, c: {}, t: 0 }, extra), def });
let m = G.forBoard([e('1', sphere), e('2', bear, { c: { '+1/+1': 2 } }), e('3', bear), e('4', sphere)]);
assert.deepEqual(Array.from(m.keys()), ['2'], 'only the creature with a +1/+1 counter, not the enchantment or the plain bear');
assert.equal(m.get('2').map(x => x.id).join(), 'reach,trample'); assert.equal(m.get('2')[0].from, 'Sphere Grid');
m = G.forBoard([e('1', sphere), e('2', bear, { c: { '-1/-1': 1 } })]);
assert.equal(m.size, 0, 'a -1/-1 counter does not count as +1/+1');
// "Other": the source itself is excluded; tribes match by plural.
m = G.forBoard([e('1', dragon), e('2', dragon), e('3', elf)]);
assert.deepEqual(Array.from(m.keys()).sort(), ['1', '2'], 'each Dragon gets flying from the other, never from itself alone');
m = G.forBoard([e('1', dragon)]); assert.equal(m.size, 0, 'a lone Dragon does not give itself flying');
const elves = { id: 'x', face: 'Elf Lord', type: 'Creature — Elf', oracle: 'Elves you control have vigilance.' };
m = G.forBoard([e('1', elves), e('2', elf), e('3', bear)]); assert.deepEqual(Array.from(m.keys()).sort(), ['1', '2'], 'plural Elves matches the Elf type (and the lord itself)');
// Face-down cards give and get nothing; published grants are validated.
m = G.forBoard([e('1', sphere), e('2', bear, { c: { '+1/+1': 1 }, fd: 1 })]); assert.equal(m.size, 0);
const pub = { id: 'p', face: 'Pub', type: 'Enchantment', gr: G.parse(sphere.oracle) };
m = G.forBoard([e('1', pub), e('2', bear, { c: { '+1/+1': 1 } })]); assert.equal(m.get('2').length, 2, 'a published definition carries its grants');
assert.equal(G.clean([{ other: false, filters: { creature: true }, abilities: ['flying', 'evil'] }])[0].abilities.join(), 'flying', 'unknown abilities are dropped');
assert.equal(G.clean('nonsense').length, 0); assert.equal(G.clean([{ abilities: ['nope'] }]).length, 0);
console.log('PASS grants: simple "you control … have …" lines are read; they apply by type, tribe, condition, other; anything else is left alone');
