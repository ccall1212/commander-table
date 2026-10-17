# Commander Table — Objectives backlog

Features Chris has asked for that are **not built yet**. The numbers are Chris's original numbering; finished ones (1, 2, 3, 6, 8, 10, 13) were removed. Work on one at a time on its own branch and pull request, and read `AGENTS.md` first.

Status key: **Queued** = requested, not started. **Paused** = started, waiting on something. **Deferred** = on purpose not now.

Layouts that exist: **Sidebar** and **Grid** only. Every feature must be checked in both, at roughly 1920×1080 and 1366×768, with a second player watching if other players see it.

---

## 4. Larger battlefield cards on big displays — DEFERRED

Cards feel a little small when the browser is maximized on a 2K display (the size is fine at 1920×1080).

- Aim for roughly 15–20% larger cards at larger resolutions, where space allows; do not change how it looks at 1920×1080 and below.
- **Where to look:** in Sidebar your own board is drawn at its natural scale (limited by width). In Grid and in the opponent miniatures the board is auto-fitted: `computeFit()` in `js/app.js` picks the card size, and its `capPx` caps card width (56 px in miniatures, 150 px for a big board). Changing those numbers is the likely lever, but check that crowded boards still fit.
- Avoid clipping or overlapping cards more than today.

## 5. One-time "slam" animation when a card is played — QUEUED

When a Commander moves from the command zone to the battlefield, play a brief slam animation with a glow in the card's colour identity. Optionally do the same the first time a card with mana value 8 or more enters the battlefield.

- Trigger on the play event only, never on later dragging or repositioning.
- Keep it short, make it click-through, and respect `prefers-reduced-motion`.
- **Where to look:** card moves go through `moveCard()` / `doMove()` in `js/app.js`. The draw-card animation (`animateDrawCard()` and the `drawfx` message) is a working example of a click-through overlay effect that other players also see; copy its approach (a small host-validated message carrying no hidden information).

## 7. Keep opponent boards vibrant in Sidebar — QUEUED

Opponent miniatures in the Sidebar look darker and greyer than your own board. Make them as vibrant as the main board.

- **Where to look:** every board gets a dark gradient laid over its background art in `boardBackgroundStyle()` in `js/appearance.js` (alpha about 0.58 to 0.68). Miniatures (`.opp.tile .boardwrap.tile`) also inherit that. `.opp.offline` is dimmed to 60% opacity and `.opp.out` to 35% on purpose for players who are disconnected or out; leave those.
- Keep readable contrast for the life box, labels and cards; do not simply remove the gradient if text becomes unreadable.

## 9. Choose a random deck from Archidekt or Moxfield — PAUSED

See [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md). Draft PR #11. Do not merge or publish it until the live tests listed there pass.

## 11. Drag a selection rectangle to move several cards — QUEUED

Click-and-drag on empty battlefield draws a selection rectangle (like EDHPlay or StarCraft); cards it touches are selected and can be moved together.

- Keep normal single-card dragging, tapping, counters and menus working exactly as now. Only your own cards may be selected and moved.
- **Where to look:** boards are drawn inside a scaled and sometimes auto-fitted display space. Convert pointer positions with `boardPoint()` and, for where a card is stored, `storedPos()`; never assume 1 px on screen is 1 unit on the board. Single-card drag and drop is in the `pointerdown` handler and `dropCard()`. In Grid your quadrant is the miniature `.opp.mytile`; the real battlefield `#myBf` is hidden there.

## 12. Targeting arrows between cards (Forge-inspired) — QUEUED

Let a player draw an arrow from one card (or player) to another so the table can see what an effect targets.

- Right-click a card → **Send arrow to…**, then click the target (any player's battlefield). Everyone sees the same arrow. Make cancelling and clearing easy.
- Arrows are visual only: they must never move cards or change game state. Keep the existing right-click menus, dragging and touch behaviour working.
- **Where to look:** cross-player actions are messages relayed by the host, which validates the sender (see how `drawfx` is validated in `hostRecv`). Arrows need the same treatment, and must survive layout changes and the board scaling, so anchor them to card ids (`data-iid`), not pixel positions, and redraw after each render (`setHTML()` patches the DOM in place and cards are matched by `data-iid`).
- Start with one simple arrow at a time; decide colours/labels and the exact menu wording during implementation.
