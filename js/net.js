/* net.js - self-healing PeerJS star network for Commander Table.
 *
 * Exposes exactly one global: window.Net
 *   Net.start({role, room, pid, onMessage, onStatus, onJoin, onLeave})
 *   Net.send(msg) / Net.sendTo(pid, msg) / Net.peers() / Net.state() / Net.stop() / Net.makeRoomCode()
 *
 * Design: every Net.start() builds an isolated "session" closure holding all state
 * (peer, connections, timers). Net.stop() / a new Net.start() shuts the old session
 * down (sets `dead`), and every async callback checks `dead` / object identity so
 * stale events from an old Peer or DataConnection can never touch the new one.
 *
 * Reliability model: WebRTC 'close' events are unreliable, so a heartbeat ({t:'_hb'}
 * every 2.5s, 9s silence = dead) is the real failure detector. The client retries
 * forever (1s, 2s, 4s, then every 5s); the host reclaims its room id forever.
 */
(function () {
  'use strict';

  var HB_INTERVAL = 2500;        // send heartbeat every 2.5s
  var HB_TIMEOUT = 9000;         // no data for 9s => connection dead
  var HIDDEN_TIMEOUT = 120000;   // ...but allow 2 min when the other side's tab is in the background
  var WATCHDOG_INTERVAL = 1000;  // how often we check for heartbeat timeouts
  var CONNECT_TIMEOUT = 20000;   // abandon a connect attempt that has not opened by then (relayed links can be slow)
  var HOST_RETRY = 3000;         // host: retry creating Peer / reconnecting signalling
  var SIG_RETRY = 3000;          // retry peer.reconnect() while signalling is down
  var MAX_QUEUE = 200;           // client offline send queue cap
  var SNAPSHOT_TYPES = { pub: true }; // only the most recent of these is kept in the queue
  var ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars
  var ID_PREFIX = 'ctable-v1-';
  var QUEUE_MAX_AGE = 20000;     // actions queued while offline are dropped (not replayed) after 20s
  var NOT_FOUND_SWITCH = 4;      // auto mode: after 4 "room not found" in a row, try the other route
  var NOT_FOUND_SLOW = 60000;    // after 60s of "room not found", say so plainly
  var TAB_ID = Math.random().toString(36).slice(2, 10); // this page load (spots a game open in two tabs)

  // Connection route ("transport"):
  //   'relay' - WebSocket to the Cloudflare relay (js/relay-peer.js); works through firewalls
  //   'p2p'   - PeerJS / WebRTC directly between browsers (needs a network that allows it)
  //   'lan'   - the LAN server this page was loaded from (window.Peer is LanPeer)
  // js/net-config.js sets window.CT_NET = {relayUrl, mode: 'auto'|'relay'|'p2p'};
  // ?net=relay|p2p in the page URL overrides the mode (handy for testing).
  function netConfig() {
    var c = window.CT_NET || {};
    var mode = c.mode || 'auto';
    var relayUrl = c.relayUrl || '';
    try {
      var qs = new URLSearchParams(location.search);
      if (qs.get('net')) mode = qs.get('net');
      // Testing only: ?relay=<url> points a page opened from this computer at another relay.
      if (qs.get('relay') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) relayUrl = qs.get('relay');
    } catch (_) { /* ignore */ }
    return { relayUrl: String(relayUrl).replace(/\/+$/, ''), mode: mode };
  }
  function hasPeerJS() { return typeof Peer === 'function' && Peer !== window.LanPeer; }
  function hasRelay(nc) { return !!nc.relayUrl && typeof window.RelayPeer === 'function'; }

  function log() {
    try {
      var a = Array.prototype.slice.call(arguments);
      a.unshift('[net]');
      console.debug.apply(console, a);
    } catch (_) { /* ignore */ }
  }

  // ICE servers: public STUN plus any relay (TURN) servers from js/turn-config.js.
  // PeerJS's built-in TURN servers are replaced on purpose: they are unreachable and
  // only slow the connection down.
  function relayServers() {
    var list = Array.isArray(window.CT_TURN) ? window.CT_TURN : [];
    return list.filter(function (s) {
      return s && s.urls && s.username && s.credential && !/PASTE_/.test(s.username + s.credential);
    });
  }
  function peerOptions() {
    var ice = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
    return { config: { iceServers: ice.concat(relayServers()) } };
  }

  function closeConn(conn) {
    try { conn.close(); } catch (_) { /* ignore */ }
  }

  var current = null;        // active session or null
  var lastCfg = null;        // config of last Net.start (for bfcache restore)
  var suspended = false;     // true between pagehide and pageshow
  var fallbackState = 'offline'; // state reported when there is no session

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------
  function createSession(cfg) {
    var isHost = cfg.role === 'host';
    var room = String(cfg.room).toLowerCase();
    var hostId = ID_PREFIX + room;

    var dead = false;
    var state = 'connecting';
    var lastText = null;
    var code = 'init';           // finer-grained stage / failure reason, see setStatus

    // Pick the route. 'auto' prefers the relay and falls back to direct PeerJS if the relay
    // can't be reached (and, for clients, alternates if the host can't be found on one route).
    var nc = netConfig();
    var auto = false;
    var transport;
    if (window.CT_LAN && typeof Peer === 'function') transport = 'lan';
    else if (nc.mode === 'p2p' || !hasRelay(nc)) transport = 'p2p';
    else if (nc.mode === 'relay' || !hasPeerJS()) transport = 'relay';
    else { transport = 'relay'; auto = true; }
    var notFound = 0;            // client: consecutive "room not found" answers
    var notFoundSince = 0;
    var sid = TAB_ID + Math.random().toString(36).slice(2, 6); // id prefix for messages we send
    var outSeq = 0;
    var seen = {};               // sender -> Map of recent message ids (drops duplicates)

    var peer = null;
    var hbTimer = null, wdTimer = null, sigTimer = null;
    var peerRetryTimer = null;   // host: recreate-peer timer
    var retryTimer = null;       // client: next connect attempt timer

    // host state
    var conns = new Map();       // pid -> rec (open, current connections)
    var pending = new Set();     // recs not yet open

    // client state
    var cconn = null;            // rec of the open connection to host
    var inflight = null;         // rec of the connect attempt in progress
    var fails = 0;               // consecutive failures (drives backoff)
    var tries = 0;               // connect attempts since last online
    var waits = 0;               // consecutive "waiting for signalling" ticks
    var everOnline = false;
    var queue = [];

    // ---- helpers ------------------------------------------------------------
    function safeCall(fn) {
      if (typeof fn !== 'function') return;
      var args = Array.prototype.slice.call(arguments, 1);
      try { fn.apply(null, args); } catch (e) { console.error('[net] callback error', e); }
    }

    // state: 'connecting' | 'online' | 'reconnecting' | 'error' (what the UI pill shows)
    // code:  'init' | 'waiting-host' | 'connecting' | 'connected' | 'recovering' | 'room-not-found'
    //        | 'signaling' | 'ice' | 'timeout' | 'host-left' | 'id-taken' | 'replaced' | 'room-full'
    function setStatus(s, text, c) {
      if (dead) return;
      c = c || code;
      if (s === state && text === lastText && c === code) return;
      state = s;
      lastText = text;
      code = c;
      log('status', s, c, text, '[' + transport + ']');
      safeCall(cfg.onStatus, s, text, c, transport);
    }

    function makePeer(id) {
      if (transport === 'relay') {
        return new window.RelayPeer(id || null, {
          url: nc.relayUrl.replace(/^http/, 'ws') + '/room/' + room.toUpperCase(),
          key: cfg.key || null, label: 'relay'
        });
      }
      if (transport === 'lan') return new Peer(id || null, { key: cfg.key || null });
      return id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    }
    // Auto mode: switch between relay and direct. Returns true if it switched.
    function switchTransport(why) {
      if (!auto) return false;
      var next = transport === 'relay' ? 'p2p' : 'relay';
      if (next === 'p2p' && !hasPeerJS()) return false;
      log('switching route', transport, '->', next, '(' + why + ')');
      transport = next;
      return true;
    }
    function routeName() { return transport === 'relay' ? 'relay' : transport === 'lan' ? 'LAN server' : 'direct connection'; }
    function isSignalingError(type) {
      return type === 'server-error' || type === 'network' || type === 'socket-error' || type === 'socket-closed';
    }

    // PeerJS's JSON channel rejects any single message over ~16 KB (and then drops the
    // connection). Big messages — a table snapshot, a full Commander board — are split into
    // chunks of CHUNK characters (<= 3 bytes each after encoding/escaping => well under the cap).
    var CHUNK = 4000;
    var DIRECT_MAX_BYTES = 15000;
    var chunkSeq = 0;
    var chunkBufs = {};
    var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    function byteLen(s) { return enc ? enc.encode(s).length : s.length * 3; }

    // The relay / LAN server accept much bigger frames than PeerJS (peer.maxMsg, from its hello).
    function sizeLimits() {
      var mm = peer && peer.maxMsg;
      if (mm && mm > 50000) {
        var direct = Math.min(mm - 4000, 900000);
        return { direct: direct, chunk: Math.floor(direct / 3) };
      }
      return { direct: DIRECT_MAX_BYTES, chunk: CHUNK };
    }

    // Send on a rec ({conn, lost}). Returns true on success; never throws.
    function rawSend(rec, msg) {
      if (!rec || rec.lost) return false;
      try {
        if (!rec.conn.open) return false;
        var s = JSON.stringify(msg);
        var lim = sizeLimits();
        if (byteLen(s) <= lim.direct) { rec.conn.send(msg); return true; }
        var id = (++chunkSeq).toString(36) + Date.now().toString(36);
        var n = Math.ceil(s.length / lim.chunk);
        for (var i = 0; i < n; i++) rec.conn.send({ t: '_ck', id: id, i: i, n: n, d: s.slice(i * lim.chunk, (i + 1) * lim.chunk) });
        return true;
      } catch (e) {
        log('send failed', e);
        return false;
      }
    }
    function dropStaleChunks() {
      var now = Date.now();
      Object.keys(chunkBufs).forEach(function (k) { if (now - chunkBufs[k].at > 60000) delete chunkBufs[k]; });
    }

    // Send; on failure mark the connection dead.
    function sendOrKill(rec, msg) {
      if (rawSend(rec, msg)) return true;
      if (isHost) hostConnLost(rec); else clientConnLost(rec, 'send failed');
      return false;
    }

    // Incoming application data, after heartbeat bookkeeping.
    function handleData(d, fromPid) {
      if (dead) return;
      if (!d || typeof d !== 'object' || typeof d.t !== 'string') return;
      if (d.t === '_ck') { // a piece of a chunked message: reassemble, then handle the whole
        if (typeof d.id !== 'string' || typeof d.d !== 'string' || !(d.n > 0) || d.n > 5000 || !(d.i >= 0) || d.i >= d.n) return;
        var key = fromPid + '|' + d.id;
        var b = chunkBufs[key] || (chunkBufs[key] = { n: d.n, got: 0, parts: [], at: Date.now() });
        if (b.parts[d.i] == null) { b.parts[d.i] = d.d; b.got++; }
        if (b.got < b.n) return;
        delete chunkBufs[key];
        var full;
        try { full = JSON.parse(b.parts.join('')); } catch (e) { log('bad chunked message', e); return; }
        handleData(full, fromPid);
        return;
      }
      if (d.t === '_dup' && !isHost) { // the host saw this game open in another tab too
        fatal('This game was opened in another tab or window — carry on there.', 'replaced');
        return;
      }
      if (d.t.charAt(0) === '_') return; // internal (heartbeat etc.)
      if (typeof d._i === 'string') {     // drop anything we've already handled from this sender
        var m = seen[fromPid] || (seen[fromPid] = new Map());
        if (m.has(d._i)) { log('duplicate message dropped', d.t, d._i); return; }
        m.set(d._i, 1);
        if (m.size > 2000) m.delete(m.keys().next().value);
      }
      safeCall(cfg.onMessage, d, fromPid);
    }

    // Every app message gets a unique id so a receiver can ignore a repeat.
    function stamp(msg) {
      var o = {};
      for (var k in msg) if (Object.prototype.hasOwnProperty.call(msg, k)) o[k] = msg[k];
      o._i = sid + (++outSeq).toString(36);
      return o;
    }

    // Reconnect to the signalling server if it has dropped (peer stays alive).
    function sigReconnect() {
      var p = peer;
      if (dead || !p) return;
      try {
        if (p.disconnected && !p.destroyed) {
          log('peer.reconnect()');
          p.reconnect();
        }
      } catch (e) { log('reconnect threw', e); }
    }

    function destroyPeer() {
      var p = peer;
      peer = null;
      if (p) { try { p.destroy(); } catch (_) { /* ignore */ } }
    }

    // Unrecoverable (e.g. browser lacks WebRTC): report and halt all retrying.
    function fatal(text, c) {
      setStatus('error', text, c);
      shutdown(true);
    }

    // ---- shared timers ------------------------------------------------------
    function heartbeatTick() {
      if (dead) return;
      // h = "my tab is hidden": the other side then tolerates late heartbeats, because
      // browsers throttle timers in background tabs (players alt-tabbing to Discord etc).
      var hb = { t: '_hb', h: document.hidden ? 1 : 0 };
      if (isHost) {
        Array.from(conns.values()).forEach(function (rec) { sendOrKill(rec, hb); });
      } else if (cconn) {
        sendOrKill(cconn, hb);
      }
    }

    function watchdogTick() {
      if (dead) return;
      dropStaleChunks();
      var now = Date.now();
      if (isHost) {
        Array.from(conns.values()).forEach(function (rec) {
          if (now - rec.last > (rec.hidden ? HIDDEN_TIMEOUT : HB_TIMEOUT)) {
            log('heartbeat timeout', rec.pid);
            hostConnLost(rec);
          }
        });
      } else if (cconn && now - cconn.last > (cconn.hidden ? HIDDEN_TIMEOUT : HB_TIMEOUT)) {
        log('heartbeat timeout (host)');
        clientConnLost(cconn, 'heartbeat timeout');
      }
    }

    // ---- HOST ---------------------------------------------------------------
    var idTakenSince = 0;
    function hostStartPeer() {
      if (dead) return;
      clearTimeout(peerRetryTimer);
      peerRetryTimer = null;
      destroyPeer();

      var p;
      try {
        p = makePeer(hostId);
      } catch (e) {
        log('new Peer threw', e);
        hostPeerGone('Could not start host — retrying…', HOST_RETRY, 'signaling');
        return;
      }
      peer = p;

      p.on('open', function (id) {
        if (dead || p !== peer) return;
        log('host peer open', id, '[' + transport + ']');
        idTakenSince = 0;
        setStatus('online', 'Hosting room ' + room.toUpperCase() + ' (' + routeName() + ')', 'connected');
      });

      p.on('connection', function (conn) {
        if (dead || p !== peer) { closeConn(conn); return; }
        hostOnConnection(conn);
      });

      p.on('disconnected', function () {
        if (dead || p !== peer) return;
        log('host signalling disconnected');
        setStatus('reconnecting', transport === 'p2p'
          ? 'Signalling lost — reconnecting (players stay connected)…'
          : 'Lost the ' + routeName() + ' — reconnecting; players will rejoin automatically…', 'recovering');
        sigReconnect();
      });

      p.on('close', function () {
        if (dead || p !== peer) return;
        hostPeerGone('Network session closed — restarting…', 1000, 'recovering');
      });

      p.on('error', function (err) {
        var type = err && err.type;
        log('host peer error', type, err && err.message);
        if (dead || p !== peer) return;
        if (type === 'browser-incompatible') { fatal('This browser does not support WebRTC', 'signaling'); return; }
        if (type === 'replaced') { fatal('This game was opened in another tab or window — carry on there.', 'replaced'); return; }
        if (type === 'peer-unavailable' || type === 'webrtc' || type === 'disconnected') return;
        if (type === 'unavailable-id') {
          // Old registration still held by the signalling server (e.g. after reload), or
          // somebody else is using this room code.
          if (!idTakenSince) idTakenSince = Date.now();
          hostPeerGone(Date.now() - idTakenSince > 30000
            ? 'Room code ' + room.toUpperCase() + ' still looks taken — if this keeps up, start a new game from the lobby. Retrying…'
            : 'Reclaiming room code…', HOST_RETRY, 'id-taken');
          return;
        }
        if (isSignalingError(type) && !p.open && switchTransport(type)) {
          hostPeerGone('Couldn\'t reach the relay — trying a direct connection…', 300, 'signaling');
          return;
        }
        // PeerJS destroys the peer itself for errors before it ever opened; after that
        // it merely disconnects, which the 'disconnected' handler repairs.
        if (p.destroyed) hostPeerGone('Network error (' + type + ') — restarting…', 1000, 'signaling');
      });
    }

    // The Peer is gone: drop everything and schedule a fresh Peer with the same id.
    function hostPeerGone(text, delay, c) {
      if (dead) return;
      destroyPeer();
      hostDropAll();
      setStatus('reconnecting', text, c || 'recovering');
      clearTimeout(peerRetryTimer);
      peerRetryTimer = setTimeout(function () {
        peerRetryTimer = null;
        hostStartPeer();
      }, delay);
    }

    function hostDropAll() {
      pending.forEach(function (rec) { hostConnLost(rec); });
      Array.from(conns.values()).forEach(function (rec) { hostConnLost(rec); });
    }

    function hostOnConnection(conn) {
      var meta = conn.metadata;
      var pid = meta && typeof meta.pid === 'string' ? meta.pid : '';
      if (!pid) {
        log('rejecting connection without pid');
        closeConn(conn);
        return;
      }
      var rec = { conn: conn, pid: pid, last: Date.now(), opened: false, lost: false, timer: null };
      pending.add(rec);
      rec.timer = setTimeout(function () {
        if (!rec.opened) { log('incoming connection never opened', pid); hostConnLost(rec); }
      }, CONNECT_TIMEOUT);

      function onOpen() {
        if (dead || rec.lost || rec.opened) return;
        rec.opened = true;
        clearTimeout(rec.timer);
        pending.delete(rec);
        rec.last = Date.now();
        var old = conns.get(pid);
        conns.set(pid, rec);
        if (old) {
          // Replaced by a newer connection from the same player. If it came from a different
          // tab (same game open twice), tell the old tab to stand down instead of fighting.
          var oldTab = old.conn.metadata && old.conn.metadata.tab;
          var newTab = meta && meta.tab;
          if (oldTab && newTab && oldTab !== newTab) rawSend(old, { t: '_dup' });
          old.lost = true;
          clearTimeout(old.timer);
          closeConn(old.conn);
        }
        log('join', pid, old ? '(replaced older connection)' : '');
        safeCall(cfg.onJoin, pid);
      }

      conn.on('open', onOpen);
      conn.on('data', function (d) {
        rec.last = Date.now();
        if (d && d.t === '_hb') rec.hidden = !!d.h;
        if (rec.lost || !rec.opened) return;
        handleData(d, pid);
      });
      conn.on('close', function () { hostConnLost(rec); });
      conn.on('error', function (e) { log('conn error', pid, e); hostConnLost(rec); });
      if (conn.open) onOpen();
    }

    // Connection closed / errored / timed out. onLeave fires once, and only if this
    // is still the current connection for that pid (not a silent replacement).
    function hostConnLost(rec) {
      if (rec.lost) return;
      rec.lost = true;
      clearTimeout(rec.timer);
      pending.delete(rec);
      closeConn(rec.conn);
      if (conns.get(rec.pid) === rec) {
        conns.delete(rec.pid);
        log('leave', rec.pid);
        if (!dead) safeCall(cfg.onLeave, rec.pid);
      }
    }

    // ---- CLIENT -------------------------------------------------------------
    function clientNewPeer() {
      destroyPeer();
      var p;
      try {
        p = makePeer(null);
      } catch (e) {
        log('new Peer threw', e);
        clientFail('Could not start network', false, 'signaling');
        return;
      }
      peer = p;
      waits = 0;

      p.on('open', function (id) {
        if (dead || p !== peer) return;
        log('client peer open', id, '[' + transport + ']');
        waits = 0;
        if (!cconn) clientConnect();
      });

      p.on('disconnected', function () {
        if (dead || p !== peer) return;
        log('client signalling disconnected');
        sigReconnect(); // existing data connection (if any) keeps working
      });

      p.on('close', function () {
        if (dead || p !== peer) return;
        clientPeerGone('Network session closed', 'recovering');
      });

      p.on('error', function (err) {
        var type = err && err.type;
        if (dead || p !== peer) return;
        if (type === 'peer-unavailable') {
          // Normal: host not there yet (or reloading). Fail the attempt quietly.
          log('host not found yet');
          if (inflight) clientConnLost(inflight, 'peer-unavailable');
          return;
        }
        log('client peer error', type, err && err.message);
        if (type === 'browser-incompatible') { fatal('This browser does not support WebRTC', 'signaling'); return; }
        if (type === 'room-full') { fatal('Room ' + room.toUpperCase() + ' is full.', 'room-full'); return; }
        if (type === 'replaced') { fatal('This game was opened in another tab or window — carry on there.', 'replaced'); return; }
        if (type === 'webrtc' || type === 'disconnected' || type === 'negotiation-failed') return;
        if (isSignalingError(type) && !p.open && switchTransport(type)) {
          clientPeerGone('Couldn\'t reach the relay — trying a direct connection', 'signaling');
          return;
        }
        if (p.destroyed) clientPeerGone(isSignalingError(type)
          ? 'Can\'t reach the ' + (transport === 'p2p' ? 'matchmaking server' : routeName()) + ' (' + type + ')'
          : 'Network error (' + type + ')', 'signaling');
        // otherwise PeerJS only disconnected from signalling; sigReconnect handles it
      });
    }

    function clientPeerGone(reason, c) {
      if (dead) return;
      destroyPeer();
      if (inflight) clientConnLost(inflight, 'peer gone');
      if (cconn) clientConnLost(cconn, 'peer gone');
      clientFail(reason, false, c); // no-op if the losses above already scheduled a retry
    }

    // Schedule the next attempt with backoff 1s, 2s, 4s, then 5s forever.
    function clientFail(reason, fromOnline, c) {
      if (dead) return;
      if (fromOnline) { fails = 0; tries = 0; }
      if (retryTimer) return; // already scheduled
      fails++;
      var delay = fails <= 3 ? 1000 * Math.pow(2, fails - 1) : 5000;
      // Never been in: still "connecting" (e.g. waiting for the host); was in: "reconnecting".
      setStatus(everOnline ? 'reconnecting' : 'connecting', reason + ' — retrying (attempt ' + (tries + 1) + ')…', c || 'recovering');
      retryTimer = setTimeout(function () {
        retryTimer = null;
        clientConnect();
      }, delay);
    }

    // Wait (without counting a failed attempt) for the Peer to become usable.
    function clientWait(text, delay) {
      if (dead || retryTimer) return;
      setStatus(everOnline ? 'reconnecting' : 'connecting', text, everOnline ? 'recovering' : 'connecting');
      retryTimer = setTimeout(function () {
        retryTimer = null;
        clientConnect();
      }, delay);
    }

    // Idempotent: only one connect attempt in flight, none while connected.
    function clientConnect() {
      if (dead || cconn || inflight) return;
      clearTimeout(retryTimer);
      retryTimer = null;

      var p = peer;
      if (!p) {
        clientNewPeer();
        if (peer) clientWait('Connecting to network…', 1000); // 'open' will preempt this
        return;
      }
      if (!p.open) {
        // Still opening, or signalling is down and being reconnected.
        if (++waits > 10) { clientPeerGone('Can\'t reach the ' + (transport === 'p2p' ? 'matchmaking server' : routeName()), 'signaling'); return; }
        if (p.disconnected) sigReconnect();
        clientWait('Reaching the ' + (transport === 'p2p' ? 'matchmaking server' : routeName()) + '…', 1000);
        return;
      }

      tries++;
      var conn = null;
      try {
        conn = p.connect(hostId, { metadata: { pid: cfg.pid, v: 2, tab: TAB_ID }, serialization: 'json', reliable: true });
      } catch (e) {
        log('connect threw', e);
      }
      if (!conn) { clientFail('Host unreachable', false, 'signaling'); return; }

      var a = { conn: conn, last: Date.now(), lost: false, opened: false, timer: null };
      inflight = a;
      log('connecting to host, attempt', tries);
      if (!everOnline && fails === 0) setStatus('connecting', 'Linking up with the host…', 'connecting');

      a.timer = setTimeout(function () {
        if (inflight === a) { log('connect attempt timed out'); clientConnLost(a, 'connect timeout'); }
      }, CONNECT_TIMEOUT);

      conn.on('open', function () {
        if (dead || a.lost || inflight !== a) { a.lost = true; closeConn(conn); return; }
        clearTimeout(a.timer);
        inflight = null;
        a.opened = true;
        a.last = Date.now();
        cconn = a;
        fails = 0; tries = 0; waits = 0; notFound = 0; notFoundSince = 0;
        everOnline = true;
        clearTimeout(retryTimer);
        retryTimer = null;
        setStatus('online', 'Connected to host (' + routeName() + ')', 'connected');
        rawSend(a, { t: '_hb' });
        flushQueue();
      });
      conn.on('data', function (d) {
        a.last = Date.now();
        if (d && d.t === '_hb') a.hidden = !!d.h;
        if (a.lost || !a.opened) return;
        handleData(d, 'host');
      });
      conn.on('close', function () { clientConnLost(a, 'close'); });
      conn.on('error', function (e) { log('conn error', e); clientConnLost(a, 'error'); });
    }

    function clientConnLost(a, why) {
      if (a.lost) return;
      a.lost = true;
      clearTimeout(a.timer);
      closeConn(a.conn);
      if (dead) return;
      if (cconn === a) {
        cconn = null;
        log('connection to host lost:', why);
        clientFail(why === 'heartbeat timeout' ? 'The host stopped responding' : 'Lost the connection to the host', true, 'host-left');
      } else if (inflight === a) {
        inflight = null;
        log('connect attempt failed:', why);
        var reason, c;
        var R = room.toUpperCase();
        if (why === 'peer-unavailable') {
          if (!notFoundSince) notFoundSince = Date.now();
          notFound++;
          if (everOnline) { reason = 'The host has left room ' + R + ' — waiting for them to come back'; c = 'host-left'; }
          else if (Date.now() - notFoundSince > NOT_FOUND_SLOW) { reason = 'Room ' + R + ' not found — check the code, or ask the host to open the game. Still trying'; c = 'room-not-found'; }
          else { reason = 'Waiting for the host to open room ' + R; c = 'waiting-host'; }
          // Auto mode: the host may be on the other route (e.g. the relay was down when they started).
          if (notFound % NOT_FOUND_SWITCH === 0 && switchTransport('host not found')) destroyPeer();
        } else if (why === 'connect timeout' && transport === 'p2p') {
          reason = relayServers().length ? 'Found the host but couldn\'t link up' : 'Found the host, but your networks block a direct browser-to-browser link';
          c = 'ice';
          if (switchTransport('ice failed')) destroyPeer();
        } else if (why === 'connect timeout') {
          reason = 'The host didn\'t answer in time'; c = 'timeout';
        } else {
          reason = transport === 'p2p' ? 'Found the host, but the direct link failed' : 'Couldn\'t link up with the host';
          c = transport === 'p2p' ? 'ice' : 'timeout';
        }
        clientFail(reason, false, c);
      }
    }

    // Retry right now (network came back / tab visible). `abandon` also restarts
    // an attempt that is already in flight.
    function clientRetryNow(abandon) {
      if (dead || isHost || cconn) return;
      if (inflight) {
        if (!abandon) return;
        var a = inflight;
        inflight = null;
        a.lost = true;
        clearTimeout(a.timer);
        closeConn(a.conn);
      }
      fails = 0;
      waits = 0;
      clearTimeout(retryTimer);
      retryTimer = null;
      sigReconnect();
      clientConnect();
    }

    function enqueue(msg) {
      if (msg && SNAPSHOT_TYPES[msg.t]) {
        // Only the latest snapshot of each snapshot type matters.
        queue = queue.filter(function (q) { return q.m.t !== msg.t; });
      }
      queue.push({ m: msg, at: Date.now() });
      if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    }

    // Snapshots are always safe to send late (they describe the present). Actions are not:
    // replaying "lose 5 life" or "pass the turn" long after the moment is worse than
    // dropping it, so actions older than QUEUE_MAX_AGE are discarded and the app is told.
    function flushQueue() {
      var now = Date.now(), dropped = [];
      queue = queue.filter(function (q) {
        if (SNAPSHOT_TYPES[q.m.t] || now - q.at <= QUEUE_MAX_AGE) return true;
        dropped.push(q.m);
        return false;
      });
      if (dropped.length) {
        log('dropped', dropped.length, 'stale queued action(s)');
        safeCall(cfg.onDropped, dropped);
      }
      while (queue.length && cconn && !cconn.lost) {
        var q = queue[0];
        if (!sendOrKill(cconn, q.m)) break; // connection died; keep it and the rest
        queue.shift();
      }
    }

    // ---- public session API -------------------------------------------------
    function send(msg) {
      if (dead || msg == null) return;
      msg = stamp(msg);
      if (isHost) {
        Array.from(conns.values()).forEach(function (rec) { sendOrKill(rec, msg); });
      } else {
        if (cconn && !cconn.lost && sendOrKill(cconn, msg)) return;
        enqueue(msg); // not connected (or the send just failed): deliver after reconnect
      }
    }

    function sendTo(pid, msg) {
      if (dead || !isHost || msg == null) return;
      var rec = conns.get(pid);
      if (rec) sendOrKill(rec, stamp(msg));
    }

    function peers() {
      return isHost && !dead ? Array.from(conns.keys()) : [];
    }

    function onOnline() {
      if (dead) return;
      log('browser online event');
      if (isHost) {
        sigReconnect();
        if (!peer && peerRetryTimer) hostStartPeer(); // skip the wait while reclaiming the id
      } else {
        clientRetryNow(true);
      }
    }

    function onVisible() {
      if (dead) return;
      // Timers/sockets may have been frozen while hidden: give live connections a
      // fresh grace period instead of declaring them dead on the first watchdog tick.
      var now = Date.now();
      if (isHost) {
        conns.forEach(function (rec) { rec.last = now; });
        sigReconnect();
      } else {
        if (cconn) cconn.last = now;
        else clientRetryNow(false);
      }
    }

    // silent=true: no further callbacks (used by stop / pagehide / fatal).
    function shutdown(silent) {
      if (dead) return;
      dead = true;
      clearInterval(hbTimer); clearInterval(wdTimer); clearInterval(sigTimer);
      clearTimeout(peerRetryTimer); clearTimeout(retryTimer);
      hbTimer = wdTimer = sigTimer = peerRetryTimer = retryTimer = null;
      conns.forEach(function (rec) { rec.lost = true; clearTimeout(rec.timer); closeConn(rec.conn); });
      conns.clear();
      pending.forEach(function (rec) { rec.lost = true; clearTimeout(rec.timer); closeConn(rec.conn); });
      pending.clear();
      [cconn, inflight].forEach(function (a) {
        if (a) { a.lost = true; clearTimeout(a.timer); closeConn(a.conn); }
      });
      cconn = inflight = null;
      queue = [];
      destroyPeer();
      if (!silent || state !== 'error') state = 'offline';
    }

    function start() {
      setStatus('connecting', isHost ? 'Starting host…' : 'Connecting…', 'init');
      hbTimer = setInterval(heartbeatTick, HB_INTERVAL);
      wdTimer = setInterval(watchdogTick, WATCHDOG_INTERVAL);
      sigTimer = setInterval(sigReconnect, SIG_RETRY);
      if (isHost) hostStartPeer(); else clientConnect();
    }

    return {
      start: start,
      shutdown: shutdown,
      send: send,
      sendTo: sendTo,
      peers: peers,
      getState: function () { return state; },
      diag: function () {
        return { role: cfg.role, room: room.toUpperCase(), transport: transport, auto: auto, state: state, code: code,
          text: lastText, peerOpen: !!(peer && peer.open), players: isHost ? Array.from(conns.keys()) : null,
          queued: queue.length, notFound: notFound, maxMsg: (peer && peer.maxMsg) || DIRECT_MAX_BYTES };
      },
      onOnline: onOnline,
      onVisible: onVisible,
      heartbeatNow: heartbeatTick
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  var Net = {
    start: function (cfg) {
      if (current) { current.shutdown(true); current = null; }
      suspended = false;
      lastCfg = cfg || null;
      var problem = null;
      if (!cfg || (cfg.role !== 'host' && cfg.role !== 'client')) problem = 'Invalid network role';
      else if (!cfg.room || !cfg.pid) problem = 'Missing room code or player id';
      else if (typeof Peer === 'undefined') problem = 'PeerJS failed to load';
      if (problem) {
        console.error('[net]', problem);
        fallbackState = 'error';
        try { if (cfg && typeof cfg.onStatus === 'function') cfg.onStatus('error', problem); } catch (e) { console.error(e); }
        return;
      }
      fallbackState = 'offline';
      current = createSession(cfg);
      current.start();
    },

    stop: function () {
      if (current) { current.shutdown(true); current = null; }
      suspended = false;
      lastCfg = null;
      fallbackState = 'offline';
    },

    send: function (msg) {
      try { if (current) current.send(msg); } catch (e) { log('send threw', e); }
    },

    sendTo: function (pid, msg) {
      try { if (current) current.sendTo(pid, msg); } catch (e) { log('sendTo threw', e); }
    },

    peers: function () {
      try { return current ? current.peers() : []; } catch (e) { return []; }
    },

    state: function () {
      return current ? current.getState() : fallbackState;
    },

    // Snapshot of the connection for the diagnostics panel / bug reports.
    diag: function () {
      try { return current ? current.diag() : { state: fallbackState }; } catch (e) { return { error: String(e) }; }
    },

    makeRoomCode: function () {
      var out = '';
      var n = ROOM_ALPHABET.length; // 32, divides 2^32 evenly => no modulo bias
      var r = null;
      try {
        if (window.crypto && window.crypto.getRandomValues) {
          r = window.crypto.getRandomValues(new Uint32Array(5));
        }
      } catch (_) { r = null; }
      for (var i = 0; i < 5; i++) {
        var v = r ? r[i] : Math.floor(Math.random() * 4294967296);
        out += ROOM_ALPHABET.charAt(v % n);
      }
      return out;
    }
  };

  // ---------------------------------------------------------------------------
  // Page-level hints (registered once)
  // ---------------------------------------------------------------------------
  window.addEventListener('online', function () {
    if (current) current.onOnline();
  });

  document.addEventListener('visibilitychange', function () {
    if (!current) return;
    if (document.visibilityState === 'visible') current.onVisible();
    current.heartbeatNow(); // tell the other side right away whether we're hidden
  });

  // Release the host id quickly so a reload can reclaim it right away.
  window.addEventListener('pagehide', function () {
    if (current) {
      suspended = true;
      current.shutdown(true);
      current = null;
    }
  });

  // If the page is restored from the back/forward cache, resume the session.
  window.addEventListener('pageshow', function () {
    if (suspended && lastCfg) {
      suspended = false;
      Net.start(lastCfg);
    }
  });

  window.Net = Net;
})();
