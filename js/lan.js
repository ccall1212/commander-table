/* lan.js - LAN mode shim. Only active when js/lan-mode.js set window.CT_LAN (i.e. the page
 * was served by lan-server.py). Defines LanPeer, a RelayPeer (js/relay-peer.js, which must be
 * loaded first) pointed at this server's /ws endpoint, and installs it as window.Peer.
 */
(function () {
  'use strict';

  if (!window.CT_LAN) return;

  function LanPeer(id, opts) {
    if (id !== null && typeof id === 'object') { opts = id; id = null; }
    opts = opts || {};
    var url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return new window.RelayPeer(id, Object.assign({}, opts, {
      url: url,
      key: opts.key || null,
      label: 'lan'
    }));
  }

  window.LanPeer = LanPeer;
  window.Peer = LanPeer;
})();
