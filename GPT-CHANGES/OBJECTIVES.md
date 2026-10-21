# Commander Table — Objectives backlog

Features Chris has asked for that are **not built yet or remain open**. The numbers are Chris's original numbering; finished ones (1, 2, 3, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 33, 34, 36) were removed, and #7 (opponent boards looking dim) was dropped: the dimming only applies to players who are reconnecting or out, on purpose. Objective #15 (custom image uploads and pointer fixes) shipped in v0.21.4 via [PR #30](https://github.com/ccall1212/commander-table/pull/30). Objective #22 (Grid pile drops) shipped in v0.22.2 via [PR #35](https://github.com/ccall1212/commander-table/pull/35). Objective #19 (compact P/T badge and independent stat adjustments) shipped in v0.22.4 via [PR #38](https://github.com/ccall1212/commander-table/pull/38). Objective #23 (T hotkey opens the Token menu on empty battlefield space) shipped in v0.24.0 via [PR #41](https://github.com/ccall1212/commander-table/pull/41). Objectives #20 and #25 shipped in v0.23.0 via [PR #40](https://github.com/ccall1212/commander-table/pull/40). Objectives #17 (room chat and notifications) and #26 (turn-start banner) shipped together in v0.26.0 via [PR #42](https://github.com/ccall1212/commander-table/pull/42). Objective #27 (revealing a hand card to everyone) shipped in v0.27.0 via [PR #43](https://github.com/ccall1212/commander-table/pull/43). Objective #24 (the pre-game Deck Builder) shipped in v0.28.0; see [CHANGELOG.md](../CHANGELOG.md#0280---2026-10-19). Objective #12 (multiple shared targeting arrows) shipped in v0.29.0 via PR #47 after Chris tested and approved the ZIP. Objective #34 (host-selected mulligan rules, one house-rule mulligan and individual host extras) shipped in v0.35.0 via PR #54 after Chris tested and approved the ZIP. Objective #36 (entry-only unique player colors including red) shipped in v0.36.0 via PR #56 after Chris approved the revised copy. Objective #33 (moderation, private board handoffs and fresh-incognito recovery) shipped in v0.37.0 via PR #55 after Chris reported recovery works great and approved publication. Objective #29 (Deck Builder counts, color identity and duplicate checks) shipped in v0.38.0 via PR #50, and #30 (Collection backup/restore including current chat/opening preferences) shipped in v0.39.0 via PR #49, after Chris tested both older ZIPs and explicitly approved refreshing and publishing them. Objective #18 (iPad/touch support) remains partly shipped, with real-device testing and refinements still open. Work on one at a time on its own branch and pull request, and read `AGENTS.md` first.

Status key: **Queued** = requested, not started. **In progress** = a branch / PR exists (see `README.md`). **Paused** = started, waiting on something. **Deferred** = on purpose not now.

Layouts that exist: **Sidebar** and **Grid** only. Every feature must be checked in both, at roughly 1920×1080 and 1366×768, with a second player watching if other players see it.

---

## 4. Larger battlefield cards on big displays — DEFERRED

Cards feel a little small when the browser is maximized on a 2K display (the size is fine at 1920×1080).

- Aim for roughly 15–20% larger cards at larger resolutions, where space allows; do not change how it looks at 1920×1080 and below.
- **Where to look:** in Sidebar your own board is drawn at its natural scale (limited by width). In Grid and in the opponent miniatures the board is auto-fitted: `computeFit()` in `js/app.js` picks the card size, and its `capPx` caps card width (56 px in miniatures, 150 px for a big board). Changing those numbers is the likely lever, but check that crowded boards still fit.
- Avoid clipping or overlapping cards more than today.

## 5. One-time "slam" animation when a card is played — SHIPPED; SOUND REFINEMENT OPEN

The Commander-to-battlefield slam animation and synthesized impact sound are published in v0.20.5 (PR #28). Chris wants to keep refining the sound, so any further audio work should be a separate focused change and must not disturb the currently published behavior while under review.

- Trigger on the play event only, never on later dragging or repositioning.
- Keep it short, click-through, and respectful of `prefers-reduced-motion`.
- Ordinary card placements and battlefield repositioning should use the softer tap; Commander casts use the heavier boom and longer color-identity ring.
- **Where to look:** card moves go through `moveCard()` / `doMove()` in `js/app.js`. The draw-card animation (`animateDrawCard()` and the `drawfx` message) is a working example of a click-through overlay effect that other players also see.

## 9. Choose a random deck from Archidekt or Moxfield — PAUSED AT CHRIS'S REQUEST (2026-10-20; draft PR #11 retained)

See [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md). Preserve draft PR #11 and its branch. Its previously supplied [archived draft ZIP](https://github.com/ccall1212/commander-table/archive/a415ef5a9d13531a9c6b5877ab40adf84388c6dc.zip) is historical; the separate test service is not deployed. Do not resume work or deploy its test Worker until Chris asks; live checks and publication approval will still be required afterward.

## 18. iPad and touch-friendly browser support — PARTLY SHIPPED (Touch mode in v0.22.0 and v0.22.1; real-device testing and refinements remain)

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

## 35. Personal Undo history / turn-phase checkpoints — IN PROGRESS (PR #59; awaiting Chris's test)

Chris authorized work on 2026-10-21. [PR #59](https://github.com/ccall1212/commander-table/pull/59) adds a dropdown beside Undo with personal action labels, confirmed restores and named phase checkpoints. Existing Undo was already local; this proposal also closes transfer/incoming-effect boundaries that could otherwise duplicate cards or reverse another player's effects. History resets at turns, transfers, incoming effects, handoffs, automatic board resizing and reload; restores preserve card IDs and room-save revisions. Only the local board rewinds. Automated checks and actual two-context Chromium with a local relay passed; Chris has not tested this new copy and publication is not approved.

**Current test copy:** [v0.41.0 ZIP](https://github.com/ccall1212/commander-table/archive/2cba32c5b4a4f6e1472dcc3a869dfd63f5aab411.zip), verified against the exact PR head. It includes Objective #37 and all published v0.39.0 features. PR #59 targets the #37 branch to keep its diff focused; publish #58 first, then reconcile #59 with main and retarget before publishing. Do not delete the #37 branch while #59 depends on it.

## 37. Opening-hand readiness and no pre-game battlefield moves — IN PROGRESS (PR #58; awaiting Chris's test)

Chris authorized work on 2026-10-21. [PR #58](https://github.com/ccall1212/commander-table/pull/58) requires every live seated player to keep the current opening deal before Start, displays pending names and blocks battlefield entry before Start (including Practice). Host validation covers stale kept status and incoming control requests; movement/token/copy guards cover local entry paths. Start clears opening-hand Undo history. Existing opening rules, Draw 10 bottom-three completion and host extras remain. Automated checks and actual two-player Chromium across Sidebar/Grid and both screen sizes passed; Chris has not tested this new copy and publication is not approved.

**Current test copy:** [v0.40.0 ZIP](https://github.com/ccall1212/commander-table/archive/639b15a3eb235006fdb10e7c071d01d3bd6082e7.zip), verified against the exact PR head. It includes all published v0.39.0 features; #35's separate v0.41.0 test copy also includes this proposal.

## 38. Move collection backup/restore into Deck Builder — QUEUED

Chris requested this for later on 2026-10-21 after Objectives #29 and #30 were published. Move the existing **Back up / restore…** entry from the main start area into the area opened by the **Deck Builder** button, reducing start-screen clutter. Keep both backup export and restore available there and preserve their published behavior, including optional preferences and appearance. This is a placement follow-up to shipped Objective #30; implementation has not started and no test ZIP exists yet.

## 39. Choose mulligan rules after pressing Host Game — QUEUED

Chris requested this for later on 2026-10-21. Remove the host's mulligan options from the main start area. After the player presses **Host Game**, ask which opening-hand/mulligan rule they want before completing the hosting flow. Include a short description such as **“You can change this after joining the game.”** Preserve the existing in-game host control for changing the rule, the published opening-hand modes and their mulligan limits/host-granted extras. This is a setup-flow follow-up to shipped Objective #34; implementation has not started and no test ZIP exists yet.
