# GPT-CHANGES

This folder records changes prepared or committed by ChatGPT for Commander Table, along with release steps that remain incomplete. It is a handoff log, not a replacement for `CHANGELOG.md` (which is the player-facing release history) or `AGENTS.md` (which documents the project's development and release workflow).

The active backlog of upcoming features is tracked in [OBJECTIVES.md](OBJECTIVES.md). Objective 2 is complete and deployed; Objective 3 (life-total +/- hit targets) is in progress on `fix/life-total-hit-target`. The three newly requested ideas are recorded as Objectives 9–11.

**Status checked:** 2026-10-17  
**App version on main:** `0.15.0` (merged and deployed)  
**App version on active branch:** `0.15.1` (life-total control usability fix; not published)  
**Release tag status:** annotated tags `v0.14.1`, `v0.14.2`, and `v0.15.0` still need to be created and verified locally; see “Remaining release housekeeping” below.

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
## Life-total button hit targets — v0.15.1 (in progress)

- **Pull request:** [PR #6 — Make life-total +/- buttons easier to click](https://github.com/ccall1212/commander-table/pull/6).
- **Branch:** `fix/life-total-hit-target`.
- Adds an explicit `life-adjust` class to the life total −/+ buttons, gives both buttons a consistent 30–32px clickable target, and makes hover/focus states clearer.
- Preserves the separate ▾ counters button sizing and existing Shift-click ±5 behavior. Adds descriptive accessible labels.
- Bumps the branch's app/cache version to `0.15.1` and updates the player guide, Changelog and Objectives.
- New user-requested objectives #9–11 (random source deck with bracket selection; spell out Auto-Draw; drag-selection for multiple cards) are recorded in `OBJECTIVES.md`.
- **Browser status:** not tested by ChatGPT. Check both the player's own life box and opponent miniatures in Sidebar and Grid, at 1920×1080 and 1366×768; verify minus/plus work when clicking anywhere in their visible button area and don't open the tile/board or counters menu.

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

Three annotated release tags are still pending and need local creation:

- `v0.14.1` should point to `d98d67704fe3312c2e682b5994040adace67013b` (commander tax chip fix and its README badge).
- `v0.14.2` should point to `aec758b139a394640008f43206719f07b3226b72` (the active-player yellow outline code merge plus README badge update).
- `v0.15.0` should point to `3974eb49453cbe55dedcac87f46fb720b07d0583` (automatic opening d20 roll, circular number animation, and 3-second winner reveal; this is the PR #4 merge commit deployed to Pages).

The current GitHub connection has read/write support for files, branches and PR merges, but does not expose creation of annotated Git tags. From a clean local checkout, first confirm none of these tags already exist, then run:

```bash
git switch main
git pull --ff-only
git tag -a v0.14.1 d98d67704fe3312c2e682b5994040adace67013b -m "v0.14.1 — commander tax beside CMD"
git tag -a v0.14.2 aec758b139a394640008f43206719f07b3226b72 -m "v0.14.2 — restore active-player yellow outline"
git tag -a v0.15.0 3974eb49453cbe55dedcac87f46fb720b07d0583 -m "v0.15.0 — opening turn-order d20 roll"
git push origin v0.14.1 v0.14.2 v0.15.0
git ls-remote --tags origin refs/tags/v0.14.1 refs/tags/v0.14.2 refs/tags/v0.15.0
```

Only push tags that you have confirmed do not already exist. After pushing, verify the tag refs. GitHub Pages deployment for v0.15.0 already completed successfully at [run `38993645238`](https://github.com/ccall1212/commander-table/actions/runs/38993645238).

## Future publishing prompt

Use the reusable instructions in [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md). Replace the version, branch / pull request, and test status for each release.
