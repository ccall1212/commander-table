# Working on Commander Table: guide for AI assistants (and humans)

Read this before changing anything. It describes how every change has been made and released so far.
The owner is Chris (GitHub `ccall1212`). He is not a programmer: explain things in plain language,
and **never publish game changes to `main` without his explicit OK** ("publish" / "push").
Routine documentation-only updates (including `AGENTS.md`, objectives, and handoff notes) may be committed directly to `main` without asking for approval. Also read [GPT-CHANGES/README.md](GPT-CHANGES/README.md): it lists the open work (feature backlog, the paused deck-import PR) and nothing else.

## Who does what

This is Chris's personal project. **ChatGPT (his personal account) is the main assistant.** Claude Code runs on his work account, so it is only the **backup**: Chris will call on it when ChatGPT can't do something or gets stuck, not by default. Don't plan around Claude Code being available, and don't hand work to it that you can finish yourself. When Chris does call on it, a headless-browser pass (Playwright + Chromium) of the click list is a quick way to catch bugs before he tests by hand, but it cannot hear sound or use a real mouse hover.

| | ChatGPT (via GitHub) | Claude Code (backup) |
|---|---|---|
| Writes code on a branch / PR | ✅ main job | ✅ if asked |
| Merges a game PR / publishes game changes to `main` | ✅ only when Chris says "publish" / "push" | ✅ if asked |
| Maintains documentation only on `main` | ✅ no extra approval required | ✅ if asked |
| Creates annotated release tags | GitHub Actions does this automatically when the version lands on `main`; never hand-create as routine | same automatic workflow; manual recovery only if Chris explicitly authorizes it |
| Runs the game in a browser, multi-player tests | ✅ when browser tools and access are available; report what actually ran | ✅ if asked and tooling is available |
| Fixes hard bugs, anything needing a real shell | ✅ using available shell/tools; delegate independent investigation when useful | ✅ if ChatGPT is stuck |

### Delegation and browser testing

Chris has authorized routine use of sub-agents. Use them by default when independent work benefits from parallel attention: repository/history exploration, routine documentation, focused code review, regression tests, and separate bug investigations. Keep short or dependent tasks with the primary assistant. The primary assistant coordinates edits, reviews findings, integrates fixes, and reports results in chat; do not have agents edit the same files without coordination.

Chris prefers lighter models for routine sub-agent tasks rather than inheriting the primary assistant's model. Choose an available Luna or Terra model for routine documentation, repository searches, focused review, and straightforward tests; give it a bounded task with the needed context. Reserve stronger models for work whose complexity justifies them. Do not claim a model is available without checking the session's supported choices, and report the model actually used when describing delegation.

Use available, permitted browser automation to test actual user flows when practical, including separate player sessions and Sidebar/Grid layouts. Sub-agents can perform browser checks only with tools and access actually available to them. Shared browser sessions need coordination. A sub-agent does not bypass a denied permission or provide missing browser access. If access is blocked, state the exact limitation and continue other checks; do not describe source inspection or a simulated DOM as a real browser test.

Keep automated/code checks, assistant-run browser observations, and Chris's hands-on results distinct. Real-device touch behavior and subjective sound still need appropriate device or human checks when tools cannot establish them. Do not install tooling on Chris's work laptop without his authorization. His normal test flow remains download ZIP, extract, double-click `index.html`; game publication still needs his explicit approval.

### Documentation-only updates

Routine updates to `AGENTS.md`, `GPT-CHANGES/` (including objectives), and other documentation may go directly to `main` without a separate branch, PR, or approval request. Check the text for accuracy and summarize the changes in chat. No app version bump, release tag, test ZIP, or browser test is needed for documentation-only updates. This exception does not cover game code, styles, assets, networking, deployment configuration, or changes bundled with game changes; those follow the game workflow below.

Keep review information in chat: describe what changed, what was checked, and anything Chris needs to decide, so he does not need to leave the chat to review routine work.

The normal flow for game changes is:
1. **ChatGPT/Codex** makes the change on a branch and opens a PR, following the routine below. Use sub-agents for useful independent work and run automated checks plus browser tests when permitted tools and access are available. Include a short click list and test ZIP for Chris.
2. **Chris tests it himself** in his own browser (usually the local or preview copy) and tells ChatGPT how it went.
   **Chris's hands-on testing counts as browser testing.** Treat what he reports as tested:
   - Record it as *"Tested by Chris: <what he said he tried / that it looked good>"*. Do not keep writing
     that the feature is "not browser-tested" after he has tested it. Record any assistant-run browser tests separately, with the actions and results actually observed.
   - Only list things as unverified when Chris did not mention them (for example "multiplayer with a second
     player was not mentioned"). If it is unclear what he tried, ask one short question instead of guessing.
3. **Chris says "publish"** for a named version. ChatGPT merges, checks that the release tag appeared (a GitHub Action creates it),
   deletes the branch and updates the docs.
4. **Only if Chris asks**, Claude Code tests with several players or fixes what ChatGPT couldn't.

### Checks ChatGPT/Codex does itself
- Keep each branch **small and focused** on one feature or fix. Big rewrites can't be reviewed safely.
- **Syntax:** if your environment has Node, run `node --check js/<file>.js` on every changed file.
  If not, re-read each changed function and check that braces, brackets, parentheses and template
  literals (backticks, `${…}`) are balanced, and that no `const`/`let` is declared twice in the same scope.
- **Python:** run `python -m py_compile lan-server.py tools/bump-version.py tests/test_relay_protocol.py`
  if you changed any of them.
- **Cross-check names:** grep that every function, CSS class, `data-a="…"` action and element id you
  use actually exists, and that every one you renamed or removed has no remaining references.
- **Images/assets:** check that every new image actually contains visible pixels (not blank or fully
  transparent) and is big enough for where it's shown (card backs ≥ 250×350, full-board backgrounds
  ≈ 1920×1080). Prefer separate files over sprite atlases, and always keep a fallback so a missing
  image never makes cards or the board invisible.
- **Don't guess at behaviour you can't see.** If a change depends on layout, sizes or timing, say so
  and leave it for the browser test.
- **Write the test list** in the PR or commit: the exact clicks and keys to try, how many players, which
  layout (Sidebar / Grid) and screen size, and what should happen.
- **Be honest about what was checked by whom.** Never write "tested" for something only read in the code; do write "tested by Chris" for what he told you he tried.
- Don't merge game changes to `main` without Chris's explicit approval, manually create/move release tags as part of the normal flow, or bump past a version that's already tagged. Routine documentation-only updates follow the exception above.

## What this is

- A browser-based Magic: The Gathering Commander tabletop. It is plain HTML/CSS/JS with **no build step,
  no npm and no framework**. Live site: https://ccall1212.github.io/commander-table/ (GitHub Pages, served
  from `main`, root folder).
- Online play goes through a Cloudflare relay (`relay/`, Worker + Durable Object). The browser side is
  `js/relay-peer.js` and `js/net.js`; see `docs/NETWORKING.md` and `docs/relay-protocol.md`.
- LAN mode (`lan-server.py`, `Start LAN game.bat`, `js/lan.js`, `js/updates.js`) is **unused** — nobody plays
  that way. Don't build features for it; it's a candidate for removal.

## Files you'll touch most

| File | What it is |
|---|---|
| `index.html` | Lobby + game markup, script/style links (each carries `?v=<version>`) |
| `js/app.js` | Almost all game logic and UI (big file — use targeted edits, never rewrite it) |
| `css/style.css`, `css/widgets.css` | Styles (dark theme, CSS variables) |
| `js/widgets.js` | `UI.menu / toast / modal / confirm / prompt / viewer` helpers |
| `js/net.js`, `js/relay-peer.js` | Networking session layer + relay transport |
| `js/lens.js` | Magnifier (hold V) |
| `js/net-config.js` | Relay URL (public, not a secret) |
| `tools/bump-version.py` | Sets the version everywhere in one step |
| `CHANGELOG.md`, `docs/GUIDE.md`, `README.md` | Release notes; the full player guide; a short overview of the game |
| `tests/net-harness.html`, `tests/test_relay_protocol.py` | Automated tests |

## Ground rules

- **Surgical changes.** Match the surrounding code style. Keep the architecture: each player owns their
  own state and publishes a public view; the **host owns the table** (turns, seats, log) and relays.
  Cross-player effects are requests to the card's owner. Don't add a second rendering system.
- **No secrets** in code, commits or chat (API keys, tokens, passwords). The relay URL is public.
- Don't install Node/npm or other tooling on Chris's work laptop (SentinelOne EDR). Python 3 and git are available.
- Keyboard shortcuts already in use (don't reuse these letters without checking the in-game Hotkey list): T taps/untaps a battlefield card or plays a hovered hand card onto the battlefield tapped, F flip, Z face-down, G graveyard, E exile, H hand, B battlefield, A attach, J counter, D draw, U untap all, S shuffles when hovering your Library, X mills one card when hovering your Library, L opens Search Library, I info, V magnifier, R calls In response!, Space pass turn, Ctrl+Z undo.
- UI preferences Chris has stated: subdued, readable, nothing that scrolls on the table, no card-specific
  buttons, EDHPlay is the reference look.

## How the table is built (things that commonly break)

Read this before changing layout or anything that finds elements on the page. Several shipped features broke only because a layout change moved an element another feature was looking for.

- **Layouts:** only **Sidebar** and **Grid** exist. (A table with nobody else at it, such as Practice solo, uses an internal full-width layout.) Check both, plus a player watching from a second tab.
- **Opponents are miniature tiles** (`.opp.tile`). Their hand fan, Library, Graveyard, Exile and Command are drawn *inside* the scaled board (`.tstrip`, `.thand`, `.tpile`), not in a header. In Grid your own quadrant is also a tile (`.opp.mytile`, real interactive cards); the normal hand/piles strip (`#myRow`, `#myHand`, `#myZones`) is hidden there. Viewing another player swaps *their* hand and piles into that same bottom strip, hiding yours.
- **`#myHand` is zero-width by design** (its cards overflow it), so never decide an element is "hidden" from its own size; look at its cards or its computed `visibility`/`display`.
- **Boards are drawn in a scaled, sometimes auto-fitted display space.** Positions are stored in a fixed 1000-wide board (`BW`, height `bh`) but Grid and miniatures draw the board in a different size (`computeFit()`, `boardHTML(... mode)`). Convert pointer positions with `boardPoint()` then `storedPos()`; never treat screen pixels as board units.
- **Rendering patches the DOM in place** (`setHTML()`): elements are reused and cards are matched by `data-iid`. Do not assign `innerHTML` on those containers, do not keep references to card elements across renders, and expect `render()` to run often.
- **Hover shortcuts** (`S`/`X` over the Library, card hotkeys) rely on real mouse position (`:hover`, `S.hover`); scripted events cannot test them. Mark such features "needs a human with a mouse".
- **Cross-player actions are messages relayed by the host**, which validates the sender (see the `drawfx` message and the `give`, `take`, `life` requests in `onReq`/`hostRecv`). A new message must be validated on the host, must never carry hidden information (card identities), and must be tolerated by older clients.
- **Practice solo skips the network path.** In solo, `toHost()` calls `hostRecv()` directly, and some effects run locally instead of going through the host. A new message must also be tested by sending it through `hostRecv()` (or with a second tab), otherwise a broken host check hides until someone plays online. The Commander slam shipped (v0.20.0 to v0.20.2) with a host check that rejected every card id because of this.
- **Regex literals: write `\w`, not `\\w`.** Inside `/.../` a doubled backslash means "a literal backslash". Test a validation regex against a real id such as `p6u6wnase_1` before relying on it.
- **Cache-busting:** after any CSS/JS change run `tools/bump-version.py`; the browser (and the live site, for about 10 minutes) otherwise serves old files.
- **Tags and branches:** the release tag is created automatically (`.github/workflows/tag-release.yml`). Chris wants merged feature/fix/documentation branches deleted as the normal default, without another approval request. Keep GitHub's **Automatically delete head branches** setting enabled and verify cleanup after every merge. Preserve `main`, protected/long-lived branches, open or paused work (including PR #11), and any branch with additional unmerged commits.

## Open-work summaries for Chris

Whenever Chris asks what remains open, include each item’s original Objective number, its current status, and the latest previously supplied exact-commit ZIP link beside it when one exists. Keep Objective numbers distinct from pull-request numbers (for example Objective #29 is PR #50), and do not renumber the backlog. Label each copy clearly: current test copy, older copy needing refresh, or paused/archived draft. Say “no test ZIP yet” for unbuilt items when helpful. Do not omit existing ZIP links merely because the copy is older.

A new release does not change an existing commit ZIP. Explain when a feature branch predates current main: integrate the relevant published changes, reconcile versions, run appropriate checks and generate/verify a fresh exact-head ZIP before presenting it as current. The feature does not need rebuilding from scratch. Keep old links identified as historical; never describe them as containing newer releases. Listing a paused draft ZIP does not authorize resuming its implementation or deploying its service.

## Required test ZIP for Chris

**Every feature or fix pull request must include a downloadable ZIP of the exact pull-request branch so Chris can test it locally.** Do this every time; do not wait for him to ask.

- Build the ZIP from the branch/commit being proposed in the PR, not from `main` and not from an older commit.
- Include the complete runnable project source needed to test the change. Exclude `.git` history and local secrets.
- Include a short `TESTING.md` in the ZIP. **Chris tests by downloading the ZIP, extracting it, and double-clicking `index.html`. He does not run Python, a terminal, or a local server.** Make this the normal test flow. If a particular test truly requires a hosted service, prepare that service or explain the specific requirement instead of assuming Chris will run commands.
- Check the archive contains the intended files and matches the PR head commit before sharing it. Link the ZIP directly in the PR description and in the message to Chris.
- Keep the ZIP as a test copy only; do not publish it or merge the PR. Wait for Chris's explicit approval before publishing.
- If a ZIP cannot be generated, explain the blocker and do not claim that one was provided.

## The routine for every game change

1. **Start clean from the latest `main`**
   ```bash
   git switch main && git pull --ff-only
   git status            # must be clean
   ```
2. **Work on a branch:** `feat/<short-name>` or `fix/<short-name>` (or `docs/<short-name>` for documentation bundled with a game change). Never commit game changes straight to `main`; routine documentation-only updates use the exception above.
3. **Make the change.**
4. **Test it in a browser.** Chris's test flow is to extract the ZIP and double-click `index.html`; do not ask him to run Python or a terminal. An assistant with browser access may optionally run a local server for its own HTTP-specific checks (from the repo folder):
   ```bash
   python -m http.server 8099 --bind 127.0.0.1
   ```
   - Open `http://127.0.0.1:8099/index.html`, host a game, and join from a second tab with
     `http://127.0.0.1:8099/index.html?join=<ROOM>` (use 3–4 tabs for multiplayer features).
     Check the browser console has no errors.
   - Check layouts at 1920×1080 and 1366×768, and in the Sidebar and Grid views if the UI changed.
   - Network regression suite (13 checks, real relay):
     `http://127.0.0.1:8099/tests/net-harness.html?relay=https://commander-table-relay.chris-call1212.workers.dev&net=relay&auto=1`
   - Protocol tests (only if relay/LAN code changed): `python tests/test_relay_protocol.py`
     (local LAN server) or with `--url wss://commander-table-relay.chris-call1212.workers.dev/room/TESTX`.
   - Stop the test server afterwards.
5. **Set the version** (semantic versioning: `0.MINOR.PATCH`; new features bump MINOR, fixes bump PATCH):
   ```bash
   python tools/bump-version.py 0.7.6
   ```
   This updates `<meta name="app-version">` in `index.html`, the `?v=` on all 14 css/js links, and
   `APP_VERSION` in `js/app.js`. **Never edit those by hand.** The `?v=` links stop browsers mixing
   cached old files with a new release, because GitHub Pages caches files for 10 minutes.
6. **Update `CHANGELOG.md`** ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format): add a
   `## [X.Y.Z] - YYYY-MM-DD` section under `## [Unreleased]` with `### Added / Changed / Fixed` bullets
   written for players. Then update the compare links at the bottom:
   ```
   [Unreleased]: https://github.com/ccall1212/commander-table/compare/vX.Y.Z...HEAD
   [X.Y.Z]: https://github.com/ccall1212/commander-table/compare/vPREVIOUS...vX.Y.Z
   ```
7. **Update `docs/GUIDE.md`** for anything a player would notice (controls, menus, layouts, shortcuts). The `README.md` is only a short overview of the game and rarely needs to change; do not add feature detail or a version number to it. Its version badge follows the latest Git tag by itself (`https://img.shields.io/github/v/tag/...`); never replace it with fixed text. A GitHub Action creates the `vX.Y.Z` tag automatically when a new version reaches `main`, so you do not need to ask for one (check that the tag appeared).
8. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix: …`,
   `docs: …`, `chore: …`, `feat(ui): …`. Include the version in the subject for releases, e.g.
   `fix(ui): piles keep their own size (v0.7.1)`. Say in the body what changed and why.
9. **Push the branch** and/or open a pull request. **Stop here.** (Stop here and wait: Chris tests it himself and reports back. Only after he says "publish" go on to step 10.)
10. **Publish (only on Chris's OK for this specific PR/version):**
    - Re-check that the PR is open, targets `main`, and its current head is the exact version Chris approved. Merge that PR through GitHub; don't commit or push straight to `main`.
    - **Do not create or push a release tag manually.** The workflow `.github/workflows/tag-release.yml` runs on a push to `main`, reads the version from `index.html`, and creates the annotated `vX.Y.Z` tag at the commit that triggered the workflow.
    - Wait for the automatic tag creation, then verify both the tag and its target. Fetch `GET /repos/ccall1212/commander-table/git/ref/tags/vX.Y.Z`. For an annotated tag, follow the returned tag-object SHA with `GET /repos/ccall1212/commander-table/git/tags/<tag-object-sha>`; its `object.sha` must equal the actual merge commit SHA on `main`. Don't assume the PR branch head and the squash-merge commit are the same SHA.
    - If the tag is missing or targets the wrong commit, inspect the Actions run/workflow result and report the blocker to Chris. **Do not manually create, move, or rewrite the tag** unless Chris separately authorizes that recovery.
    - Verify `main` has the intended app version and release docs. Then check the live GitHub Pages site for that version; keep deployment marked pending/unverified until the live page confirms it.
    - Verify the merged PR's head branch was deleted automatically. If it remains, verify the PR is merged, the branch still points to the merged/approved head, and no open work depends on it; then delete it using an available authorized GitHub tool or authenticated Git CLI. Git's existing credential helper may work even when the connector lacks branch-deletion tools. Use an expected-head check/lease to avoid deleting new unmerged work. Do not install tools or expose credentials. If cleanup is blocked, report the specific blocker and remaining branch rather than treating cleanup as optional or claiming deletion.
    - Do not change the version badge in `README.md`: it follows the newest release tag automatically.
11. **Verify the live site** about a minute later:
    - `https://ccall1212.github.io/commander-table/` shows `<meta name="app-version" content="X.Y.Z">`
      (and `js/app.js?v=X.Y.Z` loads).
    - Open it and check the footer shows the new version with no console errors.
    - Players with the page open get a "Version X.Y.Z is out — Reload" notice automatically.

## Special cases

- **Relay changes (`relay/`)** deploy through Cloudflare Workers Builds (project `commander-table-relay`,
  root directory `relay`), from the branch set as its production branch in the Cloudflare dashboard.
  Changing the relay protocol needs matching changes in `js/relay-peer.js`, `lan-server.py`,
  `docs/relay-protocol.md` and the tests, and it must stay backward compatible during rollout.
- **Board geometry:** the logical board is `BW = 1000` wide; positions/layouts are shared between players
  (published `bw`). Changing `BW` needs a migration (see `cleanPub` / `normalizeMe` in `js/app.js`).
- **Table state:** `T.turn` = round number, `T.turnSeq` = per-player turn counter (guards against stale
  passes), `T.rev` = table revision (newer copies win on host reload). Keep these semantics.
- **Handoff patches:** if you prepare a patch for someone else to apply, make it a script that checks
  exact source anchors and the current version, refuses a dirty tree, and works on a new branch.
  Since ChatGPT has repo access, a branch + pull request is simpler still.
