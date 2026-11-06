/* grants.js — abilities that one permanent gives to others ("Creatures you control with a +1/+1 counter on them have reach and
 * trample", "Other Dragons you control have flying"). Pure helpers, no page needed. The result is only drawn as extra ability
 * icons on the matching creatures; it never changes what is saved on a card. Only simple, common wording is understood and
 * anything else is left alone, so an unusual card just shows nothing. Everything here is about permanents "you control", so a
 * board's grants only ever apply to that same player's board. */
(function () {
  'use strict';
  const ABILITIES = ['deathtouch', 'defender', 'double strike', 'first strike', 'flying', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'trample', 'vigilance'];
  const TYPES = ['artifact', 'enchantment'];
  const MAX_GRANTS = 4;
  const LINE_RE = /^(?:[A-Z][\w'’ ]{1,24} — )?(Each |All |Other )?(.+?) you control(?: with (.+?))? (?:have|has) (.+?)\.?$/i;
  const singular = w => { const x = w.toLowerCase(); return [x, x.replace(/ves$/, 'f'), x.replace(/ves$/, 'fe'), x.replace(/ies$/, 'y'), x.replace(/es$/, ''), x.replace(/s$/, '')]; };

  function parseCondition(text) {
    const m = /^(?:(?:an?|one or more) )?(\+1\/\+1|-1\/-1|[a-z][a-z' -]{0,20}?) counters?(?: on (?:it|them))?$/i.exec(String(text || '').trim());
    if (!m) return null;
    return { counter: m[1].toLowerCase() === 'counter' ? 'any' : m[1] };
  }
  // The grants stated by one line of rules text, or null if the line is not a simple grant we understand.
  function parseLine(raw) {
    const line = String(raw || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const m = LINE_RE.exec(line);
    if (!m) return null;
    let other = /^other /i.test(m[1] || '');
    const words = m[2].trim().split(' ');
    const g = { other: false, filters: {}, cond: null, abilities: [] };
    if (words[0].toLowerCase() === 'other') { other = true; words.shift(); }
    g.other = other;
    const noun = words.pop();
    if (!noun) return null;
    for (const wd of words.map(w => w.toLowerCase())) {
      if (wd === 'legendary') g.filters.legendary = true;
      else if (wd === 'nonlegendary') g.filters.legendary = false;
      else if (wd === 'tapped') g.filters.tapped = true;
      else if (wd === 'untapped') g.filters.tapped = false;
      else if (wd === 'nontoken') g.filters.token = false;
      else if (TYPES.includes(wd)) g.filters.type = wd[0].toUpperCase() + wd.slice(1);
      else return null; // an adjective we do not understand: leave the line alone
    }
    const n = noun.toLowerCase();
    if (n === 'creature' || n === 'creatures') g.filters.creature = true;
    else if (n === 'tokens' || n === 'token') g.filters.token = true;
    else if (/^[A-Z][a-z]+$/.test(noun) && noun.length <= 24) { g.filters.creature = true; g.filters.tribe = noun; } // a creature type: "Elves", "Other Dragons"
    else return null;
    if (m[3]) { g.cond = parseCondition(m[3]); if (!g.cond) return null; }
    const parts = m[4].split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!parts.length || !parts.every(p => ABILITIES.includes(p))) return null;
    g.abilities = parts.filter((p, i) => parts.indexOf(p) === i);
    return g;
  }
  const cache = new Map();
  // All grants of a card's rules text (front face only).
  function parse(oracle) {
    const key = String(oracle || '');
    if (cache.has(key)) return cache.get(key);
    const out = [];
    key.split(/\n—\n/)[0].split('\n').forEach(l => { const g = parseLine(l); if (g && out.length < MAX_GRANTS) out.push(g); });
    if (cache.size > 400) cache.clear();
    cache.set(key, out);
    return out;
  }
  // Validate grants received from another player's published definition.
  function clean(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_GRANTS).map(g => {
      if (!g || typeof g !== 'object') return null;
      const f = g.filters && typeof g.filters === 'object' ? g.filters : {};
      const out = { other: !!g.other, filters: {}, cond: null, abilities: [] };
      if (f.creature) out.filters.creature = true;
      if (typeof f.type === 'string' && TYPES.includes(f.type.toLowerCase())) out.filters.type = f.type[0].toUpperCase() + f.type.slice(1).toLowerCase();
      if (typeof f.tribe === 'string' && /^[A-Za-z]{2,24}$/.test(f.tribe)) out.filters.tribe = f.tribe;
      ['legendary', 'tapped', 'token'].forEach(k => { if (typeof f[k] === 'boolean') out.filters[k] = f[k]; });
      if (g.cond && typeof g.cond.counter === 'string' && /^(?:any|[A-Za-z+\-/0-9' ]{1,21})$/.test(g.cond.counter)) out.cond = { counter: g.cond.counter };
      out.abilities = (Array.isArray(g.abilities) ? g.abilities : []).filter(a => ABILITIES.includes(a)).slice(0, 6);
      return out.abilities.length ? out : null;
    }).filter(Boolean);
  }
  // Does grant g (from the card `src`) apply to the card `c` whose definition is `def`?
  function applies(g, c, def, isSource) {
    if (!c || !def || c.fd) return false;
    if (g.other && isSource) return false;
    const type = (c.fl && def.backType) || def.type || '', f = g.filters;
    if (f.creature && !/\bCreature\b/.test(type)) return false;
    if (f.type && !new RegExp('\\b' + f.type + '\\b').test(type)) return false;
    if (f.tribe) { const subs = String(type).split('—')[1] || ''; const have = subs.toLowerCase().split(/\s+/).filter(Boolean); if (!singular(f.tribe).some(t => have.includes(t))) return false; }
    if (f.legendary === true && !/\bLegendary\b/.test(type)) return false;
    if (f.legendary === false && /\bLegendary\b/.test(type)) return false;
    if (f.token === true && !c.tok) return false;
    if (f.token === false && c.tok) return false;
    if (f.tapped === true && !c.t) return false;
    if (f.tapped === false && c.t) return false;
    if (g.cond) {
      const ctr = c.c || {}, want = g.cond.counter;
      const has = want === 'any' ? Object.values(ctr).some(v => v > 0) : Object.entries(ctr).some(([k, v]) => v > 0 && k.toLowerCase() === want.toLowerCase());
      if (!has) return false;
    }
    return true;
  }
  // entries: [{ c, def }] for one player's battlefield. Returns Map iid -> [{ id, from }] of abilities granted by the other permanents.
  function forBoard(entries) {
    const sources = [];
    entries.forEach(e => {
      if (!e || !e.c || !e.def || e.c.fd) return;
      const gr = Array.isArray(e.def.gr) ? clean(e.def.gr) : parse(e.def.oracle);
      if (gr.length) sources.push({ e, gr });
    });
    const out = new Map();
    if (!sources.length) return out;
    entries.forEach(t => {
      sources.forEach(s => s.gr.forEach(g => {
        if (!applies(g, t.c, t.def, s.e === t)) return;
        const list = out.get(t.c.iid) || [];
        g.abilities.forEach(id => { if (!list.some(x => x.id === id)) list.push({ id, from: String(s.e.def.face || s.e.def.name || '').slice(0, 60) }); });
        out.set(t.c.iid, list);
      }));
    });
    return out;
  }
  window.CTGrants = { parse, parseLine, clean, applies, forBoard, ABILITIES };
}());
