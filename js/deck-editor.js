/* deck-editor.js — visual pre-game deck builder, using the in-game card viewer. */
(function () {
  'use strict';
  let activeDeckId = null, deckViewer = null, addViewer = null, afterSave = null;
  let onHover = null, onLeave = null, recordMeta = new Map();
  const quantity = entry => Math.max(0, Math.floor(Number(entry && entry.qty) || 0));
  const nameOf = def => String(def && def.name || '');
  const currentDeck = () => activeDeckId ? Deck.get(activeDeckId) : null;
  function countNamed(deck, name) {
    let n = 0;
    (deck.commanders || []).forEach(d => { if (nameOf(d) === name) n++; });
    (deck.cards || []).forEach(e => { if (nameOf(e.def) === name) n += quantity(e); });
    return n;
  }
  function keepTokens(oldDef, newDef) {
    return Object.assign({}, newDef, {
      tokens: (oldDef && oldDef.tokens && oldDef.tokens.length ? oldDef.tokens : newDef.tokens) || []
    });
  }
  function makeViewerCards(deck) {
    const cards = [], meta = new Map();
    (deck.commanders || []).forEach((def, index) => {
      const iid = 'deck-commander-' + index;
      cards.push({ iid, def: def || {}, qty: 1 });
      meta.set(iid, { kind: 'commander', index, def: def || {} });
    });
    (deck.cards || []).forEach((entry, index) => {
      const def = entry && entry.def || {}, qty = quantity(entry);
      if (!qty) return;
      const iid = 'deck-card-' + index;
      cards.push({ iid, def, qty });
      meta.set(iid, { kind: 'card', index, def, qty });
    });
    recordMeta = meta;
    return cards;
  }
  function refresh() {
    const deck = currentDeck();
    if (!deck) { close(); return; }
    if (afterSave) afterSave();
    if (deckViewer) deckViewer.update(makeViewerCards(deck));
  }
  function entryLine(def, qty, includePrinting) {
    const set = includePrinting !== false && def && def.set && def.cn
      ? ' (' + String(def.set).toUpperCase() + ') ' + def.cn : '';
    return String(Math.max(1, Math.floor(Number(qty) || 1))) + ' ' + nameOf(def) + set;
  }
  // Moxfield keeps the current import-friendly format, including deck metadata and printing IDs.
  function exportText(deck) {
    const lines = ['About', 'Name: ' + (deck.name || 'Untitled deck'), '', 'Commander'];
    (deck.commanders || []).forEach(def => { if (nameOf(def)) lines.push(entryLine(def, 1, true)); });
    lines.push('', 'Deck');
    (deck.cards || []).forEach(entry => {
      const qty = quantity(entry);
      if (qty && nameOf(entry.def)) lines.push(entryLine(entry.def, qty, true));
    });
    return lines.join('\n') + '\n';
  }
  // Plain text is a simple, readable decklist: names and quantities, without set/collector metadata.
  function exportPlainText(deck) {
    const lines = ['Commander'];
    (deck.commanders || []).forEach(def => { if (nameOf(def)) lines.push(entryLine(def, 1, false)); });
    lines.push('', 'Deck');
    (deck.cards || []).forEach(entry => {
      const qty = quantity(entry);
      if (qty && nameOf(entry.def)) lines.push(entryLine(entry.def, qty, false));
    });
    return lines.join('\n') + '\n';
  }
  function safeFileName(name) {
    return String(name || 'commander-deck').normalize('NFKD')
      .replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'commander-deck';
  }
  function downloadDeckText(deck, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = safeFileName(deck.name) + '.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast('Deck downloaded as a text file.');
  }
  async function copyDeckText(text, textarea) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        UI.toast('Copied decklist to clipboard.');
        return;
      }
    } catch (err) {
      // Fall back below for browsers that restrict clipboard access.
    }
    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const ok = document.execCommand('copy');
      if (ok) UI.toast('Copied decklist to clipboard.');
      else UI.toast('Copy was blocked by the browser. Select the text and copy it manually.', { kind: 'warn' });
    } catch (err) {
      UI.toast('Copy was blocked by the browser. Select the text and copy it manually.', { kind: 'warn' });
    }
  }
  function openExportOptions() {
    const deck = currentDeck();
    if (!deck) return;
    const moxfieldText = exportText(deck);
    let activeFormat = 'moxfield';

    const layout = document.createElement('div');
    layout.className = 'w-export';

    const columns = document.createElement('div');
    columns.className = 'w-export-layout';

    const left = document.createElement('div');
    left.className = 'w-export-preview';
    const label = document.createElement('label');
    label.className = 'w-export-label';
    label.textContent = 'Deck List';
    const textarea = document.createElement('textarea');
    textarea.className = 'w-input w-export-text';
    textarea.setAttribute('aria-label', 'Deck list preview');
    textarea.spellcheck = false;
    textarea.readOnly = true;
    textarea.value = moxfieldText;
    left.append(label, textarea);

    const actions = document.createElement('div');
    actions.className = 'w-export-actions';
    const moxfieldButton = document.createElement('button');
    moxfieldButton.type = 'button';
    moxfieldButton.className = 'w-btn w-export-action';
    moxfieldButton.textContent = 'Copy for Moxfield';
    const plainButton = document.createElement('button');
    plainButton.type = 'button';
    plainButton.className = 'w-btn w-export-action';
    plainButton.textContent = 'Copy Plain Text';
    actions.append(moxfieldButton, plainButton);
    columns.append(left, actions);

    const footer = document.createElement('div');
    footer.className = 'w-export-footer';
    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'w-btn w-btn-primary';
    download.textContent = 'Download .txt';
    footer.appendChild(download);
    layout.append(columns, footer);

    function selectFormat(format) {
      activeFormat = format;
      textarea.value = format === 'plain' ? exportPlainText(deck) : moxfieldText;
      moxfieldButton.classList.toggle('w-export-active', format === 'moxfield');
      plainButton.classList.toggle('w-export-active', format === 'plain');
    }
    moxfieldButton.addEventListener('click', () => {
      selectFormat('moxfield');
      copyDeckText(textarea.value, textarea);
    });
    plainButton.addEventListener('click', () => {
      selectFormat('plain');
      copyDeckText(textarea.value, textarea);
    });
    download.addEventListener('click', () => {
      const text = activeFormat === 'plain' ? exportPlainText(deck) : exportText(deck);
      downloadDeckText(deck, text);
    });

    selectFormat('moxfield');
    UI.modal({ title: 'Export Options', el: layout, wide: true, className: 'w-export-dialog' });
  }
  function saveDeck(deck, message) {
    try {
      Deck.save(deck);
      refresh();
      UI.toast(message || 'Deck saved.', { ms: 2600 });
    } catch (err) {
      UI.toast(err && err.message ? err.message : 'Could not save this deck.', { kind: 'error' });
    }
  }
  function removeOne(iid) {
    const meta = recordMeta.get(iid), deck = currentDeck();
    if (!meta || !deck) return;
    if (meta.kind === 'commander') deck.commanders.splice(meta.index, 1);
    else {
      const entry = deck.cards[meta.index];
      if (!entry) return;
      if (quantity(entry) > 1) entry.qty = quantity(entry) - 1;
      else deck.cards.splice(meta.index, 1);
    }
    saveDeck(deck, 'Card removed from deck.');
  }
  function setCommander(iid) {
    const meta = recordMeta.get(iid), deck = currentDeck();
    if (!meta || !deck || meta.kind !== 'card' || !meta.def) return;
    const def = meta.def;
    const legal = Deck.commanderCandidates([{ def }]).some(c => c.id === def.id);
    if (!legal) { UI.toast(nameOf(def) + ' is not recognized as a Commander candidate.', { kind: 'warn' }); return; }
    if ((deck.commanders || []).length >= 2) { UI.toast('This deck already has two commanders. Remove one first.', { kind: 'warn' }); return; }
    if ((deck.commanders || []).some(c => nameOf(c) === nameOf(def))) { UI.toast(nameOf(def) + ' is already in the Commander section.', { kind: 'warn' }); return; }
    const entry = deck.cards[meta.index];
    if (!entry) return;
    if (quantity(entry) > 1) entry.qty = quantity(entry) - 1;
    else deck.cards.splice(meta.index, 1);
    deck.commanders = (deck.commanders || []).concat([def]);
    saveDeck(deck, 'Set ' + nameOf(def) + ' as a commander.');
  }
  function savePrinting(iid, newDef, scope) {
    const meta = recordMeta.get(iid), deck = currentDeck();
    if (!meta || !deck || !newDef) return;
    if (scope === 'all') {
      const targetName = nameOf(meta.def);
      deck.commanders = (deck.commanders || []).map(def => nameOf(def) === targetName ? keepTokens(def, newDef) : def);
      (deck.cards || []).forEach(entry => { if (nameOf(entry.def) === targetName) entry.def = keepTokens(entry.def, newDef); });
    } else if (meta.kind === 'commander') {
      if (!deck.commanders[meta.index]) return;
      deck.commanders[meta.index] = keepTokens(deck.commanders[meta.index], newDef);
    } else {
      const entry = deck.cards[meta.index];
      if (!entry) return;
      if (quantity(entry) > 1) {
        const original = entry.def;
        entry.qty = quantity(entry) - 1;
        deck.cards.splice(meta.index + 1, 0, { def: keepTokens(original, newDef), qty: 1 });
      } else entry.def = keepTokens(entry.def, newDef);
    }
    saveDeck(deck, scope === 'all'
      ? 'Saved this printing for ALL copies of ' + nameOf(meta.def) + '.'
      : 'Saved this printing for the selected copy.');
  }
  async function changePrinting(iid) {
    const meta = recordMeta.get(iid), deck = currentDeck();
    if (!meta || !deck || !meta.def || !meta.def.name) return;
    const targetName = nameOf(meta.def);
    let prints;
    const toast = UI.toast('Finding printings of ' + targetName + '…', { ms: 4000 });
    try { prints = await Deck.fetchPrints(targetName); }
    catch (err) { UI.toast(err && err.message ? err.message : 'Could not load printings.', { kind: 'error' }); return; }
    finally { if (toast && typeof toast.close === 'function') toast.close(); }
    if (!prints.length) { UI.toast('No printings found for ' + targetName + '.'); return; }
    UI.printPicker({
      title: 'Choose printing for ' + targetName, prints, currentId: meta.def.id,
      showAll: countNamed(deck, targetName) > 1, allLabel: 'Use for ALL copies',
      onPick: (newDef, scope) => savePrinting(iid, newDef, scope)
    });
  }
  function addCard(def) {
    const deck = currentDeck();
    if (!deck || !def || !def.id || !def.name) return;
    deck.cards = Array.isArray(deck.cards) ? deck.cards : [];
    const found = deck.cards.find(entry => entry.def && entry.def.id === def.id);
    if (found) found.qty = quantity(found) + 1;
    else deck.cards.push({ def, qty: 1 });
    const tokenIds = Array.isArray(def.tokens) ? def.tokens.slice() : [];
    const deckId = deck.id;
    saveDeck(deck, 'Added ' + nameOf(def) + ' to the deck.');
    if (tokenIds.length) addRelatedTokens(deckId, tokenIds);
  }
  async function addRelatedTokens(deckId, tokenIds) {
    const toLoad = [...new Set(tokenIds || [])].filter(Boolean);
    const loaded = [];
    for (const id of toLoad) {
      const current = Deck.get(deckId);
      const known = new Set((current && current.tokens || []).map(t => t && t.id).filter(Boolean));
      if (known.has(id)) continue;
      try { loaded.push(await Deck.fetchById(id)); }
      catch (err) { console.warn('Could not load a related deck token', id, err); }
    }
    if (!loaded.length) return;
    const deck = Deck.get(deckId);
    if (!deck) return;
    const known = new Set((deck.tokens || []).map(t => t && t.id).filter(Boolean));
    const fresh = loaded.filter(t => t && t.id && !known.has(t.id));
    if (!fresh.length) return;
    deck.tokens = (deck.tokens || []).concat(fresh);
    try {
      Deck.save(deck);
      if (activeDeckId === deckId) refresh();
    } catch (err) { console.warn('Could not save related deck tokens', err); }
  }
  function openAddCard() {
    const deck = currentDeck();
    if (!deck) return;
    addViewer = UI.viewer({
      title: 'Add cards to ' + (deck.name || 'your deck'), cards: [],
      searchPlaceholder: 'Type a card name to search Scryfall…',
      searchProvider: query => Deck.searchCards(query, 50),
      onCardClick: def => addCard(def),
      onHover: def => { if (onHover) onHover(def); },
      onClose: () => { addViewer = null; if (onLeave) onLeave(); }
    });
  }
  function handleAction(key, iid) {
    if (key === 'printing') { changePrinting(iid); return; }
    if (key === 'remove') { removeOne(iid); return; }
    if (key === 'commander') setCommander(iid);
  }
  function open(deckId, onDeckSaved, options) {
    close();
    if (!Deck.get(deckId)) { UI.toast('Select or import a saved deck first.', { kind: 'warn' }); return; }
    activeDeckId = deckId;
    afterSave = typeof onDeckSaved === 'function' ? onDeckSaved : null;
    onHover = options && typeof options.onHover === 'function' ? options.onHover : null;
    onLeave = options && typeof options.onLeave === 'function' ? options.onLeave : null;
    const deck = currentDeck();
    deckViewer = UI.viewer({
      title: 'Deck Builder — ' + (deck.name || 'Untitled deck'),
      cards: makeViewerCards(deck), showQuantity: true, removeKey: 'remove', colorSort: true,
      countItems: list => list.reduce((n, card) => n + Math.max(1, Number(card.c.qty) || 1), 0),
      actions: [
        { key: 'printing', label: 'Change printing…' },
        { key: 'commander', label: 'Set as commander' },
        { key: 'remove', label: 'Remove from deck' }
      ],
      footer: [
        { key: 'add', label: '+ Add card', primary: true },
        { key: 'export', label: 'Export deck' }
      ],
      onAction: handleAction,
      onFooter: key => { if (key === 'add') openAddCard(); else if (key === 'export') openExportOptions(); },
      onHover: def => { if (onHover) onHover(def); },
      onClose: () => {
        deckViewer = null;
        activeDeckId = null;
        recordMeta.clear();
        if (onLeave) onLeave();
        onLeave = null; onHover = null; afterSave = null;
      }
    });
  }
  function close() {
    if (deckViewer) deckViewer.close();
    deckViewer = null; activeDeckId = null; recordMeta.clear();
    if (addViewer) addViewer.close();
    addViewer = null;
    if (onLeave) onLeave();
    onLeave = null; onHover = null; afterSave = null;
  }
  window.CTDeckEditor = { open, close };
})();
