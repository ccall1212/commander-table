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
const HOST_ID_PREFIX = "ctable-v1-";
const CLOSED_MS = 24 * 60 * 60 * 1000;
const PRESENCE_MS = 90 * 1000;
const JOIN_MS = 90 * 1000;
const SPECTATE_MS = 20 * 1000;
const SPECTATE_MAX_BYTES = 900000;
// Sync boxes (sync-v1): the browser encrypts a deck collection with a key made from a short code and stores it
// here under an ID made from the same code. The relay only ever holds that unreadable text.
const SYNC_ID_RE = /^[a-f0-9]{32}$/;
const SYNC_MAX_BYTES = 900000; // size of the stored (encrypted, base64) text
const SYNC_CHUNK = 60 * 1024;
const SYNC_TTL_MS = 180 * 24 * 60 * 60 * 1000; // an unused synced copy expires after 180 days
const SYNC_REPLACED_MS = 30 * 24 * 60 * 60 * 1000; // a replaced code keeps saying "replaced" for 30 days
const SYNC_WRITES_PER_HOUR = 60; // saves, replacements and deletes allowed per network address per hour
const SYNC_B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const SPECTATE_CHUNK_BYTES = 60 * 1024;

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
}

async function adminAuthorized(request, env) {
  const secret = env.ADMIN_PASSPHRASE;
  const header = request.headers.get("Authorization") || "";
  if (typeof secret !== "string" || secret.length < 20 || !header.startsWith("Bearer ") || header.length > 512) return false;
  const hash = async value => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const actual = await hash(header.slice(7)), expected = await hash(secret);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

function originAllowed(origin) {
  if (typeof origin !== "string") return false;
  return ALLOWED_ORIGINS.some((o) => (typeof o === "string" ? o === origin : o.test(origin)));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
      return new Response(JSON.stringify({ ok: true, v: VERSION, features: ["room-vault-v1", "admin-directory-v1", "admin-spectate-v1", ...(env.SYNC ? ["sync-v1"] : [])] }), { status: 200, headers });
    }

    if (url.pathname.startsWith("/admin/")) {
      if (origin && !okOrigin) return json({ error: "Origin not allowed" }, 403);
      const headers = okOrigin ? corsHeaders(origin) : {};
      if (!await adminAuthorized(request, env)) return json({ error: "Invalid admin passphrase or admin access is not configured" }, 401, headers);
      if (url.pathname === "/admin/rooms" && request.method === "GET") {
        const response = await env.DIRECTORY.get(env.DIRECTORY.idFromName("global")).fetch("https://internal/rooms");
        return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
      }
      const action = /^\/admin\/rooms\/([A-Za-z2-9]{5})\/(close|join|spectate|join\/([\w-]{1,64}))$/.exec(url.pathname);
      if (!action) return json({ error: "Not found" }, 404, headers);
      const method = action[2] === "close" || action[2] === "join" ? "POST" : "GET";
      if (request.method !== method) return json({ error: "Method not allowed" }, 405, headers);
      const room = action[1].toUpperCase();
      const path = action[2] === "close" ? "/control/close" : action[2] === "join" ? "/control/join"
        : action[2] === "spectate" ? "/control/spectate" : "/control/join/" + action[3];
      const response = await env.ROOMS.get(env.ROOMS.idFromName(room)).fetch("https://internal" + path + "?room=" + room, { method });
      return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
    }

    const sync = /^\/sync\/([^/]+)$/.exec(url.pathname);
    if (sync) return handleSync(request, env, sync[1], url, origin, okOrigin);

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

// ---- Sync boxes (sync-v1) --------------------------------------------------------------------
async function shortHash(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).slice(0, 8), b => b.toString(16).padStart(2, "0")).join("");
}

// GET /sync/<id> reads, PUT stores, DELETE removes (or, with ?mode=replaced, marks the code as replaced).
async function handleSync(request, env, id, url, origin, okOrigin) {
  if (origin && !okOrigin) return json({ error: "Origin not allowed" }, 403);
  const headers = okOrigin ? corsHeaders(origin) : {};
  if (!env.SYNC) return json({ error: "Sync is not available on this server" }, 501, headers);
  if (!SYNC_ID_RE.test(id)) return json({ error: "Not found" }, 404, headers);
  if (!["GET", "PUT", "DELETE"].includes(request.method)) return json({ error: "Method not allowed" }, 405, headers);
  let body;
  if (request.method !== "GET") {
    // A basic limit on how often one network address can write, so the free relay's storage is not filled.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const limiter = env.SYNC.get(env.SYNC.idFromName("limit:" + await shortHash(ip)));
    if ((await limiter.fetch("https://internal/limit", { method: "POST" })).status === 429) return json({ error: "Too many saves from this connection. Try again later." }, 429, headers);
    if (request.method === "PUT") {
      body = await request.text();
      if (body.length > SYNC_MAX_BYTES + 1000) return json({ error: "Too large" }, 413, headers);
    }
  }
  const mode = request.method === "DELETE" && url.searchParams.get("mode") === "replaced" ? "?mode=replaced" : "";
  const response = await env.SYNC.get(env.SYNC.idFromName("box:" + id)).fetch("https://internal/box" + mode, { method: request.method, body });
  return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
}

// One Durable Object per sync box ("box:<id>"), and one per network address for the write limit ("limit:<hash>").
export class SyncBox extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/limit" && request.method === "POST") return this.limit();
    if (url.pathname !== "/box") return json({ error: "Not found" }, 404);
    if (request.method === "GET") return this.read();
    if (request.method === "PUT") return this.write(await request.text());
    if (request.method === "DELETE") return this.remove(url.searchParams.get("mode") === "replaced");
    return json({ error: "Method not allowed" }, 405);
  }

  async limit() {
    const now = Date.now();
    let win = await this.ctx.storage.get("window");
    if (!win || now - win.start >= 60 * 60 * 1000) win = { start: now, count: 0 };
    win.count++;
    await this.ctx.storage.put({ window: win, exp: win.start + 2 * 60 * 60 * 1000 });
    await this.ctx.storage.setAlarm(win.start + 2 * 60 * 60 * 1000);
    return win.count > SYNC_WRITES_PER_HOUR ? json({ error: "limit" }, 429) : json({ ok: true });
  }

  async touch(ms) {
    const exp = Date.now() + ms;
    await this.ctx.storage.put("exp", exp);
    await this.ctx.storage.setAlarm(exp);
    return exp;
  }

  async chunks(meta) {
    const keys = Array.from({ length: meta.chunks }, (_, i) => "c:" + i);
    const parts = await this.ctx.storage.get(keys);
    return keys.map(k => parts.get(k));
  }

  async read() {
    const meta = await this.ctx.storage.get("meta");
    if (!meta) return json({ error: "not-found" }, 404);
    if (meta.replaced) return json({ error: "replaced" }, 410);
    const parts = await this.chunks(meta);
    if (parts.some(p => typeof p !== "string")) return json({ error: "not-found" }, 404);
    await this.touch(SYNC_TTL_MS); // a copy that is still being used does not expire
    return json({ v: 1, c: meta.c, iv: meta.iv, ct: parts.join(""), updatedAt: meta.updatedAt });
  }

  async write(text) {
    let value;
    try { value = JSON.parse(text); } catch (_) { return json({ error: "Invalid body" }, 400); }
    if (!value || typeof value !== "object" || value.v !== 1 || !["gzip", "none"].includes(value.c)
      || typeof value.iv !== "string" || value.iv.length < 8 || value.iv.length > 40 || !SYNC_B64_RE.test(value.iv)
      || typeof value.ct !== "string" || !value.ct.length || value.ct.length > SYNC_MAX_BYTES || !SYNC_B64_RE.test(value.ct)) {
      return json({ error: "Invalid body" }, 400);
    }
    const old = await this.ctx.storage.get("meta");
    if (old && old.replaced) return json({ error: "replaced" }, 410);
    const entries = {};
    const chunks = Math.ceil(value.ct.length / SYNC_CHUNK);
    for (let i = 0; i < chunks; i++) entries["c:" + i] = value.ct.slice(i * SYNC_CHUNK, (i + 1) * SYNC_CHUNK);
    const updatedAt = Date.now();
    await this.ctx.storage.put(entries);
    await this.ctx.storage.put("meta", { c: value.c, iv: value.iv, chunks, bytes: value.ct.length, updatedAt });
    if (old && old.chunks > chunks) await this.ctx.storage.delete(Array.from({ length: old.chunks - chunks }, (_, i) => "c:" + (chunks + i)));
    await this.touch(SYNC_TTL_MS);
    return json({ ok: true, updatedAt, bytes: value.ct.length });
  }

  async remove(replaced) {
    if (replaced) {
      // Keep only a marker, so a computer still using the old code is told it was replaced.
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.put("meta", { replaced: true, at: Date.now() });
      await this.touch(SYNC_REPLACED_MS);
    } else {
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
    }
    return json({ ok: true });
  }

  async alarm() {
    const exp = await this.ctx.storage.get("exp");
    if (!exp || exp <= Date.now()) await this.ctx.storage.deleteAll();
    else await this.ctx.storage.setAlarm(exp);
  }
}

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

  directory(method, data) {
    const room = data.room;
    return this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName("global")).fetch("https://internal/rooms/" + room, {
      method, body: method === "POST" ? JSON.stringify(data) : undefined,
    });
  }

  hostSocket() {
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.att(ws);
      if (!a.dead && a.room && a.id === HOST_ID_PREFIX + a.room.toLowerCase()) return ws;
    }
    return null;
  }

  async adminControl(request, path) {
    if (path === "/control/spectate" && request.method === "GET") {
      if ((await this.ctx.storage.get("admin:closedUntil") || 0) > Date.now()) return json({ error: "Room closed" }, 410);
      const host = this.hostSocket();
      if (!host) return json({ error: "Host is not connected through the relay" }, 409);
      if (!this.send(host, { op: "admin-snapshot-request" })) return json({ error: "Host disconnected" }, 409);
      const meta = await this.ctx.storage.get("admin:snapshot:meta");
      if (!meta || meta.generation !== this.att(host).generation || meta.updatedAt < Date.now() - SPECTATE_MS) return json({ status: "waiting" }, 202);
      const chunks = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => this.ctx.storage.get(`admin:snapshot:${meta.rev}:${i}`)));
      if (chunks.some(chunk => !(chunk instanceof Uint8Array))) return json({ status: "waiting" }, 202);
      const bytes = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.byteLength, 0));
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new Response(bytes, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (path === "/control/close" && request.method === "POST") {
      const until = Date.now() + CLOSED_MS;
      await this.ctx.storage.put("admin:closedUntil", until);
      const room = new URL(request.url).searchParams.get("room");
      if (room && ROOM_RE.test(room)) await this.directory("DELETE", { room });
      for (const ws of this.ctx.getWebSockets()) {
        this.send(ws, { op: "err", type: "room-closed", message: "This game was closed by the site admin" });
        this.drop(ws, 1008, "room closed");
      }
      return json({ ok: true, closedUntil: until });
    }
    if (path === "/control/join" && request.method === "POST") {
      const host = this.hostSocket();
      if (!host) return json({ error: "Host is not connected through the relay" }, 409);
      const prior = await this.ctx.storage.get("admin:join:active");
      if (prior && prior.status === "pending" && prior.expires > Date.now()) return json({ error: "The host already has a pending admin join request" }, 409);
      const id = crypto.randomUUID(), expires = Date.now() + JOIN_MS;
      await this.ctx.storage.put("admin:join:active", { id, status: "pending", expires });
      if (!this.send(host, { op: "admin-join-request", id })) return json({ error: "Host disconnected" }, 409);
      return json({ id, status: "pending", expires });
    }
    const match = /^\/control\/join\/([\w-]{1,64})$/.exec(path);
    if (match && request.method === "GET") {
      const entry = await this.ctx.storage.get("admin:join:active");
      if (!entry || entry.id !== match[1] || entry.expires < Date.now()) return json({ status: "expired" }, 404);
      return json({ status: entry.status });
    }
    return json({ error: "Not found" }, 404);
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/control/")) return this.adminControl(request, path);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    if ((await this.ctx.storage.get("admin:closedUntil") || 0) > Date.now()) return new Response("Room closed", { status: 410 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const room = (new URL(request.url).pathname.match(/^\/room\/([^/]+)$/) || [])[1];
    this.save(server, { room: room ? room.toUpperCase() : null, id: null, key: null, links: {} });
    try {
      server.send(JSON.stringify({ op: "hello", v: VERSION, server: "cf-relay", maxMsg: MAX_MSG, features: ["room-vault-v1", "admin-directory-v1", "admin-spectate-v1"] }));
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
    const wasHost = !!a.room && a.id === HOST_ID_PREFIX + a.room.toLowerCase();
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
    if (wasHost && !wasDead && reason !== "replaced") this.ctx.waitUntil(this.directory("DELETE", { room: a.room }));
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
      case "admin-presence":
        await this.onAdminPresence(ws, msg);
        break;
      case "admin-join-decision":
        await this.onAdminJoinDecision(ws, msg);
        break;
      case "admin-public-snapshot":
        await this.onAdminSnapshot(ws, msg);
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

  async onAdminPresence(ws, msg) {
    const a = this.att(ws);
    if (!a.room || a.id !== HOST_ID_PREFIX + a.room.toLowerCase()) return;
    const cleanName = value => typeof value === "string" ? value.trim().slice(0, 50) : "";
    const players = Array.isArray(msg.players) ? msg.players.slice(0, 6).map(p => ({
      name: cleanName(p && p.name), connected: !!(p && p.connected),
    })).filter(p => p.name) : [];
    await this.directory("POST", { room: a.room, host: cleanName(msg.host), players, started: !!msg.started, updatedAt: Date.now() });
  }

  async onAdminJoinDecision(ws, msg) {
    if (ws !== this.hostSocket() || typeof msg.id !== "string" || !/^[\w-]{1,64}$/.test(msg.id) || typeof msg.allow !== "boolean") return;
    const entry = await this.ctx.storage.get("admin:join:active");
    if (!entry || entry.id !== msg.id || entry.status !== "pending" || entry.expires < Date.now()) return;
    await this.ctx.storage.put("admin:join:active", { ...entry, status: msg.allow ? "approved" : "declined" });
  }

  async onAdminSnapshot(ws, msg) {
    if (ws !== this.hostSocket() || !msg.snapshot || typeof msg.snapshot !== "object") return;
    const input = msg.snapshot, table = input.table;
    if (!table || table.room !== this.att(ws).room || !Array.isArray(table.seats) || table.seats.length > 6 || !input.players || typeof input.players !== "object") return;
    // Allow only the same public player fields shared with ordinary opponents. Never copy
    // private-board backups, deck contents, or unrecognized fields into the admin response.
    const players = {};
    for (const pid of table.seats) {
      const p = input.players[pid];
      if (!p || p.pid !== pid || !p.zones) continue;
      const zones = Object.fromEntries(["battlefield", "graveyard", "exile", "command"].map(k => [k, Array.isArray(p.zones[k]) ? p.zones[k] : []]));
      const revHand = Array.isArray(p.revHand) ? p.revHand : null;
      const revCards = Array.isArray(p.revCards) ? p.revCards : [];
      const revTop = Array.isArray(p.revTop) ? p.revTop : null;
      const visibleIds = new Set([...Object.values(zones).flat(), ...(revHand || []), ...revCards, ...(revTop || [])].map(c => c && c.id).filter(Boolean));
      const defs = Object.fromEntries([...visibleIds].filter(id => p.defs && Object.hasOwn(p.defs, id)).map(id => [id, p.defs[id]]));
      players[pid] = { pid, name: p.name, bw: p.bw, appearance: p.appearance, life: p.life, poison: p.poison,
        ctr: p.ctr, cmdDmg: p.cmdDmg, casts: p.casts, cmdrs: p.cmdrs, hand: p.hand, lib: p.lib,
        openingDeal: p.openingDeal, kept: p.kept, mullCount: p.mullCount, layout: p.layout, bh: p.bh,
        zones, revHand, revCards, revTop, defs };
    }
    const snapshot = { table, players, online: input.online, log: Array.isArray(input.log) ? input.log.slice(-100) : [],
      chat: Array.isArray(input.chat) ? input.chat.slice(-100) : [], arrows: Array.isArray(input.arrows) ? input.arrows.slice(0, 100) : [], updatedAt: Date.now() };
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    if (bytes.byteLength > SPECTATE_MAX_BYTES) return;
    const previous = await this.ctx.storage.get("admin:snapshot:meta");
    const rev = crypto.randomUUID(), chunks = Math.ceil(bytes.byteLength / SPECTATE_CHUNK_BYTES);
    for (let i = 0; i < chunks; i++) await this.ctx.storage.put(`admin:snapshot:${rev}:${i}`, bytes.slice(i * SPECTATE_CHUNK_BYTES, (i + 1) * SPECTATE_CHUNK_BYTES));
    await this.ctx.storage.put("admin:snapshot:meta", { rev, chunks, generation: this.att(ws).generation, updatedAt: snapshot.updatedAt, expiresAt: Date.now() + 60 * 1000 });
    if (previous) await this.deleteAdminSnapshot(previous);
    await this.scheduleVaultAlarm();
  }

  async deleteAdminSnapshot(meta) {
    if (!meta || typeof meta.rev !== "string" || !Number.isInteger(meta.chunks)) return;
    await this.ctx.storage.delete(Array.from({ length: Math.min(meta.chunks, 20) }, (_, i) => `admin:snapshot:${meta.rev}:${i}`));
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
    fresh.generation = crypto.randomUUID();
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
    const adminSnapshot = await this.ctx.storage.get("admin:snapshot:meta");
    if (adminSnapshot && adminSnapshot.expiresAt <= now) {
      await this.ctx.storage.delete("admin:snapshot:meta");
      await this.deleteAdminSnapshot(adminSnapshot);
    }
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
    const adminSnapshot = await this.ctx.storage.get("admin:snapshot:meta");
    if (adminSnapshot && Number.isFinite(adminSnapshot.expiresAt)) next = Math.min(next, adminSnapshot.expiresAt);
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    await this.queueVault(async () => this.expireVault(Date.now()));
  }
}

// The only cross-room state. It receives limited host-published metadata, never cards or hands.
export class RoomDirectory extends DurableObject {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/rooms" && request.method === "GET") {
      const entries = await this.ctx.storage.list({ prefix: "room:" });
      const now = Date.now(), rooms = [];
      for (const [key, value] of entries) {
        if (value.updatedAt > now - PRESENCE_MS) rooms.push(value);
        else await this.ctx.storage.delete(key);
      }
      rooms.sort((a, b) => b.updatedAt - a.updatedAt);
      return json({ rooms, count: rooms.length });
    }
    const match = /^\/rooms\/([A-Za-z2-9]{5})$/.exec(path);
    if (!match) return json({ error: "Not found" }, 404);
    const key = "room:" + match[1].toUpperCase();
    if (request.method === "DELETE") { await this.ctx.storage.delete(key); return json({ ok: true }); }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const entry = await request.json();
    if (entry.room !== match[1].toUpperCase()) return json({ error: "Room mismatch" }, 400);
    await this.ctx.storage.put(key, entry);
    return json({ ok: true });
  }
}
