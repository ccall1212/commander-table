/* grants.js — abilities that one permanent gives to others ("Creatures you control with a +1/+1 counter on them have reach and
 * trample", "Other Dragons you control have flying"). Pure helpers, no page needed. The result is only drawn as extra ability
 * icons on the matching creatures; it never changes what is saved on a card. Only simple, common wording is understood and
 * anything else is left alone, so an unusual card just shows nothing. A grant has a scope: 'you' (permanents you control),
 * 'opp' (your opponents' permanents), 'all' ("All creatures have…") or 'attached' ("Equipped / Enchanted creature has…", which
 * applies to whatever the card is attached to, on any board). */
(function () {
  'use strict';
  const ABILITIES = ['deathtouch', 'defender', 'double strike', 'first strike', 'flying', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'trample', 'vigilance'];
  const TYPES = ['artifact', 'enchantment'];
  const MAX_GRANTS = 4;
  const LINE_RE = /^(?:[A-Z][\w'’ ]{1,24} — )?(Each |All |Other )?(.+?)(?: (you control|your opponents control|you don't control|an opponent controls|opponents control))?(?: with (.+?))? (?:have|has) (.+?)\.?$/i;
  const ATTACH_RE = /^(?:[A-Z][\w'’ ]{1,24} — )?(Equipped|Enchanted) creature (?:gets [^ ]+ and )?has (.+?)\.?$/i;
  const SCOPES = ['you', 'opp', 'all', 'attached'];
  const abilityList = text => {
    const parts = String(text || '').split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).map(x => x.trim().toLowerCase()).filter(Boolean);
    return parts.length && parts.every(p => ABILITIES.includes(p)) ? parts.filter((p, i) => parts.indexOf(p) === i) : null;
  };
  const singular = w => { const x = w.toLowerCase(); return [x, x.replace(/ves$/, 'f'), x.replace(/ves$/, 'fe'), x.replace(/ies$/, 'y'), x.replace(/es$/, ''), x.replace(/s$/, '')]; };

  function parseCondition(text) {
    const m = /^(?:(?:an?|one or more) )?(\+1\/\+1|-1\/-1|[a-z][a-z' -]{0,20}?) counters?(?: on (?:it|them))?$/i.exec(String(text || '').trim());
    if (!m) return null;
    return { counter: m[1].toLowerCase() === 'counter' ? 'any' : m[1] };
  }
  // The grants stated by one line of rules text, or null if the line is not a simple grant we understand.
  function parseLine(raw) {
    const line = String(raw || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const at = ATTACH_RE.exec(line);
    if (at) { // "Equipped creature gets +2/+2 and has trample." / "Enchanted creature has flying."
      const abilities = abilityList(at[2]);
      return abilities ? { scope: 'attached', attach: at[1].toLowerCase(), other: false, filters: { creature: true }, cond: null, abilities } : null;
    }
    const m = LINE_RE.exec(line);
    if (!m) return null;
    const ctl = String(m[3] || '').toLowerCase();
    const scope = ctl === 'you control' ? 'you' : ctl ? 'opp' : 'all';
    let other = /^other /i.test(m[1] || '');
    if (scope === 'all' && !m[1]) return null; // "Creatures have…" with no Each/All/Other is not a card's static ability we want to guess at
    const words = m[2].trim().split(' ');
    const g = { scope, other: false, filters: {}, cond: null, abilities: [] };
    if (words[0].toLowerCase() === 'other') { other = true; words.shift(); }
    g.other = other;
    let noun = words.pop();
    if (!noun) return null;
    if (/^creatures?$/i.test(noun) && words.length && /^[A-Z][a-z]+$/.test(words[words.length - 1]) && !['legendary', 'tapped', 'untapped', 'nontoken', 'nonlegendary', 'artifact', 'enchantment'].includes(words[words.length - 1].toLowerCase())) {
      noun = words.pop(); // "Sliver creatures": the creature type
    }
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
    if (m[4]) { g.cond = parseCondition(m[4]); if (!g.cond) return null; }
    const abilities = abilityList(m[5]);
    if (!abilities) return null;
    g.abilities = abilities;
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
      const out = { scope: SCOPES.includes(g.scope) ? g.scope : 'you', other: !!g.other, filters: {}, cond: null, abilities: [] };
      if (out.scope === 'attached') out.attach = g.attach === 'enchanted' ? 'enchanted' : 'equipped';
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
  // boards: [{ pid, entries: [{ c, def }] }] — every player's battlefield. Returns Map "pid|iid" -> [{ id, from }] of the abilities
  // other permanents give that card: by scope (yours, your opponents', everyone's, or what an Aura / Equipment is attached to).
  function forBoards(boards) {
    const sources = [];
    boards.forEach(b => b.entries.forEach(e => {
      if (!e || !e.c || !e.def || e.c.fd) return;
      const gr = Array.isArray(e.def.gr) ? clean(e.def.gr) : parse(e.def.oracle);
      if (gr.length) sources.push({ pid: b.pid, e, gr });
    }));
    const out = new Map();
    if (!sources.length) return out;
    boards.forEach(b => b.entries.forEach(t => {
      sources.forEach(s => s.gr.forEach(g => {
        const mine = s.pid === b.pid;
        if (g.scope === 'you' && !mine) return;
        if (g.scope === 'opp' && mine) return;
        if (g.scope === 'attached' && !(s.e.c.att && s.e.c.att.p === b.pid && s.e.c.att.i === t.c.iid)) return;
        if (!applies(g, t.c, t.def, s.e === t)) return;
        const key = b.pid + '|' + t.c.iid, list = out.get(key) || [];
        g.abilities.forEach(id => { if (!list.some(x => x.id === id)) list.push({ id, from: String(s.e.def.face || s.e.def.name || '').slice(0, 60), by: String(s.e.c.own || s.pid).slice(0, 40) }); });
        out.set(key, list);
      }));
    }));
    return out;
  }
  // One player's board on its own (everything is "yours").
  const forBoard = entries => { const m = forBoards([{ pid: 'p', entries }]), out = new Map(); m.forEach((v, k) => out.set(k.slice(2), v)); return out; };
  window.CTGrants = { parse, parseLine, clean, applies, forBoard, forBoards, ABILITIES };
}());
