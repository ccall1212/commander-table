/* updates.js - version display + "Updates" panel for LAN-served Commander Table.
 *
 * Does nothing unless window.CT_LAN is set (i.e. the page was served by lan-server.py).
 * Talks to the server's /api/version, /api/update/check and /api/update/apply endpoints.
 * Never throws and never blocks the app: if the API is missing (older server) the
 * Updates buttons are simply removed.
 */
(function () {
  'use strict';

  var lan = window.CT_LAN;
  if (!lan || typeof lan !== 'object') return;

  var VERSION_POLL_MS = 60 * 1000;
  var CHECK_INTERVAL_MS = 30 * 60 * 1000;
  var FIRST_CHECK_DELAY_MS = 3000;
  var APPLY_TIMEOUT_MS = 90 * 1000;
  var APPLY_POLL_MS = 1000;

  var state = {
    check: null,        // last /api/update/check response (object) or null
    checking: false,
    checkSeq: 0,
    applying: false,
    applyError: '',
    applyTimedOut: false,
    available: false,
    toastShown: false,
    noticeShown: false,
    dead: false         // API missing: everything switched off
  };
  var panel = null;     // {modal, root}
  var buttons = [];     // all .upd-btn elements
  var badges = [];      // footer badge(s)
  var timers = [];

  /* ---------------------------------------------------------------- helpers */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function runningText() {
    var t = 'v' + (lan.version || '?');
    if (lan.short) t += ' (' + lan.short + ')';
    return t;
  }

  function relTime(s) {
    var t = typeof s === 'number' ? s : Date.parse(s);
    if (!isFinite(t)) return s ? String(s) : '';
    var sec = Math.round((Date.now() - t) / 1000);
    if (sec < 45) return 'just now';
    var units = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000]];
    var best = units[0];
    for (var i = 0; i < units.length; i++) { if (sec >= units[i][1]) best = units[i]; }
    var n = Math.max(1, Math.round(sec / best[1]));
    return n + ' ' + best[0] + (n === 1 ? '' : 's') + ' ago';
  }

  function safeUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '';
  }

  async function api(path, opts) {
    try {
      var o = { cache: 'no-store' };
      if (opts) { for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k]; } }
      var r = await fetch(path, o);
      var j = null;
      try { j = await r.json(); } catch (_) { j = null; }
      return { status: r.status, ok: r.ok, json: j, net: false };
    } catch (_) {
      return { status: 0, ok: false, json: null, net: true };
    }
  }

  function toast(text, opts) {
    try { if (window.UI && typeof UI.toast === 'function') return UI.toast(text, opts); } catch (_) { /* ignore */ }
    return null;
  }

  /* ---------------------------------------------------------------- buttons */

  function makeButton(cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'upd-btn ' + cls;
    b.textContent = 'Updates';
    b.title = 'Check for updates';
    b.addEventListener('click', function (e) { e.preventDefault(); openPanel(); });
    buttons.push(b);
    return b;
  }

  function mountButtons() {
    try {
      var ver = document.getElementById('ver');
      if (ver && ver.parentNode && !document.querySelector('.upd-foot-btn')) {
        var fb = makeButton('upd-foot-btn');
        var badge = el('span', 'upd-badge hidden', 'Update available');
        badges.push(badge);
        var after = ver.nextSibling;
        var par = ver.parentNode;
        par.insertBefore(document.createTextNode(' · '), after);
        par.insertBefore(fb, after);
        par.insertBefore(document.createTextNode(' '), after);
        par.insertBefore(badge, after);
      }
      var right = document.querySelector('#topbar .tb-right');
      if (right && !document.querySelector('.upd-tb-btn')) {
        var tb = makeButton('upd-tb-btn');
        var menu = right.querySelector('[data-a="menu"]');
        right.insertBefore(tb, menu || null);
      }
    } catch (e) { console.debug('[updates] mount failed', e); }
  }

  function setVersionText() {
    try {
      var ver = document.getElementById('ver');
      if (!ver) return;
      var want = (lan.version || '') + (lan.short ? ' (' + lan.short + ')' : '');
      if (!want) return;
      if (ver.textContent !== want) ver.textContent = want;
      if (!ver._updWatch && typeof MutationObserver === 'function') {
        ver._updWatch = true;
        // app.js writes the bare APP_VERSION at startup; keep our richer text if it overwrites ours.
        new MutationObserver(function () {
          if (ver.textContent !== want) ver.textContent = want;
        }).observe(ver, { childList: true, characterData: true, subtree: true });
      }
    } catch (_) { /* ignore */ }
  }

  function refreshBadges() {
    var on = !!state.available;
    buttons.forEach(function (b) { b.classList.toggle('upd-has', on); });
    badges.forEach(function (b) { b.classList.toggle('hidden', !on); });
  }

  function killUI() {
    state.dead = true;
    timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    timers = [];
    buttons.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
    badges.forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
    buttons = [];
    badges = [];
    if (panel) { try { panel.modal.close(); } catch (_) { /* ignore */ } }
  }

  /* ---------------------------------------------------------------- checking */

  async function runCheck(force) {
    if (state.dead) return null;
    var seq = ++state.checkSeq;
    state.checking = true;
    renderPanel();
    var r = await api('/api/update/check' + (force ? '?force=1' : ''));
    if (seq !== state.checkSeq) return null; // superseded by a newer check
    state.checking = false;
    if (r.status === 404) { killUI(); return null; }
    var j = r.json;
    if (j && j.ok === true) {
      state.check = j;
    } else {
      state.check = { ok: false, error: (j && j.error) || (r.net ? 'Could not reach the server.' : 'Update check failed (HTTP ' + r.status + ').') };
    }
    state.available = !!(j && j.ok === true && j.status === 'available');
    refreshBadges();
    renderPanel();
    return state.check;
  }

  async function autoCheck() {
    var c = await runCheck(false);
    if (c && c.ok && c.status === 'available' && !state.toastShown) {
      state.toastShown = true;
      toast('Update available — click Updates to install', {
        ms: 10000,
        action: { label: 'Open', onClick: function () { openPanel(); } }
      });
    }
  }

  /* ---------------------------------------------------------------- panel */

  function openPanel() {
    if (state.dead) return;
    if (panel) return;
    if (!window.UI || typeof UI.modal !== 'function') return;
    var root = el('div', 'upd-panel');
    var modal;
    try {
      modal = UI.modal({
        title: 'Updates',
        el: root,
        onClose: function () { panel = null; }
      });
    } catch (e) { console.debug('[updates] modal failed', e); return; }
    panel = { modal: modal, root: root };
    renderPanel();
    if (!state.check && !state.checking && !state.applying) runCheck(false);
  }

  function renderPanel() {
    if (!panel) return;
    var root = panel.root;
    root.textContent = '';
    try {
      buildPanel(root);
    } catch (e) {
      console.debug('[updates] render failed', e);
      root.textContent = 'Something went wrong showing updates.';
    }
  }

  function commitList(commits) {
    var ul = el('ul', 'upd-commits');
    (commits || []).slice(0, 30).forEach(function (c) {
      if (!c) return;
      var li = el('li', 'upd-commit');
      li.appendChild(el('code', 'upd-sha', c.short || ''));
      li.appendChild(el('span', 'upd-msg', c.message || ''));
      var when = c.date ? relTime(c.date) : '';
      if (when) li.appendChild(el('span', 'upd-when muted', when));
      ul.appendChild(li);
    });
    return ul;
  }

  function buildPanel(root) {
    root.appendChild(el('div', 'upd-running', 'Running ' + runningText()));

    // --- applying view ---
    if (state.applying || state.applyTimedOut) {
      var box = el('div', 'upd-state');
      box.setAttribute('role', 'status');
      if (state.applying) {
        box.appendChild(el('span', 'upd-spin'));
        box.appendChild(el('span', null, 'Updating… the server is restarting'));
      } else {
        box.className = 'upd-state upd-err';
        box.appendChild(el('span', null, 'The server didn’t come back — check the server window.'));
      }
      root.appendChild(box);
      if (state.applying) root.appendChild(el('p', 'muted small', 'This page will reload automatically.'));
      root.appendChild(footerLink());
      return;
    }

    // --- toolbar ---
    var bar = el('div', 'upd-bar');
    var checkBtn = el('button', 'w-btn', state.checking ? 'Checking…' : 'Check now');
    checkBtn.type = 'button';
    checkBtn.disabled = state.checking;
    checkBtn.addEventListener('click', function () { runCheck(true); });
    bar.appendChild(checkBtn);
    root.appendChild(bar);

    var res = el('div', 'upd-result');
    root.appendChild(res);
    var c = state.check;

    if (state.applyError) {
      var ae = el('div', 'upd-state upd-err');
      ae.setAttribute('role', 'alert');
      ae.appendChild(el('span', null, state.applyError));
      res.appendChild(ae);
    }

    if (state.checking && !c) {
      var ld = el('div', 'upd-state');
      ld.setAttribute('role', 'status');
      ld.appendChild(el('span', 'upd-spin'));
      ld.appendChild(el('span', null, 'Checking GitHub…'));
      res.appendChild(ld);
    } else if (state.checking) {
      var ld2 = el('div', 'upd-state');
      ld2.setAttribute('role', 'status');
      ld2.appendChild(el('span', 'upd-spin'));
      ld2.appendChild(el('span', null, 'Checking GitHub…'));
      res.appendChild(ld2);
    } else if (!c) {
      res.appendChild(el('p', 'muted', 'No check yet.'));
    } else if (c.ok === false) {
      var er = el('div', 'upd-state upd-err');
      er.setAttribute('role', 'alert');
      er.appendChild(el('span', null, String(c.error || 'Update check failed.') + ' Try again later.'));
      res.appendChild(er);
    } else if (c.status === 'up-to-date') {
      res.appendChild(el('p', 'upd-good', 'You’re on the latest version.'));
      appendLatest(res, c.latest);
      if (c.note) res.appendChild(el('p', 'muted small', c.note));
    } else if (c.status === 'available') {
      var n = typeof c.behind_by === 'number' ? c.behind_by : null;
      var head = n == null ? 'An update is available'
        : n + (n === 1 ? ' update' : ' updates') + ' available';
      res.appendChild(el('p', 'upd-head', head));
      if (c.commits && c.commits.length) res.appendChild(commitList(c.commits));
      else appendLatest(res, c.latest);
      if (c.canApply) {
        var ub = el('button', 'w-btn w-btn-primary', 'Update & restart');
        ub.type = 'button';
        ub.addEventListener('click', function () { startApply(); });
        var row = el('div', 'w-btnrow');
        row.appendChild(ub);
        res.appendChild(row);
      } else if (!lan.local) {
        res.appendChild(el('p', 'muted small', 'Only the host can update — ask them to open Updates on their computer.'));
      }
      if (!c.canApply && c.note) res.appendChild(el('p', 'muted small', c.note));
    } else if (c.status === 'local-changes') {
      res.appendChild(el('p', null, 'This copy has changes that aren’t on GitHub yet, so it won’t auto-update.'));
      if (c.note && !/not on GitHub/i.test(c.note)) res.appendChild(el('p', 'muted small', c.note));
    } else {
      res.appendChild(el('p', 'muted', 'Unknown update status.'));
    }

    root.appendChild(footerLink());
  }

  function appendLatest(res, latest) {
    if (!latest || !(latest.message || latest.short)) return;
    var box = el('div', 'upd-latest');
    box.appendChild(el('div', 'upd-latest-h muted small', 'Latest commit'));
    var li = el('div', 'upd-commit');
    li.appendChild(el('code', 'upd-sha', latest.short || ''));
    li.appendChild(el('span', 'upd-msg', latest.message || ''));
    var when = latest.date ? relTime(latest.date) : '';
    if (when) li.appendChild(el('span', 'upd-when muted', when));
    box.appendChild(li);
    res.appendChild(box);
  }

  function footerLink() {
    var p = el('p', 'upd-foot muted small');
    var repo = typeof lan.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(lan.repo) ? lan.repo : '';
    if (repo) {
      var a = el('a', null, 'View commit history on GitHub');
      a.href = 'https://github.com/' + repo + '/commits/main';
      a.target = '_blank';
      a.rel = 'noopener';
      p.appendChild(a);
    }
    return p;
  }

  /* ---------------------------------------------------------------- apply */

  async function startApply() {
    if (state.applying || state.dead) return;
    var c = state.check;
    var latest = c && c.latest && c.latest.short ? c.latest.short : 'the latest version';
    var ok = true;
    try {
      if (window.UI && typeof UI.confirm === 'function') {
        ok = await UI.confirm('Update to ' + latest + ' and restart the server? Everyone will reconnect automatically.',
          { title: 'Update & restart', okLabel: 'Update & restart' });
      }
    } catch (_) { ok = false; }
    if (!ok) return;

    state.applyError = '';
    state.applyTimedOut = false;
    state.applying = true;
    renderPanel();

    var r = await api('/api/update/apply', { method: 'POST', headers: { 'X-CT-Update': '1' } });
    var j = r.json;
    if (!(j && j.ok === true)) {
      state.applying = false;
      state.applyError = (j && j.error) || (r.net ? 'Could not reach the server.' : 'Update failed (HTTP ' + r.status + ').');
      renderPanel();
      return;
    }
    waitForRestart();
  }

  async function waitForRestart() {
    var origSha = lan.sha || null;
    var origStarted = lan.started || null;
    var t0 = Date.now();
    // Give the server a moment to actually go down before polling.
    await new Promise(function (res) { setTimeout(res, 1500); });
    while (Date.now() - t0 < APPLY_TIMEOUT_MS) {
      var r = await api('/api/version');
      var j = r.json;
      if (r.ok && j && typeof j === 'object') {
        if ((j.sha || null) !== origSha || (j.started != null && j.started !== origStarted)) {
          try { location.reload(); } catch (_) { /* ignore */ }
          return;
        }
      }
      await new Promise(function (res) { setTimeout(res, APPLY_POLL_MS); });
    }
    state.applying = false;
    state.applyTimedOut = true;
    if (panel) renderPanel();
    else toast('The server didn’t come back — check the server window.', { kind: 'error', ms: 10000 });
  }

  /* ---------------------------------------------------------------- reload notice */

  function showReloadNotice() {
    if (state.noticeShown || state.applying) return;
    state.noticeShown = true;
    try {
      var bar = el('div', 'upd-notice');
      bar.setAttribute('role', 'status');
      bar.appendChild(el('span', null, 'The host updated the game — reload to get the new version'));
      var rb = el('button', 'upd-notice-btn', 'Reload');
      rb.type = 'button';
      rb.addEventListener('click', function () { location.reload(); });
      var xb = el('button', 'upd-notice-x', '✕');
      xb.type = 'button';
      xb.title = 'Dismiss';
      xb.setAttribute('aria-label', 'Dismiss');
      xb.addEventListener('click', function () { if (bar.parentNode) bar.parentNode.removeChild(bar); });
      bar.appendChild(rb);
      bar.appendChild(xb);
      document.body.appendChild(bar);
    } catch (_) { /* ignore */ }
  }

  async function pollVersion() {
    if (state.dead || state.noticeShown) return;
    var r = await api('/api/version');
    if (r.status === 404) { killUI(); return; }
    var j = r.json;
    if (!r.ok || !j || typeof j !== 'object') return; // down/restarting: ignore
    var shaChanged = (j.sha || null) !== (lan.sha || null);
    var verChanged = j.version != null && j.version !== lan.version;
    if (shaChanged || verChanged) showReloadNotice();
  }

  /* ---------------------------------------------------------------- start */

  function init() {
    try {
      setVersionText();
      mountButtons();
      pollVersion(); // also detects a missing API (404) and removes the buttons
      timers.push(setInterval(pollVersion, VERSION_POLL_MS));
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) pollVersion();
      });
      if (lan.local) {
        timers.push(setTimeout(autoCheck, FIRST_CHECK_DELAY_MS));
        timers.push(setInterval(autoCheck, CHECK_INTERVAL_MS));
      }
    } catch (e) { console.debug('[updates] init failed', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
