# Website import / random deck picker — draft PR #11

Branch: `feat/random-commander-deck-picker-preview`. The recovery candidate is v0.30.0 on current main, separate from the v0.29.0 targeting-arrow candidate. Coordinate/rebase versions and changelog links before publishing either; this draft is not approved for release.

## Recovery on 2026-10-20

- Preserve the old branch history while rebuilding the import changes on the current app, including Deck Builder, Touch mode, chat and Sidebar/Grid. No old app.js rewrite or old lobby markup is carried over.
- Fix the old relay regex `/^\\d.../`, which rejected ordinary Archidekt numeric deck IDs. A regression test exercises an actual numeric ID.
- Convert public provider payloads in `js/deck-import.js`, preserving printings, commanders and quantities. Do not discard genuine main-deck cards merely because a user's category is named Tokens. Exclude Maybeboard, Sideboard, companions and excluded categories.
- Check the FULL deck's explicit bracket. A matching search-summary bracket cannot substitute for missing detailed bracket data. Random selection checks Commander format, public/listed visibility, one/two commanders and exactly 100 cards; four pages/twelve detailed candidates are the bounded search sample.
- The draft test panel requires a separate test Worker address and refuses the live game relay. Chris extracts the ZIP and opens index.html directly: Origin `null` is supported. Normal plain-text import and saved decks stay independent.
- The `/deck-api` route accepts only fixed Archidekt/Moxfield endpoints, bounded validated IDs/pages and allowed origins. It rejects arbitrary URL parameters, duplicate parameters, redirects, non-JSON/oversized responses, and non-GET methods. It stops on provider refusal instead of trying impersonation or personal tokens. Moxfield random search returns unavailable.
- `deck-import-test/` contains a separately named HTTP-only Worker configuration. It has no Durable Object bindings and no access to live game rooms. Its name is `commander-table-deck-import-test`. Setup is entirely in Cloudflare's dashboard; no laptop tooling is required.

## Verified evidence

- Ordinary HTTP requests from this environment, with an honest CommanderTable User-Agent, returned 200 from Archidekt search/detail and the supplied public Moxfield deck on 2026-10-20. This does not prove access from Cloudflare addresses.
- Archidekt sends `Access-Control-Allow-Origin: http://localhost:3000`; the Moxfield response had no CORS allow-origin header. The website therefore still needs its relay for browser access.
- Recorded, minimized public payload fixtures preserve the relevant data shapes. Archidekt deck 27632092 converts to 103 cards including its commander, matching the provider search summary's size 103 (110 total minus seven Maybeboard cards). It is deliberately ineligible for random selection. The Moxfield example converts to one commander plus 99 main-deck cards.
- Automated conversion, URL, bracket/pagination/completeness and route validation tests pass. Origin `null` works in the handler tests. Refused origins/requests never contact providers; 401/403/429 are not bypassed. Size limits cover streaming bodies too.
- All 16 existing relay protocol tests pass against the local LAN reference server. This is not a deployed-Worker/browser result.

## What still blocks publication

1. Create/deploy ONLY the separate test Worker using `deck-import-test/README.md` and this branch. Production relay stays unchanged.
2. Test the two real public providers from the deployed test Worker. If Moxfield blocks Cloudflare, keep the clear plain-text fallback; do not claim it works there.
3. Test the test route from real browser origins, including double-clicked local index.html, verify CORS refusals and malformed/arbitrary-URL rejection, and test all brackets 1–4. Missing matches should produce an honest no-match message.
4. Chris checks the normal lobby/import, saved Deck Builder, game entry, Sidebar/Grid and two-player flow. Browser access to the agent's local test page was declined; no visual/touch/multiplayer browser pass is claimed.
5. Only after live checks and Chris's explicit approval, prepare the production route deployment and normal user-facing controls as a coordinated game release. Do not merge this test-only draft or deploy it to the production game relay now.

## Cloudflare failure investigation (resolved separately)

Chris's build log showed `npx wrangler preview` failing for missing previews configuration. Screenshots confirmed successful Production deployments from main, while a separate branch preview named main failed. Chris disabled preview builds. Production was already working; this was not a relay-code failure. The new HTTP-only test Worker avoids modifying the live relay or relying on that unconfigured preview path.
