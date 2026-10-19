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
  function entryLine(def, qty) {
    const set = def && def.set && def.cn ? ' (' + String(def.set).toUpperCase() + ') ' + def.cn : '';
    return String(Math.max(1, Math.floor(Number(qty) || 1))) + ' ' + nameOf(def) + set;
  }
  function exportText(deck) {
    const lines = ['About', 'Name: ' + (deck.name || 'Untitled deck'), '', 'Commander'];
    (deck.commanders || []).forEach(def => { if (nameOf(def)) lines.push(entryLine(def, 1)); });
    lines.push('', 'Deck');
    (deck.cards || []).forEach(entry => {
      const qty = quantity(entry);
      if (qty && nameOf(entry.def)) lines.push(entryLine(entry.def, qty));
    });
    return lines.join('\n') + '\n';
  }
  function safeFileName(name) {
    return String(name || 'commander-deck').normalize('NFKD')
      .replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'commander-deck';
  }
  function downloadDeck() {
    const deck = currentDeck();
    if (!deck) return;
    const blob = new Blob([exportText(deck)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = safeFileName(deck.name) + '.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast('Deck exported as a text decklist.');
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
    saveDeck(deck, 'Added ' + nameOf(def) + ' to the deck.');
  }
  function openAddCard() {
    const deck = currentDeck();
    if (!deck) return;
    addViewer = UI.viewer({
      title: 'Add cards to ' + (deck.name || 'your deck'), cards: [],
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
      cards: makeViewerCards(deck), showQuantity: true, removeKey: 'remove',
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
      onFooter: key => { if (key === 'add') openAddCard(); else if (key === 'export') downloadDeck(); },
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
