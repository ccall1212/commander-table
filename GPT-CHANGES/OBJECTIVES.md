# Commander Table — Objectives backlog

Features Chris has asked for that are **not built yet**. The numbers are Chris's original numbering; finished ones (1, 2, 3, 6, 8, 10, 13) were removed, and #7 (opponent boards looking dim) was dropped: the dimming only applies to players who are reconnecting or out, on purpose. Work on one at a time on its own branch and pull request, and read `AGENTS.md` first.

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

## 9. Choose a random deck from Archidekt or Moxfield — PAUSED

See [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md). Draft PR #11. Do not merge or publish it until the live tests listed there pass.

## 11. Drag a selection rectangle to select and move several cards — IN PROGRESS (v0.18.1 candidate)

**Branch/PR:** `feat/multi-card-selection` / [PR #13](https://github.com/ccall1212/commander-table/pull/13) — not merged or published.

Chris wants a **selection rectangle like StarCraft or EDHPlay**: press the mouse on empty space on your battlefield, drag, and a visible rectangle follows the pointer; every one of your cards the rectangle touches is selected. Then the whole selection can be dragged and moved together in one go.

How it should behave:

- **Draw:** pressing on empty battlefield (not on a card, zone label or button) and dragging draws a translucent rectangle with a thin border. Cards it overlaps get a clear highlight while you drag (use the existing yellow/gold accent), and stay selected when you let go.
- **Move:** dragging any selected card moves all selected cards together, keeping their positions relative to each other. Dropping onto your battlefield places them; dropping onto your graveyard/exile/hand/command pile, or onto another player's board (give control), should behave the same as dropping a single card does today (decide whether the whole group goes; keep it simple and tell Chris what you chose).
- **Drag preview:** the floating ghost should show every selected card in its original relative arrangement, not just the one grabbed.
- **Clear / change:** a click on empty space, or Esc, clears the selection. Holding Shift while drawing adds to the selection; Shift-clicking a card toggles it.
- **Group actions (nice to have, only if simple):** `T` taps/untaps the selection and `G` / `E` sends it to the graveyard / exile.
- **Only your own cards** can be selected. Normal single-card dragging, tapping by click, counters, menus and hotkeys must work exactly as now when nothing is selected.
- **Both layouts:** works in Sidebar and in Grid (your quadrant is the miniature `.opp.mytile` there). It must also work while the board is scaled or auto-fitted.
- Respect arrange-zones mode (`S.arrange`): the rectangle should not start while you are resizing zones.

Where to look in `js/app.js`:

- Boards are drawn inside a scaled, sometimes auto-fitted display space. Convert pointer positions to board coordinates with `boardPoint()`, and a card's display position back to where it is stored with `storedPos()`. Do not use raw screen pixels as board units.
- Single-card dragging lives in the `pointerdown` handler (search for `beginCardDrag`) and `dropCard()`; moving a card is `doMove(iid, 'battlefield', { x, y })`. A group move should loop over the selection inside one `act(...)` so it is a single undo step and one log line.
- To find which cards the rectangle touches, compare the rectangle with each card element's `getBoundingClientRect()` (cards are `.card[data-iid][data-pid]` inside the board; only cards whose `data-pid` is yours and `data-zone="battlefield"`).
- The page patches the DOM in place (`setHTML()`), so keep the selection as a set of card ids in state (for example `S.sel`) and re-apply the highlight class after every render. Draw the rectangle as one fixed-position element outside the re-rendered containers so a render cannot remove it.

Test list for Chris: (1) Sidebar, a few cards across Creatures and Lands: drag a rectangle around three and move them; (2) Grid, the same in your quadrant; (3) a single click on a card still taps it and a normal drag still moves just that one; (4) Shift-drag adds to a selection; (5) drag the selection onto the graveyard pile.

## 12. Targeting arrows between cards (Forge-inspired) — QUEUED

Let a player draw an arrow from one card (or player) to another so the table can see what an effect targets.

- Right-click a card → **Send arrow to…**, then click the target (any player's battlefield). Everyone sees the same arrow. Make cancelling and clearing easy.
- Arrows are visual only: they must never move cards or change game state. Keep the existing right-click menus, dragging and touch behaviour working.
- **Where to look:** cross-player actions are messages relayed by the host, which validates the sender (see how `drawfx` is validated in `hostRecv`). Arrows need the same treatment, and must survive layout changes and the board scaling, so anchor them to card ids (`data-iid`), not pixel positions, and redraw after each render (`setHTML()` patches the DOM in place and cards are matched by `data-iid`).
- Start with one simple arrow at a time; decide colours/labels and the exact menu wording during implementation.
