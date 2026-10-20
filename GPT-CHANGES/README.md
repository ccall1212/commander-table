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
- **Paused:** draft [PR #11](https://github.com/ccall1212/commander-table/pull/11), random deck selection / website import. Do not merge until its listed live tests pass.
- **Layouts:** Sidebar and Grid only.
- **Open work:** see `OBJECTIVES.md`. Targeting arrows (#12) are a v0.29.0 candidate on `feat/targeting-arrows`, awaiting Chris’s browser test and publishing approval.
- **Slam sound:** Chris wants to keep refining the Commander slam sound. Do that on a separate branch and leave the published behaviour alone until he approves.

## Documentation upkeep

Routine documentation-only updates, including `AGENTS.md`, objectives, and handoff notes, may go directly to `main` without a separate branch, PR, or approval request. Check accuracy and report the changes in chat. No app version bump, release tag, test ZIP, or browser testing is required. Game changes still require the branch, testing, and approval process below; documentation bundled with a game change follows that same process.

## How a game change gets released

1. ChatGPT makes a focused branch and PR, includes the test ZIP and simple testing steps, and runs the available syntax/code checks.
2. Chris tests the branch in his browser and reports what he tried. Record his testing accurately; don't claim tests he didn't perform.
3. Stop and wait for Chris to say **publish** for the specific PR/version. Only then merge the approved PR, update release docs (`CHANGELOG.md`, `docs/GUIDE.md`), verify the automatic release tag and live site, and delete the branch if possible.
4. **Tags are automatic — never manually tag as part of the normal release flow.** The GitHub Action (`.github/workflows/tag-release.yml`) creates the annotated `vX.Y.Z` tag on a push to `main`. After publishing, verify the tag exists and that its final target commit SHA exactly matches the merge commit on `main`. For annotated tags, follow the tag-object SHA to the tag object and compare its `object.sha`. If the tag is missing or points elsewhere, inspect/report the workflow result to Chris; do not create, move, or rewrite it manually unless Chris separately authorizes recovery. Do not write tag targets or "tag still needed" lists in this folder.

## Known things that are not your problem

- **A red ✗ on commits named "Workers Builds: commander-table-relay"** is a Cloudflare build for the online-play relay. It is a Cloudflare configuration issue on Chris's side (the build appears to fail at the very start, before running any of this repository's code), it does not affect the game website or the live relay, and the `relay/` code is unchanged. Ignore it unless you edited `relay/`.
- You cannot run a real browser or hear audio. Chris's testing is the browser test; don't describe code review as browser testing.
- The GitHub connector cannot delete branches. After a merge, say which branch to delete or ask Chris to use GitHub's **Delete branch** button. (GitHub's setting "Automatically delete head branches" does this on its own.)
