# Legacy LAN cleanup — Objective #44, v0.44.1

Extract this ZIP and double-click **index.html**, as usual. You do not need Python, a terminal or a local server. The website and downloaded copy continue to use the existing internet relay.

## What changed

The unused Windows/macOS/Linux LAN launchers, Python LAN server, LAN-only browser shims and updater are removed. The Cloudflare relay, private-board recovery, PeerJS fallback, saved decks and normal online version notice remain in place. Developer protocol checks now target an explicit relay URL, including the actual Worker run locally.

## Click list

1. Extract the ZIP. **Start LAN game.bat**, **start-lan-game.command**, **start-lan-game.sh** and **lan-server.py** should be absent. Open **index.html** directly.
2. Select a saved deck and host. Choose the opening rule and color. In a second browser/device running the same copy, join with the room code and choose another color. Both screens should connect.
3. Keep both hands and Start. Draw, play/tap a card and change life; the other screen should update. Check Sidebar and Grid at 1920×1080 and 1366×768.
4. Reload the joining browser, then the host. Both should resume the same boards and hands without a duplicate seat. Try Practice solo too.
5. There should be no LAN address or server-updater controls. Your normal appearance, deck, chat and in-game controls remain available.

## Verification

- All 15 non-browser Node suites pass, including room-vault authorization/durability, moderation, personal Undo, readiness/mulligans, response transport, targeting, colors, P/T, tokens, chat, backup and deck checks.
- All 15 broker protocol cases pass against the unchanged Worker run in local Miniflare. These cover registration/takeover, messages and large payloads, outsider rejection, close/reconnect notifications, room capacity and ping/pong. Only the old LAN endpoint-alias case was removed.
- Actual two-player Chromium over localhost HTTP and that Worker passes the opening-readiness and host-opening-rule browser flows: host/join/color selection, all three hand rules, two-player redeal, live readiness, pre-start blocking, post-start card play, reload and New Game. Sidebar/Grid at 1920×1080 and 1366×768 pass.
- The personal Undo browser flow also passes on this copy, including card-control transfer and incoming life requests. A browser smoke check confirmed the normal online version notice still appears, with no requests for deleted LAN scripts or LAN/updater UI and no page errors.
- The 13-case network harness passes all 11 relay/app checks, including host reload and shared state. Direct-PeerJS checks t12/t13 fail with host-registration timeouts in both this proposal and the published v0.44.0 baseline; proxy tunnel errors prevent verification of that path here. No bypass was attempted.
- Changed JS/Python syntax, cache/version links, reference checks and diff checks pass. All 18 local CSS/JS references resolve to files. Worker, relay configuration, TURN configuration and the RelayPeer implementation are unchanged. Historical changelog entries retain old LAN details.

Assistant browser checks use HTTP; no file:// or real-device Safari result is claimed. No publication approval has been given for this cleanup. Paused draft PR #11 remains untouched.
