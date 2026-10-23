# Commander Table — Objectives backlog

Features Chris has asked for that are **not built yet or remain open**. The numbers are Chris's original numbering; finished ones (1, 2, 3, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 33, 34, 35, 36, 37, 38, 39, 40, 41, 43, 44, 46, 47, 49, 50, 51, 52) were removed, and #7 (opponent boards looking dim) was dropped: the dimming only applies to players who are reconnecting or out, on purpose. Objective #15 (custom image uploads and pointer fixes) shipped in v0.21.4 via [PR #30](https://github.com/ccall1212/commander-table/pull/30). Objective #22 (Grid pile drops) shipped in v0.22.2 via [PR #35](https://github.com/ccall1212/commander-table/pull/35). Objective #19 (compact P/T badge and independent stat adjustments) shipped in v0.22.4 via [PR #38](https://github.com/ccall1212/commander-table/pull/38). Objective #23 (T hotkey opens the Token menu on empty battlefield space) shipped in v0.24.0 via [PR #41](https://github.com/ccall1212/commander-table/pull/41). Objectives #20 and #25 shipped in v0.23.0 via [PR #40](https://github.com/ccall1212/commander-table/pull/40). Objectives #17 (room chat and notifications) and #26 (turn-start banner) shipped together in v0.26.0 via [PR #42](https://github.com/ccall1212/commander-table/pull/42). Objective #27 (revealing a hand card to everyone) shipped in v0.27.0 via [PR #43](https://github.com/ccall1212/commander-table/pull/43). Objective #24 (the pre-game Deck Builder) shipped in v0.28.0; see [CHANGELOG.md](../CHANGELOG.md#0280---2026-10-19). Objective #12 (multiple shared targeting arrows) shipped in v0.29.0 via PR #47 after Chris tested and approved the ZIP. Objective #34 (host-selected mulligan rules, one house-rule mulligan and individual host extras) shipped in v0.35.0 via PR #54 after Chris tested and approved the ZIP. Objective #36 (entry-only unique player colors including red) shipped in v0.36.0 via PR #56 after Chris approved the revised copy. Objective #33 (moderation, private board handoffs and fresh-incognito recovery) shipped in v0.37.0 via PR #55 after Chris reported recovery works great and approved publication. Objective #29 (Deck Builder counts, color identity and duplicate checks) shipped in v0.38.0 via PR #50, and #30 (Collection backup/restore including current chat/opening preferences) shipped in v0.39.0 via PR #49, after Chris tested both older ZIPs and explicitly approved refreshing and publishing them. Objectives #37 (opening readiness and hidden in-game opening rule), #35 (personal Undo/checkpoints) and #40 (repeatable In response cue in player colors) shipped in v0.40.0, v0.41.0 and v0.42.0 through PRs #58–#60 after Chris tested the combined copy and approved publication with the final label/color adjustments. Objectives #41 (compact live readiness roster) and #39 (Host Game opening-rule dialog) shipped in v0.43.0 and v0.44.0 through PRs #61–#62 after Chris reported “Looks amazing” and approved push, merge and publication. Objective #42 (visible saved-image removal controls) was dropped at Chris's request on 2026-10-22; PR #63 was closed without merging or publishing, retaining the existing appearance controls. Objective #44 (unused LAN launchers/server/updater cleanup) shipped in v0.44.1 through PR #64 after Chris reported “Looks good” and approved completing the cleanup. Objectives #38 (collection backup/restore inside Deck Builder) and #43 (host/join Auto-Draw and Auto Untap All choices) shipped together in v0.45.0 through PR #65 after Chris reported “Looks good” and approved publication. Objective #49 (four more player colors and entry UI polish) shipped in v0.47.0 through PR #70 after Chris reported “looks great” and approved publication. Objective #50 (targeting-arrow source highlighting without numbers) shipped in v0.48.0 through PR #71 after Chris liked the highlight, requested removal of the numbers, and approved publication. Objective #46 (copy shortcut and configurable Hotkeys) shipped in v0.51.0 through PR #76 after Chris tested the ZIP and approved publication. Objective #47 (larger background previews) shipped in v0.52.0 through PR #77; the double-click refinement shipped in v0.52.1 through PR #78 after Chris reported “Amazing” and approved publication. Objective #18 (iPad/touch support) remains partly shipped, with real-device testing and refinements still open. Work on one at a time on its own branch and pull request, and read `AGENTS.md` first.

Status key: **Idea only** = recorded for discussion/experiments, not approved for implementation. **Queued** = requested, not started. **In progress** = a branch / PR exists (see `README.md`). **Paused** = started, waiting on something. **On Hold** = waiting for design decisions or dependencies before work starts. **Deferred** = intentionally postponed because of complexity or priority.

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
| **C** | Copy a hovered visible card. |
| **Ctrl+Z / ⌘Z** | Undo your last personal action. |

Chris initially suggested **X** for Exile, but the published shortcut is **E**; **X** currently mills the top card when hovering your Library. Use the player's current custom bindings in the reminder when they differ from the defaults. Put a **Don't show again** checkbox at the bottom and save that choice in this browser so future game entries skip the popup. Leave the full **Hotkeys** list available from the in-game menu. This is a future objective; no implementation or test ZIP yet.

## 48. More distinctive play-area backgrounds — QUEUED AS A SEPARATE ART PROJECT

Chris would like additional backgrounds with stronger identity because several current choices feel generic. Develop a small set of distinct concepts and review the art direction with him before adding assets. Use original artwork that avoids recognizable Magic branding or card-art copies; keep cards and controls readable over each scene. Supply full-resolution images and matching thumbnails, check actual dimensions and visible content, and test their appearance in Sidebar and Grid. This can proceed as its own project independently of Objective #47. No artwork proposal or test ZIP yet.


## Objectives from Chris and a friend — recorded and prioritized 2026-10-22

Chris asked to retain all of #53–#60 in the backlog and mark the more difficult items **On Hold** or **Deferred**. **Queued** items are candidates for future work, with their open choices resolved when taken up; this documentation update does not start implementation. All descriptions and screenshot-reference details are retained below. No branches, implementations, or test ZIPs exist for these objectives.

| Objective | Status | Difficulty / reason |
|---|---|---|
| #53 Quick Grab basic lands | Queued | Low–moderate; choose random versus counted picker, destination and shuffle/tapped behavior |
| #54 W hotkey and arrows to names | Queued | Moderate; keep custom hotkeys and player-name anchors working across layouts. Life-point relocation remains optional and undecided |
| #55 Combat power / damage helper | Deferred | High for accurate damage automation; a narrower incoming-power aid could be reconsidered separately |
| #56 Status toggles, keyword counters and icons | Queued | Moderate; distinguish statuses from true counters and keep the visual display readable |
| #57 Deck-size limit / Whtz exception | On Hold | Low–moderate technically, but count definition and strict blocking versus warnings need a decision |
| #58 Drag-to-target / attack | Deferred | High interaction risk; clarify attack versus target, vigilance and intentional transfers first |
| #59 Blocker relationships | On Hold | Moderate–high; settle attack/block representation and multiple-blocker behavior after #54’s targeting work |
| #60 Recent-counter reuse, bulk application and copying/dragging | Queued in stages | Reuse and application to own cards first; cross-player copying/dragging/transfer is On Hold pending interaction, synchronization and undo design |


## 53. Quick Grab basic lands from the Library — QUEUED

Add a shortcut similar to the existing **Search Library** flow, available from the Library controls/menu. Chris recalls another game having **Quick grab basic land** directly below its search-deck option. The aim is to get a basic land quickly without opening the full Library search. Two alternative designs are still under consideration:

- **Random basic land:** choose **Quick grab basic land** to look through the player’s current Library and retrieve a basic land at random from the basic lands actually remaining. The destination for this variant still needs to be decided.
- **Counted basic-land submenu:** based on the loaded deck and commander, show the relevant basic-land choices and **how many of each remain in the Library**. Let the player choose a basic land and place it directly onto the **battlefield**. Chris’s earlier sixth screenshot is the reference for this submenu approach: **Search Library**, **Shuffle Library**, **Draw random card**, and **Play card & shuffle**, with a submenu containing cards such as Forest, Island and Plains.

Counts and available choices should reflect the current Library, not just the original imported deck; lands already drawn or moved elsewhere are not still available to grab. Use actual cards from that Library rather than generating a new land. The exact use of commander/deck information to organize the choices remains open.

Before implementation, choose between these approaches or decide whether both belong in the menu. Confirm whether grabbing also shuffles and whether a land placed on the battlefield enters tapped or untapped. The screenshot’s **Play card & shuffle** action is inspiration, not a finalized shuffle rule. Keep the shortcut reachable on touch devices as well as through mouse-based Library controls. Queued for future work; no implementation or test ZIP yet.

## 54. W hotkey and targeting arrows ending at player names — QUEUED

Explore click-and-drag targeting-arrow controls like EDHPlay, with **W** as the default hotkey. Arrows aimed at a player should end at **that player’s name**, rather than going directly into the middle of their board. Reference: Chris’s fifth screenshot shows a large blue arrow from a battlefield card toward a **Player 2** name label.

- Keep W integrated with the existing configurable Hotkeys, preserving a player’s custom bindings rather than silently overwriting them.
- Keep the player-name destination clear in Sidebar and Grid, including when a player is shown in a miniature or focused board view.
- **Possible related layout change, not decided:** move life points to the **top middle of the board**. Chris raised this as a possibility alongside the name-targeted arrows; decide its placement and relationship to the player name before implementation.
- Blocker relationships are a separate idea in **#59**. This objective covers the targeting interaction, hotkey and arrow destination; it does not include automatic combat or damage rules.

## 55. Combat-phase incoming-power / damage helper — DEFERRED

**Deferred because of combat-rules complexity.** A manual incoming-power aid would be a smaller possible first step, but its scope must be chosen before work starts.

Explore a combat phase that counts damage coming toward a player. Chris’s example: enter combat, tap attacking cards and send arrows toward another player; show the combined power heading that way. Players would still choose their blockers.

- Decide how attackers are explicitly identified; merely tapping a card may represent something other than attacking, and vigilance attackers need not tap.
- Distinguish a useful incoming-power total from actual damage after blocks. Do not assume the display can calculate final damage from power alone.
- Chris specifically raised **trample** as a complication: decide whether this remains a manual aid or includes combat rules. Blocking, damage assignment and abilities such as trample, first/double strike or damage prevention need a defined scope before automatic totals or life changes are considered.
- Coordinate with #59’s blocker relationships, #54’s name-targeted arrows and #58’s drag-to-target idea. No combat automation is approved.

## 56. Card status toggles, keyword counters and visual icons — QUEUED

Explore nonmovable on/off card markers for effects that are **not counters**, while retaining separate true-counter versions where applicable so counter interactions such as proliferate can be represented. Chris also wants visual icons/art for the markers, inspired by the supplied references; no assets are being created now. This objective covers the status/counter distinction and visual representation. Recent-counter reuse, bulk application and copying/dragging are tracked separately in **#60**.

- References: screenshots 1, 3 and 4 show a card with **Goaded** and **Prepared** labels, small ability icons beside the card, and a menu listing **Toggle Goaded**, **Toggle Prepared**, plus counter toggles for **Deathtouch, Double Strike, First Strike, Flying, Haste, Hexproof, Indestructible, Lifelink, Menace, Reach, Shield, Trample and Vigilance**.
- Keep a non-counter status distinct from an actual counter; a status toggle must not become proliferatable merely because it has an icon. Decide which effects have meaningful counter versions rather than assuming every status does.
- Preserve the ability to represent/count applicable real counters separately. Define how toggles, quantities, removal and proliferate should interact before implementation.
- Explore creating readable icons inspired by the examples and pairing them with clear labels/tooltips. The icon designs, placement and behavior are still open.

## 57. A 100-card size limit with a Whtz commander exception — ON HOLD

**On Hold pending the card-count definition and a decision about warnings versus preventing play; the check itself is not one of the hardest changes.**

Chris proposed that total Library cards be capped at **100**, and that an oversized deck could not be played unless **Whtz, the Bibliophile** is the commander.

- Reference: screenshot 2 shows **Whtz, the Bibliophile**, whose **Rulebreaker** text says a deck with it as commander has **no maximum deck size**. It also has a draw-and-gain-1-life ability whose cost is reduced when the starting deck has at least 200 cards; that ability is context, not a request to automate it.
- Before implementation, clarify whether Chris’s “total Library cards” means the imported starting deck including commander(s), or the Library zone itself. Commander’s normal 100-card deck count includes commander(s); the Library’s changing size during play is a different count.
- Decide when any limit is checked and how it would interact with existing deck validation and casual play. The proposed Whtz exception concerns having it as commander, not merely including it somewhere in the deck.
- Record the requested exception without adding other legality restrictions or enforcing a size rule now.

## 58. Drag a card toward a player to target/attack instead of giving it away — DEFERRED

**Deferred because this changes an established gesture and mixes targeting, attacking and tapping.** Resolve the targeting/blocker design and vigilance behavior before revisiting it.

Explore replacing the current drag-to-another-player card-giving gesture: dragging a card toward another player would target that player, return the card to its original position, and leave it tapped.

- Chris proposed a **vigilance** exception: a vigilance card would return without tapping. Decide whether vigilance is marked manually (see #56) or recognized from card data before programming any automatic behavior.
- Define whether this gesture declares an attack or only creates a targeting arrow; not every card or player-targeted action is combat.
- Coordinate with #54’s name-targeted arrows, #59’s blocker relationships and #55’s possible combat helper, and decide how intentional card transfers would remain available if the drag gesture is repurposed.
- Original-position restoration, tapping and ownership/control must have clear behavior before an experiment is built. Existing drag/give behavior remains unchanged for now.


## 59. Blocker relationships and incoming-arrow redirection — ON HOLD

**On Hold until #54’s targeting interaction and the attack/block relationship design are settled.**

Keep blocker relationships separate from #54’s W hotkey and player-name arrow destinations. If player 1 sends an attacking-card arrow toward player 2, let player 2 drag an arrow from their blocking card onto that incoming attacker. Chris’s original idea is for the incoming arrow to move from its player destination onto that specific blocking card instead.

- Define how attacker/blocker relationships are represented, including multiple blockers, multiple attackers, and clearing or changing a block.
- Decide how the attacked player remains identifiable when an arrow is redirected to a blocking card. The exact display and gesture still need discussion.
- Coordinate with #55’s possible combat helper and #58’s drag-to-target idea, while keeping this objective independently reviewable.
- This is a visual relationship idea; automatic damage assignment or life changes are not included. No implementation or test ZIP yet.


## 60. Recent-counter reuse, bulk application and copying/dragging — QUEUED IN STAGES; CROSS-PLAYER ACTIONS ON HOLD

Separate from #56’s status toggles and icons. Start with recent-counter reuse across cards and quick application to your own cards. Cross-player copying, dragging and transfer remain **On Hold** until the interaction, synchronization and undo behavior are settled. These conveniences should also support existing counter types without requiring all of #56 to ship first.

Chris also wants easier counter reuse and copying, so the same counter does not have to be typed separately for every card:

- **Most recent counter used:** make the last-used counter type available across **all cards**, rather than remembering it only on the card where it was added. For example, after adding a **Trample counter** once, offer an immediate way to add that same counter to other cards without retyping its name.
- **Apply to several cards:** explore a quick repeat action and/or applying the chosen counter to a selection of cards. Chris’s example is giving a Trample counter to all of his cards; the exact bulk-selection gesture is still open.
- **Copy or drag counters:** explore copying an existing **+1/+1 counter or any other counter type**, and/or clicking and dragging its visible counter marker from one card to another. Include cards controlled by different players, not just cards on the same board.
- Keep **copy/add** distinct from **move/transfer**: copying leaves the source counter in place and adds one at the destination; moving removes the chosen quantity from the source and adds it at the destination. Decide how the gesture distinguishes these actions and whether it handles one counter or a chosen quantity.
- Define how edits to another player’s card are requested/applied, how counts stay synchronized, and how accidental actions are reversed. These shortcuts concern actual counters; they must preserve the separate non-counter status toggles above. Counter reuse and application to your own cards are queued for staged work. Cross-player drag/copy/transfer is **On Hold** until its interaction, synchronization and undo behavior are designed.
