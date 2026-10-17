# GPT-CHANGES

This folder records changes prepared or committed by ChatGPT for Commander Table, along with release steps that remain incomplete. It is a handoff log, not a replacement for `CHANGELOG.md` (which is the player-facing release history) or `AGENTS.md` (which documents the project's development and release workflow).

The active backlog of upcoming features is tracked in [OBJECTIVES.md](OBJECTIVES.md). Objectives 1–3 are complete and deployed; Objectives 8 and 10 are being combined into a small preview for v0.16.0. Objective 4 (larger battlefield cards) is intentionally deferred for now. Objectives 5–7, 9, and 11–12 remain queued.

**Status checked:** 2026-10-16  
**App version on main:** `0.15.1` (merged and deployed)  
**App version on active feature branch:** `0.16.0` (Library shuffle/mill shortcuts, synthesized shuffle sound, hotkey list, and Auto-Draw label; awaiting preview and approval).  
**Release tag status:** annotated tags `v0.14.1`, `v0.14.2`, `v0.15.0`, and `v0.15.1` still need to be created and verified locally; see “Remaining release housekeeping” below.

## Active-player yellow outline — v0.14.2 (merged to main)

- **Pull request:** [#3 — Restore yellow outline for the active player](https://github.com/ccall1212/commander-table/pull/3) — merged.
- **Merge commit:** [`78b6d5ae99e0ef95f0e5b644f1aa27f716211f84`](https://github.com/ccall1212/commander-table/commit/78b6d5ae99e0ef95f0e5b644f1aa27f716211f84).
- Restores a clearly visible yellow/gold outline on the active player's board in Sidebar and Grid layouts using a positioned overlay border, with the overlay suppressed where it would outline the wrong surface.
- App version and all 14 local CSS/JS cache-busting references are set to `0.14.2`; `CHANGELOG.md` and the player-facing guide describe the behavior, and the README badge was updated to `0.14.2` in [commit `aec758b`](https://github.com/ccall1212/commander-table/commit/aec758b139a394640008f43206719f07b3226b72).
- **Browser status:** Chris previewed the feature locally and confirmed that it looked good before explicitly authorizing publication. ChatGPT did not independently operate the browser.
- **Deployment status:** GitHub Pages deployment succeeded for the merge commit and again for the latest main tree at handoff commit [`33acd59`](https://github.com/ccall1212/commander-table/actions/runs/38991021652). That run completed successfully. The final live HTML was not independently fetched, so treat workflow success as deployment confirmation but not a separate browser-visible version check.
- **Tag status:** GitHub lookups found neither `v0.14.1` nor `v0.14.2`. The connected GitHub actions available here cannot create annotated tags, so the release tags still need to be created and verified locally. See the commands under “Remaining release housekeeping” below.

## Opening turn-order dice animation — v0.15.0 (merged and deployed)

- **Pull request:** [#4 — Start game with readable animated D20 roll](https://github.com/ccall1212/commander-table/pull/4) — merged.
- **Merge commit:** [`3974eb4`](https://github.com/ccall1212/commander-table/commit/3974eb49453cbe55dedcac87f46fb720b07d0583).
- Pressing **Start game** automatically rolls a d20 for every seated player. Each player's number changes inside a clean circular badge for about 2.4 seconds before settling on the synchronized final value.
- The winner's **GOES FIRST** label remains prominent for 3 full seconds after the last roll settles, then the overlay fades away. Existing tie-reroll logic is preserved and the highest roller starts the game.
- The overlay ignores pointer input and respects reduced-motion preferences. The redundant Dice-menu first-player roll item was removed; ordinary dice, coin flip, and random-player selection remain.
- **Deployment:** GitHub Pages workflow run [`38993645238`](https://github.com/ccall1212/commander-table/actions/runs/38993645238) completed successfully for merge commit `3974eb4`.
- **Browser status:** Chris approved the final preview appearance before publication. ChatGPT cannot run the real browser/multiplayer checks; these were not independently performed by ChatGPT after the merge.
- **Release tag:** `v0.15.0` is still pending. Create the annotated tag at merge commit `3974eb49453cbe55dedcac87f46fb720b07d0583` using the instructions below.
## Life-total button hit targets — v0.15.1 (merged and deployed)

- **Pull request:** [PR #6 — Make life-total +/- buttons easier to click](https://github.com/ccall1212/commander-table/pull/6) — merged.
- **Merge commit:** [`5927f82`](https://github.com/ccall1212/commander-table/commit/5927f82caf2e6ff82a9e065535044f27c653294b).
- The life-total minus/plus controls now use consistent 30–32px hit targets with clearer hover/focus feedback and descriptive accessible labels. The smaller opponent-board controls remain reasonably sized, while the ▾ counters button and Shift-click ±5 behavior are preserved.
- App/meta and cache-busting references are set to `0.15.1`; the player guide and `CHANGELOG.md` include the change.
- **Deployment:** GitHub Pages run [`38994671583`](https://github.com/ccall1212/commander-table/actions/runs/38994671583) succeeded for merge commit `5927f82`.
- **Browser status:** Chris reviewed the preview and authorized publication. ChatGPT did not independently run real-browser hit testing or the multiplayer life-request checks. The PR lists the recommended checks for Sidebar/Grid at 1920×1080 and 1366×768.
- **Release tag:** `v0.15.1` should point to merge commit `5927f82caf2e6ff82a9e065535044f27c653294b`; annotated tag creation remains a local step.
- Objective #12 (Forge-inspired targeting arrows) is queued and is not part of this life-control change.

## Library shuffle / mill and hotkey list — v0.16.0 in progress

- **Objectives:** #8 (Library shortcuts, animation and sound) and #10 (spell out Auto-Draw).
- **Branch / PR:** `fix/auto-draw-label` / [PR #8 — combined UI and Library shortcut improvements](https://github.com/ccall1212/commander-table/pull/8).
- Pressing **S** with the cursor over your Library shuffles it and plays a small CSS card-riffle animation plus a short original sound synthesized with Web Audio. No external sound file is needed; unsupported or blocked audio fails quietly.
- Pressing **X** with the cursor over your Library mills one card into the Graveyard and plays a short visual cue. **G = Graveyard**, **E = Exile**, and **B = Battlefield**. Pressing **S** away from the Library still opens Search Library.
- The ☰ menu includes **Hotkey list…**, a scrollable shortcut reference.
- Top-bar **AD** now reads **Auto-Draw**.
- App/meta and the 14 local CSS/JS cache-busting references are set to `0.16.0`.
- **Browser status:** ChatGPT ran syntax/source checks only. Manual checks should confirm the hotkeys work only in their intended context, the mill action moves exactly one top card, animation and sound are brief, and the Hotkey list fits the modal. Check at 1920×1080 and 1366×768 in Sidebar and Grid.
- **Release tag:** the final v0.16.0 target should be the eventual published release commit, to be recorded after merge.

## Changes made by ChatGPT

### Commander tax chip layout — v0.14.1

- Moved the commander-tax chip from a separate row above the command-zone commander card to the same header row as the `CMD` label. This avoids pushing the commander card down.
- Added the `.cmdhead` flex-row styling and adjusted the tax chip styling in `css/style.css`.
- Preserved the existing interaction: left-click adds 2 commander tax; right-click removes 2.
- Updated app version references to `0.14.1` in `js/app.js` and `index.html`, including local asset cache-busting query strings.
- Added the player-facing fix note and comparison links to `CHANGELOG.md`.
- Updated the README instructions to say the chip is beside CMD.

**Code change:** [PR #2](https://github.com/ccall1212/commander-table/pull/2)  
**Merge commit:** [`a8e1c7a0b1dcca5e686d6afc780b92a9819baaa0`](https://github.com/ccall1212/commander-table/commit/a8e1c7a0b1dcca5e686d6afc780b92a9819baaa0)

### README version badge

- Changed the README's version badge to explicitly show `0.14.1`. This avoids the badge continuing to show the previous version until a new Git tag exists.

**Commit:** [`d98d67704fe3312c2e682b5994040adace67013b`](https://github.com/ccall1212/commander-table/commit/d98d67704fe3312c2e682b5994040adace67013b)

## Checks and what has / hasn't been verified

- Chris previewed the v0.14.2 active-player outline locally and confirmed it looked good. ChatGPT did not independently operate a browser.
- GitHub Pages' workflow completed successfully for the app-code merge commit and again for the README-version commit:
  - [App-code deployment workflow](https://github.com/ccall1212/commander-table/actions/runs/38988306096)
  - [README deployment workflow](https://github.com/ccall1212/commander-table/actions/runs/38988499062)
- Source checks confirmed `index.html` and `js/app.js` both report `0.14.2`, and all 14 CSS/JS cache-busting references match.
- The live `github.io` page was not independently fetched by ChatGPT during the final verification, so a browser-visible live-version check should still be done if certainty is required.
- GitHub's tag lookups found neither `v0.14.1` nor `v0.14.2`. Both annotated tags remain outstanding; see the commands under “Remaining release housekeeping.”

## Remaining release housekeeping

Four annotated release tags are still pending and need local creation:

- `v0.14.1` should point to `d98d67704fe3312c2e682b5994040adace67013b` (commander tax chip fix and its README badge).
- `v0.14.2` should point to `aec758b139a394640008f43206719f07b3226b72` (the active-player yellow outline code merge plus README badge update).
- `v0.15.0` should point to `3974eb49453cbe55dedcac87f46fb720b07d0583` (automatic opening d20 roll).
- `v0.15.1` should point to `5927f82caf2e6ff82a9e065535044f27c653294b` (life-total +/- hit-target fix; the PR #6 merge commit deployed to Pages).

The current GitHub connection cannot create annotated Git tags. From a clean local checkout, first confirm none of these tags already exist, then run:

```bash
git switch main
git pull --ff-only
git tag -a v0.14.1 d98d67704fe3312c2e682b5994040adace67013b -m "v0.14.1 — commander tax beside CMD"
git tag -a v0.14.2 aec758b139a394640008f43206719f07b3226b72 -m "v0.14.2 — restore active-player yellow outline"
git tag -a v0.15.0 3974eb49453cbe55dedcac87f46fb720b07d0583 -m "v0.15.0 — opening turn-order d20 roll"
git tag -a v0.15.1 5927f82caf2e6ff82a9e065535044f27c653294b -m "v0.15.1 — easier life-total button targets"
git push origin v0.14.1 v0.14.2 v0.15.0 v0.15.1
git ls-remote --tags origin refs/tags/v0.14.1 refs/tags/v0.14.2 refs/tags/v0.15.0 refs/tags/v0.15.1
```

Only push tags that you have confirmed do not already exist. After pushing, verify the tag refs. GitHub Pages deployment for v0.15.1 succeeded at [run `38994671583`](https://github.com/ccall1212/commander-table/actions/runs/38994671583).

## Future publishing prompt

Use the reusable instructions in [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md). Replace the version, branch / pull request, and test status for each release.
