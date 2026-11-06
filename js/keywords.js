/* keywords.js — reads the keyword abilities printed at the very start of a card's rules text (or, for a Saga creature such as
 * "Summon: Ixion", at the very end) so the matching ability icons can be switched on automatically when it enters the battlefield.
 * Pure helpers, no page needed. Only the abilities this game has an icon for are returned; "Hexproof from black" or
 * "Protection from red" are NOT the plain abilities, so they are never turned on by mistake. */
(function () {
  'use strict';
  // Rules-text words (lower case) -> the ability id the card markers use.
  const ABILITIES = ['deathtouch', 'defender', 'double strike', 'first strike', 'flying', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'trample', 'vigilance'];
  // Other keywords that may share the opening lines. They are skipped over (not turned on) so a later keyword line is still found.
  const OTHER_RE = /^(?:flash|ward\b.*|prowess|protection from .+|hexproof from .+|partner(?: with .+)?|persist|undying|cascade|convoke|delve|devoid|changeling|exalted|fabricate \d+|afterlife \d+|annihilator \d+|bushido \d+|infect|skulk|shadow|fear|intimidate|horsemanship|banding|flanking|wither|riot|decayed|myriad|melee|improvise|training|toxic \d+|storm|cipher|rebound|haunt|split second|enchant .+|equip.*|reconfigure.*|crew \d+|saddle \d+|landwalk|[a-z]+walk|affinity for .+|living weapon|extort|evolve|undying|mentor|spectacle.*|escape.*|flashback.*|cycling.*|kicker.*|multikicker.*|dash.*|mutate.*|ninjutsu.*|morph.*|megamorph.*|disguise.*|bestow.*|unearth.*|embalm.*|eternalize.*|suspend.*|foretell.*|miracle.*)$/;
  // One line made only of keywords ("Flying", "Flying, vigilance", "Trample (This creature…)"): returns the abilities in it, or null
  // if the line is anything else (so the scan stops there).
  function lineAbilities(line) {
    const text = String(line || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.]+$/, '');
    if (!text || text.length > 120) return null;
    const found = [];
    for (const raw of text.split(/\s*[,;]\s*(?![^{]*\})/)) {
      const t = raw.trim().toLowerCase();
      if (!t) continue;
      if (ABILITIES.includes(t)) found.push(t);
      else if (!OTHER_RE.test(t)) return null;
    }
    return found;
  }
  // Abilities printed at the start of the front face; for a Saga, the trailing keyword lines instead.
  function fromOracle(oracle, type) {
    const front = String(oracle || '').split(/\n—\n/)[0];
    let lines = front.split('\n').map(l => l.trim()).filter(Boolean);
    if (/\bSaga\b/.test(String(type || ''))) lines = lines.reverse(); // Summon: … Sagas list their abilities after the chapters
    const groups = [];
    for (const line of lines) {
      const got = lineAbilities(line);
      if (!got) break;
      groups.push(got);
    }
    if (/\bSaga\b/.test(String(type || ''))) groups.reverse(); // back to the order printed
    return groups.flat().filter((a, i, all) => all.indexOf(a) === i);
  }
  window.CTKeywords = { fromOracle, lineAbilities, ABILITIES };
})();
