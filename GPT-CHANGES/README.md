# GPT-CHANGES

Handoff folder between ChatGPT and Claude Code / Chris. It holds **only what is still open or in flight**. Finished work is not repeated here: the player-facing history is [CHANGELOG.md](../CHANGELOG.md), the technical history is `git log` and the release tags, and how to work on the project is in [AGENTS.md](../AGENTS.md). When something ships, delete its notes from this folder instead of leaving a "done" entry.

## What is in this folder

| File | What it is |
|---|---|
| [OBJECTIVES.md](OBJECTIVES.md) | Chris's backlog of features still to build, with hints about where the code is |
| [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md) | The paused random-deck / website-import work (draft PR #11) and what has been learned |
| [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md) | The reusable "prepare, test and publish a release" prompt and checklist |

## Current state

- **Released:** everything up to the newest version in `CHANGELOG.md`, each with an annotated git tag. Check `git tag` / the changelog rather than trusting a number written here.
- **Layouts:** only **Sidebar** and **Grid** exist. The Top and Focus layouts were removed.
- **In flight:** draft PR #11 only (paused, see its file). Nothing else is waiting.

## How a change gets released (short version)

1. ChatGPT works on a branch and opens a pull request. It cannot run a browser, so it lists exact things for a human to click (see "Writing the test list" in `AGENTS.md`).
2. Chris asks Claude Code to test it. Claude Code runs it in a real browser (several players over the relay), fixes what breaks, and reports.
3. Only when Chris says "publish": merge to `main`, tag, push, delete the branch, verify the live site.

### Things ChatGPT cannot do, so ask for them

- **Create annotated tags.** The GitHub connection cannot. When a release is merged, write the exact commit the tag must point to and ask Chris or Claude Code to create it. Do not call a release finished until `git ls-remote --tags origin` shows the tag.
- **Run a real browser or a multiplayer game.** Never write "tested" for something that was only read. Say "not browser-tested" and provide the click list.
- **Hover, mouse and sound behaviour.** Some features only work with a real mouse (for example `S` and `X` over the Library use CSS `:hover`, which scripted events cannot fake). Mark them "needs a human".

### Keeping the repository tidy

- Delete the branch when its pull request is merged (the PR keeps the history). Stale branches pile up otherwise.
- Do not leave notes about released work in this folder.
- Keep `README.md` (player guide) and `CHANGELOG.md` (what players will notice) accurate in the same change.

## Where to put notes about new work

If you start something that cannot be finished in one go, add a short section here: the branch / PR link, what is done, what is not, and exactly what a tester should try. Remove the section when the work is released or abandoned.
