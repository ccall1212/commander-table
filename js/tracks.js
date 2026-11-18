/* tracks.js — step trackers for cards that go through stages: Sagas (chapters I, II, III…), Classes (levels), Rooms (two doors), and the Day / Night marker (a token with a sun and a moon).
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
    const kind = ['saga', 'class', 'room', 'daynight'].includes(t.kind) ? t.kind : null;
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
    if (trk.kind === 'daynight') { const night = !!(card && card.fl); return { on: [!night, night], cur: night ? 1 : 0 }; } // the marker is a double-faced card: Day on the front, Night on the back (flipped)
    const bits = (card && card.tk) | 0;
    return { on: [!!(bits & 1), !!(bits & 2)], cur: -1 };
  }
  // The Day / Night marker's definition: an ordinary token card whose tracker has two buttons. Day is the starting side (rule 702.145d).
  // The real Day // Night card (Midnight Hunt token): flipping it (or clicking the sun / moon on it) switches between the two faces.
  const FRONT = 'https://cards.scryfall.io/normal/front/9/c/9c0f7843-4cbb-4d0f-8887-ec823a9238da.jpg', BACK = 'https://cards.scryfall.io/normal/back/9/c/9c0f7843-4cbb-4d0f-8887-ec823a9238da.jpg';
  const DAYNIGHT_DEF = { id: 'ct-daynight', name: 'Day // Night', face: 'Day', backName: 'Night', type: 'Card', backType: 'Card', mana: '', cmc: 0, pt: null,
    oracle: '(If it becomes day or night or if a daybound permanent enters the battlefield, track day/night for the rest of the game.)\nAs it becomes day, transform all nightbound permanents.\nIf a player casts no spells during their own turn, it becomes night next turn.\n—\nAs it becomes night, transform all daybound permanents.\nPermanents enter the battlefield nightbound.\nIf a player casts at least two spells during their own turn, it becomes day next turn.',
    img: FRONT, imgBack: BACK, tokens: [], ci: [], trk: { kind: 'daynight', labels: ['☀', '☾'] } };
  window.CTTracks = { chapters, chapterLines, describe, state, DAYNIGHT_DEF, MAX_STEPS };
}());
