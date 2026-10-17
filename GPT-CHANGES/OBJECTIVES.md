# Commander Table — Objectives Backlog

This is the working list of the next UI and gameplay improvements requested by Chris. Keep the original numbering so we can work through them one at a time. Objectives 1–3, 8, 10, and 13 are complete and deployed. Objective 4 (larger cards) is intentionally deferred. Objective #9 is paused in draft PR #11 and has not been merged or pushed to main; see [the import investigation handoff](PR-11-DECK-IMPORT-INVESTIGATION.md). Objective #6 (draw-card animation) is in progress in draft [PR #12](https://github.com/ccall1212/commander-table/pull/12); source changes have not been merged or pushed to main. Objectives 5, 7, 11, and 12 remain queued.

## Status key

- **In progress** — active implementation / PR.
- **Queued** — requested, not yet implemented.
- **Needs decision** — a design or existing-shortcut conflict must be resolved before implementation.

## 1. Restore the yellow active-player outline — COMPLETE (v0.14.2 merged to main)

Show a clear yellow/gold outline around the player whose turn it is. The existing "Pass Turn" button changes color, but the player board outline appears to have been lost.

- Apply correctly in Sidebar and Grid layouts, including the active player's own board and opponents' boards.
- When the turn passes, the highlight should move to the new active player.
- Focused opponent views must not show an outline around the wrong / transparent overlay.
- **Pull request:** [PR #3 — Restore yellow outline for the active player](https://github.com/ccall1212/commander-table/pull/3) — merged in [commit `78b6d5a`](https://github.com/ccall1212/commander-table/commit/78b6d5ae99e0ef95f0e5b644f1aa27f716211f84).
- **Status:** Chris previewed the change locally, confirmed it looked good, and approved publication. The app source is now on `main` at version `0.14.2`. GitHub Pages deployment and the missing annotated release tags are tracked in `GPT-CHANGES/README.md`.

## 2. Animate the opening turn-order dice roll — COMPLETE (v0.15.0 merged and deployed)

When the host presses **Start game**, automatically roll a d20 for each seated player and show a clear animated result on everyone's screen before the game board is revealed.

- Each player's number changes inside a circular badge for about 2.4 seconds, then settles on the synchronized final roll.
- The highest roll is highlighted with a prominent **GOES FIRST** label that remains visible for 3 full seconds after the last result settles.
- Ties reroll automatically, and the highest roller becomes the first active player. The separate Dice-menu roll option was removed.
- The overlay does not block clicks and respects reduced-motion preferences.
- **Pull request:** [PR #4 — Start game with readable animated D20 roll](https://github.com/ccall1212/commander-table/pull/4), merged as [`3974eb4`](https://github.com/ccall1212/commander-table/commit/3974eb49453cbe55dedcac87f46fb720b07d0583).
- **Deployment:** GitHub Pages run [`38993645238`](https://github.com/ccall1212/commander-table/actions/runs/38993645238) succeeded.
- **Release housekeeping:** the annotated `v0.15.0` tag is still pending because tag creation is not available through the current GitHub connection; instructions are in `GPT-CHANGES/README.md`.
- **Test status:** ChatGPT verified JavaScript syntax and source-level invariants, but did not run a real-browser multiplayer test.

## 3. Make life-total +/- controls easier to click — COMPLETE (v0.15.1 merged and deployed)

Make the minus/plus controls reliably clickable across their intended button areas without accidentally activating the board or counters menu.

- Uses consistent 30–32px hit targets with clear hover/focus feedback and accessible labels.
- Preserves the separate ▾ counters button sizing and Shift-click ±5 behavior.
- **Pull request:** [PR #6 — Make life-total +/- buttons easier to click](https://github.com/ccall1212/commander-table/pull/6), merged as [`5927f82`](https://github.com/ccall1212/commander-table/commit/5927f82caf2e6ff82a9e065535044f27c653294b).
- **Deployment:** GitHub Pages run [`38994671583`](https://github.com/ccall1212/commander-table/actions/runs/38994671583) succeeded.
- **Browser checks:** Chris reviewed the preview and authorized publication. ChatGPT did not independently run real-browser hit testing or multiplayer opponent-life requests; see PR #6 for manual test cases.

## 4. Increase battlefield card size on larger displays — QUEUED (deferred for now)

Cards feel a little too small when the browser is maximized on a 2K display, although the current size is acceptable at 1920×1080.

- Aim for roughly 15–20% larger cards at larger/full-screen resolutions, where space allows.
- Preserve the current readability and usable layout at 1920×1080 and smaller screens.
- Check Sidebar and Grid and avoid unnecessarily clipping or overlapping cards.

## 5. Add a dramatic one-time card-play “slam” animation — QUEUED

When a Commander is moved from the Command Zone onto the battlefield, play a satisfying slam animation with a glow matching the card's color identity / colors.

- Potentially trigger a similar effect when a card with mana value 8 or greater is first played onto the battlefield.
- Trigger on the play event only, not when the card is subsequently dragged or repositioned.
- Keep the effect brief and avoid distracting from gameplay; respect reduced-motion preferences if practical.

## 6. Animate drawing a card — PRIORITY 1 (IN PROGRESS, draft PR #12)

Whenever a player draws a card, animate the card moving from the Library toward their hand and flipping over as it arrives.

- Other players should see an appropriate version of the draw animation too.
- Avoid playing the animation for unrelated card movement, such as rearranging a card already in hand.
- Ensure the animation does not block clicks, dragging, or normal game play.
- **Preview branch:** `feat/draw-card-animation-preview`, in [draft PR #12](https://github.com/ccall1212/commander-table/pull/12). The source changes have **not been merged or pushed to main or published**; live/main remains at v0.16.0.
- The animation is attached to the manual draw action (clicking the Library or pressing D) and turn-start Auto-Draw. A small temporary event is relayed through the host; the event contains no card identity. The drawing player sees the actual card face as it arrives, while opponents see that player's card back on both sides.
- The overlay uses `pointer-events: none` and is skipped if reduced motion is preferred. Source-level syntax and version-reference checks have passed, but real-browser and multiplayer behavior has not been tested by ChatGPT.
- **Claude Code testing before merge:** solo click/D draws, multiplayer opponent view/privacy, Auto-Draw, 1v1 first-turn skip, empty library, moving cards already in hand, clicks/drags during animation, Top/Sidebar/Grid at 1920×1080 and 1366×768, reduced-motion preference, and browser console. Do not publish without Chris's explicit approval.

## 7. Keep opponent boards vibrant in Sidebar view — QUEUED

Opponent board previews in Sidebar view currently look darker / greyer than the user's main board. Keep opponent board art and card colors as vibrant as the main board.

- Find and remove or adjust the styling/filter/opacity causing the washed-out look.
- Retain clear layout boundaries and any intentional status indications (for example, genuinely offline or conceded players) without dimming a normal opponent board.
- Verify the effect on both large/focused boards and the miniature opponent tiles, if they use different styling.

## 8. Add Library-hover shortcuts and animations for shuffle / mill — COMPLETE (v0.16.0 merged and deployed)

When hovering over your own Library:

- **S** shuffles the Library and plays a small card-riffle animation plus a short synthesized sound; no external sound file is required.
- **X** mills exactly one card from the top of the Library into the Graveyard and plays a short visual cue.
- **L** opens Search Library from anywhere; **S** only shuffles while hovering the Library. Ctrl+F is left to the browser's Find-on-page feature.
- The ☰ Options menu includes a **Hotkey list…** modal with the game's current shortcuts.
- **Exile moves to E** so X is free for milling. **G remains Graveyard** and **B remains Battlefield**.
- **PR / merge:** [PR #8](https://github.com/ccall1212/commander-table/pull/8), merge commit [`5840ed1`](https://github.com/ccall1212/commander-table/commit/5840ed166e1759fb249bfe0b855817640e23412e). **GitHub Pages deployment succeeded** ([run `38996909975`](https://github.com/ccall1212/commander-table/actions/runs/38996909975)).
- **Browser testing:** ChatGPT checked source only; hands-on testing of audio, animations, and shortcuts in Sidebar/Grid is still recommended.


## 9. Choose a random deck from Archidekt or Moxfield — TEMPORARILY PAUSED (draft PR #11; not in main)

Add a **Choose Random Deck** option on the opening/join screen for quick testing and fun random games.

- Let the player choose Archidekt or Moxfield as the source.
- Let the player choose deck bracket **1, 2, 3, or 4** before selecting a random deck.
- Load the chosen deck into the lobby using the existing deck import flow wherever source access allows.
- Investigate what public search/API support each source provides; keep manual import available if random discovery is restricted.
- The attempted v0.17.0 implementation is kept in [draft PR #11](https://github.com/ccall1212/commander-table/pull/11), branch `feat/random-commander-deck-picker-preview`. Its source changes have **not been merged or pushed to main or published**. The working controls remain disabled/hidden while code is investigated; normal plain-text import remains available.
- Read [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md) before revisiting this work. It records the Forge Moxfield importer reference, the proposed relay, what was syntax/fixture-checked, and the required live-browser tests.
- Resume only after Objective #6 is addressed and live provider tests can be run. Do not enable the controls unless imports and bracket filtering are verified.

## 10. Spell out the Auto-Draw label — COMPLETE (v0.16.0 merged and deployed)

Replace the tiny **AD** label in the top controls with **Auto-Draw** so it is clear what the toggle does.

- The branch now uses the full **Auto-Draw** label, keeps the text on one line, and trims a little extra letter spacing to help it fit.
- Included in [PR #8](https://github.com/ccall1212/commander-table/pull/8), merged in [`5840ed1`](https://github.com/ccall1212/commander-table/commit/5840ed166e1759fb249bfe0b855817640e23412e); the Pages deployment succeeded ([run `38996909975`](https://github.com/ccall1212/commander-table/actions/runs/38996909975)). Visual fit at 1920×1080 and 1366×768 in Sidebar and Grid still merits hands-on confirmation.

## 11. Drag a selection rectangle to move multiple cards — QUEUED

Add a click-and-drag selection square, similar to EDHPlay or StarCraft, to select multiple cards and move them together.

- Draw a visible selection rectangle while dragging across the battlefield.
- Select cards intersecting the rectangle and allow the selected group to be moved as one operation.
- Keep normal single-card dragging, tapping, counters, and other click actions working as before.
- Respect card ownership/permissions and test different zoom levels and board layouts.


## 12. Draw targeting arrows between players' cards — QUEUED (Forge-inspired)

Add a visual way to show which card or player an effect is targeting, inspired by [Forge](https://github.com/Card-Forge/forge).

- Right-click a card on any player's battlefield to open its context menu, with an option such as **Connect arrow** / **Send arrow to…**; consider a separate **Attack** action when it fits the existing game model.
- After choosing the arrow action, click a destination card (including cards on another player's battlefield) to draw a clear arrow connecting source to destination.
- Everyone in the game should see the same arrow so a player can communicate, for example, which creature their removal spell is targeting.
- Provide an easy way to cancel arrow placement and clear/remove arrows after the table has understood the intent.
- Keep arrows visual-only: they should not move cards or automatically perform game actions. Preserve normal right-click menus, card dragging, and touch-friendly interactions.
- Decide on multiple simultaneous arrows, colors/labels, and exact menu wording during implementation; start with the simplest reliable targeting arrow.

## 13. Play a hovered hand card onto the battlefield tapped — COMPLETE (v0.16.0 merged and deployed)

- When the cursor is over one of your cards in hand, pressing **T** moves it onto the battlefield with its tapped state set. It should land in the battlefield area that matches the card's type, using the existing automatic placement logic.
- When a card already on the battlefield is hovered, **T** keeps its existing tap/untap behavior.
- Added **T** to the in-game Hotkey list and player guide. The hand-card right-click menu explicitly labels the action **Play tapped (T)**.
- Included in [PR #8](https://github.com/ccall1212/commander-table/pull/8), merged in [`5840ed1`](https://github.com/ccall1212/commander-table/commit/5840ed166e1759fb249bfe0b855817640e23412e); the Pages deployment succeeded ([run `38996909975`](https://github.com/ccall1212/commander-table/actions/runs/38996909975)).
- **Browser testing:** ChatGPT verified source-level behavior only. Hands-on check a creature, land, and artifact/enchantment, confirm each enters tapped in the correct area, verify the right-click menu label, and confirm T still taps/untaps cards already on the battlefield.

## Suggested workflow

1. Work on one objective at a time, beginning with the next incomplete objective.
2. Make a small feature/fix branch and pull request.
3. Run source-level checks, then browser-test Sidebar and Grid at 1920×1080 and 1366×768 where applicable.
4. Update `README.md`, `CHANGELOG.md`, app version/cache references and this folder's handoff notes as appropriate.
5. Only publish after Chris explicitly approves the specific release. Verify the release tag and GitHub Pages deployment and report any item that remains incomplete.

## Separate release housekeeping

- The last checked GitHub tag lookup did not find `v0.14.1`. Confirm and create/push that annotated tag at the intended release commit before treating the 0.14.1 release housekeeping as complete.
