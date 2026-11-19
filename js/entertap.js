/* entertap.js — reads a land's rules text and says whether it enters the battlefield tapped, so the game can tap it for you.
 * Pure helpers, no page needed. Handled: "This land enters tapped." (also with counters or "choose a color" after it), and the
 * conditional wordings the game can check on its own: "…unless you control two or more other lands" (slow land), "…two or fewer other
 * lands" (fast land), "…two or more basic lands" (battle land), "…unless you control a Plains or an Island" (check land), "…three or more
 * other Forests", "…unless you have two or more opponents", "…unless your opponents control eight or more lands" and the backwards
 * "If you control two or more other lands, this land enters tapped". NOT handled, because they need a choice: "As this land enters, you may
 * reveal…", "you may pay 3 life", "You may have this land enter tapped". Those lands are left as they are (the "As … enters" notice still shows). Lands with an Adventure are left alone too. */
(function () {
  'use strict';
  const NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const num = w => NUMBERS[String(w).toLowerCase()];
  const words = type => String(type || '').toLowerCase();
  const hasType = (type, word) => new RegExp('\\b' + String(word).toLowerCase().replace(/s$/, '') + 's?\\b').test(words(type));
  // ctx = { lands: [type lines of the OTHER lands I control], opponents: number still in the game, oppLands: lands my opponents control }
  // Returns true / false, or null when the wording is not one this file understands.
  function condition(text, ctx) {
    const t = String(text || '').trim().replace(/[.]+$/, '');
    let m;
    if ((m = /^you control (\w+) or more basic lands$/i.exec(t)) && num(m[1])) return ctx.lands.filter(x => /\bBasic\b/.test(x)).length >= num(m[1]);
    if ((m = /^you control (\w+) or more other lands$/i.exec(t)) && num(m[1])) return ctx.lands.length >= num(m[1]);
    if ((m = /^you control (\w+) or fewer other lands$/i.exec(t)) && num(m[1])) return ctx.lands.length <= num(m[1]);
    if ((m = /^you control (\w+) or more other ([A-Z][a-z]+?)s?$/.exec(t)) && num(m[1])) return ctx.lands.filter(x => hasType(x, m[2])).length >= num(m[1]);
    if ((m = /^you control (?:a|an) ([A-Z][a-z]+)(?: or (?:a|an) ([A-Z][a-z]+))?$/.exec(t))) return ctx.lands.some(x => hasType(x, m[1]) || (m[2] && hasType(x, m[2])));
    if ((m = /^you have (\w+) or more opponents$/i.exec(t)) && num(m[1])) return ctx.opponents >= num(m[1]);
    if ((m = /^your opponents control (\w+) or more lands$/i.exec(t)) && num(m[1])) return ctx.oppLands >= num(m[1]);
    return null;
  }
  const clean = line => String(line || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  // { tapped: true|false } when the text decides it, or null when nothing here applies (or it needs a choice).
  function evaluate(oracle, ctx) {
    ctx = Object.assign({ lands: [], opponents: 0, oppLands: 0 }, ctx);
    const own = ctx.name ? String(ctx.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const subject = '(?:This land|It' + (own ? '|' + own : '') + ')';
    const always = new RegExp('^' + subject + ' enters(?: the battlefield)? tapped(?:\\.|,| with\\b|$)(?!.*\\bunless\\b)', 'i');
    const unless = new RegExp('^' + subject + ' enters(?: the battlefield)? tapped unless (.+?)\\.?$', 'i');
    const inverse = new RegExp('^If (.+?), ' + subject + ' enters(?: the battlefield)? tapped\\.?$', 'i');
    let decided = false, tapped = false;
    String(oracle == null ? '' : oracle).split('\n').map(clean).forEach(line => {
      let m;
      if (always.test(line)) { decided = true; tapped = true; return; }
      if ((m = unless.exec(line))) { const c = condition(m[1], ctx); if (c !== null) { decided = true; if (!c) tapped = true; } return; }
      if ((m = inverse.exec(line))) { const c = condition(m[1], ctx); if (c !== null) { decided = true; if (c) tapped = true; } }
    });
    return decided ? { tapped } : null;
  }
  // A land with an Adventure (Zanarkand, Ancient Metropolis // Lasting Fayth) is left alone: it can be cast as the Adventure and played from exile later,
  // so the player taps it themselves. Recognised by the layout when known, otherwise by the Adventure's own reminder text.
  function hasAdventure(def) {
    if (!def) return false;
    if (def.lay === 'adventure') return true;
    return /\s\/\/\s/.test(String(def.name || '')) && /\bThen exile this card\. You may (?:cast|play)\b/i.test(String(def.oracle || ''));
  }
  // Counters a permanent enters with when the number is fixed: "This creature enters with a +1/+1 counter on it.", "enters tapped with two charge counters on
  // it", and the keywords Graft N / Vanishing N / Fading N. Returns [{ name, n }]. NOT read (they depend on mana spent or on the board, and stay manual):
  // X, "for each", "equal to", "additional", kicker, "if/unless", "you may", "choose", and counters given to OTHER creatures.
  function counters(oracle, name) {
    const out = [];
    const add = (nm, n) => { if (n >= 1 && n <= 20) { const hit = out.find(x => x.name === nm); if (hit) hit.n += n; else out.push({ name: nm, n }); } };
    const esc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const names = name ? [String(name).trim(), String(name).split(',')[0].trim()].filter((x, i, all) => x && all.indexOf(x) === i).map(esc) : []; // Oracle text uses the full name of a legendary card ("Ghave, Guru of Spores enters…")
    const line = new RegExp('^(?:This [a-z]+|It' + names.map(n => '|' + n).join('') + ') enters(?: the battlefield)?(?: tapped)? with (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d+) (\\+1\\/\\+1|-1\\/-1|[a-z]{3,12}) counters? on (?:it|him|her)\\.?$', 'i');
    String(oracle == null ? '' : oracle).split('\n').forEach(raw => {
      const l = clean(raw);
      if (/\b(?:additional|for each|twice|that many|equal to|if |unless|you may|X\b|choose|where|instead|kicked|spent)\b/i.test(l)) return;
      let m = line.exec(l);
      if (m) { const nm = m[2].toLowerCase(); add(/^[+-]/.test(nm) ? nm : nm[0].toUpperCase() + nm.slice(1), NUMBERS[m[1].toLowerCase()] || +m[1]); return; }
      m = /^(Graft|Modular|Fading|Vanishing) (\d+)$/i.exec(l);
      if (m) { const k = m[1].toLowerCase(); add(k === 'graft' || k === 'modular' ? '+1/+1' : k === 'fading' ? 'Fade' : 'Time', +m[2]); }
    });
    return out;
  }
  window.CTEnterTap = { evaluate, condition, hasAdventure, counters };
}());
