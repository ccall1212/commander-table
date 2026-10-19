/* widgets.js — UI helpers for the Commander tabletop app.
 * Exposes exactly one global: window.UI
 *   UI.esc, UI.menu, UI.closeMenu, UI.toast, UI.prompt, UI.confirm,
 *   UI.modal, UI.viewer, UI.printPicker, UI.cardInfo, UI.cardBackHTML
 * Classic script (works from file://), no dependencies. Styles live in css/widgets.css.
 */
(function () {
  'use strict';

  const UI = {};
  window.UI = UI;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** HTML-escape any value (safe for text nodes and quoted attributes). */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  UI.esc = esc;

  /** Tiny element factory. `text` is set via textContent (always safe). */
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  let uid = 0;

  /* ------------------------------------------------------------------ */
  /* Card back                                                           */
  /* ------------------------------------------------------------------ */

  /** CSS-only card back; fills its container. Styled in widgets.css. */
  UI.cardBackHTML = function (extraClass, backId) {
    const art = backId && window.CTAppearance
      ? '<span class="w-cardback-art" style="' + esc(window.CTAppearance.cardBackStyle(backId)) + '"></span>'
      : '';
    // Keep the built-in card back underneath so a failed image leaves a visible fallback.
    return '<div class="w-cardback' + (extraClass ? ' ' + esc(extraClass) : '') + '">' + art + '</div>';
  };

  /* ------------------------------------------------------------------ */
  /* Context menu                                                        */
  /* ------------------------------------------------------------------ */

  let menuState = null; // the single open menu, if any

  function closeMenu() {
    if (menuState) menuState.close();
  }
  UI.closeMenu = closeMenu;

  /** Position a fixed panel so it stays inside the viewport (flip left/up as needed). */
  function placePanel(panel, x, y, anchor) {
    const M = 6;
    const vw = window.innerWidth, vh = window.innerHeight;
    panel.style.visibility = 'hidden';
    panel.style.left = '0px';
    panel.style.top = '0px';
    const w = panel.offsetWidth, hh = panel.offsetHeight;
    let left, top;
    if (anchor) {
      // Submenu: to the right of the parent item, else flipped to its left.
      left = anchor.right - 2;
      if (left + w > vw - M) left = anchor.left - w + 2;
      top = anchor.top - 5;
      if (top + hh > vh - M) top = anchor.bottom - hh + 5;
    } else {
      left = x;
      top = y;
      if (left + w > vw - M) left = x - w;
      if (top + hh > vh - M) top = y - hh;
    }
    left = Math.max(M, Math.min(left, vw - w - M));
    top = Math.max(M, Math.min(top, vh - hh - M));
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.visibility = '';
  }

  /**
   * UI.menu(x, y, items) -> { close() }
   * items: {label, onClick?, hint?, disabled?, danger?, sub?: items[], sep?: true, checked?: bool}
   */
  UI.menu = function (x, y, items) {
    closeMenu();
    items = Array.isArray(items) ? items.filter(Boolean) : [];
    const state = { close };
    if (!items.length) return { close() {} };

    const panels = [];   // panels[depth]; each has ._rows = [{el, item, depth}]
    let closed = false;
    let closeTimer = null; // grace period before a submenu closes (lets the mouse travel diagonally)

    function closeFrom(depth) {
      while (panels.length > depth) panels.pop().remove();
      const last = panels[panels.length - 1];
      if (last) last.querySelectorAll('.w-open').forEach((n) => n.classList.remove('w-open'));
    }

    function setActive(panel, row) {
      panel._rows.forEach((r) => r.el.classList.toggle('w-active', r === row));
    }

    function build(list, depth, px, py, anchor) {
      const panel = h('div', 'w-menu');
      panel.setAttribute('role', 'menu');
      panel._rows = [];
      // Reserve a check column only if some item uses `checked`.
      const anyChecked = list.some((i) => typeof i.checked === 'boolean');
      list.forEach((item) => {
        if (item.sep) { panel.appendChild(h('div', 'w-menu-sep')); return; }
        const el = h('div', 'w-menu-item');
        el.setAttribute('role', 'menuitem');
        if (item.disabled) { el.classList.add('w-disabled'); el.setAttribute('aria-disabled', 'true'); }
        if (item.danger) el.classList.add('w-danger');
        if (item.sub) el.classList.add('w-has-sub');
        if (anyChecked) el.appendChild(h('span', 'w-menu-check', item.checked ? '✓' : ''));
        el.appendChild(h('span', 'w-menu-label', item.label));
        if (item.hint) el.appendChild(h('span', 'w-menu-hint', item.hint));
        if (item.sub) el.appendChild(h('span', 'w-menu-arrow', '▸'));
        const row = { el, item, depth };
        panel._rows.push(row);
        el.addEventListener('mouseenter', () => {
          setActive(panel, row);
          clearTimeout(closeTimer);
          if (item.sub && !item.disabled) openSub(row);
          else if (panels.length > depth + 1) closeTimer = setTimeout(() => closeFrom(depth + 1), 180);
        });
        el.addEventListener('click', (e) => { e.stopPropagation(); activate(row); });
        panel.appendChild(el);
      });
      panel.addEventListener('mouseenter', () => clearTimeout(closeTimer));
      document.body.appendChild(panel);
      panels.push(panel);
      placePanel(panel, px, py, anchor);
      return panel;
    }

    function openSub(row) {
      clearTimeout(closeTimer);
      const d = row.depth;
      if (panels[d + 1] && panels[d + 1]._owner === row.el) return; // already open
      closeFrom(d + 1);
      row.el.classList.add('w-open');
      const p = build(row.item.sub, d + 1, 0, 0, row.el.getBoundingClientRect());
      p._owner = row.el;
    }

    function activate(row) {
      if (row.item.disabled) return;
      if (row.item.sub) { openSub(row); return; } // click-to-open for touch
      close();
      if (typeof row.item.onClick === 'function') row.item.onClick();
    }

    function activeRow(panel) {
      return panel._rows.find((r) => r.el.classList.contains('w-active'));
    }

    function move(panel, dir) {
      const rows = panel._rows.filter((r) => !r.item.disabled);
      if (!rows.length) return;
      const cur = rows.indexOf(activeRow(panel));
      const next = cur < 0 ? (dir > 0 ? 0 : rows.length - 1) : (cur + dir + rows.length) % rows.length;
      setActive(panel, rows[next]);
    }

    function stop(e) { e.preventDefault(); e.stopPropagation(); }

    // --- global dismissal listeners (capture phase so we run before the app) ---
    const onDown = (e) => { if (!panels.some((p) => p.contains(e.target))) close(); };
    const onScroll = (e) => { if (!panels.some((p) => p.contains(e.target))) close(); };
    const onBlur = () => close();
    const onKey = (e) => {
      const panel = panels[panels.length - 1];
      switch (e.key) {
        case 'Escape': stop(e); close(); break;
        case 'ArrowDown': stop(e); move(panel, 1); break;
        case 'ArrowUp': stop(e); move(panel, -1); break;
        case 'ArrowRight': {
          const row = activeRow(panel);
          if (row && row.item.sub && !row.item.disabled) {
            stop(e);
            openSub(row);
            const sp = panels[row.depth + 1];
            if (sp) move(sp, 1);
          }
          break;
        }
        case 'ArrowLeft':
          if (panels.length > 1) { stop(e); closeFrom(panels.length - 1); }
          break;
        case 'Enter':
        case ' ': {
          const row = activeRow(panel);
          if (row) { stop(e); activate(row); }
          break;
        }
        case 'Tab': close(); break;
        default: break;
      }
    };

    function close() {
      if (closed) return;
      closed = true;
      clearTimeout(closeTimer);
      closeFrom(0);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
      window.removeEventListener('scroll', onScroll, true);
      if (menuState === state) menuState = null;
    }

    build(items, 0, x, y, null);
    menuState = state;
    // Dismiss on pointerdown so mouse, pen, and touch interactions all close the menu
    // before the outside target handles the same interaction. Keep mousedown as a fallback.
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    window.addEventListener('scroll', onScroll, true);
    return { close };
  };

  /* ------------------------------------------------------------------ */
  /* Toasts                                                              */
  /* ------------------------------------------------------------------ */

  let toastBox = null;
  const MAX_TOASTS = 4;

  /** UI.toast(text, {ms=3500, action?:{label,onClick}, kind?:'info'|'warn'|'error'}) -> {close()} */
  UI.toast = function (text, opts) {
    opts = opts || {};
    const ms = opts.ms == null ? 3500 : opts.ms;
    const kind = opts.kind === 'warn' || opts.kind === 'error' ? opts.kind : 'info';
    if (!toastBox || !toastBox.isConnected) {
      toastBox = h('div', 'w-toasts');
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    const t = h('div', 'w-toast w-toast-' + kind);
    t.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    t.appendChild(h('span', 'w-toast-text', text));

    let timer = null;
    function dismiss() {
      if (t._gone) return;
      t._gone = true;
      clearTimeout(timer);
      t.classList.add('w-out');
      setTimeout(() => t.remove(), 180);
    }
    t._dismiss = dismiss;

    if (opts.action && opts.action.label) {
      const b = h('button', 'w-toast-btn', opts.action.label);
      b.type = 'button';
      b.addEventListener('click', () => {
        try { if (typeof opts.action.onClick === 'function') opts.action.onClick(); }
        finally { dismiss(); }
      });
      t.appendChild(b);
    }
    toastBox.appendChild(t);

    // Cap the visible stack: dismiss the oldest first.
    const live = Array.from(toastBox.children).filter((c) => !c._gone);
    while (live.length > MAX_TOASTS) live.shift()._dismiss();

    if (ms > 0) timer = setTimeout(dismiss, ms);
    return { close: dismiss };
  };

  /* ------------------------------------------------------------------ */
  /* Modal shell                                                         */
  /* ------------------------------------------------------------------ */

  const modalStack = [];

  const FOCUSABLE = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

  function trapTab(top, e) {
    const f = Array.from(top.dialog.querySelectorAll(FOCUSABLE))
      .filter((n) => !n.disabled && n.getClientRects().length > 0);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!top.dialog.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && (a === first || a === top.dialog)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  // One permanent listener; only the top-most modal reacts.
  // (Bubble phase on document: an open UI.menu swallows Escape earlier, in the capture phase.)
  document.addEventListener('keydown', (e) => {
    const top = modalStack[modalStack.length - 1];
    if (!top) return;
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      if (top._onEscape && top._onEscape(e)) return; // handler consumed it
      top.close();
    } else if (e.key === 'Tab') {
      trapTab(top, e);
    }
  });

  /**
   * UI.modal({title, html?, el?, wide?, onClose?}) -> {el (body), close()}
   * Extras: dialog, head (header slot for extra content), titleEl, root.
   * Internal options: className, onEscape() -> true if it handled Escape.
   * `html` is inserted raw — callers must esc() any untrusted text.
   */
  function makeModal(o) {
    o = o || {};
    const prevFocus = document.activeElement;
    const root = h('div', 'w-backdrop');
    const dialog = h('div', 'w-dialog' + (o.wide ? ' w-wide' : '') + (o.className ? ' ' + o.className : ''));
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;

    const head = h('div', 'w-modal-head');
    const titleEl = h('h2', 'w-modal-title', o.title || '');
    const extra = h('div', 'w-modal-extra');
    const x = h('button', 'w-modal-x', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    head.append(titleEl, extra, x);

    const body = h('div', 'w-modal-body');
    if (o.el) body.appendChild(o.el);
    else if (o.html != null) body.innerHTML = o.html;

    dialog.append(head, body);
    root.appendChild(dialog);
    document.body.appendChild(root);

    let closed = false;
    const api = { el: body, dialog, head: extra, titleEl, root, close, _onEscape: o.onEscape };

    function close() {
      if (closed) return;
      closed = true;
      const i = modalStack.indexOf(api);
      if (i >= 0) modalStack.splice(i, 1);
      root.remove();
      if (typeof o.onClose === 'function') {
        try { o.onClose(); } catch (err) { console.error(err); }
      }
      if (prevFocus && prevFocus.isConnected && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      }
    }

    x.addEventListener('click', close);
    // Close on backdrop click, but not when a drag started inside the dialog.
    let downOnBackdrop = false;
    root.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === root; });
    root.addEventListener('click', (e) => { if (e.target === root && downOnBackdrop) close(); });

    modalStack.push(api);
    const af = body.querySelector('[autofocus]');
    (af || dialog).focus();
    return api;
  }

  UI.modal = function (o) {
    const m = makeModal(o);
    return { el: m.el, close: m.close, dialog: m.dialog, head: m.head, titleEl: m.titleEl };
  };

  /* ------------------------------------------------------------------ */
  /* prompt / confirm                                                    */
  /* ------------------------------------------------------------------ */

  /** UI.prompt({title,label?,value?,type?,min?,max?,okLabel?}) -> Promise<string|number|null> */
  UI.prompt = function (o) {
    o = o || {};
    return new Promise((resolve) => {
      const isNum = o.type === 'number';
      let done = false;
      const form = h('form', 'w-form');
      form.noValidate = true;
      const id = 'w-prompt-' + (++uid);
      if (o.label) {
        const l = h('label', 'w-label', o.label);
        l.htmlFor = id;
        form.appendChild(l);
      }
      const input = h('input', 'w-input');
      input.id = id;
      input.type = isNum ? 'number' : 'text';
      input.autocomplete = 'off';
      if (isNum) {
        if (o.min != null) input.min = o.min;
        if (o.max != null) input.max = o.max;
      }
      if (o.value != null) input.value = o.value;
      form.appendChild(input);

      const row = h('div', 'w-btnrow');
      const cancel = h('button', 'w-btn', 'Cancel');
      cancel.type = 'button';
      const ok = h('button', 'w-btn w-btn-primary', o.okLabel || 'OK');
      ok.type = 'submit';
      row.append(cancel, ok);
      form.appendChild(row);

      const m = makeModal({
        title: o.title || '',
        el: form,
        onClose() { if (!done) { done = true; resolve(null); } }, // Esc / backdrop / X
      });
      function finish(v) {
        if (done) return;
        done = true;
        resolve(v);
        m.close();
      }
      cancel.addEventListener('click', () => finish(null));
      input.addEventListener('input', () => input.classList.remove('w-invalid'));
      form.addEventListener('submit', (e) => {
        e.preventDefault(); // Enter = OK
        if (!isNum) { finish(input.value); return; }
        const raw = input.value.trim();
        let n = Number(raw);
        if (raw === '' || !isFinite(n)) { input.classList.add('w-invalid'); input.focus(); return; }
        if (o.min != null && o.min !== '') n = Math.max(Number(o.min), n);
        if (o.max != null && o.max !== '') n = Math.min(Number(o.max), n);
        finish(n);
      });
      input.focus();
      input.select();
    });
  };

  /** UI.confirm(text, {okLabel='OK', danger=false}?) -> Promise<boolean> */
  UI.confirm = function (text, o) {
    o = o || {};
    return new Promise((resolve) => {
      let done = false;
      const wrap = h('div', 'w-form');
      wrap.appendChild(h('p', 'w-confirm-text', text));
      const row = h('div', 'w-btnrow');
      const cancel = h('button', 'w-btn', 'Cancel');
      cancel.type = 'button';
      const ok = h('button', 'w-btn ' + (o.danger ? 'w-btn-danger' : 'w-btn-primary'), o.okLabel || 'OK');
      ok.type = 'button';
      row.append(cancel, ok);
      wrap.appendChild(row);
      const m = makeModal({
        title: o.title || 'Confirm',
        el: wrap,
        onClose() { if (!done) { done = true; resolve(false); } },
      });
      function finish(v) {
        if (done) return;
        done = true;
        resolve(v);
        m.close();
      }
      cancel.addEventListener('click', () => finish(false));
      ok.addEventListener('click', () => finish(true));
      (o.danger ? cancel : ok).focus(); // destructive prompts default to Cancel
    });
  };

  /* ------------------------------------------------------------------ */
  /* Zone viewer                                                         */
  /* ------------------------------------------------------------------ */

  const TYPES = ['Creature', 'Land', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];
  const OTHER = 'Other';
  const TYPE_RES = TYPES.map((t) => new RegExp('\\b' + t.toLowerCase() + '\\b'));

  /** Categories a card belongs to (front + back face types; a card can be in several). */
  function categorize(def) {
    const s = ((def.type || '') + ' ' + (def.backType || '')).toLowerCase();
    const out = [];
    TYPES.forEach((t, i) => { if (TYPE_RES[i].test(s)) out.push(t); });
    if (!out.length) out.push(OTHER);
    return out;
  }

  function typeRank(rec) {
    let best = 99;
    rec.cats.forEach((c) => { const i = TYPES.indexOf(c); if (i >= 0 && i < best) best = i; });
    return best;
  }

  const PERM_RE = /\b(Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/;
  /** Permanent card (front or back face type). Everything else, incl. unknown type, is non-permanent. */
  function isPermanent(def) { return PERM_RE.test((def.type || '') + ' ' + (def.backType || '')); }

  function nameOf(rec) { return rec.d.name || rec.d.face || ''; }
  function cmpName(a, b) { return nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' }); }

  /** Styled stand-in for a card without an image (or whose image failed to load). */
  function placeholder(d) {
    const p = h('div', 'w-vph');
    p.innerHTML =
      '<div class="w-vph-name">' + esc(d.name || d.face || 'Unknown card') + '</div>' +
      (d.type ? '<div class="w-vph-type">' + esc(d.type) + '</div>' : '') +
      (d.pt ? '<div class="w-vph-pt">' + esc(d.pt) + '</div>' : '');
    return p;
  }

  UI.viewer = function (opts) {
    opts = opts || {};
    const actions = Array.isArray(opts.actions) ? opts.actions : [];
    const pick = opts.pick || null;
    const pickCount = pick ? Math.max(0, Number(pick.count) | 0) : 0;

    // ---- state ----
    let cards = [];           // as given by the app
    let recs = [];            // normalised records, zone order
    let recByIid = new Map();
    let displayed = [];       // records currently shown (filtered + sorted)
    let query = '';
    let sortKey = 'zone';
    let hi = -1;              // keyboard highlight index into `displayed`
    let selected = [];        // pick mode: iids in selection order
    let closed = false;
    let menuTimer = null;
    let hoverIid = null;
    let remoteTimer = null;
    let remoteSeq = 0;
    let remoteLoading = false;
    let remoteError = '';
    const typeOn = new Set();
    const useTabs = !!opts.tabs;
    let tabKey = 'all';       // 'all' | 'perm' | 'non' (only used when opts.tabs)
    const elCache = new Map(); // iid -> {el, sig}  (reused so images are not reloaded on every keystroke)

    // ---- DOM ----
    const root = h('div', 'w-v' + (pick ? ' w-v-pick' : ''));

    const toolbar = h('div', 'w-v-toolbar');
    const search = h('input', 'w-input w-v-search');
    search.type = 'text';
    search.placeholder = opts.searchPlaceholder || 'Search name, type or rules text…';
    search.setAttribute('aria-label', 'Search cards');
    search.autocomplete = 'off';
    search.spellcheck = false;
    const sortWrap = h('label', 'w-v-sortwrap');
    sortWrap.appendChild(h('span', 'w-v-sortlabel', 'Sort'));
    const sortSel = h('select', 'w-select w-v-sort');
    [['zone', 'Deck order'], ['name', 'Name'], ['type', 'Card type'], ['color', 'Color identity'], ['cmc', 'Mana value']].forEach(([v, l]) => {
      const op = h('option', null, l);
      op.value = v;
      sortSel.appendChild(op);
    });
    sortWrap.appendChild(sortSel);
    toolbar.append(search, sortWrap);

    // Optional All / Permanents / Non-permanents tab row (above the search box).
    const tabBar = h('div', 'w-v-tabs');
    const tabs = [];
    if (useTabs) {
      tabBar.setAttribute('role', 'tablist');
      tabBar.setAttribute('aria-label', 'Card kind');
      [['all', 'All'], ['perm', 'Permanents'], ['non', 'Non-permanents']].forEach(([key, label], i) => {
        const el = h('button', 'w-tab');
        el.type = 'button';
        el.setAttribute('role', 'tab');
        el.setAttribute('aria-selected', 'false');
        el.title = label + ' (Alt+' + (i + 1) + ')';
        const num = h('span', 'w-tab-num', '0');
        el.append(h('span', 'w-tab-label', label), num);
        el.addEventListener('click', () => setTab(key));
        tabBar.appendChild(el);
        tabs.push({ key, label, el, num });
      });
    }

    const chipBar = h('div', 'w-v-chips');
    const chips = TYPES.concat(OTHER).map((t) => {
      const el = h('button', 'w-chip');
      el.type = 'button';
      el.setAttribute('aria-pressed', 'false');
      const num = h('span', 'w-chip-num', '0');
      el.append(h('span', 'w-chip-label', t), num);
      el.addEventListener('click', () => {
        if (typeOn.has(t)) typeOn.delete(t); else typeOn.add(t);
        hi = -1;
        render();
      });
      chipBar.appendChild(el);
      return { type: t, el, num };
    });

    const scroller = h('div', 'w-v-scroll');
    const grid = h('div', 'w-v-grid');
    grid.tabIndex = 0;
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', 'Cards');
    if (pick) grid.setAttribute('aria-multiselectable', 'true');
    const emptyEl = h('div', 'w-v-empty', 'No cards');
    scroller.append(grid, emptyEl);

    const footer = h('div', 'w-v-footer');
    let confirmBtn = null;
    if (pick) {
      const cancel = h('button', 'w-btn', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', () => close());
      confirmBtn = h('button', 'w-btn w-btn-primary', 'Confirm');
      confirmBtn.type = 'button';
      confirmBtn.addEventListener('click', confirmPick);
      footer.append(cancel, confirmBtn);
    } else {
      // Note: in pick mode the footer is replaced by Cancel/Confirm.
      (Array.isArray(opts.footer) ? opts.footer : []).forEach((f) => {
        const b = h('button', 'w-btn' + (f.primary ? ' w-btn-primary' : ''), f.label);
        b.type = 'button';
        b.addEventListener('click', () => { if (typeof opts.onFooter === 'function') opts.onFooter(f.key); });
        footer.appendChild(b);
      });
    }
    if (!footer.children.length) footer.hidden = true;

    if (useTabs) root.append(tabBar);
    root.append(toolbar, chipBar, scroller, footer);

    // Header extras: card count + pick status.
    const countEl = h('span', 'w-v-count');
    const pickPrompt = h('span', 'w-v-pickprompt');
    const pickCountEl = h('span', 'w-v-pickcount');

    const modal = makeModal({
      title: opts.title || 'Cards',
      el: root,
      wide: true,
      className: 'w-viewer-dialog',
      onEscape() {
        if (query) { // first Escape clears the search
          search.value = '';
          query = '';
          hi = -1;
          render();
          search.focus();
          return true;
        }
        return false;
      },
      onClose() {
        closed = true;
        document.removeEventListener('keydown', onDocKey);
        clearTimeout(menuTimer);
        clearTimeout(remoteTimer);
        remoteSeq++;
        closeMenu();
        if (typeof opts.onClose === 'function') opts.onClose();
      },
    });
    modal.head.append(countEl);
    if (pick) {
      pickPrompt.textContent = pick.prompt || '';
      modal.head.append(pickPrompt, pickCountEl);
    }

    // ---- data ----
    function setCards(list) {
      cards = Array.isArray(list) ? list : [];
      recs = cards.map((c, i) => {
        const d = c.def || {};
        return {
          c, d, iid: c.iid, pos: i, cats: categorize(d), perm: isPermanent(d),
          // One lowercase haystack per card; every search term must appear in it.
          hay: [d.name, d.face, d.backName, d.type, d.backType, d.oracle].filter(Boolean).join('\n').toLowerCase(),
        };
      });
      recByIid = new Map(recs.map((r) => [r.iid, r]));
      for (const k of Array.from(elCache.keys())) if (!recByIid.has(k)) elCache.delete(k);
      selected = selected.filter((iid) => recByIid.has(iid));
    }

    function searchMatches() {
      const terms = typeof opts.searchProvider === 'function' ? [] : query.toLowerCase().split(/\s+/).filter(Boolean);
      let base = recs;
      if (useTabs && tabKey !== 'all') base = recs.filter((r) => r.perm === (tabKey === 'perm'));
      return terms.length ? base.filter((r) => terms.every((t) => r.hay.includes(t))) : base.slice();
    }

    function setTab(key) {
      if (!useTabs || tabKey === key) return;
      tabKey = key;
      hi = -1;
      render();
    }

    // ---- rendering ----
    function cardEl(r) {
      const d = r.d, fd = !!r.c.faceDown;
      const posText = opts.ordered ? String(r.pos + 1) : '';
      const posLabel = opts.ordered && r.pos === 0 && opts.orderLabel ? opts.orderLabel : '';
      const sig = [d.id, d.name, d.img, fd ? 1 : 0, posText, posLabel, opts.showQuantity ? r.c.qty : ''].join('|');
      const cached = elCache.get(r.iid);
      if (cached && cached.sig === sig) return cached.el;

      const name = d.name || d.face || 'Unknown card';
      const el = h('div', 'w-vcard' + (fd ? ' w-fd' : ''));
      el.dataset.iid = r.iid;
      el.setAttribute('role', 'option');
      el.setAttribute('aria-label', name);

      const art = h('div', 'w-vcard-art');
      if (fd) {
        art.innerHTML = UI.cardBackHTML();
      } else if (d.img) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;
        img.alt = name;
        img.addEventListener('error', () => img.replaceWith(placeholder(d)));
        img.src = d.img;
        art.appendChild(img);
      } else {
        art.appendChild(placeholder(d));
      }
      el.appendChild(art);

      if (opts.ordered || (opts.showQuantity && Number(r.c.qty) > 1)) {
        const badgeText = opts.ordered ? posText : '×' + String(r.c.qty);
        const badge = h('div', 'w-vcard-pos', badgeText);
        if (posLabel) badge.appendChild(h('small', null, posLabel));
        el.appendChild(badge);
      }
      if (pick) el.appendChild(h('div', 'w-vcard-check', '✓'));
      if (opts.removeKey) {
        const remove = h('button', 'w-vcard-remove', '×');
        remove.type = 'button';
        remove.title = 'Remove one copy from the deck';
        remove.setAttribute('aria-label', 'Remove one copy of ' + name);
        remove.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof opts.onAction === 'function') opts.onAction(opts.removeKey, r.iid);
        });
        el.appendChild(remove);
      }
      el.appendChild(h('div', 'w-vcard-name', name));

      elCache.set(r.iid, { el, sig });
      return el;
    }

    /** Re-apply selection / highlight classes (cheap; no DOM rebuild). */
    function syncMarks() {
      const sel = new Set(selected);
      displayed.forEach((r, i) => {
        const ent = elCache.get(r.iid);
        if (!ent) return;
        ent.el.classList.toggle('w-sel', sel.has(r.iid));
        ent.el.classList.toggle('w-hi', i === hi);
        ent.el.setAttribute('aria-selected', sel.has(r.iid) ? 'true' : 'false');
      });
      if (pick) {
        pickCountEl.textContent = selected.length + '/' + pickCount + ' selected';
        confirmBtn.disabled = selected.length !== pickCount;
      }
    }

    /** Rebuild list. By default scroll resets to top; update() passes keepScroll. */
    function render(o2) {
      const keepScroll = !!(o2 && o2.keepScroll);
      const prevScroll = scroller.scrollTop;

      if (useTabs) {
        const permN = recs.filter((r) => r.perm).length;
        const tabCounts = { all: recs.length, perm: permN, non: recs.length - permN };
        tabs.forEach((t) => {
          const on = t.key === tabKey;
          t.num.textContent = tabCounts[t.key];
          t.el.classList.toggle('w-on', on);
          t.el.setAttribute('aria-selected', on ? 'true' : 'false');
          t.el.tabIndex = on ? 0 : -1;
        });
      }

      const searched = searchMatches(); // search + active tab

      // Chip counts reflect the current search; active chips stay visible so they can be un-toggled.
      const counts = {};
      searched.forEach((r) => r.cats.forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
      chips.forEach((ch) => {
        const n = counts[ch.type] || 0;
        const on = typeOn.has(ch.type);
        ch.num.textContent = n;
        ch.el.hidden = n === 0 && !on;
        ch.el.classList.toggle('w-on', on);
        ch.el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      chipBar.hidden = recs.length === 0;

      const list = typeOn.size ? searched.filter((r) => r.cats.some((c) => typeOn.has(c))) : searched;
      const colorKey = d => {
        const ci = Array.isArray(d.ci) ? d.ci : [];
        return ['W', 'U', 'B', 'R', 'G'].filter(c => ci.indexOf(c) !== -1).join('') || '0';
      };
      if (sortKey === 'name') list.sort((a, b) => cmpName(a, b) || a.pos - b.pos);
      else if (sortKey === 'cmc') list.sort((a, b) => ((a.d.cmc || 0) - (b.d.cmc || 0)) || cmpName(a, b) || a.pos - b.pos);
      else if (sortKey === 'type') list.sort((a, b) => (typeRank(a) - typeRank(b)) || cmpName(a, b) || a.pos - b.pos);
      else if (sortKey === 'color') list.sort((a, b) => colorKey(a.d).localeCompare(colorKey(b.d)) || cmpName(a, b) || a.pos - b.pos);
      // 'zone': already in deck order
      displayed = list;

      const total = recs.length, n = displayed.length;
      countEl.textContent = n === total ? total + (total === 1 ? ' card' : ' cards') : 'Showing ' + n + ' of ' + total;

      const frag = document.createDocumentFragment();
      displayed.forEach((r) => frag.appendChild(cardEl(r)));
      grid.textContent = '';
      grid.appendChild(frag);
      emptyEl.hidden = n > 0;
      if (n > 0) emptyEl.textContent = '';
      else if (remoteLoading) emptyEl.textContent = 'Searching Scryfall…';
      else if (remoteError) emptyEl.textContent = remoteError;
      else if (typeof opts.searchProvider === 'function')
        emptyEl.textContent = query.trim().length < 2 ? 'Type at least 2 characters to search.' : 'No matching cards';
      else emptyEl.textContent = total === 0 ? 'No cards' : 'No matches';
      if (typeof opts.searchProvider === 'function') {
        countEl.textContent = remoteLoading ? 'Searching…' : (remoteError ? 'Search failed' : (n + (n === 1 ? ' result' : ' results')));
      }

      if (hi >= n) hi = n - 1;
      scroller.scrollTop = keepScroll ? prevScroll : 0;
      syncMarks();
    }

    // ---- interaction ----
    function hover(iid) {
      const r = recByIid.get(iid);
      if (r && typeof opts.onHover === 'function') opts.onHover(r.d, !!r.c.faceDown);
    }

    function openMenu(iid, x, y) {
      if (!actions.length) return;
      UI.menu(x, y, actions.map((a) => ({
        label: a.label,
        hint: a.hint,
        onClick() { if (typeof opts.onAction === 'function') opts.onAction(a.key, iid); },
      })));
    }

    function toggleSel(iid) {
      const i = selected.indexOf(iid);
      if (i >= 0) selected.splice(i, 1);
      else if (pickCount === 1) selected = [iid]; // single pick: clicking another card swaps
      else selected.push(iid);
      syncMarks();
    }

    function confirmPick() {
      if (selected.length !== pickCount) return;
      const list = selected.slice();
      list.forEach((iid) => { if (typeof opts.onAction === 'function') opts.onAction(pick.actionKey, iid); });
      close();
    }

    /** Enter / activate for the card at displayed[i] (keyboard path). */
    function activateIndex(i) {
      const r = displayed[i];
      if (!r) return;
      if (pick) { toggleSel(r.iid); return; }
      const el = elCache.get(r.iid).el.getBoundingClientRect();
      openMenu(r.iid, el.left + 24, el.top + 48);
    }

    function cols() {
      const first = grid.firstElementChild;
      if (!first) return 1;
      const top = first.offsetTop;
      let n = 0;
      for (const c of grid.children) { if (c.offsetTop !== top) break; n++; }
      return Math.max(1, n);
    }

    function moveHi(next) {
      if (!displayed.length) return;
      hi = Math.max(0, Math.min(displayed.length - 1, next));
      syncMarks();
      elCache.get(displayed[hi].iid).el.scrollIntoView({ block: 'nearest' });
      hover(displayed[hi].iid);
    }

    grid.addEventListener('click', (e) => {
      const el = e.target.closest('.w-vcard');
      if (!el) return;
      const r = recByIid.get(el.dataset.iid);
      if (!r) return;
      hi = displayed.indexOf(r);
      syncMarks();
      if (pick) { toggleSel(r.iid); return; }
      if (typeof opts.onCardClick === 'function') {
        if (e.detail === 1) opts.onCardClick(r.d, r.iid, e);
        return;
      }
      if (!actions.length || e.detail > 1) return; // 2nd click of a double-click
      clearTimeout(menuTimer);
      const x = e.clientX, y = e.clientY;
      // With a double-click action, wait briefly so the menu doesn't flash up first.
      if (opts.primary) menuTimer = setTimeout(() => openMenu(r.iid, x, y), 230);
      else openMenu(r.iid, x, y);
    });

    grid.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // never show the browser menu over the viewer
      if (pick || !actions.length) return;
      const el = e.target.closest('.w-vcard');
      if (!el) return;
      const r = recByIid.get(el.dataset.iid);
      if (!r) return;
      clearTimeout(menuTimer);
      openMenu(r.iid, e.clientX, e.clientY);
    });

    grid.addEventListener('dblclick', (e) => {
      if (pick) return;
      const el = e.target.closest('.w-vcard');
      if (!el || !opts.primary) return;
      clearTimeout(menuTimer);
      closeMenu();
      if (typeof opts.onAction === 'function') opts.onAction(opts.primary, el.dataset.iid);
    });

    grid.addEventListener('mouseover', (e) => {
      const el = e.target.closest('.w-vcard');
      if (!el || el.dataset.iid === hoverIid) return;
      hoverIid = el.dataset.iid;
      hover(hoverIid);
    });
    grid.addEventListener('mouseleave', () => { hoverIid = null; });

    grid.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); moveHi(hi < 0 ? 0 : hi + 1); break;
        case 'ArrowLeft': e.preventDefault(); moveHi(hi < 0 ? 0 : hi - 1); break;
        case 'ArrowDown': e.preventDefault(); moveHi(hi < 0 ? 0 : hi + cols()); break;
        case 'ArrowUp':
          e.preventDefault();
          if (hi >= 0 && hi < cols()) search.focus(); // up from the first row goes back to the search box
          else moveHi(hi < 0 ? 0 : hi - cols());
          break;
        case 'Home': e.preventDefault(); moveHi(0); break;
        case 'End': e.preventDefault(); moveHi(displayed.length - 1); break;
        case 'Enter': if (hi >= 0) { e.preventDefault(); activateIndex(hi); } break;
        case ' ': if (pick && hi >= 0) { e.preventDefault(); toggleSel(displayed[hi].iid); } break;
        default: break;
      }
    });

    search.addEventListener('input', onSearchInput);
    function onSearchInput() {
      query = search.value;
      hi = -1;
      if (typeof opts.searchProvider !== 'function') { render(); return; }
      clearTimeout(remoteTimer);
      const seq = ++remoteSeq;
      remoteError = '';
      const needle = query.trim();
      if (needle.length < 2) {
        remoteLoading = false;
        setCards([]);
        render();
        return;
      }
      remoteLoading = true;
      setCards([]);
      render();
      remoteTimer = setTimeout(() => {
        Promise.resolve().then(() => opts.searchProvider(needle)).then((found) => {
          if (closed || seq !== remoteSeq) return;
          remoteLoading = false;
          const items = Array.isArray(found) ? found : [];
          setCards(items.map((d, i) => ({ iid: 'search-' + String(d.id || i), def: d } )));
          render();
        }).catch((err) => {
          if (closed || seq !== remoteSeq) return;
          remoteLoading = false;
          remoteError = err && err.message ? err.message : 'Scryfall search failed. Try again.';
          setCards([]);
          render();
        });
      }, 280);
    }
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        grid.focus({ preventScroll: true });
        moveHi(Math.max(hi, 0));
      } else if (e.key === 'Enter') {
        // Enter acts on the highlighted card, or on the only match.
        const i = hi >= 0 ? hi : (displayed.length === 1 ? 0 : -1);
        if (i >= 0) { e.preventDefault(); activateIndex(i); }
      }
    });

    sortSel.addEventListener('change', () => { sortKey = sortSel.value; hi = -1; render(); });

    // Typing anywhere (while this is the top modal and no menu is open) goes into the search box.
    function onDocKey(e) {
      if (closed || menuState || modalStack[modalStack.length - 1] !== modal) return;
      if (useTabs && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^Digit[123]$/.test(e.code || '')) {
        e.preventDefault();
        setTab(tabs[Number(e.code.slice(5)) - 1].key);
        return;
      }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (e.key === ' ' && (tag === 'BUTTON' || !query)) return; // Space activates buttons; no leading spaces
      e.preventDefault();
      search.focus();
      search.value += e.key;
      onSearchInput();
    }
    document.addEventListener('keydown', onDocKey);

    function close() { modal.close(); }

    // ---- go ----
    setCards(opts.cards);
    render();
    search.focus();

    return {
      /** Replace the card list; keeps search, filters, sort, scroll, highlight (where possible). */
      update(newCards) {
        if (closed) return;
        setCards(newCards);
        render({ keepScroll: true });
      },
      close,
    };
  };

  /* ------------------------------------------------------------------ */
  /* Print picker                                                        */
  /* ------------------------------------------------------------------ */

  const IMG_PREFIX = 'https://cards.scryfall.io/';

  /**
   * UI.printPicker({title, prints, currentId, onPick(def, scope), showAll}) -> {close()}
   * prints: CardDef[] (id, name, img, set, setName, cn, year, rarity, finishes), newest first.
   * scope: 'one' (just this card) | 'all' (every copy). Up/Down moves the highlight, Enter = "Use this printing".
   */
  UI.printPicker = function (opts) {
    opts = opts || {};
    const prints = (Array.isArray(opts.prints) ? opts.prints : []).filter(Boolean);
    const showAll = !!opts.showAll;
    let hi = Math.max(0, prints.findIndex((d) => d.id === opts.currentId));
    const rows = [];

    const content = h('div', 'w-pp-content');
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'w-pp-search';
    search.placeholder = 'Search sets, products, collector numbers, or years…';
    search.setAttribute('aria-label', 'Search card printings by set, product, collector number, or year');
    search.autocomplete = 'off';
    if (prints.length) content.appendChild(search);

    const list = h('div', 'w-pp-list');
    list.setAttribute('role', 'list');
    const empty = h('div', 'w-v-empty', prints.length ? 'No printings match that search.' : 'No other printings found');
    empty.hidden = !!prints.length;
    list.appendChild(empty);

    function pick(def, scope) {
      try { if (typeof opts.onPick === 'function') opts.onPick(def, scope); }
      finally { modal.close(); }
    }

    prints.forEach((d, i) => {
      const isCur = d.id === opts.currentId;
      const name = d.name || 'Unknown card';
      const row = h('div', 'w-pp-row' + (isCur ? ' w-pp-cur' : ''));
      row.setAttribute('role', 'listitem');
      row.dataset.search = [
        d.name, d.setName, d.set, d.cn, d.year, d.rarity,
        Array.isArray(d.finishes) ? d.finishes.join(' ') : ''
      ].filter(Boolean).join(' ').toLowerCase();

      const art = h('div', 'w-pp-art');
      const hasImg = typeof d.img === 'string' && d.img.indexOf(IMG_PREFIX) === 0;
      const ph = () => h('div', 'w-pp-ph', name);
      if (hasImg) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;
        img.alt = name + (d.setName ? ' (' + d.setName + ')' : '');
        img.addEventListener('error', () => img.replaceWith(ph()));
        img.src = d.img;
        art.appendChild(img);
      } else {
        art.appendChild(ph());
      }
      if (isCur) art.appendChild(h('div', 'w-pp-check', '✓'));

      const info = h('div', 'w-pp-info');
      info.appendChild(h('div', 'w-pp-set', d.setName || (d.set ? String(d.set).toUpperCase() : 'Unknown set')));
      const rar = d.rarity ? String(d.rarity).charAt(0).toUpperCase() + String(d.rarity).slice(1) : '';
      const code = d.set ? String(d.set).toUpperCase() + (d.cn ? ' (' + d.cn + ')' : '') : (d.cn ? '(' + d.cn + ')' : '');
      info.appendChild(h('div', 'w-pp-meta', [rar, code].filter(Boolean).join(' · ')));
      if (Array.isArray(d.finishes) && d.finishes.length) {
        info.appendChild(h('div', 'w-pp-meta', d.finishes.map((f) => String(f).charAt(0).toUpperCase() + String(f).slice(1)).join(', ')));
      }

      const btns = h('div', 'w-pp-btns');
      const useBtn = h('button', 'w-btn w-btn-primary', isCur ? 'Current' : 'Use this printing');
      useBtn.type = 'button';
      useBtn.disabled = isCur;
      useBtn.addEventListener('click', () => pick(d, 'one'));
      btns.appendChild(useBtn);
      if (showAll) {
        const allBtn = h('button', 'w-btn', opts.allLabel || 'Use for all copies');
        allBtn.type = 'button';
        allBtn.addEventListener('click', () => pick(d, 'all'));
        btns.appendChild(allBtn);
      }
      info.appendChild(btns);

      if (d.year) row.appendChild(h('span', 'w-pp-year', d.year));
      row.append(art, info);
      row.addEventListener('mouseenter', () => { if (!row.hidden) { hi = i; sync(false); } });
      list.appendChild(row);
      rows.push(row);
    });

    function visibleIndexes() {
      return rows.map((r, i) => r.hidden ? -1 : i).filter((i) => i >= 0);
    }

    function sync(scroll) {
      rows.forEach((r, i) => r.classList.toggle('w-pp-hi', !r.hidden && i === hi));
      const visible = visibleIndexes();
      empty.hidden = visible.length > 0;
      if (scroll && rows[hi] && !rows[hi].hidden) rows[hi].scrollIntoView({ block: 'nearest' });
    }

    function filterPrints() {
      const query = search.value.trim().toLowerCase();
      rows.forEach((row) => { row.hidden = !!query && !row.dataset.search.includes(query); });
      const visible = visibleIndexes();
      if (visible.length && !visible.includes(hi)) hi = visible[0];
      sync(false);
    }
    search.addEventListener('input', filterPrints);

    content.appendChild(list);
    const modal = makeModal({
      title: opts.title || 'Switch printing',
      el: content,
      wide: true,
      className: 'w-pp-dialog',
      onClose() { document.removeEventListener('keydown', onKey); },
    });

    function onKey(e) {
      if (modalStack[modalStack.length - 1] !== modal || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !rows.length || e.target === search) return;
      const visible = visibleIndexes();
      if (!visible.length) return;
      const current = visible.indexOf(hi);
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = visible[Math.min(visible.length - 1, Math.max(0, current) + 1)]; sync(true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = visible[Math.max(0, current < 0 ? 0 : current - 1)]; sync(true); }
      else if (e.key === 'Enter') {
        const t = e.target;
        if (t && t.tagName === 'BUTTON') return; // a focused button handles Enter itself
        const d = prints[hi];
        if (d && d.id !== opts.currentId) { e.preventDefault(); pick(d, 'one'); }
      }
    }
    document.addEventListener('keydown', onKey);

    sync(true);
    return { close() { modal.close(); } };
  };
  /* ------------------------------------------------------------------ */
  /* Card info                                                           */
  /* ------------------------------------------------------------------ */

  const SYMBOL_BASE = 'https://svgs.scryfall.io/card-symbols/';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const FORMATS = [
    ['commander', 'Commander'], ['standard', 'Standard'], ['pioneer', 'Pioneer'], ['modern', 'Modern'],
    ['legacy', 'Legacy'], ['vintage', 'Vintage'], ['pauper', 'Pauper'],
  ];

  /** Escape first, then turn {X} tokens (restricted charset only) into inline symbol images. */
  function withSymbols(s) {
    return esc(s).replace(/\{([A-Z0-9½∞\/]+)\}/g, (m, t) =>
      '<img class="w-ci-sym" src="' + SYMBOL_BASE + encodeURIComponent(t.replace(/\//g, '')) + '.svg" alt="{' + t + '}" loading="lazy" draggable="false">');
  }

  /** Paragraphs (one per line) with symbols; returns an HTML string. */
  function paragraphsHTML(text) {
    return String(text == null ? '' : text).split('\n').filter((l) => l.trim() !== '')
      .map((l) => '<p>' + withSymbols(l) + '</p>').join('');
  }

  function fmtDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (!m) return String(s || '');
    const mo = MONTHS[Number(m[2]) - 1];
    return mo ? mo + ' ' + Number(m[3]) + ', ' + m[1] : String(s);
  }

  function fmtPrice(v) {
    if (v == null || v === '') return '';
    const n = Number(v);
    return isFinite(n) ? '$' + n.toFixed(2) : '';
  }

  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  /**
   * UI.cardInfo(info) -> {close(), set(info), error(msg)}
   * Pass {loading: true, name} first and call .set(info) once the data arrives.
   */
  UI.cardInfo = function (info) {
    info = info || {};
    const root = h('div', 'w-ci');
    const modal = makeModal({
      title: info.name || (info.loading ? 'Card' : 'Card details'),
      el: root,
      className: 'w-ci-dialog',
      onClose() { closed = true; },
    });
    let closed = false;

    function render(d) {
      root.textContent = '';
      if (closed) return;
      if (d.name) modal.titleEl.textContent = d.name;

      /* ---- left column ---- */
      const left = h('div', 'w-ci-left');
      const okImg = (u) => typeof u === 'string' && u.indexOf(IMG_PREFIX) === 0;
      const front = okImg(d.img) ? d.img : '';
      const back = okImg(d.imgBack) ? d.imgBack : '';
      const art = h('div', 'w-ci-art');
      left.appendChild(art);
      let showBack = false;
      function paintArt() {
        const url = showBack ? back : front;
        art.textContent = '';
        if (!url) { art.appendChild(h('div', 'w-ci-ph', d.name || 'No image')); return; }
        const img = document.createElement('img');
        img.className = 'w-ci-img';
        img.decoding = 'async';
        img.draggable = false;
        img.alt = (d.name || 'Card') + (showBack ? ' (back)' : '');
        img.addEventListener('error', () => img.replaceWith(h('div', 'w-ci-ph', d.name || 'Image unavailable')));
        img.src = url;
        art.appendChild(img);
      }
      paintArt();
      if (back) {
        const tog = h('button', 'w-btn w-ci-flip', 'Show back');
        tog.type = 'button';
        tog.addEventListener('click', () => {
          showBack = !showBack;
          tog.textContent = showBack ? 'Show front' : 'Show back';
          paintArt();
        });
        left.appendChild(tog);
      }

      let setLine = d.setName || (d.set ? String(d.set).toUpperCase() : '');
      if (d.setName && d.set) setLine += ' (' + String(d.set).toUpperCase() + ')';
      if (d.cn) setLine += (setLine ? ' ' : '') + '#' + d.cn;
      if (setLine || d.rarity) {
        const meta = h('div', 'w-ci-meta');
        meta.appendChild(h('span', 'w-ci-metaset', setLine));
        if (d.rarity) meta.appendChild(h('span', 'w-ci-rarity', cap(d.rarity)));
        left.appendChild(meta);
      }
      if (d.artist) left.appendChild(h('div', 'w-ci-meta w-ci-artist', 'Illustrated by ' + d.artist));

      const leg = d.legalities && typeof d.legalities === 'object' ? d.legalities : null;
      if (leg) {
        left.appendChild(h('div', 'w-ci-heading', 'Legality'));
        const row = h('div', 'w-ci-legal');
        FORMATS.forEach(([key, label]) => {
          const st = leg[key];
          if (!st) return;
          let cls = 'w-ci-chip w-ci-not', suffix = ' · Not legal';
          if (st === 'legal') { cls = 'w-ci-chip w-ci-ok'; suffix = ''; }
          else if (st === 'banned') { cls = 'w-ci-chip w-ci-banned'; suffix = ' · Banned'; }
          else if (st === 'restricted') { cls = 'w-ci-chip w-ci-restricted'; suffix = ' · Restricted'; }
          row.appendChild(h('span', cls, label + suffix));
        });
        left.appendChild(row);
      }

      const priceTxt = fmtPrice(d.priceUsd);
      const foilTxt = fmtPrice(d.priceUsdFoil);
      const href = typeof d.scryfallUri === 'string' && /^https?:\/\//i.test(d.scryfallUri) ? d.scryfallUri : '';
      if (priceTxt || foilTxt || href) {
        const label = [priceTxt, foilTxt ? 'Foil ' + foilTxt : ''].filter(Boolean).join(' · ') || 'View on Scryfall';
        let box;
        if (href) {
          box = h('a', 'w-ci-price w-ci-link', label);
          box.href = href;
          box.target = '_blank';
          box.rel = 'noopener';
          if (priceTxt || foilTxt) box.title = 'View on Scryfall';
        } else {
          box = h('div', 'w-ci-price', label);
        }
        left.appendChild(box);
      }

      /* ---- right column ---- */
      const right = h('div', 'w-ci-right');
      let faces = Array.isArray(d.faces) ? d.faces.filter(Boolean) : [];
      if (!faces.length) faces = [{ name: d.name, manaCost: d.manaCost, typeLine: d.typeLine }];
      faces.forEach((f) => {
        const face = h('section', 'w-ci-face');
        if (faces.length > 1) {
          const hd = h('div', 'w-ci-facehead');
          hd.appendChild(h('span', 'w-ci-facename', f.name || ''));
          if (f.manaCost) {
            const mc = h('span', 'w-ci-cost');
            mc.innerHTML = withSymbols(f.manaCost);
            hd.appendChild(mc);
          }
          face.appendChild(hd);
        } else if (f.manaCost) {
          const mc = h('div', 'w-ci-cost w-ci-cost-solo');
          mc.innerHTML = withSymbols(f.manaCost);
          face.appendChild(mc);
        }
        if (f.typeLine) face.appendChild(h('div', 'w-ci-type', f.typeLine));
        if (f.oracle) {
          const o = h('div', 'w-ci-oracle');
          o.innerHTML = paragraphsHTML(f.oracle);
          face.appendChild(o);
        }
        if (f.flavor) {
          const fl = h('div', 'w-ci-flavor');
          fl.innerHTML = paragraphsHTML(f.flavor);
          face.appendChild(fl);
        }
        const hasPT = f.power != null && f.power !== '' && f.toughness != null && f.toughness !== '';
        if (hasPT) face.appendChild(h('div', 'w-ci-pt', f.power + '/' + f.toughness));
        else if (f.loyalty != null && f.loyalty !== '') face.appendChild(h('div', 'w-ci-pt', 'Loyalty: ' + f.loyalty));
        right.appendChild(face);
      });

      right.appendChild(h('div', 'w-ci-heading', 'Rulings'));
      const rulings = Array.isArray(d.rulings) ? d.rulings.filter((r) => r && r.text) : [];
      if (!rulings.length) {
        right.appendChild(h('div', 'w-ci-none', 'No rulings.'));
      } else {
        rulings.forEach((r) => {
          const b = h('div', 'w-ci-ruling');
          const t = h('div', 'w-ci-rtext');
          t.innerHTML = withSymbols(r.text);
          b.appendChild(t);
          if (r.date) b.appendChild(h('div', 'w-ci-rdate', fmtDate(r.date)));
          right.appendChild(b);
        });
      }

      root.append(left, right);
    }

    function showLoading() {
      root.textContent = '';
      const box = h('div', 'w-ci-state');
      box.setAttribute('role', 'status');
      box.append(h('span', 'w-ci-spin'), h('span', null, 'Loading card details…'));
      root.appendChild(box);
    }

    if (info.loading) showLoading(); else render(info);

    return {
      close() { modal.close(); },
      set(d) { if (!closed) render(d || {}); },
      error(msg) {
        if (closed) return;
        root.textContent = '';
        const box = h('div', 'w-ci-state w-ci-error', msg ? String(msg) : 'Could not load card details.');
        box.setAttribute('role', 'alert');
        root.appendChild(box);
      },
    };
  };
})();
