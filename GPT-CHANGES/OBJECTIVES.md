# Commander Table — Objectives backlog

Features Chris has asked for that are **not built yet or remain open**. The numbers are Chris's original numbering; finished ones (1, 2, 3, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27) were removed, and #7 (opponent boards looking dim) was dropped: the dimming only applies to players who are reconnecting or out, on purpose. Objective #15 (custom image uploads and pointer fixes) shipped in v0.21.4 via [PR #30](https://github.com/ccall1212/commander-table/pull/30). Objective #22 (Grid pile drops) shipped in v0.22.2 via [PR #35](https://github.com/ccall1212/commander-table/pull/35). Objective #19 (compact P/T badge and independent stat adjustments) shipped in v0.22.4 via [PR #38](https://github.com/ccall1212/commander-table/pull/38). Objective #23 (T hotkey opens the Token menu on empty battlefield space) shipped in v0.24.0 via [PR #41](https://github.com/ccall1212/commander-table/pull/41). Objectives #20 and #25 shipped in v0.23.0 via [PR #40](https://github.com/ccall1212/commander-table/pull/40). Objectives #17 (room chat and notifications) and #26 (turn-start banner) shipped together in v0.26.0 via [PR #42](https://github.com/ccall1212/commander-table/pull/42). Objective #27 (revealing a hand card to everyone) shipped in v0.27.0 via [PR #43](https://github.com/ccall1212/commander-table/pull/43). Objective #24 (the pre-game Deck Builder) shipped in v0.28.0; see [CHANGELOG.md](../CHANGELOG.md#0280---2026-10-19). Objective #12 (multiple shared targeting arrows) shipped in v0.29.0 via PR #47 after Chris tested and approved the ZIP. Objective #18 (iPad/touch support) remains partly shipped, with real-device testing and refinements still open. Work on one at a time on its own branch and pull request, and read `AGENTS.md` first.

Status key: **Queued** = requested, not started. **In progress** = a branch / PR exists (see `README.md`). **Paused** = started, waiting on something. **Deferred** = on purpose not now.

Layouts that exist: **Sidebar** and **Grid** only. Every feature must be checked in both, at roughly 1920×1080 and 1366×768, with a second player watching if other players see it.

---

## 4. Larger battlefield cards on big displays — DEFERRED

Cards feel a little small when the browser is maximized on a 2K display (the size is fine at 1920×1080).

- Aim for roughly 15–20% larger cards at larger resolutions, where space allows; do not change how it looks at 1920×1080 and below.
- **Where to look:** in Sidebar your own board is drawn at its natural scale (limited by width). In Grid and in the opponent miniatures the board is auto-fitted: `computeFit()` in `js/app.js` picks the card size, and its `capPx` caps card width (56 px in miniatures, 150 px for a big board). Changing those numbers is the likely lever, but check that crowded boards still fit.
- Avoid clipping or overlapping cards more than today.

## 5. One-time "slam" animation when a card is played — SHIPPED; SOUND REFINEMENT OPEN

The Commander-to-battlefield slam animation and synthesized impact sound are published in v0.20.5 (PR #28). Chris wants to keep refining the sound, so any further audio work should be a separate focused change and must not disturb the currently published v0.20.6 version while under review.

- Trigger on the play event only, never on later dragging or repositioning.
- Keep it short, click-through, and respectful of `prefers-reduced-motion`.
- Ordinary card placements and battlefield repositioning should use the softer tap; Commander casts use the heavier boom and longer color-identity ring.
- **Where to look:** card moves go through `moveCard()` / `doMove()` in `js/app.js`. The draw-card animation (`animateDrawCard()` and the `drawfx` message) is a working example of a click-through overlay effect that other players also see.

## 9. Choose a random deck from Archidekt or Moxfield — PAUSED AT CHRIS'S REQUEST (2026-10-20; draft PR #11 retained)

See [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md). Preserve draft PR #11 and its branch. Do not resume work or deploy its test Worker until Chris asks; live checks and publication approval will still be required afterward.

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

## 29. Optional Deck Builder checks — IN PROGRESS (PR #50; v0.31.0 test copy)

Chris selected this suggestion on 2026-10-21. [PR #50](https://github.com/ccall1212/commander-table/pull/50), branch `feat/deck-builder-checks`, adds a live, dismissible count and advisory notes for missing commander, combined color identity and likely singleton duplicates, including common printed exceptions. It does not enforce legality or house rules. The refreshed branch passed all five Node suites and actual Chromium HTTP checks at 1920×1080 and 1366×768, including a token-gallery compatibility smoke check. Extract/open and Chris's hands-on testing of the deck checks are pending. The PR links the exact-commit test ZIP and click list. Publication is not approved.

## 30. Collection backup and restore — IN PROGRESS (PR #49; v0.32.0 test copy)

Chris selected this suggestion on 2026-10-21. [PR #49](https://github.com/ccall1212/commander-table/pull/49), branch `feat/collection-backup`, exports all saved decks, printings, linked tokens, appearance/uploads, saved name and preferences. Restore previews additions/skips, preserves existing decks, adds conflicting versions as copies, and restores preferences only when selected. Active sessions and connection identities are excluded. Eleven automated backup checks and the existing token/targeting/P/T suites passed. Actual Chromium HTTP download/restore tests across separate contexts passed, including preservation of the new token artwork metadata and backward compatibility with older backups. Extract/open and Chris's hands-on testing are pending. The PR links the exact-commit test ZIP and click list. Publication is not approved.

The two remaining feature branches include the published token release but predate the published floating-chat release. Before either is published, integrate current main, retain chat behavior, and reconcile its proposed version/release notes. When integrating backup PR #49, include validated `ct.chatPanel` preferences (including size) in its optional preference backup. Their existing ZIPs remain the exact independent proposals recorded in their PRs. Managed Chromium blocks `file://` navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`); assistant browser checks used localhost HTTP, not Chris's extract-and-double-click flow. Draft PR #11 remains paused.
