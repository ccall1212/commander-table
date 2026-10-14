# Online multiplayer — investigation, decision and design

Branch: `feature/relay-netcode`. `main` (the live site) is untouched until this is merged.

## 1. What was going wrong

Measured from Chris's laptop on the office network (2026-10-14):

| Check | Result |
|---|---|
| PeerJS matchmaking server `0.peerjs.com` | reachable — rooms *are* found |
| PeerJS's built-in TURN relays (`*.turn.peerjs.com`) | **don't exist** (no DNS) |
| Other free public TURN (`openrelay.metered.ca`) | not answering |
| Direct WebRTC between two tabs on the **same** laptop | failed in the morning, worked in the afternoon (same network) — inconclusive |
| Outbound HTTPS/WSS (443) to Cloudflare, MQTT/Nostr brokers | works |

So the host showed **Connected** (it had registered with the matchmaking server) while guests sat on
**Connecting/Reconnecting**: the matchmaker introduced them, then the browser-to-browser WebRTC link
between *different* computers didn't form, and there was no relay to fall back on. What is certain:
the built-in fallback relays are gone. What is likely but unproven: the office network (firewall /
client isolation between machines) blocks direct links — only a test between two real office
machines can confirm it. The Cloudflare relay avoids the question entirely, because it uses the
same HTTPS connection as any website. The old 8-second
connect timeout made it retry from scratch forever without saying why.

Smaller issues found while reviewing the code:
- **Pass turn** carried no turn number: two players passing at once (or a pass delivered late after a
  reconnect) skipped a player.
- **Offline queue** replayed every queued action on reconnect, however old ("lose 5 life" minutes later).
- No message ids, so a repeated frame would be applied twice.
- Same game open in two tabs → the two tabs kicked each other off in a loop.
- A reloading host had to wait for its old registration to expire before reclaiming the room.
- The host's table was saved with a 300 ms debounce; a reload right after a change could roll it back.

## 2. Options compared

| | A. PeerJS + TURN | B. Trystero | C. Own relay on Cloudflare (chosen) |
|---|---|---|---|
| What carries game traffic | WebRTC (direct, or via TURN) | WebRTC (direct, or via TURN) | WebSocket over HTTPS to a Durable Object |
| Works on the office network | only with a TURN relay over TCP/TLS 443 | same — Trystero only replaces *signalling* (Nostr/MQTT/torrent trackers), the data path is still WebRTC | **yes** (plain HTTPS/WSS, same as any website) |
| Account / cost | TURN needs an account (Cloudflare TURN 1,000 GB/mo free; credentials must be minted server-side, so a Worker anyway) | free public relays, no account — but no TURN, so same failure here | Chris's existing Cloudflare account, Workers Free plan |
| Reliability | depends on 0.peerjs.com (free, community) + TURN | depends on public Nostr/MQTT servers (no SLA, rate limits); peer discovery can be slow | Cloudflare edge; no third-party community servers in the path |
| Fit with our host-authoritative design | already built on it | would need an adapter; room API is mesh-oriented | drop-in: `RelayPeer` mimics the PeerJS API `net.js` uses, so the authority model is unchanged |
| Privacy | P2P (TURN sees encrypted DTLS) | P2P; signalling metadata on public relays | TLS to Chris's own Worker; Cloudflare could in principle see game messages (card names/positions) |

**Decision: C, with A kept as an automatic fallback.** The relay is the only option that works on
the network where the problem actually happens without a third-party account, and it plugs in
under the existing `net.js` session logic (heartbeats, retries, host authority) instead of replacing it.
Trystero would not fix the root cause (WebRTC blocked) and adds dependence on public relays.

## 3. Architecture

```
GitHub Pages (static site)                Cloudflare Worker "commander-table-relay"
  index.html + js/*                          GET /health
  net.js  ── session logic, host authority   GET /room/<CODE>  (WebSocket upgrade)
     │                                          └─> Durable Object "Room" (one per room code)
     ├─ transport 'relay' : js/relay-peer.js ──wss──┘   dumb broker: reg / conn / msg / cclose
     ├─ transport 'p2p'   : PeerJS (WebRTC) — fallback / home networks
     └─ transport 'lan'   : lan-server.py (same broker protocol, optional)
```

- **Protocol:** `docs/relay-protocol.md` (v2). Same broker in `relay/worker.js` and `lan-server.py`.
- **Authority:** unchanged — every player owns their own cards and publishes a public view; the host
  owns the table (turns, seats, log) and relays. The relay never interprets game messages.
- **Route choice (`js/net-config.js`):** `mode:'auto'` = relay first; if the relay can't be reached
  the host falls back to direct PeerJS, and a guest that can't find the host on one route tries the
  other after 4 "not found" answers. `?net=relay|p2p` overrides for testing.
- **Scale:** star topology through one Durable Object per room; the relay allows 12 sockets per room
  (raise `MAX_PEERS` in `relay/worker.js`); the table allows 6 seats.
- **No secrets in the client:** the relay URL is public. Room safety comes from a per-session random
  *key*: only the same browser session can take a room id back (instant host reload); anyone else
  gets "room code taken". WebSocket upgrades are only accepted from allowed origins.
- **Cost (Workers Free plan, per Cloudflare's pricing page, Oct 2026):** Durable Objects with SQLite
  storage are included; 100,000 requests/day, incoming WebSocket messages count 20:1, 13,000 GB-s/day,
  idle (hibernated) rooms cost nothing; keepalive pings are auto-answered without waking the object.
  A 4-player game is roughly 400–500 "requests" per hour → dozens of game-hours per day of headroom.
  If the limit is hit, the relay refuses until 00:00 UTC and `auto` mode falls back to PeerJS.

### Connection stages shown to players
`init → connecting → connected`, and on trouble: `waiting-host` (room not open yet), `room-not-found`
(after 60 s), `signaling` (relay/matchmaker unreachable), `ice` (direct link blocked), `timeout`,
`host-left`, `recovering`, `id-taken`, `replaced` (opened in another tab), `room-full`.
The top bar shows the text; ☰ → **Connection details…** shows everything (route, state, peers, queue).

### Safety on reconnect
- Every app message carries a unique id; receivers drop repeats.
- Actions queued while offline are **dropped after 20 s** (the player gets a toast); only the latest
  public snapshot is sent late, because it describes the present.
- `pass` carries the turn it was meant for; the host ignores stale passes.
- The host bumps `table.rev` on every change and saves immediately; reconnecting guests send their
  copy (`tsync`) and the host adopts it only if it's newer, from the same room, and still seats the host.
- A game opened in a second tab tells the first tab to stand down instead of fighting over the seat.

## 4. Files

| File | Purpose |
|---|---|
| `relay/worker.js`, `relay/wrangler.jsonc` | Cloudflare Worker + Durable Object relay (hibernation API) |
| `relay/SETUP.md` | one-time Cloudflare setup |
| `relay/test/relay-test.html` | protocol self-test page for the deployed relay |
| `js/relay-peer.js` | `RelayPeer` — PeerJS-compatible client over WebSocket |
| `js/net-config.js` | relay URL + route mode |
| `js/net.js` | route selection/fallback, stage codes, chunk size from server, message ids, stale-queue expiry, duplicate-tab handling, `Net.diag()` |
| `js/app.js` | invite links (`?join=CODE`), status codes in the UI, dropped-action toast, turn-guarded pass, table `rev` + `tsync`, ☰ Connection details, `?nettest` hook |
| `js/lan.js`, `lan-server.py` | LAN mode now uses the same `RelayPeer` + protocol v2 |
| `index.html`, `css/style.css` | script tags, invite banner, diagnostics styling |
| `tests/net-harness.html` | automated browser tests (13 scenarios) |
| `tests/test_relay_protocol.py` | protocol tests (16 cases) against the LAN server or a deployed relay |
| `docs/relay-protocol.md`, `docs/NETWORKING.md` | protocol + this document |

## 5. Tests

Run locally: `python lan-server.py --start --no-browser` (port 8790) and any static server for the
repo on `127.0.0.1:8099`, then open
`http://127.0.0.1:8099/tests/net-harness.html?relay=http://127.0.0.1:8790&net=relay&auto=1`.
Against the deployed relay: same page with `relay=https://commander-table-relay.<sub>.workers.dev`,
and `python tests/test_relay_protocol.py --url wss://commander-table-relay.<sub>.workers.dev/room/TESTX`.

See the release notes in the PR / chat for the latest recorded results. Everything above runs on one
machine; it proves the code paths, not real-world connectivity between different networks — that
still needs a game between real devices (office + home).
