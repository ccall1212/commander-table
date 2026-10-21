const assert = require('node:assert/strict');
const colors = require('../js/player-colors.js');

const seats = ['host', 'alice', 'bob'];
const legacy = colors.normalize(seats, null);
assert.deepEqual(legacy, { host: 'gold', alice: 'blue', bob: 'green' }, 'legacy tables get stable, unique defaults');
assert.deepEqual(colors.normalize(seats, { host: 'red', alice: 'red', bob: 'bogus' }),
  { host: 'red', alice: 'gold', bob: 'blue' }, 'duplicate and invalid saved assignments are normalized in seat order');
assert.deepEqual(colors.normalize(['host', 'alice'], { host: 'teal', alice: 'purple', departed: 'red' }),
  { host: 'teal', alice: 'purple' }, 'normalization drops assignments for departed players and preserves valid choices');

const starting = colors.normalize(seats, null);
const aliceClaim = colors.claim(seats, starting, 'alice', 'red');
assert.equal(aliceClaim.alice, 'red', 'a seated player can claim an available color');
const bobRace = colors.claim(seats, aliceClaim, 'bob', 'red');
assert.equal(bobRace, null, 'the host rejects a second claim after the color is taken');
assert.equal(colors.claim(seats, starting, 'alice', 'not-a-color'), null, 'invalid palette values are rejected');
assert.equal(colors.claim(seats, starting, 'visitor', 'red'), null, 'non-seated claims are rejected');
assert.equal(colors.claim(seats, starting, 'bob', 'gold'), null, 'a seated player cannot take another player\'s color');
assert.equal(colors.claim(seats, starting, 'bob', 'red').bob, 'red', 'a competing available claim can succeed');

const reconnectCopy = JSON.parse(JSON.stringify({ seats, colors: aliceClaim }));
assert.deepEqual(colors.normalize(reconnectCopy.seats, reconnectCopy.colors), aliceClaim,
  'chosen colors survive JSON table persistence and reconnect');

console.log('Player color checks passed.');
