/* Local presentation of room chat. Messages and networking stay in app.js. */
(function () {
  'use strict';
  const KEY = 'ct.chatPanel';
  const normalize = value => {
    const p = value && typeof value === 'object' ? value : {};
    return { floating: p.floating === true, transparent: p.transparent === true,
      x: typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : null,
      y: typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : null,
      width: typeof p.width === 'number' && Number.isFinite(p.width) && p.width > 0 ? p.width : null,
      height: typeof p.height === 'number' && Number.isFinite(p.height) && p.height > 0 ? p.height : null };
  };
  function fit(prefs, viewport) {
    const width = Math.max(0, Math.min(Math.max(260, prefs.width || 360), viewport.width - 16));
    const height = Math.max(0, Math.min(Math.max(240, prefs.height || 480), viewport.height - 16));
    const left = viewport.left + 8, top = viewport.top + 8;
    const right = Math.max(left, viewport.left + viewport.width - width - 8);
    const bottom = Math.max(top, viewport.top + viewport.height - height - 8);
    return { width, height,
      x: Math.max(left, Math.min(right, prefs.x == null ? right : prefs.x)),
      y: Math.max(top, Math.min(bottom, prefs.y == null ? viewport.top + 58 : prefs.y)) };
  }
  let prefs = normalize(null), panel, handle, floatButton, clearButton, resetButton, resizeHandle, dragging = null;
  let idleTimer = null, open = false;
  const IDLE_MS = 8000;
  function viewport() {
    const v = window.visualViewport;
    return { left: v ? v.offsetLeft : 0, top: v ? v.offsetTop : 0,
      width: v ? v.width : window.innerWidth, height: v ? v.height : window.innerHeight };
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) { /* preferences are optional */ }
  }
  function armFade() {
    clearTimeout(idleTimer);
    if (!panel || !open || !prefs.floating || !prefs.transparent) return;
    idleTimer = setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (dragging || input.value.length) { armFade(); return; }
      panel.classList.add('ct-chat-idle');
      // Keep a focused control reachable rather than leaving focus in hidden chat.
      if (panel.contains(document.activeElement)) document.getElementById('chatWake').focus({ preventScroll: true });
    }, IDLE_MS);
  }
  function wake(focusInput) {
    if (!panel) return;
    panel.classList.remove('ct-chat-idle');
    armFade();
    if (focusInput && open) requestAnimationFrame(() => {
      if (open && !isFaded()) document.getElementById('chatInput').focus();
    });
  }
  function isFaded() { return !!panel && panel.classList.contains('ct-chat-idle'); }
  function apply() {
    if (!panel) return;
    panel.classList.toggle('ct-chat-floating', prefs.floating);
    panel.classList.toggle('ct-chat-transparent', prefs.floating && prefs.transparent);
    if (!prefs.floating || !prefs.transparent) { clearTimeout(idleTimer); panel.classList.remove('ct-chat-idle'); }
    floatButton.textContent = prefs.floating ? 'Dock' : 'Pop out';
    floatButton.setAttribute('aria-pressed', String(prefs.floating));
    floatButton.title = prefs.floating ? 'Return chat to its normal position' : 'Float chat over the game';
    clearButton.setAttribute('aria-pressed', String(prefs.floating && prefs.transparent));
    clearButton.title = 'Toggle a fully transparent floating chat background';
    resetButton.disabled = !prefs.floating;
    handle.tabIndex = prefs.floating ? 0 : -1;
    resizeHandle.tabIndex = prefs.floating ? 0 : -1;
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
    if (cancelled) { Object.assign(prefs, old.before); apply(); }
    else save();
    if (old.node.hasPointerCapture(old.id)) old.node.releasePointerCapture(old.id);
  }
  function init() {
    if (panel) return;
    panel = document.getElementById('chatPanel');
    handle = document.getElementById('chatMoveHandle');
    floatButton = document.getElementById('chatFloatToggle');
    clearButton = document.getElementById('chatTransparentToggle');
    resetButton = document.getElementById('chatResetPosition');
    resizeHandle = document.getElementById('chatResizeHandle');
    if (!panel || !handle || !floatButton || !clearButton || !resetButton || !resizeHandle) { panel = null; return; }
    try { prefs = normalize(JSON.parse(window.localStorage.getItem(KEY) || 'null')); } catch (_) { prefs = normalize(null); }
    // Chat controls must not tap, move, attach, or target cards behind the panel.
    for (const type of ['pointerdown', 'click', 'dblclick', 'contextmenu']) panel.addEventListener(type, e => e.stopPropagation());
    floatButton.addEventListener('click', () => { endDrag(null, true); prefs.floating = !prefs.floating; save(); apply(); wake(false); });
    clearButton.addEventListener('click', () => {
      endDrag(null, true);
      prefs.transparent = !prefs.floating || !prefs.transparent;
      prefs.floating = true; save(); apply(); wake(false);
    });
    resetButton.addEventListener('click', () => { endDrag(null, true); prefs.x = null; prefs.y = null; prefs.width = null; prefs.height = null; save(); apply(); wake(false); });
    document.getElementById('chatWake').addEventListener('click', () => wake(true));
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel', 'focusin']) {
      panel.addEventListener(type, e => {
        if (e.target.closest('#chatWake') || isFaded()) return;
        armFade();
      });
    }
    handle.addEventListener('pointerdown', e => {
      if (!prefs.floating || dragging || e.button !== 0 || e.isPrimary === false) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      dragging = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, before: { ...prefs }, node: handle };
      handle.setPointerCapture(e.pointerId);
      panel.classList.add('ct-chat-moving');
    });
    handle.addEventListener('pointermove', e => {
      if (!dragging || dragging.node !== handle || e.pointerId !== dragging.id) return;
      e.preventDefault();
      const r = fit({ ...prefs, x: e.clientX - dragging.dx, y: e.clientY - dragging.dy }, viewport());
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
      const moved = fit({ ...prefs, x: r.x + direction[0] * step, y: r.y + direction[1] * step }, viewport());
      prefs.x = moved.x; prefs.y = moved.y; save(); apply();
    });
    function resizeTo(width, height) {
      const v = viewport(), r = panel.getBoundingClientRect();
      prefs.width = Math.max(Math.min(260, v.width - 16), Math.min(width, v.left + v.width - r.left - 8));
      prefs.height = Math.max(Math.min(240, v.height - 16), Math.min(height, v.top + v.height - r.top - 8));
      // Pin the top-left while resizing, including the default right-aligned position.
      prefs.x = r.left; prefs.y = r.top; apply();
    }
    resizeHandle.addEventListener('pointerdown', e => {
      if (!prefs.floating || dragging || e.button !== 0 || e.isPrimary === false) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      dragging = { id: e.pointerId, node: resizeHandle, before: { ...prefs },
        startX: e.clientX, startY: e.clientY, width: r.width, height: r.height };
      resizeHandle.setPointerCapture(e.pointerId);
    });
    resizeHandle.addEventListener('pointermove', e => {
      if (!dragging || dragging.node !== resizeHandle || e.pointerId !== dragging.id) return;
      e.preventDefault();
      resizeTo(dragging.width + e.clientX - dragging.startX, dragging.height + e.clientY - dragging.startY);
    });
    resizeHandle.addEventListener('pointerup', e => endDrag(e, false));
    resizeHandle.addEventListener('pointercancel', e => endDrag(e, true));
    resizeHandle.addEventListener('lostpointercapture', e => endDrag(e, true));
    resizeHandle.addEventListener('keydown', e => {
      if (!prefs.floating || e.ctrlKey || e.metaKey || e.altKey) return;
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[e.key]; if (!direction) return;
      e.preventDefault(); e.stopPropagation();
      const r = panel.getBoundingClientRect(), step = e.shiftKey ? 50 : 10;
      resizeTo(r.width + direction[0] * step, r.height + direction[1] * step); save(); armFade();
    });
    window.addEventListener('resize', apply);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', apply);
      window.visualViewport.addEventListener('scroll', apply);
    }
    apply();
  }
  function setOpen(value) {
    open = !!value;
    if (!open) endDrag(null, true);
    apply(); wake(false);
  }
  window.CTChatPanel = { init, setOpen, normalize, fit, wake, isFaded };
})();
