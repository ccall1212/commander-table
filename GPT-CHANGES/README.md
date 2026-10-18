# GPT-CHANGES

Handoff folder between ChatGPT, Chris, and (as backup) Claude Code. It holds **only what is still open or in flight**. Finished work belongs in [CHANGELOG.md](../CHANGELOG.md) and the technical Git history. Read [AGENTS.md](../AGENTS.md) before making changes. Remove in-flight notes when work ships.

## What is in this folder

| File | What it is |
|---|---|
| [OBJECTIVES.md](OBJECTIVES.md) | Chris's backlog of features still to build |
| [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md) | Paused random-deck / website-import investigation (draft PR #11) |
| [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md) | Reusable release checklist |

## Current state

- **Main version:** v0.22.3; [PR #37](https://github.com/ccall1212/commander-table/pull/37) merged to `main` at commit [1f667cb](https://github.com/ccall1212/commander-table/commit/1f667cb831be234225c22dbac07b08cf55e9bd31). Chris tested and approved the lethal Concede prompt and empty-library warning fix.
- **Objective #21 shipped:** lethal Concede prompts and red zero-library count are included in v0.22.3. The required annotated tag `v0.22.3` must point to `1f667cb831be234225c22dbac07b08cf55e9bd31`.
- **In progress:** objective #19, clearer separate Power/Toughness controls, on [branch `feat/separate-pt-controls`](https://github.com/ccall1212/commander-table/tree/feat/separate-pt-controls), candidate v0.22.4. The PR will distinguish manual stat adjustments from actual counters; wait for Chris to test before merging.
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
  - `v0.22.4` → pending (candidate branch; add exact merge commit when published)
  Use annotated tags (for example, with Claude Code). Until the release tags exist, the GitHub version badge may not show the latest app version.
## How a change gets released

1. ChatGPT makes a focused branch and PR, includes the required test ZIP and simple testing steps, and performs available syntax/code checks.
2. Chris tests the branch in his browser and reports what he tried. Record his testing accurately; don't claim tests he didn't perform.
3. Stop and wait for Chris to say **publish**. Only then merge, update release docs, request any annotated tag that ChatGPT cannot create, clean up the branch, and verify the live site.

## Known limitations and cleanup

- ChatGPT cannot run the app in a real browser or hear audio. Chris's browser testing is the browser test; don't describe code review as browser testing.
- The GitHub connector cannot create annotated tags or delete branches. Ask for the exact tag targets and use GitHub's Delete branch control after merged work when needed.
- Keep this folder limited to open/in-flight work. Keep the player-facing [README](../README.md) and [CHANGELOG](../CHANGELOG.md) current when features change or ship.

