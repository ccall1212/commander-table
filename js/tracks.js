/* tracks.js — step trackers for cards that go through stages: Sagas (chapters I, II, III…), Classes (levels), Rooms (two doors).
 * Pure helpers, no page needed. A Saga's progress is its lore counters, so effects that move counters (Tidus, Yuna's Guardian) work.
 * describe() reads the card's rules text/type/name; a published card definition carries the result in `trk` because other players'
 * definitions do not include the rules text. */
(function () {
  'use strict';
  const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  const MAX_STEPS = 10;
  // "I — Do this", "II, III — Do that": the chapter numbers and text of each Saga line.
  function chapters(oracle) {
    const out = [];
    String(oracle == null ? '' : oracle).split('\n').forEach(raw => {
      const m = /^((?:[IVX]+)(?:\s*,\s*[IVX]+)*)\s+—\s+(.*)$/.exec(raw.trim());
      if (!m) return;
      const nums = m[1].split(/\s*,\s*/).map(r => ROMAN[r]).filter(Boolean);
      if (nums.length) out.push({ nums, text: m[2].trim() });
    });
    return out;
  }
  // The Saga lines that apply while the Saga has `lore` lore counters.
  const chapterLines = (oracle, lore) => chapters(oracle).filter(c => c.nums.includes(lore)).map(c => c.nums.map(n => Object.keys(ROMAN).find(k => ROMAN[k] === n)).join(', ') + ' — ' + c.text);
  const romanOf = n => Object.keys(ROMAN).find(k => ROMAN[k] === n) || String(n);
  // { kind: 'saga'|'class'|'room', labels: [...] } or null. A Class has Level 1 from the start, so its tracker starts at 1.
  function describe(def) {
    if (!def) return null;
    if (def.trk && typeof def.trk === 'object') return clean(def.trk);
    const type = String(def.type || ''), oracle = String(def.oracle || '');
    if (/\bSaga\b/.test(type)) {
      const top = chapters(oracle).reduce((n, c) => Math.max(n, ...c.nums), 0);
      return top ? { kind: 'saga', labels: Array.from({ length: Math.min(top, MAX_STEPS) }, (_, i) => romanOf(i + 1)) } : null;
    }
    if (/\bClass\b/.test(type)) {
      let top = 1; oracle.split('\n').forEach(l => { const m = /:\s*Level (\d+)\s*$/.exec(l.trim()); if (m) top = Math.max(top, +m[1]); });
      return top > 1 ? { kind: 'class', labels: Array.from({ length: Math.min(top, MAX_STEPS) }, (_, i) => String(i + 1)) } : null;
    }
    if (/\bRoom\b/.test(type)) {
      const names = String(def.name || '').split(' // ').map(s => s.trim()).filter(Boolean);
      return { kind: 'room', labels: ['1', '2'], names: names.length === 2 ? names : ['Door 1', 'Door 2'] };
    }
    return null;
  }
  function clean(t) {
    const kind = ['saga', 'class', 'room'].includes(t.kind) ? t.kind : null;
    const labels = Array.isArray(t.labels) ? t.labels.slice(0, MAX_STEPS).map(x => String(x).slice(0, 6)) : [];
    if (!kind || !labels.length) return null;
    const out = { kind, labels };
    if (kind === 'room') out.names = (Array.isArray(t.names) ? t.names : []).slice(0, 2).map(x => String(x).slice(0, 40));
    return out;
  }
  // Which dots are lit and which is current, given the card's state: lore counters (Saga), tk = level (Class) or door bits (Room).
  function state(trk, card) {
    if (!trk) return null;
    const n = trk.labels.length;
    if (trk.kind === 'saga') { const lore = Math.max(0, Math.min(n, Math.round(+((card && card.c && card.c.Lore) || 0)))); return { on: trk.labels.map((_, i) => i < lore), cur: lore - 1 }; }
    if (trk.kind === 'class') { const lvl = Math.max(1, Math.min(n, Math.round(+(card && card.tk) || 1))); return { on: trk.labels.map((_, i) => i < lvl), cur: lvl - 1 }; }
    const bits = (card && card.tk) | 0;
    return { on: [!!(bits & 1), !!(bits & 2)], cur: -1 };
  }
  window.CTTracks = { chapters, chapterLines, describe, state, MAX_STEPS };
}());
