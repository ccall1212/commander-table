/* Magnifier: hold V ("view"; Z is already face-down) to read every card under a circle that follows the cursor. */
(function () {
  'use strict';

  var STORE_KEY = 'ct.lensRadius';
  var DEFAULT_R = 90, MIN_R = 40, MAX_R = 260;
  var MAX_TILES = 16, GAP = 8, MARGIN = 12, MAX_TILE_W = 672;
  var ASPECT = 488 / 680;
  var SELECTOR = '#table .card, #myHand .card, #myZones .card';

  var radius = DEFAULT_R;
  try {
    var saved = parseFloat(localStorage.getItem(STORE_KEY));
    if (isFinite(saved)) radius = Math.max(MIN_R, Math.min(MAX_R, saved));
  } catch (e) { /* storage unavailable */ }

  var active = false;
  var activeCode = null;
  var mx = -1, my = -1;
  var rafId = 0;
  var lastKey = null;
  var lastTiles = [];
  var circle = null, panel = null;

  function log(e) { try { console.error('[lens]', e); } catch (_) { /* ignore */ } }

  function ensureEls() {
    if (!circle) {
      circle = document.createElement('div');
      circle.className = 'lens-circle';
      circle.style.display = 'none';
      document.body.appendChild(circle);
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'lens-panel';
      panel.style.display = 'none';
      document.body.appendChild(panel);
    }
  }

  function gameVisible() {
    var g = document.getElementById('game');
    return !!g && !g.classList.contains('hidden');
  }

  function typing() {
    var a = document.activeElement;
    if (!a) return false;
    var t = (a.tagName || '').toUpperCase();
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || !!a.isContentEditable;
  }

  function dragging() {
    try { return !!(window.CT && window.CT.dragState && window.CT.dragState()); }
    catch (e) { return false; }
  }

  function hiddenByAncestor(el) {
    try {
      if (getComputedStyle(el).visibility === 'hidden') return true;
      for (var n = el; n && n !== document.body; n = n.parentElement) {
        if (getComputedStyle(n).display === 'none') return true;
      }
    } catch (e) { return true; }
    return false;
  }

  function upgrade(src) {
    return src.replace('/normal/', '/large/').replace('/small/', '/large/');
  }

  function collect() {
    var list = document.querySelectorAll(SELECTOR);
    var seen = [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (seen.indexOf(el) !== -1) continue;
      seen.push(el);
      if (el.classList.contains('ghost')) continue;
      var r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      // distance from the centre to the closest point of the rect
      var dx = Math.max(r.left - mx, 0, mx - r.right);
      var dy = Math.max(r.top - my, 0, my - r.bottom);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > radius) continue;
      var img = el.querySelector('img');
      var src = img && (img.currentSrc || img.getAttribute('src') || img.src);
      if (!src) continue;
      if (hiddenByAncestor(el)) continue;
      out.push({
        d: d,
        orig: src,
        large: upgrade(src),
        alt: img.getAttribute('alt') || '',
        rot: img.classList.contains('rot')
      });
    }
    out.sort(function (a, b) { return a.d - b.d; });
    return out.slice(0, MAX_TILES);
  }

  function positionCircle() {
    if (!circle) return;
    circle.style.width = circle.style.height = (radius * 2) + 'px';
    circle.style.left = (mx - radius) + 'px';
    circle.style.top = (my - radius) + 'px';
  }

  function layout() {
    if (!panel) return;
    var n = lastTiles.length;
    if (!n) { panel.style.display = 'none'; return; }
    var vw = window.innerWidth, vh = window.innerHeight;
    var half = vw / 2;
    var pw = half - MARGIN * 2;
    var ph = vh - MARGIN * 2;
    var left = mx > half ? MARGIN : half + MARGIN;
    panel.style.display = 'flex';
    panel.style.left = left + 'px';
    panel.style.top = MARGIN + 'px';
    panel.style.width = pw + 'px';
    panel.style.height = ph + 'px';

    var pad = 10;
    var W = Math.max(40, pw - pad * 2), H = Math.max(40, ph - pad * 2);
    var best = 1, bestW = 0;
    for (var c = 1; c <= n; c++) {
      var rows = Math.ceil(n / c);
      var tw = Math.min((W - GAP * (c - 1)) / c, ((H - GAP * (rows - 1)) / rows) * ASPECT);
      if (tw > bestW) { bestW = tw; best = c; }
    }
    bestW = Math.max(20, Math.min(bestW, MAX_TILE_W));
    var tileH = bestW / ASPECT;
    var grid = panel.firstChild;
    if (!grid) return;
    grid.style.gridTemplateColumns = 'repeat(' + best + ', ' + bestW + 'px)';
    grid.style.gridAutoRows = tileH + 'px';
    grid.style.gap = GAP + 'px';
  }

  function render() {
    rafId = 0;
    try {
      if (!active) return;
      ensureEls();
      circle.style.display = 'block';
      positionCircle();
      var tiles = collect();
      var key = tiles.map(function (t) { return t.orig + (t.rot ? '|r' : ''); }).join('\n');
      if (key !== lastKey) {
        lastKey = key;
        lastTiles = tiles;
        while (panel.firstChild) panel.removeChild(panel.firstChild);
        if (tiles.length) {
          var grid = document.createElement('div');
          grid.className = 'lens-grid';
          tiles.forEach(function (t) {
            var tile = document.createElement('div');
            tile.className = 'lens-tile';
            var im = document.createElement('img');
            im.alt = t.alt;
            im.draggable = false;
            if (t.rot) im.className = 'rot';
            var fell = false;
            im.addEventListener('error', function () {
              if (fell) return;
              fell = true;
              im.src = t.orig;
            });
            im.src = t.large;
            tile.appendChild(im);
            grid.appendChild(tile);
          });
          panel.appendChild(grid);
        }
      }
      layout();
    } catch (e) { log(e); }
  }

  function schedule() {
    if (rafId) return;
    rafId = requestAnimationFrame(render);
  }

  function activate() {
    active = true;
    lastKey = null;
    lastTiles = [];
    document.body.classList.add('lens-on');
    ensureEls();
    render();
  }

  function deactivate() {
    if (!active && !document.body.classList.contains('lens-on')) return;
    active = false;
    activeCode = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    document.body.classList.remove('lens-on');
    if (circle) circle.style.display = 'none';
    if (panel) { panel.style.display = 'none'; while (panel.firstChild) panel.removeChild(panel.firstChild); }
    lastKey = null;
    lastTiles = [];
  }

  function onMove(e) {
    try {
      mx = e.clientX; my = e.clientY;
      if (active) schedule();
    } catch (err) { log(err); }
  }

  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('mousemove', onMove, { passive: true });

  document.addEventListener('keydown', function (e) {
    try {
      if (e.key === 'Escape') { deactivate(); return; }
      if (!window.CTHotkeys || !CTHotkeys.matches(e, 'lens')) return;
      if (e.repeat) { if (active) e.preventDefault(); return; }
      if (active) return;
      if (!gameVisible() || document.querySelector('.w-backdrop') || typing() || dragging()) return;
      e.preventDefault();
      activeCode = e.code || e.key;
      activate();
    } catch (err) { log(err); }
  });

  document.addEventListener('keyup', function (e) {
    try {
      if (activeCode && (e.code || e.key) === activeCode) deactivate();
    } catch (err) { log(err); }
  });

  window.addEventListener('blur', function () { try { deactivate(); } catch (e) { log(e); } });
  document.addEventListener('visibilitychange', function () {
    try { if (document.hidden) deactivate(); } catch (e) { log(e); }
  });
  window.addEventListener('resize', function () {
    try { if (active) schedule(); } catch (e) { log(e); }
  });

  window.Lens = {
    getRadius: function () { return radius; },
    setRadius: function (px) {
      var v = parseFloat(px);
      if (!isFinite(v)) return radius;
      radius = Math.max(MIN_R, Math.min(MAX_R, Math.round(v)));
      try { localStorage.setItem(STORE_KEY, String(radius)); } catch (e) { /* ignore */ }
      if (active) { lastKey = null; schedule(); }
      return radius;
    },
    isActive: function () { return active; }
  };
})();
