# GPT-CHANGES

Handoff folder between ChatGPT, Chris, and (as backup) Claude Code. It holds **only what is still open or in flight**. Finished work belongs in [CHANGELOG.md](../CHANGELOG.md) and the Git history. Read [AGENTS.md](../AGENTS.md) before making changes. Delete a note here as soon as its work ships.

## What is in this folder

| File | What it is |
|---|---|
| [OBJECTIVES.md](OBJECTIVES.md) | Chris's backlog: features not built yet, in progress, or paused |
| [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md) | The paused random-deck / website-import work (draft PR #11) |
| [PUBLISH-PROMPT.md](PUBLISH-PROMPT.md) | Reusable release checklist |

## Current state

- **Version:** the newest entry in `CHANGELOG.md` (do not write a version number here; it goes stale).
- **Paused at Chris's request (2026-10-20):** draft [PR #11](https://github.com/ccall1212/commander-table/pull/11), website import/random deck picker. Preserve the branch and recovery checkpoint. Do not resume implementation, deploy its test Worker, merge, or publish until Chris asks to resume; see the investigation note.
- **Layouts:** Sidebar and Grid only.
- **1.0 plan:** Objective #67 lists what Chris and the assistant agreed is needed for version 1.0. Touch support is labelled Beta in the README and guide until #18 passes a real-device retest.
- **Next up (Chris, 2026-11-04):** #72 hotkeys act on every selected card, then #73 temporary effects, #74 Victory screen, #75 trigger reminders list. Also open: #18 (touch support; [PR #69](https://github.com/ccall1212/commander-table/pull/69) is the iPhone table-height fix, still awaiting Chris's iPhone retest).
- **Back burner / not planned:** #45 hotkey reminder (maybe on the title screen later), #69 several uploaded images, #5 slam sound refinements (do on a separate branch and leave the published behaviour alone until Chris approves).
- **Queued ideas:** #48 more distinctive backgrounds, #70 commander damage outside the ▾ menu. Deferred: #4, #55, #58, #62–#65. On hold: #57, #59. Dropped: #66 (the name-bar life total from v0.58.1 solved it), #42, #60.
- **Recently shipped (see `CHANGELOG.md`):** share your hand with one player, life total in the name bar, dice and coin pop-ups, arrow target highlight, sync code, use one set for the whole deck, card statuses and abilities (#56), card-back gold oval fix, host-only Pass turn (#71) and the arrow-on-opponent-boards fix (v0.62.2). Full descriptions and reasons for open items are in `OBJECTIVES.md`.

## Existing test ZIPs for open work

Include Objective numbers, statuses and these ZIP links whenever Chris asks for an open-work summary; Objective numbers differ from PR numbers. The archived paused import/randomizer draft is listed below. Existing commit ZIPs remain unchanged.

| Objective | Open item | Previously supplied ZIP | Status |
|---|---|---|---|
| #18 | iPhone Touch mode table height (PR #69) | [v0.46.2 test ZIP](https://github.com/ccall1212/commander-table/archive/68a6341d2f9859783581af70f59df461ead05eee.zip) | In progress; awaits Chris’s iPhone retest |
| #9 | Random deck/website import (PR #11) | [Archived draft ZIP](https://github.com/ccall1212/commander-table/archive/a415ef5a9d13531a9c6b5877ab40adf84388c6dc.zip) | Paused; its separate test service is not deployed; do not resume |


Other queued items have no separate feature test ZIP yet. Touch support’s previously shipped behavior remains in the normal game; PR #69 covers the reported phone-height issue.


## Documentation upkeep

Routine documentation-only updates, including `AGENTS.md`, objectives, and handoff notes, may go directly to `main` without a separate branch, PR, or approval request. Check accuracy and report the changes in chat. No app version bump, release tag, test ZIP, or browser testing is required. Game changes still require the branch, testing, and approval process below; documentation bundled with a game change follows that same process.

## How a game change gets released

1. ChatGPT/Codex makes a focused branch and PR, delegates useful independent tasks to sub-agents, includes the test ZIP and simple testing steps, and runs available syntax/code checks and permitted browser tests.
2. Chris tests the branch in his browser and reports what he tried. Record his testing accurately; don't claim tests he didn't perform.
3. Stop and wait for Chris to say **publish** for the specific PR/version. Only then merge the approved PR, update release docs (`CHANGELOG.md`, `docs/GUIDE.md`), verify the automatic release tag and live site, and delete the branch if possible.
4. **Tags are automatic — never manually tag as part of the normal release flow.** The GitHub Action (`.github/workflows/tag-release.yml`) creates the annotated `vX.Y.Z` tag on a push to `main`. After publishing, verify the tag exists and that its final target commit SHA exactly matches the merge commit on `main`. For annotated tags, follow the tag-object SHA to the tag object and compare its `object.sha`. If the tag is missing or points elsewhere, inspect/report the workflow result to Chris; do not create, move, or rewrite it manually unless Chris separately authorizes recovery. Do not write tag targets or "tag still needed" lists in this folder.

## Known things that are not your problem

- Chris authorizes routine sub-agent delegation for useful independent tasks. Use available, permitted browser tools for real user-flow checks; access and tooling vary by session and sub-agents cannot bypass a denial. Record code/automated checks, actual browser observations, and Chris's hands-on results separately. His extract-and-open ZIP test flow and publication approval remain required.
- **Merged-branch cleanup is required:** GitHub's **Automatically delete head branches** is enabled. After every merge, verify the feature branch is gone; if needed, use authorized GitHub tooling or authenticated Git with a head check. The connector itself lacks branch-deletion tools, but the existing Git credential helper is available in this environment. Preserve open/paused branches, including PR #11.
