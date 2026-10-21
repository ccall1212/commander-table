'use strict';

const assert = require('node:assert/strict');
global.window = {};
require('../js/mulligan.js');
const { CAP, MAX_EXTRA, normalizeMode, extraLimit, limit, canMulligan, bottomCount, canKeep, isLand, landCount, deal } = window.CTMulligan;

const defs = {
  land: { type: 'Basic Land — Island' },
  spell: { type: 'Instant' },
  frontSpellLandBack: { type: 'Sorcery', backType: 'Land — Forest' },
  frontLand: { type: 'Land — Forest', backType: 'Creature — Human' }
};
const cards = ids => ids.map((id, i) => ({ id, iid: String(i) }));
assert.equal(normalizeMode('broken'), 'london');
assert.equal(CAP, 7);
assert.equal(canMulligan(6), true);
assert.equal(canMulligan(7), false);
assert.equal(limit('three-lands'), 1, 'alternate rules start with one mulligan');
assert.equal(limit('ten-bottom-three'), 1);
assert.equal(canMulligan(0, 'three-lands'), true);
assert.equal(canMulligan(1, 'three-lands'), false);
assert.equal(limit('three-lands', 2), 3, 'each host grant adds one attempt');
assert.equal(canMulligan(1, 'ten-bottom-three', 1), true);
assert.equal(canMulligan(2, 'ten-bottom-three', 1), false);
assert.equal(extraLimit(999), MAX_EXTRA, 'host grants are bounded');
assert.equal(extraLimit(-2), 0);
assert.equal(bottomCount('london', 0, 7), 0);
assert.equal(bottomCount('london', 7, 7), 6);
assert.equal(bottomCount('london', 99, 7), 6, 'legacy excessive mulligan counts respect the cap');
assert.equal(bottomCount('three-lands', 6, 7), 0);
assert.equal(bottomCount('ten-bottom-three', 6, 10), 3);
assert.equal(bottomCount('ten-bottom-three', 6, 2), 1, 'short hands keep at least one card');
assert.equal(canKeep('three-lands', 2, 30, 0), false);
assert.equal(canKeep('three-lands', 2, 30, 1), true, 'default mulligan limit always permits keeping');
assert.equal(canKeep('three-lands', 2, 2, 0), true, 'an impossible deck can keep immediately');
assert.equal(canKeep('three-lands', 2, 30, 1 + MAX_EXTRA, MAX_EXTRA), true, 'the largest granted limit permits keeping');
assert.equal(isLand({ id: 'frontSpellLandBack' }, defs), false, 'a land back face does not count');
assert.equal(isLand({ id: 'frontLand' }, defs), true);
assert.equal(landCount(cards(['land', 'frontSpellLandBack', 'frontLand']), defs), 2);

const londonLibrary = cards(['land', 'spell', 'land', 'spell', 'land', 'spell', 'spell', 'spell', 'spell', 'spell', 'spell']);
assert.equal(deal(londonLibrary, defs, 'london').hand.length, 7);
assert.equal(londonLibrary.length, 4);

const tenLibrary = cards(Array.from({ length: 12 }, (_, i) => i % 2 ? 'spell' : 'land'));
assert.equal(deal(tenLibrary, defs, 'ten-bottom-three').hand.length, 10);
assert.equal(tenLibrary.length, 2);
const shortTen = cards(['land', 'spell']);
assert.equal(deal(shortTen, defs, 'ten-bottom-three').hand.length, 2);
assert.equal(shortTen.length, 0);

const threeLibrary = cards(['spell', 'land', 'spell', 'frontSpellLandBack', 'land', 'spell', 'land', 'spell', 'spell', 'spell']);
const three = deal(threeLibrary, defs, 'three-lands');
assert.equal(three.fallback, false);
assert.equal(landCount(three.hand, defs), 3);
assert.equal(three.hand.length, 7);
assert.equal(threeLibrary.length, 3);
assert.equal(new Set([...three.hand, ...threeLibrary]).size, 10, 'dealing preserves every card once');

const landHeavy = cards(['land', 'land', 'land', 'land', 'land', 'land', 'land', 'land', 'spell', 'spell']);
const heavyHand = deal(landHeavy, defs, 'three-lands').hand;
assert.equal(heavyHand.length, 7, 'the four additional cards come from the remaining deck');
assert.equal(landCount(heavyHand, defs) >= 3, true);

const impossible = cards(['frontSpellLandBack', 'spell', 'spell', 'spell', 'spell', 'spell', 'spell', 'spell']);
const fallback = deal(impossible, defs, 'three-lands');
assert.equal(fallback.fallback, true);
assert.equal(fallback.hand.length, 7);
assert.equal(landCount(fallback.hand, defs), 0);
assert.equal(impossible.length, 1);

const smallDeck = cards(['land', 'land', 'spell', 'spell']);
const shortLand = deal(smallDeck, defs, 'three-lands');
assert.equal(shortLand.fallback, true);
assert.equal(shortLand.hand.length, 4);
assert.equal(landCount(shortLand.hand, defs), 2);

console.log('mulligan rule checks passed');
