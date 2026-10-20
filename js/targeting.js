/* Public targeting endpoints and geometry. No card names or hidden zones are sent. */
(function () {
  'use strict';
  function endpoint(raw, players, seats) {
    if (!raw || typeof raw !== 'object' || !seats.includes(raw.pid) || !players[raw.pid]) return null;
    if (raw.kind === 'player') return { kind: 'player', pid: raw.pid };
    if (raw.kind !== 'card' || typeof raw.iid !== 'string' || !/^[\w-]{1,40}$/.test(raw.iid)) return null;
    const p = players[raw.pid], bf = p.zones && p.zones.battlefield;
    return Array.isArray(bf) && bf.some(c => c.iid === raw.iid)
      ? { kind: 'card', pid: raw.pid, iid: raw.iid } : null;
  }
  function same(a, b) { return !!a && !!b && a.kind === b.kind && a.pid === b.pid && a.iid === b.iid; }
  function clean(raw, players, seats) {
    if (!raw || !seats.includes(raw.by) || typeof raw.id !== 'string' || !/^[\w-]{1,40}$/.test(raw.id)) return null;
    const from = endpoint(raw.from, players, seats), to = endpoint(raw.to, players, seats);
    return from && to && !same(from, to) ? { id: raw.id, by: raw.by, from, to } : null;
  }
  const MAX_ARROWS = 128;
  function cleanList(raw, players, seats) {
    const seen = new Set();
    return (Array.isArray(raw) ? raw.slice(0, MAX_ARROWS) : []).map(a => clean(a, players, seats)).filter(a => {
      if (!a || seen.has(a.id)) return false;
      seen.add(a.id); return true;
    });
  }
  // Intersect the center-to-center ray with each visible rectangle's edge.
  function line(a, b) {
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    if (Math.hypot(dx, dy) < 1) return null;
    const edge = r => Math.min(dx ? r.width / (2 * Math.abs(dx)) : Infinity,
      dy ? r.height / (2 * Math.abs(dy)) : Infinity);
    const f = edge(a), t = edge(b);
    if (f + t >= 1) return null;
    return { x1: ax + dx * f, y1: ay + dy * f, x2: bx - dx * t, y2: by - dy * t };
  }
  window.CTTargeting = { endpoint, same, clean, cleanList, line, MAX_ARROWS };
}());
