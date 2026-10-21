/* Shared player color palette and table-color validation. */
(function (root) {
  'use strict';

  const PALETTE = [
    { id: 'gold', name: 'Gold', value: '#e0a33a' },
    { id: 'blue', name: 'Blue', value: '#4f8cff' },
    { id: 'green', name: 'Green', value: '#3fbf7f' },
    { id: 'red', name: 'Red', value: '#e5534b' },
    { id: 'purple', name: 'Purple', value: '#a35cff' },
    { id: 'teal', name: 'Teal', value: '#2ec4c4' }
  ];
  const byId = new Map(PALETTE.map(c => [c.id, c]));

  function cleanSeats(seats) {
    return Array.isArray(seats) ? [...new Set(seats.filter(p => typeof p === 'string' && p).map(p => p.slice(0, 40)))].slice(0, 8) : [];
  }
  function normalize(seats, colors, fillMissing = true) {
    const ids = cleanSeats(seats), source = colors && typeof colors === 'object' && !Array.isArray(colors) ? colors : {};
    const result = {}, used = new Set();
    for (const pid of ids) {
      const saved = source[pid];
      if (byId.has(saved) && !used.has(saved)) { result[pid] = saved; used.add(saved); }
      else if (fillMissing) {
        const next = PALETTE.find(c => !used.has(c.id));
        if (next) { result[pid] = next.id; used.add(next.id); }
      }
    }
    return result;
  }
  // Returns an updated map, or null when the authoritative host must reject the claim.
  function claim(seats, colors, pid, colorId) {
    const ids = cleanSeats(seats), map = normalize(ids, colors, false);
    if (!ids.includes(pid) || !byId.has(colorId)) return null;
    if (Object.keys(map).some(other => other !== pid && map[other] === colorId)) return null;
    if (map[pid] && map[pid] !== colorId) return null;
    map[pid] = colorId;
    return map;
  }
  function color(id) { return byId.get(id) || null; }
  const api = { PALETTE, cleanSeats, normalize, claim, color };
  root.CTPlayerColors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
