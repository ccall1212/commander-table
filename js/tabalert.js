/* tabalert.js - tab alerts for a slow game played in the background: when it becomes your turn, someone presses "In response!", or someone aims an arrow at you
 * while this page is hidden or not in front, the browser tab flashes its title and icon (and can chime or show a desktop pop-up, if you turned those on).
 * Nothing is shown while you are looking at the game, and everything goes away the moment you come back. Settings stay in this browser only.
 *
 * CTTabAlert.alert(text)      - raise an alert (only when the page is not in front)
 * CTTabAlert.clear()          - remove the flashing title and icon
 * CTTabAlert.settings() / CTTabAlert.set(key, value)   - keys: tab, sound, popup
 * CTTabAlert.inFront()        - true when the player can see the page now
 */
(function () {
  'use strict';
  var KEY = 'ct.tabAlerts.v1';
  var DEFAULTS = { tab: true, sound: false, popup: false };
  var FLASH_MS = 1200;
  var state = { count: 0, text: '', base: '', icon: '', timer: null, on: false };
  var audio = null;

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    return { tab: s.tab !== false, sound: s.sound === true, popup: s.popup === true };
  }
  var cfg = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* storage can be unavailable */ } }

  function inFront() {
    try { return document.visibilityState !== 'hidden' && (typeof document.hasFocus !== 'function' || document.hasFocus()); } catch (e) { return true; }
  }

  // ---- the tab icon: the normal icon with a red dot -----------------------------------------------------------------------------------------------------
  function iconLink() { return document.querySelector('link[rel~="icon"]'); }
  var DOT = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='14' y='6' width='36' height='52' rx='5' fill='%23d4a72c'/%3E%3Ccircle cx='46' cy='18' r='15' fill='%23e5322d' stroke='white' stroke-width='4'/%3E%3C/svg%3E";
  function showIcon(alerting) {
    var link = iconLink(); if (!link) return;
    if (alerting) { if (!state.icon) state.icon = link.getAttribute('href') || ''; link.setAttribute('href', DOT); }
    else if (state.icon) { link.setAttribute('href', state.icon); state.icon = ''; }
  }

  // ---- the flashing title -------------------------------------------------------------------------------------------------------------------------------
  function paintTitle(flash) {
    document.title = flash ? ((state.count > 1 ? '(' + state.count + ') ' : '') + '🔔 ' + state.text) : state.base;
  }
  function startFlash() {
    if (state.on) return;
    state.on = true; state.base = document.title; showIcon(true);
    var flash = true; paintTitle(true);
    state.timer = setInterval(function () { flash = !flash; paintTitle(flash); }, FLASH_MS);
  }
  function clear() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.on) { document.title = state.base; showIcon(false); }
    state.on = false; state.count = 0; state.text = '';
  }

  // ---- sound and desktop pop-up -------------------------------------------------------------------------------------------------------------------------
  function prepareAudio() {
    if (audio || !cfg.sound) return;
    try { var C = window.AudioContext || window.webkitAudioContext; if (C) audio = new C(); } catch (e) { audio = null; }
  }
  function chime() {
    if (!cfg.sound) return;
    prepareAudio();
    if (!audio) return;
    try {
      if (audio.state === 'suspended') audio.resume();
      var t0 = audio.currentTime;
      [[660, 0], [880, 0.16]].forEach(function (n) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(n[0], t0 + n[1]);
        g.gain.setValueAtTime(0.0001, t0 + n[1]); g.gain.exponentialRampToValueAtTime(0.05, t0 + n[1] + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + 0.35);
        o.connect(g); g.connect(audio.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + 0.4);
      });
    } catch (e) { /* a browser that blocks sound until you click: the title still flashes */ }
  }
  function popup(text) {
    if (!cfg.popup || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      var n = new Notification('Commander Table', { body: text, tag: 'ct-alert', silent: true });
      n.onclick = function () { try { window.focus(); } catch (e) { /* ignore */ } n.close(); };
    } catch (e) { /* some browsers only allow pop-ups from a service worker */ }
  }

  function alert(text) {
    if (inFront()) return false;
    text = String(text || '').slice(0, 80);
    if (cfg.tab) { state.count += 1; state.text = text; if (state.on) paintTitle(true); else startFlash(); }
    chime(); popup(text);
    return true;
  }

  function set(key, value) {
    if (!(key in DEFAULTS)) return;
    cfg[key] = !!value; save();
    if (key === 'tab' && !cfg.tab) clear();
    if (key === 'sound' && cfg.sound) { prepareAudio(); chime(); } // a short sample, so you hear what it sounds like
  }
  // Pop-ups need the browser's permission, which it only asks for after a click. Resolves true when pop-ups are allowed.
  function enablePopup() {
    if (typeof Notification === 'undefined') return Promise.resolve(false);
    if (Notification.permission === 'granted') { set('popup', true); return Promise.resolve(true); }
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Promise.resolve(Notification.requestPermission()).then(function (p) { var ok = p === 'granted'; set('popup', ok); return ok; }, function () { return false; });
  }

  document.addEventListener('visibilitychange', function () { if (inFront()) clear(); });
  window.addEventListener('focus', function () { if (inFront()) clear(); });
  document.addEventListener('pointerdown', function () { if (cfg.sound) prepareAudio(); }, { once: true, capture: true }); // browsers only allow sound after the page has been clicked

  window.CTTabAlert = { alert: alert, clear: clear, inFront: inFront, settings: function () { return { tab: cfg.tab, sound: cfg.sound, popup: cfg.popup }; }, set: set, enablePopup: enablePopup, popupSupported: function () { return typeof Notification !== 'undefined'; } };
})();
