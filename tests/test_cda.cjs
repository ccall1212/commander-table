/* Automatic checks for power/toughness defined by a count (js/cda.js, v0.86.0). Run: node tests/test_cda.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx0 = { window: {} };
vm.createContext(ctx0);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/cda.js'), 'utf8'), ctx0);
const C = ctx0.window.CTCda;
const plain = v => JSON.parse(JSON.stringify(v));
const p = (o, n) => plain(C.parse(o, n));

// ---- Reading real card wordings ----
let r = p("Bronze Guardian's power is equal to the number of artifacts you control.", 'Bronze Guardian');
assert.deepEqual(r.power.terms, [{ zone: 'battlefield', who: 'you', types: ['artifact'] }]); assert.equal(r.toughness, null, 'power only');
r = p("Master of Etherium's power and toughness are each equal to the number of artifacts you control.", 'Master of Etherium');
assert.ok(r.power && r.toughness, 'both');
r = p("Avalanche of Sector 7's power is equal to the number of artifacts your opponents control.", 'Avalanche of Sector 7');
assert.equal(r.power.terms[0].who, 'opp');
r = p("Adeline's power is equal to the number of creatures you control.", 'Adeline, Resplendent Cathar'); assert.deepEqual(r.power.terms[0].types, ['creature'], 'the short name before the comma');
r = p("Mortivore's power and toughness are each equal to the number of creature cards in all graveyards.", 'Mortivore');
assert.deepEqual(r.power.terms[0], { zone: 'graveyard', who: 'all', types: ['creature'] });
r = p("Splinterfright's power and toughness are each equal to the number of creature cards in your graveyard.", 'Splinterfright'); assert.equal(r.power.terms[0].who, 'you');
r = p("Consuming Aberration's power and toughness are each equal to the number of cards in your opponents' graveyards.", 'Consuming Aberration');
assert.deepEqual(r.power.terms[0], { zone: 'graveyard', who: 'opp' });
r = p("Lord of Extinction's power and toughness are each equal to the number of cards in all graveyards.", 'Lord of Extinction'); assert.equal(r.power.terms[0].zone, 'graveyard');
r = p("Spellheart Chimera's power is equal to the number of instant and sorcery cards in your graveyard.", 'Spellheart Chimera'); assert.deepEqual(r.power.terms[0].types, ['instant', 'sorcery']);
r = p("Boneyard Mycodrax's power and toughness are each equal to the number of other creature cards in your graveyard.", 'Boneyard Mycodrax'); assert.equal(r.power.terms[0].other, true);
r = p("Psychosis Crawler's power and toughness are each equal to the number of cards in your hand.", 'Psychosis Crawler'); assert.deepEqual(r.power.terms[0], { zone: 'hand', who: 'you' });
r = p("Serra Avatar's power and toughness are each equal to your life total.", 'Serra Avatar'); assert.deepEqual(r.power.terms[0], { zone: 'life', who: 'you' });
r = p("Majestic Myriarch's power and toughness are each equal to twice the number of creatures you control.", 'Majestic Myriarch'); assert.equal(r.power.mult, 2);
r = p("Abomination of Llanowar's power and toughness are each equal to the number of Elves you control plus the number of Elf cards in your graveyard.", 'Abomination of Llanowar');
assert.equal(r.power.terms.length, 2); assert.deepEqual(r.power.terms[0].tribes, ['Elves']); assert.equal(r.power.terms[1].zone, 'graveyard');
r = p("Soulless One's power and toughness are each equal to the number of Zombies on the battlefield plus the number of Zombie cards in all graveyards.", 'Soulless One'); assert.equal(r.power.terms[0].who, 'all');
r = p("Nighthawk Scavenger's power is equal to 1 plus the number of card types among cards in your opponents' graveyards.", 'Nighthawk Scavenger'); assert.equal(r.power.plus, 1); assert.equal(r.power.terms[0].distinctTypes, true);
r = p("Barrowgoyf's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1.", 'Barrowgoyf'); assert.equal(r.toughness.plus, 1); assert.equal(r.power.plus, 0);
r = p("Lhurgoyf's power is equal to the number of creature cards in all graveyards and its toughness is equal to that number plus 1.", 'Lhurgoyf'); assert.equal(r.toughness.plus, 1);
r = p("Wintermoor Commander's toughness is equal to the number of Knights you control.", 'Wintermoor Commander'); assert.equal(r.power, null); assert.deepEqual(r.toughness.terms[0].tribes, ['Knights']);
r = p("Uchuulon's power is equal to the number of Crabs, Oozes, and/or Horrors you control.", 'Uchuulon'); assert.deepEqual(r.power.terms[0].tribes, ['Crabs', 'Oozes', 'Horrors']);
r = p("Wilderness Elemental's power is equal to the number of nonbasic lands your opponents control.", 'Wilderness Elemental'); assert.equal(r.power.terms[0].nonbasic, true);
r = p("Strange new worlds — Lt. Arex's power and toughness are each equal to the number of differently named lands you control.", 'Lt. Arex, Ever-Adapting'); assert.equal(r.power.terms[0].distinctNames, true, 'with an ability word first');
r = p("Ixidron's power and toughness are each equal to the number of face-down creatures on the battlefield.", 'Ixidron'); assert.equal(r.power.terms[0].faceDown, true);
r = p("This creature's power and toughness are each equal to the number of lands you control.", 'Whatever'); assert.equal(r.power.terms[0].types[0], 'land', '"This creature\'s"');
// Left alone: things the game cannot see.
for (const x of ["Drove of Elves's power and toughness are each equal to the number of green permanents you control.", "Dodgy Jalopy's power is equal to the greatest mana value among creatures you control.", "Archpriest of Iona's power is equal to the number of creatures in your party.",
  "Sewer Nemesis's power and toughness are each equal to the number of cards in the chosen player's graveyard.", "Living Lore's power and toughness are each equal to the exiled card's mana value.", "Bell Borca's power is equal to the greatest number noted for it this turn.",
  "Crackling Drake's power is equal to the total number of instant and sorcery cards you own in exile and in your graveyard.", 'When this creature enters, it gets +1/+1 until end of turn.', '']) assert.equal(C.parse(x, x.split("'")[0]), null, 'left alone: ' + x);

// ---- A pump per counted thing ("gets +1/+1 for each …") ----
let b = p("Trample\nThis creature gets +1/+1 for each creature you control and each creature card in your graveyard.", 'Moon-Vigil Adherents').bonus;
assert.deepEqual([b.a, b.b, b.amount.terms.length], [1, 1, 2], 'Moon-Vigil Adherents: creatures you control plus creature cards in your graveyard');
assert.equal(b.amount.terms[1].zone, 'graveyard');
b = p("Foo gets +2/+0 for each artifact you control.", 'Foo').bonus; assert.deepEqual([b.a, b.b], [2, 0], 'a power-only pump per artifact');
b = p("This creature gets -1/-1 for each card in your hand.", 'Bar').bonus; assert.deepEqual([b.a, b.b], [-1, -1], 'a shrink');
b = p("This creature gets +X/+X, where X is the number of Elves you control.", 'Baz').bonus; assert.deepEqual([b.a, b.b], [1, 1], '+X/+X where X is the number of …');
b = p("This creature gets +X/+0, where X is your life total.", 'Baz').bonus; assert.deepEqual([b.a, b.b], [1, 0], '+X/+0 where X is your life total');
assert.equal(C.parse("This creature gets +1/+1 for each other creature you control that shares a creature type with it.", 'Q'), null, 'a wording we cannot count is left alone');
assert.equal(C.parse("This creature gets +1/+1 until end of turn for each creature you control.", 'Q'), null, 'temporary: left alone');
assert.equal(plain(C.parse("This creature gets +1/+1 for each creature you control.", 'Q')).power, null, 'a pump is not a base');
assert.equal(plain(C.clean(plain(C.parse("This creature gets +1/+1 for each creature you control.", 'Q')))).bonus.a, 1, 'published definitions keep it');
assert.equal(C.clean({ bonus: { a: 99, b: 1, amount: { terms: [{ zone: 'battlefield', who: 'you' }] } } }), null, 'an absurd pump is dropped');
assert.deepEqual(plain(C.parseEach('creature you control and each creature card in your graveyard').terms.map(t => t.zone)), ['battlefield', 'graveyard']);
assert.deepEqual(plain(C.parseEach('charge counter on this Equipment').terms[0]), { zone: 'self', who: 'you', counter: 'charge' }, 'counters on the card itself');
assert.deepEqual(plain(C.parseEach('counter on this Equipment').terms[0]), { zone: 'self', who: 'you', counter: 'any' });
assert.deepEqual(plain(C.parseEach('+1/+1 counter on this Equipment').terms[0]), { zone: 'self', who: 'you', counter: '+1/+1' });
assert.deepEqual(plain(C.parseEach('Aura and Equipment attached to it').terms[0]), { zone: 'attached', who: 'all', tribes: ['Aura', 'Equipment'] }, 'Kor Spiritdancer / Strong Back');
assert.deepEqual(plain(C.parseEach('Aura attached to it').terms[0].tribes), ['Aura']);
assert.deepEqual(plain(C.parseEach('opponent you have').terms[0]), { zone: 'opponents', who: 'opp' }, 'Blazing Sunsteel');
assert.equal(plain(C.parseEach('other creature you control with a +1/+1 counter on it').terms[0]).withCounter, '+1/+1', 'High Sentinels of Arashin');
assert.equal(C.parseEach('color among permanents you control'), null, 'colours are not known');
assert.equal(C.parse('Tuvasa gets +1/+1 for each enchantment you control.', 'Tuvasa the Sunlit').bonus.a, 1, 'a name that Oracle text shortens to its first word');
assert.equal(C.parse('Bonehoard gets +1/+1 for each enchantment you control.', 'Bonehoard, Thing').bonus.a, 1);

// ---- Counting on boards ----
const card = (iid, extra) => Object.assign({ iid }, extra);
const e = (iid, type, name, extra) => ({ c: card(iid, extra), def: { name: name || iid, type } });
const boards = [
  { pid: 'A', hand: 3, life: 20, battlefield: [e('a1', 'Artifact Creature — Golem', 'Guardian'), e('a2', 'Artifact — Equipment'), e('l1', 'Basic Land — Forest', 'Forest'), e('l2', 'Basic Land — Island', 'Island'), e('l3', 'Land', 'Command Tower'), e('c1', 'Creature — Elf Warrior', 'Elf'), e('c2', 'Creature — Elf', 'Elf 2'), e('fd', '', '', { fd: 1 })],
    graveyard: [e('g1', 'Creature — Elf', 'Dead Elf'), e('g2', 'Instant', 'Bolt'), e('g3', 'Sorcery', 'Wrath'), e('g4', 'Land', 'Dead Land')] },
  { pid: 'B', hand: 5, life: 33, battlefield: [e('b1', 'Artifact', 'Rock'), e('b2', 'Artifact', 'Rock 2'), e('b3', 'Land', 'Utility Land'), e('b4', 'Basic Land — Forest'), e('b5', 'Creature — Zombie')],
    graveyard: [e('h1', 'Artifact Creature — Golem'), e('h2', 'Enchantment')] }
];
const val = (oracle, name, pid, iid) => { const x = C.parse(oracle, name); return { p: x.power ? C.evaluate(x.power, { boards, pid, iid }) : null, t: x.toughness ? C.evaluate(x.toughness, { boards, pid, iid }) : null }; };
assert.deepEqual(val("Bronze Guardian's power is equal to the number of artifacts you control.", 'Bronze Guardian', 'A', 'a1'), { p: 2, t: null }, 'two artifacts (the Guardian itself and the Equipment)');
assert.equal(val("Avalanche's power is equal to the number of artifacts your opponents control.", 'Avalanche', 'A', 'x').p, 2, 'the opponent has two artifacts');
assert.equal(val("Avalanche's power is equal to the number of artifacts your opponents control.", 'Avalanche', 'B', 'x').p, 2, 'seen from the other seat: Player A has 2 artifacts');
assert.equal(val("X's power and toughness are each equal to the number of lands you control.", 'X', 'A', 'x').p, 3);
assert.equal(val("X's power and toughness are each equal to the number of creatures you control.", 'X', 'A', 'x').p, 4, 'Guardian, two Elves and the face-down creature');
assert.equal(val("X's power is equal to the number of creatures you control.", 'X', 'B', 'x').p, 1);
assert.equal(val("X's power and toughness are each equal to the number of creature cards in all graveyards.", 'X', 'A', 'x').p, 2, 'Dead Elf and the Golem in the other graveyard');
assert.equal(val("X's power and toughness are each equal to the number of creature cards in your graveyard.", 'X', 'A', 'x').p, 1);
assert.equal(val("X's power and toughness are each equal to the number of cards in your opponents' graveyards.", 'X', 'A', 'x').p, 2);
assert.equal(val("X's power and toughness are each equal to the number of cards in all graveyards.", 'X', 'A', 'x').p, 6);
assert.equal(val("X's power is equal to the number of instant and sorcery cards in your graveyard.", 'X', 'A', 'x').p, 2);
assert.equal(val("X's power and toughness are each equal to the number of cards in your hand.", 'X', 'A', 'x').p, 3);
assert.equal(val("X's power and toughness are each equal to your life total.", 'X', 'B', 'x').p, 33);
assert.equal(val("X's power and toughness are each equal to twice the number of creatures you control.", 'X', 'B', 'x').p, 2);
assert.equal(val("X's power and toughness are each equal to the number of Elves you control plus the number of Elf cards in your graveyard.", 'X', 'A', 'x').p, 3, 'two Elves plus one Elf card');
assert.deepEqual(val("X's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1.", 'X', 'A', 'x'), { p: 6, t: 7 }, 'creature, instant, sorcery, land, artifact, enchantment');
assert.equal(val("X's power is equal to 1 plus the number of card types among cards in your opponents' graveyards.", 'X', 'A', 'x').p, 4, 'artifact, creature and enchantment among the opponent\'s two cards: 3 types + 1');
assert.equal(val("X's power and toughness are each equal to the number of nonbasic lands your opponents control.", 'X', 'A', 'x').p, 1);
assert.equal(val("X's power and toughness are each equal to the number of differently named lands you control.", 'X', 'A', 'x').p, 3);
assert.equal(val("X's power and toughness are each equal to the number of face-down creatures on the battlefield.", 'X', 'A', 'x').p, 1);
assert.equal(val("X's power and toughness are each equal to the number of Forests you control.", 'X', 'A', 'x').p, 1, 'a land type');
assert.equal(val("X's power and toughness are each equal to the number of other creatures you control.", 'X', 'A', 'c1').p, 3, '"other" leaves the card itself out');
const bonusOf = (oracle, name, pid, iid) => C.evaluateBonus(C.parse(oracle, name).bonus, { boards, pid, iid });
assert.deepEqual(plain(bonusOf("This creature gets +1/+1 for each creature you control and each creature card in your graveyard.", 'M', 'A', 'x')), { dp: 5, dt: 5 }, '4 creatures on the battlefield + 1 creature card in the graveyard');
assert.deepEqual(plain(bonusOf("M gets +2/+0 for each artifact you control.", 'M', 'A', 'x')), { dp: 4, dt: 0 });
assert.deepEqual(plain(bonusOf("M gets +1/+1 for each card in your hand.", 'M', 'B', 'x')), { dp: 5, dt: 5 });
// Counters on the card itself, attachments, opponents.
const pump = (txt, pid, iid, bs) => C.evaluateBonus(C.parse(txt, 'M').bonus, { boards: bs || boards, pid, iid });
const sword = e('sw', 'Artifact \u2014 Equipment', 'Sword', { c: { Charge: 3, '+1/+1': 1 }, att: { p: 'A', i: 'c1' } });
const aura = e('au', 'Enchantment \u2014 Aura', 'Aura', { att: { p: 'A', i: 'c1' } });
const bs2 = [{ pid: 'A', hand: 0, life: 20, battlefield: [e('c1', 'Creature \u2014 Elf', 'Elf'), sword, aura, e('c2', 'Creature \u2014 Elf', 'Elf 2', { c: { '+1/+1': 1 } }), e('c3', 'Creature \u2014 Elf', 'Elf 3', { c: { '+1/+1': 2 } })], graveyard: [] }, { pid: 'B', hand: 0, life: 40, battlefield: [], graveyard: [] }, { pid: 'C', hand: 0, life: 40, battlefield: [], graveyard: [] }];
assert.deepEqual(plain(pump('M gets +1/+1 for each charge counter on this Equipment.', 'A', 'sw', bs2)), { dp: 3, dt: 3 }, 'three charge counters on the Equipment');
assert.deepEqual(plain(pump('M gets +1/+1 for each counter on this Equipment.', 'A', 'sw', bs2)), { dp: 4, dt: 4 }, 'any counter');
assert.deepEqual(plain(pump('M gets +2/+2 for each Aura and Equipment attached to it.', 'A', 'c1', bs2)), { dp: 4, dt: 4 }, 'one Aura and one Equipment are attached to the first Elf');
assert.deepEqual(plain(pump('M gets +2/+2 for each Aura and Equipment attached to it.', 'A', 'c2', bs2)), { dp: 0, dt: 0 }, 'nothing attached to another creature');
assert.deepEqual(plain(pump('M gets +1/+1 for each opponent you have.', 'A', 'c1', bs2)), { dp: 2, dt: 2 }, 'two opponents');
assert.deepEqual(plain(pump('M gets +1/+1 for each other creature you control with a +1/+1 counter on it.', 'A', 'c1', bs2)), { dp: 2, dt: 2 }, 'two other creatures have a +1/+1 counter');
assert.deepEqual(plain(pump('M gets +1/+1 for each creature you control with a +1/+1 counter on it.', 'A', 'c2', bs2)), { dp: 2, dt: 2 }, 'including itself when it is not "other"');
// Published definitions are validated.
const pub = plain(C.parse("Bronze Guardian's power is equal to the number of artifacts you control.", 'Bronze Guardian'));
assert.deepEqual(plain(C.clean(pub)).power.terms[0].types, ['artifact']);
assert.equal(C.clean('nonsense'), null); assert.equal(C.clean({ power: { terms: [{ zone: 'nope', types: ['evil'] }], mult: 99, plus: -3 } }).power.mult, 1, 'absurd multiplier dropped');
assert.deepEqual(plain(C.clean({ power: { terms: [{ zone: 'graveyard', who: 'all', types: ['evil', 'creature'] }], mult: 1, plus: 0 } }).power.terms[0].types), ['creature']);
// Neo Exdeath (the back of Exdeath, Void Warlock): "permanent cards" in your graveyard are everything but instants and sorceries; its name is not the front's
assert.equal(val("Trample\nNeo Exdeath's power is equal to the number of permanent cards in your graveyard.", "Neo Exdeath, Dimension's End", 'A', 'x').p, 2, 'Dead Elf and Dead Land count; Bolt and Wrath do not');
assert.equal(val("Trample\nNeo Exdeath's power is equal to the number of permanent cards in your graveyard.", "Neo Exdeath, Dimension's End", 'B', 'x').p, 2, "the other player's Golem and Enchantment");
assert.equal(C.clean(C.parse("Neo Exdeath's power is equal to the number of permanent cards in your graveyard.", 'Neo Exdeath')).power.terms[0].perm, true, 'another player gets the same count');
console.log('PASS cda: counted power/toughness is read from real card wordings and counted on boards; things the game cannot see are left alone');
