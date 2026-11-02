/* Sync code: move saved decks between your own computers with a short code. No accounts.
 *
 * Make a 9-character code on one computer; type it on another to get the same decks. Your decks are scrambled
 * (AES-GCM) in this browser with a key made from the code before they go anywhere, and stored on the game's relay
 * under an ID made from the same code, so the relay only ever holds unreadable text. The code is saved in this
 * browser so it only has to be typed once per computer. Downloading uses the same merge rules as restoring a backup
 * (nothing is deleted); uploading replaces the synced copy, and asks first if that would drop decks.
 * Server side: relay/worker.js (sync-v1); protocol: docs/relay-protocol.md. */
(function () {
  'use strict';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // the same 32 letters and digits as room codes: no 0, 1, I or O
  const CODE_LENGTH = 9;
  const STATE_KEY = 'ct.sync';
  const MAX_STORED = 8000000; // the most the relay accepts (encrypted, base64 text): decks plus the uploaded pictures
  const bytesOf = text => new TextEncoder().encode(text);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fail = (code, message) => { const e = new Error(message || code); e.code = code; throw e; };

  // ---- The code ----------------------------------------------------------------------------------
  function generateCode() {
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes); // 256 is a multiple of 32, so every letter is equally likely
    return Array.from(bytes, b => ALPHABET[b & 31]).join('');
  }
  const formatCode = code => String(code).replace(/(.{3})(?=.)/g, '$1-'); // K7M-4QX-9TD
  // Typed codes may have any capitalization, spaces or hyphens. Returns the 9 letters, or null.
  function parseCode(input) {
    const s = String(input == null ? '' : input).toUpperCase().replace(/[\s-]+/g, '');
    return s.length === CODE_LENGTH && Array.from(s).every(c => ALPHABET.includes(c)) ? s : null;
  }
  function codeProblem(input) {
    const s = String(input == null ? '' : input).toUpperCase().replace(/[\s-]+/g, '');
    if (!s) return 'Type your sync code first.';
    const bad = Array.from(s).find(c => !ALPHABET.includes(c));
    if (bad) return 'A sync code never contains "' + bad + '". Codes use the letters A to Z (not I or O) and the numbers 2 to 9. Check for a look-alike.';
    if (s.length !== CODE_LENGTH) return 'A sync code has ' + CODE_LENGTH + ' letters and numbers; this has ' + s.length + '.';
    return '';
  }

  // ---- Scrambling: the relay never sees the code or the key ----------------------------------------------
  const toB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  async function keysFor(code) {
    // The box ID and the key come from the code in separate ways, so the ID does not give away the key.
    const idBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', bytesOf('commander-table-sync-id:' + code)));
    const id = Array.from(idBytes.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
    const base = await crypto.subtle.importKey('raw', bytesOf(code), 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: bytesOf('commander-table-sync-salt'), info: bytesOf('aes-gcm-256') },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { id, key };
  }
  async function pipe(bytes, stream) {
    const writer = stream.writable.getWriter(); writer.write(bytes); writer.close();
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  }
  async function seal(code, plain) {
    const { key } = await keysFor(code);
    let data = bytesOf(plain), c = 'none';
    if (typeof CompressionStream === 'function') { data = await pipe(data, new CompressionStream('gzip')); c = 'gzip'; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    return { v: 1, c, iv: toB64(iv), ct: toB64(ct) };
  }
  async function unseal(code, blob) {
    if (!blob || blob.v !== 1 || typeof blob.iv !== 'string' || typeof blob.ct !== 'string') fail('wrong-code');
    let data;
    try {
      const { key } = await keysFor(code);
      data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.ct)));
    } catch (_) { fail('wrong-code'); }
    if (blob.c === 'gzip') {
      if (typeof DecompressionStream !== 'function') fail('unsupported');
      try { data = await pipe(data, new DecompressionStream('gzip')); } catch (_) { fail('wrong-code'); }
    }
    return new TextDecoder().decode(data);
  }

  // ---- Talking to the relay ----------------------------------------------------------------------------
  function relay() {
    const net = window.Net, url = net && typeof net.relayUrl === 'function' ? net.relayUrl() : '';
    if (!url) fail('unavailable');
    return url;
  }
  async function request(id, method, body, query) {
    let res;
    try { res = await fetch(relay() + '/sync/' + id + (query || ''), { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body, cache: 'no-store' }); }
    catch (e) { if (e && e.code) throw e; fail('offline'); }
    let data = null;
    try { data = await res.json(); } catch (_) { /* no body */ }
    return { status: res.status, data };
  }
  function check(r) { // turn the relay's answers into our own error codes
    if (r.status >= 200 && r.status < 300) return r.data || {};
    if (r.status === 404) fail('not-found');
    if (r.status === 410) fail('replaced');
    if (r.status === 429) fail('busy');
    if (r.status === 400 || r.status === 413) fail('too-big');
    if (r.status === 501) fail('unavailable');
    fail('server');
  }
  // 'yes', 'no' (the relay does not offer sync yet) or 'offline'
  async function available() {
    let url;
    try { url = relay(); } catch (_) { return 'no'; }
    try {
      const res = await fetch(url + '/health', { cache: 'no-store' });
      const data = await res.json();
      return Array.isArray(data.features) && data.features.includes('sync-v1') ? 'yes' : 'no';
    } catch (_) { return 'offline'; }
  }

  // ---- What gets synced ----------------------------------------------------------------------------------
  // Decks and preferences, including the card back and background pictures you uploaded (they are saved WebP text).
  function collectionText(withPictures) {
    const backup = CTBackup.create(window.localStorage);
    if (!withPictures) delete backup.preferences['ct.appearance.custom'];
    return JSON.stringify(backup);
  }
  function hasPictures() {
    try { const c = JSON.parse(window.localStorage.getItem('ct.appearance.custom') || 'null'); return !!(c && (c.cardBack || c.background)); } catch (_) { return false; }
  }
  // If everything together is too big for the relay, the pictures are left out (and the caller says so) rather than failing.
  async function sealCollection(code) {
    let blob = await seal(code, collectionText(true)), picturesLeftOut = false;
    if (blob.ct.length > MAX_STORED && hasPictures()) { blob = await seal(code, collectionText(false)); picturesLeftOut = true; }
    if (blob.ct.length > MAX_STORED) fail('too-big');
    return { blob, picturesLeftOut };
  }
  async function fetchCollection(code) {
    const { id } = await keysFor(code);
    const data = check(await request(id, 'GET'));
    return CTBackup.parse(await unseal(code, data));
  }
  async function upload(code) {
    const { blob, picturesLeftOut } = await sealCollection(code);
    const { id } = await keysFor(code);
    return Object.assign({}, check(await request(id, 'PUT', JSON.stringify(blob))), { picturesLeftOut });
  }
  // A new code that nobody is using.
  async function freshCode() {
    for (let i = 0; i < 6; i++) {
      const code = generateCode(), { id } = await keysFor(code), r = await request(id, 'GET');
      if (r.status === 404) return code;
      if (r.status === 501) fail('unavailable');
      if (r.status === 429) fail('busy');
      if (r.status !== 200 && r.status !== 410) fail('server'); // 200 or 410: someone already has this code, so try another
    }
    fail('server');
  }
  async function createNew() {
    if (!decks().length) fail('no-decks');
    const code = await freshCode();
    const result = await upload(code);
    setState({ code, uploadedAt: result.updatedAt || Date.now() });
    return { code, picturesLeftOut: result.picturesLeftOut };
  }
  // The synced copy moves to a new code; the old code then answers "replaced".
  async function rotate() {
    const old = getState().code, code = await freshCode();
    const result = await upload(code);
    setState({ code, uploadedAt: result.updatedAt || Date.now() });
    if (old) { try { await request((await keysFor(old)).id, 'DELETE', undefined, '?mode=replaced'); } catch (_) { /* the new code already works */ } }
    return { code, picturesLeftOut: result.picturesLeftOut };
  }
  async function deleteCopy() {
    const code = getState().code;
    if (code) check(await request((await keysFor(code)).id, 'DELETE'));
    forget();
  }

  // ---- What this browser remembers (the code is never put in file backups) -----------------------------
  function getState() { try { const v = JSON.parse(window.localStorage.getItem(STATE_KEY) || 'null'); return v && parseCode(v.code) ? { code: parseCode(v.code), uploadedAt: +v.uploadedAt || 0, downloadedAt: +v.downloadedAt || 0 } : {}; } catch (_) { return {}; } }
  function setState(patch) { try { window.localStorage.setItem(STATE_KEY, JSON.stringify(Object.assign({}, getState(), patch))); } catch (_) { /* storage is optional */ } }
  function forget() { try { window.localStorage.removeItem(STATE_KEY); } catch (_) { /* ignore */ } }
  function decks() { try { const v = JSON.parse(window.localStorage.getItem('ct.decks.v1') || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } }

  // ---- The window ---------------------------------------------------------------------------------------
  const MESSAGES = {
    offline: "Can't reach the game's server. Check your internet connection and try again.",
    unavailable: "Sync isn't available on the game's server yet.",
    'not-found': 'No decks were found for that code. Check it for typos. A code that has not been used for six months is removed.',
    replaced: 'This code was replaced by a newer one. Type your new code below.',
    'wrong-code': "The saved decks couldn't be opened with this code. If you made a new code on another computer, use that one.",
    'too-big': 'Your collection is too large to sync, even without your uploaded pictures. Remove decks you no longer use and try again.',
    busy: 'Too many saves from this connection just now. Wait a while and try again.',
    server: 'The server could not do that right now. Try again in a moment.',
    unsupported: "This browser can't open that copy (it needs a newer browser).",
    'no-decks': "You don't have any decks on this computer yet. Import a deck first, or use a code from another computer."
  };
  const LEFT_OUT = ' Your uploaded pictures were left out because everything together was too large to sync.';
  const say = (el, text, kind) => { el.textContent = text || ''; el.dataset.kind = kind || ''; };

  function open() {
    const el = document.createElement('div');
    el.className = 'sync-dialog';
    el.innerHTML = '<p class="sync-intro">Keep your decks on more than one computer with a short code. No account needed.</p>' +
      '<p class="muted small sync-includes">Your name, display settings and look come along too: the card back and background you chose, and the one card back picture and one background picture you can upload in Your look (the game keeps one of each).</p>' +
      '<div data-sync-body><p class="muted">Checking…</p></div>' +
      '<div class="sync-result" data-sync-result></div>' +
      '<p class="sync-status" data-sync-status role="status" aria-live="polite"></p>' +
      '<details class="sync-privacy"><summary>How your decks are protected</summary>' +
      '<p class="muted small">Your decks are scrambled in this browser, using a key made from your code, before they are saved on the game\'s server, so the server only holds unreadable data. Anyone who has your code can read and replace your synced decks, so keep it to yourself. If you lose the code it cannot be recovered; the decks on your computers stay where they are, and you can make a new code.</p></details>';
    const body = el.querySelector('[data-sync-body]'), result = el.querySelector('[data-sync-result]'), status = el.querySelector('[data-sync-status]');
    let pending = null, busy = false, revealed = false, closed = false;

    const setBusy = on => { busy = on; el.setAttribute('aria-busy', on ? 'true' : 'false'); el.querySelectorAll('button, input').forEach(x => { x.disabled = on; }); };
    async function guard(task) {
      if (busy || closed) return;
      setBusy(true); say(status, '');
      try { await task(); }
      catch (e) {
        say(status, MESSAGES[e && e.code] || (e && e.message) || MESSAGES.server, 'error');
        if (e && e.code === 'replaced') { revealed = false; render(); say(status, MESSAGES.replaced, 'error'); const more = el.querySelector('.sync-more'); if (more) more.open = true; const input = el.querySelector('#ctSyncCodeIn'); if (input) input.focus(); }
      }
      finally { if (!closed) setBusy(false); }
    }
    const typedCode = () => { const input = el.querySelector('#ctSyncCodeIn'); const value = input ? input.value : ''; const code = parseCode(value); if (!code) fail('bad-code', codeProblem(value)); return code; };
    const when = t => t ? new Date(t).toLocaleString() : 'not yet';

    function render() {
      result.innerHTML = ''; pending = null;
      const s = getState();
      const enter = '<div class="sync-block"><label for="ctSyncCodeIn"><b>' + (s.code ? 'Use a different code' : 'Already have a code?') + '</b></label>' +
        '<div class="sync-row"><input id="ctSyncCodeIn" class="sync-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="14" placeholder="ABC-DEF-GHJ">' +
        '<button type="button" data-sync="use">Get my decks</button></div></div>';
      if (!s.code) {
        body.innerHTML = '<div class="sync-block"><button type="button" class="primary" data-sync="create">Create a sync code</button>' +
          '<p class="muted small">Makes a short code and saves a scrambled copy of your decks that you can open on another computer.</p></div>' + enter;
      } else {
        body.innerHTML = '<div class="sync-block"><b id="ctSyncCodeLabel">Your sync code</b><div class="sync-row">' +
          '<output class="sync-code" data-sync-code aria-labelledby="ctSyncCodeLabel">' + (revealed ? esc(formatCode(s.code)) : '•••-•••-•••') + '</output>' +
          '<button type="button" data-sync="show">' + (revealed ? 'Hide' : 'Show') + '</button><button type="button" data-sync="copy">Copy</button></div>' +
          '<p class="muted small">On another computer, open Deck Builder → Sync across computers… and type this code. This browser remembers it, so you only type it once per computer.</p></div>' +
          '<p class="muted small sync-times">Last uploaded: ' + esc(when(s.uploadedAt)) + ' · Last downloaded: ' + esc(when(s.downloadedAt)) + '</p>' +
          '<div class="sync-actions"><button type="button" class="primary" data-sync="upload">Upload this computer\'s decks</button><button type="button" data-sync="download">Download decks from sync</button></div>' +
          '<details class="sync-more"><summary>More</summary><div class="sync-block">' + enter + '</div>' +
          '<div class="sync-actions"><button type="button" data-sync="rotate">Make a new code…</button><button type="button" data-sync="forget">Stop syncing on this computer</button><button type="button" class="danger" data-sync="delete">Delete the synced copy…</button></div></details>';
      }
    }

    // Show what a downloaded copy would add, and wait for a click before changing anything.
    function offer(code, backup) {
      const plan = CTBackup.plan(window.localStorage, backup);
      const custom = backup.preferences['ct.appearance.custom'], pictures = !!(custom && (custom.cardBack || custom.background));
      // A computer with no look of its own yet takes the synced one by default; one that has its own asks first.
      const fresh = window.localStorage.getItem('ct.appearance') === null && window.localStorage.getItem('ct.appearance.custom') === null;
      pending = { code, backup };
      result.innerHTML = '<div class="sync-offer"><p><b>' + backup.decks.length + ' deck' + (backup.decks.length === 1 ? '' : 's') + ' in sync:</b> ' + plan.added + ' to add' +
        (plan.copies ? ' (' + plan.copies + ' as "(restored)" copies of decks that differ)' : '') + ', ' + plan.skipped + ' already here.</p>' +
        '<p class="muted small">Nothing on this computer is removed.</p>' +
        '<p><label><input type="checkbox" data-sync-prefs' + (fresh ? ' checked' : '') + '> Also use the card back, background' + (pictures ? ' (including the card back and background picture you uploaded)' : '') + ' and display settings from the synced copy</label></p>' +
        '<p class="muted small">' + (fresh ? 'This computer has no look of its own yet, so this is ticked.' : 'This replaces this computer\'s current card back, background and display settings.') + '</p>' +
        '<button type="button" class="primary" data-sync="apply">' + (plan.added ? 'Add them' : 'Remember this code') + ' and continue</button></div>';
      say(status, '');
    }

    const actions = {
      create: () => guard(async () => {
        const { code, picturesLeftOut } = await createNew();
        revealed = true; render();
        say(status, 'Done. Your sync code is ' + formatCode(code) + '. Write it down somewhere safe; this browser also remembers it.' + (picturesLeftOut ? LEFT_OUT : ''), 'ok');
      }),
      use: () => guard(async () => { const code = typedCode(); offer(code, await fetchCollection(code)); }),
      download: () => guard(async () => { const code = getState().code; offer(code, await fetchCollection(code)); }),
      apply: () => {
        if (!pending) return;
        const { code, backup } = pending, withPrefs = !!el.querySelector('[data-sync-prefs]') && el.querySelector('[data-sync-prefs]').checked;
        guard(async () => {
          CTBackup.restore(window.localStorage, backup, withPrefs);
          setState({ code, downloadedAt: Date.now() });
          location.reload();
        });
      },
      upload: () => guard(async () => {
        const s = getState();
        if (!decks().length) fail('no-decks');
        // Uploading replaces the synced copy, so warn if that would drop decks this computer does not have.
        let missing = [];
        try { const there = await fetchCollection(s.code), mine = new Set(decks().map(d => d.id)); missing = there.decks.filter(d => !mine.has(d.id)); }
        catch (e) { if (e && e.code !== 'not-found') throw e; }
        if (missing.length) {
          const names = missing.slice(0, 4).map(d => d.name).join(', ') + (missing.length > 4 ? ' and ' + (missing.length - 4) + ' more' : '');
          setBusy(false);
          const ok = await UI.confirm('The synced copy has ' + missing.length + ' deck' + (missing.length === 1 ? '' : 's') + ' this computer does not have (' + names + '). Uploading replaces the synced copy, so ' + (missing.length === 1 ? 'it' : 'they') + ' would be removed from sync. Download first to keep ' + (missing.length === 1 ? 'it' : 'them') + '.', { title: 'Replace the synced copy?', okLabel: 'Replace anyway', cancelLabel: 'Cancel', danger: true });
          setBusy(true);
          if (!ok) { say(status, 'Nothing was uploaded.', ''); return; }
        }
        const result = await upload(s.code);
        setState({ uploadedAt: result.updatedAt || Date.now() }); render();
        say(status, 'Uploaded ' + decks().length + ' deck' + (decks().length === 1 ? '' : 's') + (hasPictures() && !result.picturesLeftOut ? ' and your uploaded pictures' : '') + '.' + (result.picturesLeftOut ? LEFT_OUT : ''), 'ok');
      }),
      rotate: () => guard(async () => {
        setBusy(false);
        const ok = await UI.confirm('Make a new code? Your decks move to the new code and the old code stops working. Computers that use the old code will be asked for the new one.', { title: 'Make a new code', okLabel: 'Make a new code' });
        setBusy(true);
        if (!ok) return;
        const { code, picturesLeftOut } = await rotate(); revealed = true; render();
        say(status, 'Done. Your new sync code is ' + formatCode(code) + '. The old code no longer works.' + (picturesLeftOut ? LEFT_OUT : ''), 'ok');
      }),
      forget: () => { forget(); revealed = false; render(); say(status, 'This computer no longer syncs. The synced copy is still there; type your code to use it again.', ''); },
      delete: () => guard(async () => {
        setBusy(false);
        const ok = await UI.confirm('Delete the synced copy from the server? Your decks on your computers are not touched, and the code stops working.', { title: 'Delete the synced copy', okLabel: 'Delete', danger: true });
        setBusy(true);
        if (!ok) return;
        await deleteCopy(); revealed = false; render();
        say(status, 'The synced copy was deleted.', 'ok');
      }),
      show: () => { revealed = !revealed; render(); },
      copy: async () => {
        const code = getState().code; if (!code) return;
        try { await navigator.clipboard.writeText(formatCode(code)); say(status, 'Code copied.', 'ok'); } catch (_) { revealed = true; render(); say(status, 'Select the code above and copy it.', ''); }
      }
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-sync]'); if (b && actions[b.dataset.sync]) actions[b.dataset.sync](); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ctSyncCodeIn') { e.preventDefault(); actions.use(); } });

    UI.modal({ title: 'Sync across computers', el, className: 'w-sync-dialog', onClose: () => { closed = true; } });
    available().then(a => {
      if (closed) return;
      if (a !== 'yes') { body.innerHTML = '<p>' + esc(a === 'offline' ? MESSAGES.offline : MESSAGES.unavailable) + '</p><button type="button" data-sync="retry">Try again</button>'; actions.retry = () => { body.innerHTML = '<p class="muted">Checking…</p>'; available().then(b => b === 'yes' ? render() : (body.innerHTML = '<p>' + esc(b === 'offline' ? MESSAGES.offline : MESSAGES.unavailable) + '</p><button type="button" data-sync="retry">Try again</button>')); }; return; }
      render();
    });
  }

  window.CTSync = { open, available, generateCode, formatCode, parseCode, codeProblem, keysFor, seal, unseal, upload, fetchCollection, createNew, rotate, deleteCopy, getState, setState, forget };
})();
