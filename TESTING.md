# Admin room dashboard — v0.49.0 test copy (Objective #51)

Extract the ZIP and open `admin.html` to review the dashboard. The real room list, join approvals and close action require the matching Cloudflare relay update and a private `ADMIN_PASSPHRASE` secret; the ZIP by itself cannot activate server-side admin controls. See [Admin setup](docs/ADMIN.md). This branch has not been published to the live game or relay.

1. With the updated relay and passphrase, host a throwaway online room. Open `admin.html` in another browser/tab, enter the passphrase, and confirm the room code, host, player names and active count appear. A wrong passphrase must reveal no room data. Have a second player join and disconnect; confirm the roster updates. Repeat with the host in Sidebar and Grid. A direct PeerJS fallback game should not appear.
2. Choose **Request to join**. The host should receive a visible prompt. Decline once and confirm no join link appears; retry and Allow, then confirm the dashboard reveals the regular Join link. Enter normally with a deck and available color. The admin should not get hidden cards or moderator status automatically.
3. On a throwaway relay room, choose **Close room** and confirm. Connected browsers should leave that room and not silently recover under the same code. The room should disappear from the list. Do not use this action on a game you want to keep.
4. Confirm players still play normally when `ADMIN_PASSPHRASE` has not been configured, while the dashboard refuses access. Confirm existing PeerJS fallback remains playable, with its dashboard limitation shown clearly.

## Assistant verification

`node tests/test_admin_worker.cjs` checks the private API, limited room roster, host join decision, close, and 24-hour reconnect block. `node tests/test_admin_transport.cjs` checks the browser relay's presence, join and close frames. `node tests/test_admin_browser.cjs` checks the real dashboard in Chromium with a simulated API: passphrase, list, host and player labels, approved join link, close and no page errors. Changed JavaScript syntax and Python compilation checks pass. A full browser check against a deployed Worker and real two-player game is still needed; no production Worker deployment was made for this branch.

Objective #18's separate iPhone Touch mode fix remains open in PR #69. Paused draft PR #11 is untouched.
