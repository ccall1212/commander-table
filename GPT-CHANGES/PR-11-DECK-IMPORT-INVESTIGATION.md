# Random deck picker / website deck import — paused (draft PR #11)

**Draft PR:** [#11](https://github.com/ccall1212/commander-table/pull/11), branch `feat/random-commander-deck-picker-preview`. It is **not merged and not published**. The controls are hidden/disabled; normal plain-text import ("+ Import a deck") works as before. Keep it a draft until the live tests below pass and Chris approves.

**Before resuming:** the branch still carries an old preview version number. Rebase or merge it onto the current `main`, bump it to the next free version with `python tools/bump-version.py`, and update `CHANGELOG.md` and its compare links. Note that `main` has changed a lot (new tile layout, only Sidebar and Grid); retest the lobby, not just the import.

## How it works

- The browser calls a small fixed route on the Cloudflare relay (`/deck-api?site=...&action=...&id=...`, in `relay/worker.js`) instead of calling Moxfield/Archidekt directly. The relay only builds a few allow-listed provider URLs from a validated site, action and deck id; it never fetches an arbitrary URL, and only answers requests from the app's origin.
- `js/app.js` converts the provider's deck JSON into the plain-text deck format the app already imports (`deckTextFromProvider()`), then runs the normal import. Random search picks a public Commander deck and checks its bracket.

## What has been verified (with real data)

- **Why a relay is needed:** from a plain HTTP client with an honest User-Agent, Archidekt (`archidekt.com/api/decks/<id>/` and `/api/decks/v3/?...` search) and Moxfield (`api2.moxfield.com/v2/decks/all/<id>`, also `api.moxfield.com/v2/...`) answer 200. Neither sends a CORS header that allows `https://ccall1212.github.io` (Archidekt allows only `http://localhost:3000`), so a browser on GitHub Pages cannot call them directly.
- **Converter:** run on real responses it produced the right deck name, commander and card counts for a public Moxfield deck (1 commander, 92 lines / 99 cards, matching the source) and a public Archidekt deck.
- **Bracket field bug (fixed on the branch):** Archidekt returns the bracket as `edhBracket`; the parser only read other names, so every deck looked "unknown". Roughly one in ten search results has a bracket (2 or 3 in the sample); the rest are `null`.

## Still not tested (this is what blocks the PR)

1. Whether **Moxfield answers requests coming from Cloudflare Worker addresses** (it may block them even though a normal client works). This needs a deployed **test** worker, not the production one.
2. The `/deck-api` route itself, from the real site origin, including that other origins and arbitrary URLs are refused.
3. Random search end to end with brackets 1–4. Never label an unknown-bracket deck as a confirmed match; with so many unknowns the picker must fetch more candidates or say it could not find one.
4. Moxfield random search is deliberately unavailable (no approved API access). Do not scrape or impersonate a browser to get around the provider's protections, and do not add personal API tokens.
5. A real-browser pass of the lobby at normal sizes and with plain-text import for regressions.

## Rules

- Never put secrets or tokens in code, commits or chat.
- If a provider refuses a request, keep the plain-text import as the fallback and show a readable message.
- Do not enable the controls until items 1–3 pass.
