/* deck.js — decklist parsing, Scryfall resolution, CardDef conversion and saved decks.
 * Classic script; exposes a single global: window.Deck.
 */
(function () {
  'use strict';

  const API = 'https://api.scryfall.com';
  const STORAGE_KEY = 'ct.decks.v1';
  const MIN_GAP_MS = 100;          // Scryfall asks for ~50-100ms between requests
  const BATCH_SIZE = 75;           // /cards/collection max identifiers per request
  const IMG_PREFIX = 'https://cards.scryfall.io/';

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Lowercase, strip accents, normalise apostrophes/whitespace — used for name matching.
  function norm(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’ʼ`]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // Front face name: text before " // " (or a lone " / ").
  function frontFace(name) {
    return String(name || '').split(/\s+\/{1,2}\s+/)[0].trim();
  }

  function normCn(cn) {
    return String(cn == null ? '' : cn).trim().toLowerCase();
  }

  function safeUrl(u) {
    return typeof u === 'string' && u.indexOf(IMG_PREFIX) === 0 ? u : '';
  }

  /* ------------------------------------------------------------------ *
   * Scryfall HTTP (serialised + rate limited)
   * ------------------------------------------------------------------ */

  let lastRequestAt = 0;
  let gate = Promise.resolve();

  function throttle() {
    const p = gate.then(() => {
      const wait = MIN_GAP_MS - (Date.now() - lastRequestAt);
      return wait > 0 ? sleep(wait) : null;
    }).then(() => { lastRequestAt = Date.now(); });
    gate = p.catch(() => {});
    return p;
  }

  // Returns { ok, status, json }. Throws a friendly Error only on network failure.
  async function request(url, opts, attempt) {
    opts = opts || {};
    attempt = attempt || 0;
    await throttle();
    const headers = { 'Accept': 'application/json' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body });
    } catch (e) {
      throw new Error('Could not reach Scryfall. Check your internet connection and try again.');
    }
    if (res.status === 429 && attempt < 3) { // rate limited: back off and retry
      await sleep(1000 * (attempt + 1));
      return request(url, opts, attempt + 1);
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* non-JSON body */ }
    return { ok: res.ok, status: res.status, json: json };
  }

  function apiErrorMessage(r) {
    const d = r && r.json && r.json.details;
    return 'Scryfall returned an error (' + (r ? r.status : '?') + ')' + (d ? ': ' + d : '.');
  }

  // POST /cards/collection in batches of 75. Returns all returned card objects.
  async function collection(identifiers, onBatch) {
    const out = [];
    for (let i = 0; i < identifiers.length; i += BATCH_SIZE) {
      const batch = identifiers.slice(i, i + BATCH_SIZE);
      const r = await request(API + '/cards/collection', {
        method: 'POST',
        body: JSON.stringify({ identifiers: batch })
      });
      if (!r.ok) throw new Error(apiErrorMessage(r));
      const data = (r.json && r.json.data) || [];
      for (let j = 0; j < data.length; j++) out.push(data[j]);
      if (onBatch) onBatch(batch.length);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * CardDef conversion
   * ------------------------------------------------------------------ */

  const BACK_LAYOUTS = ['transform', 'modal_dfc', 'double_faced_token', 'reversible_card'];

  function isTokenPart(p) {
    return !!p && (p.component === 'token' || /Emblem/.test(p.type_line || ''));
  }

  function toDef(c) {
    c = c || {};
    const faces = Array.isArray(c.card_faces) ? c.card_faces : [];
    const f0 = faces[0] || null;
    const f1 = faces[1] || null;

    const hasBack = !!f1 && BACK_LAYOUTS.indexOf(c.layout) !== -1;
    const type = (f0 && f0.type_line) || frontFace(c.type_line || '') || String(c.type_line || '').split(' // ')[0];
    const backType = hasBack ? (f1.type_line || null) : null;

    let oracle;
    if (faces.length > 1 && faces.some((f) => typeof f.oracle_text === 'string')) {
      oracle = faces.map((f) => f.oracle_text || '').join('\n—\n');
    } else {
      oracle = c.oracle_text || (f0 && f0.oracle_text) || '';
    }

    const pick = (k) => {
      if (f0 && f0[k] != null) return f0[k];
      return c[k] != null ? c[k] : null;
    };
    const pw = pick('power');
    const tg = pick('toughness');
    const loyalty = pick('loyalty');

    const topImg = c.image_uris && c.image_uris.normal;
    const f0Img = f0 && f0.image_uris && f0.image_uris.normal;
    const f1Img = f1 && f1.image_uris && f1.image_uris.normal;
    const img = safeUrl(topImg || f0Img || '');
    // Only a separate back image when the faces have their own images (no top-level image).
    const imgBack = (!topImg && f1Img) ? (safeUrl(f1Img) || null) : null;

    const tokenIds = [];
    (c.all_parts || []).forEach((p) => {
      if (isTokenPart(p) && p.id && tokenIds.indexOf(p.id) === -1) tokenIds.push(p.id);
    });

    const def = {
      id: c.id || '',
      name: c.name || '',
      face: (f0 && f0.name) || frontFace(c.name || ''),
      backName: hasBack ? (f1.name || null) : null,
      type: type,
      backType: backType,
      oracle: oracle,
      mana: (f0 && f0.mana_cost) || c.mana_cost || '',
      cmc: typeof c.cmc === 'number' ? c.cmc : 0,
      ci: Array.isArray(c.color_identity) ? c.color_identity.slice() : [],
      pt: (pw != null && tg != null) ? (pw + '/' + tg) : null,
      loyalty: loyalty != null ? String(loyalty) : null,
      img: img,
      imgBack: imgBack,
      tokens: tokenIds,
      legendary: type.indexOf('Legendary') !== -1,
      isToken: c.layout === 'token' || c.layout === 'double_faced_token' || c.layout === 'emblem' ||
        String(c.type_line || '').indexOf('Token') !== -1,
      set: c.set || '',
      setName: c.set_name || '',
      cn: c.collector_number || '',
      year: typeof c.released_at === 'string' ? c.released_at.slice(0, 4) : '',
      rarity: c.rarity || '',
      finishes: Array.isArray(c.finishes) ? c.finishes : []
    };
    // Token print matching needs semantic data that ordinary CardDefs do not use.
    // Keep these optional so old saved decks and normal card definitions stay stable.
    if (def.isToken) {
      const backPick = (k) => f1 && f1[k] != null ? f1[k] : null;
      def.tokenLayout = c.layout || '';
      def.tokenColors = Array.isArray(c.colors) ? c.colors.slice() : (f0 && Array.isArray(f0.colors) ? f0.colors.slice() : []);
      def.tokenOracleId = c.oracle_id || '';
      def.tokenColorsBack = hasBack && Array.isArray(f1.colors) ? f1.colors.slice() : [];
      def.tokenOracleBack = hasBack ? (backPick('oracle_text') || '') : '';
      def.tokenManaBack = hasBack ? (backPick('mana_cost') || '') : '';
      const bp = backPick('power'), bt = backPick('toughness');
      def.tokenPtBack = bp != null && bt != null ? bp + '/' + bt : null;
      def.tokenLoyaltyBack = backPick('loyalty') != null ? String(backPick('loyalty')) : null;
    }
    return def;
  }

  function slimDef(d) {
    const slim = {
      id: d.id, name: d.name, face: d.face, backName: d.backName,
      type: d.type, backType: d.backType, cmc: d.cmc, pt: d.pt,
      img: d.img, imgBack: d.imgBack, set: d.set, setName: d.setName
    };
    if (d.isToken || /\b(?:Token|Emblem)\b/i.test(String(d.type || ''))) {
      ['isToken', 'oracle', 'mana', 'loyalty', 'ci', 'tokenLayout', 'tokenColors',
        'tokenColorsBack', 'tokenOracleId', 'tokenOracleBack', 'tokenManaBack',
        'tokenPtBack', 'tokenLoyaltyBack'].forEach(function (key) {
        if (d[key] != null) slim[key] = Array.isArray(d[key]) ? d[key].slice() : d[key];
      });
    }
    return slim;
  }

  /* ------------------------------------------------------------------ *
   * Parsing
   * ------------------------------------------------------------------ */

  const HEADER_RE = /^(?:\/\/|#)?\s*(commanders?|decks?|main(?:board| deck)?|sideboard|maybeboard|considering|tokens?|companion|about)\s*:?\s*(?:\(\s*\d+\s*\))?\s*:?\s*$/i;

  function headerSection(word) {
    switch (word.toLowerCase()) {
      case 'commander': case 'commanders': return 'commander';
      case 'deck': case 'decks': case 'main': case 'mainboard': case 'main deck': return 'main';
      case 'about': return 'about';
      default: return 'skip'; // sideboard / maybeboard / considering / tokens / companion
    }
  }

  // Parse one card line. Returns { entry, role } where role is 'commander' | 'main' | 'skip' | null (null = section default),
  // or null if the line cannot be parsed.
  function parseCardLine(raw) {
    let line = raw;

    // Archidekt tags like ^Have,#37d67a^
    line = line.replace(/\^[^^]*\^/g, ' ');

    // Bracketed categories: [Commander{top}], [Maybeboard{noDeck}{noPrice},Ramp]
    let role = null;
    let skip = false;
    line = line.replace(/\[([^\]]*)\]/g, function (_, inner) {
      inner.split(',').forEach(function (cat) {
        const c = cat.trim().toLowerCase();
        const base = c.split('{')[0].trim();
        if (c.indexOf('{nodeck}') !== -1 || base === 'maybeboard' || base === 'sideboard' || base === 'considering') skip = true;
        else if (base === 'commander') role = 'commander';
      });
      return ' ';
    });
    if (skip) return { skip: true };

    // Foil / etched markers: *F*, *E*, *Foil*
    line = line.replace(/\s*\*[A-Za-z]{1,8}\*/g, ' ');
    line = line.replace(/\s+/g, ' ').trim();
    if (!line) return null;

    // Quantity
    let qty = 1;
    const q = /^(\d+)\s*[xX]?\s+(.+)$/.exec(line);
    if (q) { qty = parseInt(q[1], 10); line = q[2].trim(); }

    // Trailing "(SET) cn"
    let set = null, cn = null, name = line;
    const s = /^(.*?)\s*\(\s*([A-Za-z0-9]{2,6})\s*\)\s*(\S+)?\s*$/.exec(line);
    if (s && s[1]) {
      name = s[1].trim();
      set = s[2].toLowerCase();
      cn = s[3] ? s[3] : null;
    }

    name = name.replace(/[‘’]/g, "'").trim();
    if (!name || !/[A-Za-zÀ-ɏ]/.test(name)) return null;
    if (!(qty > 0)) return { skip: true };

    return { entry: { qty: qty, name: name, set: set, cn: cn }, role: role };
  }

  function mergeEntries(list) {
    const out = [];
    const idx = new Map();
    list.forEach(function (e) {
      const k = norm(e.name);
      if (idx.has(k)) idx.get(k).qty += e.qty;
      else { const copy = { qty: e.qty, name: e.name, set: e.set, cn: e.cn }; idx.set(k, copy); out.push(copy); }
    });
    return out;
  }

  function defaultName(commanderNames) {
    const names = commanderNames.map(frontFace).filter(Boolean);
    return names.length ? names.join(' + ') : 'Untitled deck';
  }

  function parse(text) {
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    const warnings = [];
    let name = '';
    let section = 'main';
    let block = 0;          // increments on each blank line (for the MTGO heuristic)
    const raws = [];        // { entry, target: 'commander'|'main', block }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) { block++; continue; }

      const h = HEADER_RE.exec(line);
      if (h) { section = headerSection(h[1]); continue; }

      if (/^(\/\/|#)/.test(line)) continue; // comment

      if (/^SB:/i.test(line)) continue;      // MTGO sideboard-prefixed line

      if (section === 'about') {
        const nm = /^Name\s*[: ]\s*(.+)$/i.exec(line);
        if (nm) { name = nm[1].trim(); continue; }
        if (/^\d+\s*[xX]?\s+\S/.test(line)) section = 'main'; // cards without a Deck header
        else continue;                                           // other metadata
      }

      if (section === 'skip') continue;

      const r = parseCardLine(line);
      if (!r) { warnings.push('Could not parse line: ' + line); continue; }
      if (r.skip) continue;

      let target = section === 'commander' ? 'commander' : 'main';
      if (r.role === 'commander') target = 'commander';
      raws.push({ entry: r.entry, target: target, block: block });
    }

    // MTGO heuristic: no commanders found -> a trailing 1-2 entry block is the commander(s).
    if (!raws.some(function (x) { return x.target === 'commander'; })) {
      const mains = raws.filter(function (x) { return x.target === 'main'; });
      if (mains.length) {
        const maxBlock = Math.max.apply(null, mains.map(function (x) { return x.block; }));
        const minBlock = Math.min.apply(null, mains.map(function (x) { return x.block; }));
        if (maxBlock > minBlock) {
          const last = mains.filter(function (x) { return x.block === maxBlock; });
          if (last.length >= 1 && last.length <= 2 && last.every(function (x) { return x.entry.qty === 1; })) {
            last.forEach(function (x) { x.target = 'commander'; });
          }
        }
      }
    }

    const commanders = mergeEntries(raws.filter(function (x) { return x.target === 'commander'; }).map(function (x) { return x.entry; }));
    const main = mergeEntries(raws.filter(function (x) { return x.target === 'main'; }).map(function (x) { return x.entry; }));

    if (!name) name = defaultName(commanders.map(function (e) { return e.name; }));
    return { name: name, commanders: commanders, main: main, warnings: warnings };
  }

  /* ------------------------------------------------------------------ *
   * Resolving against Scryfall
   * ------------------------------------------------------------------ */

  async function resolve(parsed, onProgress) {
    parsed = parsed || {};
    const commanderEntries = parsed.commanders || [];
    const mainEntries = parsed.main || [];

    const progress = function (done, total, msg) {
      if (typeof onProgress === 'function') {
        try { onProgress(done, total, msg); } catch (e) { /* ignore UI errors */ }
      }
    };

    const keyOf = function (e) {
      return (e.set && e.cn) ? 'sc:' + e.set.toLowerCase() + '/' + normCn(e.cn) : 'n:' + norm(frontFace(e.name));
    };
    const identOf = function (e) {
      return (e.set && e.cn)
        ? { set: e.set.toLowerCase(), collector_number: String(e.cn) }
        : { name: frontFace(e.name) };
    };

    // Unique identifiers (first pass).
    const idents = new Map();
    commanderEntries.concat(mainEntries).forEach(function (e) {
      if (!frontFace(e.name)) return;
      const k = keyOf(e);
      if (!idents.has(k)) idents.set(k, identOf(e));
    });

    let total = idents.size;
    let done = 0;

    const bySetCn = new Map();
    const byName = new Map();
    const index = function (card) {
      bySetCn.set(String(card.set || '').toLowerCase() + '/' + normCn(card.collector_number), card);
      const names = [card.name, frontFace(card.name)];
      (card.card_faces || []).forEach(function (f) { if (f && f.name) names.push(f.name); });
      names.forEach(function (n) {
        const k = norm(n);
        if (k && !byName.has(k)) byName.set(k, card);
      });
    };

    progress(0, total, 'Looking up cards…');
    const first = await collection(Array.from(idents.values()), function (n) {
      done += n;
      progress(Math.min(done, total), total, 'Looking up cards…');
    });
    first.forEach(index);

    const find = function (e) {
      if (e.set && e.cn) {
        const c = bySetCn.get(e.set.toLowerCase() + '/' + normCn(e.cn));
        // Only trust a set/number hit if the name agrees (guards against typos in exports).
        const want = norm(frontFace(e.name));
        if (c && [c.name, frontFace(c.name)].concat((c.card_faces || []).map(function (f) { return f && f.name; }))
          .some(function (n) { return norm(n) === want; })) return c;
      }
      return byName.get(norm(frontFace(e.name))) || byName.get(norm(e.name)) || null;
    };

    // Retry by name for anything looked up by set/collector number that did not resolve.
    const retry = new Map();
    commanderEntries.concat(mainEntries).forEach(function (e) {
      if (find(e)) return;
      const n = frontFace(e.name);
      const k = norm(n);
      if (n && !retry.has(k)) retry.set(k, { name: n });
    });
    if (retry.size) {
      total += retry.size;
      progress(done, total, 'Retrying unmatched cards by name…');
      const second = await collection(Array.from(retry.values()), function (n) {
        done += n;
        progress(Math.min(done, total), total, 'Retrying unmatched cards by name…');
      });
      second.forEach(index);
    }

    // Build defs.
    const defCache = new Map();
    const defFor = function (card) {
      if (!defCache.has(card.id)) defCache.set(card.id, toDef(card));
      return defCache.get(card.id);
    };

    const notFound = [];
    const commanders = [];
    const cards = [];
    const cardIdx = new Map();

    commanderEntries.forEach(function (e) {
      const c = find(e);
      if (!c) { if (notFound.indexOf(e.name) === -1) notFound.push(e.name); return; }
      const d = defFor(c);
      if (!commanders.some(function (x) { return x.id === d.id; })) commanders.push(d);
    });
    mainEntries.forEach(function (e) {
      const c = find(e);
      if (!c) { if (notFound.indexOf(e.name) === -1) notFound.push(e.name); return; }
      const d = defFor(c);
      if (cardIdx.has(d.id)) cardIdx.get(d.id).qty += e.qty;
      else { const row = { def: d, qty: e.qty }; cardIdx.set(d.id, row); cards.push(row); }
    });

    // Tokens (and emblems) related to any resolved card.
    const tokenIds = [];
    const seenTok = new Set();
    commanders.concat(cards.map(function (r) { return r.def; })).forEach(function (d) {
      d.tokens.forEach(function (id) { if (!seenTok.has(id)) { seenTok.add(id); tokenIds.push(id); } });
    });

    let tokens = [];
    if (tokenIds.length) {
      total += tokenIds.length;
      progress(done, total, 'Fetching tokens…');
      try {
        const raw = await collection(tokenIds.map(function (id) { return { id: id }; }), function (n) {
          done += n;
          progress(Math.min(done, total), total, 'Fetching tokens…');
        });
        const seen = new Set();
        raw.forEach(function (c) {
          if (seen.has(c.id)) return;
          seen.add(c.id);
          tokens.push(toDef(c));
        });
      } catch (e) {
        // The deck itself resolved fine; a token lookup failure should not discard it.
        tokens = [];
      }
    }

    progress(total, total, 'Done');

    const name = (parsed.name && String(parsed.name).trim()) || defaultName(commanders.map(function (d) { return d.face; }));
    return { name: name, commanders: commanders, cards: cards, tokens: tokens, notFound: notFound };
  }

  /* ------------------------------------------------------------------ *
   * Helpers: commander candidates, token search, fetch by id
   * ------------------------------------------------------------------ */

  function commanderCandidates(cards) {
    const out = [];
    (cards || []).forEach(function (row) {
      const d = row && row.def;
      if (!d) return;
      const type = d.type || '';
      const ok =
        (d.legendary && /\bCreature\b/.test(type)) ||
        /can be your commander/i.test(d.oracle || '') ||
        (d.legendary && /\bPlaneswalker\b/.test(type)) ||
        (d.legendary && /\bBackground\b/.test(type));
      if (ok) out.push(d);
    });
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  }

  async function searchTokens(query) {
    const q = 't:token ' + String(query == null ? '' : query).trim();
    const url = API + '/cards/search?q=' + encodeURIComponent(q) + '&include_extras=true&unique=cards&order=name';
    const r = await request(url);
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(apiErrorMessage(r));
    return ((r.json && r.json.data) || []).slice(0, 30).map(toDef);
  }

  // All available printings of a card (by front face name), newest first.
  // Scryfall paginates search results, so follow every page unless a caller requests a limit.
  async function fetchPrints(name, limit) {
    const front = frontFace(name);
    if (!front) return [];
    const max = limit > 0 ? Math.floor(limit) : Infinity;
    let url = API + '/cards/search?q=' + encodeURIComponent('!"' + front + '"') +
      '&unique=prints&order=released&dir=desc&include_extras=true&include_variations=true';
    const seen = new Set();
    const out = [];
    while (url && out.length < max) {
      let r;
      try {
        r = await request(url);
      } catch (e) {
        throw new Error('Could not load printings from Scryfall — check your connection.');
      }
      if (r.status === 404) return out;
      if (!r.ok) throw new Error(apiErrorMessage(r));
      ((r.json && r.json.data) || []).forEach(function (c) {
        if (out.length >= max || ['art_series', 'token', 'double_faced_token', 'emblem'].indexOf(c.layout) !== -1) return;
        const d = toDef(c);
        // Distinct printings can reuse the same art; keep each unique card printing.
        if (!d.img || seen.has(d.id)) return;
        seen.add(d.id);
        out.push(d);
      });
      url = r.json && r.json.has_more && r.json.next_page ? r.json.next_page : '';
    }
    return out;
  }

  function tokenKey(def) {
    if (!def) return '';
    const tokenLike = !!def.isToken || /\b(?:Token|Emblem)\b/i.test(String(def.type || ''));
    if (!tokenLike) return '';
    // Sparse legacy definitions remain selectable, but can only identify themselves.
    if (!def.type || typeof def.oracle !== 'string' || !def.tokenLayout ||
        !Array.isArray(def.tokenColors) || !Array.isArray(def.ci)) return def.id ? 'unknown:' + def.id : '';
    const faces = [
      [def.face || frontFace(def.name), def.type, def.oracle, def.mana || '', def.pt || '', def.loyalty || ''],
      def.backName ? [def.backName, def.backType || '', def.tokenOracleBack || '', def.tokenManaBack || '', def.tokenPtBack || '', def.tokenLoyaltyBack || ''] : null
    ];
    const normText = (v) => String(v || '').replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();
    return JSON.stringify({ faces: faces.map((face) => face && face.map(normText)),
      colors: def.tokenColors.slice().sort(), backColors: (def.tokenColorsBack || []).slice().sort(),
      ci: def.ci.slice().sort(), layout: def.tokenLayout, hasBack: !!def.backName });
  }

  // Find only semantically identical token printings. Fetch the selected object first
  // so legacy saved tokens get enough metadata to compare safely.
  async function fetchTokenPrints(def) {
    if (!def || !def.id) return [];
    const tokenLike = !!def.isToken || /\b(?:Token|Emblem)\b/i.test(String(def.type || ''));
    if (!tokenLike) return [];
    let source = def;
    if (!tokenKey(source) || tokenKey(source).indexOf('unknown:') === 0) {
      try { source = await fetchById(def.id); }
      catch (e) { if (/Card not found/.test(String(e && e.message))) return []; throw e; }
    }
    if (!source.isToken && !/\b(?:Token|Emblem)\b/i.test(String(source.type || ''))) return [];
    const key = tokenKey(source);
    if (!key) return [];
    const name = frontFace(source.name || def.name);
    if (!name) return [];
    let url = API + '/cards/search?q=' + encodeURIComponent('!"' + name + '"') +
      '&unique=prints&order=released&dir=desc&include_extras=true&include_variations=true';
    const seen = new Set(), out = [];
    while (url) {
      const r = await request(url);
      if (r.status === 404) break;
      if (!r.ok) throw new Error(apiErrorMessage(r));
      ((r.json && r.json.data) || []).forEach(function (c) {
        if (['token', 'double_faced_token', 'emblem'].indexOf(c.layout) === -1 || seen.has(c.id)) return;
        const candidate = toDef(c);
        if (tokenKey(candidate) !== key) return;
        seen.add(c.id);
        out.push(candidate);
      });
      url = r.json && r.json.has_more && r.json.next_page ? r.json.next_page : '';
    }
    return out;
  }


  // Search paper cards by a partial name for the pre-game deck builder.
  async function searchCards(query, limit) {
    const name = String(query == null ? '' : query).replace(/["\\{}]/g, ' ').replace(/\s+/g, ' ').trim();
    if (name.length < 2) return [];
    const max = Math.max(1, Math.min(75, Math.floor(Number(limit) || 50)));
    const q = 'game:paper name:"' + name + '"';
    const url = API + '/cards/search?q=' + encodeURIComponent(q) +
      '&unique=cards&order=name&dir=asc&include_extras=true&include_variations=true';
    let r;
    try { r = await request(url); }
    catch (e) { throw new Error('Could not search Scryfall. Check your connection and try again.'); }
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(apiErrorMessage(r));
    return ((r.json && r.json.data) || [])
      .filter(function (c) { return ['art_series', 'token', 'double_faced_token', 'emblem'].indexOf(c.layout) === -1; })
      .slice(0, max)
      .map(toDef);
  }

  async function fetchById(id) {
    const r = await request(API + '/cards/' + encodeURIComponent(id));
    if (r.status === 404) throw new Error('Card not found on Scryfall.');
    if (!r.ok) throw new Error(apiErrorMessage(r));
    return toDef(r.json);
  }

  // Full details for a card-detail view: the card (with faces) plus its rulings.
  // Throws only if the card itself cannot be loaded; a rulings failure gives an empty list.
  async function fetchCardInfo(id) {
    const fail = 'Could not load card details from Scryfall — check your connection.';
    let r;
    try {
      r = await request(API + '/cards/' + encodeURIComponent(id));
    } catch (e) {
      throw new Error(fail);
    }
    if (!r.ok || !r.json) throw new Error(fail);

    const card = r.json;
    const cf = Array.isArray(card.card_faces) ? card.card_faces : [];
    const f0 = cf[0] || null;
    const f1 = cf[1] || null;

    const faceOf = function (src) {
      return {
        name: src.name || '',
        manaCost: src.mana_cost || '',
        typeLine: src.type_line || '',
        oracle: src.oracle_text || '',
        flavor: src.flavor_text || '',
        power: src.power != null ? src.power : null,
        toughness: src.toughness != null ? src.toughness : null,
        loyalty: src.loyalty != null ? src.loyalty : null
      };
    };

    const manaCost = card.mana_cost || cf.map(function (f) { return (f && f.mana_cost) || ''; })
      .filter(Boolean).join(' // ');
    const faces = cf.length ? cf.map(function (f) { return faceOf(f || {}); }) : [faceOf(card)];

    const img = safeUrl((card.image_uris && card.image_uris.large) ||
      (f0 && f0.image_uris && f0.image_uris.large) || '');
    const imgBack = safeUrl((f1 && f1.image_uris && f1.image_uris.large) || '');

    let rulings = [];
    const rulingsUri = typeof card.rulings_uri === 'string' ? card.rulings_uri : '';
    if (rulingsUri.indexOf(API + '/') === 0) {
      try {
        const rr = await request(rulingsUri);
        if (rr.ok && rr.json && Array.isArray(rr.json.data)) {
          rulings = rr.json.data.map(function (x) {
            return { date: x.published_at, text: x.comment };
          });
        }
      } catch (e) {
        rulings = [];
      }
    }

    const scryfallUri = typeof card.scryfall_uri === 'string' && card.scryfall_uri.indexOf('https://scryfall.com/') === 0
      ? card.scryfall_uri : '';

    return {
      id: card.id || String(id),
      name: card.name || '',
      manaCost: manaCost,
      typeLine: card.type_line || '',
      faces: faces,
      img: img,
      imgBack: imgBack,
      setName: card.set_name || '',
      set: card.set || '',
      cn: card.collector_number || '',
      rarity: card.rarity || '',
      artist: card.artist || '',
      legalities: card.legalities || {},
      priceUsd: (card.prices && card.prices.usd) || '',
      priceUsdFoil: (card.prices && card.prices.usd_foil) || '',
      scryfallUri: scryfallUri,
      rulings: rulings
    };
  }

  /* ------------------------------------------------------------------ *
   * Saved decks (localStorage)
   * ------------------------------------------------------------------ */

  function readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeAll(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      throw new Error('Could not save the deck: browser storage is full or unavailable. Try deleting an old deck.');
    }
  }

  function newId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (e) { /* fall through */ }
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function list() {
    return readAll().map(function (d) {
      const cmd = d.commanders || [];
      const count = (d.cards || []).reduce(function (n, r) { return n + (r.qty || 0); }, 0) + cmd.length;
      return {
        id: d.id,
        name: d.name,
        commanderNames: cmd.map(function (c) { return c.name; }),
        count: count,
        createdAt: d.createdAt
      };
    }).sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function get(id) {
    const d = readAll().find(function (x) { return x.id === id; });
    return d || null;
  }

  function save(deck) {
    if (!deck) throw new Error('No deck to save.');
    if (!deck.id) deck.id = newId();
    if (!deck.createdAt) deck.createdAt = new Date().toISOString();
    if (!deck.name) deck.name = 'Untitled deck';
    if (!deck.commanders) deck.commanders = [];
    if (!deck.cards) deck.cards = [];
    if (!deck.tokens) deck.tokens = [];
    if (typeof deck.source !== 'string') deck.source = '';

    const all = readAll();
    const i = all.findIndex(function (x) { return x.id === deck.id; });
    if (i >= 0) all[i] = deck; else all.push(deck);
    writeAll(all);
    return deck;
  }

  function remove(id) {
    const all = readAll();
    const next = all.filter(function (x) { return x.id !== id; });
    if (next.length === all.length) return false;
    writeAll(next);
    return true;
  }

  function rename(id, name) {
    const all = readAll();
    const d = all.find(function (x) { return x.id === id; });
    const n = String(name == null ? '' : name).trim();
    if (!d || !n) return d || null;
    d.name = n;
    writeAll(all);
    return d;
  }

  // One CardDef per physical card (qty expanded), commanders excluded, unshuffled.
  // Note: copies of the same card share the same CardDef object reference.
  function buildLibrary(deck) {
    const out = [];
    ((deck && deck.cards) || []).forEach(function (row) {
      const n = Math.max(0, Math.floor(row.qty || 0));
      for (let i = 0; i < n; i++) out.push(row.def);
    });
    return out;
  }

  /* ------------------------------------------------------------------ */

  window.Deck = {
    parse: parse,
    resolve: resolve,
    toDef: toDef,
    slimDef: slimDef,
    commanderCandidates: commanderCandidates,
    searchTokens: searchTokens,
    fetchPrints: fetchPrints,
    tokenKey: tokenKey,
    fetchTokenPrints: fetchTokenPrints,
    searchCards: searchCards,
    fetchCardInfo: fetchCardInfo,
    fetchById: fetchById,
    list: list,
    get: get,
    save: save,
    remove: remove,
    rename: rename,
    buildLibrary: buildLibrary
  };
})();
