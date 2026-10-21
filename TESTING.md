# Targeting arrows across board views — v0.33.1 test copy

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

Download the ZIP, extract it, and double-click **index.html**. Keep internet access on. No terminal or local server needed. Use at least two players with this copy; three are useful for switching between two opponents.

## Click list

1. In Sidebar, play several cards on your battlefield. Draw four targeting arrows: your card → opponent card; opponent card → another of your cards; your card → opponent player; opponent card → your player. Use **Send arrow to…** or **☰ → Targeting arrow…**.
2. Click an opponent's tile to view their board big. All arrows whose endpoints appear on the main board or miniature boards should still be visible. Your cards' lines should connect to the YOU miniature, with the count unchanged.
3. Switch to a different opponent, then click YOU to return to your board. Lines should follow their original cards/players each time without redrawing them.
4. Check at roughly 1920×1080 and 1366×768. Switch Sidebar → Grid → Sidebar. Grid's full-board zoom intentionally hides other boards; their card arrows should reappear when you return to the overview.
5. Try dragging/clicking your read-only YOU miniature. It should still just return you to your board, without moving, tapping or modifying your cards. Click an arrow to remove only that arrow and confirm the other player receives the removal. Clear all should still work.

## Verification

- Assistant reproduced the original problem in Chromium over localhost HTTP with three relay-connected sessions: four arrows counted, only one drawn after focusing an opponent in Sidebar.
- After the fix, a three-session Chromium HTTP pass kept four arrows visible through Sidebar focus switches between two opponents and back to your board, checked Grid overview/zoom return and Sidebar/Grid at 1920×1080 and 1366×768, confirmed miniature dragging does not move your real cards, and checked the second player still sees all four arrows. No page errors observed.
- All five Node suites passed (targeting, chat sizing, P/T, token picker and printings), along with changed JavaScript syntax and diff checks. The targeting regression exercises the real YOU renderer and anchor resolver, including a hidden main board, largest-visible-copy selection, and the own-player miniature marker. A bounded GPT-6 Luna investigation and test contribution were used.
- Source fix gives the YOU miniature separate drawing identifiers, while keeping gameplay identifiers stripped. No relay messages or card state format changed.
- Chris supplied two screenshots and reported arrows not continuing when switching views; he replied “Perfect” and approved publishing this exact fix on 2026-10-21. PR #53 is merged as v0.33.1.
- Assistant browser checks use HTTP: managed Chromium blocks `file://` navigation. Extract/open and real-device Safari/touch need appropriate hands-on checks.

Includes the published floating/transparent/resizable chat. Deck Builder checks (#50) and collection backup (#49) remain independent proposals; deck randomizer/import PR #11 remains paused.
