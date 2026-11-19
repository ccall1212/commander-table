/* cda.js — power and toughness a card works out from a count of its own ("Bronze Guardian's power is equal to the number of artifacts you control",
 * "Mortivore's power and toughness are each equal to the number of creature cards in all graveyards", "…equal to the number of cards in your hand",
 * "…equal to your life total", Tarmogoyf-style "number of card types among cards in all graveyards … toughness is equal to that number plus 1").
 * Pure helpers, no page needed. The number is the card's BASE power/toughness: an Aura that sets a base, or a base set by hand, replaces it, and
 * counters, Equipment and other bonuses add on top (the page does that). Only counts the game can see are read: the battlefield, graveyards, hand
 * size and life totals. Anything else (mana value, the party, a chosen player, colours, "noted" numbers) is left alone and stays manual. */
(function () {
  'use strict';
  const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const CARD_TYPES = ['artifact', 'creature', 'enchantment', 'instant', 'land', 'planeswalker', 'sorcery', 'battle', 'kindred', 'tribal', 'dungeon'];
  const TYPE_WORDS = { artifact: 'artifact', artifacts: 'artifact', creature: 'creature', creatures: 'creature', land: 'land', lands: 'land', enchantment: 'enchantment', enchantments: 'enchantment', planeswalker: 'planeswalker', planeswalkers: 'planeswalker', instant: 'instant', sorcery: 'sorcery' };
  const WORD_PREFIX_RE = /^(?:• )?[A-Z][\w'’.!,\- ]{1,40} — /;
  const singular = w => { const x = w.toLowerCase(); return [x, x.replace(/ves$/, 'f'), x.replace(/ves$/, 'fe'), x.replace(/ies$/, 'y'), x.replace(/es$/, ''), x.replace(/s$/, '')]; };
  const esc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // One counted thing: "artifacts you control", "creature cards in all graveyards", "cards in your hand", "your life total", "Elves you control".
  function parseCount(text) {
    let t = String(text || '').trim().replace(/[.]+$/, '').replace(/^the (?:total )?number of /i, '');
    if (/^your life total$/i.test(t)) return { zone: 'life', who: 'you' };
    if (/^cards in your hand$/i.test(t)) return { zone: 'hand', who: 'you' };
    let m = /^(.+?) (?:among|in) (.+)$/i.exec(t);
    let zone = 'battlefield', who = 'all';
    let noun = t;
    const gy = /^(?:(.*?) )?(?:in )?(your graveyard|all graveyards|your opponents'? graveyards)$/i.exec(t);
    if (gy) {
      zone = 'graveyard'; who = /^your graveyard/i.test(gy[2]) ? 'you' : /opponents/i.test(gy[2]) ? 'opp' : 'all';
      noun = String(gy[1] || 'cards').replace(/ in$/i, '');
    } else {
      m = /^(.+?) (you control|your opponents control|on the battlefield)$/i.exec(t);
      if (!m) return null;
      who = /^you control/i.test(m[2]) ? 'you' : /opponents/i.test(m[2]) ? 'opp' : 'all';
      noun = m[1];
    }
    const out = { zone, who };
    if (zone === 'graveyard' && /^card types among cards$/i.test(noun)) { out.distinctTypes = true; return out; }
    if (/^differently named lands$/i.test(noun)) { out.types = ['land']; out.distinctNames = true; return out; }
    if (/^face-down creatures$/i.test(noun)) { out.faceDown = true; return out; }
    noun = noun.replace(/^other /i, () => { out.other = true; return ''; });
    const types = [], tribes = [];
    const words = noun.replace(/,? and\/or /gi, ', ').replace(/,? and /gi, ', ').split(/,\s*|\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      const w = words[i], lw = w.toLowerCase();
      if (lw === 'cards' || lw === 'card') continue;
      if (lw === 'nonbasic') { out.nonbasic = true; continue; }
      if (lw === 'permanents' || lw === 'permanent') continue;
      if (TYPE_WORDS[lw]) { types.push(TYPE_WORDS[lw]); continue; }
      if (/^[A-Z][a-z]+s?$/.test(w) && w.length <= 24) { tribes.push(w); continue; } // a creature type: "Elves", "Zombie", "Forests"
      return null; // something we do not understand (a colour, "noncreature"…): leave it alone
    }
    if (types.length) out.types = types;
    if (tribes.length) out.tribes = tribes;
    return out;
  }

  // An amount: "the number of X", "twice the number of X", "1 plus the number of X", "the number of X plus the number of Y", "your life total".
  function parseAmount(text) {
    let t = String(text || '').trim().replace(/[.]+$/, '');
    let mult = 1, plus = 0, m;
    if ((m = /^(\d+) plus (.+)$/i.exec(t))) { plus = +m[1]; t = m[2]; }
    if ((m = /^twice (.+)$/i.exec(t))) { mult = 2; t = m[1]; }
    const terms = t.split(/ plus the number of /i).map(parseCount);
    if (!terms.length || terms.some(x => !x)) return null;
    return { terms, mult, plus };
  }

  // { power: amount|null, toughness: amount|null } for a card's rules text (front face only), or null.
  function parse(oracle, name) {
    const names = [];
    if (name) { names.push(String(name).trim()); const short = String(name).split(',')[0].trim(); if (short && short !== names[0]) names.push(short); }
    const SUBJ = '(?:This [a-z]+|' + names.map(esc).join('|') + (names.length ? '|' : '') + 'It)(?:\'s|’s)';
    const reBoth = new RegExp('^' + SUBJ + ' power and toughness are each equal to (.+)$', 'i');
    const rePower = new RegExp('^' + SUBJ + ' power is equal to (.+)$', 'i');
    const reTough = new RegExp('^' + SUBJ + ' toughness is equal to (.+)$', 'i');
    const reGoyf = new RegExp('^' + SUBJ + ' power is equal to (.+?) and its toughness is equal to that number plus (\\d+)$', 'i');
    let power = null, toughness = null;
    String(oracle == null ? '' : oracle).split(/\n—\n/)[0].split('\n').forEach(raw => {
      const line = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().replace(WORD_PREFIX_RE, '').replace(/[.]+$/, '');
      let m;
      if ((m = reGoyf.exec(line))) { const a = parseAmount(m[1]); if (a) { power = a; toughness = Object.assign({}, a, { plus: a.plus + +m[2] }); } return; }
      if ((m = reBoth.exec(line))) { const a = parseAmount(m[1]); if (a) { power = a; toughness = a; } return; }
      if ((m = rePower.exec(line))) { const a = parseAmount(m[1]); if (a) power = a; return; }
      if ((m = reTough.exec(line))) { const a = parseAmount(m[1]); if (a) toughness = a; }
    });
    return power || toughness ? { power, toughness } : null;
  }

  // Validate a definition published by another player.
  function cleanCount(c) {
    if (!c || typeof c !== 'object') return null;
    const out = { zone: ['battlefield', 'graveyard', 'hand', 'life'].includes(c.zone) ? c.zone : 'battlefield', who: ['you', 'opp', 'all'].includes(c.who) ? c.who : 'you' };
    if (Array.isArray(c.types)) { const t = c.types.filter(x => CARD_TYPES.includes(x)).slice(0, 4); if (t.length) out.types = t; }
    if (Array.isArray(c.tribes)) { const t = c.tribes.filter(x => typeof x === 'string' && /^[A-Za-z]{2,24}$/.test(x)).slice(0, 6); if (t.length) out.tribes = t; }
    ['nonbasic', 'faceDown', 'other', 'distinctTypes', 'distinctNames'].forEach(k => { if (c[k] === true) out[k] = true; });
    return out;
  }
  function cleanAmount(a) {
    if (!a || typeof a !== 'object' || !Array.isArray(a.terms)) return null;
    const terms = a.terms.slice(0, 3).map(cleanCount);
    if (!terms.length || terms.some(x => !x)) return null;
    const mult = Number.isInteger(a.mult) && a.mult >= 1 && a.mult <= 4 ? a.mult : 1, plus = Number.isInteger(a.plus) && a.plus >= 0 && a.plus <= 20 ? a.plus : 0;
    return { terms, mult, plus };
  }
  function clean(cda) {
    if (!cda || typeof cda !== 'object') return null;
    const power = cleanAmount(cda.power), toughness = cleanAmount(cda.toughness);
    return power || toughness ? { power, toughness } : null;
  }

  // ctx = { boards: [{ pid, battlefield: [{ c, def }], graveyard: [{ c, def }], hand: number, life: number }], pid: whose card it is, iid: the card itself }
  const typeLine = (c, def) => String((c && c.fl && def && def.backType) || (def && def.type) || '');
  const mainTypes = line => line.split('—')[0].toLowerCase().split(/\s+/).filter(w => CARD_TYPES.includes(w));
  function matches(count, e) {
    const c = e.c, def = e.def;
    if (count.other && c.iid === e.selfIid) return false;
    if (c.fd) { // a face-down permanent is a plain creature: it counts as a creature (and a permanent), nothing more specific
      if (count.faceDown) return true;
      return !count.tribes && !count.nonbasic && !count.distinctNames && !count.distinctTypes && (!count.types || count.types.includes('creature'));
    }
    if (count.faceDown) return false;
    if (!def) return false;
    const line = typeLine(c, def), mains = mainTypes(line);
    if (count.types && !count.types.some(t => mains.includes(t))) return false;
    if (count.nonbasic && (!/\bLand\b/.test(line) || /\bBasic\b/.test(line))) return false;
    if (count.tribes) {
      const subs = String(line.split('—')[1] || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!count.tribes.some(tr => singular(tr).some(s => subs.includes(s)))) return false;
    }
    return true;
  }
  function evalCount(count, ctx) {
    const boards = ctx.boards.filter(b => count.who === 'all' || (count.who === 'you') === (b.pid === ctx.pid));
    if (count.zone === 'life') return boards.reduce((n, b) => n + (Number.isFinite(b.life) ? b.life : 0), 0);
    if (count.zone === 'hand') return boards.reduce((n, b) => n + (b.hand || 0), 0);
    const names = new Set(), types = new Set();
    let n = 0;
    boards.forEach(b => (b[count.zone] || []).forEach(e => {
      if (!e || !e.c || !matches(count, { c: e.c, def: e.def, selfIid: ctx.iid })) return;
      n++;
      if (count.distinctNames && e.def) names.add(String(e.def.name || e.def.face || ''));
      if (count.distinctTypes && e.def) mainTypes(typeLine(e.c, e.def)).forEach(t => types.add(t));
    }));
    return count.distinctNames ? names.size : count.distinctTypes ? types.size : n;
  }
  function evaluate(amount, ctx) {
    if (!amount) return null;
    return Math.max(0, amount.terms.reduce((n, t) => n + evalCount(t, ctx), 0) * amount.mult + amount.plus);
  }
  window.CTCda = { parse, clean, evaluate, parseCount, parseAmount };
}());
