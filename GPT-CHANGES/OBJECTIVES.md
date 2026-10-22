# Commander Table — Objectives backlog

Features Chris has asked for that are **not built yet or remain open**. The numbers are Chris's original numbering; finished ones (1, 2, 3, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 33, 34, 35, 36, 37, 38, 39, 40, 41, 43, 44, 49, 50, 51, 52) were removed, and #7 (opponent boards looking dim) was dropped: the dimming only applies to players who are reconnecting or out, on purpose. Objective #15 (custom image uploads and pointer fixes) shipped in v0.21.4 via [PR #30](https://github.com/ccall1212/commander-table/pull/30). Objective #22 (Grid pile drops) shipped in v0.22.2 via [PR #35](https://github.com/ccall1212/commander-table/pull/35). Objective #19 (compact P/T badge and independent stat adjustments) shipped in v0.22.4 via [PR #38](https://github.com/ccall1212/commander-table/pull/38). Objective #23 (T hotkey opens the Token menu on empty battlefield space) shipped in v0.24.0 via [PR #41](https://github.com/ccall1212/commander-table/pull/41). Objectives #20 and #25 shipped in v0.23.0 via [PR #40](https://github.com/ccall1212/commander-table/pull/40). Objectives #17 (room chat and notifications) and #26 (turn-start banner) shipped together in v0.26.0 via [PR #42](https://github.com/ccall1212/commander-table/pull/42). Objective #27 (revealing a hand card to everyone) shipped in v0.27.0 via [PR #43](https://github.com/ccall1212/commander-table/pull/43). Objective #24 (the pre-game Deck Builder) shipped in v0.28.0; see [CHANGELOG.md](../CHANGELOG.md#0280---2026-10-19). Objective #12 (multiple shared targeting arrows) shipped in v0.29.0 via PR #47 after Chris tested and approved the ZIP. Objective #34 (host-selected mulligan rules, one house-rule mulligan and individual host extras) shipped in v0.35.0 via PR #54 after Chris tested and approved the ZIP. Objective #36 (entry-only unique player colors including red) shipped in v0.36.0 via PR #56 after Chris approved the revised copy. Objective #33 (moderation, private board handoffs and fresh-incognito recovery) shipped in v0.37.0 via PR #55 after Chris reported recovery works great and approved publication. Objective #29 (Deck Builder counts, color identity and duplicate checks) shipped in v0.38.0 via PR #50, and #30 (Collection backup/restore including current chat/opening preferences) shipped in v0.39.0 via PR #49, after Chris tested both older ZIPs and explicitly approved refreshing and publishing them. Objectives #37 (opening readiness and hidden in-game opening rule), #35 (personal Undo/checkpoints) and #40 (repeatable In response cue in player colors) shipped in v0.40.0, v0.41.0 and v0.42.0 through PRs #58–#60 after Chris tested the combined copy and approved publication with the final label/color adjustments. Objectives #41 (compact live readiness roster) and #39 (Host Game opening-rule dialog) shipped in v0.43.0 and v0.44.0 through PRs #61–#62 after Chris reported “Looks amazing” and approved push, merge and publication. Objective #42 (visible saved-image removal controls) was dropped at Chris's request on 2026-10-22; PR #63 was closed without merging or publishing, retaining the existing appearance controls. Objective #44 (unused LAN launchers/server/updater cleanup) shipped in v0.44.1 through PR #64 after Chris reported “Looks good” and approved completing the cleanup. Objectives #38 (collection backup/restore inside Deck Builder) and #43 (host/join Auto-Draw and Auto Untap All choices) shipped together in v0.45.0 through PR #65 after Chris reported “Looks good” and approved publication. Objective #49 (four more player colors and entry UI polish) shipped in v0.47.0 through PR #70 after Chris reported “looks great” and approved publication. Objective #50 (targeting-arrow source highlighting without numbers) shipped in v0.48.0 through PR #71 after Chris liked the highlight, requested removal of the numbers, and approved publication. Objective #18 (iPad/touch support) remains partly shipped, with real-device testing and refinements still open. Work on one at a time on its own branch and pull request, and read `AGENTS.md` first.

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

## 18. iPad and touch-friendly browser support — PARTLY SHIPPED (Touch mode in v0.22.0 and v0.22.1; iPhone menu access fix published in v0.46.1; real-device retest and refinements remain)

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

## 45. Brief hotkey reminder on game entry — QUEUED

When someone enters a game by hosting, joining, resuming or starting solo practice, show a **very short** hotkey popup after the entry flow is complete. It should be quick to dismiss and must not cover the color picker or other required entry dialogs. Include only these eight compact lines:

| Key | Reminder |
|---|---|
| **T** | Hover your battlefield card to tap/untap; hover empty battlefield space to open Tokens. |
| **Space** | Pass turn. |
| **R** | In response! |
| **D** | Draw a card. |
| **G** | Move your hovered card to Graveyard. |
| **E** | Move your hovered card to Exile. |
| **U** | Untap all. |
| **Ctrl+Z / ⌘Z** | Undo your last personal action. |

Chris initially suggested **X** for Exile, but the published shortcut is **E**; **X** currently mills the top card when hovering your Library. Preserve the current bindings. Put a **Don't show again** checkbox at the bottom and save that choice in this browser so future game entries skip the popup. Leave the full **Hotkey list** available from the in-game menu. This is a future objective; no implementation or test ZIP yet.

## 46. C shortcut and customizable hotkeys — IN PROGRESS

Press **C** while hovering a visible card that currently offers **Copy this card** in its right-click menu. Create the same token copy on your battlefield without opening the menu. This should work on your eligible cards and visible opponents' cards in Sidebar and Grid, including when viewing an opponent's board. Preserve the existing restrictions: hidden/face-down cards cannot be copied and no copy can enter the battlefield before the game starts. Ignore key repeat so holding C does not create a flood of copies; typing in chat or another input must never copy a card. Add **C — Copy hovered card** to the full Hotkey list and show **C** as the hint beside the matching menu action.

In **Hotkey list…**, let each player assign their own key or key combination to an action, reset an action to its default, or restore all defaults. Cover the actions in that list and useful game actions that currently have no shortcut. Keep assignments in that browser only, never in room state. Show the current key beside each action and reject duplicate bindings or browser-reserved combinations with a clear explanation. A custom shortcut must obey the action's usual context and permissions: hovered-card actions need an eligible visible card; game actions need the proper game state; text inputs, chat, menus and dialogs must keep normal typing. Changing a shortcut should update the corresponding menu hint. Avoid capturing an action while the player is recording a shortcut.

When this shortcut ships, show **C** in Objective #45's brief entry reminder in place of the optional **U** row, keeping that reminder to eight lines. Do not advertise C in the reminder before the shortcut works. Objective #45's later popup should reflect custom bindings if the player has changed them. No test ZIP yet.

## 47. Preview backgrounds larger — QUEUED

The Arcane Star and Shadow Black card-back presets and images were removed in v0.45.1 through PR #66. Older saved selections fall back to Ruby Sigil. The larger background preview below remains open.

On the start screen, let players inspect each play-area background in a larger view before choosing it. The existing thumbnail click should still select the background; provide a separate, obvious preview action so inspection does not silently change their selection. Show the full-size image without the dark gameplay overlay, fit it within desktop and smaller screens, and make the preview easy to close. Cover presets and a saved custom background when present. The larger background preview is independent of creating more backgrounds. No test ZIP for the preview yet.

## 48. More distinctive play-area backgrounds — QUEUED AS A SEPARATE ART PROJECT

Chris would like additional backgrounds with stronger identity because several current choices feel generic. Develop a small set of distinct concepts and review the art direction with him before adding assets. Use original artwork that avoids recognizable Magic branding or card-art copies; keep cards and controls readable over each scene. Supply full-resolution images and matching thumbnails, check actual dimensions and visible content, and test their appearance in Sidebar and Grid. This can proceed as its own project independently of Objective #47. No artwork proposal or test ZIP yet.
