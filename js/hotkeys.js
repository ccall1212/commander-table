/* Browser-local action shortcuts. The game supplies the action handlers. */
(function () {
  'use strict';
  const STORE = 'ct.hotkeys.v1';
  const actions = [
    { id: 'tap', group: 'Hovered card', label: 'Tap / untap (or play from hand tapped)', key: 'T' },
    { id: 'copy', group: 'Hovered card', label: 'Copy hovered visible card', key: 'C' },
    { id: 'flip', group: 'Hovered card', label: 'Transform / flip', key: 'F' },
    { id: 'face', group: 'Hovered card', label: 'Turn face down or up', key: 'Z' },
    { id: 'graveyard', group: 'Hovered card', label: 'Move to Graveyard', key: 'G' },
    { id: 'exile', group: 'Hovered card', label: 'Move to Exile', key: 'E' },
    { id: 'hand', group: 'Hovered card', label: 'Move to Hand', key: 'H' },
    { id: 'battlefield', group: 'Hovered card', label: 'Move to Battlefield', key: 'B' },
    { id: 'attach', group: 'Hovered card', label: 'Attach / equip / enchant', key: 'A' },
    { id: 'counter', group: 'Hovered card', label: 'Add a named counter', key: 'J' },
    { id: 'info', group: 'Hovered card', label: 'View card information', key: 'I' },
    { id: 'plus', group: 'Hovered card', label: 'Add a +1/+1 counter', key: '+' },
    { id: 'minus', group: 'Hovered card', label: 'Add a −1/−1 counter', key: '-' },
    { id: 'incCounters', group: 'Hovered card', label: 'Increment all counters', key: 'Shift+1' },
    { id: 'doubleCounters', group: 'Hovered card', label: 'Double all counters', key: 'Shift+2' },
    { id: 'decCounters', group: 'Hovered card', label: 'Decrement all counters', key: 'Shift+3' },
    { id: 'powerUp', group: 'Hovered card', label: 'Power +1', key: 'Alt+1' },
    { id: 'toughUp', group: 'Hovered card', label: 'Toughness +1', key: 'Alt+2' },
    { id: 'powerDown', group: 'Hovered card', label: 'Power −1', key: 'Alt+3' },
    { id: 'toughDown', group: 'Hovered card', label: 'Toughness −1', key: 'Alt+4' },
    { id: 'shuffle', group: 'Library hovered', label: 'Shuffle Library', key: 'S' },
    { id: 'mill', group: 'Library hovered', label: 'Mill top card', key: 'X' },
    { id: 'response', group: 'General', label: 'In response!', key: 'R' },
    { id: 'draw', group: 'General', label: 'Draw one card', key: 'D' },
    { id: 'untapAll', group: 'General', label: 'Untap all', key: 'U' },
    { id: 'library', group: 'General', label: 'Search your Library', key: 'L' },
    { id: 'tokens', group: 'General', label: 'Open Tokens on empty battlefield', key: 'T' },
    { id: 'pass', group: 'General', label: 'Pass turn', key: 'Space' },
    { id: 'undo', group: 'General', label: 'Undo personal action', key: 'Ctrl+Z' },
    { id: 'lens', group: 'General', label: 'Hold to use magnifier', key: 'V' },
    { id: 'arrow', group: 'General', label: 'Start a targeting arrow', key: '' },
    { id: 'chat', group: 'General', label: 'Open or close chat', key: '`' },
    { id: 'log', group: 'General', label: 'Open or close log', key: '' }
  ];
  const byId = Object.fromEntries(actions.map(a => [a.id, a]));
  let saved = {};
  try { const value = JSON.parse(localStorage.getItem(STORE) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) saved = value; }
  catch (_) { /* private browsing/storage may be unavailable */ }
  function chord(e) {
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key === 'Esc') key = 'Escape';
    else if (key.length === 1) key = key.toUpperCase();
    if (e.code === 'Backquote') key = '`';
    if (key === '=' && e.shiftKey) key = '+';
    if (key === '_' || (key === '-' && e.shiftKey)) key = '-';
    if (e.code === 'Digit1' && e.shiftKey) key = '1';
    if (e.code === 'Digit2' && e.shiftKey) key = '2';
    if (e.code === 'Digit3' && e.shiftKey) key = '3';
    if (e.code === 'Digit4' && e.shiftKey) key = '4';
    const mods = [];
    if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey && !['+', '-'].includes(key)) mods.push('Shift');
    return mods.concat(key).join('+');
  }
  function key(id) { const value = saved[id]; return typeof value === 'string' ? value : (byId[id] || {}).key || ''; }
  function matches(e, id) {
    const binding = key(id);
    return !!binding && chord(e) === binding;
  }
  function actionFor(e, context = {}) {
    const pressed = chord(e);
    if (pressed === '=' && key('plus') === '+') return 'plus';
    // T is shared by default: an empty battlefield opens Tokens; a hovered card is tapped.
    if (pressed === 'T' && key('tap') === 'T' && key('tokens') === 'T') {
      if (context.emptyBattlefield) return 'tokens';
      if (context.card) return 'tap';
    }
    return (actions.find(a => key(a.id) === pressed) || {}).id || null;
  }
  function set(id, binding) {
    if (!byId[id]) return 'Unknown action.';
    if (binding && !/^(?:(?:Ctrl|Alt|Shift)\+)*([A-Z0-9]|Space|Enter|Backspace|Delete|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|\+|-|`)$/.test(binding)) return 'Choose a letter, number, arrow, Space, `, or editing key.';
    if (binding && binding !== byId[id].key && (/^Ctrl\+/.test(binding) || /^Alt\+(ArrowLeft|ArrowRight|Space)$/.test(binding))) return 'That combination is reserved for the browser or system.';
    const next = { ...saved };
    if (binding) actions.forEach(a => {
      if (a.id === id || key(a.id) !== binding) return;
      if (binding === 'T' && ['tap', 'tokens'].includes(id) && ['tap', 'tokens'].includes(a.id)) return;
      next[a.id] = '';
    });
    if (binding === byId[id].key) delete next[id]; else next[id] = binding;
    try { localStorage.setItem(STORE, JSON.stringify(next)); }
    catch (_) { return 'Could not save shortcuts in this browser.'; }
    saved = next;
    return '';
  }
  function clear(id) { return set(id, ''); }
  function reset(id) { return byId[id] ? set(id, byId[id].key) : 'Unknown action.'; }
  function resetAll() {
    const previous = saved;
    saved = {};
    try { localStorage.removeItem(STORE); } catch (_) { saved = previous; return 'Could not save shortcuts in this browser.'; }
    return '';
  }
  window.CTHotkeys = { actions, chord, key, matches, actionFor, set, clear, reset, resetAll };
})();
