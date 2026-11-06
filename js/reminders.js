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
  const AFFECTS_YOU_RE = /\b(an opponent|each opponent|opponents|target opponent|a player|each player|any player|target player|each other player|another player|that player)\b/i;
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

  // Trigger lines of one card's rules text. own = the card is mine (every trigger counts); otherwise only ones that can affect me.
  function triggerLines(oracle, own) {
    return String(oracle == null ? '' : oracle).split(/\n+/).map(l => l.trim())
      .filter(l => l && (TRIGGER_RE.test(l) || PERMISSION_RE.test(l) || ENTERS_WITH_RE.test(l)) && (own || AFFECTS_YOU_RE.test(l)))
      .map(l => clip(l, 400));
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
  window.CTReminders = { triggerLines, cleanList, clip, MAX_ITEMS, MAX_TEXT, MAX_WHEN };
}());
