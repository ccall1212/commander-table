/* Unit test for orient.js: which card pictures are printed sideways. Run: node tests/test_orient.cjs */
'use strict';
const assert = require('node:assert/strict');
global.window = {};
require('../js/orient.js');
const O = window.CTOrient;

const wear = { name: 'Wear // Tear', face: 'Wear', type: 'Instant', oracle: 'Destroy target artifact.\n—\nDestroy target enchantment.\nFuse', img: 'a.jpg', imgBack: null, backName: null };
assert.equal(O.sideways(wear, false), true, 'a split card is sideways');
assert.equal(O.sideways(wear, true), true, 'a flipped single-picture card is still printed sideways (it is just turned over)');
assert.equal(O.sideways({ name: 'Fire // Ice', type: 'Instant', oracle: 'x', img: 'a' }, false), true, 'heuristic for saved cards without a layout: two spells');
assert.equal(O.sideways({ name: 'Dazzling Theater // Prop Room', type: 'Enchantment — Room', oracle: 'x', img: 'a' }, false), true, 'a Room is sideways');
assert.equal(O.sideways({ name: 'Commit // Memory', type: 'Instant', oracle: 'Put target spell…\n—\nAftermath (Cast this spell only from your graveyard.)', img: 'a' }, false), false, 'Aftermath is half upright, so it is left alone');
assert.equal(O.sideways({ name: 'Bonecrusher Giant // Stomp', type: 'Creature — Giant', oracle: 'x', img: 'a' }, false), false, 'an Adventure is upright');
assert.equal(O.sideways({ name: 'Treasure Map // Treasure Cove', type: 'Artifact', backName: 'Treasure Cove', imgBack: 'b', img: 'a' }, false), false, 'a double-faced card is upright');
assert.equal(O.sideways({ name: 'Barkchannel Pathway // Tidechannel Pathway', type: 'Land', backName: 'Tidechannel Pathway', imgBack: 'b', img: 'a' }, false), false, 'a Pathway is upright');
assert.equal(O.sideways({ name: 'Lightning Bolt', type: 'Instant', oracle: 'x', img: 'a' }, false), false, 'an ordinary card is upright');
assert.equal(O.sideways(null, false), false);
const battle = { name: 'Invasion of Zendikar // Awakened Skyclave', type: 'Battle — Siege', backName: 'Awakened Skyclave', imgBack: 'b', img: 'a' };
assert.equal(O.sideways(battle, false), true, 'the front of a Battle is sideways');
assert.equal(O.sideways(battle, true), false, 'its back face (a second picture) is upright');
// The exact layout wins over the guess; the published flag wins over everything (other players cannot see the rules text).
assert.equal(O.sideways({ name: 'Weird // Card', type: 'Instant', lay: 'adventure', oracle: '', img: 'a' }, false), false, 'layout says adventure');
assert.equal(O.sideways({ name: 'A // B', type: 'Instant', lay: 'split', oracle: '', img: 'a' }, false), true, 'layout says split');
assert.equal(O.sideways({ name: 'Commit // Memory', type: 'Instant', hz: 0, img: 'a' }, false), false, 'published flag: not sideways');
assert.equal(O.sideways({ name: 'Wear // Tear', type: 'Instant', hz: 1, img: 'a' }, false), true, 'published flag: sideways');
assert.equal(O.frontIsSideways({ name: 'Wear // Tear', hz: 1, imgBack: 'b' }), true);
console.log('PASS orient: split cards, Rooms and Battle fronts are sideways; Aftermath, Adventures, double-faced cards and normal cards are not');
