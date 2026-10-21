const assert = require('node:assert/strict');
const colors = require('../js/player-colors.js');

const seats = ['host', 'alice', 'bob'];
const legacy = colors.normalize(seats, null);
assert.deepEqual(legacy, { host: 'gold', alice: 'blue', bob: 'green' }, 'legacy tables get stable, unique defaults');
assert.deepEqual(colors.normalize(seats, { host: 'red', alice: 'red', bob: 'bogus' }),
  { host: 'red', alice: 'gold', bob: 'blue' }, 'duplicate and invalid saved assignments are normalized in seat order');
assert.deepEqual(colors.normalize(['host', 'alice'], { host: 'teal', alice: 'purple', departed: 'red' }),
  { host: 'teal', alice: 'purple' }, 'normalization drops assignments for departed players and preserves valid choices');
assert.deepEqual(colors.normalize(seats, { host: 'gold' }, false), { host: 'gold' },
  'new-room selection leaves unconfirmed seats unassigned');

const starting = { host: 'gold' };
const aliceClaim = colors.claim(['host', 'alice'], starting, 'alice', 'red');
assert.equal(aliceClaim.alice, 'red', 'a seated player can claim an available color');
const bobRace = colors.claim(['host', 'alice', 'bob'], aliceClaim, 'bob', 'red');
assert.equal(bobRace, null, 'the host rejects a second claim after the color is taken');
assert.equal(colors.claim(['host', 'alice'], starting, 'alice', 'not-a-color'), null, 'invalid palette values are rejected');
assert.equal(colors.claim(seats, starting, 'visitor', 'red'), null, 'non-seated claims are rejected');
assert.equal(colors.claim(['host', 'alice'], starting, 'alice', 'gold'), null, 'a seated player cannot take another player\'s color');
assert.equal(colors.claim(['host', 'alice', 'bob'], starting, 'bob', 'red').bob, 'red', 'a competing available claim can succeed');
assert.equal(colors.claim(['host', 'alice'], aliceClaim, 'alice', 'purple'), null, 'a confirmed color cannot be changed');

const reconnectCopy = JSON.parse(JSON.stringify({ seats, colors: aliceClaim }));
assert.deepEqual(colors.normalize(reconnectCopy.seats, reconnectCopy.colors, false), aliceClaim,
  'chosen colors survive JSON table persistence and reconnect');

console.log('Player color checks passed.');
