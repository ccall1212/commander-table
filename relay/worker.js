// Commander Table relay: Cloudflare Worker + one Durable Object per room.
// Protocol: docs/relay-protocol.md (v2). The relay is a dumb broker; it never inspects game data.
// Uses the WebSocket Hibernation API, so ALL broker state lives in per-socket attachments:
//   { id: string|null, key: string|null, links: { [lid]: otherPeerId }, dead?: true }

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

function deckApiJson(body, status, origin, maxAge = 0) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
  };
  if (originAllowed(origin)) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

function deckApiTargets(site, action, id) {
  if (action === "deck") {
    if (site === "archidekt" && /^\\d{1,12}$/.test(id || "")) {
      return [{ url: `https://archidekt.com/api/decks/${id}/`, ttl: 1800, site }];
    }
    if (site === "moxfield" && /^[A-Za-z0-9_-]{1,64}$/.test(id || "")) {
      return [
        { url: `https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(id)}`, ttl: 900, site },
        { url: `https://api2.moxfield.com/v2/decks/all/${encodeURIComponent(id)}`, ttl: 900, site },
      ];
    }
  }
  if (action === "search") {
    if (site === "archidekt") {
      return [
        { url: "https://archidekt.com/api/decks/v3/?deckFormat=3&orderBy=-createdAt&pageSize=100", ttl: 300, site },
        { url: "https://archidekt.com/api/decks/v3/?deckFormat=3&orderBy=-updatedAt&pageSize=100", ttl: 300, site },
      ];
    }
    if (site === "moxfield") {
      return [
        { url: "https://api2.moxfield.com/v2/decks/search-sfw?fmt=commander&sortType=updated&sortDirection=descending&pageNumber=1&pageSize=100", ttl: 300, site },
        { url: "https://api2.moxfield.com/v2/decks/search?fmt=commander&sortType=updated&sortDirection=descending&pageNumber=1&pageSize=100", ttl: 300, site },
      ];
    }
  }
  return null;
}

function deckApiHeaders(site) {
  if (site === "moxfield") {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://moxfield.com/",
      Origin: "https://moxfield.com",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
    };
  }
  return {
    "User-Agent": "CommanderTable/0.17 (+https://github.com/ccall1212/commander-table)",
    Accept: "application/json",
  };
}

async function handleDeckApi(request, origin, ctx) {
  if (!originAllowed(origin)) {
    return new Response("Origin not allowed", { status: 403 });
  }
  if (request.method !== "GET") return deckApiJson({ error: "Only GET requests are supported." }, 405, origin);
  const params = new URL(request.url).searchParams;
  const site = params.get("site") || "";
  const action = params.get("action") || "";
  const id = params.get("id") || "";
  const targets = deckApiTargets(site, action, id);
  if (!targets) return deckApiJson({ error: "Unsupported deck source or request." }, 400, origin);

  let lastStatus = 502;
  let sawBlocked = false;
  for (const target of targets) {
    const cache = caches.default;
    const cacheKey = new Request(target.url, { method: "GET" });
    let text = null;
    let cached = false;
    try {
      const hit = await cache.match(cacheKey);
      if (hit) {
        text = await hit.text();
        cached = true;
      }
    } catch (e) {
      // Cache is only an optimization; continue to the provider.
    }
    if (text === null) {
      let upstream;
      try {
        upstream = await fetch(target.url, {
          method: "GET",
          headers: deckApiHeaders(target.site),
          signal: AbortSignal.timeout(10000),
        });
      } catch (e) {
        lastStatus = 502;
        continue;
      }
      if (!upstream.ok) {
        lastStatus = upstream.status;
        if (upstream.status === 401 || upstream.status === 403) sawBlocked = true;
        continue;
      }
      try {
        text = await upstream.text();
        if (text.length > 8 * 1024 * 1024) {
          lastStatus = 502;
          continue;
        }
        JSON.parse(text);
      } catch (e) {
        lastStatus = 502;
        continue;
      }
      try {
        const cachedResponse = new Response(text, {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${target.ttl}` },
        });
        ctx.waitUntil(cache.put(cacheKey, cachedResponse));
      } catch (e) {
        // Cache is only an optimization.
      }
    }
    try {
      return deckApiJson(JSON.parse(text), 200, origin, target.ttl);
    } catch (e) {
      lastStatus = 502;
    }
  }

  const provider = site === "moxfield" ? "Moxfield" : "Archidekt";
  const error = sawBlocked
    ? provider + " blocked or requires authorization for automated access. Use its Copy Plain Text export and the normal deck import."
    : provider + " could not return deck data right now. Try again later or use Copy Plain Text and the normal deck import.";
  return deckApiJson({ error, status: lastStatus, blocked: sawBlocked }, 502, origin);
}

// ---- Worker entry ----------------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const okOrigin = originAllowed(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: okOrigin ? corsHeaders(origin) : {} });
    }

    if (url.pathname === "/health") {
      const headers = { "Content-Type": "application/json" };
      if (okOrigin) Object.assign(headers, corsHeaders(origin));
      return new Response(JSON.stringify({ ok: true, v: VERSION }), { status: 200, headers });
    }

    if (url.pathname === "/deck-api") return handleDeckApi(request, origin, ctx);

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
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.save(server, { id: null, key: null, links: {} });
    try {
      server.send(JSON.stringify({ op: "hello", v: VERSION, server: "cf-relay", maxMsg: MAX_MSG }));
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
}
