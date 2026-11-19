/* orient.js — which card pictures are printed sideways, so they can be turned upright.
 * Scryfall's pictures of the classic split cards (Wear // Tear, Fire // Ice, Fuse cards), Room cards and the front of Battles are
 * portrait files with the card lying on its side, so the text reads bottom to top. Turning the picture a quarter turn clockwise makes it
 * read normally. Aftermath cards are half upright and half sideways, so they are left alone; Adventures and double-faced cards are upright.
 * Pure helpers, no page needed. A published (slim) card definition carries the answer in `hz`, because other players' definitions
 * do not include the rules text needed to spot an Aftermath card. */
(function () {
  'use strict';
  const AFTERMATH_RE = /\bAftermath\b/;
  // True when the FRONT picture of this card is printed sideways.
  function frontIsSideways(def) {
    if (!def) return false;
    if (def.hz !== undefined && def.hz !== null) return !!def.hz;
    const type = String(def.type || ''), name = String(def.name || ''), oracle = String(def.oracle || '');
    if (/^Battle\b/.test(type)) return true; // a Battle's front is sideways; its back (a second picture) is upright
    if (def.imgBack || def.backName) return false; // other double-faced cards are upright
    if (def.lay) return def.lay === 'split' && !AFTERMATH_RE.test(oracle); // the exact Scryfall layout, when this card's data has it
    if (name.indexOf(' // ') < 0) return false;
    // Older saved cards have no layout: split cards are two instants/sorceries, Rooms are two enchantment doors; Adventures start with a permanent.
    return (/^(?:Instant|Sorcery)\b/.test(type) || /\bRoom\b/.test(type)) && !AFTERMATH_RE.test(oracle);
  }
  // flipped = the card is turned to its other face. A second picture (the back of a Battle) is always upright.
  function sideways(def, flipped) {
    if (!def) return false;
    if (flipped && def.imgBack) return false;
    return frontIsSideways(def);
  }
  window.CTOrient = { sideways, frontIsSideways };
}());
