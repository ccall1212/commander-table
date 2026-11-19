/* Automatic checks for the granted power/toughness and the newer grant shapes (js/grants.js, v0.85.0). Run: node tests/test_grants_pt.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/grants.js'), 'utf8'), ctx);
const G = ctx.window.CTGrants;
const plain = v => JSON.parse(JSON.stringify(v));
const one = (o, name) => plain(G.parse(o, name))[0] || null;
const desc = (o, name) => plain(G.parse(o, name)).map(g => [g.scope, g.abilities.join('+') || '-', g.pt ? (g.pt.dp >= 0 ? '+' : '') + g.pt.dp + '/' + (g.pt.dt >= 0 ? '+' : '') + g.pt.dt : '', g.base || ''].filter(Boolean).join(' ')).join(' | ');

// ---- 1. Auras and Equipment: abilities plus power/toughness, base power/toughness (frogs), extra clauses ignored ----
assert.equal(desc('Enchanted creature gets +2/+2, has flying, and can\'t attack you or planeswalkers you control.'), 'attached flying +2/+2', 'Vow of Flight');
assert.equal(desc('Equipped creature gets +2/+2, has haste, can\'t attack you or planeswalkers you control, and can\'t be sacrificed.'), 'attached haste +2/+2', 'Assault Suit');
assert.equal(desc('Equipped creature can\'t be blocked and has shroud.'), 'attached shroud', 'Whispersilk Cloak');
assert.equal(desc('Enchanted creature is legendary, gets +1/+1, and has flying, vigilance, and lifelink.'), 'attached flying+vigilance+lifelink +1/+1', 'On Serra\'s Wings');
assert.equal(desc('Enchanted creature gets +4/+4, has flying and first strike, and is an Angel in addition to its other types.'), 'attached flying+first strike +4/+4', 'Angelic Destiny');
assert.equal(desc('Enchanted creature gets +10/+10 and has trample and annihilator 2.'), 'attached trample +10/+10', 'Eldrazi Conscription: the ability without an icon is skipped');
assert.equal(desc('Enchanted creature gets +1/+0 and has lifelink and ward {2}.'), 'attached lifelink +1/+0', 'Sheltered by Ghosts');
assert.equal(desc('Equipped creature gets +2/+2 and has infect.'), 'attached - +2/+2', 'Grafted Exoskeleton: only the bonus (infect has no icon)');
assert.equal(desc('Enchanted creature has base power and toughness 9/10 and has indestructible.'), 'attached indestructible 9/10', 'Almost Perfect');
assert.equal(desc('Enchanted creature is an Insect artifact creature with base power and toughness 0/1 and has indestructible, and it loses all other abilities, card types, and creature types.'), 'attached indestructible 0/1', 'Darksteel Mutation');
assert.equal(desc('Enchanted creature loses all abilities and is a blue Frog with base power and toughness 1/1.'), 'attached - 1/1', 'a frog Aura: base power/toughness only');
assert.equal(desc('Equipped creature has base power and toughness 9/9 and has flying.'), 'attached flying 9/9', 'Hulkbuster Armor');
assert.equal(desc('Enchanted creature is a black Dragon with base power and toughness 4/2, has flying and deathtouch, and is goaded.'), 'attached flying+deathtouch 4/2', 'Eye of Nidhogg');
assert.equal(desc('Enchanted creature gets -2/-1.'), 'attached - -2/-1', 'a negative change');
assert.equal(desc('Enchanted creature gets −2/−1.'), 'attached - -2/-1', 'with the real minus sign');
assert.equal(desc('Enchanted creature gets +1/+1 for each Elf you control and has reach.'), 'attached reach', 'Crown of Skemfar: dynamic bonus left to the player, ability kept');
assert.equal(desc('Equipped creature gets +1/+1 for each charge counter on this Equipment and has vigilance.'), 'attached vigilance', 'Mace of the Valiant');
assert.equal(desc('Equipped creature gets +X/+0 where X is the exiled card\'s power and has menace.'), 'attached menace', 'a +X bonus is not read');
assert.equal(desc('Equipped creature has lifelink if you control a Cleric, deathtouch if you control a Rogue, and haste if you control a Warrior.'), '', 'Multiclass Baldric: conditional per ability, left alone');
assert.equal(desc('Equipped creature has double strike as long as two or more Equipment are attached to it.'), '', 'Brass Knuckles: left alone');
assert.equal(desc('Equipped creature gets +1/+1. As long as it\'s legendary, it gets an additional +2/+2. As long as it\'s red, it has trample.'), 'attached - +1/+1 | attached - +2/+2', 'Tenza: the unconditional bonus, and the legendary one (the colour condition is left alone)');
assert.equal(plain(G.parse('Equipped creature gets +1/+1. As long as it\'s legendary, it gets an additional +2/+2.')[1].filters).legendary, true);
// "loses": abilities taken away (Colossus Hammer), all abilities (Aura frogs)
assert.equal(desc('Equipped creature gets +10/+10 and loses flying.'), 'attached - +10/+10', 'Colossus Hammer');
assert.deepEqual(plain(G.parse('Equipped creature gets +10/+10 and loses flying.')[0].lose), ['flying']);
assert.deepEqual(plain(G.parse('Enchanted creature loses flying and first strike.')[0].lose), ['flying', 'first strike']);
assert.equal(G.parse('Enchanted creature loses all abilities and is a blue Frog with base power and toughness 1/1.')[0].loseAll, true);
assert.equal(G.parse('Enchanted creature is an Insect artifact creature with base power and toughness 0/1 and has indestructible, and it loses all other abilities, card types, and creature types.')[0].loseAll, true, 'Darksteel Mutation');
assert.deepEqual(plain(G.parse('Creatures your opponents control lose flying and can\'t have or gain flying.')[0].lose), ['flying'], 'Archetype of Imagination');
assert.equal(G.parse('Creatures your opponents control lose flying and can\'t have or gain flying.')[0].scope, 'opp');
// "As long as equipped creature is legendary" (Champion's Helm, Hero's Heirloom)
assert.equal(desc('Equipped creature gets +2/+2.\nAs long as equipped creature is legendary, it has hexproof.'), 'attached - +2/+2 | attached hexproof', 'Champion\'s Helm');
assert.equal(desc('As long as equipped creature is legendary, it has trample and haste.'), 'attached trample+haste', 'Hero\'s Heirloom');
assert.equal(plain(G.parse('As long as equipped creature is legendary, it has hexproof.')[0].filters).legendary, true);
assert.equal(desc('As long as equipped creature is attacking, it has first strike.'), '', 'attacking is not read');
assert.equal(desc('As long as equipped creature is legendary, it has lifelink if you control a Cleric.'), '', 'a second condition is left alone');
assert.equal(desc('Enchanted creature gets +1/+1 and has lifelink and "Whenever this creature deals combat damage to a player, draw a card."'), 'attached lifelink +1/+1', 'a quoted trigger is not read here (the reminders list it)');
assert.equal(desc('Enchanted creature gets +3/+3 until end of turn.'), '', 'temporary: left alone');

// ---- 2. "…with counters on them" (any counter), long ability words ----
assert.equal(desc('Creatures you control with counters on them have haste.'), 'you haste', 'Tesak');
assert.equal(plain(G.parse('Creatures you control with counters on them have trample.')[0].cond).counter, 'any');
assert.equal(desc('The Will of the Hive Mind — Other creatures you control with counters on them have flying and haste.'), 'you flying+haste', 'Winged Hive Tyrant: a long ability word');
assert.equal(desc('Each creature you control with a counter on it has ward {1}.'), '', 'ward has no icon');

// ---- 3. Creature types ----
assert.deepEqual(plain(G.parse('Other Orcs and Goblins you control have trample.')[0].filters.tribes), ['Orcs', 'Goblins']);
assert.equal(desc('Other Orcs and Goblins you control have trample.'), 'you trample');
assert.equal(G.parse('Other Orcs and Goblins you control have trample.')[0].other, true);
assert.equal(desc('Klingons and Warriors you control have vigilance.'), 'you vigilance', 'I.K.S. Negh\'Var');
assert.equal(plain(G.parse('Zombie tokens you control have flying.')[0].filters).tribe, 'Zombie');
assert.equal(plain(G.parse('Zombie tokens you control have flying.')[0].filters).token, true);
assert.equal(desc('Other outlaws you control have vigilance and haste.'), 'you vigilance+haste', 'Vihaan');
assert.equal(plain(G.parse('Other outlaws you control have vigilance and haste.')[0].filters).tribes.length, 5);
assert.equal(plain(G.parse('Other modified creatures you control have vigilance and trample.')[0].filters).modified, true, 'Red XIII');
assert.equal(desc('Creatures you control get +1/+1 and have vigilance as long as you control three or more creatures.'), '', 'Jetmir: depends on other game state, left alone');
assert.equal(desc('Creatures you control get +2/+2 and have flying.'), 'you flying +2/+2', 'a group bonus together with an ability');

// ---- 4. The simple conditions on the card itself ----
assert.equal(desc('During your turn, Cait has indestructible.', 'Cait, Cage Brawler'), 'self indestructible', 'by its short name');
assert.equal(plain(G.parse('During your turn, Cait has indestructible.', 'Cait, Cage Brawler')[0].when).turn, true);
assert.equal(desc('Jump — During your turn, Cid has flying.', 'Cid, Freeflier Pilot'), 'self flying');
assert.equal(desc('During your turn, Cait has indestructible.'), '', 'without the card\'s name the line is not recognised');
assert.equal(desc('This creature has hexproof as long as it\'s untapped.'), 'self hexproof');
assert.equal(plain(G.parse('This creature has hexproof as long as it\'s untapped.')[0].when).untapped, true);
assert.equal(desc('Dragonlord Ojutai has hexproof as long as it\'s untapped.', 'Dragonlord Ojutai'), 'self hexproof');
assert.equal(desc('Tromokratis has hexproof unless it\'s attacking or blocking.', 'Tromokratis'), '', 'needs combat state: left alone');
assert.equal(desc('As long as this creature has five or more counters on it, it has flying and is an Angel in addition to its other types.'), 'self flying', 'Hero of Bretagard');
assert.deepEqual(plain(G.parse('As long as this creature has five or more counters on it, it has flying and is an Angel in addition to its other types.')[0].when.selfCounters), { name: 'any', min: 5 });
assert.deepEqual(plain(G.parse('As long as this creature has four or more +1/+1 counters on it, it has flying and vigilance.')[0].when.selfCounters), { name: '+1/+1', min: 4 }, 'Voice of the Blessed');
assert.deepEqual(plain(G.parse('This creature has trample as long as it has ten or more +1/+1 counters on it.')[0].when.selfCounters), { name: '+1/+1', min: 10 }, 'Primordial Hydra');
assert.equal(desc('Lieutenant — As long as you control your commander, this creature gets +2/+2 and creatures you control have vigilance.'), 'self - +2/+2 | you vigilance', 'Angelic Field Marshal');
assert.equal(desc('Lieutenant — As long as you control your commander, this creature gets +2/+2 and other creatures you control get +2/+2 and have trample.'), 'self - +2/+2 | you trample +2/+2', 'Thunderfoot Baloth');
assert.equal(G.parse('Lieutenant — As long as you control your commander, this creature gets +2/+2 and other creatures you control get +2/+2 and have trample.')[1].other, true);
// Other game state stays manual.
assert.equal(desc('As long as you control four or more artifacts, this creature has hexproof.'), '', 'artifact count');
assert.equal(desc('As long as you have 30 or more life, this creature gets +5/+5 and has flying.'), '', 'life total');
assert.equal(desc('Balan has double strike as long as two or more Equipment are attached to it.', 'Balan, Wandering Knight'), '', 'equipment count');
assert.equal(desc('As long as this creature is equipped, it has first strike and lifelink.'), '', 'equipped');

// ---- Plain anthems: "All Elves get +1/+1" (static), but not one-shot or conditional ones ----
assert.equal(desc('Elves you control get +1/+1.'), 'you - +1/+1');
assert.equal(plain(G.parse('Elves you control get +1/+1.')[0].filters).tribe, 'Elf' === 'Elf' ? 'Elves' : '', 'the creature type is kept as written');
assert.equal(desc('All Elves get +1/+1.'), 'all - +1/+1', 'everyone\'s Elves');
assert.equal(desc('Other creatures you control get +1/+1.'), 'you - +1/+1');
assert.equal(G.parse('Other creatures you control get +1/+1.')[0].other, true);
assert.equal(desc('Creatures your opponents control get -1/-1.'), 'opp - -1/-1', 'a shrinking effect');
assert.equal(desc('Sliver creatures you control get +1/+1.'), 'you - +1/+1');
assert.equal(desc('Other Dragons you control get +1/+1.'), 'you - +1/+1');
assert.equal(desc('Creatures you control with +1/+1 counters on them get +1/+1.'), 'you - +1/+1');
assert.equal(desc('Creatures you control get +1/+1 until end of turn.'), '', 'temporary: left to the Temporary effects tool');
assert.equal(desc('When this creature enters, Elves you control get +1/+1 until end of turn.'), '', 'a one-shot trigger is not a static anthem');
assert.equal(desc('Elves you control get +1/+1 for each Elf you control.'), '', 'dynamic: left alone');
assert.equal(desc('As long as you control three or more Elves, Elves you control get +1/+1.'), '', 'conditional: left alone');
assert.equal(desc('Target creature gets +2/+2.'), '', 'a target is not a grant');
assert.equal(desc('This creature gets +1/+1.'), '', 'a card\'s own bonus is not a group anthem');

// ---- Applying to boards ----
const board = (pid, entries) => ({ pid, entries });
const e = (iid, def, extra) => ({ c: Object.assign({ iid, c: {}, t: 0 }, extra), def });
const bear = { id: 'b', face: 'Bear', type: 'Creature — Bear', oracle: '', pt: '2/2' };
const vow = { id: 'v', face: 'Vow of Flight', type: 'Enchantment — Aura', oracle: 'Enchanted creature gets +2/+2, has flying, and can\'t attack you or planeswalkers you control.' };
const frog = { id: 'f', face: 'Frogify', type: 'Enchantment — Aura', oracle: 'Enchanted creature loses all abilities and is a blue Frog with base power and toughness 1/1.' };
let m = G.forBoards([board('A', [e('v', vow, { att: { p: 'A', i: 'b1' } }), e('b1', bear), e('b2', bear)])], {});
assert.equal(m.get('A|b1')[0].id, 'flying'); assert.equal(m.get('A|b2'), undefined, 'only the enchanted creature');
assert.deepEqual(plain(m.pt.get('A|b1')), { dp: 2, dt: 2, base: null, from: [{ from: 'Vow of Flight', dp: 2, dt: 2, base: null }] });
m = G.forBoards([board('A', [e('f', frog, { att: { p: 'A', i: 'b1' } }), e('v', vow, { att: { p: 'A', i: 'b1' } }), e('b1', bear)])], {});
assert.equal(m.pt.get('A|b1').base, '1/1'); assert.equal(m.pt.get('A|b1').dp, 2, 'a frog Aura and a +2/+2 Aura together: base 1/1 then +2/+2 (the page adds counters on top)');
m = G.forBoards([board('A', [e('v', vow, { att: { p: 'B', i: 'b3' } })]), board('B', [e('b3', bear)])], {});
assert.ok(m.pt.get('B|b3'), 'an Aura on an opponent\'s creature');
// Conditions on the giver.
const cait = { id: 'c', face: 'Cait, Cage Brawler', type: 'Legendary Creature', oracle: 'During your turn, Cait has indestructible.' };
m = G.forBoards([board('A', [e('c', cait)])], { active: 'A' }); assert.equal(m.get('A|c')[0].id, 'indestructible', 'on its controller\'s turn');
m = G.forBoards([board('A', [e('c', cait)])], { active: 'B' }); assert.equal(m.size, 0, 'not on another player\'s turn');
const druid = { id: 'd', face: 'Paradise Druid', type: 'Creature — Elf Druid', oracle: 'This creature has hexproof as long as it\'s untapped.' };
m = G.forBoards([board('A', [e('d', druid)])], {}); assert.equal(m.get('A|d')[0].id, 'hexproof');
m = G.forBoards([board('A', [e('d', druid, { t: 1 })])], {}); assert.equal(m.size, 0, 'not while tapped');
const hero = { id: 'h', face: 'Hero', type: 'Creature', oracle: 'As long as this creature has five or more counters on it, it has flying and is an Angel in addition to its other types.' };
m = G.forBoards([board('A', [e('h', hero, { c: { '+1/+1': 3, Charge: 1 } })])], {}); assert.equal(m.size, 0, 'four counters: not yet');
m = G.forBoards([board('A', [e('h', hero, { c: { '+1/+1': 3, Charge: 2 } })])], {}); assert.equal(m.get('A|h')[0].id, 'flying', 'five counters of any kind');
const lieut = { id: 'l', face: 'Marshal', type: 'Creature — Angel', oracle: 'Lieutenant — As long as you control your commander, this creature gets +2/+2 and creatures you control have vigilance.' };
m = G.forBoards([board('A', [e('l', lieut), e('b1', bear)])], {}); assert.equal(m.size, 0, 'no commander on the battlefield: nothing');
m = G.forBoards([board('A', [e('l', lieut), e('b1', bear), e('k', bear, { cmd: 1 })])], {});
assert.equal(m.get('A|b1')[0].id, 'vigilance'); assert.equal(m.pt.get('A|l').dp, 2, 'the Lieutenant itself gets +2/+2'); assert.equal(m.pt.get('A|b1'), undefined, 'the others do not');
// Modified creatures (Red XIII).
const red = { id: 'r', face: 'Red XIII', type: 'Legendary Creature — Beast', oracle: 'Other modified creatures you control have vigilance and trample.' };
const sword = { id: 'sw', face: 'Sword', type: 'Artifact — Equipment', oracle: '' };
m = G.forBoards([board('A', [e('r', red), e('b1', bear, { c: { '+1/+1': 1 } }), e('b2', bear), e('b3', bear), e('sw', sword, { att: { p: 'A', i: 'b3' } })])], {});
assert.deepEqual(Array.from(m.keys()).sort(), ['A|b1', 'A|b3'], 'a creature with a counter or an Equipment attached is modified; the source itself is excluded');
// Tribes.
const orc = { id: 'o', face: 'Siegemaster', type: 'Creature — Orc Warrior', oracle: 'Other Orcs and Goblins you control have trample.' };
const gob = { id: 'g', face: 'Goblin', type: 'Creature — Goblin', oracle: '' };
m = G.forBoards([board('A', [e('o', orc), e('g1', gob), e('b1', bear), e('o2', Object.assign({}, orc, { oracle: '' }))])], {});
assert.deepEqual(Array.from(m.keys()).sort(), ['A|g1', 'A|o2']);
// "Other": a card never gives it to itself, but a second card with the same text does (each one gets +1/+1 from the other, not from itself).
const legendBear = { id: 'lb', face: 'Legend Bear', type: 'Legendary Creature \u2014 Bear', oracle: '', pt: '2/2' };
const elf = { id: 'el', face: 'Plain Elf', type: 'Creature \u2014 Elf', oracle: '', pt: '1/1' };
const otherLord = { id: 'ol', face: 'Other Lord', type: 'Creature \u2014 Elf', oracle: 'Other Elves you control get +1/+1.', pt: '2/2' };
m = G.forBoards([board('A', [e('x', otherLord)])], {}); assert.equal(m.pt.size, 0, 'a lone "Other Elves" lord gives nothing to itself');
m = G.forBoards([board('A', [e('x', otherLord), e('y', otherLord)])], {});
assert.equal(m.pt.get('A|x').dp, 1, 'two such lords: each gets +1/+1 from the other'); assert.equal(m.pt.get('A|y').dp, 1);
assert.equal(m.pt.get('A|x').from.length, 1, 'and only from the other one, not from itself');
m = G.forBoards([board('A', [e('x', otherLord), e('y', otherLord), e('z', otherLord)])], {}); assert.equal(m.pt.get('A|x').dp, 2, 'three lords: +1/+1 from each of the other two');
m = G.forBoards([board('A', [e('x', otherLord), e('b1', elf)])], {}); assert.equal(m.pt.get('A|b1').dp, 1, 'an ordinary Elf gets it'); assert.equal(m.pt.get('A|x'), undefined, 'the lord does not');
m = G.forBoards([board('A', [e('x', otherLord), e('l', { id: 'l', face: 'Lord', type: 'Creature \u2014 Elf', oracle: 'Elves you control get +1/+1.', pt: '1/1' })])], {});
assert.equal(m.pt.get('A|x').dp, 1, 'a "not other" lord gives to the "Other" lord'); assert.equal(m.pt.get('A|l').dp, 2, 'and the plain lord gets +1/+1 from itself and +1/+1 from the "Other" lord');
assert.equal(G.parse('All other creatures get -1/-1.')[0].other, true, '"All other creatures" excludes the card itself');
m = G.forBoards([board('A', [e('x', { id: 'ao', face: 'Smog', type: 'Enchantment', oracle: 'All other creatures get -1/-1.' }), e('b1', bear)]), board('B', [e('b2', bear)])], {});
assert.equal(m.pt.get('A|b1').dp, -1); assert.equal(m.pt.get('B|b2').dp, -1, '"All other" reaches everyone\'s creatures');
// "for each …" on an Aura / Equipment: the wording is kept; the page counts it
assert.deepEqual(plain(G.parse('Enchanted creature gets +1/+1 for each Elf you control and has reach.')[0].each), { a: 1, b: 1, text: 'Elf you control' }, 'Crown of Skemfar');
assert.deepEqual(plain(G.parse('Enchanted creature gets +1/+1 for each enchantment you control and has first strike.')[0].each), { a: 1, b: 1, text: 'enchantment you control' }, 'Ethereal Armor');
assert.equal(desc('Enchanted creature gets +1/+1 for each Elf you control and has reach.'), 'attached reach', 'ability still read');
assert.equal(G.parse('Equipped creature gets +1/+1 for each charge counter on this Equipment and has vigilance.')[0].each.text, 'charge counter on this Equipment', 'Mace of the Valiant: kept for the page to count');
assert.deepEqual(plain(G.parse('Equipped creature gets +X/+X, where X is the number of creature cards in all graveyards.')[0].each), { a: 1, b: 1, text: 'the number of creature cards in all graveyards' }, 'Bonehoard');
const crown = { id: 'cw', face: 'Crown of Skemfar', type: 'Enchantment \u2014 Aura', oracle: 'Enchanted creature gets +1/+1 for each Elf you control and has reach.' };
m = G.forBoards([board('A', [e('cw', crown, { att: { p: 'A', i: 'b1' } }), e('b1', bear)])], { each: (each, pid) => ({ dp: each.a * 3, dt: each.b * 3 }) });
assert.equal(m.pt.get('A|b1').dp, 3, 'the page\'s count is added'); assert.equal(m.get('A|b1')[0].id, 'reach');
m = G.forBoards([board('A', [e('cw', crown, { att: { p: 'A', i: 'b1' } }), e('b1', bear)])], {}); assert.equal(m.pt.get('A|b1'), undefined, 'without a counter nothing is added');
assert.equal(plain(G.clean([{ scope: 'attached', filters: {}, abilities: ['reach'], each: { a: 1, b: 1, text: 'Elf you control' } }])[0].each.text), 'Elf you control');
assert.equal(plain(G.clean([{ scope: 'attached', filters: {}, abilities: ['reach'], each: { a: 99, b: 1, text: 'x' } }])[0].each), null, 'an absurd pump is dropped');
// Losing abilities, and the legendary condition, applied to boards.
const hammer = { id: 'hm', face: 'Colossus Hammer', type: 'Artifact \u2014 Equipment', oracle: 'Equipped creature gets +10/+10 and loses flying.' };
const helm = { id: 'hl', face: 'Champion\'s Helm', type: 'Artifact \u2014 Equipment', oracle: 'Equipped creature gets +2/+2.\nAs long as equipped creature is legendary, it has hexproof.' };
const legend = { id: 'lg', face: 'Legend', type: 'Legendary Creature \u2014 Human', oracle: '', pt: '2/2' };
m = G.forBoards([board('A', [e('hm', hammer, { att: { p: 'A', i: 'b1' } }), e('b1', bear)])], {});
assert.deepEqual(plain(m.lose.get('A|b1').ids), ['flying']); assert.equal(m.pt.get('A|b1').dp, 10); assert.equal(m.lose.get('A|b1').from[0], 'Colossus Hammer');
assert.equal(m.lose.get('A|b2'), undefined);
m = G.forBoards([board('A', [e('hl', helm, { att: { p: 'A', i: 'g1' } }), e('g1', legend), e('hl2', helm, { att: { p: 'A', i: 'b1' } }), e('b1', bear)])], {});
assert.equal(m.get('A|g1')[0].id, 'hexproof', 'a legendary creature gets hexproof'); assert.equal(m.get('A|b1'), undefined, 'an ordinary creature does not'); assert.equal(m.pt.get('A|b1').dp, 2, 'but both get the +2/+2');
m = G.forBoards([board('A', [e('f', frog, { att: { p: 'A', i: 'b1' } }), e('b1', bear)])], {}); assert.equal(m.lose.get('A|b1').all, true, 'a frog Aura: loses all abilities');
// ---- Types (v0.87.0): Auras that change types, "also a type", Changeling, Omo ----
const frogT = { id: 'ft', face: 'Frogify', type: 'Enchantment \u2014 Aura', oracle: 'Enchanted creature loses all abilities and is a blue Frog with base power and toughness 1/1.' };
const tideT = { id: 'ti', face: 'Stormtide Leviathan', type: 'Creature \u2014 Leviathan', oracle: 'All lands are Islands in addition to their other types.', pt: '8/8' };
const bioT = { id: 'bi', face: 'Biotransference', type: 'Enchantment', oracle: 'Creatures you control are artifacts in addition to their other types. The same is true for creature spells you control and creature cards you own that aren\'t on the battlefield.' };
const ling = { id: 'cl', face: 'Changeling Outcast', type: 'Creature \u2014 Shapeshifter', oracle: 'Changeling (This card is every creature type.)\nChangeling Outcast can\'t block or be blocked by non-Shapeshifter creatures.', pt: '1/1' };
const elfLord = { id: 'el', face: 'Elf Lord', type: 'Creature \u2014 Elf', oracle: 'Elves you control get +1/+1.', pt: '2/2' };
const land = { id: 'ld', face: 'Plains', type: 'Basic Land \u2014 Plains', oracle: '' };
m = G.forBoards([board('A', [e('ft', frogT, { att: { p: 'A', i: 'b1' } }), e('b1', { id: 'bb', face: 'Bear', type: 'Legendary Creature \u2014 Bear Warrior', oracle: '', pt: '2/2' })])], {});
assert.equal(m.types.get('A|b1').line, 'Legendary Creature \u2014 Frog', 'a frog Aura replaces the creature types, keeps the supertype and the card type'); assert.deepEqual(plain(m.types.get('A|b1').tags.map(t => t.label)), ['Frog']);
m = G.forBoards([board('A', [e('ft', frogT, { att: { p: 'A', i: 'b1' } }), e('b1', bear), e('lord', elfLord), e('e1', elf)])], {});
assert.equal(m.pt.get('A|e1').dp, 1, 'the Elf still gets the lord bonus'); assert.equal(m.pt.get('A|b1').dp, 0, 'the Frog gets no Elf bonus (a Bear turned into a Frog was never an Elf)'); assert.equal(m.pt.get('A|b1').base, '1/1', 'only the Aura\'s base 1/1');
m = G.forBoards([board('A', [e('ft', frogT, { att: { p: 'A', i: 'e1' } }), e('lord', elfLord), e('e1', elf)])], {});
assert.equal(m.pt.get('A|e1').dp, 0, 'an Elf turned into a Frog no longer gets the Elf bonus (only the Aura\'s base remains)');
m = G.forBoards([board('A', [e('ti', tideT), e('l1', land), e('l2', Object.assign({}, land, { type: 'Land' }))]), board('B', [e('l3', land)])], {});
assert.equal(m.types.get('A|l1').line, 'Basic Land \u2014 Plains Island', 'a Plains is also an Island'); assert.equal(m.types.get('A|l2').line, 'Land \u2014 Island'); assert.ok(m.types.get('B|l3'), 'everyone\'s lands');
assert.equal(m.types.get('A|ti'), undefined, 'the Leviathan is not a land');
m = G.forBoards([board('A', [e('bi', bioT), e('b1', bear)])], {}); assert.equal(m.types.get('A|b1').line, 'Artifact Creature \u2014 Bear', 'also an artifact; the type order is stable');
m = G.forBoards([board('A', [e('cl', ling), e('lord', elfLord)])], {}); assert.equal(m.types.get('A|cl').all, true, 'Changeling'); assert.equal(plain(m.types.get('A|cl').tags[0].label), 'All types');
assert.equal(m.pt.get('A|cl').dp, 1, 'a Changeling counts as an Elf for "Elves you control"');
const omo = { id: 'om', face: 'Omo, Queen of Vesuva', type: 'Legendary Creature \u2014 Insect', oracle: 'Each nonland creature with an everything counter on it is every creature type.', pt: '4/4' };
m = G.forBoards([board('A', [e('om', omo), e('b1', bear, { c: { everything: 1 } }), e('b2', bear), e('lord', elfLord)])], {});
assert.equal(m.types.get('A|b1').all, true, 'a creature with an everything counter is every type'); assert.equal(m.types.get('A|b2'), undefined);
assert.equal(m.pt.get('A|b1').dp, 1, 'and so gets the Elf bonus');
const imp = { id: 'ip', face: 'Imprisoned in the Moon', type: 'Enchantment \u2014 Aura', oracle: 'Enchanted permanent is a colorless land with "{T}: Add {C}" and loses all other card types and abilities.' };
m = G.forBoards([board('A', [e('ip', imp, { att: { p: 'A', i: 'b1' } }), e('b1', legendBear)])], {}); assert.equal(m.types.get('A|b1').line, 'Legendary Land', 'a permanent becomes a land (and no longer a creature)');
// Validation of published types.
assert.deepEqual(plain(G.clean([{ scope: 'attached', filters: {}, abilities: [], types: { mode: 'set', M: ['Artifact', 'Evil'], S: ['Frog', 'x'] } }])[0].types), { mode: 'set', M: ['Artifact'], S: ['Frog'] });
assert.equal(G.clean([{ scope: 'attached', filters: {}, abilities: ['flying'], types: { mode: 'bogus', S: ['Frog'] } }])[0].types, null, 'an unknown mode is dropped');
assert.deepEqual(plain(G.clean([{ scope: 'self', filters: {}, abilities: [], types: { all: true } }])[0].types), { all: true });
// Published definitions carry the new fields and are validated.
const pub = { id: 'p', face: 'Pub', type: 'Enchantment — Aura', gr: G.parse(vow.oracle) };
m = G.forBoards([board('A', [e('p', pub, { att: { p: 'A', i: 'b1' } }), e('b1', bear)])], {}); assert.equal(m.pt.get('A|b1').dp, 2, 'a published definition carries its power/toughness');
assert.deepEqual(plain(G.clean([{ scope: 'attached', attach: 'enchanted', filters: { creature: true }, abilities: [], pt: { dp: 2, dt: 2 }, base: '0/1' }])[0].base), '0/1');
assert.equal(G.clean([{ scope: 'attached', filters: {}, abilities: [], pt: { dp: 1e9, dt: 0 } }]).length, 0, 'absurd numbers are refused');
assert.equal(G.clean([{ scope: 'self', filters: {}, abilities: ['flying'], when: { turn: true, bogus: 1 } }])[0].when.bogus, undefined, 'unknown conditions are dropped');
assert.equal(G.clean([{ scope: 'self', filters: {}, abilities: ['flying'], when: { selfCounters: { name: 'any', min: 500 } } }])[0].when, null, 'an absurd threshold is dropped');
console.log('PASS grants power/toughness: Auras and Equipment give bonuses and base power/toughness, new group shapes, simple conditions on the card, and other game state stays manual');
