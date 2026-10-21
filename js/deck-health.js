/* deck-health.js — informational Commander deck checks; this is not a legality engine. */
(function () {
  'use strict';

  const qty = entry => {
    const n = Number(entry && entry.qty);
    return Number.isFinite(n) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n))) : 0;
  };
  const name = def => String(def && def.name || '').trim();
  const keyName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘ʼ`]/g, "'").toLocaleLowerCase().trim();
  const colors = ['W', 'U', 'B', 'R', 'G'];
  const smallNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  function checks(deck) {
    deck = deck || {};
    const commanders = Array.isArray(deck.commanders) ? deck.commanders.filter(Boolean) : [];
    const cards = Array.isArray(deck.cards) ? deck.cards : [];
    const mainCount = cards.reduce((n, e) => n + qty(e), 0);
    const total = mainCount + commanders.length;
    const out = [];
    if (!commanders.length) out.push('No commander is set.');
    if (total !== 100) out.push('Deck has ' + total + ' card' + (total === 1 ? '' : 's') + ' including commander' + (commanders.length === 1 ? '' : 's') + '; Commander decks usually have 100.');

    const allowedColors = new Set();
    const commandersHaveIdentity = commanders.every(d => Array.isArray(d.ci));
    commanders.forEach(d => (Array.isArray(d.ci) ? d.ci : []).forEach(c => allowedColors.add(c)));
    let identityUnknown = commanders.filter(d => !Array.isArray(d.ci)).length;
    if (commanders.length && commandersHaveIdentity) {
      cards.forEach(e => {
        const d = e && e.def || {};
        if (qty(e) && !Array.isArray(d.ci)) { identityUnknown += qty(e); return; }
        const outside = (Array.isArray(d.ci) ? d.ci : []).filter(c => colors.includes(c) && !allowedColors.has(c));
        if (qty(e) && outside.length) out.push(name(d) + ' is outside the commander color identity (' + outside.join(', ') + ').');
      });
    } else if (commanders.length && !commandersHaveIdentity) identityUnknown += mainCount;
    if (identityUnknown) out.push('Color identity could not be checked for ' + identityUnknown + ' card' + (identityUnknown === 1 ? '' : 's') + '; review manually.');

    const groups = new Map();
    function addToGroup(d, count) {
      const nm = name(d);
      if (!nm || !count) return;
      const key = keyName(nm);
      if (!groups.has(key)) groups.set(key, { name: nm, count: 0, defs: [] });
      const g = groups.get(key); g.count += count; g.defs.push(d);
    }
    commanders.forEach(d => addToGroup(d, 1));
    cards.forEach(e => addToGroup(e && e.def || {}, qty(e)));
    groups.forEach(g => {
      if (g.defs.some(d => /\bBasic\b/i.test(d.type || ''))) return;
      let limit = 1;
      g.defs.forEach(d => {
        const oracle = String(d.oracle || '');
        const unlimited = oracle.match(/a deck can have any number of cards named ([^.,\n]+)/i);
        if (unlimited && keyName(unlimited[1].replace(/^"|"$/g, '')) === keyName(g.name)) limit = Infinity;
        const m = oracle.match(/a deck can have up to (\d+|one|two|three|four|five|six|seven|eight|nine|ten) cards named ([^.,\n]+)/i);
        if (m && keyName(m[2].replace(/^"|"$/g, '')) === keyName(g.name)) limit = Math.max(limit, Number(m[1]) || smallNumbers[m[1].toLowerCase()]);
      });
      if (g.count > limit) out.push(g.name + ' appears ' + g.count + ' times (usual limit ' + limit + ').');
    });
    return { total, commanderCount: commanders.length, messages: out };
  }
  window.CTDeckHealth = { checks };
})();
