/* grants.js — abilities and power/toughness that one permanent gives to others ("Creatures you control with a +1/+1 counter on them
 * have reach and trample", "Other Dragons you control have flying", "Enchanted creature gets +2/+2 and has vigilance", "Enchanted
 * creature has base power and toughness 0/1"). Pure helpers, no page needed. The result is only drawn (extra ability icons, and the
 * power/toughness badge); it never changes what is saved on a card. Only simple, common wording is understood and anything else is left
 * alone, so an unusual card just shows nothing. Things that depend on other game state (artifact counts, life totals, how many
 * creatures you control…) are deliberately NOT read: those stay manual.
 * A grant has a scope: 'you' (permanents you control), 'opp' (your opponents' permanents), 'all' ("All creatures have…"),
 * 'attached' ("Equipped / Enchanted creature…", which applies to whatever the card is attached to, on any board) or 'self'
 * (only the card itself). `cond` is checked on each receiving card (a counter on it); `when` is checked on the card giving the grant
 * (during your turn, untapped, you control your commander, N or more counters on it). */
(function () {
  'use strict';
  const ABILITIES = ['deathtouch', 'defender', 'double strike', 'first strike', 'flying', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'shroud', 'trample', 'vigilance'];
  const TYPES = ['artifact', 'enchantment', 'land', 'planeswalker'];
  const OUTLAWS = ['Assassin', 'Mercenary', 'Pirate', 'Rogue', 'Warlock']; // the "outlaw" creature types
  const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const MAX_GRANTS = 6;
  const MINUS = '[-\\u2212]';
  // Ability words and their dash may come first ("Lieutenant — …", "The Will of the Hive Mind — …", "Jump — …").
  const WORD_PREFIX_RE = /^(?:• )?[A-Z][\w'’.!,\- ]{1,40} — /;
  const LINE_RE = new RegExp('^(Each |All |Other )?(.+?)(?: (you control|your opponents control|you don\'t control|an opponent controls|opponents control))?(?: with (.+?))? (?:(?:gets?) ([+\\-\\u2212]\\d+)\\/([+\\-\\u2212]\\d+) and )?(?:have|has) (.+?)\\.?$', 'i');
  const SCOPES = ['you', 'opp', 'all', 'attached', 'self'];
  const num = w => NUMBERS[String(w).toLowerCase()] || (/^\d+$/.test(w) ? +w : 0);
  const signed = s => +String(s).replace('−', '-');
  const abilityList = text => {
    const parts = String(text || '').split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).map(x => x.trim().toLowerCase()).filter(Boolean);
    return parts.length && parts.every(p => ABILITIES.includes(p)) ? parts.filter((p, i) => parts.indexOf(p) === i) : null;
  };
  // The abilities at the start of each "has …" / "have …" clause of a sentence ("has vigilance, and can't attack you" -> vigilance).
  function leadingAbilities(sentence) {
    const out = [], re = /\b(?:has|have)\s+/gi;
    let m;
    while ((m = re.exec(sentence))) {
      let rest = sentence.slice(m.index + m[0].length);
      for (;;) {
        const a = /^(deathtouch|defender|double strike|first strike|flying|haste|hexproof|indestructible|lifelink|menace|reach|shroud|trample|vigilance)\b(?:,? and |, and |, | and )?/i.exec(rest);
        if (!a) break;
        const id = a[1].toLowerCase();
        if (!out.includes(id)) out.push(id);
        rest = rest.slice(a[0].length);
      }
    }
    return out;
  }
  const singular = w => { const x = w.toLowerCase(); return [x, x.replace(/ves$/, 'f'), x.replace(/ves$/, 'fe'), x.replace(/ies$/, 'y'), x.replace(/es$/, ''), x.replace(/s$/, '')]; };

  // "a +1/+1 counter on it", "counters on them", "a counter on it": the condition on the receiving card.
  function parseCondition(text) {
    const t = String(text || '').trim();
    if (/^(?:(?:an?|one or more) )?counters?(?: on (?:it|them))?$/i.test(t)) return { counter: 'any' };
    const m = /^(?:(?:an?|one or more) )?(\+1\/\+1|-1\/-1|[a-z][a-z' -]{0,20}?) counters?(?: on (?:it|them))?$/i.exec(t);
    if (!m) return null;
    return { counter: m[1].toLowerCase() === 'counter' ? 'any' : m[1] };
  }
  const ptOf = (a, b) => (a !== undefined && b !== undefined ? { dp: signed(a), dt: signed(b) } : null);

  // "…loses flying", "…loses all abilities", "…and it loses all other abilities": the abilities a card takes away (their icons are hidden).
  function losses(sentence) {
    const out = { ids: [], all: false };
    const re = /\bloses? (all(?: other)? abilities|((?:deathtouch|defender|double strike|first strike|flying|haste|hexproof|indestructible|lifelink|menace|reach|shroud|trample|vigilance)(?:(?:,? and |, and |, )(?:deathtouch|defender|double strike|first strike|flying|haste|hexproof|indestructible|lifelink|menace|reach|shroud|trample|vigilance))*))/gi;
    let m;
    while ((m = re.exec(sentence))) { if (/^all/i.test(m[1])) out.all = true; else abilityList(m[2]).forEach(id => { if (!out.ids.includes(id)) out.ids.push(id); }); }
    return out;
  }
  // ---- Card types and creature types ("is a blue Frog", "are Islands in addition to their other types", Changeling) ----
  const MAIN_WORDS = { artifact: 'Artifact', creature: 'Creature', land: 'Land', enchantment: 'Enchantment', planeswalker: 'Planeswalker' };
  const SUPERTYPES = ['legendary', 'snow', 'basic', 'world', 'token', 'nonbasic', 'nonlegendary'];
  const COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless', 'multicolored'];
  const typeSingular = w => (/ves$/i.test(w) ? w.replace(/ves$/i, 'f') : /ies$/i.test(w) ? w.replace(/ies$/i, 'y') : /[^s]s$/i.test(w) ? w.replace(/s$/i, '') : w);
  // "blue Frog", "Insect artifact creature", "colorless land", "Treasure artifact", "Islands", "artifacts": the card types and the subtypes it names.
  function typePhrase(descriptor) {
    const M = [], S = [];
    String(descriptor || '').split(/\s+/).filter(Boolean).forEach(w => {
      const lw = w.toLowerCase();
      if (MAIN_WORDS[lw] || MAIN_WORDS[lw.replace(/s$/, '')]) { const v = MAIN_WORDS[lw] || MAIN_WORDS[lw.replace(/s$/, '')]; if (!M.includes(v)) M.push(v); }
      else if (!COLORS.includes(lw) && !SUPERTYPES.includes(lw) && /^[A-Z][a-z]+$/.test(w)) { const v = typeSingular(w); if (!S.includes(v)) S.push(v); }
    });
    return M.length || S.length ? { M, S } : null;
  }
  // The type change stated by one sentence about an attached creature / permanent: { mode: 'set' | 'add', M, S } or null.
  function parseTypeChange(s) {
    let m = /\bis (?:an? )?([^,.]+?) in addition to (?:its|their) other (?:card |creature )?types\b/i.exec(s), p;
    if (m) { p = typePhrase(m[1]); return p ? { mode: 'add', M: p.M, S: p.S } : null; }
    m = /\bis (?:an? )?([^,.]*?)(?: with (?:base power and toughness|crew|\{)|,| and (?:has|loses|it loses|can't|gets)\b|\.|$)/i.exec(s);
    if (m) { p = typePhrase(m[1].replace(/\bwith\b.*$/i, '')); if (p) return { mode: 'set', M: p.M, S: p.S }; }
    return null;
  }
  // "Enchanted creature gets +2/+2, has vigilance, and can't attack you." / "…has base power and toughness 0/1." — one or more sentences.
  function parseAttached(line) {
    const out = [];
    let lastHead = null;
    line.split(/(?<=\.)\s+/).forEach(raw => {
      // "As long as equipped creature is legendary, it has hexproof." (Champion's Helm) / "As long as it's legendary, it gets an additional +2/+2." (Tenza):
      // a condition on the creature's own card type, which the game can see.
      const cl = /^As long as (?:(Equipped|Enchanted) creature|it)(?: is|'s) legendary, (?:it )?(.+?)\.?$/i.exec(raw);
      if (cl) {
        const who = (cl[1] || lastHead || '').toLowerCase();
        if (!who) return;
        const body = cl[2].replace(/"[^"]*"/g, ' ');
        if (/\b(?:as long as|if |unless|until|during)\b/i.test(body)) return;
        const bpt = /\bgets? (?:an additional )?([+\-\u2212]\d+)\/([+\-\u2212]\d+)\b(?!\s+(?:for each|where|plus))/i.exec(body);
        const babilities = /^(?:has|have|gets?)\b/i.test(body) ? leadingAbilities(body) : [];
        if (!babilities.length && !bpt) return;
        out.push({ scope: 'attached', attach: who, other: false, filters: { creature: true, legendary: true }, cond: null, when: null, abilities: babilities, pt: bpt ? ptOf(bpt[1], bpt[2]) : null, base: null, lose: [], loseAll: false });
        return;
      }
      const head = /^(Equipped|Enchanted) (creature|permanent)\b/i.exec(raw);
      if (!head) return;
      lastHead = head[1];
      const s = raw.replace(/"[^"]*"/g, ' ').replace(/\s+/g, ' ').trim(); // quoted abilities (a trigger it gains) are read as reminders instead
      if (/\b(?:as long as|if |unless|until|during)\b/i.test(s)) return; // conditional: left to the player
      const pt = new RegExp('\\bgets? ([+\\-\\u2212]\\d+)\\/([+\\-\\u2212]\\d+)\\b(?!\\s+(?:for each|where|plus))', 'i').exec(s);
      const base = /\bbase power and toughness (\d{1,2})\/(\d{1,2})\b/i.exec(s);
      // "gets +1/+1 for each Elf you control" (Crown of Skemfar): a pump per counted thing. The page counts it (it knows the boards); here only the wording is kept.
      const eachM = new RegExp('\\bgets? ([+\\-\\u2212]\\d+)\\/([+\\-\\u2212]\\d+) for each (.+?)(?:,? and (?:has|have)\\b.*)?\\.?$', 'i').exec(s);
      const whereM = new RegExp('\\bgets? ([+\\-\\u2212])X\\/([+\\-\\u2212])(X|0),? where X is (the number of .+?)(?:,? and (?:has|have)\\b.*)?\\.?$', 'i').exec(s);
      const each = eachM && /^[\w' ,+\-\/]{1,140}$/.test(eachM[3]) ? { a: signed(eachM[1]), b: signed(eachM[2]), text: eachM[3] }
        : whereM && /^[\w' ,+\-\/]{1,140}$/.test(whereM[4]) ? { a: whereM[1] === '+' ? 1 : -1, b: whereM[3] === '0' ? 0 : (whereM[2] === '+' ? 1 : -1), text: whereM[4] } : null; // "+X/+X, where X is the number of …" (Bonehoard)
      const abilities = leadingAbilities(s), lost = losses(s), types = parseTypeChange(s);
      if (!abilities.length && !pt && !base && !each && !types && !lost.ids.length && !lost.all) return;
      out.push({ scope: 'attached', attach: head[1].toLowerCase(), other: false, filters: /^creature$/i.test(head[2]) ? { creature: true } : {}, types, cond: null, when: null, abilities, pt: pt ? ptOf(pt[1], pt[2]) : null, base: base ? base[1] + '/' + base[2] : null, each, lose: lost.ids, loseAll: lost.all });
    });
    return out;
  }

  // Lines about the card itself, and the "Lieutenant" pair (this creature and the rest of your creatures), with a condition on the card.
  function parseSelf(line, name) {
    const names = [];
    if (name) { names.push(name); [String(name).split(',')[0].trim(), String(name).split(/,| the /)[0].trim()].forEach(short => { if (short && !names.includes(short)) names.push(short); }); } // "Tuvasa the Sunlit" is "Tuvasa" in its own text
    const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const SELF = '(?:this (?:creature|permanent|artifact|vehicle|spacecraft|land|enchantment)|it' + names.map(n => '|' + esc(n)).join('') + ')';
    const l = line.replace(/[.]+$/, '');
    let m;
    const grant = (when, abilities, pt) => ({ scope: 'self', other: false, filters: {}, cond: null, when, abilities, pt: pt || null, base: null, lose: [], loseAll: false });
    if ((m = new RegExp('^During your turn, ' + SELF + ' has (.+)$', 'i').exec(l))) { const a = abilityList(m[1]); return a ? [grant({ turn: true }, a)] : []; }
    if ((m = new RegExp('^' + SELF + ' has (.+?) as long as it\'?s untapped$', 'i').exec(l))) { const a = abilityList(m[1]); return a ? [grant({ untapped: true }, a)] : []; }
    const counters = (n, type) => ({ selfCounters: { name: type ? type.toLowerCase() : 'any', min: num(n) } });
    if ((m = new RegExp('^As long as ' + SELF + ' has (\\w+) or more (?:(\\+1\\/\\+1|[a-z]+) )?counters on (?:it|itself), ' + SELF + ' has (.+?)(?: and is (?:an? )?([A-Z]\\w+) in addition to its other types)?$', 'i').exec(l)) && num(m[1])) {
      const a = abilityList(m[3]); if (!a) return [];
      const g = grant(counters(m[1], m[2]), a); if (m[4]) g.types = { mode: 'add', M: [], S: [m[4]] }; // Hero of Bretagard: "…and is a God in addition to its other types"
      return [g];
    }
    if ((m = new RegExp('^' + SELF + ' has (.+?) as long as it has (\\w+) or more (?:(\\+1\\/\\+1|[a-z]+) )?counters on it$', 'i').exec(l)) && num(m[2])) {
      const a = abilityList(m[1]); return a ? [grant(counters(m[2], m[3]), a)] : [];
    }
    if ((m = new RegExp('^As long as you control your commander, ' + SELF + ' gets ([+\\-\\u2212]\\d+)\\/([+\\-\\u2212]\\d+) and (other )?creatures you control (?:get ([+\\-\\u2212]\\d+)\\/([+\\-\\u2212]\\d+) and )?have (.+)$', 'i').exec(l))) {
      const a = abilityList(m[6]); if (!a) return [];
      return [grant({ commander: true }, [], ptOf(m[1], m[2])),
        { scope: 'you', other: !!m[3], filters: { creature: true }, cond: null, when: { commander: true }, abilities: a, pt: ptOf(m[4], m[5]), base: null, lose: [], loseAll: false }];
    }
    return [];
  }

  // The who-gets-it half of a group line ("Other Orcs and Goblins you control", "Each creature you control with a +1/+1 counter on it"),
  // or null when the wording is not one we understand.
  function subjectGrant(prefix, subjectText, controller, withText, pt) {
    const ctl = String(controller || '').toLowerCase();
    const scope = ctl === 'you control' ? 'you' : ctl ? 'opp' : 'all';
    let other = /^other /i.test(prefix || '');
    if (scope === 'all' && !prefix) return null; // "Creatures have…" with no Each/All/Other is not a card's static ability we want to guess at
    let subject = String(subjectText).trim();
    const g = { scope, other: false, filters: {}, cond: null, when: null, abilities: [], pt, base: null, lose: [], loseAll: false };
    if (/^other /i.test(subject)) { other = true; subject = subject.replace(/^other /i, ''); }
    g.other = other;
    // Two creature types in one line ("Orcs and Goblins", "Beasts and Birds") or the outlaw types.
    const pair = /^([A-Z][a-z]+s?)(?:,? and ([A-Z][a-z]+s?))+$/.exec(subject);
    if (pair) { g.filters.creature = true; g.filters.tribes = subject.split(/,? and /).slice(0, 6); }
    else if (/^outlaws$/i.test(subject)) { g.filters.creature = true; g.filters.tribes = OUTLAWS.slice(); }
    else {
      const words = subject.split(' ');
      let noun = words.pop();
      if (!noun) return null;
      if (/^creatures?$/i.test(noun) && words.length && /^[A-Z][a-z]+$/.test(words[words.length - 1]) && !['legendary', 'tapped', 'untapped', 'nontoken', 'nonlegendary', 'artifact', 'enchantment', 'commander', 'creature', 'modified'].includes(words[words.length - 1].toLowerCase())) {
        noun = words.pop(); // "Sliver creatures": the creature type
      }
      if (/^tokens?$/i.test(noun) && words.length && /^[A-Z][a-z]+$/.test(words[words.length - 1]) && !['creature', 'artifact', 'legendary'].includes(words[words.length - 1].toLowerCase())) {
        g.filters.tribe = words.pop(); g.filters.creature = true; // "Zombie tokens you control"
      }
      for (const wd of words.map(w => w.toLowerCase())) {
        if (wd === 'legendary') g.filters.legendary = true;
        else if (wd === 'nonlegendary') g.filters.legendary = false;
        else if (wd === 'tapped') g.filters.tapped = true;
        else if (wd === 'untapped') g.filters.tapped = false;
        else if (wd === 'nontoken') g.filters.token = false;
        else if (wd === 'nonland') g.filters.notLand = true;
        else if (wd === 'commander') g.filters.commander = true; // "Commander creatures you control have haste"
        else if (wd === 'modified') g.filters.modified = true;   // "Other modified creatures you control have vigilance"
        else if (wd === 'creature') g.filters.creature = true;   // "Creature tokens you control have haste"
        else if (TYPES.includes(wd)) g.filters.type = wd[0].toUpperCase() + wd.slice(1);
        else return null; // an adjective we do not understand: leave the line alone
      }
      const n = noun.toLowerCase();
      const typeNoun = TYPES.find(t => n === t || n === t + 's');
      if (n === 'creature' || n === 'creatures') g.filters.creature = true;
      else if (typeNoun) g.filters.type = typeNoun[0].toUpperCase() + typeNoun.slice(1); // "Other enchantments", "Artifacts you control"
      else if (n === 'permanent' || n === 'permanents') { /* any permanent: no type filter */ }
      else if (n === 'tokens' || n === 'token') g.filters.token = true;
      else if (/^[A-Z][a-z]+$/.test(noun) && noun.length <= 24) { g.filters.creature = true; g.filters.tribe = noun; } // a creature type: "Elves", "Other Dragons"
      else return null;
    }
    if (withText) { g.cond = parseCondition(withText); if (!g.cond) return null; }
    return g;
  }
  // A plain anthem: "Elves you control get +1/+1." / "Other creatures you control get +1/+1." / "All Elves get +1/+1." Only when the line ends right
  // after the numbers: "until end of turn", "for each …" and "as long as …" are not static anthems and are left alone.
  const ANTHEM_RE = /^(Each |All |Other )?(.+?)(?: (you control|your opponents control|you don't control|an opponent controls|opponents control))?(?: with (.+?))? gets? ([+\-\u2212]\d+)\/([+\-\u2212]\d+)\.?$/i;

  // "Creatures your opponents control lose flying." (optionally "and can't have or gain flying"): a group that loses abilities.
  const LOSE_RE = /^(Each |All |Other )?(.+?)(?: (you control|your opponents control|you don't control|an opponent controls|opponents control))?(?: with (.+?))? loses? (.+?)(?: and can't have or gain .+)?\.?$/i;
  const EVERY_RE = /^(Each |All |Other )?(.+?)(?: (you control|your opponents control|you don't control|an opponent controls|opponents control))?(?: with (.+?))? (?:is|are) every creature type\.?$/i;
  const ADD_RE = /^(Each |All |Other )?(.+?)(?: (you control|your opponents control|you don't control|an opponent controls|opponents control))?(?: with (.+?))? (?:is|are) (?:an? )?(.+?) in addition to (?:its|their) other (?:card |creature )?types\b.*$/i;
  // Every grant stated by one line of rules text (an empty list when it is not a simple grant we understand).
  function parseAll(raw, name) {
    const line = String(raw || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().replace(WORD_PREFIX_RE, '');
    if (/^(?:Equipped|Enchanted) (?:creature|permanent)\b/i.test(line) || /^As long as (?:equipped|enchanted) creature is legendary,/i.test(line)) return parseAttached(line);
    // Changeling: every creature type. (Its reminder text is already removed.)
    if (line.length < 70 && !/[:"]/.test(line) && line.split(/\s*,\s*/).some(k => /^changeling$/i.test(k))) return [{ scope: 'self', other: false, filters: {}, cond: null, when: null, abilities: [], pt: null, base: null, lose: [], loseAll: false, types: { all: true } }];
    const self = parseSelf(line, name);
    if (self.length) return self;
    let m = LINE_RE.exec(line);
    if (m) {
      const g = subjectGrant(m[1], m[2], m[3], m[4], ptOf(m[5], m[6]));
      const abilities = g && abilityList(m[7]);
      if (abilities) { g.abilities = abilities; return [g]; } // otherwise try the other shapes below ("…lose flying and can't have or gain flying" also contains "have")
    }
    m = ANTHEM_RE.exec(line);
    if (m) { const g = subjectGrant(m[1], m[2], m[3], m[4], ptOf(m[5], m[6])); return g ? [g] : []; }
    m = LOSE_RE.exec(line);
    if (m) { const lost = abilityList(m[5]); const g = lost && subjectGrant(m[1], m[2], m[3], m[4], null); if (g) { g.lose = lost; return [g]; } }
    m = EVERY_RE.exec(line); // "Each nonland creature with an everything counter on it is every creature type." (Omo)
    if (m) { const g = subjectGrant(m[1], m[2], m[3], m[4], null); if (g) { g.types = { all: true }; return [g]; } }
    // "All lands are Islands in addition to their other types." Also "Lands you control and land cards you own that aren't on the battlefield are Deserts…" (the part about cards elsewhere is dropped).
    m = ADD_RE.exec(line.replace(/ The same is true .*$/i, '').replace(/ and [a-z' ,\-]+ (?:spells|cards) you (?:control|own)(?: that aren't on the battlefield)?(?= (?:are|is) )/i, ''));
    if (m) { const p = typePhrase(m[5]); const g = p && subjectGrant(m[1], m[2], m[3], m[4], null); if (g) { g.types = { mode: 'add', M: p.M, S: p.S }; return [g]; } }
    return [];
  }
  const parseLine = (raw, name) => parseAll(raw, name)[0] || null;
  const cache = new Map();
  // All grants of a card's rules text (front face only). `name` is the card's face name, for lines about the card itself ("Cait has…").
  function parse(oracle, name) {
    const key = String(name || '') + '\u0001' + String(oracle || '');
    if (cache.has(key)) return cache.get(key);
    const out = [];
    String(oracle || '').split(/\n—\n/)[0].split('\n').forEach(l => { parseAll(l, name).forEach(g => { if (out.length < MAX_GRANTS) out.push(g); }); });
    if (cache.size > 400) cache.clear();
    cache.set(key, out);
    return out;
  }
  const intOrNull = v => (Number.isInteger(v) && Math.abs(v) <= 99 ? v : null);
  // Validate grants received from another player's published definition.
  function clean(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_GRANTS).map(g => {
      if (!g || typeof g !== 'object') return null;
      const f = g.filters && typeof g.filters === 'object' ? g.filters : {};
      const out = { scope: SCOPES.includes(g.scope) ? g.scope : 'you', other: !!g.other, filters: {}, cond: null, when: null, abilities: [], pt: null, base: null, lose: [], loseAll: false };
      if (out.scope === 'attached') out.attach = g.attach === 'enchanted' ? 'enchanted' : 'equipped';
      if (f.creature) out.filters.creature = true;
      if (typeof f.type === 'string' && TYPES.includes(f.type.toLowerCase())) out.filters.type = f.type[0].toUpperCase() + f.type.slice(1).toLowerCase();
      if (typeof f.tribe === 'string' && /^[A-Za-z]{2,24}$/.test(f.tribe)) out.filters.tribe = f.tribe;
      if (Array.isArray(f.tribes)) out.filters.tribes = f.tribes.filter(t => typeof t === 'string' && /^[A-Za-z]{2,24}$/.test(t)).slice(0, 6);
      ['legendary', 'tapped', 'token'].forEach(k => { if (typeof f[k] === 'boolean') out.filters[k] = f[k]; });
      if (f.notLand === true) out.filters.notLand = true;
      if (f.commander === true) out.filters.commander = true;
      if (f.modified === true) out.filters.modified = true;
      if (g.cond && typeof g.cond.counter === 'string' && /^(?:any|[A-Za-z+\-/0-9' ]{1,21})$/.test(g.cond.counter)) out.cond = { counter: g.cond.counter };
      if (g.when && typeof g.when === 'object') {
        const w = {};
        if (g.when.turn === true) w.turn = true;
        if (g.when.untapped === true) w.untapped = true;
        if (g.when.commander === true) w.commander = true;
        const sc = g.when.selfCounters;
        if (sc && typeof sc.name === 'string' && /^(?:any|[A-Za-z+\-/0-9' ]{1,21})$/.test(sc.name) && Number.isInteger(sc.min) && sc.min >= 1 && sc.min <= 99) w.selfCounters = { name: sc.name, min: sc.min };
        if (Object.keys(w).length) out.when = w;
      }
      out.abilities = (Array.isArray(g.abilities) ? g.abilities : []).filter(a => ABILITIES.includes(a)).slice(0, 6);
      if (g.pt && typeof g.pt === 'object' && intOrNull(g.pt.dp) !== null && intOrNull(g.pt.dt) !== null) out.pt = { dp: g.pt.dp, dt: g.pt.dt };
      if (typeof g.base === 'string' && /^\d{1,2}\/\d{1,2}$/.test(g.base)) out.base = g.base;
      out.lose = (Array.isArray(g.lose) ? g.lose : []).filter(a => ABILITIES.includes(a)).slice(0, 6);
      out.loseAll = g.loseAll === true;
      out.types = null;
      if (g.types && typeof g.types === 'object') {
        if (g.types.all === true) out.types = { all: true };
        else if (g.types.mode === 'set' || g.types.mode === 'add') {
          const M = (Array.isArray(g.types.M) ? g.types.M : []).filter(x => Object.values(MAIN_WORDS).includes(x)).slice(0, 4), S = (Array.isArray(g.types.S) ? g.types.S : []).filter(x => typeof x === 'string' && /^[A-Za-z]{2,24}$/.test(x)).slice(0, 4);
          if (M.length || S.length) out.types = { mode: g.types.mode, M, S };
        }
      }
      out.each = g.each && Number.isInteger(g.each.a) && Number.isInteger(g.each.b) && Math.abs(g.each.a) <= 9 && Math.abs(g.each.b) <= 9 && typeof g.each.text === 'string' && /^[\w' ,+\-\/]{1,140}$/.test(g.each.text) ? { a: g.each.a, b: g.each.b, text: g.each.text } : null;
      return out.abilities.length || out.pt || out.base || out.each || out.types || out.lose.length || out.loseAll ? out : null;
    }).filter(Boolean);
  }
  // Does grant g (from the card `src`) apply to the card `c` whose definition is `def`? mods = { modified } facts about c that need the whole board.
  function applies(g, c, def, isSource, mods) {
    if (!c || !def || c.fd) return false;
    if (g.other && isSource) return false;
    const type = (c.fl && def.backType) || def.type || '', f = g.filters;
    if (f.creature && !/\bCreature\b/.test(type)) return false;
    if (f.type && !new RegExp('\\b' + f.type + '\\b').test(type)) return false;
    const have = String(type).split('—')[1] ? String(type).split('—')[1].toLowerCase().split(/\s+/).filter(Boolean) : [];
    const everyType = def.allTypes === true; // a Changeling is every creature type
    if (f.tribe && !everyType && !singular(f.tribe).some(t => have.includes(t))) return false;
    if (f.tribes && f.tribes.length && !everyType && !f.tribes.some(tr => singular(tr).some(t => have.includes(t)))) return false;
    if (f.notLand && /\bLand\b/.test(type)) return false;
    if (f.commander && !c.cmd) return false;
    if (f.modified && !(mods && mods.modified)) return false;
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
  // The condition on the card GIVING the grant: during its controller's turn, untapped, its controller controls their commander, N or more counters on it.
  function whenOk(g, s, board, ctx) {
    const w = g.when;
    if (!w) return true;
    if (w.turn && !(ctx && ctx.active === s.pid)) return false;
    if (w.untapped && s.e.c.t) return false;
    if (w.commander && !board.entries.some(x => x && x.c && x.c.cmd && !x.c.fd)) return false;
    if (w.selfCounters) {
      const ctr = s.e.c.c || {}, want = w.selfCounters.name.toLowerCase();
      const n = want === 'any' ? Object.values(ctr).reduce((a, v) => a + (v > 0 ? v : 0), 0) : Object.entries(ctr).reduce((a, [k, v]) => a + (k.toLowerCase() === want && v > 0 ? v : 0), 0);
      if (n < w.selfCounters.min) return false;
    }
    return true;
  }
  // boards: [{ pid, entries: [{ c, def }] }] — every player's battlefield. ctx = { active: the pid whose turn it is }.
  // Returns Map "pid|iid" -> [{ id, from, by }] of the abilities other permanents give that card: by scope (yours, your opponents', everyone's, what an
  // Aura / Equipment is attached to, or itself). The Map's `pt` property is another Map "pid|iid" -> { dp, dt, base, from: [{ from, dp, dt, base }] }:
  // the power/toughness those permanents give it (a base power/toughness replaces the printed one; the other changes add to it).
  function forBoards(boards, ctx) {
    const sources = [];
    boards.forEach(b => b.entries.forEach(e => {
      if (!e || !e.c || !e.def || e.c.fd) return;
      const gr = Array.isArray(e.def.gr) ? clean(e.def.gr) : parse(e.def.oracle, e.def.face || e.def.name);
      if (gr.length) sources.push({ pid: b.pid, e, gr, board: b });
    }));
    const out = new Map(); out.pt = new Map(); out.lose = new Map(); out.types = new Map();
    if (!sources.length) return out;
    // "Modified": has a counter, or an Equipment / Aura its controller controls attached to it.
    const attachedBy = new Map();
    boards.forEach(b => b.entries.forEach(a => { if (a && a.c && a.c.att && a.def && /\b(?:Equipment|Aura)\b/.test(a.def.type || '')) { const key = a.c.att.p + '|' + a.c.att.i; (attachedBy.get(key) || attachedBy.set(key, []).get(key)).push(b.pid); } }));
    const isModified = (b, t) => !!t.c && (Object.values(t.c.c || {}).some(v => v > 0) || (attachedBy.get(b.pid + '|' + t.c.iid) || []).includes(b.pid));
    const reaches = (g, s, b, t, def) => { // does grant g of source s reach card t on board b?
      const mine = s.pid === b.pid;
      if (g.scope === 'you' && !mine) return false;
      if (g.scope === 'opp' && mine) return false;
      if (g.scope === 'self' && !(s.e === t)) return false;
      if (g.scope === 'attached' && !(s.e.c.att && s.e.c.att.p === b.pid && s.e.c.att.i === t.c.iid)) return false;
      if (!applies(g, t.c, def, s.e === t, { modified: isModified(b, t) })) return false;
      return whenOk(g, s, s.board, ctx);
    };
    // Pass 1: card types and creature types (they come first: "Elves you control" must see a Frog's new type, a Changeling's every type).
    const MAIN_ORDER = ['Artifact', 'Enchantment', 'Land', 'Creature', 'Planeswalker'];
    boards.forEach(b => b.entries.forEach(t => {
      if (!t || !t.c || !t.def || t.c.fd) return;
      sources.forEach(s => s.gr.forEach(g => {
        if (!g.types || !reaches(g, s, b, t, t.def)) return;
        const key = b.pid + '|' + t.c.iid, from = String(s.e.def.face || s.e.def.name || '').slice(0, 60);
        let fx = out.types.get(key);
        if (!fx) {
          const line = String((t.c.fl && t.def.backType) || t.def.type || ''), parts = line.split('—'), words = parts[0].split(/\s+/).filter(Boolean);
          fx = { supers: words.filter(w => !Object.values(MAIN_WORDS).includes(w) && !/^(?:Instant|Sorcery|Battle|Kindred|Tribal)$/.test(w)), main: words.filter(w => Object.values(MAIN_WORDS).includes(w) || /^(?:Instant|Sorcery|Battle|Kindred|Tribal)$/.test(w)), subs: String(parts[1] || '').split(/\s+/).filter(Boolean), all: false, tags: [], line };
          out.types.set(key, fx);
        }
        const tag = label => { if (!fx.tags.some(x => x.label === label)) fx.tags.push({ label, from }); };
        if (g.types.all) { fx.all = true; tag('All types'); }
        else {
          if (g.types.mode === 'set') { if (g.types.M.length) fx.main = g.types.M.slice(); fx.subs = g.types.S.slice(); }
          else { g.types.M.forEach(x => { if (!fx.main.includes(x)) fx.main.push(x); }); g.types.S.forEach(x => { if (!fx.subs.includes(x)) fx.subs.push(x); }); }
          (g.types.S.length ? g.types.S : g.types.M).forEach(tag);
        }
        fx.main.sort((x, y) => MAIN_ORDER.indexOf(x) - MAIN_ORDER.indexOf(y));
        fx.line = fx.supers.concat(fx.main).join(' ') + (fx.subs.length ? ' \u2014 ' + fx.subs.join(' ') : '');
      }));
    }));
    if (ctx && typeof ctx.onTypes === 'function') ctx.onTypes(out.types); // lets the page count with the new types before the rest is worked out
    // Pass 2: everything else, seen through the new types.
    boards.forEach(b => b.entries.forEach(t => {
      const tfx = t.c ? out.types.get(b.pid + '|' + t.c.iid) : null;
      const tdef = tfx ? Object.assign({}, t.def, { type: tfx.line, backType: tfx.line, allTypes: tfx.all }) : t.def;
      sources.forEach(s => s.gr.forEach(g => {
        if (g.types && !g.abilities.length && !g.pt && !g.base && !g.each && !(g.lose && g.lose.length) && !g.loseAll) return; // a type-only grant was dealt with in pass 1
        if (!reaches(g, s, b, t, tdef)) return;
        const key = b.pid + '|' + t.c.iid, from = String(s.e.def.face || s.e.def.name || '').slice(0, 60);
        if (g.abilities.length) {
          const list = out.get(key) || [];
          g.abilities.forEach(id => { if (!list.some(x => x.id === id)) list.push({ id, from, by: String(s.e.c.own || s.pid).slice(0, 40) }); });
          out.set(key, list);
        }
        if ((g.lose && g.lose.length) || g.loseAll) {
          const cur = out.lose.get(key) || { ids: [], all: false, keep: [], from: [] };
          (g.lose || []).forEach(id => { if (!cur.ids.includes(id)) cur.ids.push(id); });
          if (g.loseAll) { cur.all = true; g.abilities.forEach(id => { if (!cur.keep.includes(id)) cur.keep.push(id); }); } // "has indestructible and loses all other abilities": the one it gains stays
          cur.from.push(from);
          out.lose.set(key, cur);
        }
        const counted = g.each && ctx && typeof ctx.each === 'function' ? ctx.each(g.each, s.pid, s.e.c.iid) : null; // a pump per counted thing, counted from the giver's side
        if (g.pt || g.base || counted) {
          const cur = out.pt.get(key) || { dp: 0, dt: 0, base: null, from: [] };
          if (g.pt) { cur.dp += g.pt.dp; cur.dt += g.pt.dt; }
          if (counted) { cur.dp += counted.dp; cur.dt += counted.dt; }
          if (g.base) cur.base = g.base;
          cur.from.push({ from, dp: (g.pt ? g.pt.dp : 0) + (counted ? counted.dp : 0), dt: (g.pt ? g.pt.dt : 0) + (counted ? counted.dt : 0), base: g.base || null });
          out.pt.set(key, cur);
        }
      }));
    }));
    return out;
  }
  // One player's board on its own (everything is "yours").
  const forBoard = (entries, ctx) => { const m = forBoards([{ pid: 'p', entries }], ctx), out = new Map(); m.forEach((v, k) => out.set(k.slice(2), v)); out.pt = new Map(); m.pt.forEach((v, k) => out.pt.set(k.slice(2), v)); out.lose = new Map(); m.lose.forEach((v, k) => out.lose.set(k.slice(2), v)); out.types = new Map(); m.types.forEach((v, k) => out.types.set(k.slice(2), v)); return out; };
  window.CTGrants = { parse, parseLine, clean, applies, forBoard, forBoards, ABILITIES };
}());
