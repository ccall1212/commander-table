# GPT-CHANGES

Handoff folder between ChatGPT, Chris, and (as backup) Claude Code. It holds **only what is still open or in flight**. Finished work is not repeated here: the player-facing history is [CHANGELOG.md](../CHANGELOG.md), the technical history is `git log` and the release tags, and how to work on the project is in [AGENTS.md](../AGENTS.md). When something ships, delete its notes from this folder instead of leaving a "done" entry.

## What is in this folder

| File | What it is |
|---|---|
| [OBJECTIVES.md](OBJECTIVES.md) | Chris's backlog of features still to build, with hints about where the code is |
| [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md) | The paused random-deck / website-import work (draft PR #11) and what has been learned |
| [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md) | The reusable "prepare, test and publish a release" prompt and checklist |

## Current state

- **Released on main:** v0.18.2. GitHub Pages run [39009977087](https://github.com/ccall1212/commander-table/actions/runs/39009977087) succeeded for main commit [897b645](https://github.com/ccall1212/commander-table/commit/897b645bec23316344d140a5e8265a9319713027).
- **Release tags verified:** v0.14.1, v0.14.2, v0.15.0, v0.15.1, v0.16.0, v0.17.0, and v0.17.1 exist. Tags v0.18.1 and v0.18.2 are still pending (see below).
- **Layouts:** only **Sidebar** and **Grid** exist. The Top and Focus layouts were removed.
- **In flight:** draft PR #11 only (paused deck import).

## Remaining release housekeeping

- **v0.18.1 release commit:** [5548ba67826c1a10b2db6bc53256fd4ae438d799](https://github.com/ccall1212/commander-table/commit/5548ba67826c1a10b2db6bc53256fd4ae438d799).
- **v0.18.2 release commit:** [897b645bec23316344d140a5e8265a9319713027](https://github.com/ccall1212/commander-table/commit/897b645bec23316344d140a5e8265a9319713027).
- **Deployment:** GitHub Pages run [39009977087](https://github.com/ccall1212/commander-table/actions/runs/39009977087) succeeded for the v0.18.2 release commit.
- **Annotated tags still required:** create `v0.18.1` pointing to `5548ba67826c1a10b2db6bc53256fd4ae438d799` and `v0.18.2` pointing to `897b645bec23316344d140a5e8265a9319713027`. Both tags were checked and are absent. The GitHub connector cannot create annotated tags; do not substitute lightweight tags from GitHub's Releases UI. If Chris asks Claude Code to finish repository housekeeping, these exact tag targets are the required instructions.
- **Merged branch cleanup:** branches remain on GitHub because this connector cannot delete them. Delete them via the **Delete branch** button on each merged PR: [#13](https://github.com/ccall1212/commander-table/pull/13) `feat/multi-card-selection`, [#14](https://github.com/ccall1212/commander-table/pull/14) `docs/release-housekeeping-v0.18.1`, [#15](https://github.com/ccall1212/commander-table/pull/15) `docs/testing-checklist-v0181`, [#16](https://github.com/ccall1212/commander-table/pull/16) `docs/no-local-release-commands`, and [#17](https://github.com/ccall1212/commander-table/pull/17) `fix/smooth-draw-animation`. Delete this PR's branch, `docs/release-housekeeping-v0.18.2`, as well once its PR is merged.

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
