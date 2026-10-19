/* deck-editor.js — browse saved deck printings before a game starts.
 * Classic script; exposes window.CTDeckEditor.
 */
(function () {
  'use strict';

  const IMG_PREFIX = 'https://cards.scryfall.io/';
  let activeDeckId = null;
  let afterSave = null;

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const imageUrl = (value) => typeof value === 'string' && value.indexOf(IMG_PREFIX) === 0 ? value : '';

  function copyCount(deck) {
    const commanderCount = (deck.commanders || []).length;
    const mainCount = (deck.cards || []).reduce((n, row) => n + Math.max(0, Math.floor(row.qty || 0)), 0);
    return { commanderCount, mainCount, total: commanderCount + mainCount };
  }

  function printingLabel(def) {
    const label = [
      def.setName || (def.set ? String(def.set).toUpperCase() : ''),
      def.set && def.setName ? String(def.set).toUpperCase() : '',
      def.cn ? '#' + def.cn : '',
      def.year || ''
    ].filter(Boolean);
    return label.length ? label.join(' · ') : 'Printing details unavailable';
  }

  function rowHtml(kind, index, copy, def, qty) {
    def = def || {};
    const img = imageUrl(def.img);
    const name = def.name || 'Unknown card';
    const art = img
      ? '<img class="deck-editor-art" src="' + esc(img) + '" alt="' + esc(name) + '" loading="lazy" decoding="async" draggable="false">'
      : '<div class="deck-editor-art deck-editor-art-empty" aria-hidden="true">No art</div>';
    const copyNote = kind === 'card' && qty > 1
      ? '<span class="deck-editor-copy">Copy ' + (copy + 1) + ' of ' + qty + '</span>'
      : '';
    return '<article class="deck-editor-row">' + art +
      '<div class="deck-editor-details"><span class="deck-editor-name">' + esc(name) + '</span>' +
      '<span class="deck-editor-meta">' + esc(printingLabel(def)) + '</span>' + copyNote + '</div>' +
      '<button type="button" data-editor-change="1" data-editor-kind="' + kind +
      '" data-editor-index="' + index + '" data-editor-copy="' + copy + '">Change printing…</button></article>';
  }

  function render() {
    const box = $('#deckEditorBox');
    const rows = $('#deckEditorRows');
    if (!box || !rows || !activeDeckId) return;
    const deck = Deck.get(activeDeckId);
    if (!deck) { close(); return; }

    const counts = copyCount(deck);
    $('#deckEditorTitle').textContent = 'Browse / Edit: ' + (deck.name || 'Untitled deck');
    $('#deckEditorSummary').textContent = counts.total + ' cards · changes save to this deck in this browser';
    const html = [];

    if ((deck.commanders || []).length) {
      html.push('<div class="deck-editor-group">Commander' + (deck.commanders.length > 1 ? 's' : '') + ' · ' + deck.commanders.length + '</div>');
      deck.commanders.forEach((def, index) => html.push(rowHtml('commander', index, 0, def, 1)));
    }
    if (counts.mainCount) {
      html.push('<div class="deck-editor-group">Main deck · ' + counts.mainCount + ' cards</div>');
      (deck.cards || []).forEach((entry, index) => {
        const qty = Math.max(0, Math.floor(entry.qty || 0));
        for (let copy = 0; copy < qty; copy++) {
          html.push(rowHtml('card', index, copy, entry.def, qty));
        }
      });
    }
    if (!counts.total) html.push('<div class="deck-editor-empty">This saved deck has no cards to display.</div>');
    rows.innerHTML = html.join('');
    box.classList.remove('hidden');
  }

  function open(deckId, onDeckSaved) {
    if (!Deck.get(deckId)) {
      UI.toast('Select or import a saved deck first.', { kind: 'warn' });
      return;
    }
    activeDeckId = deckId;
    afterSave = typeof onDeckSaved === 'function' ? onDeckSaved : null;
    render();
  }

  function close() {
    activeDeckId = null;
    afterSave = null;
    const box = $('#deckEditorBox');
    const rows = $('#deckEditorRows');
    if (box) box.classList.add('hidden');
    if (rows) rows.innerHTML = '';
  }

  function keepTokens(oldDef, newDef) {
    return Object.assign({}, newDef, {
      tokens: (oldDef && oldDef.tokens && oldDef.tokens.length ? oldDef.tokens : newDef.tokens) || []
    });
  }

  function savePrinting(kind, index, copy, newDef) {
    const deck = Deck.get(activeDeckId);
    if (!deck || !newDef) return;
    if (kind === 'commander') {
      const oldDef = deck.commanders[index];
      if (!oldDef) return;
      deck.commanders[index] = keepTokens(oldDef, newDef);
    } else if (kind === 'card') {
      const entry = (deck.cards || [])[index];
      if (!entry || !entry.def) return;
      const oldDef = entry.def;
      const qty = Math.max(0, Math.floor(entry.qty || 0));
      const picked = keepTokens(oldDef, newDef);
      if (qty > 1) {
        // Split off exactly one physical copy so remaining copies keep their existing printing.
        entry.qty = qty - 1;
        deck.cards.splice(index + 1, 0, { def: picked, qty: 1 });
      } else {
        entry.def = picked;
      }
    } else return;

    try {
      Deck.save(deck);
      if (afterSave) afterSave();
      render();
      UI.toast('Saved — this card will use the selected printing next game.', { ms: 2800 });
    } catch (e) {
      UI.toast(e.message || 'Could not save the selected printing.', { kind: 'error' });
    }
  }

  async function changePrinting(button) {
    if (!activeDeckId || !button) return;
    const kind = button.dataset.editorKind;
    const index = Number(button.dataset.editorIndex);
    const copy = Number(button.dataset.editorCopy) || 0;
    const deck = Deck.get(activeDeckId);
    if (!deck || !Number.isInteger(index) || index < 0) return;
    const def = kind === 'commander' ? (deck.commanders || [])[index] :
      kind === 'card' && deck.cards[index] ? deck.cards[index].def : null;
    if (!def || !def.name) return;

    const toast = UI.toast('Finding printings of ' + def.name + '…', { ms: 4000 });
    let prints;
    try {
      prints = await Deck.fetchPrints(def.name);
    } catch (e) {
      UI.toast(e.message || 'Could not load printings.', { kind: 'error' });
      return;
    } finally {
      if (toast && typeof toast.close === 'function') toast.close();
    }
    if (!prints.length) {
      UI.toast('No printings found for ' + def.name + '.');
      return;
    }
    UI.printPicker({
      title: 'Choose printing for ' + def.name,
      prints: prints,
      currentId: def.id,
      showAll: false,
      onPick: (newDef) => savePrinting(kind, index, copy, newDef)
    });
  }

  const rowContainer = $('#deckEditorRows');
  if (rowContainer) rowContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-editor-change]');
    if (button) changePrinting(button);
  });
  const closeButton = $('#closeDeckEditor');
  if (closeButton) closeButton.addEventListener('click', close);

  window.CTDeckEditor = { open: open, close: close };
})();
