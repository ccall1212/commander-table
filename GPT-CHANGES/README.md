# GPT-CHANGES

Handoff folder between ChatGPT, Chris, and (as backup) Claude Code. It holds **only what is still open or in flight**. Finished work is not repeated here: the player-facing history is [CHANGELOG.md](../CHANGELOG.md), the technical history is `git log` and the release tags, and how to work on the project is in [AGENTS.md](../AGENTS.md). When something ships, delete its notes from this folder instead of leaving a "done" entry.

## What is in this folder

| File | What it is |
|---|---|
| [OBJECTIVES.md](OBJECTIVES.md) | Chris's backlog of features still to build, with hints about where the code is |
| [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md) | The paused random-deck / website-import work (draft PR #11) and what has been learned |
| [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md) | The reusable "prepare, test and publish a release" prompt and checklist |

## Current state

- **Released on main:** v0.18.1; GitHub Pages run [39008364719](https://github.com/ccall1212/commander-table/actions/runs/39008364719) succeeded for release commit [5548ba6](https://github.com/ccall1212/commander-table/commit/5548ba67826c1a10b2db6bc53256fd4ae438d799).
- **Release tags verified:** v0.14.1, v0.14.2, v0.15.0, v0.15.1, v0.16.0, v0.17.0, and v0.17.1 exist and point to their intended commits. The v0.18.1 tag is still pending (see below).
- **Layouts:** only **Sidebar** and **Grid** exist. The Top and Focus layouts were removed.
- **In flight:** draft PR #11 (paused deck import) and [PR #17](https://github.com/ccall1212/commander-table/pull/17) (`fix/smooth-draw-animation`, v0.18.2 candidate). It adds a lifted, eased draw arc and blends each card into its hand slot at arrival. Awaiting Chris's browser test; not merged or published.

## Remaining release housekeeping

- **Release commit:** [5548ba67826c1a10b2db6bc53256fd4ae438d799](https://github.com/ccall1212/commander-table/commit/5548ba67826c1a10b2db6bc53256fd4ae438d799) is the exact v0.18.1 feature-release commit. Later commits only update release housekeeping and `TESTING.md`.
- **Deployment:** GitHub Pages run [39008364719](https://github.com/ccall1212/commander-table/actions/runs/39008364719) succeeded for the feature release, and run [39008580228](https://github.com/ccall1212/commander-table/actions/runs/39008580228) succeeded for the later documentation update. The live app is already on GitHub Pages; no local checkout is needed to use the released feature.
- **Annotated tag:** `v0.18.1` did not exist when checked. This is release metadata only; it does not upload or change the app code. The project specifically requires an *annotated* tag pointing at `5548ba67826c1a10b2db6bc53256fd4ae438d799`. GitHub's web Releases form creates a lightweight tag, so do not use it as a substitute unless Chris explicitly relaxes the annotated-tag rule. The GitHub connector cannot create an annotated tag. If tag completion is still desired, ask Chris whether to use GitHub Desktop (no Command Prompt required, but it needs a local clone) or have Claude Code create the annotated tag. Do not assume any local clone exists or ask Chris to run commands in an unknown folder.
- **Branch cleanup:** `feat/multi-card-selection` remains on GitHub after merge. This can be deleted entirely in the browser: open [PR #13](https://github.com/ccall1212/commander-table/pull/13) and click **Delete branch**. This housekeeping does not affect the live app.
## How a change gets released (short version)

1. ChatGPT works on a branch and opens a pull request, with a short click list for Chris (see "Writing the test list" in `AGENTS.md`).
2. **Chris tests it himself in his browser and tells ChatGPT how it went. That is the browser test.** Record it as "Tested by Chris: ..." and list as unverified only what he did not mention. Claude Code (a backup on Chris's work account) is only used if Chris asks.
3. When Chris says "publish": merge to `main`, get the tag created, delete the branch, verify the live site.

### Things ChatGPT cannot do, so ask for them

- **Create annotated tags.** The GitHub connection cannot. When a release is merged, write the exact commit the tag must point to and ask Chris (or Claude Code, if he chooses) to create it. Do not call a release finished until `git ls-remote --tags origin` shows the tag.
- **Run a multi-player game or hear sound.** If Chris did not mention testing with a second player (or sound, or a real-mouse hover shortcut), say that one item is unverified and ask him whether he wants it checked.

### Keeping the repository tidy

- Delete the branch when its pull request is merged (the PR keeps the history). Stale branches pile up otherwise.
- Do not leave notes about released work in this folder.
- Keep `README.md` (player guide) and `CHANGELOG.md` (what players will notice) accurate in the same change.

## Where to put notes about new work

If you start something that cannot be finished in one go, add a short section here: the branch / PR link, what is done, what is not, and exactly what a tester should try. Remove the section when the work is released or abandoned.
