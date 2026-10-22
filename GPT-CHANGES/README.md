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
- **Open work:** see `OBJECTIVES.md`. Opening readiness, personal Undo and In response are published. [PR #61](https://github.com/ccall1212/commander-table/pull/61) (#41, compact readiness roster) is ready for Chris to test. #39 (Host Game rule dialog) is ready in [PR #62](https://github.com/ccall1212/commander-table/pull/62), stacked on #41. Neither is approved for publication.
- **Queued:** Moving backup/restore into Deck Builder #38 remains queued. Chris chose the compact Hands ready roster for #41 and requested #39 next; both test copies are ready. Other open, paused and deferred items are listed in `OBJECTIVES.md`.
- **Slam sound:** Chris wants to keep refining the Commander slam sound. Do that on a separate branch and leave the published behaviour alone until he approves.

## Existing test ZIPs for open work

Include Objective numbers, statuses and these ZIP links whenever Chris asks for an open-work summary; Objective numbers differ from PR numbers. Current test copies and the archived paused import/randomizer draft are listed below. Existing commit ZIPs remain unchanged.

| Objective | Open item | Previously supplied ZIP | Status |
|---|---|---|---|
| #39 | Host Game rule dialog (PR #62, includes #41) | [v0.44.0 combined test ZIP](https://github.com/ccall1212/commander-table/archive/b429c17e0b019e3408fde4bc666cf9d0367cb61b.zip) | Ready for Chris to test; stacked on PR #61; not published |
| #41 | Compact opening-hand roster (PR #61) | [v0.43.0 test ZIP](https://github.com/ccall1212/commander-table/archive/8e92dc71781562475c8688832a41e2d84821201f.zip) | Ready for Chris to test; not published |
| #9 | Random deck/website import (PR #11) | [Archived draft ZIP](https://github.com/ccall1212/commander-table/archive/a415ef5a9d13531a9c6b5877ab40adf84388c6dc.zip) | Paused; its separate test service is not deployed; do not resume |

**Publication order:** PR #61 first; then retarget PR #62 from `feat/opening-roster` to `main` before merging. Do not merge #62 into its current feature base. Both require Chris’s explicit approval. Active objective/ZIP tracking is maintained on main so game PRs do not overwrite these records.

Other queued items have no separate feature test ZIP yet. Touch support’s existing shipped behavior is in the normal game; its remaining real-device testing/refinements have no new test copy.


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
