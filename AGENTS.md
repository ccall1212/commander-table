# Working on Commander Table: guide for AI assistants (and humans)

Read this before changing anything. It describes how every change has been made and released so far.
The owner is Chris (GitHub `ccall1212`). He is not a programmer: explain things in plain language,
and **never push to `main` or publish without his explicit OK** ("publish" / "push").

## Who does what

Two assistants work on this repo, and they have different abilities:

| | ChatGPT (via GitHub) | Claude Code (on Chris's laptop) |
|---|---|---|
| Writes code on a branch / PR | ✅ main job | ✅ |
| Runs the game in a real browser, multiplayer tabs, test suites | ❌ assume not available | ✅ |
| Publishes to `main` / tags / checks the live site | ❌ never | ✅ only when Chris says "publish" |

So the normal flow is:
1. **ChatGPT** makes the change on a branch, following steps 1–3 and 5–8 of the routine below.
   It can't browser-test, so it does the **checks without a browser** (below) and pushes the branch.
   It writes the manual test list in the commit message or pull-request description.
2. **Chris** tells Claude: *"Test and publish branch `<name>`"* (or just "test branch `<name>`").
3. **Claude** pulls the branch, runs the browser tests, fixes anything broken, and reports. On Chris's
   OK it publishes (steps 10–11).

### If you can't run a browser (ChatGPT)
- Keep each branch **small and focused** on one feature or fix. Big rewrites can't be reviewed safely.
- **Syntax:** if your environment has Node, run `node --check js/<file>.js` on every changed file.
  If not, re-read each changed function and check that braces, brackets, parentheses and template
  literals (backticks, `${…}`) are balanced, and that no `const`/`let` is declared twice in the same scope.
- **Python:** run `python -m py_compile lan-server.py tools/bump-version.py tests/test_relay_protocol.py`
  if you changed any of them.
- **Cross-check names:** grep that every function, CSS class, `data-a="…"` action and element id you
  use actually exists, and that every one you renamed or removed has no remaining references.
- **Don't guess at behaviour you can't see.** If a change depends on layout, sizes or timing, say so
  and leave it for the browser test.
- **Write the test list** in the PR or commit: the exact clicks and keys to try, how many players, which
  layout (Top / Sidebar / Grid / Focus) and screen size, and what should happen.
- **State clearly what you did NOT test.** Never write "tested" for something you only read.
- Don't merge to `main`, tag, or bump past a version that's already tagged.

## What this is

- A browser-based Magic: The Gathering Commander tabletop. It is plain HTML/CSS/JS with **no build step,
  no npm and no framework**. Live site: https://ccall1212.github.io/commander-table/ (GitHub Pages, served
  from `main`, root folder).
- Online play goes through a Cloudflare relay (`relay/`, Worker + Durable Object). The browser side is
  `js/relay-peer.js` and `js/net.js`; see `docs/NETWORKING.md` and `docs/relay-protocol.md`.
- Optional LAN mode: `lan-server.py` (Python stdlib) has an in-app updater that installs whatever is on
  `main`. **Every push to `main` is a release** for LAN users too.

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
| `CHANGELOG.md`, `README.md` | Release notes and the player-facing guide |
| `tests/net-harness.html`, `tests/test_relay_protocol.py` | Automated tests |

## Ground rules

- **Surgical changes.** Match the surrounding code style. Keep the architecture: each player owns their
  own state and publishes a public view; the **host owns the table** (turns, seats, log) and relays.
  Cross-player effects are requests to the card's owner. Don't add a second rendering system.
- **No secrets** in code, commits or chat (API keys, tokens, passwords). The relay URL is public.
- Don't install Node/npm or other tooling on Chris's work laptop (SentinelOne EDR). Python 3 and git are available.
- Keyboard shortcuts already in use (don't reuse these letters): T tap, F flip, Z face-down, G graveyard,
  X exile, H hand, B battlefield, A attach, J counter, D draw, U untap all, S search library, I info,
  V magnifier, Space pass turn, Ctrl+Z undo.
- UI preferences Chris has stated: subdued, readable, nothing that scrolls on the table, no card-specific
  buttons, EDHPlay is the reference look.

## The routine for every change

1. **Start clean from the latest `main`**
   ```bash
   git switch main && git pull --ff-only
   git status            # must be clean
   ```
2. **Work on a branch:** `feat/<short-name>`, `fix/<short-name>` or `docs/<short-name>`. Never commit straight to `main`.
3. **Make the change.**
4. **Test it in a browser** (from the repo folder):
   ```bash
   python -m http.server 8099 --bind 127.0.0.1
   ```
   - Open `http://127.0.0.1:8099/index.html`, host a game, and join from a second tab with
     `http://127.0.0.1:8099/index.html?join=<ROOM>` (use 3–4 tabs for multiplayer features).
     Check the browser console has no errors.
   - Check layouts at 1920×1080 and 1366×768, and in the Top, Sidebar, Grid and Focus views if the UI changed.
   - Network regression suite (13 checks, real relay):
     `http://127.0.0.1:8099/tests/net-harness.html?relay=https://commander-table-relay.chris-call1212.workers.dev&net=relay&auto=1`
   - Protocol tests (only if relay/LAN code changed): `python tests/test_relay_protocol.py`
     (local LAN server) or with `--url wss://commander-table-relay.chris-call1212.workers.dev/room/TESTX`.
   - Stop the test server afterwards.
5. **Set the version** (semantic versioning: `0.MINOR.PATCH`; new features bump MINOR, fixes bump PATCH):
   ```bash
   python tools/bump-version.py 0.7.6
   ```
   This updates `<meta name="app-version">` in `index.html`, the `?v=` on all 13 css/js links, and
   `APP_VERSION` in `js/app.js`. **Never edit those by hand.** The `?v=` links stop browsers mixing
   cached old files with a new release, because GitHub Pages caches files for 10 minutes.
6. **Update `CHANGELOG.md`** ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format): add a
   `## [X.Y.Z] - YYYY-MM-DD` section under `## [Unreleased]` with `### Added / Changed / Fixed` bullets
   written for players. Then update the compare links at the bottom:
   ```
   [Unreleased]: https://github.com/ccall1212/commander-table/compare/vX.Y.Z...HEAD
   [X.Y.Z]: https://github.com/ccall1212/commander-table/compare/vPREVIOUS...vX.Y.Z
   ```
7. **Update `README.md`** for anything a player would notice (controls, menus, layouts, shortcuts).
   Don't write the version number in the README; the badge at the top reads it from the git tags.
8. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix: …`,
   `docs: …`, `chore: …`, `feat(ui): …`. Include the version in the subject for releases, e.g.
   `fix(ui): piles keep their own size (v0.7.1)`. Say in the body what changed and why.
9. **Push the branch** and/or open a pull request. **Stop here.** (ChatGPT stops here every time; Claude tests and, on Chris's OK, publishes.)
10. **Publish (only on Chris's OK):**
    ```bash
    git switch main && git pull --ff-only
    git merge --ff-only <branch>
    git tag -a vX.Y.Z -m "vX.Y.Z — one-line summary"
    git push --follow-tags
    git branch -d <branch> && git push origin --delete <branch>   # if the branch was pushed
    ```
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
