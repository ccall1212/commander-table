# Reusable prompt: prepare, test, and publish a Commander Table release

Copy the prompt below into ChatGPT whenever I want a release completed. Replace the bracketed details first if they are known.

---

## Prompt to reuse

I'm the owner of `ccall1212/commander-table`. Please carry this change all the way through the release process:

- **Change / PR / branch:** [describe the change, paste the PR link, or name the branch]
- **Target version:** [X.Y.Z]
- **Browser-test status:** [not tested yet / passed, with details]

Read `AGENTS.md`, `GPT-CHANGES/README.md`, and the latest `GPT-CHANGES/PUBLISH-PROMPT.md` first. Inspect the actual current repository state before acting; do not assume prior notes are still current.

### Work through the full release checklist

1. **Inspect and protect the repository.** Confirm the current default branch, working change, branch/PR status, current app version, latest release tag, and relevant CI/deployment status. Do not overwrite unrelated work. Work on a focused branch, not directly on `main`, for code changes.
2. **Implement the requested change.** Keep the code change small and consistent with the project's plain HTML/CSS/JS architecture. Update the appropriate source, player-facing `README.md`, `CHANGELOG.md`, and version references. Use `python tools/bump-version.py X.Y.Z` for version changes instead of editing version references manually.
3. **Check what can be checked here.** Inspect the diff, confirm referenced IDs/classes/actions exist, and run syntax checks where the available tools support them. Never describe source review as browser testing. If browser testing is possible only on my computer, provide an exact test checklist and wait for me to report results before saying it passed.
4. **Prepare the change for review.** Commit with a Conventional Commit message; open or update a focused pull request with a summary, exact browser checks, and anything not tested. Preserve the existing game architecture and don't make unrelated changes.
5. **Publish when I have explicitly asked you to publish.** Treat my explicit “publish” instruction as authorization to complete the release steps for this approved change. Follow the current project's documented versioning process: make sure the checks have passed; fast-forward merge the approved branch/PR into `main`; create the annotated `vX.Y.Z` tag on the intended release commit; push the tag/commit if the connected GitHub tools support it; clean up the feature branch when safe; and verify the resulting commit, tag, and deployment status.
6. **Be honest about tool limitations.** If an available GitHub action cannot create tags, push a ref, run browser tests, or verify the live site, do not imply that step was completed. Finish every other step that is supported, tell me precisely what remains, and provide the shortest safe command or action to complete the blocked step. Do not invent successful checks, commit SHAs, tag existence, or deployment state.
7. **Record the handoff.** Update `GPT-CHANGES/README.md` with the change, important commit/PR links, what was checked, and any remaining work. Update this folder's reusable prompt only if the process itself changes. Keep `CHANGELOG.md` player-focused and `GPT-CHANGES` as the technical handoff log.
8. **Final report.** Give me the version, change summary, PR/commit links, tag status, deployment status, tests actually performed, and any remaining steps. Separate confirmed facts from anything I need to do.

Do not publish without my explicit authorization for that release. My authorization applies only to the named change/version, not unrelated work.

---

## Release completion checklist

- [ ] Requested change is implemented and reviewed
- [ ] Browser tests passed or clearly marked as not run
- [ ] App version in `index.html` and `js/app.js` agrees
- [ ] All local CSS/JS cache-busting references match the version
- [ ] `CHANGELOG.md` entry and comparison links are correct
- [ ] Player-facing `README.md` is accurate
- [ ] `GPT-CHANGES/README.md` handoff is current
- [ ] Approved change is merged into `main`
- [ ] Annotated `vX.Y.Z` tag points to the intended release commit and exists on GitHub
- [ ] Push/merge status is verified
- [ ] GitHub Pages deployment succeeded for the expected commit
- [ ] Live site version is independently verified, when access allows
- [ ] No remaining steps are hidden behind a generic “done” statement
