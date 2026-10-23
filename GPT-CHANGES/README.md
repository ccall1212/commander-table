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
- **Paused again at Chris's request (2026-10-20):** draft [PR #11](https://github.com/ccall1212/commander-table/pull/11), website import/random deck picker. Preserve the branch and recovery checkpoint. Do not resume implementation, deploy its test Worker, merge, or publish until Chris asks to resume; see the investigation note.
- **Layouts:** Sidebar and Grid only.
- **Open work:** see `OBJECTIVES.md`. Objective #47’s larger previews for preset and saved custom backgrounds shipped in v0.52.0 through [PR #77](https://github.com/ccall1212/commander-table/pull/77) after Chris approved publication. Its double-click refinement shipped in v0.52.1 through [PR #78](https://github.com/ccall1212/commander-table/pull/78) after Chris reported “Amazing” and approved publication. #38's Deck Builder backup placement and #43's host/join Auto-Draw and Auto Untap All choices shipped together in v0.45.0 through PR #65 after Chris reported “Looks good” and approved publication. Open PRs are paused draft #11 and Objective #18 touch-height fix [PR #69](https://github.com/ccall1212/commander-table/pull/69). Objective #46 Hotkeys shipped in v0.51.0 through [PR #76](https://github.com/ccall1212/commander-table/pull/76) after Chris tested and approved the ZIP. Objective #52's Spectate view fix shipped in v0.50.1 through PR #74 after Chris tested and approved the ZIP. Objective #49 color/UI polish shipped in v0.47.0 through PR #70 after Chris said it looked great and approved publication. Objective #50 arrow-source highlighting shipped without numbers in v0.48.0 through PR #71 after Chris approved publication. Chris dropped #42; PR #63 was closed without publishing, and the existing appearance controls are retained.
- **Queued:** Objective #45 is a very brief hotkey reminder when entering a game, with a browser-saved **Don't show again** choice. The published Exile shortcut is **E**; **X** mills a card from a hovered Library. No test ZIP yet.
- **New backlog priorities:** #53 Quick Grab basic lands shipped in v0.53.0 through PR #79 after Chris reported “Perfect” and approved publication. #54 W/name-targeted drag arrows shipped in v0.54.0 through [PR #80](https://github.com/ccall1212/commander-table/pull/80) after Chris approved publication with “Push”. #54’s immediate pointer-following correction shipped in v0.54.1 through [PR #81](https://github.com/ccall1212/commander-table/pull/81) after Chris said “I like the interaction” and approved publication. **#61 selected-card counters is In progress** on `feat/selected-card-counters` (v0.55.0 test copy, including v0.54.1’s arrow correction). Its branch PR includes the verified exact-commit ZIP. Publication awaits Chris’s test/approval. Life-point relocation remains undecided. #56 statuses and icons are Queued, followed by separate #61 counter application to box-selected cards and recent-counter reuse. Chris dropped #60 cross-player counter actions and removed counter copying/dragging from scope. #55 combat automation and #58 drag-to-attack are Deferred because of complexity. #57 deck-size enforcement and #59 blocker relationships are On Hold pending decisions/dependencies. Full descriptions and reasons are in `OBJECTIVES.md`; other remaining new objectives have no implementation or test ZIP yet.
- **Queued:** Objective #48 is a separate art project for more distinctive original backgrounds. No artwork proposal or test ZIP yet.
- **Touch support:** Objective #18’s iPhone menu access fix published in v0.46.1 through PR #68. Chris tested it on a real iPhone and found that Touch mode compressed the landscape table; PR #69 has a v0.46.2 test copy to address that. Real-device retest and broader touch refinements remain open.
- **Slam sound:** Chris wants to keep refining the Commander slam sound. Do that on a separate branch and leave the published behaviour alone until he approves.

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

- **Historical red Workers Builds checks:** Chris identified failed branch previews running `npx wrangler preview` without previews configuration. Production deployments were successful, including the latest main commit. Chris disabled preview builds on 2026-10-20; old failed checks remain historical. New failures must be inspected rather than assumed harmless.
- Chris authorizes routine sub-agent delegation for useful independent tasks. Use available, permitted browser tools for real user-flow checks; access and tooling vary by session and sub-agents cannot bypass a denial. Record code/automated checks, actual browser observations, and Chris's hands-on results separately. His extract-and-open ZIP test flow and publication approval remain required.
- **Merged-branch cleanup is required:** GitHub's **Automatically delete head branches** is enabled. After every merge, verify the feature branch is gone; if needed, use authorized GitHub tooling or authenticated Git with a head check. The connector itself lacks branch-deletion tools, but the existing Git credential helper is available in this environment. Preserve open/paused branches, including PR #11.
