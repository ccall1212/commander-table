# Relay protocol v2

One WebSocket per browser "peer". The relay is a dumb broker: it never looks inside game
messages. The same protocol is spoken by the Cloudflare relay (`relay/worker.js`, one Durable
Object per room) and the LAN server (`lan-server.py`). The browser side is `js/relay-peer.js`
(`RelayPeer`, a drop-in for the subset of the PeerJS API that `js/net.js` uses).

## Endpoints
- Cloudflare relay: `wss://<worker>/room/<ROOM>` — ROOM is the 5-char room code (A–Z, 2–9),
  case-insensitive; the worker routes it to `idFromName(ROOM.toUpperCase())`.
  `GET /health` → `{"ok":true,"v":2,"features":["room-vault-v1"]}` on a Worker
  with room-vault support (CORS: allowed origins only).
- LAN server: `ws://<host>:<port>/ws` (one broker for the whole server; room ignored) — and
  also `ws://<host>:<port>/room/<ROOM>` (same broker).

All frames are UTF-8 JSON text. Every message has `op`.

## Server → client on connect
`{"op":"hello","v":2,"server":"cf-relay"|"lan","maxMsg":<bytes>,"features":[...]}` —
`maxMsg` is the largest single text frame the server accepts (Cloudflare: 1000000, LAN: 8000000).
`features` is additive capability discovery. Clients must tolerate it being absent. The Cloudflare
Worker advertises `room-vault-v1` when it supports the host-mediated private-board vault; LAN does
not advertise or implement this feature.

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

## Optional Cloudflare room vault (`room-vault-v1`)

This additive feature is available only when advertised in the Cloudflare `hello.features` array.
It does not change protocol version 2, ordinary link framing, or LAN behavior. A client should not
send vault requests unless the connected server advertised the feature.

Only the registered canonical room host socket may use the API: its id must be
`ctable-v1-<room in lowercase>` and it must have registered with a non-empty key. The Worker hashes
that key and binds the room vault to the first valid put. Every subsequent vault action requires
the same hash, including after the host socket disconnects. A replacement socket with a different
key cannot read, claim another seat, list, clear, or delete vault data. This relies on the existing
host registration key as authentication; it is not a new login or end-to-end encryption mechanism.

Client request (top-level WebSocket frame, not a linked `msg`):

```json
{"op":"vault","rid":"request-1","action":"put","pid":"seat-1","data":{"me":{},"deck":{},"revision":42}}
```

`rid` is a client-chosen request id. Actions are:

- `put`: requires `pid` and an object `data` with object-valued `me` and `deck`. Stores the complete
  private snapshot. The JSON UTF-8 payload limit is 900,000 bytes and the room holds at most 12
  player records. Payload chunks are private Durable Object storage entries; the relay never puts
  the payload in a public room message or sends it to another socket. When both stored and incoming
  `data.revision` values are safe integers, a lower or equal incoming revision is acknowledged with
  `result.ignored: true` and does not replace the stored snapshot. Missing/invalid revisions retain
  compatibility with older clients.
- `get`: requires `pid`; returns `{pid, updatedAt, expiresAt, data}` only to the requesting host.
- `delete`: requires `pid`; removes that record's payload.
- `list`: returns metadata only (`pid`, timestamps, byte count), never private data.
- `clear`: removes every payload in the room.

All successful replies use `{"op":"vault","rid":...,"ok":true,"result":...}`. Errors use
`{"op":"vault","rid":...,"ok":false,"error":"..."}`. Stored records, staging chunks, and the
room host binding expire after 24 hours; valid puts extend the host binding. Delete and clear leave
the binding in place until expiry so a different host key cannot take over an existing room.
After expiry the room can be reused with a new host key. These server-side backups are optional;
older clients and relays continue to use the existing v2 protocol without vault support.

## Limits / safety
- Frames over `maxMsg` → server closes that socket (code 1009).
- Unparseable frames or unknown ops are ignored.
- Cloudflare relay: WebSocket upgrades are accepted only from allowed `Origin`s
  (`https://ccall1212.github.io`, `http://localhost:*`, `http://127.0.0.1:*`, `null` for file://);
  others get HTTP 403.
