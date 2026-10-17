# PR #11 — Deck import investigation handoff

**Purpose:** Keep the random-deck and website URL import investigation available for Claude Code to continue later.

## Status at handoff

- **Draft PR:** [#11 — Random Commander deck picker and website URL import](https://github.com/ccall1212/commander-table/pull/11)
- **Branch:** `feat/random-commander-deck-picker-preview`
- **Current release on main/live site:** v0.17.0 (draw-card animation; PR #12)
- **Important:** The deck-import feature code in PR #11 has **not been merged or published**. v0.17.0 has shipped separately for the draw-card animation in PR #12. This document does not enable the controls or deploy the helper service.
- Random deck and website URL import controls remain disabled/hidden in the preview; plain-text deck import remains available.

## Findings

### Original cause / browser restrictions

The first implementation calls Moxfield and Archidekt endpoints directly from the browser. A provider may return data to a desktop app or server while a browser refuses the request because of cross-origin restrictions. Forge is a desktop Java app and can make its HTTP request outside the browser's CORS enforcement, so its success does not alone prove the same direct call will work on GitHub Pages.

### Forge's Moxfield importer

Read these files from [Card-Forge/forge](https://github.com/Card-Forge/forge):

- [`MoxfieldDeckUrlProvider.java`](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/deck/MoxfieldDeckUrlProvider.java) extracts the deck ID and requests `https://api.moxfield.com/v2/decks/all/{deckId}`. It reads `commanders`, `mainboard`, `sideboard`, and `companions` from the returned JSON.
- [`DeckUrlLoader.java`](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/deck/DeckUrlLoader.java) uses Java's `HttpURLConnection`, sets an Accept header and a simple User-Agent, applies timeouts, then parses the JSON.

This led to adding `https://api.moxfield.com/v2/decks/all/{deckId}` as a third fallback in our preview relay, after the two existing `api2.moxfield.com` deck endpoints. This is a promising lead, **not a confirmed live fix**.

### What changed on the preview branch only

- The frontend now requests deck data through a fixed, allowlisted `/deck-api` route in `relay/worker.js`, rather than directly calling provider endpoints in the browser.
- The relay builds fixed Moxfield/Archidekt endpoints from a validated `site`, `action`, and deck ID. It does not accept an arbitrary URL.
- The route uses the existing app origin allowlist, has basic caching, and returns readable errors with the plain-text fallback.
- Browser-impersonation headers were removed. Do not try to bypass provider authentication/anti-bot protections.
- Moxfield random search is deliberately reported as unavailable because approved API authorization is not configured. Website URL import is best-effort, and must fall back to Moxfield's Copy Plain Text export if the endpoint refuses the request.
- The current feature controls remain hidden/disabled until these code paths can be tested.

## Checks already completed

- `js/app.js` and `relay/worker.js` passed source-level syntax checks.
- Synthetic Moxfield and Archidekt response fixtures passed deck-text conversion checks for commander/mainboard card names and quantities; the Archidekt sideboard fixture was excluded.
- Sample bracket labels 1–4 were recognized by the app's parsing helper.
- URL parsing and the plain-text import path are retained.

## Not tested yet

- No live request was run against Moxfield or Archidekt from this environment.
- The new `/deck-api` route has **not** been deployed to the live Cloudflare Worker and has not been tested in a real browser.
- Random search has not been tested against live search results or bracket metadata.
- The app has not been browser-tested at typical viewport sizes or in multiplayer.

## Release/version coordination

The draw-card animation has shipped as v0.17.0 in [PR #12](https://github.com/ccall1212/commander-table/pull/12). This PR #11 branch still carries an unreleased v0.17.0 version; **before resuming it, bump the deck-import preview to v0.18.0** across index.html, js/app.js, every CSS/JS cache-busting reference, CHANGELOG.md, and compare links. Keep this PR paused until live browser/provider testing is available. Do not publish the deck-import controls or relay changes as part of v0.17.0.
## Instructions for Claude Code

1. Review PR #11 and this handoff. Keep it as a draft; do not merge it or publish v0.17.0.
2. In a local checkout of `feat/random-commander-deck-picker-preview`, inspect the diff, syntax-check `js/app.js` and the Worker, and test the normal plain-text import for regressions.
3. In a separate test deployment (not the production Cloudflare Worker), test `GET /deck-api?site=archidekt&action=deck&id=<public-id>` and the matching search action from `https://ccall1212.github.io`. Confirm origin restrictions reject other origins and arbitrary URLs cannot be requested.
4. Try the supplied public Moxfield URL `https://moxfield.com/decks/pdJTEzRX-EGD3kigoGdm5Q`. If the v2 endpoint works, verify the imported name, commanders, quantities, and mainboard; if blocked, record the exact status and keep the plain-text fallback. Do not add personal API tokens or bypass provider protection.
5. Test random Archidekt decks with brackets 1–4, paying special attention to missing bracket metadata. Never label an unknown-bracket deck as a confirmed match.
6. Only enable the controls after real-browser tests pass. Leave PR #11 in draft until Chris explicitly approves any merge/publish.

