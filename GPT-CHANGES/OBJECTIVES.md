# Commander Table — Objectives Backlog

This is the working list of the next UI and gameplay improvements requested by Chris. Keep the original numbering so we can work through them one at a time. Objectives 1 and 2 are complete; **Objective 3** is in progress. Objectives 7–11 remain queued.

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

## 3. Make life-total +/- controls easier to click — IN PROGRESS (v0.15.1 branch)

Fix the life total controls so clicking the minus or plus control anywhere within its intended button works reliably. Consider making the +/- controls unambiguous buttons rather than having a small clickable area.

- Verify in Sidebar and Grid views, at common desktop resolutions.
- Ensure clicks do not accidentally open the player's board or counter panel.

## 4. Increase battlefield card size on larger displays — NEXT

Cards feel a little too small when the browser is maximized on a 2K display, although the current size is acceptable at 1920×1080.

- Aim for roughly 15–20% larger cards at larger/full-screen resolutions, where space allows.
- Preserve the current readability and usable layout at 1920×1080 and smaller screens.
- Check Sidebar and Grid and avoid unnecessarily clipping or overlapping cards.

## 5. Add a dramatic one-time card-play “slam” animation — QUEUED

When a Commander is moved from the Command Zone onto the battlefield, play a satisfying slam animation with a glow matching the card's color identity / colors.

- Potentially trigger a similar effect when a card with mana value 8 or greater is first played onto the battlefield.
- Trigger on the play event only, not when the card is subsequently dragged or repositioned.
- Keep the effect brief and avoid distracting from gameplay; respect reduced-motion preferences if practical.

## 6. Animate drawing a card — QUEUED

Whenever a player draws a card, animate the card moving from the Library toward their hand and flipping over as it arrives.

- Other players should see an appropriate version of the draw animation too.
- Avoid playing the animation for unrelated card movement, such as rearranging a card already in hand.
- Ensure the animation does not block clicks, dragging, or normal game play.

## 7. Keep opponent boards vibrant in Sidebar view — QUEUED

Opponent board previews in Sidebar view currently look darker / greyer than the user's main board. Keep opponent board art and card colors as vibrant as the main board.

- Find and remove or adjust the styling/filter/opacity causing the washed-out look.
- Retain clear layout boundaries and any intentional status indications (for example, genuinely offline or conceded players) without dimming a normal opponent board.
- Verify the effect on both large/focused boards and the miniature opponent tiles, if they use different styling.

## 8. Add Library-hover shortcuts and animations for shuffle / mill — QUEUED; SHORTCUT CONFLICT TO RESOLVE

When the mouse is hovering over the Library pile:

- Press **S** to shuffle the Library and play a small visual shuffle animation, with one or two cards peeking/sliding out and then returning into the deck.
- Press **X** to mill exactly one card, moving the top card into the Graveyard with a fitting visual animation.
- The animation should provide clear feedback without disrupting drag-and-drop or normal Library interactions.

**Existing shortcuts conflict:** `AGENTS.md` and the current controls use **S** for Search Library and **X** for Exile. Before implementing Objective 8, choose the intended behavior for these conflicts (for example, explicitly reassign the old shortcuts or choose different keys). Do not silently break Search Library or Exile.


## 9. Choose a random deck from Archidekt or Moxfield — QUEUED

Add a **Choose Random Deck** option on the opening/join screen for quick testing and fun random games.

- Let the player choose Archidekt or Moxfield as the source.
- Let the player choose deck bracket **1, 2, 3, or 4** before selecting a random deck.
- Load the chosen deck into the lobby using the existing deck import flow wherever source access allows.
- Investigate what public search/API support each source provides; keep manual import available if random discovery is restricted.

## 10. Spell out the Auto-Draw label — QUEUED

Replace the tiny **AD** label in the top controls with **Auto-Draw** so it is clear what the toggle does.

- Keep the control readable without pushing other top-bar actions out of place.
- Check at 1920×1080 and 1366×768, and in both Sidebar and Grid layouts.

## 11. Drag a selection rectangle to move multiple cards — QUEUED

Add a click-and-drag selection square, similar to EDHPlay or StarCraft, to select multiple cards and move them together.

- Draw a visible selection rectangle while dragging across the battlefield.
- Select cards intersecting the rectangle and allow the selected group to be moved as one operation.
- Keep normal single-card dragging, tapping, counters, and other click actions working as before.
- Respect card ownership/permissions and test different zoom levels and board layouts.

## Suggested workflow

1. Work on one objective at a time, beginning with the next incomplete objective.
2. Make a small feature/fix branch and pull request.
3. Run source-level checks, then browser-test Sidebar and Grid at 1920×1080 and 1366×768 where applicable.
4. Update `README.md`, `CHANGELOG.md`, app version/cache references and this folder's handoff notes as appropriate.
5. Only publish after Chris explicitly approves the specific release. Verify the release tag and GitHub Pages deployment and report any item that remains incomplete.

## Separate release housekeeping

- The last checked GitHub tag lookup did not find `v0.14.1`. Confirm and create/push that annotated tag at the intended release commit before treating the 0.14.1 release housekeeping as complete.
