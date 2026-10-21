/* Local presentation of room chat. Messages and networking stay in app.js. */
(function () {
  'use strict';
  const KEY = 'ct.chatPanel';
  const normalize = value => {
    const p = value && typeof value === 'object' ? value : {};
    return { floating: p.floating === true, transparent: p.transparent === true,
      x: typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : null,
      y: typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : null };
  };
  function fit(prefs, viewport) {
    const width = Math.max(0, Math.min(360, viewport.width - 16));
    const height = Math.max(0, Math.min(480, viewport.height - 16));
    const left = viewport.left + 8, top = viewport.top + 8;
    const right = Math.max(left, viewport.left + viewport.width - width - 8);
    const bottom = Math.max(top, viewport.top + viewport.height - height - 8);
    return { width, height,
      x: Math.max(left, Math.min(right, prefs.x == null ? right : prefs.x)),
      y: Math.max(top, Math.min(bottom, prefs.y == null ? viewport.top + 58 : prefs.y)) };
  }
  let prefs = normalize(null), panel, handle, floatButton, clearButton, resetButton, dragging = null;
  function viewport() {
    const v = window.visualViewport;
    return { left: v ? v.offsetLeft : 0, top: v ? v.offsetTop : 0,
      width: v ? v.width : window.innerWidth, height: v ? v.height : window.innerHeight };
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) { /* preferences are optional */ }
  }
  function apply() {
    if (!panel) return;
    panel.classList.toggle('ct-chat-floating', prefs.floating);
    panel.classList.toggle('ct-chat-transparent', prefs.floating && prefs.transparent);
    floatButton.textContent = prefs.floating ? 'Dock' : 'Pop out';
    floatButton.setAttribute('aria-pressed', String(prefs.floating));
    floatButton.title = prefs.floating ? 'Return chat to its normal position' : 'Float chat over the game';
    clearButton.setAttribute('aria-pressed', String(prefs.floating && prefs.transparent));
    clearButton.title = 'Toggle a fully transparent floating chat background';
    resetButton.disabled = !prefs.floating;
    handle.tabIndex = prefs.floating ? 0 : -1;
    handle.setAttribute('aria-disabled', String(!prefs.floating));
    handle.title = prefs.floating ? 'Drag to move chat; arrow keys move 10px, Shift + arrows move 50px' : 'Choose Pop out to move chat';
    document.getElementById('chatSubtitle').textContent = prefs.floating ? 'Drag this heading to move' : 'Messages for everyone at the table';
    if (prefs.floating) {
      const r = fit(prefs, viewport());
      Object.assign(panel.style, { left: r.x + 'px', top: r.y + 'px', right: 'auto',
        width: r.width + 'px', height: r.height + 'px' });
    } else {
      for (const key of ['left', 'top', 'right', 'width', 'height']) panel.style.removeProperty(key);
    }
  }
  function endDrag(event, cancelled) {
    if (!dragging || (event && event.pointerId !== dragging.id)) return;
    const old = dragging; dragging = null;
    panel.classList.remove('ct-chat-moving');
    if (cancelled) { prefs.x = old.x; prefs.y = old.y; apply(); }
    else save();
    if (handle.hasPointerCapture(old.id)) handle.releasePointerCapture(old.id);
  }
  function init() {
    if (panel) return;
    panel = document.getElementById('chatPanel');
    handle = document.getElementById('chatMoveHandle');
    floatButton = document.getElementById('chatFloatToggle');
    clearButton = document.getElementById('chatTransparentToggle');
    resetButton = document.getElementById('chatResetPosition');
    if (!panel || !handle || !floatButton || !clearButton || !resetButton) { panel = null; return; }
    try { prefs = normalize(JSON.parse(window.localStorage.getItem(KEY) || 'null')); } catch (_) { prefs = normalize(null); }
    // Chat controls must not tap, move, attach, or target cards behind the panel.
    for (const type of ['pointerdown', 'click', 'dblclick', 'contextmenu']) panel.addEventListener(type, e => e.stopPropagation());
    floatButton.addEventListener('click', () => { endDrag(null, true); prefs.floating = !prefs.floating; save(); apply(); });
    clearButton.addEventListener('click', () => {
      prefs.transparent = !prefs.floating || !prefs.transparent;
      prefs.floating = true; save(); apply();
    });
    resetButton.addEventListener('click', () => { endDrag(null, true); prefs.x = null; prefs.y = null; save(); apply(); });
    handle.addEventListener('pointerdown', e => {
      if (!prefs.floating || dragging || e.button !== 0 || e.isPrimary === false) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      dragging = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, x: prefs.x, y: prefs.y };
      handle.setPointerCapture(e.pointerId);
      panel.classList.add('ct-chat-moving');
    });
    handle.addEventListener('pointermove', e => {
      if (!dragging || e.pointerId !== dragging.id) return;
      e.preventDefault();
      const r = fit({ x: e.clientX - dragging.dx, y: e.clientY - dragging.dy }, viewport());
      prefs.x = r.x; prefs.y = r.y; apply();
    });
    handle.addEventListener('pointerup', e => endDrag(e, false));
    handle.addEventListener('pointercancel', e => endDrag(e, true));
    handle.addEventListener('lostpointercapture', e => endDrag(e, true));
    handle.addEventListener('keydown', e => {
      if (!prefs.floating || e.ctrlKey || e.metaKey || e.altKey) return;
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[e.key]; if (!direction) return;
      e.preventDefault(); e.stopPropagation();
      const r = fit(prefs, viewport()), step = e.shiftKey ? 50 : 10;
      const moved = fit({ x: r.x + direction[0] * step, y: r.y + direction[1] * step }, viewport());
      prefs.x = moved.x; prefs.y = moved.y; save(); apply();
    });
    window.addEventListener('resize', apply);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', apply);
      window.visualViewport.addEventListener('scroll', apply);
    }
    apply();
  }
  function setOpen(open) { if (!open) endDrag(null, true); apply(); }
  window.CTChatPanel = { init, setOpen, normalize, fit };
})();
