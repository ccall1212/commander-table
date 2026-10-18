# Commander Table — Objectives backlog

Features Chris has asked for that are **not built yet or remain open**. The numbers are Chris's original numbering; finished ones (1, 2, 3, 6, 8, 10, 13, 14, 16) were removed, and #7 (opponent boards looking dim) was dropped: the dimming only applies to players who are reconnecting or out, on purpose. Objective #15 (custom image uploads and pointer fixes) shipped in v0.21.4 via [PR #30](https://github.com/ccall1212/commander-table/pull/30). Objective #22 (Grid pile drops) shipped in v0.22.2 via [PR #35](https://github.com/ccall1212/commander-table/pull/35). Objective #18 is the in-progress iPad/touch support work. Work on one at a time on its own branch and pull request, and read `AGENTS.md` first.

Status key: **Queued** = requested, not started. **In progress** = a branch / PR exists (see `README.md`). **Paused** = started, waiting on something. **Deferred** = on purpose not now.

Layouts that exist: **Sidebar** and **Grid** only. Every feature must be checked in both, at roughly 1920×1080 and 1366×768, with a second player watching if other players see it.

---

## 4. Larger battlefield cards on big displays — DEFERRED

Cards feel a little small when the browser is maximized on a 2K display (the size is fine at 1920×1080).

- Aim for roughly 15–20% larger cards at larger resolutions, where space allows; do not change how it looks at 1920×1080 and below.
- **Where to look:** in Sidebar your own board is drawn at its natural scale (limited by width). In Grid and in the opponent miniatures the board is auto-fitted: `computeFit()` in `js/app.js` picks the card size, and its `capPx` caps card width (56 px in miniatures, 150 px for a big board). Changing those numbers is the likely lever, but check that crowded boards still fit.
- Avoid clipping or overlapping cards more than today.

## 5. One-time "slam" animation when a card is played — SHIPPED; SOUND REFINEMENT OPEN

The Commander-to-battlefield slam animation and synthesized impact sound are published in v0.20.6 (PR #28). Chris wants to keep refining the sound, so any further audio work should be a separate focused change and must not disturb the currently published v0.20.6 version while under review.

- Trigger on the play event only, never on later dragging or repositioning.
- Keep it short, click-through, and respectful of `prefers-reduced-motion`.
- Ordinary card placements and battlefield repositioning should use the softer tap; Commander casts use the heavier boom and longer color-identity ring.
- **Where to look:** card moves go through `moveCard()` / `doMove()` in `js/app.js`. The draw-card animation (`animateDrawCard()` and the `drawfx` message) is a working example of a click-through overlay effect that other players also see.

## 9. Choose a random deck from Archidekt or Moxfield — PAUSED

See [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md). Draft PR #11. Do not merge or publish it until the live tests listed there pass.

## 12. Targeting arrows between cards (Forge-inspired) — QUEUED

Let a player draw an arrow from one card (or player) to another so the table can see what an effect targets.

- Right-click a card → **Send arrow to…**, then click the target (any player's battlefield). Everyone sees the same arrow. Make cancelling and clearing easy.
- Arrows are visual only: they must never move cards or change game state. Keep the existing right-click menus, dragging and touch behaviour working.
- Provide an equivalent touch-accessible action flow (see objective #18); right-click must not be the only way to start targeting.
- **Where to look:** cross-player actions are messages relayed by the host, which validates the sender (see how `drawfx` is validated in `hostRecv`). Arrows need the same treatment, and must survive layout changes and board scaling, so anchor them to card ids (`data-iid`), not pixel positions, and redraw after each render (`setHTML()` patches the DOM in place and cards are matched by `data-iid`).
- Start with one simple arrow at a time; decide colours/labels and exact menu wording during implementation.

## 17. Separate floating chat notifications — QUEUED

Add a lightweight chat experience that is separate from the action log. New messages should briefly appear as an unobtrusive floating overlay and then fade away.

- Show who sent the message and the message text; use a short, readable fade-out delay.
- Provide a way to open or view recent chat history so messages that fade away are not permanently lost.
- Synchronize messages with the other players in the room using the existing host-validated networking approach; chat must not change game state or reveal hidden information.
- Keep the overlay out of the way of cards and controls, support different screen sizes, and respect `prefers-reduced-motion`.
- Decide whether players can mute/hide the overlay and how long chat history lasts during implementation.

## 18. iPad and touch-friendly browser support — IN PROGRESS

Add an optional **Touch mode** for iPad Safari, launched from the top-right hamburger menu (☰ → **Touch mode**). Keep the existing desktop board and mouse interaction path as intact as possible: touch-specific controls and behavior should live behind this opt-in mode rather than forcing a broad redesign of the main battlefield. This is a mode for the existing website, not a separate native iPad app.

- **Entry and scope:** provide a clear on/off **Touch mode** item in the hamburger menu. Make the preference local to that player's browser/device (do not broadcast it to opponents). Consider remembering the choice on that device. Do not alter the default desktop UI when the mode is off.
- **Separate implementation:** keep touch-only UI, styles, and interaction handlers scoped to the mode—for example, using a mode class/state and small isolated helpers—rather than spreading iPad-specific exceptions through the standard board code. Reuse existing game actions and state so touch controls invoke the same behavior as desktop actions.
- Replace hover-only card inspection with a clear tap-to-inspect/zoom interaction that works for touch and does not accidentally move a card.
- Provide an obvious touch-friendly **Actions** menu for the selected card, with the useful actions currently reachable by right-click. Right-click remains available on desktop; long-press may be an optional shortcut, but must not be the only route.
- Make card dragging reliable with touch, avoid accidental text/image selection, and make controls comfortably tappable. Explore explicit selection mode or tap-to-select for multi-card operations if drag-select is awkward on touch.
- Ensure menus and previews can be dismissed by tapping elsewhere and don't depend on hover states. Avoid browser-native callouts or selection handles interfering with game actions.
- Preserve the existing Sidebar/Grid layouts and desktop mouse behavior wherever possible. Do not break scrolling, zooming, rotation, stylus input, or existing card interactions while adding touch support.
- In Touch mode, lock page gestures on the hand row and draggable board surfaces so a bottom-edge hand drag stays on the table. Use the live visual viewport height and safe-area insets, while leaving internal menu, log and dialog scrolling enabled.
- Fit the game to the dynamic mobile viewport height. On narrow phones in portrait, show a dismissible landscape recommendation rather than trying to force orientation lock (ordinary mobile Safari pages cannot reliably force it).
- Test in real iPhone/iPad Safari in portrait and landscape, including enabling/disabling Touch mode, host and joiner sessions, card inspection, card actions, dragging from the bottom edge of the hand, intentional group selection/movement, internal dialog scrolling, menu dismissal, and both Sidebar and Grid layouts. Desktop emulation alone is not sufficient for marking this complete.


## 19. Separate power and toughness controls — QUEUED

Provide separate **Power + / Power −** and **Toughness + / Toughness −** controls so a player can change only one stat at a time.

- Changes must combine correctly with existing +1/+1 counters: counters continue to increase both power and toughness, while a manual power-only or toughness-only adjustment affects just that stat.
- Keep displayed values consistent across card inspection, the battlefield, and other players' views; preserve the card's printed base stats and counter state rather than silently rewriting them.
- Define how manual adjustments interact with temporary effects and stat-changing abilities during implementation. Do not make one-sided adjustments behave like +1/+1 counters.
- Test a creature with no counters, with one or more +1/+1 counters, after each separate adjustment, and from a second player's view in both Sidebar and Grid.

## 20. Poison counter lethal warning — QUEUED

When a player reaches **10 poison counters**, make their poison total turn red, using the same visual warning style as lethal Commander damage.

- The warning should activate at 10 or more poison counters and clear if the total falls below 10.
- Keep poison totals and warning state synchronized for every player; do not change the existing poison counter rules.
- Test totals of 9, 10, and 11, including changes made by another player and both Sidebar and Grid layouts.

## 21. Restore the lethal-damage Concede prompt — SHIPPED in v0.22.3 via [PR #37](https://github.com/ccall1212/commander-table/pull/37)

Investigate and restore the confirmation prompt that used to appear when a player's life total or Commander damage became lethal.

- First identify the previous behavior and the change that caused the prompt to stop appearing; restore the intended behavior rather than adding a duplicate prompt.
- Confirm what counts as lethal for life total and Commander damage, and keep the prompt from appearing repeatedly on every render or unrelated state update.
- **Empty library:** if a player attempts to draw when their library has 0 cards, turn the library count (0) red and show the Concede prompt again. Treat this as its own clear trigger, not as a repeated prompt on every render.
- **Tested by Chris:** Chris confirmed the change works and approved publishing. The prompt covers lethal life totals, 21 Commander damage, and empty-library draw attempts; the zero Library count turns red.

## 23. T hotkey opens the Token menu over the battlefield — QUEUED

When the mouse is hovering over the battlefield and the player presses **T**, open the token menu so they can create a token.

- Keep the existing **T** behavior for tapping/untapping a battlefield card or playing a hovered hand card tapped. The token-menu action should apply only when the pointer is over empty battlefield space and must not steal those existing card/hand shortcuts.
- Check the current hotkey list and token-menu entry point before implementation; reuse the existing token creation UI rather than creating a second menu.
- Test with the pointer over empty battlefield space, over a creature, over a card in hand, and outside the battlefield, in both Sidebar and Grid.
