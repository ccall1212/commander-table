/* Saved collection backups. Game sessions and player/network identities are excluded. */
(function () {
  'use strict';
  const FORMAT = 'commander-table-collection', VERSION = 1, MAX_BYTES = 20 * 1024 * 1024;
  const DECK_KEY = 'ct.decks.v1';
  const PREF_KEYS = ['ct.name', 'ct.appearance', 'ct.appearance.custom', 'ct.layout2', 'ct.view',
    'ct.handCw', 'ct.split3', 'ct.touchMode', 'ct.chatSound', 'ct.lensRadius'];
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  const fail = text => { throw new Error(text); };
  function string(v, max, label, empty) {
    if (typeof v !== 'string' || v.length > max || (!empty && !v.trim())) fail('Invalid ' + label + ' in backup.');
    return v;
  }
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  function def(v) {
    if (!obj(v)) fail('Invalid card in backup.');
    const out = { id: string(v.id, 200, 'card ID'), name: string(v.name, 500, 'card name') };
    for (const key of ['face', 'backName', 'type', 'backType', 'oracle', 'mana', 'pt', 'loyalty', 'set', 'setName', 'cn', 'year', 'rarity']) {
      if (v[key] != null) out[key] = string(v[key], key === 'oracle' ? 20000 : 1000, 'card ' + key, true);
    }
    for (const key of ['img', 'imgBack']) {
      if (v[key] == null || v[key] === '') { out[key] = v[key] || null; continue; }
      const url = string(v[key], 2000, 'card image');
      if (!url.startsWith('https://cards.scryfall.io/')) fail('Invalid card image address in backup.');
      out[key] = url;
    }
    if (v.cmc != null) {
      if (!Number.isFinite(v.cmc) || v.cmc < 0 || v.cmc > 1000000) fail('Invalid mana value in backup.');
      out.cmc = v.cmc;
    }
    for (const key of ['legendary', 'isToken']) if (v[key] != null) {
      if (typeof v[key] !== 'boolean') fail('Invalid card flag in backup.');
      out[key] = v[key];
    }
    for (const key of ['ci', 'tokens', 'finishes']) if (v[key] != null) {
      if (!Array.isArray(v[key]) || v[key].length > 200) fail('Invalid card ' + key + ' in backup.');
      out[key] = v[key].map(x => string(x, 200, 'card ' + key));
      if (key === 'ci' && out[key].some(x => !['W', 'U', 'B', 'R', 'G'].includes(x))) fail('Invalid color identity in backup.');
    }
    return out;
  }
  function deck(v) {
    if (!obj(v) || !Array.isArray(v.cards) || !Array.isArray(v.commanders) || !Array.isArray(v.tokens || [])) fail('Invalid deck in backup.');
    if (v.cards.length > 2000 || v.commanders.length > 10 || (v.tokens || []).length > 2000) fail('Deck is too large to restore.');
    return {
      id: string(v.id, 200, 'deck ID'), name: string(v.name, 500, 'deck name'),
      createdAt: v.createdAt == null ? '' : string(v.createdAt, 100, 'deck date', true),
      commanders: v.commanders.map(def),
      cards: v.cards.map(row => {
        if (!obj(row) || !integer(row.qty, 1, 1000)) fail('Invalid card quantity in backup.');
        return { def: def(row.def), qty: row.qty };
      }),
      tokens: (v.tokens || []).map(def), source: v.source == null ? '' : string(v.source, 1000000, 'deck source', true)
    };
  }
  function pref(key, value) {
    switch (key) {
      case 'ct.name': return string(value, 24, 'player name', true);
      case 'ct.view': if (['side', 'grid'].includes(value)) return value; break;
      case 'ct.touchMode': case 'ct.chatSound': if (typeof value === 'boolean') return value; break;
      case 'ct.handCw': if (integer(value, 60, 160)) return value; break;
      case 'ct.lensRadius': if (typeof value === 'number' && value >= 40 && value <= 260) return value; break;
      case 'ct.split3': if (typeof value === 'number' && value >= 0 && value <= 1) return value; break;
      case 'ct.appearance':
        if (obj(value) && window.CTAppearance.backOptions.some(x => x.id === value.cardBack) && window.CTAppearance.backgroundOptions.some(x => x.id === value.background))
          return { cardBack: value.cardBack, background: value.background };
        break;
      case 'ct.appearance.custom': {
        if (!obj(value)) break;
        const out = {};
        for (const kind of ['cardBack', 'background']) {
          const data = value[kind] || '';
          if (typeof data !== 'string' || data.length > 1600000 || (data && !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(data))) fail('Invalid custom image in backup.');
          out[kind] = data;
          if (value[kind + 'Active'] != null && typeof value[kind + 'Active'] !== 'boolean') fail('Invalid custom image preference in backup.');
          out[kind + 'Active'] = !!data && value[kind + 'Active'] !== false;
        }
        return out;
      }
      case 'ct.layout2':
        if (Array.isArray(value) && value.length === 3 && ['creatures', 'lands', 'permanents'].every(k => value.filter(r => obj(r) && r.k === k).length === 1)) {
          return value.map(r => {
            if (![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.x < 0 || r.y < 0 || r.w < 100 || r.h < 60 || r.x + r.w > 1000 || r.y + r.h > 1400) fail('Invalid battlefield layout in backup.');
            return { k: r.k, label: string(r.label, 100, 'zone label', true), x: r.x, y: r.y, w: r.w, h: r.h };
          });
        }
        break;
    }
    fail('Invalid preference ' + key + ' in backup.');
  }
  function validate(value) {
    if (!obj(value) || value.format !== FORMAT || value.version !== VERSION) fail('Choose a supported Commander Table collection backup (version 1).');
    if (!Array.isArray(value.decks) || value.decks.length > 500 || !obj(value.preferences)) fail('Invalid collection in backup.');
    const decks = value.decks.map(deck), ids = new Set(decks.map(d => d.id));
    if (ids.size !== decks.length) fail('Duplicate deck IDs in backup.');
    const preferences = {};
    for (const key of PREF_KEYS) if (Object.prototype.hasOwnProperty.call(value.preferences, key)) preferences[key] = pref(key, value.preferences[key]);
    return { format: FORMAT, version: VERSION, decks, preferences };
  }
  function parse(text) {
    if (typeof text !== 'string' || new Blob([text]).size > MAX_BYTES) fail('Backups must be no larger than 20 MB.');
    let value;
    try { value = JSON.parse(text); } catch (_) { fail('This file is not valid JSON. Choose a Commander Table collection backup.'); }
    return validate(value);
  }
  function readDecks(storage) {
    let value;
    try { value = JSON.parse(storage.getItem(DECK_KEY) || '[]'); } catch (_) { fail('Saved decks could not be read. No changes were made.'); }
    if (!Array.isArray(value)) fail('Saved decks could not be read. No changes were made.');
    return value;
  }
  function create(storage) {
    const preferences = {};
    for (const key of PREF_KEYS) {
      const raw = storage.getItem(key);
      if (raw !== null) {
        try { preferences[key] = JSON.parse(raw); } catch (_) { fail('Could not read preference ' + key + '.'); }
      }
    }
    const value = validate({ format: FORMAT, version: VERSION, decks: readDecks(storage), preferences });
    value.createdAt = new Date().toISOString();
    if (new Blob([JSON.stringify(value)]).size > MAX_BYTES) fail('This collection exceeds the 20 MB backup limit. Export individual decks instead.');
    return value;
  }
  // Plan is recomputed at confirmation: an existing deck is never replaced.
  function plan(storage, backup) {
    const existing = readDecks(storage), decks = existing.slice(), ids = new Set(existing.map(d => d.id));
    let added = 0, skipped = 0, copies = 0;
    for (const incoming of validate(backup).decks) {
      const sameId = existing.find(d => d.id === incoming.id);
      let same = false;
      if (sameId) { try { same = JSON.stringify(deck(sameId)) === JSON.stringify(incoming); } catch (_) { /* preserve malformed existing records too */ } }
      if (same) { skipped++; continue; }
      const d = Object.assign({}, incoming);
      if (ids.has(d.id)) {
        do { d.id = 'restored-' + window.crypto.randomUUID(); } while (ids.has(d.id));
        d.name += ' (restored)'; copies++;
      }
      ids.add(d.id); decks.push(d); added++;
    }
    return { decks, added, skipped, copies };
  }
  function restore(storage, backup, withPreferences) {
    const checked = validate(backup), result = plan(storage, checked);
    const writes = [[DECK_KEY, JSON.stringify(result.decks)]];
    if (withPreferences) for (const key of PREF_KEYS) if (Object.prototype.hasOwnProperty.call(checked.preferences, key)) writes.push([key, JSON.stringify(checked.preferences[key])]);
    const before = writes.map(([key]) => [key, storage.getItem(key)]);
    try { for (const [key, value] of writes) storage.setItem(key, value); }
    catch (_) {
      let rollbackFailed = false;
      for (const [key, value] of before) {
        try { if (storage.getItem(key) !== value) { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } }
        catch (_) { rollbackFailed = true; }
      }
      fail(rollbackFailed ? 'Restore failed and some preferences could not be recovered. Keep your backup and check saved decks before continuing.' : 'Restore could not be saved (storage may be full or unavailable). Your previous collection and preferences were kept.');
    }
    return result;
  }
  function open() {
    const el = document.createElement('div');
    el.innerHTML = '<p>Save all decks, chosen printings, appearance (including uploaded images), saved name, and display preferences in one file.</p>' +
      '<p class="muted small">Active games, room codes, and connection identities are excluded. Keep the file somewhere you can find it later.</p>' +
      '<button type="button" data-backup-download>Download backup</button><hr>' +
      '<label>Restore a collection backup <input type="file" accept=".json,application/json" data-backup-file></label>' +
      '<div data-backup-preview role="status"></div><p><label><input type="checkbox" data-backup-prefs> Also restore saved preferences and appearance</label></p>' +
      '<p class="muted small">Existing decks are kept. Changed decks with the same ID are added as restored copies. Matching decks are skipped. Preferences stay as they are unless selected above.</p>' +
      '<button type="button" data-backup-restore disabled>Restore and reload</button>';
    let backup = null, reading = 0;
    const input = el.querySelector('[data-backup-file]'), preview = el.querySelector('[data-backup-preview]'), apply = el.querySelector('[data-backup-restore]');
    el.querySelector('[data-backup-download]').onclick = () => {
      try {
        const value = create(window.localStorage), url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'commander-table-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        UI.toast('Collection backup downloaded.');
      } catch (e) { UI.toast(e.message, { kind: 'error' }); }
    };
    input.onchange = async () => {
      const ticket = ++reading, file = input.files[0]; backup = null; apply.disabled = true; preview.textContent = '';
      if (!file) return;
      try {
        if (file.size > MAX_BYTES) fail('Backups must be no larger than 20 MB.');
        const value = parse(await file.text());
        if (ticket !== reading) return;
        const result = plan(window.localStorage, value); backup = value;
        preview.textContent = value.decks.length + ' decks in backup: ' + result.added + ' to add (' + result.copies + ' restored copies), ' + result.skipped + ' matching decks to skip. ' + Object.keys(value.preferences).length + ' saved preferences available.';
        apply.disabled = false;
      } catch (e) { if (ticket === reading) preview.textContent = e.message; }
    };
    apply.onclick = () => {
      if (!backup) return;
      try { restore(window.localStorage, backup, el.querySelector('[data-backup-prefs]').checked); location.reload(); }
      catch (e) { preview.textContent = e.message; }
    };
    UI.modal({ title: 'Back up / restore collection', el, onClose: () => { reading++; } });
  }
  window.CTBackup = { create, parse, plan, restore, open };
})();
