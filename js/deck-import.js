/* Opt-in website-import test client. Normal plain-text import stays independent. */
(function () {
  'use strict';
  function source(raw) {
    let u;
    try { u = new URL(String(raw || '').trim()); } catch (_) { throw new Error('Paste a full HTTPS Archidekt or Moxfield deck link.'); }
    if (u.protocol !== 'https:' || u.username || u.password || u.port) throw new Error('Use a normal HTTPS deck link.');
    const host = u.hostname.replace(/^www\./, ''), parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'decks') throw new Error('Use an Archidekt or Moxfield deck link.');
    const id = parts[1] || '';
    if (host === 'archidekt.com' && /^\d{1,12}$/.test(id)) return { site: 'archidekt', id, url: 'https://archidekt.com/decks/' + id };
    if (host === 'moxfield.com' && /^[A-Za-z0-9_-]{1,64}$/.test(id) && parts.length === 2) return { site: 'moxfield', id, url: 'https://moxfield.com/decks/' + id };
    throw new Error('Use a public Archidekt or Moxfield deck link.');
  }
  const safeName = v => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 160);
  function row(item) {
    if (!item || typeof item !== 'object') return null;
    const c = item.card || item.cardData || item;
    const name = safeName(c.name || (c.oracleCard && c.oracleCard.name));
    const qty = Number(item.quantity ?? item.qty ?? 1);
    if (!name || !Number.isInteger(qty) || qty < 1 || qty > 500 || item.deletedAt) return null;
    const set = c.set || (c.edition && c.edition.editioncode), cn = c.cn || c.collector_number || c.collectorNumber;
    const printing = /^[a-z0-9]{2,8}$/i.test(set || '') && /^[a-z0-9★-]{1,12}$/i.test(String(cn || '')) ? ` (${String(set).toUpperCase()}) ${cn}` : '';
    return { name, qty, line: `${qty} ${name}${printing}` };
  }
  function text(data, info) {
    if (!data || typeof data !== 'object') throw new Error('The provider returned no readable deck.');
    if (data.private === true || data.isPrivate === true) throw new Error('This deck is private. Use a public deck or plain-text export.');
    const commanders = [], main = [];
    if (info.site === 'moxfield') {
      const boards = data.boards || data;
      for (const [key, dest] of [['commanders', commanders], ['mainboard', main]]) {
        const board = boards[key] || {}, cards = board.cards || board;
        (Array.isArray(cards) ? cards : Object.values(cards)).forEach(c => { const r = row(c); if (r) dest.push(r); });
      }
    } else {
      const cats = new Map((data.categories || []).flatMap(c => [[String(c.id), c], [c.name, c]]));
      (Array.isArray(data.cards) ? data.cards : []).forEach(item => {
        const r = row(item); if (!r || item.companion) return;
        const categories = (item.categories || []).map(c => typeof c === 'object' ? c : cats.get(String(c)) || { name: c });
        const names = categories.map(c => String(c.name || '').toLowerCase().trim());
        if (names.includes('commander')) { commanders.push(r); return; }
        if (names.some(n => /^(sideboard|maybeboard|considering|companion)$/.test(n))) return;
        if (categories.length && categories.every(c => c.includedInDeck === false)) return;
        const card = item.card || {}, oracle = card.oracleCard || {};
        if (/token/i.test(card.layout || oracle.layout || '') || (oracle.types || []).includes('Token')) return;
        // "Tokens" can be the user's category for ordinary token-making cards. Do not drop it by name.
        main.push(r);
      });
    }
    if (!commanders.length && !main.length) throw new Error('No main-deck cards were returned. Try plain-text export.');
    const lines = ['About:', 'Name: ' + safeName(data.name || data.deckName || 'Imported deck'), '# Source: ' + info.url, ''];
    if (commanders.length) lines.push('Commanders:', ...commanders.map(c => c.line), '');
    lines.push('Deck:', ...main.map(c => c.line));
    return { text: lines.join('\n'), count: [...commanders, ...main].reduce((n, c) => n + c.qty, 0), commanders: commanders.reduce((n, c) => n + c.qty, 0) };
  }
  function bracket(data) {
    // Only explicit provider/user bracket data. Never infer a bracket from card strength or unknown metadata.
    const labels = { exhibition: 1, core: 2, upgraded: 3, optimized: 4, optimised: 4, cedh: 5 };
    for (let value of [data && data.edhBracket, data && data.bracket, data && data.userBracket]) {
      if (value && typeof value === 'object') value = value.value ?? value.name ?? value.label;
      if (typeof value === 'string') {
        const label = value.trim().toLowerCase();
        if (labels[label]) return labels[label];
        const match = /^(?:bracket\s*)?([1-5])(?:\s*[-:–]\s*(?:exhibition|core|upgraded|optimized|optimised|cedh))?$/.exec(label);
        if (match) return Number(match[1]);
      } else if (Number.isInteger(value) && value >= 1 && value <= 5) return value;
    }
    return null;
  }
  function testRelay(raw, production) {
    let u; try { u = new URL(raw); } catch (_) { throw new Error('Set deckrelay to the separate test Worker URL.'); }
    const local = (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && u.protocol === 'http:';
    if ((!local && (u.protocol !== 'https:' || !u.hostname.endsWith('.workers.dev'))) || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('Use a workers.dev test Worker origin or a local test service.');
    if (production && u.origin === new URL(production).origin) throw new Error('Use the separate test Worker, not the live game relay.');
    return u.origin;
  }
  async function request(base, site, action, id, page) {
    const u = new URL('/deck-api', base);
    for (const [key, value] of Object.entries({ site, action, id, page })) if (value != null && value !== '') u.searchParams.set(key, value);
    let response, data;
    try { response = await fetch(u, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); data = await response.json(); }
    catch (_) { throw new Error('The test import service could not be reached. Plain-text import still works.'); }
    if (!response.ok) throw new Error(data.error || 'The deck provider refused the request. Use plain-text export.');
    return data;
  }
  async function random(bracketWanted, get, progress = () => {}, pause = () => new Promise(r => setTimeout(r, 150))) {
    if (![1, 2, 3, 4].includes(bracketWanted)) throw new Error('Choose bracket 1–4.');
    const seen = new Set(); let checked = 0, lastError = null;
    for (let page = 1; page <= 4 && checked < 12; page++) {
      progress(`Searching public Archidekt decks, page ${page} of 4…`);
      const data = await get('archidekt', 'search', '', page);
      const summaries = Array.isArray(data) ? data : data.results || [];
      const candidates = summaries.filter(s => s && !s.private && !s.unlisted && (s.size == null || Number(s.size) === 100) && /^\d{1,12}$/.test(String(s.id)) && (bracket(s) === bracketWanted || bracket(s) === null));
      // Shuffle within known matches first, then unknowns. Confirm everything against full deck details.
      const shuffle = list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const ordered = shuffle(candidates.filter(s => bracket(s) === bracketWanted)).concat(shuffle(candidates.filter(s => bracket(s) === null)).slice(0, 2));
      for (const summary of ordered) {
        if (seen.has(String(summary.id))) continue;
        seen.add(String(summary.id));
        if (checked >= 12) break;
        checked++;
        await pause();
        let full; try { full = await get('archidekt', 'deck', String(summary.id)); } catch (e) { lastError = e; continue; }
        if (full.private || full.unlisted || Number(full.deckFormat) !== 3 || bracket(full) !== bracketWanted) continue;
        const info = source('https://archidekt.com/decks/' + summary.id);
        let converted; try { converted = text(full, info); } catch (_) { continue; }
        if (converted.count !== 100 || converted.commanders < 1 || converted.commanders > 2) continue;
        return { info, ...converted, bracket: bracketWanted };
      }
      if (!data.next || !summaries.length) break;
      await pause();
    }
    throw new Error(`No complete public Commander deck with confirmed bracket ${bracketWanted} was found in this sample. Unknown brackets are not matches. ${lastError ? lastError.message : 'Try again or import a deck link/plain-text list.'}`);
  }
  function bind(loadText) {
    const panel = document.getElementById('deckWebsitePreview');
    if (!panel) return;
    const $ = id => document.getElementById(id), status = $('deckWebsiteStatus');
    let base = null, busy = false;
    const show = message => { status.textContent = message; };
    $('deckServiceConnect').onclick = () => {
      if (busy) return;
      try {
        base = testRelay($('deckServiceUrl').value.trim(), window.CT_NET && CT_NET.relayUrl);
        $('deckProviderControls').classList.remove('hidden');
        show('Test service selected. Public decks only; plain-text import remains available.');
      } catch (e) { base = null; $('deckProviderControls').classList.add('hidden'); show(e.message); }
    };
    async function run(randomPick) {
      if (busy || !base) return;
      busy = true;
      $('deckWebsiteFetch').disabled = $('deckRandomFetch').disabled = $('deckServiceConnect').disabled = true;
      show(randomPick ? 'Searching sampled public Archidekt decks…' : 'Fetching public deck…');
      try {
        const get = (site, action, id, page) => request(base, site, action, id, page);
        let result;
        if (randomPick) result = await random(Number($('deckRandomBracket').value), get, show);
        else {
          const info = source($('deckWebsiteUrl').value);
          const data = await get(info.site, 'deck', info.id);
          result = { info, ...text(data, info) };
        }
        await loadText(result.text);
        show(`Fetched ${result.count} cards${result.bracket ? ' with confirmed provider bracket ' + result.bracket : ''}. Review the cards and commander below, then Save deck. These are provider labels, not a guarantee of power level.`);
      } catch (e) { show(e.message || 'Website import failed. Use plain-text export instead.'); }
      finally { busy = false; $('deckWebsiteFetch').disabled = $('deckRandomFetch').disabled = $('deckServiceConnect').disabled = false; }
    }
    $('deckWebsiteFetch').onclick = () => run(false);
    $('deckRandomFetch').onclick = () => run(true);
  }
  window.CTDeckImport = { source, text, bracket, testRelay, request, random, bind };
}());
