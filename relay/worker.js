// Commander Table relay: Cloudflare Worker + one Durable Object per room.
// Protocol: docs/relay-protocol.md (v2). Normal game messages are opaque broker frames. The
// host-mediated room vault is the sole exception: it stores explicitly submitted private boards.
// Uses the WebSocket Hibernation API, so live broker links live in per-socket attachments;
// private vault records live in Durable Object storage:
//   { room: string|null, id: string|null, key: string|null, links: { [lid]: otherPeerId }, dead?: true }

import { DurableObject } from "cloudflare:workers";

// ---- Config (edit here) ---------------------------------------------------------------------
// Origins allowed to open a room socket. Strings = exact match; RegExps = tested against Origin.
const ALLOWED_ORIGINS = [
  "https://ccall1212.github.io",
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  "null", // file:// pages send the literal string "null"
];
const ROOM_RE = /^[A-Za-z2-9]{5}$/;
const MAX_MSG = 1000000; // bytes per text frame
const MAX_PEERS = 12; // registered sockets per room
const MAX_LINKS = 64; // links per socket (keeps the attachment small)
const MAX_ID = 64;
const MAX_KEY = 64;
const VERSION = 2;
const VAULT_MAX_BYTES = 900000;
const VAULT_CHUNK_BYTES = 60 * 1024;
const VAULT_TTL_MS = 24 * 60 * 60 * 1000;
const VAULT_MAX_OWNERS = 12;
const VAULT_PID_RE = /^[\w-]{1,40}$/;

function originAllowed(origin) {
  if (typeof origin !== "string") return false;
  return ALLOWED_ORIGINS.some((o) => (typeof o === "string" ? o === origin : o.test(origin)));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// ---- Worker entry ----------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const okOrigin = originAllowed(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: okOrigin ? corsHeaders(origin) : {} });
    }

    if (url.pathname === "/health") {
      const headers = { "Content-Type": "application/json" };
      if (okOrigin) Object.assign(headers, corsHeaders(origin));
      return new Response(JSON.stringify({ ok: true, v: VERSION, features: ["room-vault-v1"] }), { status: 200, headers });
    }

    const m = /^\/room\/([^/]+)$/.exec(url.pathname);
    if (m && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const room = m[1];
      if (!ROOM_RE.test(room)) return new Response("Bad room code", { status: 400 });
      if (!okOrigin) return new Response("Origin not allowed", { status: 403 });
      const id = env.ROOMS.idFromName(room.toUpperCase());
      return env.ROOMS.get(id).fetch(request);
    }

    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  },
};

// ---- Room (Durable Object) -------------------------------------------------------------------
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Client pings are answered by the runtime without waking the object.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"op":"ping"}', '{"op":"pong"}'),
    );
    this.vaultQueue = Promise.resolve();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const room = (new URL(request.url).pathname.match(/^\/room\/([^/]+)$/) || [])[1];
    this.save(server, { room: room ? room.toUpperCase() : null, id: null, key: null, links: {} });
    try {
      server.send(JSON.stringify({ op: "hello", v: VERSION, server: "cf-relay", maxMsg: MAX_MSG, features: ["room-vault-v1"] }));
    } catch (e) {
      // socket already gone; webSocketClose/Error will clean up
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- helpers ----
  att(ws) {
    let a = null;
    try {
      a = ws.deserializeAttachment();
    } catch (e) {
      a = null;
    }
    if (!a || typeof a !== "object") a = { id: null, key: null, links: {} };
    if (!a.links || typeof a.links !== "object") a.links = {};
    return a;
  }

  save(ws, a) {
    try {
      ws.serializeAttachment(a);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Find the live registered socket holding `id` (optionally excluding one socket).
  findById(id, exclude) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      const a = this.att(ws);
      if (!a.dead && a.id === id) return { ws, a };
    }
    return null;
  }

  countRegistered() {
    let n = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.att(ws);
      if (!a.dead && a.id !== null) n++;
    }
    return n;
  }

  // Send a JSON object (or pre-serialised string). A throwing send means the socket is gone.
  send(ws, obj) {
    try {
      ws.send(typeof obj === "string" ? obj : JSON.stringify(obj));
      return true;
    } catch (e) {
      this.drop(ws, 1011, "send failed");
      return false;
    }
  }

  // Tear a socket down: unregister, cclose its links, close it. Safe to call repeatedly.
  drop(ws, code, reason) {
    const a = this.att(ws);
    const wasDead = !!a.dead;
    const notify = [];
    if (!wasDead) {
      // Mark dead first so re-entrant drops (from failed sends) see it as already cleaned up.
      this.save(ws, { id: null, key: null, links: {}, dead: true });
      for (const [lid, otherId] of Object.entries(a.links)) {
        if (otherId === a.id) continue; // self-link: nothing to tell
        const other = this.findById(otherId, ws);
        if (!other) continue;
        delete other.a.links[lid];
        this.save(other.ws, other.a);
        notify.push([other.ws, lid]);
      }
    }
    try {
      const safe =
        Number.isInteger(code) && code >= 1000 && code < 5000 && ![1004, 1005, 1006, 1015].includes(code)
          ? code
          : 1000;
      ws.close(safe, String(reason || "").slice(0, 100));
    } catch (e) {
      // already closed
    }
    for (const [other, lid] of notify) this.send(other, { op: "cclose", lid });
  }

  // ---- Hibernation API handlers ----
  async webSocketMessage(ws, message) {
    const a0 = this.att(ws);
    if (a0.dead) return;

    let text;
    if (typeof message === "string") {
      let tooBig = message.length > MAX_MSG;
      if (!tooBig && message.length * 3 > MAX_MSG) {
        tooBig = new TextEncoder().encode(message).byteLength > MAX_MSG;
      }
      if (tooBig) return this.drop(ws, 1009, "too big");
      text = message;
    } else {
      if (message.byteLength > MAX_MSG) return this.drop(ws, 1009, "too big");
      try {
        text = new TextDecoder().decode(message);
      } catch (e) {
        return;
      }
    }

    let msg;
    try {
      msg = JSON.parse(text);
    } catch (e) {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    switch (msg.op) {
      case "ping":
        this.send(ws, '{"op":"pong"}');
        break;
      case "reg":
        this.onReg(ws, msg);
        break;
      case "conn":
        this.onConn(ws, msg);
        break;
      case "msg":
        this.onMsg(ws, msg, text);
        break;
      case "vault":
        await this.onVault(ws, msg);
        break;
      case "cclose":
        this.onCclose(ws, msg);
        break;
      default:
        break; // unknown ops are ignored
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    this.drop(ws, code, reason);
  }

  async webSocketError(ws, err) {
    this.drop(ws, 1011, "error");
  }

  // ---- broker ops ----
  onReg(ws, msg) {
    const a = this.att(ws);
    if (a.id !== null) {
      this.send(ws, { op: "err", type: "invalid-message", message: "Already registered" });
      return;
    }
    let want = msg.id;
    if (want === undefined || want === null || want === "") want = crypto.randomUUID();
    if (typeof want !== "string") {
      this.send(ws, { op: "err", type: "invalid-message", message: "Bad id" });
      return;
    }
    want = want.slice(0, MAX_ID);
    const key = typeof msg.key === "string" && msg.key.length > 0 ? msg.key.slice(0, MAX_KEY) : null;

    const holder = this.findById(want, ws);
    if (holder) {
      if (key !== null && holder.a.key !== null && key === holder.a.key) {
        // TAKEOVER: same key => the old socket is a stale session of the same browser.
        this.send(holder.ws, { op: "err", type: "replaced", message: "Opened somewhere else" });
        this.drop(holder.ws, 1000, "replaced");
      } else {
        this.send(ws, { op: "err", type: "unavailable-id", message: "ID is taken" });
        return;
      }
    } else if (this.countRegistered() >= MAX_PEERS) {
      this.send(ws, { op: "err", type: "room-full", message: "This room is full" });
      return;
    }

    const fresh = this.att(ws); // re-read: a takeover may have touched sockets
    fresh.id = want;
    fresh.key = key;
    this.save(ws, fresh);
    this.send(ws, { op: "open", id: want });
  }

  onConn(ws, msg) {
    const a = this.att(ws);
    const cid = msg.cid;
    const to = msg.to;
    const fail = (message) =>
      this.send(ws, { op: "cfail", cid, type: "peer-unavailable", message: message || "Could not connect to peer " + to });

    if (a.id === null) return fail();
    const target = typeof to === "string" ? this.findById(to) : null;
    if (!target) return fail();
    if (
      Object.keys(a.links).length >= MAX_LINKS ||
      (target.ws !== ws && Object.keys(target.a.links).length >= MAX_LINKS)
    ) {
      return fail("Too many connections for peer " + to);
    }

    let lid;
    do {
      const b = crypto.getRandomValues(new Uint8Array(4));
      lid = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    } while (lid in a.links || lid in target.a.links);

    // FIRST tell the target (single-threaded: nothing can interleave before we commit below).
    if (!this.send(target.ws, { op: "inc", lid, from: a.id, meta: msg.meta === undefined ? null : msg.meta })) {
      return fail();
    }
    // Commit the link on both ends (re-read in case the send path touched attachments).
    const ia = this.att(ws);
    const ta = target.ws === ws ? ia : this.att(target.ws);
    if (ta.dead || ia.dead) return fail();
    ia.links[lid] = target.a.id;
    ta.links[lid] = a.id;
    this.save(ws, ia);
    if (target.ws !== ws) this.save(target.ws, ta);

    // THEN tell the initiator.
    this.send(ws, { op: "copen", cid, lid });
  }

  onMsg(ws, msg, raw) {
    const lid = msg.lid;
    if (typeof lid !== "string") return;
    const a = this.att(ws);
    const otherId = a.links[lid];
    if (otherId === undefined) return; // unknown link or sender isn't an end
    const other = otherId === a.id ? { ws, a } : this.findById(otherId, ws);
    if (!other || other.a.links[lid] === undefined) return;
    this.send(other.ws, raw); // verbatim: no re-serialising of big payloads
  }

  onCclose(ws, msg) {
    const lid = msg.lid;
    if (typeof lid !== "string") return;
    const a = this.att(ws);
    const otherId = a.links[lid];
    if (otherId === undefined) return;
    delete a.links[lid];
    this.save(ws, a);
    let otherWs = null;
    if (otherId === a.id) {
      otherWs = ws;
    } else {
      const other = this.findById(otherId, ws);
      if (other) {
        delete other.a.links[lid];
        this.save(other.ws, other.a);
        otherWs = other.ws;
      }
    }
    if (otherWs) this.send(otherWs, { op: "cclose", lid });
  }

  // ---- Host-mediated private-board vault ---------------------------------------------------
  // Vault data is stored as bounded binary chunks because a Durable Object storage value is
  // limited to 128 KiB. The metadata row is the commit point for a new revision; incomplete
  // chunk writes can never replace a previously committed backup.
  isVaultHost(a) {
    return !!a && typeof a.room === "string" && ROOM_RE.test(a.room) &&
      typeof a.id === "string" && a.id === "ctable-v1-" + a.room.toLowerCase() &&
      typeof a.key === "string" && a.key.length > 0 && !a.dead;
  }

  async hostKeyHash(key) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  vaultMetaKey(pid) { return "vault:owner:" + pid; }
  vaultRoomOwnerKey() { return "vault:room-owner"; }
  vaultChunkPrefix(pid, rev) { return "vault:chunk:" + pid + ":" + rev + ":"; }
  vaultStageKey(pid) { return "vault:staging:" + pid; }

  queueVault(fn) {
    const run = this.vaultQueue.then(fn, fn);
    this.vaultQueue = run.catch(() => {});
    return run;
  }

  async onVault(ws, msg) {
    const rid = typeof msg.rid === "string" && msg.rid.length <= 80 ? msg.rid : null;
    const a = this.att(ws);
    if (!rid) return this.send(ws, { op: "vault", rid, ok: false, error: "bad-request" });
    if (!this.isVaultHost(a)) return this.send(ws, { op: "vault", rid, ok: false, error: "unauthorized" });
    try {
      const result = await this.queueVault(() => this.vaultAction(a, msg));
      this.send(ws, { op: "vault", rid, ok: true, result });
    } catch (e) {
      const error = typeof e === "string" ? e : "storage-error";
      this.send(ws, { op: "vault", rid, ok: false, error });
    }
  }

  async vaultAction(a, msg) {
    const action = msg.action;
    const pid = msg.pid;
    if (!(["put", "get", "delete", "clear", "list"].includes(action))) throw "bad-action";
    if ((action === "put" || action === "get" || action === "delete") && (typeof pid !== "string" || !VAULT_PID_RE.test(pid))) throw "bad-pid";

    const now = Date.now();
    await this.expireVault(now);
    const hostHash = await this.hostKeyHash(a.key);
    const roomOwner = await this.ctx.storage.get(this.vaultRoomOwnerKey());
    if (roomOwner && roomOwner.hostHash !== hostHash) throw "unauthorized";
    if (action === "put") return this.vaultPut(pid, msg.data, hostHash, now);
    if (action === "get") return this.vaultGet(pid, hostHash);
    if (action === "delete") return this.vaultDelete(pid, hostHash);
    if (action === "clear") return this.vaultClear(hostHash);
    return this.vaultList(hostHash);
  }

  async vaultOwners() {
    return this.ctx.storage.list({ prefix: "vault:owner:" });
  }

  async readVault(pid, meta) {
    if (!meta || !meta.hasData || !meta.rev || !Number.isInteger(meta.chunks) || meta.chunks < 1 || meta.chunks > 20) return null;
    const parts = [];
    let size = 0;
    for (let i = 0; i < meta.chunks; i++) {
      const part = await this.ctx.storage.get(this.vaultChunkPrefix(pid, meta.rev) + i);
      if (!(part instanceof Uint8Array) || part.byteLength > VAULT_CHUNK_BYTES) return null;
      parts.push(part); size += part.byteLength;
      if (size > VAULT_MAX_BYTES) return null;
    }
    if (size !== meta.bytes) return null;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch (_) { return null; }
  }

  async vaultPut(pid, data, hostHash, now) {
    if (!data || typeof data !== "object" || Array.isArray(data) || !data.me || typeof data.me !== "object" || Array.isArray(data.me) || !data.deck || typeof data.deck !== "object" || Array.isArray(data.deck)) throw "bad-data";
    let json, bytes;
    try { json = JSON.stringify(data); bytes = new TextEncoder().encode(json); } catch (_) { throw "bad-data"; }
    if (!bytes.length || bytes.byteLength > VAULT_MAX_BYTES) throw "too-large";

    const key = this.vaultMetaKey(pid);
    const prior = await this.ctx.storage.get(key);
    const owners = await this.vaultOwners();
    if (prior && prior.hostHash !== hostHash) throw "unauthorized";
    if (!prior && owners.size >= VAULT_MAX_OWNERS) throw "room-full";

    // App state revisions are monotonic per seat. A host can have an older queued save
    // arrive after a newer one (for example when retries overlap), including after a
    // reconnect. Preserve the committed snapshot in that case. Older clients without a
    // revision remain compatible; the guard applies only when both values are safe ints.
    const incomingRevision = Number.isSafeInteger(data.revision) ? data.revision : null;
    if (incomingRevision !== null && Number.isSafeInteger(prior && prior.revision) &&
        incomingRevision <= prior.revision) {
      return {
        pid, updatedAt: prior.updatedAt, expiresAt: prior.expiresAt,
        bytes: prior.bytes, revision: prior.revision, ignored: true,
      };
    }

    // Bind the entire room on its first valid put, not only this pid. Otherwise a replacement
    // host with a different key could claim a fresh pid and poison list/clear or consume slots.
    // A valid put extends the binding; delete and clear deliberately leave its TTL untouched.
    await this.ctx.storage.put(this.vaultRoomOwnerKey(), { hostHash, expiresAt: now + VAULT_TTL_MS });

    const rev = crypto.randomUUID();
    const prefix = this.vaultChunkPrefix(pid, rev);
    const chunks = Math.ceil(bytes.byteLength / VAULT_CHUNK_BYTES);
    const stageKey = this.vaultStageKey(pid);
    const staleStage = await this.ctx.storage.get(stageKey);
    let committed = false;
    try {
      // Register an expiring manifest before writing chunks. A process interruption can leave
      // only these uniquely named chunks; the alarm will remove them even without an owner row.
      if (staleStage && staleStage.rev) await this.deleteVaultChunks(pid, staleStage.rev, staleStage.chunks);
      await this.ctx.storage.put(stageKey, { rev, chunks, expiresAt: now + VAULT_TTL_MS });
      await this.scheduleVaultAlarm();
      for (let i = 0; i < chunks; i++) {
        await this.ctx.storage.put(prefix + i, bytes.slice(i * VAULT_CHUNK_BYTES, (i + 1) * VAULT_CHUNK_BYTES));
      }
      const meta = {
        hostHash, rev, chunks, bytes: bytes.byteLength,
        updatedAt: now, expiresAt: now + VAULT_TTL_MS, hasData: true,
      };
      if (incomingRevision !== null) meta.revision = incomingRevision;
      await this.ctx.storage.put(key, meta); // atomic revision commit point
      committed = true;
      await this.ctx.storage.delete(stageKey);
      if (prior && prior.rev) await this.deleteVaultChunks(pid, prior.rev, prior.chunks);
      await this.scheduleVaultAlarm();
      return { pid, updatedAt: meta.updatedAt, expiresAt: meta.expiresAt, bytes: meta.bytes, ...(incomingRevision !== null ? { revision: incomingRevision } : {}) };
    } catch (e) {
      // Once metadata points to the new revision it is committed; keep its chunks even if
      // alarm scheduling or cleanup of the previous revision fails afterwards.
      if (!committed) {
        await this.deleteVaultChunks(pid, rev, chunks);
        await this.ctx.storage.delete(stageKey);
        await this.scheduleVaultAlarm();
      }
      throw e;
    }
  }

  async vaultGet(pid, hostHash) {
    const meta = await this.ctx.storage.get(this.vaultMetaKey(pid));
    if (!meta || meta.hostHash !== hostHash) throw meta ? "unauthorized" : "not-found";
    if (!meta.hasData) throw "not-found";
    const data = await this.readVault(pid, meta);
    if (!data) throw "corrupt-data";
    return { pid, updatedAt: meta.updatedAt, expiresAt: meta.expiresAt, data };
  }

  async vaultDelete(pid, hostHash) {
    const key = this.vaultMetaKey(pid), meta = await this.ctx.storage.get(key);
    if (!meta) return { deleted: false };
    if (meta.hostHash !== hostHash) throw "unauthorized";
    if (meta.rev) await this.deleteVaultChunks(pid, meta.rev, meta.chunks);
    await this.ctx.storage.put(key, { hostHash: meta.hostHash, updatedAt: meta.updatedAt, expiresAt: meta.expiresAt, hasData: false });
    await this.scheduleVaultAlarm();
    return { deleted: !!meta.hasData };
  }

  async vaultClear(hostHash) {
    const owners = await this.vaultOwners();
    for (const meta of owners.values()) if (!meta || meta.hostHash !== hostHash) throw "unauthorized";
    for (const [key, meta] of owners) {
      const pid = key.slice("vault:owner:".length);
      if (meta.rev) await this.deleteVaultChunks(pid, meta.rev, meta.chunks);
      await this.ctx.storage.put(key, { hostHash: meta.hostHash, updatedAt: meta.updatedAt, expiresAt: meta.expiresAt, hasData: false });
    }
    await this.scheduleVaultAlarm();
    return { cleared: owners.size };
  }

  async vaultList(hostHash) {
    const owners = await this.vaultOwners(), result = [];
    for (const [key, meta] of owners) {
      if (!meta || meta.hostHash !== hostHash) throw "unauthorized";
      if (meta.hasData) result.push({ pid: key.slice("vault:owner:".length), updatedAt: meta.updatedAt, expiresAt: meta.expiresAt, bytes: meta.bytes });
    }
    result.sort((x, y) => x.pid.localeCompare(y.pid));
    return result;
  }

  async deleteVaultChunks(pid, rev, count) {
    if (typeof rev !== "string") return;
    const n = Number.isInteger(count) ? Math.min(20, Math.max(0, count)) : 20;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(this.vaultChunkPrefix(pid, rev) + i);
    if (keys.length) await this.ctx.storage.delete(keys);
  }

  async expireVault(now = Date.now()) {
    const owners = await this.vaultOwners();
    for (const [key, meta] of owners) {
      if (meta && Number.isFinite(meta.expiresAt) && meta.expiresAt <= now) {
        const pid = key.slice("vault:owner:".length);
        if (meta.rev) await this.deleteVaultChunks(pid, meta.rev, meta.chunks);
        await this.ctx.storage.delete(key);
      }
    }
    const stages = await this.ctx.storage.list({ prefix: "vault:staging:" });
    for (const [key, stage] of stages) {
      if (stage && Number.isFinite(stage.expiresAt) && stage.expiresAt <= now) {
        const pid = key.slice("vault:staging:".length);
        if (stage.rev) await this.deleteVaultChunks(pid, stage.rev, stage.chunks);
        await this.ctx.storage.delete(key);
      }
    }
    const roomOwner = await this.ctx.storage.get(this.vaultRoomOwnerKey());
    if (roomOwner && Number.isFinite(roomOwner.expiresAt) && roomOwner.expiresAt <= now) {
      await this.ctx.storage.delete(this.vaultRoomOwnerKey());
    }
    await this.scheduleVaultAlarm();
  }

  async scheduleVaultAlarm() {
    const owners = await this.vaultOwners();
    let next = Infinity;
    for (const meta of owners.values()) if (meta && Number.isFinite(meta.expiresAt)) next = Math.min(next, meta.expiresAt);
    const stages = await this.ctx.storage.list({ prefix: "vault:staging:" });
    for (const stage of stages.values()) if (stage && Number.isFinite(stage.expiresAt)) next = Math.min(next, stage.expiresAt);
    const roomOwner = await this.ctx.storage.get(this.vaultRoomOwnerKey());
    if (roomOwner && Number.isFinite(roomOwner.expiresAt)) next = Math.min(next, roomOwner.expiresAt);
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    await this.queueVault(async () => this.expireVault(Date.now()));
  }
}
