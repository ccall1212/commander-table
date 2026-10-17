# GPT-CHANGES

This folder records changes prepared or committed by ChatGPT for Commander Table, along with release steps that remain incomplete. It is a handoff log, not a replacement for `CHANGELOG.md` (which is the player-facing release history) or `AGENTS.md` (which documents the project's development and release workflow).

The active backlog of upcoming features is tracked in [OBJECTIVES.md](OBJECTIVES.md). Keep that list current as Chris adds requests and mark each objective's status; Objective 1 (the yellow active-player outline) is the current priority.

**Status checked:** 2026-10-16 local date / 2026-10-17 UTC repository timestamps  
**App version in source:** `0.14.1`  
**Current release tag status:** `v0.14.1` was not found during the last GitHub tag lookup.

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

## Remaining task for v0.14.1

Create and push an **annotated** tag named `v0.14.1` pointing to commit `d98d67704fe3312c2e682b5994040adace67013b`. This is the intended release commit because it includes the app fix and the README version-badge change. Do not point the release tag at a later documentation-only commit.

From a clean local checkout, after confirming that this tag does not already exist:

```bash
git switch main
git pull --ff-only
git tag -a v0.14.1 d98d67704fe3312c2e682b5994040adace67013b -m "v0.14.1 — commander tax beside CMD"
git push origin v0.14.1
git ls-remote --tags origin refs/tags/v0.14.1
```

Confirm the tag exists on GitHub after pushing it. Then check the live site and the GitHub Pages deployment status; do not say all release checks are complete until those verifications pass.

## Future publishing prompt

Use the reusable instructions in [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md). Replace the version, branch / pull request, and test status for each release.
