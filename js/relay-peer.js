/* relay-peer.js - RelayPeer: a drop-in stand-in for the subset of PeerJS's Peer API that
 * js/net.js uses, relaying everything over a WebSocket to a relay broker (the Cloudflare
 * relay or lan-server.py) speaking protocol v2 (see docs/relay-protocol.md).
 *
 * Always defines window.RelayPeer; it does NOT replace window.Peer by itself (js/lan.js and
 * js/net.js decide when to use it).
 *
 * new RelayPeer(id?, opts)   opts.url  (required) full ws:// or wss:// URL
 *                            opts.key  (string|null) takeover key sent in 'reg'
 *                            opts.label (string) used in log lines
 */
(function () {
  'use strict';

  var DEFAULT_MAX_MSG = 15000;   // until the server's hello says otherwise
  var PING_EVERY_MS = 15000;     // app-level keepalive
  var DEAD_AFTER_MS = 40000;     // nothing received from the server for this long => socket is dead

  // ---- tiny event emitter ---------------------------------------------------
  function emitterOn(ev, fn) {
    if (!this._ev) this._ev = {};
    (this._ev[ev] || (this._ev[ev] = [])).push(fn);
    return this;
  }
  function emitterOff(ev, fn) {
    if (!this._ev || !this._ev[ev]) return this;
    if (!fn) { delete this._ev[ev]; return this; }
    this._ev[ev] = this._ev[ev].filter(function (f) { return f !== fn; });
    return this;
  }
  function emitterEmit(ev) {
    if (!this._ev || !this._ev[ev]) return this;
    var args = Array.prototype.slice.call(arguments, 1);
    var list = this._ev[ev].slice();
    var label = this._label || (this._owner && this._owner._label) || 'relay';
    for (var i = 0; i < list.length; i++) {
      try { list[i].apply(this, args); } catch (e) { console.error('[' + label + '] listener for "' + ev + '" threw', e); }
    }
    return this;
  }

  function mkErr(type, message) {
    var e = new Error(message || type);
    e.type = type;
    return e;
  }

  function randomId() {
    return 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Size in bytes of a (JSON) string. UTF-8 is at most 3 bytes per UTF-16 unit, so short
  // strings are known to fit without measuring.
  function fitsIn(s, limit) {
    if (s.length * 3 <= limit) return true;
    try {
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length <= limit;
    } catch (e) { /* fall through */ }
    return s.length <= limit;
  }

  // ---- RelayConnection ------------------------------------------------------
  function RelayConnection(owner, peerId, metadata, lid, cid) {
    this._owner = owner;
    this._closed = false;
    this.peer = peerId;
    this.metadata = metadata;
    this.open = false;
    this.lid = lid || null;
    this.cid = cid || null;
    this.bufferSize = 0;
  }
  RelayConnection.prototype.on = emitterOn;
  RelayConnection.prototype.off = emitterOff;
  RelayConnection.prototype.emit = emitterEmit;
  Object.defineProperty(RelayConnection.prototype, 'connectionId', {
    get: function () { return this.lid || this.cid; }
  });

  // Never throws. Frames over the server's maxMsg are dropped (js/net.js chunks big messages).
  RelayConnection.prototype.send = function (obj) {
    try {
      if (!this.open || !this.lid) return;
      var owner = this._owner;
      var ws = owner._ws;
      if (!ws || ws.readyState !== 1) return;
      var frame = JSON.stringify({ op: 'msg', lid: this.lid, d: obj });
      if (typeof frame !== 'string') return;
      var max = owner.maxMsg || DEFAULT_MAX_MSG;
      if (!fitsIn(frame, max)) {
        console.error('[' + owner._label + '] dropped an oversized frame (' + frame.length + ' chars, maxMsg ' + max + ')');
        return;
      }
      ws.send(frame);
    } catch (e) {
      console.error('[' + (this._owner && this._owner._label) + '] send failed', e);
    }
  };

  RelayConnection.prototype.close = function () {
    if (this._closed) return;
    this._closed = true;
    try {
      var ws = this._owner._ws;
      if (this.lid && ws && ws.readyState === 1) ws.send(JSON.stringify({ op: 'cclose', lid: this.lid }));
    } catch (e) { /* ignore */ }
    this.open = false;
    this._owner._forget(this);
    this.emit('close');
  };

  // ---- RelayPeer ------------------------------------------------------------
  function RelayPeer(id, opts) {
    if (id !== null && typeof id === 'object') { opts = id; id = null; }
    if (typeof id !== 'string' || !id) id = null;
    opts = opts || {};

    this.id = null;
    this.open = false;
    this.disconnected = false;
    this.destroyed = false;
    this.transport = 'relay';
    this.maxMsg = DEFAULT_MAX_MSG;
    this.server = null;
    this.features = [];
    this._vaultPending = {};

    this._url = typeof opts.url === 'string' ? opts.url : '';
    this._key = (typeof opts.key === 'string' && opts.key) ? opts.key : null;
    this._label = (typeof opts.label === 'string' && opts.label) ? opts.label : 'relay';
    this._requestedId = id;
    this._ws = null;
    this._conns = {};    // lid -> RelayConnection
    this._pending = {};  // cid -> RelayConnection (waiting for copen / cfail)
    this._everOpened = false;

    this._openWs(id, false);
  }
  RelayPeer.prototype.on = emitterOn;
  RelayPeer.prototype.off = emitterOff;
  RelayPeer.prototype.emit = emitterEmit;

  RelayPeer.prototype._forget = function (conn) {
    if (conn.lid && this._conns[conn.lid] === conn) delete this._conns[conn.lid];
    if (conn.cid && this._pending[conn.cid] === conn) delete this._pending[conn.cid];
  };

  // Close every connection locally (open=false + 'close' event) and forget them.
  RelayPeer.prototype._closeAllConns = function () {
    var all = [], k;
    for (k in this._vaultPending) { clearTimeout(this._vaultPending[k].timer); this._vaultPending[k].reject(new Error('Room connection closed before board save completed.')); }
    this._vaultPending = {};
    for (k in this._conns) all.push(this._conns[k]);
    for (k in this._pending) all.push(this._pending[k]);
    this._conns = {};
    this._pending = {};
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c._closed) continue;
      c._closed = true;
      c.open = false;
      c.emit('close');
    }
  };

  RelayPeer.prototype._openWs = function (regId, isReconnect) {
    var self = this;
    var ws;
    try {
      if (!this._url) throw new Error('no relay url');
      ws = new WebSocket(this._url);
    } catch (e) {
      ws = { readyState: 3, close: function () {}, send: function () {} };
      setTimeout(function () { self._wsGone(ws); }, 0);
    }
    ws._done = false;
    ws._reconnect = !!isReconnect;
    ws._lastRx = Date.now();
    ws._ka = null;
    this._ws = ws;

    ws.onopen = function () {
      if (self._ws !== ws) return;
      ws._lastRx = Date.now();
      try { ws.send(JSON.stringify({ op: 'reg', id: regId, key: self._key })); }
      catch (e) { console.error('[' + self._label + '] reg send failed', e); }
      self._startKeepalive(ws);
    };
    ws.onmessage = function (ev) {
      if (self._ws !== ws) return;
      ws._lastRx = Date.now();
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      try { self._onMessage(ws, m); } catch (e) { console.error('[' + self._label + '] message handler threw', e); }
    };
    ws.onclose = function () { self._wsGone(ws); };
    ws.onerror = function () { self._wsGone(ws); };
  };

  // App-level keepalive: ping every 15s; if nothing at all arrives for 40s the socket is dead.
  RelayPeer.prototype._startKeepalive = function (ws) {
    var self = this;
    this._stopKeepalive(ws);
    ws._ka = setInterval(function () {
      if (self._ws !== ws || ws._done) { self._stopKeepalive(ws); return; }
      if (ws.readyState !== 1) return;
      if (Date.now() - ws._lastRx > DEAD_AFTER_MS) {
        console.warn('[' + self._label + '] no data from the server for ' + (DEAD_AFTER_MS / 1000) + 's; treating the socket as dead');
        self._wsGone(ws);
        return;
      }
      try { ws.send('{"op":"ping"}'); } catch (e) { /* the close handler will deal with it */ }
    }, PING_EVERY_MS);
  };

  RelayPeer.prototype._stopKeepalive = function (ws) {
    if (ws && ws._ka) { clearInterval(ws._ka); ws._ka = null; }
  };

  // A fatal server error (replaced / room-full): like PeerJS, destroy BEFORE emitting the error.
  RelayPeer.prototype._fatal = function (type, message) {
    this.destroyed = true;
    this.open = false;
    this.disconnected = true;
    this._closeAllConns();
    this._detachWs();
    this.emit('error', mkErr(type, message));
  };

  RelayPeer.prototype._onMessage = function (ws, m) {
    var c;
    switch (m.op) {
      case 'hello':
        if (typeof m.maxMsg === 'number' && m.maxMsg > 0) this.maxMsg = m.maxMsg;
        this.server = m.server || null;
        this.features = Array.isArray(m.features) ? m.features : [];
        break;

      case 'vault':
        var pending = this._vaultPending[m.rid];
        if (pending) { delete this._vaultPending[m.rid]; clearTimeout(pending.timer); if (m.ok) pending.resolve(m.result); else pending.reject(new Error(String(m.error || 'Room board save failed.'))); }
        break;

      case 'pong':
        break;

      case 'open':
        this.id = m.id;
        this.open = true;
        this.disconnected = false;
        this._everOpened = true;
        ws._reconnect = false;
        this.emit('open', m.id);
        break;

      case 'err':
        if (m.type === 'unavailable-id') {
          this.destroyed = true;
          this.open = false;
          this._detachWs();
          this.emit('error', mkErr('unavailable-id', m.message || 'ID is taken'));
        } else if (m.type === 'replaced') {
          this._fatal('replaced', 'This game was opened in another tab or window');
        } else if (m.type === 'room-full') {
          this._fatal('room-full', m.message || 'This room is full');
        } else {
          this.emit('error', mkErr(m.type || 'server-error', m.message));
        }
        break;

      case 'copen':
        c = this._pending[m.cid];
        if (!c) {
          // connection was closed locally before the server answered: tidy up server side
          try { if (ws.readyState === 1) ws.send(JSON.stringify({ op: 'cclose', lid: m.lid })); } catch (e) { /* ignore */ }
          break;
        }
        delete this._pending[m.cid];
        c.lid = m.lid;
        c.open = true;
        this._conns[m.lid] = c;
        c.emit('open');
        break;

      case 'cfail':
        c = this._pending[m.cid];
        if (!c) break;
        delete this._pending[m.cid];
        this.emit('error', mkErr(m.type || 'peer-unavailable', m.message));
        c._closed = true;
        c.open = false;
        c.emit('close');
        break;

      case 'inc':
        c = new RelayConnection(this, m.from, m.meta, m.lid, null);
        c.open = true;
        this._conns[m.lid] = c;
        this.emit('connection', c);
        setTimeout(function () { if (c.open) c.emit('open'); }, 0);
        break;

      case 'msg':
        c = this._conns[m.lid];
        if (c) c.emit('data', m.d);
        break;

      case 'cclose':
        c = this._conns[m.lid];
        if (c) {
          delete this._conns[m.lid];
          c._closed = true;
          c.open = false;
          c.emit('close');
        }
        break;
    }
  };

  RelayPeer.prototype.roomVault = function (action, payload) {
    var self = this;
    if (!self.open || !self._ws || self._ws.readyState !== 1) return Promise.reject(new Error('Room server is not connected.'));
    if (self.features.indexOf('room-vault-v1') < 0) return Promise.reject(new Error('This room server does not support board recovery yet.'));
    var rid = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { delete self._vaultPending[rid]; reject(new Error('Room board save timed out.')); }, 15000);
      self._vaultPending[rid] = { resolve: resolve, reject: reject, timer: timer };
      try { self._ws.send(JSON.stringify(Object.assign({}, payload || {}, { op: 'vault', rid: rid, action: action }))); }
      catch (e) { clearTimeout(timer); delete self._vaultPending[rid]; reject(e); }
    });
  };

  // Close the websocket without any further events from it.
  RelayPeer.prototype._detachWs = function () {
    var ws = this._ws;
    this._ws = null;
    if (!ws) return;
    ws._done = true;
    this._stopKeepalive(ws);
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch (e) { /* ignore */ }
  };

  // The websocket closed or errored on its own (or was declared dead). Fires at most once per ws.
  RelayPeer.prototype._wsGone = function (ws) {
    if (ws._done) return;
    ws._done = true;
    this._stopKeepalive(ws);
    if (this._ws !== ws) return;
    this._ws = null;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch (e) { /* ignore */ }
    if (this.destroyed) return;

    if (this._everOpened) {
      if (ws._reconnect) return; // failed reconnect attempt: stay disconnected quietly
      this.open = false;
      this.disconnected = true;
      this._closeAllConns();
      this.emit('disconnected', this.id);
    } else {
      this.destroyed = true;
      this.open = false;
      this._closeAllConns();
      this.emit('error', mkErr('server-error', 'Could not reach the relay server'));
    }
  };

  RelayPeer.prototype.reconnect = function () {
    if (this.destroyed || !this.disconnected) return;
    var ws = this._ws;
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    this._openWs(this.id, true);
  };

  RelayPeer.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    this.open = false;
    this.disconnected = true;
    this._closeAllConns();
    this._detachWs();
    var self = this;
    setTimeout(function () { self.emit('close'); }, 0);
  };

  RelayPeer.prototype.connect = function (to, options) {
    var self = this;
    var metadata = options && options.metadata;
    var cid = randomId();
    var conn = new RelayConnection(this, to, metadata, null, cid);
    var ws = this._ws;
    if (this.destroyed || !ws || ws.readyState !== 1) {
      setTimeout(function () { self.emit('error', mkErr('network', 'Not connected to the relay server')); }, 0);
      return conn;
    }
    this._pending[cid] = conn;
    try {
      ws.send(JSON.stringify({ op: 'conn', cid: cid, to: to, meta: metadata }));
    } catch (e) {
      delete this._pending[cid];
      setTimeout(function () { self.emit('error', mkErr('network', 'Not connected to the relay server')); }, 0);
    }
    return conn;
  };

  window.RelayPeer = RelayPeer;
})();
