'use strict';

const assert = require('node:assert/strict');

// The helper is a browser IIFE; it exposes its pure geometry functions on window.
global.window = {};
require('../js/chat-panel.js');
const { normalize, fit } = window.CTChatPanel;

assert.deepEqual(normalize(null), { floating: false, transparent: false, x: null, y: null });
assert.deepEqual(normalize('bad'), { floating: false, transparent: false, x: null, y: null });
assert.deepEqual(normalize({ floating: 1, transparent: 'yes', x: '20', y: NaN }), {
  floating: false, transparent: false, x: null, y: null
});
assert.deepEqual(normalize({ floating: true, transparent: true, x: Infinity, y: -Infinity }), {
  floating: true, transparent: true, x: null, y: null
});
assert.deepEqual(normalize({ floating: true, transparent: false, x: -200, y: 140 }), {
  floating: true, transparent: false, x: -200, y: 140
});

const wide = { left: 0, top: 0, width: 1920, height: 1080 };
assert.deepEqual(fit(normalize(null), wide), { width: 360, height: 480, x: 1552, y: 58 });
assert.deepEqual(fit({ x: -2000, y: -50 }, wide), { width: 360, height: 480, x: 8, y: 8 });
assert.deepEqual(fit({ x: 99999, y: 99999 }, wide), { width: 360, height: 480, x: 1552, y: 592 });

assert.deepEqual(fit(normalize(null), { left: 0, top: 0, width: 1366, height: 768 }), {
  width: 360, height: 480, x: 998, y: 58
});
assert.deepEqual(fit(normalize(null), { left: 0, top: 0, width: 320, height: 640 }), {
  width: 304, height: 480, x: 8, y: 58
});
assert.deepEqual(fit(normalize(null), { left: 0, top: 0, width: 640, height: 300 }), {
  width: 360, height: 284, x: 272, y: 8
});

// visualViewport offsets matter when the on-screen keyboard or pinch zoom moves
// the visible page area away from the layout viewport origin.
assert.deepEqual(fit(normalize(null), { left: 24, top: 96, width: 700, height: 360 }), {
  width: 360, height: 344, x: 356, y: 104
});
assert.deepEqual(fit({ x: 500, y: 300 }, { left: 24, top: 96, width: 700, height: 360 }), {
  width: 360, height: 344, x: 356, y: 104
});

// Temporary viewport constraints must not overwrite stored coordinates. Once
// the viewport grows again, the previously saved position should return.
const saved = normalize({ floating: true, transparent: true, x: 900, y: 500 });
const constrained = fit(saved, { left: 0, top: 0, width: 320, height: 300 });
assert.deepEqual(constrained, { width: 304, height: 284, x: 8, y: 8 });
assert.deepEqual({ x: saved.x, y: saved.y }, { x: 900, y: 500 });
assert.deepEqual(fit(saved, wide), { width: 360, height: 480, x: 900, y: 500 });

console.log('chat panel geometry checks passed');
