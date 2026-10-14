# Relay protocol v2

One WebSocket per browser "peer". The relay is a dumb broker: it never looks inside game
messages. The same protocol is spoken by the Cloudflare relay (`relay/worker.js`, one Durable
Object per room) and the LAN server (`lan-server.py`). The browser side is `js/relay-peer.js`
(`RelayPeer`, a drop-in for the subset of the PeerJS API that `js/net.js` uses).

## Endpoints
- Cloudflare relay: `wss://<worker>/room/<ROOM>` — ROOM is the 5-char room code (A–Z, 2–9),
  case-insensitive; the worker routes it to `idFromName(ROOM.toUpperCase())`.
  `GET /health` → `{"ok":true,"v":2}` (CORS: allowed origins only).
- LAN server: `ws://<host>:<port>/ws` (one broker for the whole server; room ignored) — and
  also `ws://<host>:<port>/room/<ROOM>` (same broker).

All frames are UTF-8 JSON text. Every message has `op`.

## Server → client on connect
`{"op":"hello","v":2,"server":"cf-relay"|"lan","maxMsg":<bytes>}` — `maxMsg` is the largest
single text frame the server accepts (Cloudflare: 1000000, LAN: 8000000).

## Keepalive
Client may send `{"op":"ping"}` at any time; server answers `{"op":"pong"}`.
(Cloudflare: done with `setWebSocketAutoResponse`, so it doesn't wake the Durable Object.)

## Registration (one per socket)
`{"op":"reg","id":<string|null>,"key":<string|null>}`
- `id` null → server assigns a random id.
- `id` free → register, reply `{"op":"open","id":id}`.
- `id` taken by another live socket:
  - if `key` is a non-empty string equal to the key the current holder registered with →
    TAKEOVER: send the old socket `{"op":"err","type":"replaced","message":"Opened somewhere else"}`,
    tear the old socket down exactly as if it disconnected (its links get `cclose`), close it,
    then register the new socket and reply `open`.
  - otherwise → `{"op":"err","type":"unavailable-id","message":"ID is taken"}`; socket stays open
    and may send another `reg`.
- A second `reg` on an already-registered socket → `{"op":"err","type":"invalid-message"}`.
- Cloudflare only: at most 12 registered sockets per room; the 13th gets
  `{"op":"err","type":"room-full","message":"This room is full"}`.

## Links (virtual connections)
- `{"op":"conn","cid":<client string>,"to":<peer id>,"meta":<any>}` (after reg). Target missing →
  `{"op":"cfail","cid":cid,"type":"peer-unavailable","message":"Could not connect to peer <to>"}`.
  Else create link `lid` (short random string); FIRST send target
  `{"op":"inc","lid":lid,"from":<initiator id>,"meta":meta}`, THEN initiator
  `{"op":"copen","cid":cid,"lid":lid}`.
- `{"op":"msg","lid":lid,"d":<any>}` → forwarded verbatim to the other end of the link (ignored if
  the link is unknown or the sender isn't one of its ends).
- `{"op":"cclose","lid":lid}` → other end gets `{"op":"cclose","lid":lid}`; link deleted.
- Socket closes/errors → unregister its id; for each of its links send the other end
  `{"op":"cclose","lid":lid}` and delete the link.

## Limits / safety
- Frames over `maxMsg` → server closes that socket (code 1009).
- Unparseable frames or unknown ops are ignored.
- Cloudflare relay: WebSocket upgrades are accepted only from allowed `Origin`s
  (`https://ccall1212.github.io`, `http://localhost:*`, `http://127.0.0.1:*`, `null` for file://);
  others get HTTP 403.
