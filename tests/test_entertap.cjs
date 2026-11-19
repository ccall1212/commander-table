/* Unit test for entertap.js: does a land enter tapped? Run: node tests/test_entertap.cjs */
'use strict';
const assert = require('node:assert/strict');
global.window = {};
require('../js/entertap.js');
const E = window.CTEnterTap;
const basic = t => 'Basic Land — ' + t;
const tapped = (oracle, ctx) => { const r = E.evaluate(oracle, ctx); return r === null ? null : r.tapped; };

// Always tapped, in every wording seen in the pre-con decks.
assert.equal(tapped('This land enters tapped.', {}), true);
assert.equal(tapped('This land enters tapped.\n{T}: Add {B} or {R}.', {}), true, 'with mana abilities after it');
assert.equal(tapped('This land enters tapped. As it enters, choose a color other than green.\n{T}: Add {G}.', {}), true, 'Thriving lands');
assert.equal(tapped('This land enters tapped with two charge counters on it.\nRemove a charge counter from this land: Add one mana of any color.', {}), true, 'Vivid lands');
assert.equal(tapped('Thran Portal enters the battlefield tapped.', { name: 'Thran Portal' }), true, 'an older wording with the card name');
assert.equal(tapped('This land enters tapped. (Reminder text.)', {}), true);
// Nothing here: ordinary lands, and lands that need a choice are left alone.
assert.equal(tapped('{T}: Add {G}.', {}), null, 'an ordinary land');
assert.equal(tapped('As this land enters, you may reveal an Elf card from your hand. If you don\'t, this land enters tapped.', {}), null, 'reveal lands need a choice');
assert.equal(tapped('As The Black Gate enters, you may pay 3 life. If you don\'t, it enters tapped.', { name: 'The Black Gate' }), null, 'pay-life lands need a choice');
assert.equal(tapped('You may have this land enter tapped. If you do, you get two rad counters.', {}), null);
assert.equal(tapped('You may have this land enter tapped as a copy of any land on the battlefield.', {}), null);
assert.equal(tapped('', {}), null); assert.equal(tapped(null, {}), null);
// "…unless you control two or more other lands" (slow land).
const slow = 'This land enters tapped unless you control two or more other lands.';
assert.equal(tapped(slow, { lands: [basic('Forest')] }), true, 'one other land: tapped');
assert.equal(tapped(slow, { lands: [basic('Forest'), basic('Island')] }), false, 'two other lands: untapped');
// "…unless you control two or fewer other lands" (fast land).
const fast = 'This land enters tapped unless you control two or fewer other lands.';
assert.equal(tapped(fast, { lands: [basic('Forest'), basic('Island')] }), false, 'two other lands: untapped');
assert.equal(tapped(fast, { lands: [basic('Forest'), basic('Island'), basic('Swamp')] }), true, 'three other lands: tapped');
assert.equal(tapped(fast, { lands: [] }), false, 'no other lands: untapped');
// Battle land: two or more BASIC lands.
const battle = 'This land enters tapped unless you control two or more basic lands.';
assert.equal(tapped(battle, { lands: [basic('Forest'), 'Land — Forest Island']}), true, 'only one basic: tapped');
assert.equal(tapped(battle, { lands: [basic('Forest'), basic('Island')] }), false);
// Check land: a Plains or an Island (also "an Island or a Swamp" and a single type).
const check = 'This land enters tapped unless you control a Plains or an Island.';
assert.equal(tapped(check, { lands: [basic('Forest')] }), true);
assert.equal(tapped(check, { lands: [basic('Forest'), basic('Island')] }), false);
assert.equal(tapped(check, { lands: ['Land — Plains Forest'] }), false, 'a dual land with the type counts');
assert.equal(tapped('This land enters tapped unless you control an Island or a Swamp.', { lands: [basic('Swamp')] }), false, '"an Island or a Swamp"');
assert.equal(tapped('This land enters tapped unless you control a Plains.', { lands: [basic('Island')] }), true, 'a single type (Castle)');
assert.equal(tapped('This land enters tapped unless you control a Plains.', { lands: [basic('Plains')] }), false);
// "three or more other Forests".
const forests = 'This land enters tapped unless you control three or more other Forests.';
assert.equal(tapped(forests, { lands: [basic('Forest'), basic('Forest')] }), true);
assert.equal(tapped(forests, { lands: [basic('Forest'), basic('Forest'), 'Land — Forest Island'] }), false);
// Opponents.
assert.equal(tapped('This land enters tapped unless you have two or more opponents.', { opponents: 1 }), true);
assert.equal(tapped('This land enters tapped unless you have two or more opponents.', { opponents: 3 }), false);
assert.equal(tapped('This land enters tapped unless your opponents control eight or more lands.', { oppLands: 7 }), true);
assert.equal(tapped('This land enters tapped unless your opponents control eight or more lands.', { oppLands: 8 }), false);
// Backwards wording (Lair of the Hydra).
const lair = 'If you control two or more other lands, this land enters tapped.';
assert.equal(tapped(lair, { lands: [basic('Forest'), basic('Forest')] }), true);
assert.equal(tapped(lair, { lands: [basic('Forest')] }), false);
// A wording this file does not understand is left alone (no guessing).
assert.equal(tapped('This land enters tapped unless you control a legendary creature with a wombat.', { lands: [] }), null);
assert.equal(tapped('As this land enters, you may reveal a Dragon card from your hand. This land enters tapped unless you revealed a Dragon card this way or you control a Dragon.', {}), null);
// A land with an Adventure is recognised so it can be left alone.
assert.equal(E.hasAdventure({ name: 'Zanarkand, Ancient Metropolis // Lasting Fayth', lay: 'adventure' }), true, 'by layout');
assert.equal(E.hasAdventure({ name: 'Zanarkand, Ancient Metropolis // Lasting Fayth', oracle: 'This land enters tapped.\n{T}: Add {G}.\n—\nCreate a 1/1 Hero. (Then exile this card. You may play the land later from exile.)' }), true, 'by the Adventure reminder text (older saved cards)');
assert.equal(E.hasAdventure({ name: 'Barren Moor', oracle: 'This land enters tapped.' }), false);
assert.equal(E.hasAdventure({ name: 'Wear // Tear', oracle: 'Destroy target artifact.\n—\nDestroy target enchantment.' }), false, 'a split card is not an Adventure');
assert.equal(E.hasAdventure(null), false);
console.log('PASS entertap: lands that always enter tapped, the conditional wordings the game can check, and the ones left alone');
