# Reusable prompt: prepare, test and publish a Commander Table release

Copy the prompt below into ChatGPT whenever a release is wanted. Replace the bracketed parts.

---

## Prompt to reuse

I'm the owner of `ccall1212/commander-table`. Please carry this change through the release process:

- **Change / PR / branch:** [describe it, paste the PR link, or name the branch]
- **Target version:** [X.Y.Z]
- **Browser-test status:** [not tested yet / passed, with details]

Read `AGENTS.md` and `GPT-CHANGES/README.md` first. Inspect the real repository state before acting; do not assume any note is still current (check `git log`, the tags and `CHANGELOG.md`).

### Steps

1. **Inspect and protect.** Confirm the default branch, the working branch/PR, the current app version and latest tag. Work on a focused branch, never directly on `main`. Do not overwrite unrelated work.
2. **Implement.** Keep it small and in the project's plain HTML/CSS/JS style. Update `docs/GUIDE.md` (player guide), `CHANGELOG.md` (what players will notice) and the version with `python tools/bump-version.py X.Y.Z`; never edit version references by hand.
3. **Check what you can.** Read the diff; confirm every function, CSS class, id and `data-a` action you use exists and that nothing you removed is still referenced. Run syntax checks if your tools allow. Search for every place that looks up an element you moved or renamed. Never call source review "browser testing".
4. **Open or update the pull request** with a Conventional Commit title, a summary, and an exact **click list** for a human tester: how many players, which layout (Sidebar / Grid), screen size, what to click or press, and what should happen. State clearly what was not tested.
5. **Stop and wait.** Chris tests the change himself and reports back (that is the browser test; record it as "Tested by Chris: ..."). Do not merge or publish before Chris says "publish" for this specific version. Claude Code is only a backup that Chris may call on.
6. **After "publish":** merge the approved PR into `main`; tell Chris the exact commit the annotated tag `vX.Y.Z` must point to (you cannot create tags; Chris will create it or ask Claude Code to); delete the merged branch; update `GPT-CHANGES/` (remove notes about work that is now released, add nothing about it).
7. **Final report.** Version, summary, PR and commit links, tag status, deployment status, tests actually performed, and what remains. Separate confirmed facts from anything Chris must do. Do not invent commit IDs, tag existence or deployment results.

Chris's authorization applies only to the named change and version.

---

## Release checklist

- [ ] Change implemented and reviewed
- [ ] Tested by Chris (note what he tried) and anything he did not mention is listed as unverified
- [ ] `index.html` and `js/app.js` versions agree; all 14 `?v=` references match
- [ ] `CHANGELOG.md` entry and compare links correct; `docs/GUIDE.md` accurate
- [ ] Merged into `main`
- [ ] Annotated `vX.Y.Z` tag exists on GitHub and points at the release commit
- [ ] GitHub Pages deployment succeeded and the live page shows the new version
- [ ] Branch deleted
- [ ] `GPT-CHANGES/` holds only open work
