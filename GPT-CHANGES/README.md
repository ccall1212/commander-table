# GPT-CHANGES

This folder records changes prepared or committed by ChatGPT for Commander Table, along with release steps that remain incomplete. It is a handoff log, not a replacement for `CHANGELOG.md` (which is the player-facing release history) or `AGENTS.md` (which documents the project's development and release workflow).

The active backlog of upcoming features is tracked in [OBJECTIVES.md](OBJECTIVES.md). Keep that list current as Chris adds requests and mark each objective's status; Objective 1 (the yellow active-player outline) is the current priority.

**Status checked:** 2026-10-17  
**App version in source:** `0.14.2`  
**Release tag status:** neither `v0.14.1` nor `v0.14.2` currently exists on GitHub.

## Active-player yellow outline — v0.14.2 (merged to main)

- **Pull request:** [#3 — Restore yellow outline for the active player](https://github.com/ccall1212/commander-table/pull/3) — merged.
- **Merge commit:** [`78b6d5ae99e0ef95f0e5b644f1aa27f716211f84`](https://github.com/ccall1212/commander-table/commit/78b6d5ae99e0ef95f0e5b644f1aa27f716211f84).
- Restores a clearly visible yellow/gold outline on the active player's board in Sidebar and Grid layouts using a positioned overlay border, with the overlay suppressed where it would outline the wrong surface.
- App version and cache-busting references are set to `0.14.2`; `CHANGELOG.md` and the player-facing guide describe the behavior, and the README badge is being updated to `0.14.2`.
- **Browser status:** Chris previewed the feature locally and confirmed that it looked good before explicitly authorizing publication. ChatGPT did not independently operate the browser.
- **Deployment status:** GitHub Pages workflow was queued for merge commit `78b6d5a` at the last check; verify its final result after the documentation updates.
- **Tag status:** GitHub lookups found neither `v0.14.1` nor `v0.14.2`. The connected GitHub actions available here cannot create annotated tags, so the release tags still need to be created and verified locally. See the commands under “Remaining release housekeeping” below.

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

- The user reported that the browser checks for the layout change passed.
- GitHub Pages' workflow completed successfully for the app-code merge commit and again for the README-version commit:
  - [App-code deployment workflow](https://github.com/ccall1212/commander-table/actions/runs/38988306096)
  - [README deployment workflow](https://github.com/ccall1212/commander-table/actions/runs/38988499062)
- Source checks confirmed `index.html` and `js/app.js` both report `0.14.1`, with matching asset cache-busting versions.
- The live `github.io` page was not independently fetched by ChatGPT during the final verification, so a browser-visible live-version check should still be done if certainty is required.
- GitHub's tag lookup returned no `v0.14.1` reference. The tag is the known remaining release task.

## Remaining release housekeeping

Two annotated tags are still missing and need local creation:

- `v0.14.1` should point to `d98d67704fe3312c2e682b5994040adace67013b` (commander tax chip fix and its README badge).
- `v0.14.2` should point to `78b6d5ae99e0ef95f0e5b644f1aa27f716211f84` (active-player yellow outline release commit). The separate README badge update is documentation-only.

The current GitHub connection has read/write support for files, branches and PR merges, but does not expose creation of annotated Git tags. From a clean local checkout, run:

```bash
git switch main
git pull --ff-only
git tag -a v0.14.1 d98d67704fe3312c2e682b5994040adace67013b -m "v0.14.1 — commander tax beside CMD"
git tag -a v0.14.2 78b6d5ae99e0ef95f0e5b644f1aa27f716211f84 -m "v0.14.2 — restore active-player yellow outline"
git push origin v0.14.1 v0.14.2
git ls-remote --tags origin refs/tags/v0.14.1 refs/tags/v0.14.2
```

Only run the tag commands after confirming neither tag already exists. After pushing, verify the tag refs and GitHub Pages deployment. The live site should be checked after deployment completes; local preview approval is not the same as a live-site verification.

## Future publishing prompt

Use the reusable instructions in [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md). Replace the version, branch / pull request, and test status for each release.


## Active-player yellow outline — v0.14.2 (prepared for review)

- **Pull request:** [#3 — Restore yellow outline for the active player](https://github.com/ccall1212/commander-table/pull/3)
- **Commits:** initial implementation `14098d1cf17a76cff7f49e98e8670a7841ca7160`; positioning-context refinement `0afd64d4312f9daad2f2ad8c6a9702b127564ead`.

- Restores an easy-to-see yellow/gold border around the player whose turn is active.
- Uses a positioned overlay border instead of an inset box-shadow, because the board contents could cover the old shadow.
- Applies to the main board and opponent/miniature tiles, while suppressing the overlay in focus/grid-overlay cases where it would outline the wrong board.
- Bumped the app version and cache-busting references from `0.14.1` to `0.14.2`, and updated `CHANGELOG.md` and the player-facing `README.md`.
- **Browser status:** not run by ChatGPT. Manual checks are in the PR description for Sidebar/Grid at 1920×1080 and 1366×768, own and opponent turns, and focused board viewing.
- **Release note:** the previous `v0.14.1` tag was still absent at the last check. Before considering this release complete, confirm/tag v0.14.1 at its intended commit, then handle v0.14.2 according to the release checklist in [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md).
