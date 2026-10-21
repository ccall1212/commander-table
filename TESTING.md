# Room board vault — backend-only test copy

## Backend-only room vault

This branch adds optional `room-vault-v1` support to the Cloudflare relay. It is server-only:
the app frontend and version are unchanged, and LAN mode does not support this API. Local checks
can be run without Cloudflare credentials or a deployment:

```sh
npm install --prefix /tmp/ct-vault-runtime --no-audit --no-fund miniflare@4
NODE_PATH=/tmp/ct-vault-runtime/node_modules node tests/test_room_vault.cjs
python tests/test_relay_protocol.py
```

The room-vault test uses a local Miniflare Durable Object with SQLite persistence. It checks host
authorization, private retrieval, chunking, restart durability, stale-revision rejection, and TTL
cleanup. Protocol regression checks the unchanged v2 relay behavior. To enable recovery in the
existing PR #55 recovery ZIP, the Worker must first be deployed through an approved Cloudflare
Workers Build. Deployment verification still needs `GET /health` to advertise `room-vault-v1` and
a protocol smoke test against the live Worker; local tests alone do not establish that production
has the capability.


## Review and rollout

The ZIP contains the complete runnable project. Extract and double-click index.html to open the existing published frontend; there is no new game control in this server-only copy. Chris does not need to install or run anything. The commands above record assistant/developer checks in the managed environment only.

Publication needs Chris’s explicit approval. After the companion server PR is merged and the production Workers Build succeeds, verify health capability and live relay compatibility. Then use PR #55’s separate updated ZIP to test saved-board status, closing all incognito windows, a fresh browser’s board request and moderator-approved recovery. Do not claim that flow works on the production relay before that verification.

Assistant checks passed: actual local Miniflare SQLite storage/restart, private access denial, chunking/Unicode, concurrent writes, stale revisions, TTL/delete/clear, plus unchanged protocol tests (16/16). The frontend is unchanged at v0.33.1; no browser asset version bump or new app release tag is needed for this service preparation. Existing clients keep using protocol v2. LAN has no vault support.

Collection backup/restore PR #49 and Deck Builder checks PR #50 remain untested by Chris and unpublished. Mulligan and unique-color proposals are separate. Draft PR #11 remains paused; its test Worker is unrelated and must not be deployed.
