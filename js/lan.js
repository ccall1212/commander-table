/* lan.js - LAN mode: a drop-in stand-in for PeerJS's Peer that relays everything
 * over a WebSocket to lan-server.py. Only active when js/lan-mode.js set window.CT_LAN
 * (i.e. the page was served by lan-server.py). Loads after the PeerJS script and
 * replaces window.Peer. Implements just the subset of the PeerJS 1.5 API that
 * js/net.js uses.
 */
(function () {
  'use strict';

  if (!window.CT_LAN) return;

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
    for (var i = 0; i < list.length; i++) {
      try { list[i].apply(this, args); } catch (e) { console.error('[lan] listener for "' + ev + '" threw', e); }
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

  // ---- LanConnection --------------------------------------------------------
  function LanConnection(owner, peerId, metadata, lid, cid) {
    this._owner = owner;
    this._closed = false;
    this.peer = peerId;
    this.metadata = metadata;
    this.open = false;
    this.lid = lid || null;
    this.cid = cid || null;
    this.bufferSize = 0;
  }
  LanConnection.prototype.on = emitterOn;
  LanConnection.prototype.off = emitterOff;
  LanConnection.prototype.emit = emitterEmit;
  Object.defineProperty(LanConnection.prototype, 'connectionId', {
    get: function () { return this.lid || this.cid; }
  });

  LanConnection.prototype.send = function (obj) {
    try {
      if (!this.open || !this.lid) return;
      var ws = this._owner._ws;
      if (!ws || ws.readyState !== 1) return;
      ws.send(JSON.stringify({ op: 'msg', lid: this.lid, d: obj }));
    } catch (e) {
      console.error('[lan] send failed', e);
    }
  };

  LanConnection.prototype.close = function () {
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

  // ---- LanPeer --------------------------------------------------------------
  function LanPeer(id, opts) {
    if (id !== null && typeof id === 'object') { opts = id; id = null; }
    if (typeof id !== 'string' || !id) id = null;
    void opts; // options (PeerJS server config etc.) are ignored

    this.id = null;
    this.open = false;
    this.disconnected = false;
    this.destroyed = false;

    this._requestedId = id;
    this._ws = null;
    this._conns = {};    // lid -> LanConnection
    this._pending = {};  // cid -> LanConnection (waiting for copen / cfail)
    this._everOpened = false;

    this._openWs(id, false);
  }
  LanPeer.prototype.on = emitterOn;
  LanPeer.prototype.off = emitterOff;
  LanPeer.prototype.emit = emitterEmit;

  LanPeer.prototype._forget = function (conn) {
    if (conn.lid && this._conns[conn.lid] === conn) delete this._conns[conn.lid];
    if (conn.cid && this._pending[conn.cid] === conn) delete this._pending[conn.cid];
  };

  // Close every connection locally (open=false + 'close' event) and forget them.
  LanPeer.prototype._closeAllConns = function () {
    var all = [], k;
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

  LanPeer.prototype._openWs = function (regId, isReconnect) {
    var self = this;
    var ws;
    try {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    } catch (e) {
      ws = { readyState: 3, close: function () {}, send: function () {} };
      setTimeout(function () { self._wsGone(ws); }, 0);
    }
    ws._done = false;
    ws._reconnect = !!isReconnect;
    this._ws = ws;

    ws.onopen = function () {
      if (self._ws !== ws) return;
      try { ws.send(JSON.stringify({ op: 'reg', id: regId })); } catch (e) { console.error('[lan] reg send failed', e); }
    };
    ws.onmessage = function (ev) {
      if (self._ws !== ws) return;
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      try { self._onMessage(ws, m); } catch (e) { console.error('[lan] message handler threw', e); }
    };
    ws.onclose = function () { self._wsGone(ws); };
    ws.onerror = function () { self._wsGone(ws); };
  };

  LanPeer.prototype._onMessage = function (ws, m) {
    var c, err;
    switch (m.op) {
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
          // like PeerJS: destroy BEFORE emitting the error
          this.destroyed = true;
          this.open = false;
          this._detachWs();
          err = mkErr('unavailable-id', m.message || 'ID is taken');
          this.emit('error', err);
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
        c = new LanConnection(this, m.from, m.meta, m.lid, null);
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

  // Close the websocket without any further events from it.
  LanPeer.prototype._detachWs = function () {
    var ws = this._ws;
    this._ws = null;
    if (!ws) return;
    ws._done = true;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch (e) { /* ignore */ }
  };

  // The websocket closed or errored on its own. Fires at most once per ws.
  LanPeer.prototype._wsGone = function (ws) {
    if (ws._done) return;
    ws._done = true;
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
      this.emit('error', mkErr('network', 'Could not reach the LAN server'));
    }
  };

  LanPeer.prototype.reconnect = function () {
    if (this.destroyed || !this.disconnected) return;
    var ws = this._ws;
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    this._openWs(this.id, true);
  };

  LanPeer.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    this.open = false;
    this.disconnected = true;
    this._closeAllConns();
    this._detachWs();
    var self = this;
    setTimeout(function () { self.emit('close'); }, 0);
  };

  LanPeer.prototype.connect = function (to, options) {
    var self = this;
    var metadata = options && options.metadata;
    var cid = randomId();
    var conn = new LanConnection(this, to, metadata, null, cid);
    var ws = this._ws;
    if (this.destroyed || !ws || ws.readyState !== 1) {
      setTimeout(function () { self.emit('error', mkErr('network', 'Not connected to the LAN server')); }, 0);
      return conn;
    }
    this._pending[cid] = conn;
    try {
      ws.send(JSON.stringify({ op: 'conn', cid: cid, to: to, meta: metadata }));
    } catch (e) {
      delete this._pending[cid];
      setTimeout(function () { self.emit('error', mkErr('network', 'Not connected to the LAN server')); }, 0);
    }
    return conn;
  };

  window.LanPeer = LanPeer;
  window.Peer = LanPeer;
})();
