/* Automatic checks for the step trackers (js/tracks.js). Run: node tests/test_tracks.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/tracks.js'), 'utf8'), ctx);
const T = ctx.window.CTTracks;
const labels = d => { const t = T.describe(d); return t ? t.kind + ':' + t.labels.join(',') : null; };

const ixion = { type: 'Enchantment Creature — Saga Unicorn', oracle: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI — Aerospark — Exile target creature an opponent controls until this Saga leaves the battlefield.\nII, III — Put a +1/+1 counter on each of up to two target creatures you control. You gain 2 life.\nFirst Strike' };
assert.equal(labels(ixion), 'saga:I,II,III', 'Summon: Ixion has three chapters');
assert.equal(T.chapters(ixion.oracle).length, 2, 'chapter lines are found');
assert.deepEqual(Array.from(T.chapterLines(ixion.oracle, 1)), ['I — Aerospark — Exile target creature an opponent controls until this Saga leaves the battlefield.']);
assert.equal(T.chapterLines(ixion.oracle, 2)[0].startsWith('II, III — '), true, 'a shared line shows for chapter 2');
assert.equal(T.chapterLines(ixion.oracle, 3).length, 1, '… and for chapter 3');
assert.equal(T.chapterLines(ixion.oracle, 0).length, 0, 'nothing before the first lore counter');
assert.equal(T.chapterLines(ixion.oracle, 4).length, 0, 'nothing beyond the last chapter');
assert.equal(labels({ type: 'Enchantment — Saga', oracle: 'I — A\nII — B\nIII — C\nIV — D' }), 'saga:I,II,III,IV');
assert.equal(labels({ type: 'Enchantment — Saga', oracle: 'No chapters here' }), null);
assert.equal(labels({ type: 'Enchantment — Class', oracle: 'When this Class enters, do a thing.\n{2}{G}: Level 2\nLevel 2\nSomething\n{3}{G}: Level 3\nLevel 3\nSomething else' }), 'class:1,2,3');
assert.equal(labels({ type: 'Enchantment — Class', oracle: 'No levels' }), null);
const room = T.describe({ type: 'Enchantment — Room', name: 'Bottomless Pool // Locker Room', oracle: '' });
assert.equal(room.kind, 'room'); assert.equal(room.names.join('|'), 'Bottomless Pool|Locker Room');
assert.equal(labels({ type: 'Creature — Bear', oracle: 'Flying' }), null);
// A published definition carries the result.
assert.equal(labels({ type: 'x', trk: { kind: 'saga', labels: ['I', 'II'] } }), 'saga:I,II');
assert.equal(T.describe({ trk: { kind: 'evil', labels: ['I'] } }), null, 'unknown kinds are refused');
// State.
const saga = T.describe(ixion);
let s = T.state(saga, { c: { Lore: 2 } }); assert.equal(s.on.join(), 'true,true,false'); assert.equal(s.cur, 1);
s = T.state(saga, { c: { Lore: 9 } }); assert.equal(s.on.join(), 'true,true,true', 'clamped to the last chapter');
s = T.state(saga, { c: {} }); assert.equal(s.on.join(), 'false,false,false'); assert.equal(s.cur, -1);
const cls = T.describe({ type: 'Enchantment — Class', oracle: '{2}: Level 2\n{3}: Level 3' });
assert.equal(T.state(cls, {}).on.join(), 'true,false,false', 'a Class starts at Level 1');
assert.equal(T.state(cls, { tk: 2 }).cur, 1);
assert.equal(T.state(room, { tk: 2 }).on.join(), 'false,true');
assert.equal(T.state(room, { tk: 3 }).on.join(), 'true,true');
console.log('PASS tracks: Saga chapters, Class levels and Room doors are read, and lit dots follow lore counters / level / doors');
