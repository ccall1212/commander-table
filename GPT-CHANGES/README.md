# GPT-CHANGES

Handoff folder between ChatGPT, Chris, and (as backup) Claude Code. It holds **only what is still open or in flight**. Finished work belongs in [CHANGELOG.md](../CHANGELOG.md) and the technical Git history. Read [AGENTS.md](../AGENTS.md) before making changes. Remove in-flight notes when work ships.

## What is in this folder

| File | What it is |
|---|---|
| [OBJECTIVES.md](OBJECTIVES.md) | Chris's backlog of features still to build |
| [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md) | Paused random-deck / website-import investigation (draft PR #11) |
| [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md) | Reusable release checklist |

## Current state

- **Main version:** v0.22.4; [PR #38](https://github.com/ccall1212/commander-table/pull/38) merged to `main` at commit [a0aac81](https://github.com/ccall1212/commander-table/commit/a0aac816d99caa37d89e414f028056e09ec35c2d). Chris tested and approved the independent P/T controls and final compact half-pill highlight.
- **In progress:** [PR #40](https://github.com/ccall1212/commander-table/pull/40) combines objectives #25 (direct life-total entry) and #20 (red poison warning at 10+), on branch `feat/direct-life-poison-warning`, with candidate version v0.23.0. Required exact-branch test ZIP is still missing because the available environment cannot download the repository archive; do not claim the ZIP is available.
- **Objective #21 shipped:** lethal Concede prompts and red zero-library count are included in v0.22.3. The required annotated tag `v0.22.3` must point to `1f667cb831be234225c22dbac07b08cf55e9bd31`.
- **Objective #19 shipped:** compact white P/T badge with independently clickable power and toughness, separate adjustment menu controls, and a visible full-half-pill hover/focus highlight are included in v0.22.4 via PR #38.
- **Touch mode:** v0.22.0 and the iOS Safari drag-viewport follow-up v0.22.1 are merged to `main` (PRs #32 and #33).
- **Commander slam:** the animation and synthesized impact sound are back to the v0.20.6 implementation. Chris wants to keep refining the sound; do that on a separate branch.
- **Paused:** draft [PR #11](https://github.com/ccall1212/commander-table/pull/11), random deck selection / website import. Do not merge until its listed live tests pass.
- **Layouts:** Sidebar and Grid only.
- **Annotated release tags still needed:** the GitHub connection cannot create annotated tags. Create each tag at the exact commit shown:
  - `v0.18.1` → `5548ba67826c1a10b2db6bc53256fd4ae438d799`
  - `v0.18.2` → `897b645bec23316344d140a5e8265a9319713027`
  - `v0.19.0` → `c85ddc8cfb7b56502f5f71dd69860db77331dee1`
  - `v0.19.1` → `e078f0789d3b2c5a891a8579e888135de17b5218`
  - `v0.20.6` → `9d42d06673831c54cbd759e3e44621c9cd299b41`
  - `v0.21.4` → `99afe59d865adb6f19de684eb798b0b617346d67`
  - `v0.22.0` → `ea6b1ec15bd348b99952fbf36d38157ff9045cdb`
  - `v0.22.1` → `4a6ad47af02722460dd9d179e73f94bc99cefc03`
  - `v0.22.2` → `66c611e93d393c40246fa51b21338758f22303eb`
  - `v0.22.3` → `1f667cb831be234225c22dbac07b08cf55e9bd31`
  - `v0.22.4` → `a0aac816d99caa37d89e414f028056e09ec35c2d`
  Use annotated tags (for example, with Claude Code). Until the release tags exist, the GitHub version badge may not show the latest app version.
## How a change gets released

1. ChatGPT makes a focused branch and PR, includes the required test ZIP and simple testing steps, and performs available syntax/code checks.
2. Chris tests the branch in his browser and reports what he tried. Record his testing accurately; don't claim tests he didn't perform.
3. Stop and wait for Chris to say **publish**. Only then merge, update release docs, request any annotated tag that ChatGPT cannot create, clean up the branch, and verify the live site.

## Known limitations and cleanup

- ChatGPT cannot run the app in a real browser or hear audio. Chris's browser testing is the browser test; don't describe code review as browser testing.
- The GitHub connector cannot create annotated tags or delete branches. Ask for the exact tag targets and use GitHub's Delete branch control after merged work when needed.
- Keep this folder limited to open/in-flight work. Keep the player-facing [README](../README.md) and [CHANGELOG](../CHANGELOG.md) current when features change or ship.

