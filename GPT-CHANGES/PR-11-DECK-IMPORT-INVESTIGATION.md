# Random deck picker / website deck import — PAUSED

**Paused again at Chris's explicit request on 2026-10-20.** Do not resume implementation, deploy the test service, merge, or publish until he asks to resume. Draft [PR #11](https://github.com/ccall1212/commander-table/pull/11) and branch `feat/random-commander-deck-picker-preview` are preserved.

## Recovery checkpoint to preserve

- Latest draft commit: `a415ef5a9d13531a9c6b5877ab40adf84388c6dc`, candidate v0.30.0. The draft recovers the earlier preview on the then-current main, preserving the original history. Before resuming, reconcile it with the current main (including v0.28.2 and v0.29.0), choose an available version, and update release docs.
- The draft fixes the Archidekt ID regex; conversion preserves quantities, commanders and printings. Random Archidekt results require an explicit matching bracket from full deck details, public/listed Commander format, 1–2 commanders and exactly 100 cards. Unknown brackets are not confirmed matches. Moxfield random search remains unavailable without approved API access.
- A separate HTTP-only Worker configuration is prepared in `deck-import-test/`, named `commander-table-deck-import-test`, using `relay/deck-test-worker.js`. It has no game-room Durable Object bindings. **It has not been deployed by the assistant.** Earlier Cloudflare dashboard access was declined. Do not alter or deploy the production relay for this draft.
- The normal app opens from an extracted ZIP by double-clicking `index.html`. Its collapsed website-import test panel additionally requires the separate test-service origin and refuses the live game relay. Plain-text import remains available.
- Completed checks recorded in PR #11: real recorded Archidekt/Moxfield conversion fixtures, source/quantity/category/printing validation, bracket/format/privacy/completeness refusals, fixed-route/parameter/origin and provider-response checks, JavaScript syntax checks and 16 local reference-protocol checks. These are not deployed-Worker or browser results.
- A test ZIP from this exact commit was supplied in chat as `commander-table-v0.30.0-deck-import-draft.zip`. It is a preserved draft, not the published game.

## Still required after Chris asks to resume

1. Reconcile the branch with current main and coordinate its version and changelog.
2. Deploy only the separate test Worker (dashboard root `deck-import-test`, draft branch, no build command, deploy command `npx wrangler deploy`, preview builds off), then verify provider access from Cloudflare and browser CORS for both GitHub Pages and local-file origins.
3. Test public deck URLs, bracket selection, quantities/commanders/printings/save behavior, honest no-match/errors, and the ordinary manual-import/lobby/Deck Builder/game-entry paths in Sidebar/Grid and two-player sessions. Keep plain-text fallback when a provider refuses access; do not bypass protections or add personal tokens.
4. Only after those checks and explicit approval, prepare a production release. Do not silently enable the test draft on the live game.
