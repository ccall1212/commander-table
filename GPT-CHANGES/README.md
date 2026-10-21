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
- **Open work:** Objective #37 opening readiness is ready to test in [PR #58](https://github.com/ccall1212/commander-table/pull/58). Objective #35 personal Undo/checkpoints is ready to test in [PR #59](https://github.com/ccall1212/commander-table/pull/59), stacked on #58. Both await Chris's testing and explicit publication approval. Draft #11 remains paused.
- **Queued:** Moving backup/restore into Deck Builder #38 and choosing mulligan rules after Host Game #39 remain unimplemented. Other open, paused and deferred items are listed in `OBJECTIVES.md`.
- **Slam sound:** Chris wants to keep refining the Commander slam sound. Do that on a separate branch and leave the published behaviour alone until he approves.

## Existing test ZIPs for open work

Include Objective numbers, statuses and these ZIP links whenever Chris asks for an open-work summary; Objective numbers are different from PR numbers. Existing commit ZIPs remain unchanged. The current test copies below include all published v0.39.0 features; the #35 copy also includes #37. Extract and double-click index.html; click lists are in TESTING.md.

| Objective | Open item | Previously supplied ZIP | Status |
|---|---|---|---|
| #37 | Opening readiness (PR #58) | [v0.40.0 current test ZIP](https://github.com/ccall1212/commander-table/archive/639b15a3eb235006fdb10e7c071d01d3bd6082e7.zip) | Ready for Chris's test; not published |
| #35 | Personal Undo/checkpoints (PR #59) | [v0.41.0 current test ZIP](https://github.com/ccall1212/commander-table/archive/2cba32c5b4a4f6e1472dcc3a869dfd63f5aab411.zip) | Ready for Chris's test; includes #37; not published |
| #9 | Random deck/website import (PR #11) | [Archived draft ZIP](https://github.com/ccall1212/commander-table/archive/a415ef5a9d13531a9c6b5877ab40adf84388c6dc.zip) | Paused; its separate test service is not deployed; do not resume |

Other queued items have no separate feature test ZIP yet. Touch support’s existing shipped behavior is in the normal game; its remaining real-device testing/refinements have no new test copy.

**Publication dependency:** #59 targets `feat/opening-readiness` to isolate its diff. Publish #58 first, then reconcile #59 onto main and retarget it before publication. Preserve the #58 branch while #59 depends on it; clean both branches/worktrees once the dependency is removed and each merged head is verified.

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
