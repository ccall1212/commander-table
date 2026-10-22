const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const values = new Map();
const localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};
const context = { window: {}, localStorage };
vm.runInNewContext(fs.readFileSync('js/hotkeys.js', 'utf8'), context);
const keys = context.window.CTHotkeys;
const press = (key, options = {}) => ({ key, code: options.code || 'Key' + key.toUpperCase(), ...options });

assert.equal(keys.actionFor(press('c')), 'copy');
assert.equal(keys.actionFor(press('t'), { card: true }), 'tap');
assert.equal(keys.actionFor(press('t'), { emptyBattlefield: true }), 'tokens');
assert.equal(keys.actionFor(press('z', { ctrlKey: true })), 'undo');
assert.equal(keys.actionFor(press('`', { code: 'Backquote' })), 'chat');
assert.equal(keys.set('copy', 'G'), '');
assert.equal(keys.key('copy'), 'G');
assert.equal(keys.key('graveyard'), '', 'reassigning a key clears its previous action');
assert.equal(keys.actionFor(press('g')), 'copy');
assert.equal(keys.set('copy', 'Ctrl+R').includes('reserved'), true);
assert.match(keys.set('copy', 'Alt+F4'), /Choose a letter/, 'function-key system shortcuts are unsupported');
assert.equal(keys.set('copy', 'P'), '');
assert.equal(keys.key('copy'), 'P');
assert.equal(keys.actionFor(press('p')), 'copy');
assert.equal(keys.actionFor(press('c')), null);
assert.equal(keys.clear('copy'), '');
assert.equal(keys.key('copy'), '', 'Clear leaves the action unassigned');
assert.equal(keys.actionFor(press('p')), null);
assert.equal(keys.reset('copy'), '');
assert.equal(keys.set('graveyard', 'C'), '');
assert.equal(keys.key('copy'), '', 'another action can take the default C key');
assert.equal(keys.reset('copy'), '');
assert.equal(keys.key('graveyard'), '', 'Reset moves an occupied default key to its original action');
assert.equal(keys.actionFor(press('c')), 'copy');
assert.equal(keys.reset('graveyard'), '');
assert.equal(keys.actionFor(press('g')), 'graveyard');
assert.equal(keys.set('arrow', 'Shift+Q'), '');
assert.equal(keys.actionFor(press('Q', { shiftKey: true })), 'arrow');
assert.equal(keys.set('lens', 'Y'), '');
assert.equal(keys.matches(press('y'), 'lens'), true);
const normalSet = localStorage.setItem, normalRemove = localStorage.removeItem;
localStorage.setItem = () => { throw Error('blocked'); };
assert.match(keys.set('lens', 'Q'), /Could not save/);
assert.equal(keys.key('lens'), 'Y', 'failed save does not activate an unsaved binding');
assert.match(keys.reset('lens'), /Could not save/);
assert.equal(keys.key('lens'), 'Y', 'failed reset keeps the saved binding');
localStorage.removeItem = () => { throw Error('blocked'); };
assert.match(keys.resetAll(), /Could not save/);
assert.equal(keys.key('lens'), 'Y', 'failed reset-all keeps the saved bindings');
localStorage.setItem = normalSet; localStorage.removeItem = normalRemove;
keys.resetAll();
assert.equal(keys.key('lens'), 'V');
assert.equal(values.has('ct.hotkeys.v1'), false);
console.log('PASS hotkeys: defaults, contexts, custom actions, conflicts, reset and browser-local storage');
