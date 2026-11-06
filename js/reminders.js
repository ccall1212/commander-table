/* reminders.js — the trigger reminders list: pure helpers (no page needed).
 * Your own reminders are saved with each deck. "From the table" lines are quoted word for word from the rules text of the
 * permanents in play: the repeating triggers ("Whenever…", "At the beginning of…"), permissions to play from another zone, and "enters with" effects. An opponent's card is only listed when the
 * trigger mentions opponents or players, so it can affect you. This never decides when a trigger happens or what it does. */
(function () {
  'use strict';
  const MAX_ITEMS = 60, MAX_TEXT = 240, MAX_WHEN = 24;
  // A repeating trigger line, optionally led by an ability word ("Landfall — Whenever…"). Single-use "When …" lines are left out.
  const TRIGGER_RE = /^(?:[A-Z][\w'’ ]{1,24} — )?(?:Whenever|At the beginning of)\b/;
  // Also worth remembering: permission to play or cast from another zone ("You may play lands … from the top of your library")
  // and replacement effects about how things enter ("… enters with a +1/+1 counter on it").
  const PERMISSION_RE = /^You may (?:play|cast|look at)\b.*\b(?:from|top of|among)\b/;
  const ENTERS_WITH_RE = /\benters (?:the battlefield )?with\b/;
  // Lines that only matter while the card sits in a pile: "You may cast this card from your graveyard…", "If this card is in your
  // graveyard…", Flashback, Escape, "from exile"…  Cards in play do not list these.
  const IN_PILE = /\byour graveyard\b|\bfrom exile\b/;
  const GRAVE_RE = /\bfrom your graveyard\b|\b(?:this card|it) is in your graveyard\b|\bis in your graveyard\b/i;
  const GRAVE_KW_RE = /^(?:Flashback|Escape|Unearth|Embalm|Eternalize|Disturb|Jump-start|Retrace|Aftermath|Dredge|Scavenge|Encore|Harmonize)\b/;
  const EXILE_RE = /\b(?:cast|play)\b[^.]*\bfrom exile\b|\bfrom exile\b/i;
  const EXILE_KW_RE = /^(?:Foretell|Suspend|Plot)\b/;
  const AFFECTS_YOU_RE = /\b(an opponent|each opponent|opponents|target opponent|a player|each player|any player|target player|each other player|another player|that player)\b/i;
  // Keyword abilities that are really triggers or effects you have to remember (Evolve, Exalted, Prowess…). A card lists them as a
  // bare keyword, so the pattern above misses them. n = the number after the keyword (Annihilator 2); the text is the rules reminder.
  const KEYWORD_TRIGGERS = {
    'evolve': 'Whenever a creature you control enters, if it has greater power or toughness than this creature, put a +1/+1 counter on this creature.',
    'exalted': 'Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.',
    'prowess': 'Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.',
    'battle cry': 'Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.',
    'annihilator': 'Whenever this creature attacks, defending player sacrifices {n} permanents.',
    'myriad': 'Whenever this creature attacks, for each opponent other than defending player, you may create a token copy tapped and attacking that player. Exile the tokens at end of combat.',
    'melee': 'Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.',
    'mentor': 'Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power.',
    'training': 'Whenever this creature attacks with another creature with greater power, put a +1/+1 counter on this creature.',
    'extort': 'Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain that much life.',
    'bushido': 'Whenever this creature blocks or becomes blocked, it gets +{n}/+{n} until end of turn.',
    'flanking': 'Whenever a creature without flanking blocks this creature, the blocking creature gets -1/-1 until end of turn.',
    'dethrone': 'Whenever this creature attacks the player with the most life or tied for most life, put a +1/+1 counter on it.',
    'afflict': 'Whenever this creature becomes blocked, defending player loses {n} life.',
    'provoke': 'Whenever this creature attacks, you may have target creature defending player controls untap and block it if able.',
    'rampage': 'Whenever this creature becomes blocked, it gets +{n}/+{n} until end of turn for each creature beyond the first blocking it.',
    'soulbond': 'You may pair this creature with another unpaired creature when either enters. They stay paired while both are creatures you control.',
    'persist': 'When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner\'s control with a -1/-1 counter on it.',
    'undying': 'When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner\'s control with a +1/+1 counter on it.',
    'afterlife': 'When this creature dies, create {n} 1/1 white and black Spirit creature tokens with flying.',
    'renown': 'When this creature deals combat damage to a player, if it is not renowned, put {n} +1/+1 counters on it and it becomes renowned.',
    'poisonous': 'Whenever this creature deals combat damage to a player, that player gets {n} poison counters.',
    'enlist': 'As this creature attacks, you may tap a nonattacking creature you control without summoning sickness. When you do, add its power to this creature\'s until end of turn.',
    'cascade': 'When you cast this spell, exile cards from the top of your library until you exile a nonland card that costs less. You may cast it without paying its mana cost.',
    'storm': 'When you cast this spell, copy it for each spell cast before it this turn.',
    'exploit': 'When this creature enters, you may sacrifice a creature.',
    'decayed': 'This creature can\'t block. When it attacks, sacrifice it at end of combat.',
    'ingest': 'Whenever this creature deals combat damage to a player, that player exiles the top card of their library.',
    'cumulative upkeep': 'At the beginning of your upkeep, put an age counter on this permanent, then sacrifice it unless you pay its upkeep cost for each age counter on it.',
    'echo': 'At the beginning of your upkeep, if this permanent came under your control since your last upkeep, sacrifice it unless you pay its echo cost.',
    'fading': 'At the beginning of your upkeep, remove a fade counter from this permanent. If you can\'t, sacrifice it.',
    'vanishing': 'At the beginning of your upkeep, remove a time counter from this permanent. When the last is removed, sacrifice it.'
  };
  const KEYWORD_NAMES = Object.keys(KEYWORD_TRIGGERS).sort((a, b) => b.length - a.length);
  const KEYWORD_RE = new RegExp('^(' + KEYWORD_NAMES.map(n => n.replace(/ /g, '\\s')).join('|') + ')\\b(?:\\s+([\\dXN]+|\\{[^}]+\\}[\\w{}\\/ ]*))?\\s*$', 'i');
  // The keyword at the start of a line, as written ("Evolve", "Annihilator 2"), or '' when the line does not start with one.
  const leadingKeyword = line => { const m = /^([A-Za-z][A-Za-z ]{2,20}?)(?:\s+(?:\d+|[XN]|\{[^}]+\}))?(?:\s*[,(]|\s*$)/.exec(String(line || '').trim()); return m && KEYWORD_TRIGGERS[m[1].toLowerCase()] ? m[1] : ''; };
  // Keyword lines of one card: a line that is just the keyword (with its printed reminder text) is quoted as printed; keywords sharing a
  // line with others ("Flying, prowess") are listed by name with the standard reminder.
  function keywordLines(rawLine) {
    const line = String(rawLine || '').trim(), bare = line.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = bare.split(/\s*,\s*(?![^{]*\})/).map(t => t.trim()).filter(Boolean);
    const hits = tokens.map(t => KEYWORD_RE.exec(t)).filter(Boolean);
    if (!hits.length) return [];
    if (tokens.length === 1 && /\(/.test(line)) return [clip(line, 400)];
    return hits.map(m => clip(m[0].trim().replace(/^./, ch => ch.toUpperCase()) + ' (' + KEYWORD_TRIGGERS[m[1].toLowerCase()].replace(/\{n\}/g, m[2] && /^\d+$/.test(m[2]) ? m[2] : 'N') + ')', 400));
  }
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

  // Trigger lines of one card's rules text. own = the card is mine (every trigger counts); otherwise only ones that can affect me.
  function triggerLines(oracle, own) {
    return String(oracle == null ? '' : oracle).split(/\n+/).map(l => l.trim()).flatMap(l => {
      if (!l) return [];
      if (TRIGGER_RE.test(l) || (PERMISSION_RE.test(l) && !IN_PILE.test(l)) || ENTERS_WITH_RE.test(l)) return (own || AFFECTS_YOU_RE.test(l)) ? [clip(l, 400)] : [];
      return own ? keywordLines(l) : []; // keyword abilities only matter for the card's own controller
    });
  }
  // Lines of a card that is in my graveyard or exile (mine only) which tell me what I can do with it from there.
  function zoneLines(oracle, zone) {
    const re = zone === 'graveyard' ? GRAVE_RE : zone === 'exile' ? EXILE_RE : null, kw = zone === 'graveyard' ? GRAVE_KW_RE : EXILE_KW_RE;
    if (!re) return [];
    return String(oracle == null ? '' : oracle).split(/\n+/).map(l => l.trim()).filter(l => l && (re.test(l) || kw.test(l))).map(l => clip(l, 400));
  }
  // The saved list: [{ id, text, when }], cleaned.
  function cleanList(raw) {
    const out = [], seen = new Set();
    (Array.isArray(raw) ? raw : []).slice(0, MAX_ITEMS).forEach(r => {
      if (!r || typeof r !== 'object') return;
      const text = clip(r.text, MAX_TEXT);
      if (!text) return;
      let id = clip(r.id, 40).replace(/[^\w-]/g, '') || ('r' + out.length + Math.random().toString(36).slice(2, 7));
      while (seen.has(id)) id += 'x';
      seen.add(id);
      out.push({ id, text, when: clip(r.when, MAX_WHEN) });
    });
    return out;
  }
  window.CTReminders = { leadingKeyword, keywordLines, triggerLines, zoneLines, cleanList, clip, MAX_ITEMS, MAX_TEXT, MAX_WHEN };
}());
