/* Opening-hand policies shared by the game and its regression checks. */
(function (root) {
  'use strict';

  const MODES = ['london', 'three-lands', 'ten-bottom-three'];
  const CAP = 7, MAX_EXTRA = 20, MAX_LIMIT = 1 + MAX_EXTRA;
  const normalizeMode = mode => MODES.includes(mode) ? mode : 'london';
  const extraLimit = grants => Math.max(0, Math.min(MAX_EXTRA, Math.floor(Number(grants) || 0)));
  const limit = (mode, grants = 0) => normalizeMode(mode) === 'london' ? CAP : 1 + extraLimit(grants);
  const canMulligan = (attempts, mode = 'london', grants = 0) => attempts < limit(mode, grants);
  function bottomCount(mode, mulligans, handSize) {
    mode = normalizeMode(mode);
    if (mode === 'london') return Math.min(handSize, Math.max(0, Math.min(CAP, mulligans) - 1));
    if (mode === 'ten-bottom-three') return Math.min(3, Math.max(0, handSize - 1));
    return 0;
  }
  const canKeep = (mode, handLands, totalLands, attempts, grants = 0) => normalizeMode(mode) !== 'three-lands'
    || handLands >= 3 || totalLands < 3 || attempts >= limit(mode, grants);
  const isLand = (card, defs) => {
    const def = card && defs && defs[card.id];
    // Only the printed front face counts. A transforming land on the back is not a land here.
    return !!(def && /\bLand\b/.test(def.type || ''));
  };
  const landCount = (cards, defs) => cards.reduce((n, card) => n + (isLand(card, defs) ? 1 : 0), 0);

  function deal(library, defs, mode) {
    mode = normalizeMode(mode);
    if (mode !== 'three-lands') {
      const hand = library.splice(0, mode === 'ten-bottom-three' ? 10 : 7);
      return { hand, fallback: false };
    }
    // The library was shuffled before this call; take three random front-face lands,
    // then four random cards from what remains (which can include more lands).
    const lands = library.filter(card => isLand(card, defs));
    const fallback = lands.length < 3;
    const hand = lands.slice(0, 3);
    const pickedLands = new Set(hand);
    hand.push(...library.filter(card => !pickedLands.has(card)).slice(0, 7 - hand.length));
    const picked = new Set(hand);
    const rest = library.filter(card => !picked.has(card));
    library.splice(0, library.length, ...rest);
    return { hand, fallback };
  }

  root.CTMulligan = { MODES, CAP, MAX_EXTRA, MAX_LIMIT, normalizeMode, extraLimit, limit, canMulligan, bottomCount, canKeep, isLand, landCount, deal };
})(typeof window === 'undefined' ? globalThis : window);
