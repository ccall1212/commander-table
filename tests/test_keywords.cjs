/* Automatic checks for the printed-keyword reader (js/keywords.js). Run: node tests/test_keywords.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/keywords.js'), 'utf8'), ctx);
const K = ctx.window.CTKeywords;
const get = (o, t) => K.fromOracle(o, t).join(',');

assert.equal(get('Vigilance\nWhenever Kimarhri attacks, draw a card.', 'Creature — Dragon'), 'vigilance', 'a keyword as the first word');
assert.equal(get('Flying, vigilance, lifelink\nWhen this enters, gain 2 life.', 'Creature — Angel'), 'flying,vigilance,lifelink', 'several on one line');
assert.equal(get('Flying\nLifelink\nWhenever you gain life, scry 1.', 'Creature'), 'flying,lifelink', 'one per line');
assert.equal(get('Trample (This creature can assign excess combat damage to the player.)\nHaste', 'Creature'), 'trample,haste', 'reminder text in brackets is ignored');
assert.equal(get('Flash\nFlying\nWard {2}', 'Creature'), 'flying', 'flash and ward are skipped, not turned on');
assert.equal(get('Whenever you cast a spell, draw a card.\nFlying', 'Creature'), '', 'a keyword that only appears later is not at the beginning');
assert.equal(get('Hexproof from black\nFlying', 'Creature'), 'flying', 'hexproof from a colour is not plain hexproof');
assert.equal(get('Protection from red\nHexproof', 'Creature'), 'hexproof');
assert.equal(get('Double strike\nFirst strike', 'Creature'), 'double strike,first strike');
assert.equal(get('Destroy target creature.', 'Instant'), '');
assert.equal(get('', 'Creature'), '');
// Sagas (Summon: creatures) list their abilities after the chapters.
assert.equal(get('(As this Saga enters and after your draw step, add a lore counter.)\nI — Draw a card.\nII — Gain 2 life.\nIII — Destroy target creature.\nFirst Strike', 'Enchantment Creature — Saga Knight'), 'first strike', 'Summon: Ixion');
assert.equal(get('I — Draw a card.\nII — Gain 2 life.\nFlying\nHaste', 'Enchantment Creature — Saga'), 'flying,haste');
assert.equal(get('I — Create a token.\nII — Draw a card.', 'Enchantment — Saga'), '', 'an ordinary Saga has none');
// Double-faced: only the front face counts.
assert.equal(get('Flying\n—\nVigilance', 'Creature'), 'flying');
console.log('PASS keywords: printed keywords at the start (or end of a Saga) are read; skipped keywords, "from" variants and later lines are not');
