# Separate deck-import test service (Cloudflare dashboard only)

This is an HTTP-only test Worker named **commander-table-deck-import-test**. It has no room bindings, no game-room storage, and no Durable Objects. Do not change the existing **commander-table-relay** Worker to use this configuration.

Chris does not need Python, a terminal, Node/npm or a local server. Cloudflare runs the deploy command on its own servers.

## Create the separate test Worker

1. In **Workers & Pages**, create a NEW Worker by importing the existing GitHub repository `ccall1212/commander-table`.
2. Use these exact settings:

   | Setting | Value |
   |---|---|
   | Worker name | `commander-table-deck-import-test` |
   | Production branch for THIS TEST WORKER | `feat/random-commander-deck-picker-preview` |
   | Root directory | `deck-import-test` |
   | Build command | Empty |
   | Deploy command | `npx wrangler deploy` |
   | Preview branch builds | Off |

   The production branch setting here belongs only to the newly named test Worker. The live game relay must stay on main.

3. If the creation screen doesn't let you choose the branch, create the Worker, then set the branch under **Settings → Builds → Production** and retry its build. A first attempt on main cannot find this new test folder until the draft is released; do not merge just to make that attempt pass.
4. A successful deployment provides a public `https://commander-table-deck-import-test.…workers.dev` address. Open its `/health` URL: it should report `{"ok":true,"service":"deck-import-test"}`.
5. Download/extract the PR test ZIP and double-click `index.html`. Expand **Website import — test preview**, paste the service's base address (without `/health`), and select **Use test service**. Follow `TESTING.md`.

This deployment is only for testing public deck import. Do not enable or deploy the draft on the live game relay until the live tests pass and Chris approves the game release. Provider access may still be blocked from Cloudflare even if ordinary HTTP access works elsewhere.

## Configuration

The local `wrangler.jsonc` points to `../relay/deck-test-worker.js`; it reuses the fixed-provider route in `relay/deck-api.js`. The draft production relay adds the same route but keeps the WebSocket broker unchanged. The existing production `relay/wrangler.jsonc` is unchanged. No credentials or personal API keys are required in the source or chat.
