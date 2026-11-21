/* Local-only bridge from a game tab to the companion MCP server. */
(function () {
  'use strict';
  if (!new URLSearchParams(location.search).has('agent')) return;

  var socket = null, retry = null, stopped = false;
  var allowed = {
    agent_status: function () { return CTAgentAPI.status(); },
    observe_game: function () { return CTAgentAPI.observe(); },
    send_chat: function (a) { return CTAgentAPI.chat(a.text); },
    draw_cards: function (a) { return CTAgentAPI.draw(a.count); },
    move_card: function (a) { return CTAgentAPI.move(a.iid, a.destination); },
    tap_card: function (a) { return CTAgentAPI.tap(a.iid, a.tapped); },
    untap_all: function () { return CTAgentAPI.untapAll(); },
    pass_turn: function () { return CTAgentAPI.passTurn(); }
  };

  function send(message) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
  function connect() {
    if (stopped) return;
    try { socket = new WebSocket('ws://' + location.host + '/agent-bridge'); }
    catch (_) { retry = setTimeout(connect, 2000); return; }
    socket.onopen = function () { send({ type: 'hello', status: CTAgentAPI.status() }); };
    socket.onmessage = function (event) {
      var message;
      try { message = JSON.parse(event.data); } catch (_) { return; }
      if (!message || message.type !== 'call' || typeof message.id !== 'string') return;
      try {
        var action = allowed[message.tool];
        if (!action) throw new Error('Unknown agent tool.');
        var result = action(message.arguments || {});
        send({ type: 'result', id: message.id, ok: true, result: result });
      } catch (error) {
        send({ type: 'result', id: message.id, ok: false, error: String(error && error.message || error) });
      }
    };
    socket.onclose = function () { if (!stopped) retry = setTimeout(connect, 2000); };
    socket.onerror = function () { try { socket.close(); } catch (_) { /* retry via close */ } };
  }
  window.addEventListener('pagehide', function () {
    stopped = true; clearTimeout(retry); if (socket) socket.close();
  }, { once: true });
  connect();
})();
