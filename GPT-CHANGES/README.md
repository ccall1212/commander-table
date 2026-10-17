# GPT-CHANGES

Handoff folder between ChatGPT, Chris, and (as backup) Claude Code. It holds **only what is still open or in flight**. Finished work is not repeated here: the player-facing history is [CHANGELOG.md](../CHANGELOG.md), the technical history is `git log` and the release tags, and how to work on the project is in [AGENTS.md](../AGENTS.md). When something ships, delete its notes from this folder instead of leaving a "done" entry.

## What is in this folder

| File | What it is |
|---|---|
| [OBJECTIVES.md](OBJECTIVES.md) | Chris's backlog of features still to build, with hints about where the code is |
| [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md) | The paused random-deck / website-import work (draft PR #11) and what has been learned |
| [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md) | The reusable "prepare, test and publish a release" prompt and checklist |

## Current state

- **Merged to main:** v0.19.1 (newest-first game log), commit [e078f07](https://github.com/ccall1212/commander-table/commit/e078f0789d3b2c5a891a8579e888135de17b5218), via [PR #26](https://github.com/ccall1212/commander-table/pull/26).
- **Release tags that exist:** up to v0.17.1. Tags v0.18.1, v0.18.2, v0.19.0 and v0.19.1 are still missing (see below).
- **Layouts:** only **Sidebar** and **Grid** exist. The Top and Focus layouts were removed.
- **In flight:** [PR #28](https://github.com/ccall1212/commander-table/pull/28) (Commander slam, below) and draft PR #11 (paused deck import).

## In flight: Commander slam (PR #28, objective #5)

- **Branch:** `feat/commander-slam-animation`, currently version 0.20.3 in the working copy. Not merged, not published.
- **What was wrong:** the host's check on the `slamfx` message used `/^[\\w-]{1,40}$/`, which rejected every card id, so nobody saw the effect in an online game (Practice solo skips the host, so it looked fine there). The impact sound was also a 42 to 105 Hz tone that laptop speakers cannot play. Both were fixed in v0.20.3 (commit 664b1c8 on branch `claude/nifty-euler-rffzhv`; it must be brought into the PR branch).
- **What Chris should try (2 tabs: host and joiner, Sidebar and Grid):** cast the Commander from the command zone by double-click and by drag; both players should see the colored ring and hear a short thud. Dragging it around afterwards, or moving a normal card, must do nothing. Check mono, multi-color and colorless Commanders, and the reduced-motion setting.
- **Verified so far:** a headless-browser pass in Practice solo (double-click cast works) and a direct test of the host check. **Not verified:** a real two-player online game, loudness on real speakers, and the Grid layout.
- **Changelog tidy-up at publish time:** versions 0.20.0, 0.20.1, 0.20.2 and 0.20.3 were never released. Collapse them into one `0.20.0` entry before publishing, and drop the compare links for tags that will not exist.

## Remaining release housekeeping

- **v0.18.1 release commit:** [5548ba67826c1a10b2db6bc53256fd4ae438d799](https://github.com/ccall1212/commander-table/commit/5548ba67826c1a10b2db6bc53256fd4ae438d799).
- **v0.18.2 release commit:** [897b645bec23316344d140a5e8265a9319713027](https://github.com/ccall1212/commander-table/commit/897b645bec23316344d140a5e8265a9319713027).
- **Deployment:** the v0.19.0 run succeeded. Check that the latest `main` deployment (v0.19.1) completed and the live page shows 0.19.1.
- **Annotated tags still required:** create `v0.18.1` pointing to `5548ba67826c1a10b2db6bc53256fd4ae438d799` and `v0.18.2` pointing to `897b645bec23316344d140a5e8265a9319713027`. All four tags were checked and are absent. The GitHub connector cannot create annotated tags; do not substitute lightweight tags from GitHub's Releases UI. **v0.19.0 release commit:** [c85ddc8cfb7b56502f5f71dd69860db77331dee1](https://github.com/ccall1212/commander-table/commit/c85ddc8cfb7b56502f5f71dd69860db77331dee1). Create annotated tag `v0.19.0` pointing to this commit. **v0.19.1 release commit:** [e078f0789d3b2c5a891a8579e888135de17b5218](https://github.com/ccall1212/commander-table/commit/e078f0789d3b2c5a891a8579e888135de17b5218). Create annotated tag `v0.19.1` pointing to that commit. Claude Code should create all four pending annotated tags.
- **Branch cleanup:** the connector cannot delete branches. These branches exist on GitHub; for each, check its pull request and use **Delete branch** if it is merged, closed or superseded (keep `main`, `feat/commander-slam-animation` and `feat/random-commander-deck-picker-preview`, which are still open work): `docs/add-new-objectives`, `docs/no-local-release-commands`, `docs/readme-current-app-version`, `docs/release-housekeeping-v0.18.1`, `docs/release-housekeeping-v0.18.2`, `docs/release-housekeeping-v0.19.0`, `docs/release-housekeeping-v0.19.1`, `docs/restore-version-badge`, `docs/testing-checklist-v0181`, `feat/all-card-printings-search`, `feat/all-card-printings-search-v2`, `feat/multi-card-selection`, `feat/random-commander-deck-picker`, `feature/relay-netcode`, `fix/newest-first-game-log` and `fix/smooth-draw-animation`.

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
