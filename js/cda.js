/* cda.js — power and toughness a card works out from a count of its own ("Bronze Guardian's power is equal to the number of artifacts you control",
 * "Mortivore's power and toughness are each equal to the number of creature cards in all graveyards", "…equal to the number of cards in your hand",
 * "…equal to your life total", Tarmogoyf-style "number of card types among cards in all graveyards … toughness is equal to that number plus 1").
 * Pure helpers, no page needed. The number is the card's BASE power/toughness: an Aura that sets a base, or a base set by hand, replaces it, and
 * counters, Equipment and other bonuses add on top (the page does that). Only counts the game can see are read: the battlefield, graveyards, hand
 * size and life totals. Anything else (mana value, the party, a chosen player, colours, "noted" numbers) is left alone and stays manual. */
(function () {
  'use strict';
  const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const PERMANENT_TYPES = ['artifact', 'creature', 'enchantment', 'land', 'planeswalker', 'battle'];
  const CARD_TYPES = ['artifact', 'creature', 'enchantment', 'instant', 'land', 'planeswalker', 'sorcery', 'battle', 'kindred', 'tribal', 'dungeon'];
  const TYPE_WORDS = { artifact: 'artifact', artifacts: 'artifact', creature: 'creature', creatures: 'creature', land: 'land', lands: 'land', enchantment: 'enchantment', enchantments: 'enchantment', planeswalker: 'planeswalker', planeswalkers: 'planeswalker', instant: 'instant', sorcery: 'sorcery' };
  const WORD_PREFIX_RE = /^(?:• )?[A-Z][\w'’.!,\- ]{1,40} — /;
  const singular = w => { const x = w.toLowerCase(); return [x, x.replace(/ves$/, 'f'), x.replace(/ves$/, 'fe'), x.replace(/ies$/, 'y'), x.replace(/es$/, ''), x.replace(/s$/, '')]; };
  const esc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // One counted thing: "artifacts you control", "creature cards in all graveyards", "cards in your hand", "your life total", "Elves you control".
  function parseCount(text) {
    let t = String(text || '').trim().replace(/[.]+$/, '').replace(/^the (?:total )?number of /i, '');
    if (/^your life total$/i.test(t)) return { zone: 'life', who: 'you' };
    if (/^cards? in your hand$/i.test(t)) return { zone: 'hand', who: 'you' };
    let m;
    // counters on the card itself ("charge counter on this Equipment", "+1/+1 counters on it"), Auras and Equipment attached to it, opponents you have
    if ((m = /^(?:(\+1\/\+1|-1\/-1|[a-z]{3,12}) )?counters? on (?:this [A-Za-z]+|it)$/i.exec(t))) return { zone: 'self', who: 'you', counter: m[1] ? m[1].toLowerCase() : 'any' };
    if ((m = /^((?:Aura|Equipment)s?(?: and (?:Aura|Equipment)s?)*) attached to (?:it|this [A-Za-z]+)$/i.exec(t))) return { zone: 'attached', who: 'all', tribes: m[1].split(/ and /i).map(x => x.replace(/s$/i, '')) };
    if (/^opponents? you have$/i.test(t)) return { zone: 'opponents', who: 'opp' };
    let withCounter = null;
    t = t.replace(/ with (?:an? |one or more )?(\+1\/\+1|-1\/-1|[a-z]{3,12}) counters? on (?:it|them)$/i, (all, nm) => { withCounter = nm.toLowerCase(); return ''; });
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
    if (withCounter) out.withCounter = withCounter;
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
      if (lw === 'permanents' || lw === 'permanent') { out.perm = true; continue; } // "permanent cards in your graveyard": a card that could be a permanent (no instants or sorceries)
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

  // "…for each creature you control and each creature card in your graveyard": the text after "for each", as one amount.
  function parseEach(text) {
    const t = String(text || '').trim().replace(/[.]+$/, '').replace(/^each /i, '').replace(/ and each /gi, ' plus the number of ');
    return /^[\w' ,+\-\/]{1,140}$/.test(t) ? parseAmount(t) : null;
  }
  function parse(oracle, name) {
    const names = [];
    if (name) { names.push(String(name).trim()); [String(name).split(',')[0].trim(), String(name).split(/,| the /)[0].trim()].forEach(short => { if (short && !names.includes(short)) names.push(short); }); } // "Tuvasa the Sunlit" is "Tuvasa" in its own text
    const SUBJ = '(?:This [a-z]+|' + names.map(esc).join('|') + (names.length ? '|' : '') + 'It)(?:\'s|’s)';
    const reBoth = new RegExp('^' + SUBJ + ' power and toughness are each equal to (.+)$', 'i');
    const rePower = new RegExp('^' + SUBJ + ' power is equal to (.+)$', 'i');
    const reTough = new RegExp('^' + SUBJ + ' toughness is equal to (.+)$', 'i');
    const reGoyf = new RegExp('^' + SUBJ + ' power is equal to (.+?) and its toughness is equal to that number plus (\\d+)$', 'i');
    const SUBJ_PLAIN = '(?:This [a-z]+|' + names.map(esc).join('|') + (names.length ? '|' : '') + 'It)';
    const reBonus = new RegExp('^' + SUBJ_PLAIN + ' gets ([+\\-\\u2212]\\d+)\\/([+\\-\\u2212]\\d+) for each (.+)$', 'i');
    const reWhere = new RegExp('^' + SUBJ_PLAIN + ' gets ([+\\-\\u2212])X\\/([+\\-\\u2212])(X|0),? where X is (the number of .+|your life total)$', 'i');
    let power = null, toughness = null, bonus = null;
    String(oracle == null ? '' : oracle).split(/\n—\n/)[0].split('\n').forEach(raw => {
      const line = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().replace(WORD_PREFIX_RE, '').replace(/[.]+$/, '');
      let m;
      if ((m = reBonus.exec(line))) { const amount = parseEach(m[3]); if (amount) bonus = { a: signed(m[1]), b: signed(m[2]), amount }; return; }
      if ((m = reWhere.exec(line))) { const amount = parseEach(m[4]); if (amount) bonus = { a: m[1] === '+' ? 1 : -1, b: m[3] === '0' ? 0 : (m[2] === '+' ? 1 : -1), amount }; return; }
      if ((m = reGoyf.exec(line))) { const a = parseAmount(m[1]); if (a) { power = a; toughness = Object.assign({}, a, { plus: a.plus + +m[2] }); } return; }
      if ((m = reBoth.exec(line))) { const a = parseAmount(m[1]); if (a) { power = a; toughness = a; } return; }
      if ((m = rePower.exec(line))) { const a = parseAmount(m[1]); if (a) power = a; return; }
      if ((m = reTough.exec(line))) { const a = parseAmount(m[1]); if (a) toughness = a; }
    });
    return power || toughness || bonus ? { power, toughness, bonus } : null;
  }

  const signed = v => +String(v).replace('\u2212', '-');
  // Validate a definition published by another player.
  function cleanCount(c) {
    if (!c || typeof c !== 'object') return null;
    const out = { zone: ['battlefield', 'graveyard', 'hand', 'life', 'self', 'attached', 'opponents'].includes(c.zone) ? c.zone : 'battlefield', who: ['you', 'opp', 'all'].includes(c.who) ? c.who : 'you' };
    if (typeof c.counter === 'string' && /^(?:any|\+1\/\+1|-1\/-1|[a-z]{3,12})$/.test(c.counter)) out.counter = c.counter;
    if (typeof c.withCounter === 'string' && /^(?:\+1\/\+1|-1\/-1|[a-z]{3,12})$/.test(c.withCounter)) out.withCounter = c.withCounter;
    if (Array.isArray(c.types)) { const t = c.types.filter(x => CARD_TYPES.includes(x)).slice(0, 4); if (t.length) out.types = t; }
    if (Array.isArray(c.tribes)) { const t = c.tribes.filter(x => typeof x === 'string' && /^[A-Za-z]{2,24}$/.test(x)).slice(0, 6); if (t.length) out.tribes = t; }
    ['nonbasic', 'faceDown', 'other', 'distinctTypes', 'distinctNames', 'perm'].forEach(k => { if (c[k] === true) out[k] = true; });
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
    let bonus = null;
    if (cda.bonus && typeof cda.bonus === 'object' && Number.isInteger(cda.bonus.a) && Number.isInteger(cda.bonus.b) && Math.abs(cda.bonus.a) <= 9 && Math.abs(cda.bonus.b) <= 9) {
      const amount = cleanAmount(cda.bonus.amount);
      if (amount) bonus = { a: cda.bonus.a, b: cda.bonus.b, amount };
    }
    return power || toughness || bonus ? { power, toughness, bonus } : null;
  }

  // ctx = { boards: [{ pid, battlefield: [{ c, def }], graveyard: [{ c, def }], hand: number, life: number }], pid: whose card it is, iid: the card itself }
  const typeLine = (c, def) => String((c && c.fl && def && def.backType) || (def && def.type) || '');
  const mainTypes = line => line.split('—')[0].toLowerCase().split(/\s+/).filter(w => CARD_TYPES.includes(w));
  function matches(count, e) {
    const c = e.c, def = e.def;
    if (count.other && c.iid === e.selfIid) return false;
    if (c.fd && count.withCounter && !(c.c && Object.entries(c.c).some(([k, v]) => v > 0 && k.toLowerCase() === count.withCounter))) return false;
    if (c.fd) { // a face-down permanent is a plain creature: it counts as a creature (and a permanent), nothing more specific
      if (count.faceDown) return true;
      return !count.tribes && !count.nonbasic && !count.distinctNames && !count.distinctTypes && (!count.types || count.types.includes('creature'));
    }
    if (count.faceDown) return false;
    if (count.withCounter && !(c.c && Object.entries(c.c).some(([k, v]) => v > 0 && k.toLowerCase() === count.withCounter))) return false;
    if (!def) return false;
    const line = typeLine(c, def), mains = mainTypes(line);
    if (count.perm && !mains.some(t => PERMANENT_TYPES.includes(t))) return false;
    if (count.types && !count.types.some(t => mains.includes(t))) return false;
    if (count.nonbasic && (!/\bLand\b/.test(line) || /\bBasic\b/.test(line))) return false;
    if (count.tribes && def.allTypes !== true) { // a Changeling is every creature type, so it counts for any tribe
      const subs = String(line.split('—')[1] || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!count.tribes.some(tr => singular(tr).some(s => subs.includes(s)))) return false;
    }
    return true;
  }
  function evalCount(count, ctx) {
    const boards = ctx.boards.filter(b => count.who === 'all' || (count.who === 'you') === (b.pid === ctx.pid));
    if (count.zone === 'life') return boards.reduce((n, b) => n + (Number.isFinite(b.life) ? b.life : 0), 0);
    if (count.zone === 'hand') return boards.reduce((n, b) => n + (b.hand || 0), 0);
    if (count.zone === 'opponents') return Math.max(0, ctx.boards.filter(b => b.pid !== ctx.pid).length);
    if (count.zone === 'self') { // counters on the card itself
      for (const b of ctx.boards) for (const e of (b.battlefield || [])) {
        if (e && e.c && e.c.iid === ctx.iid) return Object.entries(e.c.c || {}).reduce((a, [k, v]) => a + (v > 0 && (count.counter === 'any' || k.toLowerCase() === count.counter) ? v : 0), 0);
      }
      return 0;
    }
    if (count.zone === 'attached') { // Auras / Equipment attached to the card
      let k = 0;
      for (const b of ctx.boards) for (const e of (b.battlefield || [])) {
        if (e && e.c && e.c.att && e.c.att.i === ctx.iid && e.def && count.tribes.some(tr => new RegExp('\\b' + tr + '\\b', 'i').test(typeLine(e.c, e.def)))) k++;
      }
      return k;
    }
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
  // The pump a bonus gives right now: { dp, dt } (the amount counted times +a/+b).
  function evaluateBonus(bonus, ctx) {
    if (!bonus) return null;
    const n = evaluate(bonus.amount, ctx);
    return { dp: bonus.a * n, dt: bonus.b * n };
  }
  window.CTCda = { parse, clean, evaluate, evaluateBonus, parseEach, parseCount, parseAmount };
}());
