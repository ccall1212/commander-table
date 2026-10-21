/* Commander Table — game state, sync and rendering.
 *
 * Sync model (built for "nobody's crash ruins the game"):
 *  - Every player OWNS their own cards. Their full private state lives in their own browser
 *    (and localStorage), so a crash/reload loses nothing.
 *  - Players publish a PUBLIC view of themselves ({t:'pub'}: battlefield with card positions,
 *    zone layout, graveyard, exile, command zone, life, counts of hand/library — never hidden cards).
 *  - The host relays pubs, owns the shared TABLE (seats, turn, monarch…) and the game log.
 *  - Cross-player effects (give control, return a card to its owner, change someone's life)
 *    are REQUESTS relayed to the owner, who applies them to their own state.
 *
 * Battlefield: a free-form board in logical units (BW x BH). Each player arranges their own
 * zones and cards; everyone sees that exact arrangement, scaled to fit.
 */
(function () {
'use strict';

const APP_VERSION = '0.42.0';

// ---------- small helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function makeStore(getArea) {
  return {
    get(k, d) { try { const v = getArea().getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { getArea().setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn('storage', e); return false; } },
    del(k) { try { getArea().removeItem(k); } catch (e) { /* ignore */ } }
  };
}
const LS = makeStore(() => window.localStorage);
const SS = makeStore(() => window.sessionStorage);
const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = rnd(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d = 0) => (Number.isFinite(+v) ? clamp(Math.round(+v), -9999, 9999) : d);
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const openingModeName = mode => ({ london: 'London (7; first free)', 'three-lands': 'At least 3 lands', 'ten-bottom-three': 'Draw 10, bottom 3' })[CTMulligan.normalizeMode(mode)];
const openingModeShort = mode => ({ london: 'London', 'three-lands': '3 Lands', 'ten-bottom-three': '10 → 7' })[CTMulligan.normalizeMode(mode)];
const openingMulliganLimit = pid => CTMulligan.limit((S.table && S.table.openingMode) || 'london',
  (S.table && S.table.openingAllowances && S.table.openingAllowances[pid]) || 0);

const ZONES = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command'];
const ZL = { library: 'library', hand: 'hand', battlefield: 'battlefield', graveyard: 'graveyard', exile: 'exile', command: 'command zone' };
const PHASES = ['Untap', 'Upkeep', 'Draw', 'Main 1', 'Combat', 'Main 2', 'End'];
const COLORS = ['#e0a33a', '#4f8cff', '#3fbf7f', '#e5534b', '#a35cff', '#2ec4c4'];
const CARD_COUNTERS = ['+1/+1', '-1/-1', 'Loyalty', 'Charge', 'Shield', 'Stun', 'Lore', 'Time', 'Oil'];
const PLAYER_COUNTERS = ['Energy', 'Experience', 'Rad', 'Tickets'];
const IMG_OK = u => typeof u === 'string' && u.startsWith('https://cards.scryfall.io/');

// ---------- board geometry (logical units; scaled to fit on screen) ----------
// BW is fixed; each player's board HEIGHT (me.bh) grows to fit their own screen (min BH, max BH_MAX),
// is published with their board, and opponents scale that whole board to fit their panel.
// v0.7: BW 1400 -> 1000 so cards draw ~40% bigger. Boards from older versions are rescaled (see cleanPub / normalizeMe).
const BW = 1000, BH = 430, BH_MAX = 1400, CW = 80, CH = 112;
const TILE_STRIP = 120; // extra logical height under an opponent's miniature for their hand + piles
const OLD_BW = 1400; // board width of clients before v0.7 (they don't send `bw`)
const myBH = () => (S.me && S.me.bh) || BH;
const DEFAULT_LAYOUT = [
  // library / graveyard / exile / command zone live in the bottom row, not on the board
  { k: 'creatures', label: 'Creatures / Planeswalkers', x: 0, y: 0, w: 1000, h: 170 },
  { k: 'lands', label: 'Lands', x: 0, y: 180, w: 540, h: 250 },
  { k: 'permanents', label: 'Artifacts / Enchantments', x: 550, y: 180, w: 450, h: 250 }
];
const PLAYER_CTR_ICONS = { Poison: '☠', Energy: '⚡', Experience: '✦', Rad: '☢', Tickets: '🎟' };
const PILE_ZONES = ['library', 'graveyard', 'exile'];
const LAYOUT_KEYS = DEFAULT_LAYOUT.map(r => r.k).sort().join();
// A saved layout from an older version (different set of zones) is replaced by the default.
const layoutOk = l => Array.isArray(l) && l.map(r => r.k).sort().join() === LAYOUT_KEYS && l.every(r => isObj(r) && +r.x + +r.w <= BW);
const regionOf = (layout, k) => (layout || []).find(r => r.k === k) || DEFAULT_LAYOUT.find(r => r.k === k);
const cloneLayout = l => l.map(r => Object.assign({}, r));
function cleanLayout(l) {
  if (!Array.isArray(l)) return null;
  return l.slice(0, 10).filter(isObj).map(r => {
    const w = clamp(num(r.w, 200), 100, BW), h = clamp(num(r.h, 120), 60, BH_MAX);
    return { k: String(r.k || '').slice(0, 20), label: String(r.label || '').slice(0, 30),
      x: clamp(num(r.x), 0, BW - w), y: clamp(num(r.y), 0, BH_MAX - h), w, h };
  });
}
function defaultLayout() {
  const saved = cleanLayout(LS.get('ct.layout2', null)); // 'ct.layout' held pre-v0.7 (1400-wide) layouts
  if (layoutOk(saved)) {
    saved.forEach(r => { const d = DEFAULT_LAYOUT.find(x => x.k === r.k); if (d) r.label = d.label; });
    return saved;
  }
  return fittedLayout();
}
// The default zones stretched to the height my board will have on this screen (so they fill the battlefield).
function fittedLayout() {
  const wrap = $('#myBf');
  let W = wrap && wrap.clientWidth, H = wrap && wrap.clientHeight;
  if (!W || !H) { // not laid out yet (e.g. resuming): estimate from the window and the chosen layout
    const v = LS.get('ct.view', 'side');
    W = innerWidth * (v === 'side' ? 0.8 : 1);
    H = v === 'top' ? innerHeight * 0.55 : innerHeight - 50;
  }
  const fit = clamp(Math.round(Math.min(BW * H / W, 800)), BH, BH_MAX), f = fit / BH;
  return cloneLayout(DEFAULT_LAYOUT).map(r => Object.assign(r, { y: Math.round(r.y * f), h: Math.round(r.h * f) }));
}
const isAttachable = d => !!d && /\b(Aura|Equipment|Fortification)\b/.test((d.type || '') + ' ' + (d.backType || ''));

// ---------- state ----------
const S = {
  pid: null,        // this tab's player id
  role: null,       // 'host' | 'client' | 'solo'
  room: null,
  deckId: null,
  me: null,         // my full private state
  table: null,      // shared table (authoritative on host)
  players: {},      // pid -> public view (includes my own)
  online: {},       // pid -> bool, maintained by host
  log: [],
  chat: [], chatOpen: false, chatUnread: 0,
  undo: [],
  net: { state: 'offline', text: '' },
  hover: null,      // {pid, iid}
  dragging: false,
  selected: new Set(), // selected battlefield card IDs; local UI state only
  dragEndAt: 0,
  arrange: false,   // editing my zone layout
  focus: null,      // opponent pid shown large
  attachFrom: null, // iid waiting for an attach target
  attachToast: null,
  fit: {},          // 'mode:pid' -> {dw, dh} display size the auto-fit chose for that board
  regionDrag: null,
  viewers: new Set(),
  touchMode: !!LS.get('ct.touchMode', false),
  touchPreview: null,
  targetArrows: [], arrowPick: null, arrowControlsDismissed: false,
  colorFlow: false, colorRequestPending: false
};

const pname = pid => (pid === S.pid && S.me) ? S.me.name : ((S.players[pid] && S.players[pid].name) || 'Someone');
function colorOf(pid) {
  const selected = CTPlayerColors.color(S.table && S.table.colors && S.table.colors[pid]);
  if (selected) return selected.value;
  const seats = (S.table && S.table.seats) || [];
  const i = seats.indexOf(pid);
  if (i >= 0) {
    const occupied = Object.values((S.table && S.table.colors) || {});
    const available = CTPlayerColors.PALETTE.find(c => !occupied.includes(c.id));
    if (available) return available.value;
    return COLORS[i % COLORS.length];
  }
  let h = 0; for (const ch of String(pid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

// =====================================================================
//  Player state
// =====================================================================
function newPlayer(deck, name, prev, mode = 'london', dealId = null) {
  const m = {
    pid: S.pid, name, appearance: CTAppearance.getPrefs(), life: 40, poison: 0, ctr: {}, cmdDmg: {}, casts: {}, mull: 0, kept: false,
    openingDeal: dealId,
    revealHand: false, revealTop: false, revealTopOnce: null, seq: 0, lastTurn: 0, lastTurnSeq: 0,
    autoUntap: false, autoDraw: false, // always start a game with these off
    layout: prev && prev.layout ? cloneLayout(prev.layout) : defaultLayout(),
    // auto = untouched default zones: they (and the cards in them) stretch to fit whichever view is used
    layoutAuto: prev && prev.layout ? !!prev.layoutAuto : !LS.get('ct.layout2', null),
    defs: {}, tokens: [], cmdrs: [],
    zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [] }
  };
  const mk = (def, extra) => {
    m.defs[def.id] = def;
    return Object.assign({ iid: m.pid + '_' + (++m.seq), id: def.id, own: m.pid, t: false, fl: false, fd: false, c: {} }, extra);
  };
  m.zones.command = (deck.commanders || []).map(d => mk(d, { cmd: true }));
  m.cmdrs = m.zones.command.map(c => ({ iid: c.iid, name: m.defs[c.id].face || m.defs[c.id].name }));
  m.zones.library = shuffle(Deck.buildLibrary(deck).map(d => mk(d)));
  (deck.tokens || []).forEach(t => { m.defs[t.id] = t; });
  m.tokens = (deck.tokens || []).map(t => t.id);
  const opening = CTMulligan.deal(m.zones.library, m.defs, mode);
  m.zones.hand = opening.hand;
  m.openingFallback = opening.fallback;
  return m;
}
// Bring older saved games up to the current shape (layout + card positions).
function normalizeMe(m) {
  m.mull = clamp(num(m.mull), 0, CTMulligan.MAX_LIMIT);
  m.appearance = CTAppearance.normalizePrefs(m.appearance);
  if (!layoutOk(m.layout)) {
    // zones changed in this version: switch to the new layout and re-sort cards into it
    m.layout = defaultLayout();
    m.layoutAuto = !LS.get('ct.layout2', null);
    m.zones.battlefield.forEach(c => { if (!c.att) { delete c.x; delete c.y; } });
    m.bh = 0; // recompute the board height for the new layout
  }
  // keep zone names current for layouts saved by older versions
  m.layout.forEach(r => { const d = DEFAULT_LAYOUT.find(x => x.k === r.k); if (d) r.label = d.label; });
  m.zones.battlefield.forEach(c => { if (c.x == null && !c.att) autoPlace(c, 'battlefield', m); });
}
function mkCard(def, extra) {
  const m = S.me;
  m.defs[def.id] = m.defs[def.id] || def;
  return Object.assign({ iid: m.pid + '_' + (++m.seq), id: def.id, own: m.pid, t: false, fl: false, fd: false, c: {} }, extra);
}
const defOf = c => (c && c.id && S.me.defs[c.id]) || null;
const dname = d => (d ? (d.face || d.name || '?') : 'a card');
function findCard(iid) {
  for (const z of ZONES) {
    const i = S.me.zones[z].findIndex(c => c.iid === iid);
    if (i >= 0) return { zone: z, idx: i, card: S.me.zones[z][i] };
  }
  return null;
}

// --- placement on the free-form board
function regionKey(c, d) {
  if (c.fd || !d) return 'creatures';
  const t = (c.fl && d.backType) ? d.backType : (d.type || '');
  if (/Creature|Planeswalker|Battle/.test(t)) return 'creatures';
  if (/Land/.test(t)) return 'lands';
  return 'permanents'; // artifacts, enchantments and anything else
}
function centerIn(o, r) {
  const cx = o.x + CW / 2, cy = o.y + CH / 2;
  return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
}
// Put a card into the first free slot of its zone (basic lands & identical tokens pile up).
function autoPlace(card, zone, m = S.me) {
  const d = m.defs[card.id];
  const key = regionKey(card, d);
  const bh = m.bh || BH;
  const r = m.layout.find(x => x.k === key) || m.layout[0] || { x: 0, y: 0, w: BW, h: bh };
  const others = m.zones.battlefield.filter(o => o !== card && o.x != null && !o.att);
  if (zone === 'battlefield' && d && (/Basic/.test(d.type || '') || card.tok)) {
    const same = others.filter(o => o.id === card.id && !!o.tok === !!card.tok && !o.t && centerIn(o, r));
    if (same.length % 6) { const last = same[same.length - 1]; card.x = clamp(last.x + 12, 0, BW - CW); card.y = last.y; return; }
  }
  for (let y = r.y + 34; y + CH <= r.y + r.h + 2; y += CH + 8) {
    for (let x = r.x + 6; x + CW <= r.x + r.w + 2; x += CW + 8) {
      if (!others.some(o => Math.abs(o.x - x) < CW * 0.75 && Math.abs(o.y - y) < CH * 0.6)) { card.x = x; card.y = y; return; }
    }
  }
  // zone is full: cascade so cards stay visible
  const n = others.filter(o => centerIn(o, r)).length;
  const span = Math.max(22, r.w - CW - 6);
  card.x = clamp(r.x + 6 + (n * 22) % span, 0, BW - CW);
  card.y = clamp(r.y + 34 + (Math.floor((n * 22) / span) * 18) % Math.max(18, r.h - CH - 18), 0, bh - CH);
}
function tidyBoard() {
  const m = S.me;
  const all = m.zones.battlefield.filter(c => !c.att);
  all.forEach(c => { delete c.x; delete c.y; });
  all.forEach(c => autoPlace(c, 'battlefield'));
}

// --- the action pipeline: snapshot for undo -> mutate -> log -> publish/save/render
function snapshot() { const { defs, roomSaveRevision, ...rest } = S.me; return JSON.stringify(rest); }
let undoSerial = 0, undoContext = null;
function historyContext() {
  const t = S.table;
  return t ? [S.pid, t.room, t.openingDeal, !!t.started, t.turnSeq, t.active].join('|') : S.pid;
}
function clearUndo() { S.undo = []; }
function pushUndo(label = 'Changed your board', kind = 'action', deferTrim = false) {
  const t = S.table;
  const entry = { id: ++undoSerial, state: snapshot(), label, kind, context: historyContext(),
    phase: t && t.started ? `Round ${t.turn} · ${PHASES[t.phase]}` : 'Opening hand' };
  S.undo.push(entry);
  if (!deferTrim && S.undo.length > 40) S.undo.shift();
  return entry;
}
function actionLabel(before, result) {
  if (Array.isArray(result) && result[0]) return String(result[0]).replace(/\{(\d+)\}/g,
    (_, i) => result[1] && result[1][i] ? dname(result[1][i]) : 'a card').slice(0, 160);
  const old = JSON.parse(before), m = S.me;
  if (old.life !== m.life) return `Life ${old.life} → ${m.life}`;
  if (old.poison !== m.poison) return `Poison ${old.poison} → ${m.poison}`;
  for (const zone of ZONES) {
    const cards = m.zones[zone] || [], prior = old.zones[zone] || [];
    const changed = cards.find(c => { const p = prior.find(x => x.iid === c.iid); return p && JSON.stringify(p) !== JSON.stringify(c); });
    if (changed) return `Adjusted ${dname(defOf(changed))}`;
  }
  return 'Changed your board';
}
function act(fn, opts) {
  if (!S.me || boardTransferLock) return;
  const entry = !(opts && opts.noUndo) ? pushUndo(opts && opts.label, 'action', true) : null;
  const r = fn();
  if (entry && S.undo.includes(entry)) {
    if (entry.state === snapshot()) S.undo.splice(S.undo.indexOf(entry), 1);
    else entry.label = opts && opts.label || actionLabel(entry.state, r);
  }
  if (S.undo.length > 40) S.undo.shift();
  if (Array.isArray(r) && r[0]) say(r[0], r[1]);
  commit();
}
function commit() { publish(); saveSoon(); render(); }
function restorePersonalEntry(entry) {
  if (boardTransferLock || !S.me || S.dragging || S.regionDrag) return false;
  const index = S.undo.indexOf(entry);
  if (index < 0 || entry.context !== historyContext()) { UI.toast('That history is no longer available.'); return false; }
  const current = S.me, restored = JSON.parse(entry.state);
  // IDs and turn automation markers must never rewind with the board.
  restored.defs = current.defs;
  restored.roomSaveRevision = current.roomSaveRevision;
  restored.seq = Math.max(current.seq || 0, restored.seq || 0);
  restored.lastTurnSeq = current.lastTurnSeq;
  restored.lastTurn = current.lastTurn;
  restored.autoDraw = current.autoDraw; restored.autoUntap = current.autoUntap;
  S.me = restored;
  S.undo.splice(index);
  S.selected.clear(); S.hover = null;
  clearTimeout(lifeLog.timer); lifeLog.from = null; lifeLog.by = '';
  Object.values(cdLog).forEach(clearTimeout);
  // Keep card names from the private history out of the shared log.
  say(entry.kind === 'checkpoint' ? 'restored their board to a personal phase checkpoint' : 'undid their own action(s)');
  commit();
  return true;
}
function undo() {
  const entry = [...S.undo].reverse().find(e => e.kind === 'action');
  if (!entry) { UI.toast('Nothing to undo'); return; }
  restorePersonalEntry(entry);
}
async function choosePersonalEntry(entry) {
  if (!S.me) return;
  const before = snapshot();
  const ok = await UI.confirm(`Restore only your board to ${entry.kind === 'checkpoint' ? entry.label : 'before: ' + entry.label}? Later personal actions will be discarded. The shared turn, phase and other boards stay where they are.`, {
    title: 'Restore your board', okLabel: 'Restore my board'
  });
  if (!ok) return;
  if (!S.me || snapshot() !== before) { UI.toast('Your board changed while confirming. Choose a history entry again.'); return; }
  restorePersonalEntry(entry);
}
function undoHistoryMenu(btn) {
  const r = btn.getBoundingClientRect();
  const entries = S.undo.filter(e => e.context === historyContext());
  const actions = entries.filter(e => e.kind === 'action').reverse();
  const checkpoints = entries.filter(e => e.kind === 'checkpoint').reverse();
  const row = e => ({ label: e.kind === 'checkpoint' ? e.label : 'Before: ' + e.label, hint: e.phase, onClick: () => choosePersonalEntry(e) });
  UI.menu(r.left, r.bottom + 4, [
    { label: 'Your recent actions', disabled: true },
    ...(actions.length ? actions.map(row) : [{ label: 'No personal actions yet', disabled: true }]),
    { sep: true }, { label: 'Your phase checkpoints', disabled: true },
    { label: 'Save phase checkpoint', disabled: !S.table || !S.table.started || S.table.active !== S.pid,
      sub: PHASES.map((phase, i) => ({ label: phase, onClick: () => savePersonalCheckpoint(i) })) },
    ...(checkpoints.length ? checkpoints.map(row) : [{ label: 'Available during your turn', disabled: true }]),
    { sep: true }, { label: 'History resets at turns, transfers and incoming effects', disabled: true }
  ]);
}
function savePersonalCheckpoint(phase) {
  const t = S.table;
  if (boardTransferLock || !S.me || !t || !t.started || t.active !== S.pid || !Number.isInteger(phase) || !PHASES[phase]) return;
  const entry = pushUndo(`${PHASES[phase]} checkpoint`, 'checkpoint');
  entry.phase = `Round ${t.turn} · ${PHASES[phase]}`;
  UI.toast(`${PHASES[phase]} checkpoint saved for your board.`);
}
function preparePersonalHistory() {
  const context = historyContext();
  if (context !== undoContext) { clearUndo(); undoContext = context; }
}
function recordPhaseCheckpoint() {
  const t = S.table;
  if (!S.me || !t || !t.started || t.active !== S.pid) return;
  const key = historyContext() + '|' + t.phase;
  if (S.undo.some(e => e.kind === 'checkpoint' && e.key === key)) return;
  const entry = pushUndo(`${PHASES[t.phase]} start`, 'checkpoint');
  entry.key = key;
}
let undoClearedOpeningDeal = null;

// =====================================================================
//  Public view + messaging
// =====================================================================
function pubCard(c) {
  const pos = { x: c.x, y: c.y, att: c.att || null };
  if (c.fd) return Object.assign({ iid: c.iid, fd: 1, t: c.t ? 1 : 0, c: c.c, own: c.own, tok: c.tok ? 1 : 0 }, pos);
  return Object.assign({ iid: c.iid, id: c.id, t: c.t ? 1 : 0, fl: c.fl ? 1 : 0, c: c.c, own: c.own, tok: c.tok ? 1 : 0, cmd: c.cmd ? 1 : 0, cp: c.cp ? 1 : 0,
    pb: c.pb || undefined, dp: c.dp || 0, dt: c.dt || 0 }, pos);
}
function topIsRevealed(m) {
  const top = m && m.zones && m.zones.library && m.zones.library[0];
  return !!(m && (m.revealTop || (top && m.revealTopOnce === top.iid)));
}
function publicView() {
  const m = S.me, z = m.zones, defs = {};
  // (bw tells other players which board width our positions/layout use)
  const take = list => list.map(c => {
    const p = pubCard(c);
    if (p.id && m.defs[p.id]) defs[p.id] = Deck.slimDef(m.defs[p.id]);
    return p;
  });
  return {
    pid: m.pid, bw: BW, name: m.name, openingDeal: m.openingDeal, appearance: CTAppearance.normalizePrefs(m.appearance), life: m.life, poison: m.poison, ctr: m.ctr, cmdDmg: m.cmdDmg, cmdrs: m.cmdrs,
    casts: m.casts, hand: z.hand.length, lib: z.library.length, kept: m.kept, mullCount: m.mull, layout: m.layout, bh: myBH(),
    zones: { battlefield: take(z.battlefield), graveyard: take(z.graveyard), exile: take(z.exile), command: take(z.command) },
    revHand: m.revealHand ? take(z.hand) : null,
    // An individually revealed card is public only while it remains in its owner's hand.
    revCards: m.revealHand ? [] : z.hand.reduce((out, c, hIndex) => {
      if (c.rvh) {
        const p = take([c])[0];
        if (p) { p.hIndex = hIndex; out.push(p); }
      }
      return out;
    }, []),
    revTop: topIsRevealed(m) && z.library.length ? take([z.library[0]]) : null,
    defs
  };
}
let pubTimer = null;
function publish(now) { clearTimeout(pubTimer); pubTimer = setTimeout(doPublish, now ? 0 : 120); }
function doPublish() { if (!S.me || boardTransferLock) return; toHost({ t: 'pub', p: publicView() }); }

function toHost(msg) { if (S.role === 'client') Net.send({ ...msg, seatKey: seatKey() }); else hostRecv(msg, S.pid); }
function broadcast(msg) { if (S.role === 'host') Net.send(msg); onBroadcast(msg); }
function sendReq(to, req) {
  if (to === S.pid) onReq(req, S.pid);
  else { clearUndo(); toHost({ t: 'req', to, req }); }
}
function say(text, cards) {
  const cs = (cards || []).filter(Boolean).slice(0, 8).map(d => ({ id: d.id || '', name: dname(d), img: d.img || '', imgBack: d.imgBack || '' }));
  toHost({ t: 'log', text, cards: cs });
}

function cleanChatEntry(raw) {
  if (!isObj(raw)) return null;
  const text = String(raw.text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!text) return null;
  return { ts: Math.max(0, num(raw.ts, Date.now())), pid: String(raw.pid || '').slice(0, 40), name: String(raw.name || 'Player').slice(0, 40) || 'Player', text };
}
function cleanChatHistory(list) { return Array.isArray(list) ? list.slice(-100).map(cleanChatEntry).filter(Boolean) : []; }
function cleanChatMessage(msg, from) {
  if (!S.table || !Array.isArray(S.table.seats) || !S.table.seats.includes(from)) return null;
  return cleanChatEntry({ ts: Date.now(), pid: from, name: pname(from), text: msg && msg.text });
}
function sendChat(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!clean) return false;
  if (S.role === 'solo') { UI.toast('Room chat is available in a shared game.', { kind: 'warn' }); return false; }
  if (S.net.state !== 'online') { UI.toast('Reconnect before sending a chat message.', { kind: 'warn' }); return false; }
  toHost({ t: 'chat', text: clean });
  return true;
}

// ----- host side -----
function newTable(room, openingMode = 'london', openingDeal = uid()) {
  S.chat = []; S.chatOpen = false; S.chatUnread = 0; S.seatKeys = {}; S.pendingSeats = {}; S.boardBackups = {}; roomBackupSent.clear();
  return { room, seats: [S.pid], colorVersion: 1, colors: {}, order: [], active: null, turn: 0, turnSeq: 0, phase: 3, started: false, monarch: null, initiative: null, out: {}, hostPid: S.pid, mods: [], kicked: [], handoffs: {},
    openingMode: CTMulligan.normalizeMode(openingMode), openingDeal, openingAllowances: {} };
}
function hostRecv(msg, from) {
  if (!msg || typeof msg.t !== 'string' || !S.table) return;
  if ((S.table.kicked || []).includes(from)) { directPlayer(from, { t: 'moderation-exit', reason: 'Your seat was removed by a moderator.' }); return; }
  if (handleHostBoardTransfer(msg, from)) return;
  switch (msg.t) {
    case 'pub': {
      const p = cleanPub(msg.p, from); if (!p) return;
      // A client on an older or modified page must not introduce battlefield
      // cards while everyone is still choosing opening hands.
      if (!S.table.started) p.zones.battlefield = [];
      if (!S.table.seats.includes(from)) {
        const duplicate = S.table.seats.find(pid => pid !== from && S.players[pid] && samePlayerName(S.players[pid].name, p.name));
        if (duplicate) { S.pendingSeats = S.pendingSeats || {}; S.pendingSeats[from] = { p, claimSource: duplicate }; directPlayer(from, { t: 'seat-conflict', name: p.name, pid: duplicate }); return; }
        if (S.table.colorVersion >= 1 && !S.table.colors?.[from]) { S.pendingSeats = S.pendingSeats || {}; S.pendingSeats[from] = { p, selectingColor: true }; return; }
      }
      S.players[from] = p;
      seat(from);
      broadcast({ t: 'pub', p });
      const arrows = CTTargeting.cleanList(S.targetArrows, S.players, S.table.seats);
      if (arrows.length !== S.targetArrows.length) broadcast({ t: 'arrows', arrows });
      break;
    }
    case 'private-board': { if (S.table.seats.includes(from)) saveRoomBoard(from, msg.data, msg.revision); return; }
    case 'recover-seat-request': {
      if ((!S.table.seats.includes(from) && !(S.pendingSeats || {})[from]) || !S.table.seats.includes(msg.source) || msg.source === S.pid || msg.source === from) return;
      const name = S.players[from]?.name || S.pendingSeats[from].p.name;
      broadcast({ t: 'recovery-request', request: { from, source: msg.source, name } }); return;
    }
    case 'log': { const e = cleanLog(msg, from); if (e) broadcast({ t: 'log', e }); break; }
    case 'chat': { const e = cleanChatMessage(msg, from); if (e) broadcast({ t: 'chat', e }); break; }
    case 'response': {
      const T = S.table;
      if (!T.started || !T.seats.includes(from) || T.out[from] || msg.deal !== T.openingDeal) return;
      broadcast({ t: 'response', pid: from, name: pname(from), deal: T.openingDeal, id: uid() + '_' + (++responseSerial) });
      break;
    }
    case 'arrows': {
      if (!S.table.seats.includes(from)) return;
      let arrows = CTTargeting.cleanList(S.targetArrows, S.players, S.table.seats);
      if (msg.k === 'clear') arrows = [];
      else if (msg.k === 'remove') {
        if (typeof msg.id !== 'string' || !arrows.some(a => a.id === msg.id)) return;
        arrows = arrows.filter(a => a.id !== msg.id);
      } else if (msg.k === 'add') {
        if (arrows.length >= CTTargeting.MAX_ARROWS) return; // never erase an older arrow to make room
        const source = CTTargeting.endpoint(msg.arrow && msg.arrow.from, S.players, S.table.seats);
        const target = CTTargeting.endpoint(msg.arrow && msg.arrow.to, S.players, S.table.seats);
        if (!source || !target || CTTargeting.same(source, target)) return;
        if (arrows.some(a => a.by === from && CTTargeting.same(a.from, source) && CTTargeting.same(a.to, target))) return;
        const arrow = CTTargeting.clean({ id: 'a' + (++arrowSerial) + '_' + uid(), by: from, from: source, to: target }, S.players, S.table.seats);
        if (!arrow) return;
        arrows = arrows.concat(arrow);
      } else return;
      broadcast({ t: 'arrows', arrows });
      break;
    }
    case 'drawfx': {
      if (!S.table.seats.includes(from)) return;
      const count = clamp(Math.floor(num(msg.count, 1)), 1, 5);
      broadcast({ t: 'drawfx', pid: from, count });
      break;
    }
    case 'slamfx': {
      if (!S.table.seats.includes(from) || typeof msg.iid !== 'string' || !/^[\w-]{1,40}$/.test(msg.iid)) return;
      const player = S.players[from];
      const card = player && player.zones && Array.isArray(player.zones.battlefield) && player.zones.battlefield.find(c => c.iid === msg.iid);
      const knownCommander = player && Array.isArray(player.cmdrs) && player.cmdrs.some(c => c.iid === msg.iid);
      if (!card || !(card.cmd || knownCommander)) return;
      const ci = Array.isArray(msg.ci) ? [...new Set(msg.ci.filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c)))] : [];
      broadcast({ t: 'slamfx', pid: from, iid: msg.iid, ci });
      break;
    }
    case 'placefx': {
      if (!S.table.seats.includes(from) || typeof msg.iid !== 'string' || !/^[\w-]{1,40}$/.test(msg.iid)) return;
      const player = S.players[from];
      const card = player && player.zones && Array.isArray(player.zones.battlefield) && player.zones.battlefield.find(c => c.iid === msg.iid);
      if (!card) return;
      broadcast({ t: 'placefx', pid: from, iid: msg.iid });
      break;
    }
    case 'op': tableOp(msg.op, from); break;
    case 'req': {
      if (typeof msg.to !== 'string') return;
      const req = msg.req;
      if (!S.table.started && req && (req.k === 'give' || req.k === 'take' || (req.k === 'return' && req.zone === 'battlefield'))) return;
      if (msg.to === S.pid) onReq(msg.req, from);
      else if (S.role === 'host') Net.sendTo(msg.to, { t: 'req', from, req: msg.req });
      break;
    }
    case 'tsync': {
      if (!S.table.seats.includes(from)) return;
      // A player reconnected with a copy of the table. If it's newer than ours (the host
      // reloaded before its last change was saved), adopt it; otherwise ignore it.
      const t = cleanTable(msg.table);
      if (!t || t.room !== S.table.room || t.rev <= (S.table.rev || 0) || !t.seats.includes(S.pid)) return;
      if (!S.table.started && t.started && openingPending(S.table).length) {
        t.started = false; t.order = []; t.active = null; t.turn = 0; t.turnSeq = 0;
      }
      t.seats = S.table.seats.slice(); t.out = { ...S.table.out };
      t.hostPid = S.pid; t.mods = S.table.mods || []; t.kicked = S.table.kicked || []; t.handoffs = S.table.handoffs || {};
      // Recovery can restore host table changes, but only the host may choose the
      // opening policy or advance its deal epoch.
      t.openingMode = S.table.openingMode;
      t.openingDeal = S.table.openingDeal;
      t.openingAllowances = S.table.openingAllowances || {};
      // A guest's recovery copy is useful for turn and seat state, but confirmed
      // player colors are assigned and persisted by the host only.
      t.colors = CTPlayerColors.normalize(t.seats,
        Object.fromEntries(Object.entries(S.table.colors || {}).filter(([pid]) => t.seats.includes(pid))), false);
      t.colorVersion = 1;
      S.table = t;
      sysLog(`Restored the latest table state (turn ${t.turn}) from ${pname(from)}.`);
      afterTable();
      pushTable();
      break;
    }
  }
}
function seat(pid, assignedColors) {
  const T = S.table;
  if (T.seats.includes(pid) || T.seats.length >= 6) return;
  T.seats.push(pid);
  T.colors = CTPlayerColors.normalize(T.seats, assignedColors || T.colors, !(T.colorVersion >= 1));
  if (T.started && !T.order.includes(pid)) T.order.push(pid);
  sysLog(`${pname(pid)} joined the table.`);
  pushTable();
}
// Host: send the table to everyone. `rev` goes up on every change, and the host saves at
// once, so after a host reload the newest table always wins (see 'tsync').
function pushTable() {
  S.table.rev = (S.table.rev || 0) + 1;
  broadcast({ t: 'table', table: S.table });
  saveNow();
}
function cleanTable(t) {
  if (!isObj(t)) return null;
  const ids = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(0, 8).map(x => x.slice(0, 40)) : []);
  const str = x => (typeof x === 'string' ? x.slice(0, 40) : null);
  const seats = CTPlayerColors.cleanSeats(ids(t.seats)), colorVersion = Math.max(0, num(t.colorVersion));
  const openingAllowances = isObj(t.openingAllowances)
    ? Object.fromEntries(Object.entries(t.openingAllowances).filter(([pid]) => seats.includes(pid)).slice(0, 8)
      .map(([pid, n]) => [pid.slice(0, 40), CTMulligan.extraLimit(n)])) : {};
  return {
    room: String(t.room || '').slice(0, 8), seats, colorVersion: 1,
    colors: CTPlayerColors.normalize(seats, t.colors, colorVersion < 1), order: ids(t.order), active: str(t.active),
    turn: Math.max(0, num(t.turn)), turnSeq: Math.max(0, num(t.turnSeq, num(t.turn))), phase: clamp(num(t.phase, 3), 0, PHASES.length - 1), started: !!t.started,
    monarch: str(t.monarch), initiative: str(t.initiative),
    openingMode: CTMulligan.normalizeMode(t.openingMode), openingDeal: str(t.openingDeal), openingAllowances,
    out: isObj(t.out) ? Object.fromEntries(Object.keys(t.out).slice(0, 8).map(k => [k.slice(0, 40), !!t.out[k]])) : {},
    hostPid: str(t.hostPid), mods: ids(t.mods).filter(p => ids(t.seats).includes(p)),
    kicked: Array.isArray(t.kicked) ? [...new Set(t.kicked.filter(p => typeof p === 'string').map(p => p.slice(0, 40)))].slice(0, 128) : [],
    handoffs: cleanHandoffs(t.handoffs),
    rev: Math.max(0, num(t.rev))
  };
}
function sysLog(text) { broadcast({ t: 'log', e: { ts: Date.now(), pid: null, name: '', text, cards: [] } }); }
function rollFirstPlayer(T, live) {
  const rolls = new Map(live.map(p => [p, rnd(20) + 1]));
  // Tied high rolls re-roll until each player has a distinct result.
  for (let attempt = 0; attempt < 100; attempt++) {
    const groups = new Map();
    for (const p of live) { const v = rolls.get(p); if (!groups.has(v)) groups.set(v, []); groups.get(v).push(p); }
    const ties = [...groups.values()].filter(g => g.length > 1);
    if (!ties.length) break;
    ties.forEach(group => group.forEach(p => rolls.set(p, rnd(20) + 1)));
  }
  T.order = live.slice().sort((a, b) => rolls.get(b) - rolls.get(a));
  broadcast({ t: 'firstroll', rolls: live.map(pid => ({ pid, name: pname(pid), value: rolls.get(pid) })), winner: T.order[0] });
  sysLog(`Roll for first player (d20): ${T.order.map(p => `${pname(p)} rolled ${rolls.get(p)}`).join(' · ')}. ${pname(T.order[0])} goes first.`);
}

function openingPending(T = S.table) {
  if (!T) return [];
  return T.seats.filter(pid => !T.out[pid]).filter(pid => {
    const p = S.players[pid];
    return !p || !p.kept || p.openingDeal !== T.openingDeal;
  });
}

function tableOp(op, from) {
  const T = S.table;
  if (!isObj(op) || typeof op.k !== 'string') return;
  const isHost = from === S.pid;
  if (!T.seats.includes(from) && !(op.k === 'joincolor' && S.pendingSeats?.[from]?.selectingColor)) return;
  const moderator = isHost || (T.mods || []).includes(from);
  switch (op.k) {
    case 'color': {
      if (!T.seats.includes(from)) return;
      if (T.colors && T.colors[from]) return; // the first confirmed choice locks this seat
      const colors = CTPlayerColors.claim(T.seats, T.colors, from, op.color);
      if (!colors) {
        broadcast({ t: 'colorerror', pid: from, reason: 'taken' });
        return;
      }
      T.colors = colors;
      pushTable();
      return;
    }
    case 'joincolor': {
      if (T.colors && T.colors[from]) return;
      const alreadySeated = T.seats.includes(from);
      if (!alreadySeated && T.seats.length >= 6) {
        broadcast({ t: 'colorerror', pid: from, reason: 'full' });
        return;
      }
      const seats = alreadySeated ? T.seats : T.seats.concat(from);
      const colors = CTPlayerColors.claim(seats, T.colors, from, op.color);
      if (!colors) {
        broadcast({ t: 'colorerror', pid: from, reason: 'taken' });
        return;
      }
      if (alreadySeated) { T.colors = colors; pushTable(); }
      else {
        const pending = S.pendingSeats?.[from];
        if (!pending?.selectingColor) return;
        // A name may have been claimed while this chooser was open.
        const duplicate = T.seats.find(pid => S.players[pid] && samePlayerName(S.players[pid].name, pending.p.name));
        if (duplicate) { S.pendingSeats[from] = { p: pending.p, claimSource: duplicate }; directPlayer(from, { t: 'seat-conflict', name: pending.p.name, pid: duplicate }); return; }
        S.players[from] = pending.p; delete S.pendingSeats[from];
        seat(from, colors); broadcast({ t: 'pub', p: S.players[from] });
      }
      return;
    }
    case 'rollfirst': {
      if (T.started) return;
      const live = T.seats.filter(p => !T.out[p]);
      if (!live.length) return;
      rollFirstPlayer(T, live);
      break;
    }
    case 'mulligan': {
      if (!isHost || T.started) return;
      const mode = CTMulligan.normalizeMode(op.mode);
      if (mode === T.openingMode) return;
      T.openingMode = mode;
      T.openingDeal = uid();
      T.openingAllowances = {};
      Object.assign(T, { order: [], active: null, turn: 0, turnSeq: 0, phase: 3, started: false, monarch: null, initiative: null, out: {} });
      pushTable();
      broadcast({ t: 'newgame', openingMode: T.openingMode, openingDeal: T.openingDeal });
      sysLog(`Opening-hand rule changed to ${openingModeName(mode)}. Everyone reshuffled and redealt.`);
      return;
    }
    case 'grantmull': {
      if (!isHost || !T.seats.includes(op.pid) || T.openingMode === 'london') return;
      const target = op.pid === S.pid ? null : S.players[op.pid];
      if (op.pid === S.pid ? S.me.kept : !target || target.kept) return;
      const grants = CTMulligan.extraLimit((T.openingAllowances || {})[op.pid]);
      if (grants >= CTMulligan.MAX_EXTRA) return;
      T.openingAllowances = T.openingAllowances || {};
      T.openingAllowances[op.pid] = grants + 1;
      sysLog(`${pname(op.pid)} was granted another mulligan by ${pname(S.pid)}.`);
      break;
    }
    case 'start': {
      if (!isHost || T.started) return;
      const live = T.seats.filter(p => !T.out[p]);
      if (!live.length) return;
      const pending = openingPending(T);
      if (pending.length) {
        UI.toast(`Waiting for ${pending.map(pname).join(', ')} to keep a current opening hand.`, { kind: 'warn', ms: 7000 });
        return;
      }
      // Starting a game always chooses the turn order with the animated d20 roll.
      rollFirstPlayer(T, live);
      T.active = T.order[0] || null; T.turn = 1; T.turnSeq = 1; T.phase = 3; T.started = true;
      sysLog(`Game started! Turn order: ${T.order.map(pname).join(' → ')}. ${T.active ? pname(T.active) + ' goes first.' : 'No players are seated.'}`);
      break;
    }
    case 'pass': {
      if (!T.started || !T.active) return;
      // turnSeq guards duplicate/late pass messages; turn counts full rounds only.
      const expectedSeq = Math.max(1, num(T.turnSeq, num(T.turn)));
      const suppliedSeq = op.turnSeq != null ? num(op.turnSeq) : (op.turn != null ? num(op.turn) : expectedSeq);
      if (suppliedSeq !== expectedSeq) return;
      const live = T.order.filter(p => !T.out[p]);
      if (!live.length) return;
      const i = live.indexOf(T.active);
      if (i < 0) return;
      const next = (i + 1) % live.length;
      T.active = live[next];
      if (next === 0) T.turn++;
      T.turnSeq = expectedSeq + 1; T.phase = 3;
      sysLog(`Round ${T.turn}: ${pname(T.active)}'s turn${from !== T.active && from !== live[i] ? ` (passed by ${pname(from)})` : ''}`);
      break;
    }
    case 'phase': T.phase = clamp(num(op.v), 0, PHASES.length - 1); break;
    case 'monarch': T.monarch = T.seats.includes(op.pid) ? op.pid : null;
      sysLog(T.monarch ? `${pname(T.monarch)} is the monarch 👑` : 'Nobody is the monarch.'); break;
    case 'initiative': T.initiative = T.seats.includes(op.pid) ? op.pid : null;
      sysLog(T.initiative ? `${pname(T.initiative)} has the initiative 🏰` : 'Nobody has the initiative.'); break;
    case 'concede': {
      if (!T.seats.includes(from) || T.out[from]) return;
      const liveBefore = T.order.filter(p => !T.out[p]);
      const activeIndexBefore = liveBefore.indexOf(T.active);
      const wasActive = T.started && T.active === from;
      T.out[from] = true;
      sysLog(`${pname(from)} conceded the game.`);
      if (wasActive) {
        const live = T.order.filter(p => !T.out[p]);
        if (!live.length) {
          T.active = null;
        } else {
          const orderIndex = T.order.indexOf(from);
          let nextPlayer = null;
          for (let step = 1; step <= T.order.length; step++) {
            const candidate = T.order[(orderIndex + step) % T.order.length];
            if (!T.out[candidate]) { nextPlayer = candidate; break; }
          }
          T.active = nextPlayer;
          if (activeIndexBefore === liveBefore.length - 1) T.turn++;
          T.turnSeq = Math.max(1, num(T.turnSeq, num(T.turn))) + 1;
          T.phase = 3;
        }
      }
      break;
    }
    case 'moderator': {
      if (!isHost || !T.seats.includes(op.pid) || op.pid === S.pid || typeof op.enabled !== 'boolean') return;
      T.mods = (T.mods || []).filter(p => p !== op.pid);
      if (op.enabled) T.mods.push(op.pid);
      sysLog(`${pname(op.pid)} ${op.enabled ? 'was granted' : 'lost'} moderator permissions.`);
      break;
    }
    case 'reinstate': {
      if (!moderator || !T.seats.includes(op.pid) || !T.out[op.pid]) return;
      delete T.out[op.pid];
      if (T.started && !T.order.includes(op.pid)) T.order.push(op.pid);
      if (T.started && !T.active) { T.active = op.pid; T.turnSeq = Math.max(1, num(T.turnSeq)) + 1; }
      sysLog(`${pname(op.pid)} was restored to the game by ${pname(from)}.`);
      break;
    }
    case 'handoff': {
      if (!moderator) return;
      beginBoardTransfer(op.pid, op.to, from); return;
    }
    case 'kick': {
      if (!moderator || op.pid === S.pid || !T.seats.includes(op.pid)) return;
      if (pendingBoardTransfer) abortBoardTransfer('The handoff was cancelled because a seat was removed.');
      T.kicked = [...new Set([...(T.kicked || []), op.pid])].slice(-128);
      T.mods = (T.mods || []).filter(p => p !== op.pid);
      delete T.out[op.pid];
      if (T.monarch === op.pid) T.monarch = null;
      if (T.initiative === op.pid) T.initiative = null;
      directPlayer(op.pid, { t: 'moderation-exit', reason: 'Your seat was removed by a moderator.' });
      T.seats = T.seats.filter(p => p !== op.pid); T.order = T.order.filter(p => p !== op.pid);
      if (T.colors) delete T.colors[op.pid];
      if (T.openingAllowances) delete T.openingAllowances[op.pid];
      if (T.active === op.pid) { T.active = T.order.find(p => !T.out[p]) || null; T.turnSeq = Math.max(1, num(T.turnSeq)) + 1; T.phase = 3; }
      sysLog(`${pname(op.pid)} was removed from the table.`);
      delete S.players[op.pid];
      if (S.boardBackups) delete S.boardBackups[op.pid];
      if (typeof Net.roomVault === 'function') Net.roomVault('delete', { pid: op.pid }).catch(() => {});
      break;
    }
    case 'newgame': {
      if (!isHost) return;
      Object.assign(T, { order: [], active: null, turn: 0, turnSeq: 0, phase: 3, started: false, monarch: null, initiative: null, out: {} });
      T.openingDeal = uid();
      T.openingAllowances = {};
      pushTable();
      broadcast({ t: 'newgame', openingMode: T.openingMode, openingDeal: T.openingDeal });
      sysLog(`New game — everyone reshuffled and used ${openingModeName(T.openingMode)}.`);
      return;
    }
    default: return;
  }
  pushTable();
}

// Validate anything another browser sent us before it touches our state or DOM.
function cleanCards(a, n = 400) {
  return Array.isArray(a) ? a.slice(0, n).filter(x => isObj(x) && typeof x.iid === 'string').map(x => ({
    iid: x.iid.slice(0, 40), id: typeof x.id === 'string' ? x.id.slice(0, 40) : undefined, t: x.t ? 1 : 0, fl: x.fl ? 1 : 0,
    fd: x.fd ? 1 : 0, own: typeof x.own === 'string' ? x.own.slice(0, 40) : '', tok: x.tok ? 1 : 0, cmd: x.cmd ? 1 : 0, cp: x.cp ? 1 : 0,
    c: isObj(x.c) ? Object.fromEntries(Object.entries(x.c).slice(0, 12).map(([k, v]) => [String(k).slice(0, 20), num(v)])) : {},
    x: Number.isFinite(+x.x) && x.x !== null ? clamp(Math.round(+x.x), 0, BW - CW) : undefined,
    y: Number.isFinite(+x.y) && x.y !== null ? clamp(Math.round(+x.y), 0, BH_MAX - CH) : undefined,
    att: isObj(x.att) && typeof x.att.p === 'string' && typeof x.att.i === 'string' ? { p: x.att.p.slice(0, 40), i: x.att.i.slice(0, 40) } : null,
    pb: typeof x.pb === 'string' && /^-?\d{1,3}\/-?\d{1,3}$/.test(x.pb) ? x.pb : undefined,
    dp: clamp(num(x.dp), -999, 999), dt: clamp(num(x.dt), -999, 999)
  })) : [];
}
const numMap = o => (isObj(o) ? Object.fromEntries(Object.entries(o).slice(0, 40).map(([k, v]) => [String(k).slice(0, 90), num(v)])) : {});
function cleanPub(p, from) {
  if (!isObj(p)) return null;
  const z = isObj(p.zones) ? p.zones : {};
  // A board from a client with a different board width: scale x and widths so it still lines up.
  const k = BW / clamp(num(p.bw, OLD_BW), 400, 4000);
  if (k !== 1) {
    const sx = list => (Array.isArray(list) ? list.map(c => (isObj(c) && Number.isFinite(+c.x) && c.x !== null ? Object.assign({}, c, { x: +c.x * k }) : c)) : list);
    z.battlefield = sx(z.battlefield);
    if (Array.isArray(p.layout)) p.layout = p.layout.map(r => (isObj(r) ? Object.assign({}, r, { x: num(r.x) * k, w: num(r.w) * k }) : r));
  }
  return {
    pid: from, name: String(p.name || 'Player').slice(0, 24), appearance: CTAppearance.normalizePrefs(p.appearance), life: num(p.life, 40), poison: num(p.poison),
    ctr: numMap(p.ctr), cmdDmg: numMap(p.cmdDmg), casts: numMap(p.casts),
    cmdrs: Array.isArray(p.cmdrs) ? p.cmdrs.slice(0, 3).filter(isObj).map(c => ({ iid: String(c.iid).slice(0, 40), name: String(c.name || '').slice(0, 80) })) : [],
    hand: num(p.hand), lib: num(p.lib), openingDeal: typeof p.openingDeal === 'string' ? p.openingDeal.slice(0, 40) : null,
    kept: !!p.kept, mullCount: clamp(num(p.mullCount), 0, CTMulligan.MAX_LIMIT),
    layout: cleanLayout(p.layout) || cloneLayout(DEFAULT_LAYOUT), bh: clamp(num(p.bh, BH), BH, BH_MAX),
    zones: { battlefield: cleanCards(z.battlefield), graveyard: cleanCards(z.graveyard), exile: cleanCards(z.exile), command: cleanCards(z.command, 4) },
    revHand: p.revHand ? cleanCards(p.revHand, 60) : null,
    revCards: Array.isArray(p.revCards) ? p.revCards.slice(0, 60).map(raw => {
      const c = cleanCards([raw], 1)[0];
      const hIndex = raw && raw.hIndex;
      if (!c || !c.iid.startsWith(from + '_') || !Number.isInteger(hIndex) || hIndex < 0 || hIndex >= Math.min(60, Math.max(0, num(p.hand)))) return null;
      return Object.assign(c, { hIndex });
    }).filter(Boolean) : [],
    revTop: p.revTop ? cleanCards(p.revTop, 1) : null,
    defs: isObj(p.defs) ? p.defs : {}
  };
}
function cleanLog(msg, from) {
  const text = String(msg.text || '').slice(0, 300);
  if (!text) return null;
  const cards = Array.isArray(msg.cards) ? msg.cards.slice(0, 8).filter(isObj).map(c => ({
    id: String(c.id || '').slice(0, 40), name: String(c.name || '').slice(0, 80), img: String(c.img || ''), imgBack: String(c.imgBack || '')
  })) : [];
  return { ts: Date.now(), pid: from, name: pname(from), text, cards };
}

// ----- everyone -----
function showFirstRoll(msg) {
  const raw = Array.isArray(msg.rolls) ? msg.rolls.slice(0, 6) : [];
  const seen = new Set();
  const results = raw.filter(item => {
    if (!isObj(item) || typeof item.pid !== 'string' || seen.has(item.pid)) return false;
    const value = +item.value;
    if (!Number.isInteger(value) || value < 1 || value > 20) return false;
    seen.add(item.pid);
    return true;
  }).map(item => ({
    pid: item.pid,
    name: typeof item.name === 'string' && item.name ? item.name : pname(item.pid),
    value: +item.value
  }));
  if (!results.length) return;

  const previous = $('#firstRollOverlay');
  if (previous) {
    (previous._ctRollIntervals || []).forEach(clearInterval);
    (previous._ctRollTimeouts || []).forEach(clearTimeout);
    previous.remove();
  }

  const winner = typeof msg.winner === 'string' ? msg.winner : '';
  const overlay = document.createElement('div');
  overlay.id = 'firstRollOverlay';
  overlay.className = 'first-roll-overlay';
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', 'Roll for first player results');
  overlay._ctRollIntervals = [];
  overlay._ctRollTimeouts = [];
  overlay.innerHTML = `
    <section class="first-roll-panel">
      <div class="first-roll-eyebrow">TURN ORDER</div>
      <h2 class="first-roll-title">Roll for first player</h2>
      <div class="first-roll-subtitle">Everyone rolls a d20 · highest goes first</div>
      <div class="first-roll-grid">
        ${results.map((result, index) => `
          <div class="first-roll-tile" style="--first-roll-color:${esc(colorOf(result.pid))}"
               data-roll="${result.value}" data-winner="${result.pid === winner ? 'true' : 'false'}"
               aria-label="${esc(result.name)} d20 result">
            <div class="first-roll-name">${esc(result.name)}</div>
            <div class="first-roll-die" aria-hidden="true">
              <span class="first-roll-number">20</span>
            </div>
            <div class="first-roll-die-caption">D20</div>
            <div class="first-roll-winner">GOES FIRST</div>
          </div>`).join('')}
      </div>
      <div class="first-roll-foot">Tied high rolls re-roll automatically</div>
    </section>`;
  document.body.appendChild(overlay);

  const tiles = [...overlay.querySelectorAll('.first-roll-tile')];
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let lastRevealAt = 0;

  tiles.forEach((tile, index) => {
    const result = clamp(num(tile.dataset.roll, 1), 1, 20);
    const number = tile.querySelector('.first-roll-number');
    if (reduceMotion) {
      number.textContent = String(result);
      tile.classList.add('revealed');
      if (tile.dataset.winner === 'true') tile.classList.add('winner');
      return;
    }

    tile.classList.add('rolling');
    const rollDelay = index * 140;
    const stopAfter = 2400;
    lastRevealAt = Math.max(lastRevealAt, rollDelay + stopAfter);
    // Stagger when each d20 starts, then let it tumble for a full three rotations.
    const startRoll = setTimeout(() => {
      if (!overlay.isConnected) return;
      const startedAt = Date.now();
      const interval = setInterval(() => {
        if (!overlay.isConnected) { clearInterval(interval); return; }
        if (Date.now() - startedAt >= stopAfter) {
          clearInterval(interval);
          number.textContent = String(result);
          tile.classList.remove('rolling');
          tile.classList.add('revealed');
          if (tile.dataset.winner === 'true') tile.classList.add('winner');
        } else {
          number.textContent = String(rnd(20) + 1);
        }
      }, 75);
      overlay._ctRollIntervals.push(interval);
    }, rollDelay);
    overlay._ctRollTimeouts.push(startRoll);
  });

  const dismiss = setTimeout(() => {
    if (!overlay.isConnected) return;
    overlay.classList.add('is-leaving');
    const remove = setTimeout(() => overlay.remove(), 240);
    overlay._ctRollTimeouts.push(remove);
  }, (reduceMotion ? 0 : lastRevealAt) + 3000);
  overlay._ctRollTimeouts.push(dismiss);
}

function onBroadcast(msg) {
  if (handleClientModeration(msg)) return;
  switch (msg.t) {
    case 'response': showResponseNotice(msg); return; // transient; no save, log or Undo entry
    case 'pub': if (msg.p && msg.p.pid) { S.players[msg.p.pid] = msg.p; if (msg.p.pid !== S.pid) checkOrphans(); } break;
    case 'log': S.log.push(msg.e); if (S.log.length > 300) S.log.splice(0, S.log.length - 300); break;
    case 'chat': {
      const e = cleanChatEntry(msg.e);
      if (e) {
        S.chat.push(e);
        if (S.chat.length > 100) S.chat.splice(0, S.chat.length - 100);
        if (e.pid !== S.pid) {
          pulseChatButton();
          playChatChime();
          if (S.chatOpen) pulseChatPanel();
          else { S.chatUnread++; showChatPopup(e); }
        }
        renderChatHistory(false, S.chatOpen && e.pid !== S.pid ? e : null);
      }
      break;
    }
    case 'arrows': S.targetArrows = CTTargeting.cleanList(msg.arrows, S.players, (S.table && S.table.seats) || []); refreshTargeting(); break;
    case 'drawfx': if (typeof msg.pid === 'string') animateDrawCard(msg.pid, clamp(Math.floor(num(msg.count, 1)), 1, 5)); break;
    case 'slamfx':
      if (typeof msg.pid === 'string' && typeof msg.iid === 'string') {
        const ci = Array.isArray(msg.ci) ? [...new Set(msg.ci.filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c)))] : [];
        animateCommanderSlam(msg.pid, msg.iid, ci);
      }
      break;
    case 'placefx':
      if (typeof msg.pid === 'string' && typeof msg.iid === 'string' && msg.pid !== S.pid) playCardPlaceSound();
      break;
    case 'table': S.table = cleanTable(msg.table); applyCommittedHandoff(); if (handleRemovedSeat()) return; syncColorFlow(); reconcileOpeningDeal(S.table); handleTurnNoticeUpdate(S.table); afterTable(); break;
    case 'colorerror': if (msg.pid === S.pid) {
      S.colorRequestPending = false;
      const reason = msg.reason === 'full' ? 'This room has no open color slots.' : 'That color was just taken. Choose another available color.';
      UI.toast(reason, { kind: 'warn' });
      if (S.colorFlow) showColorPicker(reason);
    } break;
    case 'firstroll': showFirstRoll(msg); break;
    case 'online': S.online = msg.online || {}; break;
    case 'newgame':
      if (S.table && msg.openingDeal) {
        S.table.openingMode = CTMulligan.normalizeMode(msg.openingMode);
        S.table.openingDeal = String(msg.openingDeal).slice(0, 40);
      }
      resetForNewGame(); break;
    default: return;
  }
  saveSoon(); render();
}
function clientRecv(msg) {
  if (!msg) return;
  if (handleClientModeration(msg)) return;
  if (msg.t === 'snap') {
    S.table = msg.table; S.players = msg.players || {}; S.log = msg.log || []; S.online = msg.online || {}; S.boardBackups = msg.boardBackups || {}; S.chat = cleanChatHistory(msg.chat);
    reconcileOpeningDeal(S.table);
    seedTurnNotice(S.table);
    S.targetArrows = CTTargeting.cleanList(msg.arrows, S.players, (S.table && S.table.seats) || []);
    applyCommittedHandoff(); if (handleRemovedSeat()) return;
    S.players[S.pid] = publicView();
    checkOrphans();
    if (ownColorLocked()) {
      S.colorFlow = false; S.colorRequestPending = false;
      closeColorModal();
      publish(true);
    } else if (S.colorFlow) showColorPicker();
    afterTable(); saveSoon(); render();
    return;
  }
  if (msg.t === 'req') { onReq(msg.req, msg.from); return; }
  onBroadcast(msg);
}
function snapFor() { return { t: 'snap', table: S.table, players: S.players, log: S.log.slice(-150), online: S.online, chat: S.chat.slice(-100), arrows: S.targetArrows, boardBackups: S.boardBackups || {} }; }

// Requests from other players, applied to MY state.
function onReq(req, from) {
  const before = S.me && snapshot();
  try { applyPlayerRequest(req, from); }
  finally {
    // Incoming effects belong to their sender; never rewind across them.
    if (S.me && before !== snapshot()) clearUndo();
  }
}
function applyPlayerRequest(req, from) {
  if (!isObj(req) || typeof req.k !== 'string') return;
  if (req.k === 'give' || req.k === 'return') {
    const c = cleanCards([req.card], 1)[0]; const d = isObj(req.def) ? req.def : null;
    if (!c || !d || typeof d.id !== 'string') return;
    const zone = req.k === 'give' ? 'battlefield' : (ZONES.includes(req.zone) ? req.zone : 'graveyard');
    if (zone === 'battlefield' && !canEnterBattlefield()) {
      UI.toast('The battlefield opens when the host starts the game.', { kind: 'warn' });
      return;
    }
    act(() => {
      if (!S.me.defs[d.id]) S.me.defs[d.id] = d;
      if (findCard(c.iid)) return null; // already have it (duplicate message)
      const card = { iid: c.iid, id: d.id, own: c.own || from, t: zone === 'battlefield' ? !!c.t : false, fl: false, fd: false, c: zone === 'battlefield' ? c.c : {}, tok: !!c.tok, cmd: !!c.cmd, cp: !!c.cp };
      if (req.k === 'return' && card.tok && zone !== 'battlefield') return null;
      insertCard(card, zone, zone === 'battlefield' && Number.isFinite(+req.x) && Number.isFinite(+req.y) ? { x: +req.x, y: +req.y } : { pos: req.pos });
      return req.k === 'give'
        ? [`gained control of {0} from ${pname(from)}`, [d]]
        : [`got {0} back from ${pname(from)} (to ${ZL[zone]})`, [d]];
    }, { noUndo: true });
    if (req.k === 'return' && c.cmd && c.own === S.pid && zone !== 'command' && zone !== 'battlefield' && findCard(c.iid)) {
      UI.toast(`Your commander ${dname(d)} went to your ${ZL[zone]}.`, { ms: 9000, action: { label: 'Move to command zone', onClick: () => doMove(c.iid, 'command') } });
    }
    return;
  }
  if (req.k === 'take' && typeof req.iid === 'string') {
    if (!canEnterBattlefield()) return;
    // only the card's owner may do this; I hand it straight back to them
    const f = findCard(req.iid);
    if (!f || f.zone !== 'battlefield' || f.card.own !== from || from === S.pid) return;
    const d = defOf(f.card);
    act(() => {
      S.me.zones.battlefield.splice(f.idx, 1);
      const orphans = detachFrom(S.pid, req.iid);
      if (orphans.length) setTimeout(() => orphanToast(orphans), 0);
      const card = Object.assign({}, f.card); delete card.x; delete card.y; card.att = null;
      sendReq(from, { k: 'return', card, def: Deck.slimDef(d), zone: 'battlefield' });
      return [`had {0} taken back by its owner, ${pname(from)}`, [d]];
    }, { noUndo: true });
    return;
  }
  if (req.k === 'life') {
    const d = clamp(num(req.d), -100, 100);
    if (d) changeLife(d, pname(from));
    return;
  }
  if (req.k === 'life-set') {
    if (!Number.isInteger(req.life)) return;
    const target = clamp(req.life, -9999, 9999);
    if (target !== S.me.life) changeLife(target - S.me.life, pname(from));
    return;
  }
  if (req.k === 'cmddmg' && typeof req.key === 'string' && req.key.startsWith(from + ':')) {
    // another player dealt me damage with their own commander
    const d = clamp(num(req.d), -21, 21);
    if (d) changeCmdDmg(req.key.slice(0, 90), d);
  }
}

// Transient shared turn cue: seed snapshots/resumes so rejoining never replays the current turn.
let turnNoticeInitialized = false, lastTurnNoticeKey = null, activeTurnNotice = null;
let turnNoticeTimer = null, turnNoticeToken = 0;
let responseTimer = null, responseSerial = 0;
const seenResponses = new Set();
function clearResponseNotice() {
  clearTimeout(responseTimer); responseTimer = null;
  const slot = $('#responseNotice');
  if (slot) slot.replaceChildren();
  seenResponses.clear();
}
function sendResponse() {
  const T = S.table;
  if (boardTransferLock || !S.me || !T || !T.started || !T.seats.includes(S.pid) || T.out[S.pid]) return;
  if (S.role !== 'solo' && S.net.state !== 'online') {
    UI.toast('Reconnect before calling a response.', { kind: 'warn' }); return;
  }
  toHost({ t: 'response', deal: T.openingDeal });
}
function showResponseNotice(msg) {
  const T = S.table, slot = $('#responseNotice');
  if (!slot || !S.me || !T || !T.started || !T.seats.includes(msg.pid) || T.out[msg.pid]
    || msg.deal !== T.openingDeal || typeof msg.id !== 'string' || msg.id.length > 60 || seenResponses.has(msg.id)) return;
  seenResponses.add(msg.id);
  if (seenResponses.size > 64) seenResponses.delete(seenResponses.values().next().value);
  const cue = document.createElement('div');
  cue.className = 'ct-turn-notice ct-response-notice';
  cue.dataset.responseId = msg.id;
  const title = document.createElement('strong'); title.textContent = 'IN RESPONSE!';
  const name = document.createElement('span'); name.className = 'ct-response-name';
  name.textContent = String(msg.name || pname(msg.pid)).slice(0, 40);
  cue.append(title, name);
  // Replace the transient cue so every distinct press restarts its animation,
  // even while the previous response is still visible.
  clearTimeout(responseTimer);
  slot.replaceChildren(cue);
  responseTimer = setTimeout(() => {
    if (slot.firstElementChild !== cue) return;
    slot.replaceChildren(); responseTimer = null;
  }, 1800);
}
function turnKey(t) {
  return t && t.started && t.active ? String(t.room || '') + '|' + Math.max(1, num(t.turnSeq, num(t.turn))) + '|' + String(t.active) : null;
}
function cancelTurnNotice() {
  turnNoticeToken++;
  if (turnNoticeTimer) clearTimeout(turnNoticeTimer);
  turnNoticeTimer = null;
  activeTurnNotice = null;
}
function seedTurnNotice(t) {
  clearResponseNotice();
  cancelTurnNotice();
  turnNoticeInitialized = true;
  lastTurnNoticeKey = turnKey(t);
}
function scheduleTurnNotice(pid, key) {
  cancelTurnNotice();
  const token = turnNoticeToken, waitStarted = Date.now();
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const showWhenReady = () => {
    if (token !== turnNoticeToken) return;
    if (document.querySelector('.first-roll-overlay') && Date.now() - waitStarted < 9000) {
      turnNoticeTimer = setTimeout(showWhenReady, 100);
      return;
    }
    activeTurnNotice = { pid, key };
    render();
    turnNoticeTimer = setTimeout(() => {
      if (token !== turnNoticeToken) return;
      activeTurnNotice = null;
      turnNoticeTimer = null;
      render();
    }, reducedMotion ? 1250 : 1800);
  };
  showWhenReady();
}
function handleTurnNoticeUpdate(t) {
  const nextKey = turnKey(t);
  if (!turnNoticeInitialized) { seedTurnNotice(t); return; }
  if (nextKey === lastTurnNoticeKey) return;
  lastTurnNoticeKey = nextKey;
  if (!nextKey) { cancelTurnNotice(); render(); return; }
  scheduleTurnNotice(t.active, nextKey);
}
function turnNoticeHTML(pid) {
  if (!activeTurnNotice || activeTurnNotice.pid !== pid) return '';
  const label = pid === S.pid ? 'YOUR TURN' : pname(pid).toUpperCase() + "'S TURN";
  return '<div class="ct-turn-notice" data-turn-key="' + esc(activeTurnNotice.key) + '" aria-hidden="true">' + esc(label) + '</div>';
}

// After the shared table changes: run my turn-start automation once per turn.
function afterTable() {
  const T = S.table, m = S.me;
  if (!T || !m) return;
  preparePersonalHistory();
  if (!T.started) return;
  if (T.openingDeal && undoClearedOpeningDeal !== T.openingDeal) {
    S.undo = [];
    undoClearedOpeningDeal = T.openingDeal;
  }
  const turnSeq = Math.max(1, num(T.turnSeq, num(T.turn)));
  const lastTurnSeq = num(m.lastTurnSeq, num(m.lastTurn));
  if (T.active === S.pid && turnSeq > lastTurnSeq) {
    m.lastTurnSeq = turnSeq; m.lastTurn = turnSeq;
    const skipDraw = turnSeq === 1 && T.order.length === 2; // 2-player: first player skips first draw
    const bits = [];
    let drew = 0;
    act(() => {
      if (m.autoUntap && m.zones.battlefield.some(c => c.t)) { m.zones.battlefield.forEach(c => { c.t = false; }); bits.push('untapped'); }
      if (m.autoDraw && !skipDraw && m.zones.library.length) {
        const card = m.zones.library.shift();
        queuePendingDraw([card]);
        m.zones.hand.push(card);
        bits.push('drew a card'); drew = 1;
      }
      return bits.length ? [bits.join(' and ')] : null;
    }, { noUndo: true });
    if (drew) emitDrawAnimation(drew);
  }
  recordPhaseCheckpoint();
}
function resetForNewGame() {
  clearResponseNotice();
  S.targetArrows = []; S.arrowControlsDismissed = false; endTargeting();
  if (S.me && S.table && S.table.openingDeal && S.me.openingDeal === S.table.openingDeal) return;
  const deck = Deck.get(S.deckId);
  if (!deck) { UI.toast('Your deck is missing from this browser — cannot restart.', { kind: 'error' }); return; }
  S.me = newPlayer(deck, S.me.name, S.me, (S.table && S.table.openingMode) || 'london', (S.table && S.table.openingDeal) || uid());
  S.selected.clear();
  S.undo = [];
  publish(true);
}
function reconcileOpeningDeal(table) {
  if (!S.me || !table || !table.openingDeal || S.me.openingDeal === table.openingDeal) return;
  clearResponseNotice();
  const deck = Deck.get(S.deckId);
  if (!deck) return;
  S.me = newPlayer(deck, S.me.name, S.me, table.openingMode, table.openingDeal);
  S.undo = [];
  publish(true);
}

// =====================================================================
//  Card moves
// =====================================================================
function canEnterBattlefield() { return !!(S.table && S.table.started); }
function insertCard(card, to, opts = {}) {
  if (to === 'battlefield' && !canEnterBattlefield()) return false;
  const z = S.me.zones[to];
  if (to === 'library') { S.me.revealTopOnce = null; if (opts.pos === 'bottom') z.push(card); else z.unshift(card); } else z.push(card);
  if (to === 'battlefield') {
    if (opts.x != null) { card.x = clamp(Math.round(opts.x), 0, BW - CW); card.y = clamp(Math.round(opts.y), 0, myBH() - CH); }
    else if (card.x == null) autoPlace(card, to);
  }
  if (to === 'battlefield') {
    const d = defOf(card);
    if (d && d.loyalty && !card.c.Loyalty && /Planeswalker/.test(d.type || '')) card.c.Loyalty = parseInt(d.loyalty, 10) || 0;
  }
  return true;
}
// My cards attached to a host that is leaving: they fall off (equipment stays, auras usually die).
function detachFrom(hostPid, hostIid) {
  const out = [];
  S.me.zones.battlefield.forEach(o => {
    if (o.att && o.att.p === hostPid && o.att.i === hostIid) { o.att = null; if (o.x == null) autoPlace(o, 'battlefield'); out.push(o); }
  });
  return out;
}
function orphanToast(cards) {
  cards.forEach(o => {
    const d = defOf(o);
    if (d && /Aura/.test(d.type || '')) {
      UI.toast(`${dname(d)} is no longer attached to anything.`, { ms: 8000, action: { label: 'Put into graveyard', onClick: () => doMove(o.iid, 'graveyard') } });
    }
  });
}
// An opponent's creature that my aura/equipment was on is gone -> unattach it.
function checkOrphans() {
  if (!S.me) return;
  const lost = S.me.zones.battlefield.filter(c => {
    if (!c.att || c.att.p === S.pid) return false;
    const p = S.players[c.att.p];
    return p && p.zones && !(p.zones.battlefield || []).some(x => x.iid === c.att.i);
  });
  if (!lost.length) return;
  clearUndo(); // an opponent's move detached one of our cards
  lost.forEach(c => { c.att = null; if (c.x == null) autoPlace(c, 'battlefield'); });
  orphanToast(lost);
  publish(); saveSoon();
}
// Low-level move; returns info for logging or null.
function moveCard(iid, to, opts = {}) {
  if (to === 'battlefield' && !canEnterBattlefield()) {
    UI.toast('The battlefield opens when the host starts the game.', { kind: 'warn' });
    return null;
  }
  const f = findCard(iid); if (!f) return null;
  const { zone: from, card } = f;
  const def = defOf(card);
  if (from === to && to !== 'library') {
    if (to === 'battlefield' && opts.x != null) {
      const wasAtt = !!card.att;
      card.att = null;
      card.x = clamp(Math.round(opts.x), 0, BW - CW); card.y = clamp(Math.round(opts.y), 0, myBH() - CH);
      S.me.zones[to].splice(f.idx, 1); S.me.zones[to].push(card); // bring to front
      return { def, from, card, repos: true, wasAtt };
    }
    return null;
  }
  S.me.zones[from].splice(f.idx, 1);
  if (from === 'hand' && to !== 'hand') delete card.rvh;
  let orphans = [];
  if (from === 'battlefield' && to !== 'battlefield') {
    card.t = false; card.c = {}; card.fl = false; card.pb = undefined; card.dp = 0; card.dt = 0; // a card that leaves forgets everything
    orphans = detachFrom(S.pid, iid);
  }
  if (from === 'battlefield' || from === 'command') { delete card.x; delete card.y; card.att = null; }
  if (to !== 'battlefield' && to !== 'exile') card.fd = false;
  if (to === 'battlefield' && from !== 'battlefield' && opts.faceDown == null) card.fd = false;
  if (opts.faceDown != null) card.fd = !!opts.faceDown;
  if (opts.tapped) card.t = true;
  if (card.tok && to !== 'battlefield') return { def, from, gone: 'token', card, orphans };
  if (card.own !== S.pid && to !== 'battlefield') {
    sendReq(card.own, { k: 'return', card: Object.assign({}, card), def: def && Deck.slimDef(def), zone: to, pos: opts.pos });
    return { def, from, gone: 'owner', card, orphans };
  }
  insertCard(card, to, opts);
  return { def, from, card, orphans };
}
function moveText(r, to, opts) {
  const { from, card, gone } = r;
  if (gone === 'token') return card.cp ? 'removed their copy of {0} (copies vanish off the battlefield)' : 'removed their {0} token';
  if (gone === 'owner') return `returned {0} to ${pname(card.own)}'s ${ZL[to]}`;
  const hiddenFrom = from === 'library' || from === 'hand';
  const hiddenTo = to === 'library' || to === 'hand';
  if ((hiddenFrom && hiddenTo) || card.fd) {
    if (from === to) return `moved a card to the ${opts.pos === 'bottom' ? 'bottom' : 'top'} of their library`;
    if (card.fd && to === 'battlefield') return 'put a card onto the battlefield face down';
    if (card.fd && to === 'exile') return 'exiled a card face down';
    return `moved a card from ${ZL[from]} to ${ZL[to]}`;
  }
  if (card.cmd && from === 'command' && to === 'battlefield') {
    const n = S.me.casts[card.iid] || 0;
    return `cast {0} from the command zone${n ? ` (commander tax +${2 * n})` : ''}`;
  }
  if (to === 'battlefield') return from === 'hand' ? `played {0}${opts.tapped ? ' tapped' : ''}` : `put {0} onto the battlefield from ${ZL[from]}`;
  if (to === 'graveyard') return from === 'hand' ? 'discarded {0}' : from === 'library' ? 'milled {0}' : 'put {0} into the graveyard';
  if (to === 'exile') return `exiled {0}${from !== 'battlefield' ? ` from ${ZL[from]}` : ''}`;
  if (to === 'hand') return `returned {0} to hand from ${ZL[from]}`;
  if (to === 'library') return `put {0} on the ${opts.pos === 'bottom' ? 'bottom' : 'top'} of their library`;
  if (to === 'command') return 'moved {0} to the command zone';
  return `moved {0} to ${ZL[to]}`;
}
function doMove(iid, to, opts = {}) {
  let res = null;
  act(() => {
    res = moveCard(iid, to, opts);
    if (!res) return null;
    if (res.repos) return res.wasAtt ? ['unattached {0}', [res.def]] : null;
    return [moveText(res, to, opts), [res.def]];
  });
  if (!res) return;
  if (res.repos) {
    emitCardPlaceSound(res.card.iid);
    return;
  }
  const { card, def } = res;
  if (res.from === 'command' && to === 'battlefield' && !card.fd && !res.gone && def) {
    emitCommanderSlam(card.iid, def.ci);
  } else if (to === 'battlefield' && !res.gone) {
    emitCardPlaceSound(card.iid);
  }
  if (res.orphans && res.orphans.length) orphanToast(res.orphans);
  if (card.cmd && !res.gone && to !== 'command' && to !== 'battlefield' && card.own === S.pid) {
    UI.toast(`${dname(def)} went to your ${ZL[to]}.`, { ms: 8000, action: { label: 'Move to command zone', onClick: () => doMove(iid, 'command') } });
  }
  if (to === 'battlefield' && res.from !== 'battlefield' && def && def.tokens && def.tokens.length && !card.fd) suggestTokens(def);
}
function suggestTokens(def) {
  const toks = def.tokens.map(id => S.me.defs[id]).filter(Boolean);
  if (!toks.length) return;
  const owner = S.me;
  const choose = { label: 'Choose tokens…', onClick: () => { if (S.me === owner) tokenGallery(toks, `Tokens for ${dname(def)}`); } };
  if (toks.length === 1) {
    UI.toast(`${dname(def)} makes tokens`, { ms: 7000,
      action: { label: `+ ${dname(toks[0])}`, onClick: () => { if (S.me === owner) createToken(toks[0]); } },
      actions: [choose]
    });
  } else UI.toast(`${dname(def)} makes tokens`, { ms: 7000, action: choose });
}
async function createTokenQuantity(def) {
  if (!canEnterBattlefield()) { UI.toast('The battlefield opens when the host starts the game.', { kind: 'warn' }); return false; }
  const owner = S.me;
  const n = await UI.prompt({ title: `Create ${dname(def)} tokens`, label: 'Quantity (1–60)', type: 'number', value: 1, min: 1, max: 60, integer: true, strictBounds: true, okLabel: 'Create X Tokens' });
  if (!Number.isInteger(n) || n < 1 || n > 60 || !owner || S.me !== owner) return false;
  if (!canEnterBattlefield() || !createToken(def, n)) return false;
  UI.toast(`Created ${n} ${dname(def)} token${n === 1 ? '' : 's'}.`);
  return true;
}
const tokenGalleries = new Set();
function tokenGallery(defs, title, searchAll = false) {
  const owner = S.me;
  if (!owner) return;
  const unique = [...new Map(defs.filter(Boolean).map(d => [d.id, d])).values()];
  const grouped = values => {
    const groups = new Map();
    values.forEach(d => { const key = Deck.tokenKey(d) || 'id:' + d.id; if (!groups.has(key)) groups.set(key, d); });
    return [...groups.values()].map(d => ({ iid: 'tk_' + d.id, def: d }));
  };
  const cards = grouped(unique);
  let closed = false, entry, artworkChosen = false;
  const gallery = UI.viewer({
    title, cards,
    searchPlaceholder: 'Filter tokens by name, type or rules text…',
    onCardClick: async d => {
      if (closed || S.me !== owner) return;
      if (await createTokenQuantity(d)) {
        // Search results can sit above the deck gallery: return all the way to the table.
        for (const view of [...tokenGalleries]) if (view.owner === owner) view.close();
      }
    },
    actions: [{ key: 'printing', label: 'Choose artwork…' }],
    onAction: async (key, iid) => {
      const card = cards.find(c => c.iid === iid);
      if (!card || closed || S.me !== owner) return;
      const wait = UI.toast(`Finding artwork for ${dname(card.def)}…`, { ms: 4000 });
      try {
        const prints = await Deck.fetchTokenPrints(card.def);
        if (closed || S.me !== owner) return;
        if (!prints.length) { UI.toast('No matching token artwork found.'); return; }
        UI.printPicker({ title: `Artwork for ${dname(card.def)}`, prints, currentId: card.def.id,
          onPick: nd => {
            if (closed || S.me !== owner) return;
            artworkChosen = true;
            card.def = nd;
            gallery.update(cards);
          }
        });
      } catch (e) { if (!closed && S.me === owner) UI.toast(e.message || 'Could not load token artwork', { kind: 'error' }); }
      finally { wait.close(); }
    },
    footer: searchAll ? [{ key: 'search', label: 'Search all tokens…' }] : [],
    onFooter: () => { if (!closed && S.me === owner) searchTokens(); },
    onHover: d => preview(d), onClose: () => { closed = true; tokenGalleries.delete(entry); hidePreview(); }
  });
  entry = { owner, close: gallery.close };
  tokenGalleries.add(entry);
  // Older saved decks predate token identity metadata. Enrich them in the background;
  // keep the original pictures usable if Scryfall is unavailable.
  if (unique.some(d => Deck.tokenKey(d).startsWith('unknown:'))) {
    Promise.all(unique.map(d => Deck.tokenKey(d).startsWith('unknown:')
      ? Deck.fetchById(d.id).catch(() => d) : d)).then(values => {
      if (closed || artworkChosen || S.me !== owner) return;
      cards.splice(0, cards.length, ...grouped(values));
      gallery.update(cards);
    });
  }
}
async function relatedTokenGallery(ids, title) {
  const owner = S.me;
  if (!owner) return;
  const results = await Promise.allSettled(ids.map(id => owner.defs[id] || Deck.fetchById(id)));
  if (S.me !== owner) return;
  const defs = results.filter(r => r.status === 'fulfilled').map(r => r.value).filter(Boolean);
  if (defs.length !== results.length) UI.toast('Some related tokens could not be loaded. Try again to load the missing tokens.', { kind: 'warn' });
  if (defs.length) tokenGallery(defs, title);
}

// --- attaching auras / equipment
function hostInfo(pid, iid) {
  if (pid === S.pid) {
    const f = findCard(iid);
    return f && f.zone === 'battlefield' ? { card: f.card, def: defOf(f.card) } : null;
  }
  const p = S.players[pid];
  const c = p && (p.zones.battlefield || []).find(x => x.iid === iid);
  return c ? { card: c, def: c.id ? p.defs[c.id] : { id: '', name: 'a face-down card' } } : null;
}
function attachTo(iid, hostPid, hostIid) {
  if (hostPid === S.pid && hostIid === iid) return;
  const f = findCard(iid); if (!f) return;
  const host = hostInfo(hostPid, hostIid);
  if (!host) { UI.toast('You can only attach to a card on the battlefield.', { kind: 'warn' }); return; }
  if (host.card.att) { UI.toast('That card is itself attached to something — attach to the creature instead.', { kind: 'warn' }); return; }
  const def = defOf(f.card);
  let res = null;
  act(() => {
    if (f.zone !== 'battlefield') {
      res = moveCard(iid, 'battlefield');
      if (!res || res.gone) return null;
    }
    const card = findCard(iid).card;
    card.att = { p: hostPid, i: hostIid };
    if (hostPid === S.pid) { card.x = clamp(host.card.x + 20, 0, BW - CW); card.y = host.card.y; }
    // anything attached to the card we just attached falls off
    detachFrom(S.pid, iid);
    const whose = hostPid === S.pid ? '' : `${pname(hostPid)}'s `;
    return [`${f.zone === 'hand' ? 'cast {0} and attached it' : 'attached {0}'} to ${whose}{1}`, [def, host.def]];
  });
}
function unattach(iid) {
  const f = findCard(iid); if (!f || !f.card.att) return;
  act(() => { f.card.att = null; delete f.card.x; autoPlace(f.card, 'battlefield'); return ['unattached {0}', [defOf(f.card)]]; });
}
function startAttach(iid) {
  const f = findCard(iid); if (!f) return;
  endAttach();
  S.attachFrom = iid;
  document.body.classList.add('attaching');
  S.attachToast = UI.toast(`Click the card to attach ${dname(defOf(f.card))} to (yours or an opponent's). Esc to cancel.`, { ms: 20000 });
}
function endAttach() {
  S.attachFrom = null;
  document.body.classList.remove('attaching');
  if (S.attachToast && S.attachToast.close) S.attachToast.close();
  S.attachToast = null;
}

// Ephemeral draw cue. The drawn card is hidden in its real hand slot until its animation lands.
const drawPendingIids = new Set();
const pendingDrawQueue = [];
function queuePendingDraw(cards) {
  for (const card of cards || []) {
    if (!card || typeof card.iid !== 'string') continue;
    drawPendingIids.add(card.iid);
    pendingDrawQueue.push(card.iid);
  }
}
function takePendingDraw(count) {
  const ids = [];
  while (ids.length < count && pendingDrawQueue.length) ids.push(pendingDrawQueue.shift());
  return ids;
}
function finishPendingDraw(ids) {
  let changed = false;
  for (const id of ids || []) changed = drawPendingIids.delete(id) || changed;
  if (changed) render();
}

// Draw cards into the hand before committing the state. Only the first five are animated;
// any additional cards from a Draw X action remain visible and are not left pending.
function draw(n = 1) {
  if (!S.me) return;
  const z = S.me.zones;
  const requested = clamp(Math.floor(num(n, 1)), 1, 30);
  const drawn = [];
  act(() => {
    while (drawn.length < requested && z.library.length) {
      const card = z.library.shift();
      z.hand.push(card);
      drawn.push(card);
    }
    if (drawn.length) {
      S.me.revealTopOnce = null;
      queuePendingDraw(drawn.slice(0, 5));
    }
    return drawn.length ? [`drew ${plural(drawn.length, 'card')}`] : null;
  });
  if (drawn.length) emitDrawAnimation(Math.min(drawn.length, 5));
  if (drawn.length < requested) {
    UI.toast('Your library is empty!', { kind: 'warn' });
    askConcede('You attempted to draw from an empty library. Would you like to concede?', 'Your library is empty');
  }
}
// Event contains no card ID/name. The host validates the sender and relays only player ID + count.
function emitDrawAnimation(count) {
  const n = clamp(Math.floor(num(count, 1)), 1, 5);
  if (S.role === 'solo') {
    onBroadcast({ t: 'drawfx', pid: S.pid, count: n });
    return;
  }
  toHost({ t: 'drawfx', count: n });
}
function drawAnimationVisible(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
}
function drawAnimationPile(pid) {
  const candidates = [...document.querySelectorAll('[data-pile="library"][data-pid], [data-fx="library"][data-pid]')]
    .filter(el => el.dataset.pid === pid && drawAnimationVisible(el))
    .map(el => {
      const visual = el.querySelector('.zcard, .tpcard, .pcard') || el;
      const rect = visual.getBoundingClientRect();
      return { el: visual, rect, area: rect.width * rect.height };
    })
    .filter(x => x.rect.width >= 8 && x.rect.height >= 12)
    .sort((a, b) => b.area - a.area);
  return candidates[0] || null;
}
// A hand's own box can be zero-width (its cards overflow it), so count it as present when it or any card in it has a size.
function drawAnimationSized(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width >= 1 && r.height >= 1;
}
function drawAnimationHandUsable(hand) {
  if (!hand || !hand.isConnected) return false;
  const cs = getComputedStyle(hand);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  return drawAnimationSized(hand) || [...hand.querySelectorAll('.card')].some(drawAnimationSized);
}
function drawAnimationHand(pid) {
  const bigHand = $('#myHand');
  if (pid === S.pid) {
    if (!viewedOpp() && drawAnimationHandUsable(bigHand)) return bigHand;
    const miniHands = [...document.querySelectorAll('.thand.mine')]
      .filter(drawAnimationVisible)
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    return miniHands[0] || null;
  }
  // someone else: their hand in the big strip while I'm viewing them, else their miniature's hand fan
  if (viewedOpp() === pid && drawAnimationHandUsable(bigHand)) return bigHand;
  const tile = document.querySelector(`#opps .opp.tile[data-opp="${CSS.escape(pid)}"] .thand`);
  if (tile && (drawAnimationVisible(tile) || drawAnimationHandUsable(tile))) return tile;
  const heads = [...document.querySelectorAll('.ohead')];
  const head = heads.find(el => [...el.querySelectorAll('[data-phead]')].some(p => p.dataset.phead === pid));
  const hand = head && head.querySelector('.ohhand');
  return drawAnimationVisible(hand) ? hand : null;
}
function drawAnimationCardFaces(pid, drawnCard) {
  const back = UI.cardBackHTML('', appearanceBackFor(pid));
  if (pid !== S.pid || !drawnCard) {
    // Opponents see a face-down card only; both sides use the player's chosen card back.
    return '<div class="ct-draw-face ct-draw-back">' + back + '</div><div class="ct-draw-face ct-draw-back-reverse">' + back + '</div>';
  }
  const def = defOf(drawnCard);
  const front = def && IMG_OK(def.img)
    ? '<img src="' + esc(def.img) + '" alt="" draggable="false">'
    : '<div class="ct-draw-placeholder">' + esc(def ? dname(def) : 'Card') + '</div>';
  return '<div class="ct-draw-face ct-draw-back">' + back + '</div><div class="ct-draw-face ct-draw-front">' + front + '</div>';
}
function animateDrawCard(pid, count) {
  const requested = clamp(Math.floor(num(count, 1)), 1, 5);
  // Only the drawing player owns local pending IDs; no hidden identities are sent over the network.
  const pendingIds = pid === S.pid ? takePendingDraw(requested) : [];
  const release = () => finishPendingDraw(pendingIds);
  if (!pid || $('#game').classList.contains('hidden') || !document.body) { release(); return; }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { release(); return; }

  let started = false;
  const startAnimation = () => {
    if (started) return;
    started = true;
    const source = drawAnimationPile(pid);
    const target = drawAnimationHand(pid);
    if (!source || !target) { release(); return; }
    if (typeof document.body.animate !== 'function') { release(); return; }

    const src = source.rect;
    // Include hidden local cards so their real hand slots can be measured without revealing them.
    const targetCards = [...target.querySelectorAll('.card')].filter(el =>
      drawAnimationVisible(el) || el.classList.contains('ct-draw-pending'));
    const localCards = pid === S.pid ? pendingIds.map(id => S.me.zones.hand.find(c => c.iid === id)).filter(Boolean) : [];
    const n = pid === S.pid ? localCards.length : requested;
    if (!n) { release(); return; }
    // If a queued card no longer exists in hand, don't leave its real card hidden.
    const animatedIds = new Set(localCards.map(card => card.iid));
    const unusedIds = pendingIds.filter(id => !animatedIds.has(id));
    if (unusedIds.length) finishPendingDraw(unusedIds);

    const FLIGHT_MS = 460;
    const HANDOFF_MS = 65;
    const FLIP_MS = 310;
    const STEP_COUNT = 24;

    for (let i = 0; i < n; i++) {
      const card = pid === S.pid ? localCards[i] : null;
      const cardEl = card && targetCards.find(el => el.dataset.iid === card.iid);
      const fallbackEl = targetCards[targetCards.length - 1];
      const dstEl = cardEl || fallbackEl;
      const dst = (dstEl || target).getBoundingClientRect();
      // Start at the Library's actual card size, then scale down/up to the hand slot.
      const width = Math.max(1, src.width);
      const height = Math.max(1, src.height);
      const targetWidth = dstEl
        ? Math.max(1, dst.width)
        : (pid === S.pid ? Math.max(24, Math.min(src.width, 63)) : 24);
      const sx = src.left;
      const sy = src.top;
      const startCx = sx + width / 2;
      const startCy = sy + height / 2;
      const endCx = dst.left + dst.width / 2;
      const endCy = dst.top + dst.height / 2;
      const dx = endCx - startCx;
      const dy = endCy - startCy;
      const endScale = targetWidth / width;
      // A shallow, rounded arc gives the card a little lift without making the flight feel floaty.
      const lift = clamp(Math.hypot(dx, dy) * 0.12, 34, 88);
      const fadeStart = 1 - HANDOFF_MS / FLIGHT_MS;
      const flyer = document.createElement('div');
      flyer.className = 'ct-draw-flight';
      flyer.setAttribute('aria-hidden', 'true');
      flyer.style.left = sx + 'px';
      flyer.style.top = sy + 'px';
      flyer.style.width = width + 'px';
      flyer.style.height = height + 'px';
      const flip = document.createElement('div');
      flip.className = 'ct-draw-flip';
      flip.innerHTML = drawAnimationCardFaces(pid, card);
      flyer.appendChild(flip);
      document.body.appendChild(flyer);

      // Sample a smooth ease-in/ease-out curve along a quadratic arc. Linear interpolation between
      // closely-spaced samples avoids a visible pause at intermediate points or at the endpoint.
      const flightFrames = [];
      for (let step = 0; step <= STEP_COUNT; step++) {
        const time = step / STEP_COUNT;
        const progress = time < 0.5 ? 4 * time * time * time : 1 - Math.pow(-2 * time + 2, 3) / 2;
        const x = dx * progress;
        const y = dy * progress - 4 * lift * progress * (1 - progress);
        const scale = 1 + (endScale - 1) * progress;
        const rotation = -3 * (1 - progress);
        const opacity = time < fadeStart ? 1 : Math.max(0, 1 - (time - fadeStart) / (1 - fadeStart));
        flightFrames.push({
          offset: time,
          transform: 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ') rotate(' + rotation + 'deg)',
          opacity,
          easing: 'linear'
        });
      }

      const delay = i * 48;
      let handedOff = false;
      let handoffTimer = null;
      const handoff = () => {
        if (handedOff) return;
        handedOff = true;
        if (handoffTimer) clearTimeout(handoffTimer);
        // Reveal this real card as its flyer begins fading, not after every card has landed.
        if (card) finishPendingDraw([card.iid]);
      };
      const motion = flyer.animate(flightFrames, {
        duration: FLIGHT_MS,
        delay,
        easing: 'linear',
        fill: 'forwards'
      });
      flip.animate([
        { transform: 'rotateY(0deg)' },
        { transform: 'rotateY(180deg)' }
      ], {
        duration: FLIP_MS,
        delay: delay + 45,
        easing: 'cubic-bezier(.45,0,.55,1)',
        fill: 'forwards'
      });
      handoffTimer = setTimeout(handoff, delay + FLIGHT_MS - HANDOFF_MS);
      const cleanup = () => {
        if (handoffTimer) clearTimeout(handoffTimer);
        handoff();
        flyer.remove();
      };
      motion.finished.then(cleanup, cleanup);
    }
  };
  // Start promptly after the scheduled hand render; timeout fallback avoids leaving a card hidden
  // in a throttled/background tab where requestAnimationFrame may be paused.
  requestAnimationFrame(() => requestAnimationFrame(startAnimation));
  setTimeout(startAnimation, 175);
}

// Send only a public card instance ID and color identity; no hidden card information is included.
// The card's new position is published first (messages reach the host in order), so the host can find it.
function emitCommanderSlam(iid, ci) {
  const colors = Array.isArray(ci) ? [...new Set(ci.filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c)))] : [];
  // Play during the initiating click/drag gesture so browser autoplay rules don't swallow it.
  playCommanderSlamSound();
  if (S.role === 'solo') {
    // Run locally instead of routing through the multiplayer broadcast handler.
    animateCommanderSlam(S.pid, iid, colors);
    return;
  }
  clearTimeout(pubTimer); doPublish();
  toHost({ t: 'slamfx', iid, ci: colors });
}

function animateCommanderSlam(pid, iid, ci) {
  if (!pid || !iid) return;
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // The player who cast it already heard the gesture-triggered sound in emitCommanderSlam.
  if (pid !== S.pid) playCommanderSlamSound();
  const palette = { W: '#f2e4b5', U: '#62c5f2', B: '#a38bd2', R: '#ff705f', G: '#76cf91' };
  const colors = [...new Set((ci || []).filter(c => palette[c]).map(c => palette[c]))];
  if (!colors.length) colors.push('#e6d8a5'); // a neutral glow for colorless commanders
  const glow = colors.map(c => '0 0 24px 6px ' + c + 'bb').join(', ');
  const border = colors.length === 1 ? colors[0] : 'transparent';
  const identityGradient = colors.length === 1
    ? 'linear-gradient(180deg, ' + colors[0] + ' 0 100%)'
    : colors.length === 2
      ? 'linear-gradient(180deg, ' + colors[0] + ' 0 50%, ' + colors[1] + ' 50% 100%)'
      : (() => {
          const step = 360 / colors.length;
          const stops = colors.map((color, i) => color + ' ' + (i * step) + 'deg ' + ((i + 1) * step) + 'deg');
          return 'conic-gradient(from -90deg, ' + stops.join(', ') + ')';
        })();
  let attempts = 0;

  const start = () => {
    if (!reduceMotion && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const candidates = [...document.querySelectorAll('.card[data-iid][data-zone="battlefield"]')]
      .filter(el => el.dataset.iid === iid && (!el.dataset.pid || el.dataset.pid === pid) && drawAnimationVisible(el))
      .map(el => ({ el, rect: el.getBoundingClientRect() }))
      .filter(x => x.rect.width > 4 && x.rect.height > 8)
      .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);
    const found = candidates[0];
    if (!found && attempts++ < 8) { requestAnimationFrame(start); return; }
    if (!found || typeof found.el.animate !== 'function') return;

    const card = found.el, rect = found.rect;
    const ring = document.createElement('div');
    ring.className = 'ct-slam-ring';
    ring.setAttribute('aria-hidden', 'true');
    Object.assign(ring.style, {
      left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px',
      borderRadius: getComputedStyle(card).borderRadius || '5px',
      border: '4px solid transparent',
      borderColor: border,
      background: 'linear-gradient(rgba(255,255,255,.06), rgba(255,255,255,.06)) padding-box, ' + identityGradient + ' border-box',
      boxShadow: glow + ', 0 0 0 3px rgba(255,255,255,.5)',
      zIndex: '2147483647',
      mixBlendMode: 'screen'
    });
    document.body.appendChild(ring);

    if (reduceMotion) {
      // Respect reduced-motion preferences with a static color flash instead of movement.
      ring.style.opacity = '1';
      setTimeout(() => ring.remove(), 760);
      return;
    }

    card.animate([
      { transform: 'translateY(-18px) scale(1.055) rotate(-1.4deg)', filter: 'brightness(1.28)', boxShadow: glow, offset: 0 },
      { transform: 'translateY(2px) scale(.985) rotate(.25deg)', filter: 'brightness(1.15)', boxShadow: glow, offset: .58 },
      { transform: 'translateY(0) scale(1) rotate(0)', filter: 'brightness(1)', boxShadow: 'none', offset: 1 }
    ], { duration: 680, easing: 'cubic-bezier(.2,.75,.25,1)' });
    const motion = ring.animate([
      { opacity: 0, transform: 'translateY(-10px) scale(.9)' },
      { opacity: .95, transform: 'translateY(0) scale(1.02)', offset: .36 },
      { opacity: .65, transform: 'translateY(0) scale(1.09)', offset: .65 },
      { opacity: 0, transform: 'translateY(0) scale(1.16)' }
    ], { duration: 900, easing: 'cubic-bezier(.2,.75,.25,1)' });
    motion.finished.then(() => ring.remove(), () => ring.remove());
  };
  requestAnimationFrame(() => requestAnimationFrame(start));
}
function emitCardPlaceSound(iid) {
  playCardPlaceSound();
  if (S.role === 'solo') return;
  clearTimeout(pubTimer); doPublish();
  toHost({ t: 'placefx', iid });
}

function playCardPlaceSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  let ctx;
  try {
    ctx = new AudioContextClass();
    const play = () => {
      const now = ctx.currentTime;
      const thud = ctx.createOscillator(), gain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(190, now);
      thud.frequency.exponentialRampToValueAtTime(95, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      thud.connect(gain); gain.connect(ctx.destination);
      thud.start(now); thud.stop(now + 0.13);
      const frames = Math.floor(ctx.sampleRate * 0.055);
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      const noise = ctx.createBufferSource(), noiseGain = ctx.createGain();
      noise.buffer = buffer;
      noiseGain.gain.setValueAtTime(0.09, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      noise.connect(noiseGain); noiseGain.connect(ctx.destination);
      noise.start(now);
      setTimeout(() => { if (ctx.state !== 'closed') ctx.close().catch(() => {}); }, 220);
    };
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {});
    else play();
  } catch (_) {
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }
}

function playCommanderSlamSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  let ctx;
  try {
    ctx = new AudioContextClass();
    const play = () => {
      const now = ctx.currentTime;

      // The impact starts with a hard, broadband crack — not a soft musical note.
      const crackFrames = Math.floor(ctx.sampleRate * 0.085);
      const crackBuffer = ctx.createBuffer(1, crackFrames, ctx.sampleRate);
      const crackSamples = crackBuffer.getChannelData(0);
      for (let i = 0; i < crackFrames; i++) {
        const t = i / crackFrames;
        crackSamples[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
      }
      const crack = ctx.createBufferSource(), crackFilter = ctx.createBiquadFilter(), crackGain = ctx.createGain();
      crack.buffer = crackBuffer;
      crackFilter.type = 'highpass';
      crackFilter.frequency.setValueAtTime(850, now);
      crackFilter.Q.value = 0.7;
      crackGain.gain.setValueAtTime(0.0001, now);
      crackGain.gain.exponentialRampToValueAtTime(1.0, now + 0.0015);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      crack.connect(crackFilter); crackFilter.connect(crackGain); crackGain.connect(ctx.destination);
      crack.start(now); crack.stop(now + 0.09);

      // A clipped, fast pitch-drop adds the sharp "KRAK" on top of the impact.
      const snap = ctx.createOscillator(), snapGain = ctx.createGain();
      snap.type = 'sawtooth';
      snap.frequency.setValueAtTime(780, now);
      snap.frequency.exponentialRampToValueAtTime(90, now + 0.075);
      snapGain.gain.setValueAtTime(0.0001, now);
      snapGain.gain.exponentialRampToValueAtTime(0.28, now + 0.001);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      snap.connect(snapGain); snapGain.connect(ctx.destination);
      snap.start(now); snap.stop(now + 0.085);

      // Main body: a much louder low thump that drops rapidly in pitch like a heavy landing.
      const body = ctx.createOscillator(), bodyGain = ctx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(105, now);
      body.frequency.exponentialRampToValueAtTime(27, now + 0.42);
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.exponentialRampToValueAtTime(1.0, now + 0.009);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      body.connect(bodyGain); bodyGain.connect(ctx.destination);
      body.start(now); body.stop(now + 0.49);

      // A delayed sub hit adds the chesty aftershock of a huge body hitting concrete.
      const sub = ctx.createOscillator(), subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(58, now + 0.028);
      sub.frequency.exponentialRampToValueAtTime(24, now + 0.48);
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.setValueAtTime(0.7, now + 0.028);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
      sub.connect(subGain); subGain.connect(ctx.destination);
      sub.start(now + 0.028); sub.stop(now + 0.53);

      // Short, gritty concrete-debris burst after the initial crack.
      const debrisFrames = Math.floor(ctx.sampleRate * 0.24);
      const debrisBuffer = ctx.createBuffer(1, debrisFrames, ctx.sampleRate);
      const debrisSamples = debrisBuffer.getChannelData(0);
      for (let i = 0; i < debrisFrames; i++) {
        const t = i / debrisFrames;
        debrisSamples[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.8);
      }
      const debris = ctx.createBufferSource(), debrisFilter = ctx.createBiquadFilter(), debrisGain = ctx.createGain();
      debris.buffer = debrisBuffer;
      debrisFilter.type = 'lowpass';
      debrisFilter.frequency.setValueAtTime(1800, now + 0.018);
      debrisFilter.frequency.exponentialRampToValueAtTime(280, now + 0.24);
      debrisGain.gain.setValueAtTime(0.0001, now);
      debrisGain.gain.setValueAtTime(0.42, now + 0.018);
      debrisGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      debris.connect(debrisFilter); debrisFilter.connect(debrisGain); debrisGain.connect(ctx.destination);
      debris.start(now + 0.018); debris.stop(now + 0.27);

      setTimeout(() => { if (ctx.state !== 'closed') ctx.close().catch(() => {}); }, 600);
    };
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {});
    else play();
  } catch (_) {
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }
}
function untapAll() { act(() => { S.me.zones.battlefield.forEach(c => { c.t = false; }); return ['untapped everything']; }); }
let shuffleAudioContext = null;
function playShuffleSound() {
  // Make a short, original card-riffle sound with Web Audio; no external file is needed.
  try {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) return;
    if (!shuffleAudioContext) shuffleAudioContext = new AudioContextType();
    const ctx = shuffleAudioContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const duration = 0.19;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const fade = Math.min(1, i / (ctx.sampleRate * 0.015), (samples.length - i) / (ctx.sampleRate * 0.02));
      samples[i] = (Math.random() * 2 - 1) * Math.max(0, fade);
    }
    [0, 0.13, 0.27, 0.42].forEach((offset, i) => {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const start = ctx.currentTime + offset;
      const burst = [0.13, 0.16, 0.12, 0.17][i];
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = [1450, 1850, 1250, 2150][i];
      filter.Q.value = 0.85;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + burst);
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      source.start(start); source.stop(start + burst);
    });
  } catch (e) { /* Optional audio can fail silently in restricted browsers. */ }
}
function animateOwnPile(zone, effect, duration = 820) {
  requestAnimationFrame(() => {
    const selector = '[data-pile="' + zone + '"][data-pid]';
    const piles = [...document.querySelectorAll(selector)].filter(el => el.dataset.pid === S.pid);
    piles.forEach(el => {
      el.classList.remove(effect);
      void el.offsetWidth;
      el.classList.add(effect);
    });
    setTimeout(() => piles.forEach(el => el.classList.remove(effect)), duration);
  });
}
function ownLibraryHovered() {
  return [...document.querySelectorAll('[data-pile="library"][data-pid]')]
    .some(el => el.dataset.pid === S.pid && el.matches(':hover'));
}
function shuffleLib() {
  if (!S.me.zones.library.length) { UI.toast('Your library is empty!', { kind: 'warn' }); return; }
  act(() => { S.me.revealTopOnce = null; shuffle(S.me.zones.library); return ['shuffled their library']; });
  animateOwnPile('library', 'shuffling');
  playShuffleSound();
}
function millTopCard() {
  const top = S.me.zones.library[0];
  if (!top) { UI.toast('Your library is empty!', { kind: 'warn' }); return; }
  const def = defOf(top);
  act(() => {
    const c = S.me.zones.library.shift();
    c.fd = false;
    S.me.zones.graveyard.push(c);
    S.me.revealTopOnce = null;
    return ['milled {0}', [def]];
  });
  animateOwnPile('library', 'milling', 620);
  animateOwnPile('graveyard', 'mill-receive', 620);
}
function toggleTap(iid) { const f = findCard(iid); if (f && f.zone === 'battlefield') act(() => { f.card.t = !f.card.t; }); }
function flip(iid) {
  const f = findCard(iid); const d = f && defOf(f.card);
  if (!f || !d || (!d.imgBack && !d.backName)) return;
  act(() => { f.card.fl = !f.card.fl; return ['transformed {0}', [d]]; });
}
function toggleFaceDown(iid) {
  const f = findCard(iid); if (!f) return;
  act(() => { f.card.fd = !f.card.fd; return f.card.fd ? ['turned a card face down'] : ['turned {0} face up', [defOf(f.card)]]; });
}
// +1/+1 and -1/-1 counters annihilate each other (as the rules say), the rest just add up.
function tidyCounters(c) {
  const a = c['+1/+1'] || 0, b = c['-1/-1'] || 0, m = Math.min(a, b);
  if (m > 0) { c['+1/+1'] = a - m; c['-1/-1'] = b - m; }
  for (const k of Object.keys(c)) if (c[k] <= 0 && k !== 'Loyalty') delete c[k];
}
function addCounter(iid, name, d) {
  const f = findCard(iid); if (!f) return;
  act(() => { const c = f.card.c; c[name] = (c[name] || 0) + d; tidyCounters(c); });
}
// mode: 'inc' | 'dec' | 'double' | 'reset' — applies to every counter on the card
function allCounters(iid, mode) {
  const f = findCard(iid); if (!f) return;
  const keys = Object.keys(f.card.c);
  if (!keys.length) { UI.toast('That card has no counters.'); return; }
  act(() => {
    const c = f.card.c;
    if (mode === 'reset') { f.card.c = {}; return ['removed all counters from {0}', [defOf(f.card)]]; }
    keys.forEach(k => { c[k] = mode === 'inc' ? c[k] + 1 : mode === 'dec' ? c[k] - 1 : c[k] * 2; });
    tidyCounters(c);
    return mode === 'double' ? ['doubled the counters on {0}', [defOf(f.card)]] : null;
  });
}
async function customCounter(iid) {
  const name = await UI.prompt({ title: 'Add a counter', label: `Counter name (e.g. ${CARD_COUNTERS.join(', ')})`, value: 'Charge' });
  if (!name) return;
  const n = await UI.prompt({ title: `How many ${name} counters?`, type: 'number', value: 1, min: -99, max: 99 });
  if (n) addCounter(iid, String(name).trim().slice(0, 20), n);
}

// --- power / toughness: optional base override (pb "3/3") + modifiers (dp, dt), plus +1/+1 / -1/-1 counters
function effPT(c, def) {
  if (c.fd) return { text: '2/2', modified: false };
  const base = c.pb || (def && def.pt) || '';
  const parts = String(base).split('/').map(v => v.trim());
  // Symbolic printed stats use a manual baseline of zero; numeric sides keep their value.
  const stats = parts.length === 2 && parts.every(Boolean)
    ? parts.map(v => /^-?\d+$/.test(v) ? +v : 0) : null;
  const cnt = ((c.c && c.c['+1/+1']) || 0) - ((c.c && c.c['-1/-1']) || 0);
  const dp = (c.dp || 0) + cnt, dt = (c.dt || 0) + cnt;
  const modified = !!(c.pb || dp || dt);
  if (stats) return { text: `${stats[0] + dp}/${stats[1] + dt}`, modified };
  if (!modified) return { text: base, modified };
  const sg = v => (v >= 0 ? '+' + v : String(v));
  return { text: base ? `${base} (${sg(dp)}/${sg(dt)})` : `${sg(dp)}/${sg(dt)}`, modified };
}
function changePT(iid, dp, dt) {
  const f = findCard(iid); if (!f || f.zone !== 'battlefield') return;
  act(() => { f.card.dp = (f.card.dp || 0) + dp; f.card.dt = (f.card.dt || 0) + dt; });
}
async function setPT(iid) {
  const f = findCard(iid); if (!f) return;
  const cur = effPT(f.card, defOf(f.card)).text;
  const v = await UI.prompt({ title: 'Set power / toughness', label: 'New base power/toughness, e.g. 4/4 (modifiers and counters still apply on top)', value: /^-?\d+\/-?\d+$/.test(cur) ? cur : '1/1' });
  if (v == null) return;
  const m = /^\s*(-?\d{1,3})\s*\/\s*(-?\d{1,3})\s*$/.exec(String(v));
  if (!m) { UI.toast('Use the form 3/3', { kind: 'warn' }); return; }
  act(() => { f.card.pb = `${+m[1]}/${+m[2]}`; f.card.dp = 0; f.card.dt = 0; return [`set {0} to base ${+m[1]}/${+m[2]}`, [defOf(f.card)]]; });
}
function resetPT(iid) {
  const f = findCard(iid); if (!f) return;
  act(() => { f.card.pb = undefined; f.card.dp = 0; f.card.dt = 0; });
}
// --- full card details (rules text, rulings, legality, price) from Scryfall
async function viewInfo(def) {
  if (!def || !def.id) return;
  const h = UI.cardInfo({ loading: true, name: def.name || dname(def) });
  try { h.set(await Deck.fetchCardInfo(def.id)); } catch (e) { h.error(e.message || 'Could not load card details'); }
}
function createToken(def, n = 1) {
  if (!canEnterBattlefield()) { UI.toast('The battlefield opens when the host starts the game.', { kind: 'warn' }); return false; }
  if (!S.me) return false;
  act(() => {
    S.me.defs[def.id] = S.me.defs[def.id] || def;
    for (let i = 0; i < n; i++) insertCard(mkCard(def, { tok: true }), 'battlefield');
    if (!S.me.tokens.includes(def.id)) S.me.tokens.push(def.id);
    return [`created ${n > 1 ? n + ' ' : 'a '}{0} token${n > 1 ? 's' : ''}`, [def]];
  });
  return true;
}
// A copy behaves like a token (it ceases to exist off the battlefield) but is labelled TOKEN COPY.
function copyCard(def, flipped, tapped) {
  if (!def || !def.id) return;
  if (!canEnterBattlefield()) { UI.toast('The battlefield opens when the host starts the game.', { kind: 'warn' }); return; }
  act(() => {
    S.me.defs[def.id] = S.me.defs[def.id] || def;
    insertCard(mkCard(def, { tok: true, cp: true, t: !!tapped, fl: !!(flipped && (def.imgBack || def.backName)) }), 'battlefield');
    return [`created a ${tapped ? 'tapped ' : ''}copy of {0}`, [def]];
  });
}
// --- switch a card's printing (art). Everyone sees the new art; the choice is saved to the deck.
function printedToken(card, def) {
  return !!(card && card.tok && def && (def.isToken || /\b(Token|Emblem)\b/.test(def.type || '')));
}
function samePrintingGroup(card, def, sourceCard, sourceDef, tokenPrintIds) {
  if (printedToken(sourceCard, sourceDef)) {
    return printedToken(card, def) && (def.id === sourceDef.id || (tokenPrintIds && tokenPrintIds.has(def.id)) || Deck.tokenKey(def) === Deck.tokenKey(sourceDef));
  }
  return !sourceCard.tok && !card.tok && def && def.name === sourceDef.name;
}
async function switchPrinting(iid) {
  const owner = S.me;
  const f = findCard(iid); const d = f && defOf(f.card);
  if (!d || !d.name) return;
  const t = UI.toast(`Finding printings of ${dname(d)}…`, { ms: 4000 });
  let prints;
  try { prints = await (printedToken(f.card, d) ? Deck.fetchTokenPrints(d) : Deck.fetchPrints(d.name)); }
  catch (e) { if (S.me === owner) UI.toast(e.message || 'Could not load printings', { kind: 'error' }); return; }
  finally { if (t && t.close) t.close(); }
  if (S.me !== owner || !findCard(iid) || findCard(iid).card.id !== d.id) return;
  if (!prints.length) { UI.toast(`No other printings found for ${dname(d)}.`); return; }
  const groupDef = prints.find(p => p.id === d.id) || d;
  const tokenPrintIds = printedToken(f.card, d) ? new Set(prints.map(p => p.id)) : null;
  const copies = ZONES.reduce((n, z) => n + S.me.zones[z].filter(c => samePrintingGroup(c, S.me.defs[c.id], f.card, groupDef, tokenPrintIds)).length, 0);
  UI.printPicker({
    title: `Switch printing for ${d.name}`, prints, currentId: d.id, showAll: copies > 1,
    onPick: (nd, scope) => { if (S.me === owner && findCard(iid) && findCard(iid).card.id === d.id) applyPrinting(iid, groupDef, nd, scope, tokenPrintIds); }
  });
}
function applyPrinting(iid, oldDef, nd, scope, tokenPrintIds) {
  const selected = findCard(iid);
  const sourceZone = selected && selected.zone;
  const isToken = !!(selected && selected.card && selected.card.tok);
  const savedDef = Object.assign({}, nd, {
    tokens: (oldDef.tokens && oldDef.tokens.length ? oldDef.tokens : nd.tokens) || []
  });
  act(() => {
    S.me.defs[nd.id] = savedDef;
    for (const z of ZONES) for (const c of S.me.zones[z]) {
      const same = scope === 'all' && selected && samePrintingGroup(c, S.me.defs[c.id], selected.card, oldDef, tokenPrintIds);
      if (c.iid === iid || same) c.id = nd.id;
    }
  });
  // Save to the deck using the exact prior printing, not every row with the same name.
  // This matters when the deck builder stores different printings as separate rows.
  if (isToken) return;
  try {
    const deck = Deck.get(S.deckId);
    if (deck) {
      let changed = false;
      if (scope === 'all') {
        deck.commanders = (deck.commanders || []).map(c =>
          c.name === oldDef.name ? (changed = true, savedDef) : c);
        (deck.cards || []).forEach(e => {
          if (e.def && e.def.name === oldDef.name) { e.def = savedDef; changed = true; }
        });
      } else if (sourceZone === 'command') {
        const index = (deck.commanders || []).findIndex(c => c.id === oldDef.id);
        if (index >= 0) { deck.commanders[index] = savedDef; changed = true; }
      } else {
        const entry = (deck.cards || []).find(e => e.def && e.def.id === oldDef.id);
        if (entry) {
          const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
          const index = deck.cards.indexOf(entry);
          if (qty > 1) {
            entry.qty = qty - 1;
            const samePrinting = deck.cards.find(e => e !== entry && e.def && e.def.id === nd.id);
            if (samePrinting) samePrinting.qty = Math.max(0, Math.floor(Number(samePrinting.qty) || 0)) + 1;
            else deck.cards.splice(index + 1, 0, { def: savedDef, qty: 1 });
          } else if (qty === 1) {
            const samePrinting = deck.cards.find(e => e !== entry && e.def && e.def.id === nd.id);
            if (samePrinting) {
              samePrinting.qty = Math.max(0, Math.floor(Number(samePrinting.qty) || 0)) + 1;
              deck.cards.splice(index, 1);
            } else entry.def = savedDef;
          }
          changed = qty > 0;
        }
      }
      if (changed) {
        Deck.save(deck);
        UI.toast('Saved — your deck will use this printing next game too.', { ms: 3000 });
      }
    }
  } catch (e) { console.warn('could not save printing to deck', e); }
}

// Works from any zone (menu or drag-and-drop). `at` = where on their board it lands.
function giveControl(iid, to, at) {
  if (!canEnterBattlefield()) { UI.toast('Control changes are available after the host starts the game.', { kind: 'warn' }); return; }
  const f = findCard(iid); if (!f) return;
  const d = defOf(f.card);
  act(() => {
    S.me.zones[f.zone].splice(f.idx, 1);
    if (f.zone === 'hand') delete f.card.rvh;
    const orphans = f.zone === 'battlefield' ? detachFrom(S.pid, iid) : [];
    if (orphans.length) setTimeout(() => orphanToast(orphans), 0);
    const card = Object.assign({}, f.card); delete card.x; delete card.y; card.att = null;
    if (f.zone !== 'battlefield') { card.t = false; card.fd = false; card.fl = false; card.c = {}; }
    const req = { k: 'give', card, def: Deck.slimDef(d) };
    if (at) { req.x = at.x; req.y = at.y; }
    sendReq(to, req);
    return [`gave control of {0} to ${pname(to)}${f.zone !== 'battlefield' ? ` (from ${ZL[f.zone]})` : ''}`, [d]];
  });
}
// Owner reclaims a card they gave away: ask the controller's game to hand it straight back (no approval needed).
function takeBack(pid, iid) {
  if (!canEnterBattlefield()) { UI.toast('Control changes are available after the host starts the game.', { kind: 'warn' }); return; }
  const f = oppCard(pid, iid);
  if (!f || f.c.own !== S.pid) return;
  sendReq(pid, { k: 'take', iid });
  UI.toast(`Taking back ${f.def ? dname(f.def) : 'your card'} from ${pname(pid)}…`, { ms: 3000 });
}
function returnControl(iid) {
  if (!canEnterBattlefield()) { UI.toast('Control changes are available after the host starts the game.', { kind: 'warn' }); return; }
  const f = findCard(iid); if (!f) return;
  const d = defOf(f.card);
  act(() => {
    S.me.zones.battlefield.splice(f.idx, 1);
    detachFrom(S.pid, iid);
    const card = Object.assign({}, f.card); delete card.x; delete card.y; card.att = null;
    sendReq(f.card.own, { k: 'return', card, def: Deck.slimDef(d), zone: 'battlefield' });
    return [`returned control of {0} to ${pname(f.card.own)}`, [d]];
  });
}

// --- life & counters (life changes are logged once the clicking stops)
const lifeLog = { from: null, timer: null, by: '' };
function changeLife(d, by) {
  const before = S.me.life;
  act(() => {
    if (lifeLog.from == null) lifeLog.from = S.me.life;
    if (by) lifeLog.by = by;
    S.me.life += d;
  }, { noUndo: !!by });
  const after = S.me.life;
  clearTimeout(lifeLog.timer);
  lifeLog.timer = setTimeout(() => {
    if (lifeLog.from !== S.me.life) say(`life ${lifeLog.from} → ${S.me.life}${lifeLog.by ? ` (by ${lifeLog.by})` : ''}`);
    lifeLog.from = null; lifeLog.by = '';
  }, 1400);
  if (before > 0 && after <= 0) {
    askConcede(`You are at ${after} life. Would you like to concede? You can choose Cancel and continue playing at negative life.`, 'You reached 0 life');
  }
}
function changePoison(d) {
  const before = Math.max(0, num(S.me.poison));
  act(() => {
    S.me.poison = Math.max(0, before + d);
    return S.me.poison >= 10 && d > 0 ? ['has 10+ poison counters ☠'] : null;
  });
  const after = S.me.poison;
  if (before < 10 && after >= 10) {
    askConcede(`You have ${after} poison counters. Would you like to concede?`, 'Lethal poison');
  }
}

const cdLog = {};
// Commander tax chip: left-click +2, right-click −2 (stored as a cast count).
function changeTax(iid, d) {
  if (!iid) return;
  const n = Math.max(0, (S.me.casts[iid] || 0) + d);
  if (n === (S.me.casts[iid] || 0)) return;
  const f = findCard(iid);
  act(() => { S.me.casts[iid] = n; return [`set commander tax${f ? ' for {0}' : ''} to +${2 * n}`, f ? [defOf(f.card)] : []]; });
}
// A commander-damage tag was clicked: my own tags change my tracker; my color on an
// opponent's tags deals (or undoes) damage from my commander to them.
function cmdDmgClick(el, d) {
  const key = el.dataset.k, victim = el.dataset.pid || S.pid;
  if (!key) return;
  if (victim === S.pid) changeCmdDmg(key, d);
  else if (key.startsWith(S.pid + ':')) sendReq(victim, { k: 'cmddmg', key, d });
}
function changeCmdDmg(key, d) {
  const cur = S.me.cmdDmg[key] || 0;
  const next = cur + d;
  if (next < 0) return;
  act(() => { S.me.cmdDmg[key] = next; if (S.me.cmdDmg[key] === 0) delete S.me.cmdDmg[key]; });
  changeLife(-d);
  const [opid, ciid] = key.split(':');
  const cm = ((S.players[opid] && S.players[opid].cmdrs) || []).find(c => c.iid === ciid);
  if (cur < 21 && next >= 21) {
    askConcede(`You have taken ${next} commander damage from ${cm ? cm.name : 'one commander'}. Would you like to concede?`, 'Lethal commander damage');
  }
  clearTimeout(cdLog[key]);
  cdLog[key] = setTimeout(() => {
    const v = S.me.cmdDmg[key] || 0;
    say(`has taken ${v} commander damage from ${pname(opid)}'s ${cm ? cm.name : 'commander'}`);
    if (v >= 21) UI.toast(`21+ commander damage from ${cm ? cm.name : 'one commander'} — that's lethal.`, { kind: 'error', ms: 6000 });
  }, 1400);
}

// --- mulligan (London, first one free in Commander)
function mulligan() {
  const mode = (S.table && S.table.openingMode) || 'london';
  const grants = (S.table && S.table.openingAllowances && S.table.openingAllowances[S.pid]) || 0;
  if (!S.me || S.me.kept || !CTMulligan.canMulligan(S.me.mull, mode, grants)) return;
  act(() => {
    const z = S.me.zones;
    z.library.push(...z.hand.splice(0).map(c => { delete c.rvh; return c; }));
    S.me.revealTopOnce = null;
    shuffle(z.library);
    const opening = CTMulligan.deal(z.library, S.me.defs, (S.table && S.table.openingMode) || 'london');
    z.hand = opening.hand;
    S.me.openingFallback = opening.fallback;
    S.me.mull++;
    return [`took a mulligan (#${S.me.mull}${(S.table && S.table.openingMode || 'london') === 'london' && S.me.mull === 1 ? ', free' : ''})`];
  });
}
function keepHand() {
  const mode = (S.table && S.table.openingMode) || 'london';
  const lands = CTMulligan.landCount(S.me.zones.hand, S.me.defs);
  const possibleLands = lands + CTMulligan.landCount(S.me.zones.library, S.me.defs);
  const grants = (S.table && S.table.openingAllowances && S.table.openingAllowances[S.pid]) || 0;
  if (!CTMulligan.canKeep(mode, lands, possibleLands, S.me.mull, grants)) return;
  const n = CTMulligan.bottomCount(mode, S.me.mull, S.me.zones.hand.length);
  if (!n) {
    act(() => { S.me.kept = true; return [`kept their opening hand${S.me.mull ? ` after ${plural(S.me.mull, 'mulligan')}` : ''}`]; });
    if (mode === 'three-lands' && lands < 3 && possibleLands < 3) UI.toast('This deck has fewer than 3 lands available. You may keep any hand.', { kind: 'warn', ms: 6000 });
    else if (S.me.mull >= openingMulliganLimit(S.pid) && mode === 'three-lands' && lands < 3) UI.toast('Mulligan limit reached. You may keep this hand even though it has fewer than 3 lands.', { kind: 'warn', ms: 6000 });
    return;
  }
  pushUndo('Kept opening hand and chose bottom cards');
  let picked = 0;
  UI.viewer({
    title: `Put ${plural(n, 'card')} on the bottom`,
    cards: S.me.zones.hand.map(c => ({ iid: c.iid, def: defOf(c) })),
    actions: [],
    pick: { count: n, actionKey: 'bottom', prompt: mode === 'london'
      ? `You took ${plural(S.me.mull, 'mulligan')} (first one free): choose ${n} to put on the bottom`
      : `Choose ${n} to put on the bottom` },
    onAction: (k, iid) => {
      moveCard(iid, 'library', { pos: 'bottom' });
      if (++picked === n) { S.me.kept = true; say(`kept ${S.me.zones.hand.length} cards after ${plural(S.me.mull, 'mulligan')}`); commit(); }
    },
    onHover: d => preview(d)
  });
}

async function changeOpeningMode(mode) {
  mode = CTMulligan.normalizeMode(mode);
  if (S.role === 'client') return;
  const current = (S.table && S.table.openingMode) || 'london';
  if (mode === current) return;
  const confirmed = await UI.confirm(`Change the opening-hand rule to ${openingModeName(mode)}? Everyone will reshuffle and redeal.`, {
    title: 'Reset opening hands for everyone', danger: true, okLabel: 'Redeal everyone'
  });
  if (!confirmed) { render(); return; }
  if (S.role === 'solo') {
    S.table.openingMode = mode; S.table.openingDeal = uid();
    resetForNewGame(); render();
  } else toHost({ t: 'op', op: { k: 'mulligan', mode } });
}
function openingRulesMenu(btn) {
  const r = btn.getBoundingClientRect(), current = (S.table && S.table.openingMode) || 'london';
  UI.menu(r.left, r.bottom + 4, CTMulligan.MODES.map(mode => ({
    label: openingModeName(mode), checked: mode === current,
    onClick: () => changeOpeningMode(mode)
  })));
}

// =====================================================================
//  Zone viewers (searchable graveyard / exile / library)
// =====================================================================
const MOVE_ACTIONS = [
  { key: 'hand', label: 'To hand', hint: 'H' }, { key: 'battlefield', label: 'To battlefield', hint: 'B' },
  { key: 'bftapped', label: 'To battlefield tapped' }, { key: 'graveyard', label: 'To graveyard', hint: 'G' },
  { key: 'exile', label: 'Exile', hint: 'E' }, { key: 'top', label: 'Library — top' }, { key: 'bottom', label: 'Library — bottom' },
  { key: 'command', label: 'Command zone' }
];
function runMove(key, iid) {
  const map = { hand: ['hand'], battlefield: ['battlefield'], bftapped: ['battlefield', { tapped: true }], graveyard: ['graveyard'],
    exile: ['exile'], top: ['library', { pos: 'top' }], bottom: ['library', { pos: 'bottom' }], command: ['command'] };
  const m = map[key]; if (m) doMove(iid, m[0], m[1] || {});
}
function openViewer(opts, getCards) {
  let sig = '';
  const cards = () => { const c = getCards(); sig = c.map(x => x.iid + (x.faceDown ? 'd' : '')).join(','); return c; };
  const entry = {};
  const v = UI.viewer(Object.assign({}, opts, {
    cards: cards(),
    onHover: (d, fd) => preview(d, fd && opts.othersFaceDown),
    onClose: () => { S.viewers.delete(entry); if (opts.onClose) opts.onClose(); }
  }));
  entry.refresh = () => { const prev = sig; const c = cards(); if (sig !== prev) v.update(c); };
  entry.v = v;
  S.viewers.add(entry);
  return v;
}
function viewZone(pid, zone) {
  const mine = pid === S.pid;
  const newestFirst = zone === 'graveyard' || zone === 'exile';
  const get = () => {
    let list;
    if (mine) list = S.me.zones[zone].map(c => ({ iid: c.iid, def: defOf(c) || { name: '?' }, faceDown: !!c.fd }));
    else {
      const p = S.players[pid]; if (!p) return [];
      list = (p.zones[zone] || []).map(c => ({ iid: c.iid, def: (c.id && p.defs[c.id]) || { name: 'Face-down card', img: '' }, faceDown: !!c.fd }));
    }
    return newestFirst ? list.reverse() : list;
  };
  const actions = mine ? MOVE_ACTIONS.filter(a => a.key !== zone && !(zone === 'library' && (a.key === 'top' || a.key === 'bottom'))) : [];
  if (zone !== 'library') actions.push({ key: 'copy', label: 'Copy this card' });
  if (mine) actions.push({ key: 'printing', label: 'Switch printing…' });
  actions.push({ key: 'info', label: 'View information' });
  if (mine && zone === 'library') actions.push({ key: 'top', label: 'Move to top' }, { key: 'bottom', label: 'Move to bottom' });
  let footer = [];
  if (mine && zone === 'library') footer = [{ key: 'shuffle', label: 'Shuffle & close', primary: true }, { key: 'close', label: 'Close without shuffling' }];
  if (mine && zone === 'library') say('is searching their library');
  const v = openViewer({
    title: `${zone === 'library' ? 'Library' : zone === 'graveyard' ? 'Graveyard' : zone === 'exile' ? 'Exile' : 'Command zone'} — ${pname(pid)}`,
    ordered: true, orderLabel: zone === 'library' ? 'Top' : 'Newest', tabs: true,
    actions, primary: mine ? 'hand' : undefined, footer,
    othersFaceDown: !mine,
    onAction: (k, iid) => {
      if (k === 'copy') { const x = get().find(c => c.iid === iid); if (x && !x.faceDown && x.def && x.def.id) copyCard(x.def); return; }
      if (k === 'printing') { switchPrinting(iid); return; }
      if (k === 'info') { const x = get().find(c => c.iid === iid); if (x && x.def && x.def.id && !(x.faceDown && !mine)) viewInfo(x.def); return; }
      runMove(k, iid);
    },
    onFooter: k => { if (k === 'shuffle') shuffleLib(); v.close(); }
  }, get);
}
async function lookTop(n) {
  if (!n) n = await UI.prompt({ title: 'Look at the top of your library', label: 'How many cards?', type: 'number', value: 3, min: 1, max: 99 });
  if (!n) return;
  const set = new Set(S.me.zones.library.slice(0, n).map(c => c.iid));
  const gone = new Set();
  say(`is looking at the top ${plural(set.size, 'card')} of their library`);
  const get = () => S.me.zones.library.filter(c => set.has(c.iid) && !gone.has(c.iid)).map(c => ({ iid: c.iid, def: defOf(c) }));
  const v = openViewer({
    title: `Top ${n} — click “Put on top” in reverse order to arrange`,
    ordered: true, orderLabel: 'Top',
    actions: [{ key: 'top', label: 'Put on top' }, { key: 'bottom', label: 'Put on bottom' }, { key: 'hand', label: 'To hand' },
      { key: 'graveyard', label: 'To graveyard' }, { key: 'exile', label: 'Exile' }, { key: 'battlefield', label: 'To battlefield' }],
    footer: [{ key: 'done', label: 'Done', primary: true }],
    onAction: (k, iid) => { if (k === 'bottom') gone.add(iid); runMove(k, iid); },
    onFooter: () => v.close()
  }, get);
}
async function millN(to, faceDown) {
  const n = await UI.prompt({ title: to === 'graveyard' ? 'Mill' : 'Exile from the top', label: 'How many cards?', type: 'number', value: 1, min: 1, max: 99 });
  if (!n) return;
  act(() => {
    const moved = [];
    for (let i = 0; i < n && S.me.zones.library.length; i++) {
      const c = S.me.zones.library.shift(); c.fd = !!faceDown; S.me.zones[to].push(c); moved.push(defOf(c));
    }
    if (moved.length) S.me.revealTopOnce = null;
    if (faceDown) return [`exiled the top ${plural(moved.length, 'card')} face down`];
    const refs = moved.slice(0, 8).map((_, i) => `{${i}}`).join(', ');
    return [`${to === 'graveyard' ? 'milled' : 'exiled from the top'} ${moved.length}: ${refs}${moved.length > 8 ? '…' : ''}`, moved];
  });
}
function toggleRevealHandCard(iid) {
  const f = findCard(iid);
  if (!f || f.zone !== 'hand') return;
  if (S.me.revealHand) {
    UI.toast('Your whole hand is already revealed. Turn that off to reveal individual cards.', { kind: 'warn' });
    return;
  }
  const d = defOf(f.card);
  if (!d) return UI.toast('Could not reveal that card.', { kind: 'warn' });
  const show = !f.card.rvh;
  act(() => {
    if (show) f.card.rvh = true;
    else delete f.card.rvh;
    return [show ? 'revealed {0} from their hand' : 'hid {0} from everyone', [d]];
  }, { noUndo: true });
}
function revealTop() {
  const c = S.me.zones.library[0];
  if (!c) return UI.toast('Library is empty');
  const d = defOf(c);
  act(() => {
    S.me.revealTopOnce = c.iid;
    return [`revealed the top card of their library: {0}`, [d]];
  }, { noUndo: true });
  UI.toast('The top card is visible to everyone until it leaves the top of the Library.');
}
function discardRandom() {
  const h = S.me.zones.hand;
  if (!h.length) return UI.toast('No cards in hand');
  doMove(h[rnd(h.length)].iid, 'graveyard');
}

// --- tokens
function tokensMenu() {
  const toks = S.me.tokens.map(id => S.me.defs[id]).filter(Boolean).sort((a, b) => dname(a).localeCompare(dname(b)));
  tokenGallery(toks, 'Your deck’s tokens', true);
}
function ownEmptyBattlefieldHovered() {
  const el = document.elementFromPoint(pvMouse.x, pvMouse.y);
  if (!el || el.closest('.card, [data-pile], [data-phead], .ohead, .tstrip, .tlife, .tpile, .thand, .tpiles, .zbox')) return false;
  const board = el.closest('.board[data-pid]');
  return !!board && board.dataset.pid === S.pid;
}
async function searchTokens() {
  const owner = S.me;
  if (!owner) return;
  const q = await UI.prompt({ title: 'Create a token', label: 'Search tokens (e.g. Goblin, Treasure, Zombie, 1/1 Soldier)' });
  if (!q || S.me !== owner) return;
  let res;
  try { res = await Deck.searchTokens(String(q)); } catch (e) { if (S.me === owner) UI.toast(e.message || 'Token search failed', { kind: 'error' }); return; }
  if (S.me !== owner) return;
  if (!res.length) { UI.toast(`No tokens found for “${q}”`); return; }
  tokenGallery(res, `Tokens matching “${q}”`);
}

// =====================================================================
//  Menus
// =====================================================================
function cardMenu(x, y, iid) {
  const f = findCard(iid); if (!f) return;
  const c = f.card, d = defOf(c) || {}, z = f.zone;
  const items = [];
  const opps = ((S.table && S.table.seats) || []).filter(p => p !== S.pid && S.players[p]);
  const attachable = isAttachable(d);
  if (z === 'battlefield') {
    items.push({ label: 'Send arrow to…', onClick: () => startTargeting({ kind: 'card', pid: S.pid, iid }) });
    items.push({ label: c.t ? 'Untap' : 'Tap', hint: 'T', onClick: () => toggleTap(iid) });
    if (c.att) items.push({ label: 'Unattach', onClick: () => unattach(iid) });
    items.push({ label: attachable ? (/Equipment/.test(d.type || '') ? 'Equip to…' : 'Enchant / attach to…') : 'Attach to…', hint: 'A', onClick: () => startAttach(iid) });
    if (d.imgBack || d.backName) items.push({ label: 'Transform / flip', hint: 'F', onClick: () => flip(iid) });
    items.push({ sep: true });
    items.push({ label: 'Counters', sub: counterItems(iid) });
    items.push({ label: 'Power / Toughness', sub: ptItems(iid) });
    items.push({ sep: true });
    items.push({ label: c.fd ? 'Turn face up' : 'Turn face down', hint: 'Z', onClick: () => toggleFaceDown(iid) });
    items.push({ label: 'Copy this card', disabled: c.fd, onClick: () => copyCard(d, c.fl) });
    if (d.tokens && d.tokens.length) {
      items.push({ label: 'Create related token…', onClick: () => relatedTokenGallery(d.tokens, `Tokens for ${dname(d)}`) });
    }
    if (opps.length) items.push({ label: 'Give control to', sub: opps.map(p => ({ label: pname(p), onClick: () => giveControl(iid, p) })) });
    if (c.own !== S.pid) items.push({ label: `Return control to ${pname(c.own)}`, onClick: () => returnControl(iid) });
  }
  if (z === 'hand') {
    items.push({ label: 'Play', hint: 'B', onClick: () => doMove(iid, 'battlefield') });
    if (attachable) items.push({ label: /Equipment/.test(d.type || '') ? 'Play & equip to…' : 'Cast & attach to…', onClick: () => startAttach(iid) });
    items.push({ label: 'Play tapped', hint: 'T', onClick: () => doMove(iid, 'battlefield', { tapped: true }) });
    items.push({ label: 'Play face down', onClick: () => doMove(iid, 'battlefield', { faceDown: true }) });
    items.push({ label: c.rvh ? 'Hide from everyone' : 'Reveal to everyone', checked: !!c.rvh, disabled: S.me.revealHand, onClick: () => toggleRevealHandCard(iid) });
  }
  if (z === 'command') {
    const n = S.me.casts[iid] || 0;
    // commander tax is manual: add it yourself when you recast
    items.push({ label: n ? `Cast (commander tax is +${2 * n})` : 'Cast', onClick: () => doMove(iid, 'battlefield') });
    items.push({ label: 'Add commander tax (+2)', onClick: () => act(() => { S.me.casts[iid] = n + 1; return [`set commander tax for {0} to +${2 * (n + 1)}`, [d]]; }) });
    items.push({ label: 'Remove commander tax (−2)', disabled: !n, onClick: () => act(() => { S.me.casts[iid] = Math.max(0, n - 1); return [`set commander tax for {0} to +${2 * Math.max(0, n - 1)}`, [d]]; }) });
  }
  items.push({ sep: true });
  if (d.id) items.push({ label: 'View information', hint: 'I', onClick: () => viewInfo(d) });
  if (!c.fd && d.name) items.push({ label: 'Switch printing…', onClick: () => switchPrinting(iid) });
  const moves = MOVE_ACTIONS.filter(a => a.key !== z && !(z === 'battlefield' && a.key === 'bftapped'));
  items.push({ label: 'Move to', sub: moves.map(a => ({ label: a.label, hint: a.hint, onClick: () => runMove(a.key, iid) })) });
  if (c.tok) items.push({ label: c.cp ? 'Remove copy' : 'Remove token', danger: true, onClick: () => doMove(iid, 'graveyard') });
  UI.menu(x, y, items);
}
function oppCard(pid, iid) {
  const p = S.players[pid]; if (!p) return null;
  for (const z of ['battlefield', 'command', 'graveyard', 'exile']) {
    const c = (p.zones[z] || []).find(x => x.iid === iid);
    if (c) return { c, def: c.id ? p.defs[c.id] : null };
  }
  const c = (p.revHand || []).find(x => x.iid === iid) || (p.revCards || []).find(x => x.iid === iid);
  return c ? { c, def: c.id ? p.defs[c.id] : null } : null;
}
function oppCardMenu(x, y, pid, iid) {
  const f = oppCard(pid, iid);
  if (!f) return;
  const items = [];
  if ((S.players[pid].zones.battlefield || []).some(c => c.iid === iid))
    items.push({ label: 'Send arrow to…', onClick: () => startTargeting({ kind: 'card', pid, iid }) });
  // a card I own that another player controls (I gave it to them): I can always take it back
  if (f.c.own === S.pid && pid !== S.pid && (S.players[pid].zones.battlefield || []).some(x => x.iid === iid)) {
    items.push({ label: `Take back ${f.def ? dname(f.def) : 'this card'}`, hint: 'yours', onClick: () => takeBack(pid, iid) }, { sep: true });
  }
  items.push(
    { label: 'View information', disabled: !f.def, onClick: () => viewInfo(f.def) },
    { label: 'Copy this card', disabled: !f.def, hint: f.def ? '' : 'face down', onClick: () => copyCard(f.def, f.c.fl) }
  );
  UI.menu(x, y, items);
}
function counterItems(iid) {
  const f = findCard(iid); const c = (f && f.card.c) || {};
  const d = f && defOf(f.card);
  const has = Object.keys(c).length > 0;
  const items = [
    { label: 'Add +1/+1 counter', hint: '+', onClick: () => addCounter(iid, '+1/+1', 1) },
    { label: 'Add −1/−1 counter', hint: '−', onClick: () => addCounter(iid, '-1/-1', 1) }
  ];
  if (d && /Planeswalker/.test(d.type || '')) {
    items.push({ label: 'Loyalty +1', onClick: () => addCounter(iid, 'Loyalty', 1) }, { label: 'Loyalty −1', onClick: () => addCounter(iid, 'Loyalty', -1) });
  }
  items.push({ label: 'Add a counter…', hint: 'J', onClick: () => customCounter(iid) });
  // one-click +/- for any other counters already on the card
  Object.keys(c).filter(k => !['+1/+1', '-1/-1', 'Loyalty'].includes(k)).forEach(k => {
    items.push({ label: `${k} (${c[k]})`, sub: [{ label: '+1', onClick: () => addCounter(iid, k, 1) }, { label: '−1', onClick: () => addCounter(iid, k, -1) }] });
  });
  items.push({ sep: true },
    { label: 'Increment all counters', hint: 'Shift+1', disabled: !has, onClick: () => allCounters(iid, 'inc') },
    { label: 'Double all counters', hint: 'Shift+2', disabled: !has, onClick: () => allCounters(iid, 'double') },
    { label: 'Decrement all counters', hint: 'Shift+3', disabled: !has, onClick: () => allCounters(iid, 'dec') },
    { sep: true },
    { label: 'Reset counters', disabled: !has, danger: true, onClick: () => allCounters(iid, 'reset') });
  return items;
}
function ptItems(iid) {
  const f = findCard(iid);
  const mod = f && (f.card.pb || f.card.dp || f.card.dt);
  return [
    { label: 'Set power/toughness…', onClick: () => setPT(iid) },
    { sep: true },
    { label: 'Power +1', hint: 'Alt+1', onClick: () => changePT(iid, 1, 0) },
    { label: 'Power −1', hint: 'Alt+3', onClick: () => changePT(iid, -1, 0) },
    { label: 'Toughness +1', hint: 'Alt+2', onClick: () => changePT(iid, 0, 1) },
    { label: 'Toughness −1', hint: 'Alt+4', onClick: () => changePT(iid, 0, -1) },
    { label: 'Manual +1/+1 (until reset)', onClick: () => changePT(iid, 1, 1) },
    { sep: true },
    { label: 'Reset power/toughness', disabled: !mod, onClick: () => resetPT(iid) }
  ];
}
function libraryMenu(x, y) {
  UI.menu(x, y, [
    { label: 'Draw', hint: 'D', onClick: () => draw(1) },
    { label: 'Draw X…', onClick: async () => { const n = await UI.prompt({ title: 'Draw cards', type: 'number', value: 2, min: 1, max: 30 }); if (n) draw(n); } },
    { label: 'Shuffle', hint: 'S', onClick: shuffleLib },
    { sep: true },
    { label: 'Search library…', hint: 'L', onClick: () => viewZone(S.pid, 'library') },
    { label: 'Look at top X (scry)…', onClick: () => lookTop() },
    { label: 'Reveal top card', onClick: revealTop },
    { label: 'Play with top card revealed', checked: S.me.revealTop, onClick: () => act(() => { S.me.revealTop = !S.me.revealTop; return [S.me.revealTop ? 'is playing with the top card revealed' : 'stopped revealing the top card']; }) },
    { sep: true },
    { label: 'Mill top card to Graveyard', hint: 'X', onClick: millTopCard },
    { label: 'Mill X…', onClick: () => millN('graveyard') },
    { label: 'Exile top X…', onClick: () => millN('exile') },
    { label: 'Exile top X face down…', onClick: () => millN('exile', true) }
  ]);
}
// --- card-type helpers (graveyard counter, hover breakdown, random picks)
const PERM_RE = /\b(Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/;
const CARD_TYPES = ['Creature', 'Land', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle', 'Instant', 'Sorcery'];
const hasType = (d, t) => !!d && new RegExp('\\b' + t + '\\b').test(d.type || '');
const isPermanentDef = d => !!d && PERM_RE.test(d.type || '');
function typeCounts(cards, defs) {
  const types = {}; let perm = 0;
  for (const c of cards) {
    const d = c && c.id && defs[c.id]; if (!d) continue;
    if (isPermanentDef(d)) perm++;
    for (const t of CARD_TYPES) if (hasType(d, t)) types[t] = (types[t] || 0) + 1;
  }
  return { perm, types };
}
// "Pick at random" submenu: Any card / Permanent / each card type present, with counts.
function randomPickItems(zone, x, y) {
  const list = S.me.zones[zone].filter(c => !c.fd && defOf(c));
  const groups = [{ label: 'Any card', test: () => true }, { label: 'Permanent', test: isPermanentDef }]
    .concat(CARD_TYPES.map(t => ({ label: t, test: d => hasType(d, t) })));
  return groups.map((g, i) => {
    const pool = list.filter(c => g.test(defOf(c)));
    return (i < 2 || pool.length) ? { label: `${g.label} (${pool.length})`, disabled: !pool.length, onClick: () => pickRandom(zone, pool, g.label, x, y) } : null;
  }).filter(Boolean);
}
function pickRandom(zone, pool, label, x, y) {
  const c = pool[rnd(pool.length)]; const d = defOf(c);
  say(`picked a random ${label === 'Any card' ? 'card' : label.toLowerCase()} from their ${zone}: {0}`, [d]);
  preview(d);
  UI.menu(x, y, [
    { label: `Picked: ${dname(d)}`, disabled: true }, { sep: true },
    ...MOVE_ACTIONS.filter(a => a.key !== zone).map(a => ({ label: a.label, onClick: () => runMove(a.key, c.iid) })),
    { label: 'Create a token copy', onClick: () => copyCard(d) },
    { label: 'Create a tapped token copy', onClick: () => copyCard(d, false, true) },
    { label: 'Leave it where it is', onClick: () => {} }
  ]);
}
function pileMenu(x, y, zone) {
  if (zone === 'library') return libraryMenu(x, y);
  const name = zone === 'graveyard' ? 'graveyard' : 'exile';
  const list = S.me.zones[zone], top = list[list.length - 1];
  const topItems = top ? [
    { label: `Top card: ${dname(defOf(top))}`, sub: MOVE_ACTIONS.filter(a => a.key !== zone).map(a => ({ label: a.label, onClick: () => runMove(a.key, top.iid) })) },
    { label: 'Pick at random', sub: randomPickItems(zone, x, y) },
    { sep: true }
  ] : [];
  UI.menu(x, y, topItems.concat([
    { label: `Search ${name}…`, onClick: () => viewZone(S.pid, zone) },
    { label: `Shuffle ${name} into library`, disabled: !S.me.zones[zone].length, onClick: () => act(() => {
      const z = S.me.zones; z.library.push(...z[zone].splice(0).map(c => { c.fd = false; return c; })); shuffle(z.library);
      return [`shuffled their ${name} into their library`];
    }) },
    zone === 'graveyard' ? { label: 'Exile entire graveyard', disabled: !S.me.zones.graveyard.length, onClick: () => act(() => {
      const z = S.me.zones; const n = z.graveyard.length; z.exile.push(...z.graveyard.splice(0)); return [`exiled their graveyard (${plural(n, 'card')})`];
    }) } : { label: 'Return all to hand', disabled: !S.me.zones.exile.length, onClick: () => act(() => {
      const z = S.me.zones; const n = z.exile.length; z.hand.push(...z.exile.splice(0).map(c => { c.fd = false; return c; })); return [`returned ${plural(n, 'card')} from exile to hand`];
    }) }
  ]));
}
function playerMenu(x, y, pid) {
  const T = S.table; if (!T) return;
  const items = [
    { label: 'Send arrow to…', onClick: () => startTargeting({ kind: 'player', pid }) },
    { label: T.monarch === pid ? 'Remove monarch' : 'Make monarch 👑', onClick: () => toHost({ t: 'op', op: { k: 'monarch', pid: T.monarch === pid ? null : pid } }) },
    { label: T.initiative === pid ? 'Remove initiative' : 'Give initiative 🏰', onClick: () => toHost({ t: 'op', op: { k: 'initiative', pid: T.initiative === pid ? null : pid } }) }
  ];
  const p = S.players[pid];
  const ownKept = pid === S.pid ? !!(S.me && S.me.kept) : !!(p && p.kept);
  if (S.role !== 'client' && T.openingMode !== 'london' && T.seats.includes(pid) && !ownKept
    && CTMulligan.extraLimit((T.openingAllowances || {})[pid]) < CTMulligan.MAX_EXTRA) {
    items.push({ sep: true }, { label: 'Grant another mulligan', onClick: () => toHost({ t: 'op', op: { k: 'grantmull', pid } }) });
  }
  if (pid !== S.pid && p) {
    items.push({ sep: true },
      { label: S.focus === pid ? 'Show all opponents' : 'Show this board large', onClick: () => toggleFocus(pid) },
      { label: 'View graveyard', onClick: () => viewZone(pid, 'graveyard') },
      { label: 'View exile', onClick: () => viewZone(pid, 'exile') },
      { label: 'Change their life…', onClick: async () => {
        const d = await UI.prompt({ title: `Change ${p.name}'s life`, label: 'Amount (negative = loses life)', type: 'number', value: -1, min: -100, max: 100 });
        if (d) sendReq(pid, { k: 'life', d });
      } });
  }
  if (isModerator()) {
    items.push({ sep: true });
    if (T.out[pid]) items.push({ label: 'Restore to game (undo concede)', onClick: () => toHost({ t: 'op', op: { k: 'reinstate', pid } }) });
    if (S.role !== 'client' && pid !== S.pid) items.push({ label: (T.mods || []).includes(pid) ? 'Revoke moderator permissions' : 'Grant moderator permissions', onClick: () => toHost({ t: 'op', op: { k: 'moderator', pid, enabled: !(T.mods || []).includes(pid) } }) });
    if (pid !== T.hostPid && pid !== (S.role === 'host' ? S.pid : null)) {
      items.push({ label: 'Transfer this board…', onClick: () => showBoardTransfer(pid) });
      items.push({ label: 'Kick from game…', danger: true, onClick: async () => {
        if (await UI.confirm(`Kick ${pname(pid)} from this game? Their current seat will be removed and cannot reconnect. Their local board is saved as a recovery copy.`, { danger: true, okLabel: 'Kick' })) toHost({ t: 'op', op: { k: 'kick', pid } });
      } });
    }
  }
  UI.menu(x, y, items);
}
let colorModal = null;
function ownColorLocked() {
  return !!(S.table && S.table.seats.includes(S.pid) && S.table.colors && CTPlayerColors.color(S.table.colors[S.pid]));
}
function closeColorModal() { if (colorModal) { colorModal.close(); colorModal = null; } }
function showColorPicker(message) {
  if (!S.colorFlow) return;
  closeColorModal();
  const T = S.table, colors = T ? CTPlayerColors.normalize(T.seats, T.colors, false) : {};
  const taken = Object.keys(colors).filter(pid => pid !== S.pid).map(pid => colors[pid]);
  const defaultId = CTPlayerColors.PALETTE.find(c => !taken.includes(c.id))?.id;
  const hasRoom = !!(T && (T.seats.includes(S.pid) || T.seats.length < 6));
  const status = message || (S.colorRequestPending ? 'Sending your choice to the host…' : !T ? 'Waiting for room details…' : !hasRoom || !defaultId ? 'This room has no open color slots.' : 'Choose an available color to finish joining the table.');
  const options = T ? CTPlayerColors.PALETTE.map(c => {
    const owner = Object.keys(colors).find(pid => pid !== S.pid && colors[pid] === c.id);
    const available = !owner && hasRoom;
    const hint = owner ? `Taken by ${pname(owner)}` : !hasRoom ? 'Room full' : c.id === defaultId ? 'Available · default' : 'Available';
    return `<button type="button" class="ct-player-color-option" data-color="${c.id}"${available && !S.colorRequestPending ? '' : ' disabled'}><span class="ct-player-color-swatch" style="--pc:${c.value}"></span><span class="ct-player-color-name">${c.name}</span><span class="ct-player-color-state">${esc(hint)}</span></button>`;
  }).join('') : '';
  colorModal = UI.modal({
    title: 'Choose your player color', className: 'ct-player-color-dialog',
    html: `<p class="ct-player-color-intro">Each player has a different color. Your choice is saved to this room.</p><p class="ct-player-color-status" role="status">${esc(status)}</p><div class="ct-player-color-options">${options}</div><div class="ct-player-color-actions"><button type="button" data-a="cancel-color-flow">Cancel and return to lobby</button></div>`,
    onEscape: () => true
  });
  const backdrop = colorModal.dialog.parentElement;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  colorModal.el.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled || S.colorRequestPending) return;
    const color = button.dataset.color;
    if (S.role === 'client') {
      if (!S.table) return;
      S.colorRequestPending = true;
      showColorPicker();
      toHost({ t: 'op', op: { k: 'joincolor', color } });
    } else {
      toHost({ t: 'op', op: { k: 'color', color } });
    }
  }));
  colorModal.el.querySelector('[data-a="cancel-color-flow"]').addEventListener('click', cancelColorFlow);
}
function cancelColorFlow() {
  clearResponseNotice();
  if (!S.colorFlow) return;
  closeColorModal(); S.colorFlow = false; S.colorRequestPending = false;
  try { Net.stop(); } catch (e) { /* ignore */ }
  LS.del('ct.sess.' + S.pid); LS.del('ct.last');
  S.role = 'solo'; S.room = ''; S.me = null; S.table = null; S.players = {}; S.log = []; S.undo = []; S.online = {};
  S.targetArrows = []; S.arrowControlsDismissed = false; endTargeting();
  showLobby();
}
function syncColorFlow() {
  if (ownColorLocked()) {
    const wasChoosing = S.colorFlow;
    S.colorFlow = false; S.colorRequestPending = false;
    if (wasChoosing) { closeColorModal(); publish(true); saveNow(); }
    return;
  }
  if (S.colorFlow && S.role === 'client' && S.table) showColorPicker();
}
function diceMenu(x, y) {
  const roll = (sides) => { const v = rnd(sides) + 1; say(`rolled a d${sides}: ${v}`); };
  UI.menu(x, y, [
    { label: 'Flip a coin', onClick: () => say(`flipped a coin: ${rnd(2) ? 'heads' : 'tails'}`) },
    { label: 'Roll d6', onClick: () => roll(6) }, { label: 'Roll d20', onClick: () => roll(20) },
    { label: 'Other dice', sub: [4, 8, 10, 12, 100].map(s => ({ label: `d${s}`, onClick: () => roll(s) })) },
    { sep: true },
    { label: 'Pick a random player', onClick: () => {
      const seats = ((S.table && S.table.seats) || [S.pid]).filter(p => !(S.table && S.table.out[p]));
      say(`picked a random player: ${pname(seats[rnd(seats.length)])}`);
    } }
  ]);
}
let touchOrientationHintDismissed = false;
function updateTouchViewportHeight() {
  const viewport = window.visualViewport;
  const height = viewport && viewport.height > 0 ? viewport.height : window.innerHeight;
  if (S.touchMode && Number.isFinite(height) && height > 0) {
    document.documentElement.style.setProperty('--ct-viewport-height', `${Math.round(height)}px`);
  } else {
    document.documentElement.style.removeProperty('--ct-viewport-height');
  }
}
function refreshTouchOrientationHint() {
  const old = $('#ct-touch-orientation-hint');
  const gameActive = $('#game') && !$('#game').classList.contains('hidden');
  const portraitPhone = gameActive && S.touchMode && window.innerWidth <= 700 && window.innerHeight > window.innerWidth;
  if (!portraitPhone) {
    if (old) old.remove();
    if (window.innerWidth > 700 || window.innerWidth > window.innerHeight) touchOrientationHintDismissed = false;
    return;
  }
  if (old || touchOrientationHintDismissed) return;
  const hint = document.createElement('div');
  hint.id = 'ct-touch-orientation-hint';
  hint.setAttribute('role', 'status');
  hint.innerHTML = '<span><b>Playing on a phone?</b> Landscape gives your hand and battlefield more room. You can keep playing upright if you prefer.</span><button type="button">Got it</button>';
  hint.querySelector('button').addEventListener('click', () => {
    touchOrientationHintDismissed = true;
    hint.remove();
  });
  document.body.appendChild(hint);
}
function setTouchMode(enabled) {
  S.touchMode = !!enabled;
  LS.set('ct.touchMode', S.touchMode);
  document.body.classList.toggle('touch-mode', S.touchMode);
  updateTouchViewportHeight();
  S.touchPreview = null;
  hidePreview();
  refreshTouchOrientationHint();
  UI.toast(S.touchMode ? 'Touch mode on: page scrolling is disabled; drag cards to move them. Landscape is recommended on phones.' : 'Touch mode off: standard desktop controls restored.', { ms: 4000 });
}
function mainMenu(x, y) {
  const m = S.me;
  const items = [
    { label: 'Draw a card', hint: 'D', onClick: () => draw(1) },
    { label: 'Untap all', hint: 'U', onClick: untapAll },
    { label: 'Choose / recover a board…', onClick: () => showBoardRecovery() },
    { label: 'Tokens…', onClick: () => tokensMenu(x, y) },
    { label: 'Targeting arrow…', onClick: () => startTargeting() },
    { label: 'Show arrow controls', disabled: !S.targetArrows.length, onClick: showTargetingControls },
    { label: 'Clear all targeting arrows', disabled: !S.targetArrows.length, onClick: clearTargetArrows },
    { sep: true },
    { label: S.arrange ? 'Done arranging zones' : 'Arrange my zones', onClick: toggleArrange },
    { label: 'Tidy up my cards', onClick: () => act(() => { tidyBoard(); return ['tidied up their battlefield']; }) },
    { label: 'Display settings…', onClick: displaySettings },
    { label: `Touch mode: ${S.touchMode ? 'On' : 'Off'}`, checked: S.touchMode, onClick: () => setTouchMode(!S.touchMode) },
    { label: 'Hotkey list…', onClick: showHotkeyList },
    { sep: true },
    { label: 'Auto-untap on my turn', checked: m.autoUntap, onClick: () => act(() => { m.autoUntap = !m.autoUntap; }, { noUndo: true }) },
    { label: 'Auto-draw on my turn', checked: m.autoDraw, onClick: () => act(() => { m.autoDraw = !m.autoDraw; }, { noUndo: true }) },
    { label: 'Reveal my hand to everyone', checked: m.revealHand, onClick: () => act(() => { m.revealHand = !m.revealHand; return [m.revealHand ? 'revealed their hand' : 'stopped revealing their hand']; }) },
    { label: 'Discard at random', onClick: discardRandom },
    { sep: true },
    { label: 'Concede game…', danger: true, onClick: async () => {
      if (await UI.confirm('Concede this game? You will be marked as out and skipped in turn order.', { title: 'Concede game', danger: true, okLabel: 'Concede' })) concedeGame();
    } },
    { sep: true }
  ];
  if (S.role !== 'client') items.push({ label: 'Start a new game (everyone)', onClick: async () => {
    if (await UI.confirm('Start a new game? Everyone reshuffles and receives a new opening hand.', { okLabel: 'New game' })) toHost({ t: 'op', op: { k: 'newgame' } });
  } });
  if (S.role !== 'solo') {
    items.push({ label: 'Copy invite link', onClick: copyRoom });
    items.push({ label: 'Connection details…', onClick: showConnInfo });
  }
  items.push({ label: 'Leave game', danger: true, onClick: leaveGame });
  UI.menu(x, y, items);
}
function toggleArrange() {
  S.arrange = !S.arrange;
  if (S.arrange) S.selected.clear(); // arranging zones should not leave a group selected
  if (S.arrange) UI.toast('Drag a zone by its name to move it (its cards come along). Drag the corner to resize. Everyone sees your layout.', { ms: 7000 });
  render();
}
// Shared Pass Turn button (highlighted on your turn; disabled until the game starts).
function passBtn() {
  const T = S.table, started = !!(T && T.started && T.active), mine = started && T.active === S.pid;
  return `<div class="ztool"><button data-a="pass" class="${mine ? 'primary' : ''}"${started ? '' : ' disabled'} title="Pass the turn to the next player">Pass turn ▶</button></div>`;
}
function toggleFocus(pid) { S.focus = S.focus === pid ? null : pid; render(); }
function showHotkeyList() {
  const groups = [
    { title: 'With a card hovered', rows: [
      ['T', 'Tap / untap; from hand, play onto the battlefield tapped'], ['F', 'Transform / flip'], ['Z', 'Turn face down or up'],
      ['G', 'Move to Graveyard'], ['E', 'Move to Exile'], ['H', 'Move to Hand'], ['B', 'Move to Battlefield'],
      ['A', 'Attach / equip / enchant'], ['J', 'Add a named counter'], ['I', 'View card information'],
      ['+ or =', 'Add a +1/+1 counter'], ['− or _', 'Add a −1/−1 counter'],
      ['Shift+1', 'Increment every counter on the card'], ['Shift+2', 'Double every counter on the card'],
      ['Shift+3', 'Decrement every counter on the card'],
      ['Alt+1', 'Power +1'], ['Alt+2', 'Toughness +1'], ['Alt+3', 'Power −1'], ['Alt+4', 'Toughness −1']
    ] },
    { title: 'With your Library hovered', rows: [
      ['S', 'Shuffle Library (small card animation and sound)'],
      ['X', 'Mill the top card into your Graveyard']
    ] },
    { title: 'General', rows: [
      ['R', 'In response! — alert everyone; press again to repeat'],
      ['D', 'Draw one card'], ['U', 'Untap all'], ['L', 'Open Search Library from anywhere'], ['T (empty battlefield)', 'Open the Token menu'],
      ['Space', 'Pass the turn'], ['Ctrl+Z / ⌘Z', 'Undo'], ['Hold V', 'Use the magnifier']
    ] }
  ];
  const html = '<div class="ct-hotkey-list">' +
    '<p class="muted small">Hotkeys are active during a game. Card-specific actions use the card currently under your cursor.</p>' +
    groups.map(group => '<section class="ct-hotkey-group"><h3>' + esc(group.title) + '</h3><table><tbody>' +
      group.rows.map(([key, action]) => '<tr><td><kbd>' + esc(key) + '</kbd></td><td>' + esc(action) + '</td></tr>').join('') +
      '</tbody></table></section>').join('') +
    '</div>';
  UI.modal({ title: 'Hotkey list', className: 'w-hotkey-list-dialog', html });
}
function displaySettings() {
  const r0 = window.Lens ? Lens.getRadius() : 90;
  const m = UI.modal({ title: 'Display settings', className: 'w-display-dialog', html: `
    <div class="display-settings">
      <div>
        <div class="display-setting-head"><label for="ctLensSize"><b>Magnifier size</b></label><strong id="ctLensValue">${r0}px</strong></div>
        <small>Hold <kbd>V</kbd> over the table: every card inside the circle is shown large. A bigger circle catches more cards at once.</small>
        <input class="display-scale" id="ctLensSize" type="range" min="40" max="260" step="10" value="${r0}" aria-label="Magnifier size">
        <div class="display-scale-ends"><span>Small</span><span>Large</span></div>
      </div>
      <div>
        <div class="display-setting-head"><label for="ctHandSize"><b>Hand size</b></label><strong id="ctHandValue">${S.handCw || 82}px</strong></div>
        <input class="display-scale" id="ctHandSize" type="range" min="60" max="160" step="2" value="${S.handCw || 82}" aria-label="Hand card size">
        <div class="display-scale-ends"><span>Small</span><button type="button" id="ctHandReset">Reset</button><span>Large</span></div>
      </div>
      <p class="display-note">Saved in this browser only; doesn't change what other players see.</p>
    </div>` });
  const hs = m.el.querySelector('#ctHandSize'), hv = m.el.querySelector('#ctHandValue');
  const setHand = v => { setHandSize(clamp(num(v, 82), 60, 160)); LS.set('ct.handCw', S.handCw); hs.value = S.handCw; hv.textContent = S.handCw + 'px'; };
  hs.addEventListener('input', () => setHand(hs.value));
  m.el.querySelector('#ctHandReset').addEventListener('click', () => setHand(82));
  const lens = m.el.querySelector('#ctLensSize'), lv = m.el.querySelector('#ctLensValue');
  lens.addEventListener('input', () => { const r = window.Lens ? Lens.setRadius(+lens.value) : +lens.value; lv.textContent = r + 'px'; });
}
// Current view mode; with no opponents there's only one sensible layout.
function curView() {
  if (!S.view) S.view = LS.get('ct.view', 'side');
  if (!['side', 'grid'].includes(S.view)) S.view = 'side'; // the old Top and Focus layouts are gone
  return oppPids().length ? S.view : 'top'; // 'top' is only the internal layout for a table with nobody else at it (solo)
}

// =====================================================================
//  Rendering
// =====================================================================
let rq = false;
// Draw a container's HTML by patching the existing elements instead of replacing them. Re-creating every
// card image on every action makes Safari flash them blank; now only cards that really changed are touched
// (cards are matched by data-iid, so moving or tapping one leaves the rest alone). Falls back to a plain
// replace if anything unexpected happens.
let uiEpoch = 0;
function syncAttrs(a, b) {
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of b.attributes) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  if (a.tagName === 'INPUT') { if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.checked; else if (document.activeElement !== a) a.value = b.getAttribute('value') || ''; }
}
function patchKids(a, b) {
  const keyed = new Map();
  for (const c of a.children) if (c.dataset && c.dataset.iid && !keyed.has(c.dataset.iid)) keyed.set(c.dataset.iid, c);
  const bk = [...b.childNodes];
  bk.forEach((n, i) => {
    let cur = a.childNodes[i];
    const key = n.nodeType === 1 && n.dataset ? n.dataset.iid : null;
    if (key && keyed.has(key)) {
      const f = keyed.get(key);
      if (f !== cur) a.insertBefore(f, cur || null);
      cur = f;
    }
    if (!cur) { a.appendChild(n.cloneNode(true)); return; }
    if (cur.nodeType !== n.nodeType || (n.nodeType === 1 && (cur.tagName !== n.tagName ||
      (key && cur.dataset.iid !== key) || (!key && cur.dataset && cur.dataset.iid)))) { a.replaceChild(n.cloneNode(true), cur); return; }
    if (n.nodeType === 3 || n.nodeType === 8) { if (cur.nodeValue !== n.nodeValue) cur.nodeValue = n.nodeValue; return; }
    syncAttrs(cur, n);
    if (cur.tagName !== 'IMG') patchKids(cur, n);
  });
  while (a.childNodes.length > bk.length) a.removeChild(a.lastChild);
}
function setHTML(el, html) {
  if (el.__h === html && el.__e === uiEpoch) return;
  try { const t = document.createElement('template'); t.innerHTML = html; patchKids(el, t.content); }
  catch (e) { console.error(e); el.innerHTML = html; }
  el.__h = html; el.__e = uiEpoch;
}
function render() {
  if (rq) return;
  rq = true;
  // rAF is paused in background tabs; the timeout keeps a hidden tab's board current anyway.
  let done = false;
  const run = () => { if (done) return; done = true; rq = false; if (!S.dragging) renderNow(); else render(); };
  requestAnimationFrame(run);
  setTimeout(run, 150);
}
const renderStats = { count: 0, lastMs: 0, maxMs: 0 };
function renderNow() {
  if (!S.me || $('#game').classList.contains('hidden')) return;
  const t0 = performance.now();
  try { renderBody(); } finally {
    const ms = performance.now() - t0;
    renderStats.count++; renderStats.lastMs = Math.round(ms * 10) / 10; renderStats.maxMs = Math.max(renderStats.maxMs, renderStats.lastMs);
  }
}
function renderBody() {
  pruneSelection();
  const idx = buildIndex();
  { const row = $('#myRow'), h = row && row.offsetHeight; if (h) $('#table').style.setProperty('--stripH', h + 'px'); }
  renderTop(); renderOpps(idx); renderMine(idx); renderLog();
  fitBoards();
  renderOppPanel();
  refreshTargeting();
  S.viewers.forEach(v => { try { v.refresh(); } catch (e) { console.error(e); } });
}

function appearanceBackFor(pid) {
  const owner = pid === S.pid ? S.me : (S.players[pid] || null), custom = CTAppearance.getCustom();
  if (pid === S.pid && custom.cardBack && custom.cardBackActive) return 'custom-local';
  return CTAppearance.normalizePrefs(owner && owner.appearance).cardBack;
}
function appearanceBoardStyleFor(pid) {
  const owner = pid === S.pid ? S.me : (S.players[pid] || null), custom = CTAppearance.getCustom();
  if (pid === S.pid && custom.background && custom.backgroundActive) return CTAppearance.boardBackgroundStyle('custom-local');
  return CTAppearance.boardBackgroundStyle(CTAppearance.normalizePrefs(owner && owner.appearance).background);
}
function cardHTML(c, def, o) {
  // o: {mine, pid (board owner), ctrl (who controls it), zone, style}
  const ctrl = o.ctrl || o.pid;
  const cls = ['card'];
  if (typeof drawPendingIids !== 'undefined' && drawPendingIids.has(c.iid)) cls.push('ct-draw-pending');
  if (c.t) cls.push('tapped'); if (o.mine) cls.push('mine'); if (c.att) cls.push('att');
  if (o.zone === 'battlefield' && ctrl === S.pid && !c.att && S.selected.has(c.iid)) cls.push('selected');
  let inner;
  if (c.fd) {
    inner = UI.cardBackHTML('', appearanceBackFor(o.pid)) + (o.mine && def ? `<span class="fdname">${esc(dname(def))}</span>` : '');
  } else {
    const back = c.fl && def && def.imgBack;
    const u = def ? (back ? def.imgBack : def.img) : '';
    const rot = c.fl && def && !def.imgBack ? ' class="rot"' : '';
    inner = IMG_OK(u)
      ? `<img src="${esc(u)}"${rot} alt="${esc(def.name)}" decoding="sync" draggable="false">`
      : `<div class="ph">${esc(def ? (c.fl && def.backName ? def.backName : dname(def)) : '?')}${def && def.pt ? `<br>${esc(def.pt)}` : ''}</div>`;
  }
  let badges = '', ctrs = '';
  for (const [k, v] of Object.entries(c.c || {})) {
    if (!v && k !== 'Loyalty') continue;
    const lbl = k === '+1/+1' ? `+${v}/+${v}` : k === '-1/-1' ? `−${v}/−${v}` : k === 'Loyalty' ? `◆${v}` : `${v} ${k}`;
    ctrs += `<span class="ctr" data-ctr="${esc(k)}" title="${esc(k)} counters — left-click +1, right-click −1">${esc(lbl)}</span>`;
  }
  if (o.zone === 'battlefield' && !c.fd) {
    const pt = effPT(c, def);
    const creature = def && /Creature/.test((c.fl && def.backType) || def.type || '');
    if (pt.text && (pt.modified || creature)) {
      const parts = String(pt.text).split('/');
      const power = parts[0] || '?', toughness = parts[1] || '?';
      const statTitle = 'Click power for +1 or right-click for −1; click toughness for +1 or right-click for −1';
      if (/^-?\d+$/.test(power) && /^-?\d+$/.test(toughness)) {
        badges += `<span class="pt${pt.modified ? ' mod' : ''}" title="${statTitle}${def && def.pt ? ' (printed ' + esc(def.pt) + ')' : ''}"><button type="button" class="pt-stat pt-stat-power" data-pt-stat="power" aria-label="Increase power" title="Power: click +1, right-click −1">${esc(power)}</button><button type="button" class="pt-stat pt-stat-toughness" data-pt-stat="toughness" aria-label="Increase toughness" title="Toughness: click +1, right-click −1">${esc(toughness)}</button></span>`;
      } else {
        badges += `<span class="pt${pt.modified ? ' mod' : ''}" title="Power / toughness${def && def.pt ? ' (printed ' + esc(def.pt) + ')' : ''}">${esc(pt.text)}</span>`;
      }
    }
  }
  // mana cost along the top edge of cards in hand
  let pips = '';
  if (o.zone === 'hand' && o.mine && def && def.mana && !c.fd) {
    const toks = (def.mana.split(' // ')[0].match(/\{[A-Z0-9½∞\/]+\}/g) || []).slice(0, 10);
    if (toks.length) pips = `<div class="pips">${toks.map(t => `<img class="pip" src="https://svgs.scryfall.io/card-symbols/${esc(t.slice(1, -1).replace(/\//g, ''))}.svg" alt="${esc(t)}" draggable="false">`).join('')}</div>`;
  }
  if (o.zone === 'command' && c.cmd) {
    const casts = (ctrl === S.pid ? S.me.casts : ((S.players[ctrl] || {}).casts || {}))[c.iid] || 0;
    if (casts) badges += `<span class="tax" title="Commander tax">+${2 * casts}</span>`;
  }
  const extra = (c.cp ? '<span class="tk cp" title="A copy — it disappears when it leaves the battlefield">TOKEN COPY</span>' : c.tok ? '<span class="tk">TOKEN</span>' : '') +
    (c.own && c.own !== o.pid ? `<span class="own" style="--oc:${colorOf(c.own)}" title="Owned by ${esc(pname(c.own))}">${esc(pname(c.own))}</span>` : '');
  return `<div class="${cls.join(' ')}" data-iid="${esc(c.iid)}" data-pid="${esc(ctrl)}" data-zone="${o.zone}"${o.style ? ` style="${o.style}"` : ''}>${inner}${extra}${pips}${ctrs ? `<div class="ctrs">${ctrs}</div>` : ''}<div class="badges">${badges}</div></div>`;
}

// Every battlefield card on the table, plus which ones are attached to which host.
function buildIndex() {
  const entries = [];
  S.me.zones.battlefield.forEach(c => entries.push({ ctrl: S.pid, c, def: defOf(c) }));
  for (const [pid, p] of Object.entries(S.players)) {
    if (pid === S.pid || !p || !p.zones) continue;
    (p.zones.battlefield || []).forEach(c => entries.push({ ctrl: pid, c, def: c.id ? (p.defs || {})[c.id] : null }));
  }
  const top = new Set(entries.filter(e => !e.c.att).map(e => e.ctrl + '|' + e.c.iid));
  const atts = new Map();
  for (const e of entries) {
    if (!e.c.att) continue;
    const k = e.c.att.p + '|' + e.c.att.i;
    if (!top.has(k)) { e.orphan = true; continue; } // host missing: draw it at its own spot
    if (!atts.has(k)) atts.set(k, []);
    atts.get(k).push(e);
  }
  return { entries, atts };
}
// Auto-fit ("squish"): a board is drawn in a display space DW x DH instead of its stored 1000 x bh, with cards keeping their
// size. Zones and card positions are mapped linearly, so the stored layout never changes (and drops map back, see storedPos).
// Used for opponent miniatures and for the big board in Top / Grid, where it lets cards be as large as the cards fit.
function fitKey(pid, mode) { return mode + ':' + pid; }
function fitSizeFor(pid, mode, bh0) {
  const f = mode && S.fit[fitKey(pid, mode)];
  return f ? { dw: f.dw, dh: Math.max(f.dh, 120) } : { dw: BW, dh: bh0 };
}
function boardHTML(pid, idx, mode) {
  const mine = pid === S.pid;
  const p = mine ? null : S.players[pid];
  const layout = mine ? S.me.layout : (p.layout || DEFAULT_LAYOUT);
  const editing = mine && S.arrange;
  if (editing) mode = null; // arranging zones by hand always shows the real layout
  const tile = mode === 'tile';
  const bh0 = mine ? myBH() : ((p && p.bh) || BH);
  const { dw, dh } = fitSizeFor(pid, mode, bh0);
  const fitted = !!mode && (dw !== BW || dh !== bh0);
  const rx = fitted ? dw / BW : 1, ry = fitted ? dh / bh0 : 1;
  const cx = fitted ? (dw - CW) / (BW - CW) : 1, cy = fitted && bh0 > CH ? Math.max(0.05, (dh - CH) / (bh0 - CH)) : 1;
  let html = layout.map(r => `<div class="region" data-region="${esc(r.k)}" style="left:${Math.round(num(r.x) * rx)}px;top:${Math.round(num(r.y) * ry)}px;width:${Math.round(num(r.w) * rx)}px;height:${Math.round(num(r.h) * ry)}px">
    <span class="rlabel">${esc(r.label)}</span>${editing ? ['nw', 'ne', 'sw', 'se'].map(c => `<span class="grip ${c}" data-c="${c}" title="Drag to resize"></span>`).join('') : ''}</div>`).join('');
  let z = 10;
  const place = (e, zone, x, y, zi) => cardHTML(e.c, e.def, { mine: e.ctrl === S.pid, pid, ctrl: e.ctrl, zone, style: `left:${Math.round(x * cx)}px;top:${Math.round(y * cy)}px;z-index:${zi}` });
  for (const e of idx.entries) {
    if (e.ctrl !== pid || (e.c.att && !e.orphan)) continue;
    const x = num(e.c.x, 10), y = num(e.c.y, 20);
    const list = idx.atts.get(pid + '|' + e.c.iid) || [];
    const up = y >= 22 * list.length; // attachments peek out above the host (or below if there's no room)
    list.forEach((a, k) => { html += place(a, 'battlefield', x, up ? y - 22 * (k + 1) : y + 22 * (k + 1), z + list.length - k); });
    html += place(e, 'battlefield', x, y, z + list.length + 1);
    z += list.length + 2;
  }
  if (tile) html += tileOverlayHTML(pid, dh, dw);
  html += turnNoticeHTML(pid);
  const bw = mode ? dw : BW;
  return `<div class="board${editing ? ' arrange' : ''}${tile ? ' tile-display' : ''}" data-pid="${esc(pid)}"${mode ? ` data-fit="${mode}" data-dw="${dw}" data-dh="${dh}" data-bh0="${bh0}"` : ''} style="width:${bw}px;height:${(mode ? dh : bh0) + (tile ? TILE_STRIP : 0)}px">${html}</div>`;
}
// A point on a fitted board's display space -> where that card's top-left corner belongs in the stored 1000 x bh space.
function storedPos(board, x, y) {
  if (!board || !board.dataset.fit) return { x, y };
  const dw = +board.dataset.dw, dh = +board.dataset.dh, bh0 = +board.dataset.bh0;
  return { x: dw > CW ? x * (BW - CW) / (dw - CW) : x, y: dh > CH ? y * (bh0 - CH) / (dh - CH) : y };
}
// Untouched default zones follow the board's shape in the current view: zones and the cards in them
// spread vertically (cards keep their size), so switching Top / Sidebar / Grid never shrinks the cards.
function stretchAutoLayout(W, H) {
  const m = S.me, bottom = Math.max(...m.layout.map(r => r.y + r.h));
  const target = clamp(Math.round(Math.min(BW * H / W, 800)), BH, BH_MAX);
  if (!bottom || Math.abs(target - bottom) <= 4) return;
  clearUndo(); // old snapshots use the previous board geometry
  const f = target / bottom;
  m.layout.forEach(r => { r.y = Math.round(r.y * f); r.h = Math.round(r.h * f); });
  m.zones.battlefield.forEach(c => { if (c.y != null && !c.att) c.y = clamp(Math.round(c.y * f), 0, target - CH); });
  m.bh = 0;
  saveSoon(); publish(); setTimeout(render, 0);
}
// Auto-fit sizing: the largest cards that still fit this many cards in the area (never smaller than the natural scale).
function computeFit(W, H, N, bh0, mode, extra) {
  const sNat = Math.min(W / BW, H / (bh0 + extra));
  const capPx = mode === 'tile' ? 56 : 150;
  const sOcc = Math.sqrt(0.5 * W * H / (Math.max(N, 6) * CW * CH * 0.6)); // allow ~40% overlap when crowded
  let s = Math.max(sNat, Math.min(sOcc, capPx / CW));
  const dhMin = CH * (mode === 'tile' ? 2.8 : 2.4); // keep ~2-3 rows of cards, so boards never look flattened
  let dh = Math.max(H / s - extra, dhMin);
  s = Math.min(s, H / (dh + extra));
  dh = Math.max(H / s - extra, dhMin);
  return { dw: Math.round(clamp(W / s, CW * 3, 3000)), dh: Math.round(dh) };
}
function fitBoards() {
  document.querySelectorAll('.boardwrap').forEach(w => {
    const b = w.firstElementChild; if (!b) return;
    const W = w.clientWidth, H = w.clientHeight; if (!W || !H) return;
    const thumb = w.classList.contains('thumb'), pid = thumb ? w.dataset.board.slice(6) : w.dataset.board;
    const mode = b.dataset.fit || null;
    if (!mode && pid === S.pid && !thumb && S.me && S.me.layoutAuto && !S.arrange && !S.dragging) stretchAutoLayout(W, H);
    const bh = pid === S.pid && S.me ? (thumb || mode ? myBH() : myBoardHeight(W, H)) : ((S.players[pid] && S.players[pid].bh) || BH);
    let dw = BW, dh = bh;
    const extra = mode === 'tile' ? TILE_STRIP : 0;
    if (mode) { // size the board to this area; redraw if the chosen size changed
      const bf = pid === S.pid ? S.me.zones.battlefield : ((S.players[pid] && S.players[pid].zones.battlefield) || []);
      const want = computeFit(W, H, bf.length, bh, mode, extra), key = fitKey(pid, mode), cur = S.fit[key];
      if (!cur || Math.abs(cur.dw - want.dw) > 8 || Math.abs(cur.dh - want.dh) > 8) { S.fit[key] = want; setTimeout(render, 0); }
      dw = num(b.dataset.dw, BW); dh = num(b.dataset.dh, bh);
    }
    const tot = dh + extra;
    b.style.width = dw + 'px'; b.style.height = tot + 'px';
    // Boards always fit their area (never scroll); hold V to magnify cards instead.
    const s = Math.min(W / dw, H / tot);
    const ox = Math.max(0, (W - dw * s) / 2);
    b.style.transform = `translate(${ox}px,0) scale(${s})`;
    b.dataset.s = s; b.dataset.ox = ox; b.dataset.oy = 0;
    b.style.setProperty('--inv', (1 / s).toFixed(3)); // lets labels stay a readable size at any zoom
    b.style.setProperty('--s', s.toFixed(4));
    b.style.setProperty('--bw', dw + 'px');
  });
  fitOppArea();
  refreshTargeting();
}
// Opponents' boards keep their shape, so a tall opponents' area just leaves blank space under
// them. Shrink that area to what the boards actually need (never more than the user's splitter).
function fitOppArea() {
  return; // opponent tiles fit any height now
  const table = $('#table');
  if (!table || table.classList.contains('noopps') || !table.classList.contains('view-top') || !S.split) return;
  const th = table.clientHeight; if (!th) return;
  let need = 0;
  document.querySelectorAll('#opps .opp:not(.mini)').forEach(el => {
    const wrap = el.querySelector('.boardwrap'); if (!wrap || !wrap.clientWidth) return;
    const p = S.players[wrap.dataset.board];
    const head = el.querySelector('.ohead'), hand = el.querySelector('.ohand');
    need = Math.max(need, (head ? head.offsetHeight : 34) + (hand ? hand.offsetHeight : 0) + wrap.clientWidth / BW * ((p && p.bh) || BH) + 12);
  });
  if (!need) return;
  const frac = clamp(Math.min(S.split, (need + 14) / th), 0.12, 0.8);
  if (Math.abs(frac - (S.effSplit || 0)) < 0.004) return;
  S.effSplit = frac;
  table.style.setProperty('--top', (frac * 100) + 'fr');
  table.style.setProperty('--bot', ((1 - frac) * 100) + 'fr');
}
// My board is as tall as my screen allows (so zones can use all the space), but never
// shorter than what's already on it. Changes are published so opponents see the same shape.
function myBoardHeight(W, H) {
  const m = S.me;
  let ext = 0;
  m.layout.forEach(r => { ext = Math.max(ext, r.y + r.h); });
  m.zones.battlefield.forEach(c => { if (c.y != null) ext = Math.max(ext, c.y + CH); });
  // A tall/narrow window shouldn't make my board so tall that everyone else sees it tiny:
  // screen shape can stretch it to at most SCREEN_BH_CAP (dragging zones lower still can).
  const SCREEN_BH_CAP = 800;
  const bh = clamp(Math.round(Math.max(Math.min(BW * H / W, SCREEN_BH_CAP), ext, BH)), BH, BH_MAX);
  if (Math.abs(bh - (m.bh || 0)) > 2) { m.bh = bh; publish(); saveSoon(); }
  return m.bh;
}
// Library / graveyard / exile info for any player: counts, top card, permanents, hover breakdown.
function pileInfo(pid) {
  const mine = pid === S.pid;
  const p = mine ? null : S.players[pid];
  const z = mine ? S.me.zones : (p.zones || {});
  const defs = mine ? S.me.defs : (p.defs || {});
  const gy = z.graveyard || [], ex = z.exile || [];
  const out = {
    library: { n: mine ? z.library.length : num(p.lib), top: mine ? (topIsRevealed(S.me) && z.library[0]) : (p.revTop && p.revTop[0]), label: 'Library' },
    graveyard: { n: gy.length, top: gy[gy.length - 1], tc: typeCounts(gy, defs), label: 'Graveyard' },
    exile: { n: ex.length, top: ex[ex.length - 1], tc: typeCounts(ex, defs), label: 'Exile' }
  };
  for (const k of PILE_ZONES) {
    const d = out[k];
    let tip = `${d.label}: ${plural(d.n, 'card')}`;
    if (d.tc && d.n) {
      tip += `\n${d.tc.perm} permanent${d.tc.perm === 1 ? '' : 's'} · ${d.n - d.tc.perm} non-permanent${d.n - d.tc.perm === 1 ? '' : 's'}`;
      const parts = CARD_TYPES.filter(t => d.tc.types[t]).map(t => `${t === 'Sorcery' ? 'Sorceries' : t + 's'} ${d.tc.types[t]}`);
      if (parts.length) tip += '\n' + parts.join(' · ');
    }
    d.tip = tip;
    d.face = d.top ? cardFace(d.top, defs, pid) : (k === 'library' && d.n ? UI.cardBackHTML('', appearanceBackFor(pid)) : '');
  }
  return out;
}
// My bottom-right zones: Draw/Untap, LIB, GY, EXILE, CMD (with clickable commander tax).
function myZonesHTML() {
  const pi = pileInfo(S.pid), me = S.me;
  const box = (k, label, sub) => `<div class="zbox" data-pile="${k}" data-pid="${esc(S.pid)}" data-drop="${k}" title="${esc(pi[k].tip)}">
      <div class="zlabel${k === 'library' ? ' zlabel-lib' : ''}">${label} <b class="${k === 'library' && pi[k].n === 0 ? 'lib-empty' : ''}">${pi[k].n}</b>${sub ? ` <span class="zsub">${sub}</span>` : ''}</div><div class="zcard">${pi[k].face}</div></div>`;
  const cmd = me.zones.command;
  const taxIid = (cmd[0] && cmd[0].iid) || (me.cmdrs[0] && me.cmdrs[0].iid) || '';
  const tax = taxIid ? 2 * (me.casts[taxIid] || 0) : 0;
  // Auto-Draw lives beside LIB; Auto-Untap and turn actions live in the top toolbar.
  const auto = (key, on, what) => `<label class="tgl" title="Auto: ${what} at the start of your turn (${on ? 'on' : 'off'})"><input type="checkbox" data-a="${key}"${on ? ' checked' : ''}><span></span></label>`;
  return box('library', 'LIB') + box('graveyard', 'GY', pi.graveyard.n ? `${pi.graveyard.tc.perm}P` : '') + box('exile', 'EXILE') +
    `<div class="zbox cmdbox" data-drop="command">
      <div class="cmdhead">
        <div class="zlabel">CMD</div>
        ${taxIid ? `<div class="taxchip" data-a="tax" data-iid="${esc(taxIid)}" title="Commander tax — left-click +2, right-click −2">🪙 <b>${tax}</b></div>` : ''}
      </div>
      <div class="zcard cmdcards">${cmd.map(c => cardHTML(c, defOf(c), { mine: true, pid: S.pid, zone: 'command' })).join('')}</div></div>`;
}
// Life box + expandable counters panel (EDHPlay style). Mine is editable; opponents' life +/- sends a request.
// The ▾ menu: commander damage (grouped by player, in their colour) and the other player counters.
function ctrPanelHTML(pid) {
  const mine = pid === S.pid;
  const p = mine ? null : S.players[pid];
  const vals = mine ? Object.assign({ Poison: S.me.poison }, S.me.ctr) : Object.assign({ Poison: p.poison }, p.ctr || {});
  const rows = Object.keys(PLAYER_CTR_ICONS).map(k => `<div class="ctrrow${k === 'Poison' && (vals[k] || 0) >= 10 ? ' lethal' : ''}"><span class="ci">${PLAYER_CTR_ICONS[k]}</span><span class="cn">${k}</span><b>${vals[k] || 0}</b>` +
    (mine ? `<button data-a="pctr" data-k="${k}" data-d="-1">−</button><button data-a="pctr" data-k="${k}" data-d="1">+</button>` : '<span></span><span></span>') + '</div>').join('');
  const cdPanel = cmdDmgPanelHTML(pid);
  return `<div class="ctrpanel">${cdPanel}${cdPanel ? '<div class="ctrsep"></div>' : ''}${rows}</div>`;
}
function lifeBoxHTML(pid, noPanel) {
  const mine = pid === S.pid;
  const p = mine ? null : S.players[pid];
  const life = mine ? S.me.life : p.life;
  const open = mine ? S.ctrOpen === S.pid : S.ctrOpen === pid;
  const a = mine ? 'life' : 'olife';
  const vals = mine ? Object.assign({ Poison: S.me.poison }, S.me.ctr) : Object.assign({ Poison: p.poison }, p.ctr || {});
  const any = Object.keys(PLAYER_CTR_ICONS).filter(k => vals[k]).map(k => `${PLAYER_CTR_ICONS[k]}${vals[k]}`).join(' ');
  const cd = cmdDmgInfo(pid);
  const cdBadge = cd.max ? `<span class="cdbadge${cd.max >= 21 ? ' lethal' : ''}" title="Highest commander damage taken">⚔${cd.max}</span> ` : '';
  return `<span class="lifebox" title="Life${mine ? ' (Shift-click: ±5)' : ` — changing it asks ${esc(p.name)}'s game to apply it`}">
      <button class="life-adjust" type="button" data-a="${a}" data-pid="${esc(pid)}" data-d="-1" aria-label="Decrease life total">−</button><button class="lifeN life-edit" type="button" data-a="setlife" data-pid="${esc(pid)}" title="Click to set life total directly" aria-label="Set life total">${life}</button><button class="life-adjust" type="button" data-a="${a}" data-pid="${esc(pid)}" data-d="1" aria-label="Increase life total">+</button>
      <button class="more" data-a="ctrs" data-pid="${esc(pid)}" title="Commander damage, poison, energy, experience, rad, tickets">${cdBadge}${any ? esc(any) + ' ' : ''}▾</button></span>` +
    (open && !noPanel ? ctrPanelHTML(pid) : '');
}
// Opponent miniatures can't hold the menu (their tile clips it), so it floats next to the tile instead.
function renderOppPanel() {
  let el = document.getElementById('oppPanel');
  const pid = S.ctrOpen;
  const tile = !pid ? null : (pid === S.pid ? document.querySelector('#opps .opp.mytile') : (S.players[pid] ? document.querySelector(`#opps .opp.tile[data-opp="${CSS.escape(pid)}"]`) : null));
  if (!tile) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'oppPanel'; $('#game').appendChild(el); }
  const r = tile.getBoundingClientRect();
  el.innerHTML = ctrPanelHTML(pid);
  const pw = 270;
  el.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + 8)) + 'px';
  el.style.top = Math.min(innerHeight - 40, r.top + 34) + 'px';
}
// Commander damage `victim` has taken from each other player's commander(s), grouped by player (colored in the life menu).
function cmdDmgInfo(victim) {
  const vMine = victim === S.pid;
  const dmg = vMine ? S.me.cmdDmg : ((S.players[victim] || {}).cmdDmg || {});
  const sources = ((S.table && S.table.seats) || []).filter(p => p !== victim && (p === S.pid ? S.me.cmdrs.length : S.players[p]));
  const groups = []; let max = 0;
  for (const src of sources) {
    const cmdrs = src === S.pid ? S.me.cmdrs : (S.players[src].cmdrs || []);
    const rows = cmdrs.map(cm => {
      const key = src + ':' + cm.iid, v = dmg[key] || 0;
      max = Math.max(max, v);
      return { key, name: cm.name, v, can: vMine || src === S.pid }; // I track my own damage, and can deal damage with my commander
    });
    if (rows.length) groups.push({ src, rows });
  }
  return { groups, max };
}
function cmdDmgPanelHTML(victim) {
  const { groups } = cmdDmgInfo(victim);
  return groups.map(g => `<div class="cdgroup" style="--tc:${colorOf(g.src)}"><div class="cdghead">${esc(pname(g.src))}</div>` + g.rows.map(r =>
    `<div class="ctrrow cdrow${r.v >= 21 ? ' lethal' : ''}"><span class="cn" title="${esc(r.name)}">${esc(r.name)}</span><b>${r.v}</b>` +
    (r.can ? `<button data-a="cdmg" data-k="${esc(r.key)}" data-pid="${esc(victim)}" data-d="-1">−</button><button data-a="cdmg" data-k="${esc(r.key)}" data-pid="${esc(victim)}" data-d="1">+</button>` : '<span></span><span></span>') +
    '</div>').join('') + '</div>').join('');
}
function pileHTML(zone, cards, defs, o, extraTop) {
  const n = cards.length;
  let top = '';
  if (zone === 'library') top = extraTop ? cardFace(extraTop, defs, o.pid) : (n ? UI.cardBackHTML('', appearanceBackFor(o.pid)) : '');
  else if (n) top = cardFace(cards[n - 1], defs, o.pid);
  const lbl = { library: 'Library', graveyard: 'Graveyard', exile: 'Exile' }[zone];
  return `<div class="pile" data-pile="${zone}" data-pid="${esc(o.pid)}"${o.mine ? ` data-drop="${zone}"` : ''} title="${lbl}">
    <div class="pcard">${top}</div><div class="plabel">${lbl} <b>${n}</b></div></div>`;
}
function cardFace(c, defs, pid = S.pid) {
  const d = c.id && defs[c.id];
  if (c.fd || !d) return UI.cardBackHTML('', appearanceBackFor(pid));
  return IMG_OK(d.img) ? `<img src="${esc(d.img)}" alt="" decoding="sync" draggable="false" data-pvid="${esc(d.id)}">` : `<div class="ph">${esc(dname(d))}</div>`;
}

function renderTop() {
  const T = S.table;
  const responseBtn = $('#responseBtn');
  if (responseBtn) responseBtn.disabled = !T || !T.started || !T.seats.includes(S.pid) || !!T.out[S.pid]
    || boardTransferLock || (S.role !== 'solo' && S.net.state !== 'online');
  $('#roomBtn').textContent = S.role === 'solo' ? 'SOLO' : (S.room || '');
  $('#roomBtn').disabled = S.role === 'solo';
  const pill = $('#netPill');
  const st = S.role === 'solo' ? 'online' : S.net.state;
  pill.className = 'pill ' + st;
  pill.textContent = S.role === 'solo' ? 'Practice' : ({ online: 'Connected', connecting: 'Connecting…', reconnecting: 'Reconnecting…', offline: 'Offline', error: 'Error' }[st] || st);
  pill.title = S.net.text || '';
  let html;
  const rule = T ? CTMulligan.normalizeMode(T.openingMode) : 'london';
  const ruleControl = T && !T.started ? (S.role === 'client'
    ? `<span class="muted ct-opening-rule" title="${esc(openingModeName(rule))}">${esc(openingModeShort(rule))}</span>`
    : `<button class="ct-opening-rule" data-a="openingrule" title="Change opening-hand rule">Opening: ${esc(openingModeShort(rule))}</button>`)
    : '';
  if (!T) html = `<span class="muted">${esc(S.net.text || 'Connecting to the host…')}</span>`;
  else if (!T.started) {
    const pending = openingPending(T);
    const readiness = pending.length
      ? `<span class="muted" title="Every seated player must keep a hand from this deal">Waiting for ${esc(pending.map(pname).join(', '))} to keep</span>`
      : '<span class="muted">Everyone has kept</span>';
    html = `${ruleControl}<span class="muted">Not started · ${plural(T.seats.length, 'player')} seated</span> ${readiness}` +
      (S.role !== 'client' ? ` <button class="primary" data-a="start" title="Uses the rolled order, or randomizes if you have not rolled"${pending.length ? ' disabled' : ''}>Start game</button>` : ' <span class="muted">— waiting for the host to start</span>');
  } else if (!T.active) {
    html = `${ruleControl}<span class="muted">No active player · everyone has conceded</span>`;
  } else {
    const mine = T.active === S.pid;
    html = `${ruleControl}<span>Round <b>${T.turn}</b> · <b style="color:${colorOf(T.active)}">${esc(mine ? 'Your' : pname(T.active) + "'s")}</b> turn</span>`;
  }
  $('#turnBox').innerHTML = html;
  updateChatButton();
  const turnActions = $('#turnActions');
  if (turnActions) {
    const autoUntap = `<label class="tgl" title="Auto: Untap everything at the start of your turn (${S.me.autoUntap ? 'on' : 'off'})"><input type="checkbox" data-a="autountap"${S.me.autoUntap ? ' checked' : ''}><span></span></label>`;
    const autoDraw = `<span class="ad-label" title="Auto-Draw: automatically draws a card at the start of your turn">Auto-Draw</span><label class="tgl" title="Auto: Draw a card at the start of your turn (${S.me.autoDraw ? 'on' : 'off'})"><input type="checkbox" data-a="autodraw"${S.me.autoDraw ? ' checked' : ''}><span></span></label>`;
    turnActions.innerHTML = `<div class="turn-actions"><div class="ztool"><button data-a="untapall" title="Untap all (U)">Untap All</button>${autoUntap}${autoDraw}</div>${passBtn()}</div>`;
  }
  const banner = $('#banner');
  if (S.role === 'client' && S.net.state !== 'online') {
    banner.textContent = `${S.net.text || 'Reconnecting to the host…'} Your cards are saved — keep playing, it will catch up.`;
    banner.classList.remove('hidden');
  } else if (S.role === 'host' && S.net.state !== 'online' && S.net.state !== 'connecting') {
    banner.textContent = S.net.text || 'Reconnecting…';
    banner.classList.remove('hidden');
  } else banner.classList.add('hidden');
}

function oppPids() {
  const T = S.table;
  if (!T) return [];
  const base = T.started && T.order.length ? T.order.concat(T.seats.filter(p => !T.order.includes(p))) : T.seats;
  const i = base.indexOf(S.pid);
  const rot = i >= 0 ? base.slice(i + 1).concat(base.slice(0, i)) : base;
  return rot.filter(p => p !== S.pid && S.players[p]);
}
function renderOpps(idx) {
  const box = $('#opps');
  const pids = oppPids();
  const view = curView();
  if (S.focus && !pids.includes(S.focus)) S.focus = null;
  box.className = 'n' + pids.length;
  const tbl = $('#table');
  tbl.classList.toggle('noopps', !pids.length);
  // Focus reuses sidebar geometry but follows the active player into the large slot.
  ['top', 'side', 'grid'].forEach(v => tbl.classList.toggle('view-' + v, v === view));
  document.body.classList.toggle('view-side', view === 'side');
  document.body.classList.toggle('view-grid', view === 'grid');
  tbl.dataset.n = pids.length;
  tbl.classList.toggle('has-focus', !!S.focus);
  document.querySelectorAll('.viewsw [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (S.view || 'side')));
  // keep one stable element per opponent
  const have = new Map([...box.children].filter(el => !el.classList.contains('mytile')).map(el => [el.dataset.opp, el]));
  pids.forEach((pid, i) => {
    let el = have.get(pid);
    if (!el) {
      el = document.createElement('div'); el.className = 'opp'; el.dataset.opp = pid;
      el.innerHTML = '<div class="ohead"></div><div class="obody"><div class="obf"></div></div>';
    }
    const oldStrip = el.querySelector('.ohand'); if (oldStrip) oldStrip.remove(); // (bottom hand strip retired)
    if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
    have.delete(pid);
    renderOpp(el, pid, idx);
  });
  have.forEach(el => el.remove());
  // Sidebar / Focus layouts: a "YOU" tile heads the list, so you can always get back to your own board.
  const sideLike = view === 'side' || (view === 'top' && !!S.focus); // Top shows my YOU tile only while I'm viewing someone else
  let you = box.querySelector('.youtile');
  if (sideLike && pids.length) {
    if (!you) { you = document.createElement('div'); you.className = 'opp youtile'; you.innerHTML = '<div class="ohead"></div><div class="obody"><div class="obf"></div></div>'; }
    if (box.firstElementChild !== you) box.insertBefore(you, box.firstElementChild);
    renderYouTile(you, idx);
  } else if (you) you.remove();
  // Grid: my own quadrant, drawn like the opponents' tiles
  let mt = box.querySelector('.mytile');
  tbl.classList.toggle('grid-mine', gridMine());
  if (gridMine()) {
    if (!mt) { mt = document.createElement('div'); mt.className = 'opp tile mytile'; mt.innerHTML = '<div class="ohead"></div><div class="obody"><div class="obf"></div></div>'; box.appendChild(mt); }
    else if (box.lastElementChild !== mt) box.appendChild(mt);
    renderMyTile(mt, idx);
  } else if (mt) mt.remove();
  // rows in the right-hand column: everyone not shown in the big area (+ the YOU tile)
  tbl.style.setProperty('--rows', Math.max(1, (sideLike && pids.length ? 1 : 0) + pids.length - (S.focus ? 1 : 0)));
  tbl.style.setProperty('--cols', Math.max(1, (sideLike && pids.length ? 1 : 0) + pids.length - (S.focus ? 1 : 0)));
}
// The YOU tile: a read-only miniature of my board while I'm looking at someone else's; just a label otherwise.
function renderYouTile(el, idx) {
  const viewingMe = !S.focus, T = S.table || {};
  el.classList.toggle('viewing', viewingMe);
  el.classList.toggle('active', T.active === S.pid);
  el.querySelector('.ohead').innerHTML = `<span class="dot" style="--pc:${colorOf(S.pid)}"></span><span class="pname">${esc(S.me.name)}</span><span class="tag you">YOU</span>
    ${T.active === S.pid ? '<span class="tag">TURN</span>' : ''}<span class="life-ro">♥ <b>${S.me.life}</b></span>`;
  // Keep separate arrow anchors while stripping gameplay ids from this read-only miniature.
  el.querySelector('.obf').innerHTML = viewingMe ? '<div class="viewing-note">👁 Viewing your board</div>'
    : `<div class="boardwrap thumb" data-board="thumb:${esc(S.pid)}">${boardHTML(S.pid, idx).replace(/ data-(iid|pid|zone|region|c)="([^"]*)"/g, (attr, key, value) =>
        ['iid', 'pid', 'zone'].includes(key) ? ` data-arrow-${key}="${value}"` : '')}</div>`;
}
// Grid: my own quadrant is drawn exactly like the opponents' miniatures (hand fan, piles and life drawn inside the scaled board).
function gridMine() { return !!S.me && curView() === 'grid' && !S.arrange && !S.focus && oppPids().length > 0; }
// The player whose board is shown big (Sidebar / Focus / Grid) when it isn't mine; null when I'm looking at my own.
// Top and Grid draw the big board auto-fitted (bigger cards in the space available); Sidebar shows the real layout.
function bigMode() { return S.arrange ? null : (['top', 'grid'].includes(curView()) ? 'big' : null); }
function viewedOpp() {
  if (!S.focus || S.focus === S.pid) return null;
  return S.players[S.focus] ? S.focus : null;
}
// Their hand + piles, drawn in the same bottom strip as mine (same markup, read-only): hand face-down unless revealed.
function revealedHandSlots(cards, handN, shown) {
  const slots = new Map(), total = Math.max(0, Math.floor(num(handN))), n = Math.max(0, Math.floor(num(shown)));
  if (!n || !total) return slots;
  // Miniature board fans show at most 12 cards, so map a real hand index to its nearest visible slot.
  // Larger, full-size hand strips render every card and keep the exact index.
  for (const c of (Array.isArray(cards) ? cards : []).slice().sort((a, b) => num(a.hIndex) - num(b.hIndex))) {
    if (!Number.isInteger(c.hIndex) || c.hIndex < 0 || c.hIndex >= total) continue;
    let i = total > n ? Math.round(c.hIndex * (n - 1) / Math.max(1, total - 1)) : c.hIndex;
    i = clamp(i, 0, n - 1);
    // Two revealed cards can map to the same miniature slot for very large hands; keep both visible if space allows.
    if (slots.has(i)) {
      let found = -1;
      for (let d = 1; d < n; d++) {
        if (i - d >= 0 && !slots.has(i - d)) { found = i - d; break; }
        if (i + d < n && !slots.has(i + d)) { found = i + d; break; }
      }
      if (found < 0) continue;
      i = found;
    }
    slots.set(i, c);
  }
  return slots;
}
function oppHandHTML(pid) {
  const p = S.players[pid], defs = p.defs || {};
  const revealed = !!(p.revHand && p.revHand.length);
  const revCards = revealed ? [] : (Array.isArray(p.revCards) ? p.revCards : []);
  const handN = Math.min(60, Math.max(0, Math.floor(num(p.hand))));
  const n = revealed ? p.revHand.length : (revCards.length ? handN : Math.min(handN, 14));
  const mid = (n - 1) / 2, step = n > 1 ? Math.min(3, 28 / n) : 0;
  const fan = i => { const off = i - mid; return `--rot:${(off * step).toFixed(2)}deg;--arc:${(mid ? 12 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}`; };
  const revealedAt = revealedHandSlots(revCards, handN, n);
  const backAt = i => `<div class="card oback" style="${fan(i)}">${UI.cardBackHTML('', appearanceBackFor(pid))}</div>`;
  return revealed
    ? p.revHand.map((c, i) => cardHTML(c, c.id && defs[c.id], { mine: false, pid, ctrl: pid, zone: 'hand', style: fan(i) })).join('')
    : revCards.length
      ? Array.from({ length: n }, (_, i) => {
          const c = revealedAt.get(i);
          return c ? cardHTML(c, c.id && defs[c.id], { mine: false, pid, ctrl: pid, zone: 'hand', style: fan(i) }) : backAt(i);
        }).join('')
      : Array.from({ length: n }, (_, i) => backAt(i)).join('');
}
function oppZonesHTML(pid) {
  const p = S.players[pid], defs = p.defs || {}, pi = pileInfo(pid);
  const box = (k, label, sub) => `<div class="zbox" data-pile="${k}" data-pid="${esc(pid)}" title="${esc(pi[k].tip)}${k === 'library' ? '' : ' — click to search'}">
      <div class="zlabel">${label} <b class="${k === 'library' && pi[k].n === 0 ? 'lib-empty' : ''}">${pi[k].n}</b>${sub ? ` <span class="zsub">${sub}</span>` : ''}</div><div class="zcard">${pi[k].face}</div></div>`;
  const cmd = (p.zones.command || []).map(c => cardHTML(c, c.id && defs[c.id], { mine: false, pid, ctrl: pid, zone: 'command' })).join('');
  return box('library', 'LIB') + box('graveyard', 'GY', pi.graveyard.n ? `${pi.graveyard.tc.perm}P` : '') + box('exile', 'EXILE') +
    `<div class="zbox cmdbox"><div class="zlabel">CMD</div><div class="zcard cmdcards">${cmd}</div></div>`;
}

// Opponent miniature (Sidebar / Grid): life and commander damage top-left, their hand + piles in a strip under the
// board, all drawn inside the scaled board so the tile looks like their real board (EDHPlay style).
// Spacing between hand cards in a miniature strip so the fan uses the free width between the hand and the piles.
function handSpread(n, bw) {
  const cw = 66, avail = bw - 16 - (cw * 4 + 30) - 24;
  if (n < 2) return 0;
  const step = clamp((avail - cw) / (n - 1), 20, cw * 1.05);
  return Math.round(step - cw);
}
function myTileOverlayHTML(bh, bw) {
  const m = S.me, z = m.zones, pi = pileInfo(S.pid);
  const n = z.hand.length, mid = (n - 1) / 2, step = n > 1 ? Math.min(4, 30 / n) : 0;
  const fan = i => { const off = i - mid; return `--rot:${(off * step).toFixed(1)}deg;--arc:${(mid ? 8 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}`; };
  const hand = z.hand.map((c, i) => cardHTML(c, defOf(c), { mine: true, pid: S.pid, zone: 'hand', style: fan(i) })).join('');
  const pile = (k, label) => `<div class="tpile" data-pile="${k}" data-pid="${esc(S.pid)}" data-drop="${k}" title="${esc(pi[k].tip)}"><div class="tpcard">${pi[k].face || ''}</div><div class="tplabel">${label} <b class="${k === 'library' && pi[k].n === 0 ? 'lib-empty' : ''}">${pi[k].n}</b></div></div>`;
  const cmd = z.command.map(c => cardHTML(c, defOf(c), { mine: true, pid: S.pid, zone: 'command' })).join('');
  return `<div class="tlife">${lifeBoxHTML(S.pid, true)}</div>
    <div class="tstrip" style="top:${bh}px;width:${bw}px"><div class="thand mine" data-drop="hand" style="--hm:${handSpread(n, bw)}px">${hand}${n ? `<b class="thn">${n}</b>` : ''}</div>
      <div class="tpiles">${pile('library', 'LIB')}${pile('graveyard', 'GY')}${pile('exile', 'EXILE')}<div class="tpile tcmd" data-drop="command"><div class="tpcard">${cmd}</div><div class="tplabel">CMD</div></div></div></div>`;
}
function renderMyTile(el, idx) {
  const T = S.table || {}, m = S.me;
  el.classList.toggle('active', T.active === S.pid);
  setHTML(el.querySelector('.ohead'), `<span class="dot" style="--pc:${colorOf(S.pid)}"></span><span class="pname" data-phead="${esc(S.pid)}" title="Right-click for options">${esc(m.name)}</span><span class="tag you">YOU</span>
    ${T.active === S.pid ? '<span class="tag">TURN</span>' : ''}${T.monarch === S.pid ? '<span title="Monarch">👑</span>' : ''}${T.initiative === S.pid ? '<span title="Initiative">🏰</span>' : ''}`);
  el.querySelector('.obf').removeAttribute('style');
  setHTML(el.querySelector('.obf'), `<div class="boardwrap tile" data-board="${esc(S.pid)}" style="${esc(appearanceBoardStyleFor(S.pid))}">${boardHTML(S.pid, idx, 'tile')}</div>`);
}
function tileOverlayHTML(pid, bh, bw) {
  if (pid === S.pid) return myTileOverlayHTML(bh, bw);
  const p = S.players[pid], defs = p.defs || {}, pi = pileInfo(pid);
  const revealed = !!(p.revHand && p.revHand.length);
  const revCards = revealed ? [] : (Array.isArray(p.revCards) ? p.revCards : []);
  const handN = Math.max(0, Math.floor(num(p.hand))), n = revealed ? p.revHand.length : Math.min(handN, 12);
  const mid = (n - 1) / 2, step = n > 1 ? Math.min(4, 30 / n) : 0;
  const fan = i => { const off = i - mid; return `--rot:${(off * step).toFixed(1)}deg;--arc:${(mid ? 8 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}`; };
  const revealedAt = revealedHandSlots(revCards, handN, n);
  const backAt = i => `<div class="card oback" style="${fan(i)}">${UI.cardBackHTML('', appearanceBackFor(pid))}</div>`;
  const hand = revealed
    ? p.revHand.map((c, i) => cardHTML(c, c.id && defs[c.id], { mine: false, pid, ctrl: pid, zone: 'hand', style: fan(i) })).join('')
    : revCards.length
      ? Array.from({ length: n }, (_, i) => {
          const c = revealedAt.get(i);
          return c ? cardHTML(c, c.id && defs[c.id], { mine: false, pid, ctrl: pid, zone: 'hand', style: fan(i) }) : backAt(i);
        }).join('')
      : Array.from({ length: n }, (_, i) => backAt(i)).join('');
  const pile = (k, label) => `<div class="tpile"${k === 'library' ? ` data-fx="library" data-pid="${esc(pid)}"` : ''}><div class="tpcard">${pi[k].face || ''}</div><div class="tplabel">${label} <b class="${k === 'library' && pi[k].n === 0 ? 'lib-empty' : ''}">${pi[k].n}</b></div></div>`;
  const cmd = (p.zones.command || []).map(c => cardHTML(c, c.id && defs[c.id], { mine: false, pid, ctrl: pid, zone: 'command' })).join('');
  return `<div class="tlife">${lifeBoxHTML(pid, true)}</div>
    <div class="tstrip" style="top:${bh}px;width:${bw}px"><div class="thand" style="--hm:${handSpread(n, bw)}px">${hand}${handN ? `<b class="thn">${handN}</b>` : ''}</div>
      <div class="tpiles">${pile('library', 'LIB')}${pile('graveyard', 'GY')}${pile('exile', 'EXILE')}<div class="tpile tcmd"><div class="tpcard">${cmd}</div><div class="tplabel">CMD</div></div></div></div>`;
}
function renderOpp(el, pid, idx) {
  const p = S.players[pid], T = S.table || {}, defs = p.defs || {};
  const o = { mine: false, pid };
  el.classList.toggle('active', T.active === pid);
  const off = S.role !== 'solo' && S.online[pid] === false;
  el.classList.toggle('offline', off);
  el.classList.toggle('out', !!(T.out && T.out[pid]));
  el.classList.toggle('focus', S.focus === pid);
  const tile = S.focus !== pid;
  el.classList.toggle('tile', tile);
  if (tile) {
    setHTML(el.querySelector('.ohead'), `<span class="dot" style="--pc:${colorOf(pid)}"></span><span class="pname" data-phead="${esc(pid)}" title="Right-click for options">${esc(p.name)}</span>
      ${off ? '<span class="tag off">RECONNECTING</span>' : ''}${T.out && T.out[pid] ? '<span class="tag off">OUT</span>' : ''}${T.active === pid ? '<span class="tag">TURN</span>' : ''}${T.monarch === pid ? '<span title="Monarch">👑</span>' : ''}${T.initiative === pid ? '<span title="Initiative">🏰</span>' : ''}`);
    el.querySelector('.obf').removeAttribute('style');
    setHTML(el.querySelector('.obf'), `<div class="boardwrap tile" data-board="${esc(pid)}" style="${esc(appearanceBoardStyleFor(pid))}">${boardHTML(pid, idx, 'tile')}</div>`);
    return;
  }
  const pi = pileInfo(pid);
  const oz = (k, label, sub) => `<span class="oz" data-pile="${k}" data-pid="${esc(pid)}" title="${esc(pi[k].tip)}${k === 'library' ? '' : ' — click to search'}">${label} <b class="${k === 'library' && pi[k].n === 0 ? 'lib-empty' : ''}">${pi[k].n}</b>${sub ? ` <span class="zsub">${sub}</span>` : ''}</span>`;
  const cmdCards = (p.zones.command || []).map(c => cardHTML(c, c.id && defs[c.id], Object.assign({}, o, { zone: 'command' }))).join('');
  // Their hand mirrors Reveal my hand to everyone, but can also expose selected cards only.
  const revealed = !!(p.revHand && p.revHand.length);
  const revCards = revealed ? [] : (Array.isArray(p.revCards) ? p.revCards : []);
  const handN = num(p.hand);
  const shown = revealed ? p.revHand.length : (revCards.length ? Math.min(Math.max(0, handN), 60) : Math.min(handN, 10));
  const mid = (shown - 1) / 2, step = shown > 1 ? Math.min(6, 40 / shown) : 0;
  const fan = i => { const off = i - mid; return `--rot:${(off * step).toFixed(1)}deg;--arc:${(mid ? 3 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}`; };
  const backAt = i => `<div class="card oback" style="${fan(i)}">${UI.cardBackHTML('', appearanceBackFor(pid))}</div>`;
  const revealedAt = new Map(revCards.map(c => [c.hIndex, c]));
  const handCards = revealed
    ? p.revHand.map((c, i) => cardHTML(c, c.id && defs[c.id], Object.assign({}, o, { zone: 'hand', style: fan(i) }))).join('')
    : revCards.length
      ? Array.from({ length: shown }, (_, i) => {
          const c = revealedAt.get(i);
          return c ? cardHTML(c, c.id && defs[c.id], Object.assign({}, o, { zone: 'hand', style: fan(i) })) : backAt(i);
        }).join('')
      : Array.from({ length: shown }, (_, i) => backAt(i)).join('');
  const handTitle = revealed ? ' (revealed — hover to read)' : revCards.length ? ` (${revCards.length} card${revCards.length === 1 ? '' : 's'} revealed — hover to read)` : '';
  const handHTML = `<span class="ohhand${revealed ? ' revealed' : revCards.length ? ' partial-reveal' : ''}${handN ? '' : ' empty'}" title="${esc(p.name)} has ${plural(handN, 'card')} in hand${handTitle}">${handCards}<b class="ohn">${handN}</b></span>`;
  setHTML(el.querySelector('.ohead'), `${curView() === 'grid' ? '<button data-a="viewme" title="Back to my board">← My board</button>' : ''}<span class="dot" style="--pc:${colorOf(pid)}"></span>
    <span class="pname" data-phead="${esc(pid)}" title="Right-click for options">${esc(p.name)}</span>
    ${off ? '<span class="tag off">RECONNECTING</span>' : ''}${T.out && T.out[pid] ? '<span class="tag off">OUT</span>' : ''}
    ${T.active === pid ? '<span class="tag">TURN</span>' : ''}${T.monarch === pid ? '<span title="Monarch">👑</span>' : ''}${T.initiative === pid ? '<span title="Initiative">🏰</span>' : ''}
    ${lifeBoxHTML(pid)}
    <span class="ozones">${oz('library', 'LIB')}${oz('graveyard', 'GY', pi.graveyard.n ? pi.graveyard.tc.perm + 'P' : '')}${oz('exile', 'EX')}</span>
    ${handHTML}
    ${cmdCards ? `<span class="ocmd" title="Command zone">${cmdCards}</span>` : ''}
    ${!p.kept ? '<span class="muted small">mulliganing…</span>' : ''}`);
  const focusedZones = '';
  el.querySelector('.obf').style.cssText = appearanceBoardStyleFor(pid);
  setHTML(el.querySelector('.obf'), `<div class="boardwrap" data-board="${esc(pid)}">${boardHTML(pid, idx, bigMode())}</div>${focusedZones}`);
}

function renderMine(idx) {
  const m = S.me, z = m.zones, T = S.table || {};
  const o = { mine: true, pid: S.pid };
  $('#mine').classList.toggle('active', T.active === S.pid);
  // --- bar: name, life box (+ counters panel), colored commander-damage tags, actions
  $('#myBar').innerHTML = `<span class="dot" style="--pc:${colorOf(S.pid)}"></span><span class="pname" data-phead="${esc(S.pid)}" title="Right-click for options">${esc(m.name)}</span>
    ${T.monarch === S.pid ? '<span title="Monarch">👑</span>' : ''}${T.initiative === S.pid ? '<span title="Initiative">🏰</span>' : ''}
    ${lifeBoxHTML(S.pid)}
    ${S.arrange ? `<span class="mb-actions"><button data-a="tidy" title="Put every card back into its zone">Tidy cards</button><button data-a="resetzones">Reset zones</button>
      <button data-a="arrange" class="primary" title="Finish moving and resizing your zones">✓ Done arranging</button></span>` : ''}`;
  // --- battlefield, hand, bottom-right zones
  $('#myBf').style.cssText = appearanceBoardStyleFor(S.pid); // art continues behind the hand / piles strip
  setHTML($('#myBf'), `<div class="boardwrap" data-board="${esc(S.pid)}">${boardHTML(S.pid, idx, bigMode())}</div>`);
  // fan the hand: each card tilts a little away from the middle and dips on a gentle arc (CSS uses --rot / --arc)
  const nh = z.hand.length, mid = (nh - 1) / 2, step = nh > 1 ? Math.min(3, 28 / nh) : 0;
  const vo = viewedOpp();
  $('#myRow').classList.toggle('viewing-opp', !!vo);
  if (vo) $('#myHand').removeAttribute('data-drop'); else $('#myHand').setAttribute('data-drop', 'hand');
  setHTML($('#myHand'), vo ? oppHandHTML(vo) : z.hand.map((c, i) => {
    const off = i - mid;
    return cardHTML(c, defOf(c), Object.assign({}, o, { zone: 'hand',
      // arc is normalised so the outermost cards dip at most ~12px however big the hand is
      style: `--rot:${(off * step).toFixed(2)}deg;--arc:${(mid ? 12 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}` }));
  }).join(''));
  if (S.handHov) { const hc = [...$('#myHand').children].find(c => c.dataset.iid === S.handHov); if (hc) hc.classList.add('hov'); } // keep the lifted card up across re-renders
  const hn = vo ? $('#myHand').children.length : z.hand.length;
  $('#handLabel').innerHTML = vo ? `${esc(S.players[vo].name)} · HAND <b>${num(S.players[vo].hand)}</b>${S.players[vo].revHand && S.players[vo].revHand.length ? ' · REVEALED' : (S.players[vo].revCards || []).length ? ` · ${S.players[vo].revCards.length} REVEALED` : ''}` : `HAND <b>${z.hand.length}</b>`;
  $('#myHand').style.setProperty('--n', Math.max(1, hn)); // CSS overlaps cards so the hand never scrolls
  setHTML($('#myZones'), vo ? oppZonesHTML(vo) : myZonesHTML());
  const mb = $('#mullBar');
  if (!m.kept) {
    const mode = (S.table && S.table.openingMode) || 'london';
    const lands = CTMulligan.landCount(z.hand, m.defs);
    const possibleLands = lands + CTMulligan.landCount(z.library, m.defs);
    const grants = (S.table && S.table.openingAllowances && S.table.openingAllowances[S.pid]) || 0;
    const limit = openingMulliganLimit(S.pid);
    const landBlocked = !CTMulligan.canKeep(mode, lands, possibleLands, m.mull, grants);
    const bottom = CTMulligan.bottomCount(mode, m.mull, z.hand.length);
    const keepLabel = bottom ? `Keep ${z.hand.length} (bottom ${bottom})` : `Keep ${z.hand.length}`;
    const next = mode === 'london'
      ? (m.mull === 0 ? 'first mulligan is free' : `bottom ${Math.max(0, m.mull - 1)} after keeping`)
      : mode === 'three-lands' ? `${lands}/3 lands${possibleLands < 3 ? ' · fewer than 3 in deck' : m.mull >= limit && lands < 3 ? ' · limit reached, keep allowed' : ''}`
        : `bottom ${Math.min(3, Math.max(0, z.hand.length - 1))} after keeping`;
    mb.innerHTML = `<b>Opening hand</b> <button class="primary" data-a="keep"${landBlocked ? ' disabled' : ''}>${keepLabel}</button>
      <button data-a="mull"${!CTMulligan.canMulligan(m.mull, mode, grants) ? ' disabled' : ''}>Mulligan (${m.mull}/${limit})</button><span class="muted small">${next}</span>`;
    mb.classList.remove('hidden');
    positionMulliganBar();
  } else mb.classList.add('hidden');
}
function positionMulliganBar() {
  const mb = $('#mullBar'), hand = $('#handWrap');
  if (!mb || mb.classList.contains('hidden') || !hand) return;
  const r = hand.getBoundingClientRect();
  mb.style.top = Math.max(8, r.top - 26 - mb.offsetHeight) + 'px';
}

let logLen = -1, logLast = null;
function renderLog() {
  const box = $('#log');
  const last = S.log[S.log.length - 1] || null;
  if (logLen === S.log.length && logLast === last && box.childElementCount) return;
  logLen = S.log.length; logLast = last;
  const atTop = box.scrollTop < 40;
  box.innerHTML = S.log.slice(-200).reverse().map((e, i) => {
    const li = S.log.length - 1 - i;
    const time = new Date(e.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const text = esc(e.text).replace(/\{(\d)\}/g, (m0, n) => {
      const c = e.cards && e.cards[+n];
      return c ? `<span class="cref" data-li="${li}" data-ci="${n}">${esc(c.name)}</span>` : '';
    });
    return e.pid ? `<div class="le"><span class="ts">${time}</span><b style="color:${colorOf(e.pid)}">${esc(e.name)}</b> ${text}</div>`
      : `<div class="le sys"><span class="ts">${time}</span>${text}</div>`;
  }).join('');
  if (atTop) box.scrollTop = 0;
}

function chatSoundEnabled() { return !!LS.get('ct.chatSound', false); }
let chatAudioContext = null;
let chatLastChimeAt = 0;
let chatButtonPulseTimer = null;
let chatPanelGlowTimer = null;
function prepareChatAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    if (!chatAudioContext) chatAudioContext = new AudioContextClass();
    if (chatAudioContext.state === 'suspended') chatAudioContext.resume().catch(() => {});
  } catch (e) { /* Audio is optional; never interrupt game play. */ }
}
function updateChatSoundToggle() {
  const btn = $('#chatSoundToggle');
  if (!btn) return;
  const enabled = chatSoundEnabled();
  btn.textContent = enabled ? '🔊 Sound on' : '🔇 Sound off';
  btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  btn.setAttribute('aria-label', enabled ? 'Mute chat notification sound' : 'Enable chat notification sound');
  btn.title = enabled ? 'Mute chat notification sound' : 'Enable chat notification sound';
}
function toggleChatSound() {
  const enabled = !chatSoundEnabled();
  LS.set('ct.chatSound', enabled);
  updateChatSoundToggle();
  if (enabled) prepareChatAudio();
}
function playChatChime() {
  if (!chatSoundEnabled() || !chatAudioContext) return;
  const ctx = chatAudioContext;
  const play = () => {
    if (!chatSoundEnabled() || ctx.state !== 'running' || Date.now() - chatLastChimeAt < 900) return;
    chatLastChimeAt = Date.now();
    const start = ctx.currentTime;
    [[880, 0], [1174.66, 0.12]].forEach(([frequency, offset]) => {
      const tone = ctx.createOscillator(), volume = ctx.createGain(), at = start + offset;
      tone.type = 'sine';
      tone.frequency.setValueAtTime(frequency, at);
      volume.gain.setValueAtTime(0.0001, at);
      volume.gain.exponentialRampToValueAtTime(0.045, at + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      tone.connect(volume); volume.connect(ctx.destination);
      tone.start(at); tone.stop(at + 0.19);
    });
  };
  if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {});
  else play();
}
function pulseChatButton() {
  const btn = $('#chatBtn');
  if (!btn) return;
  clearTimeout(chatButtonPulseTimer);
  btn.classList.remove('ct-chat-pulse');
  void btn.offsetWidth;
  btn.classList.add('ct-chat-pulse');
  chatButtonPulseTimer = setTimeout(() => btn.classList.remove('ct-chat-pulse'), 1350);
}
function pulseChatPanel() {
  const panel = $('#chatPanel');
  if (!panel || !S.chatOpen) return;
  if (window.CTChatPanel) CTChatPanel.wake(false);
  clearTimeout(chatPanelGlowTimer);
  panel.classList.remove('ct-chat-new-message');
  void panel.offsetWidth;
  panel.classList.add('ct-chat-new-message');
  chatPanelGlowTimer = setTimeout(() => panel.classList.remove('ct-chat-new-message'), 1450);
}
function updateChatButton() {
  const btn = $('#chatBtn'), badge = $('#chatUnread');
  if (!btn || !badge) return;
  const count = Math.max(0, S.chatUnread || 0);
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.classList.toggle('hidden', !count || S.chatOpen);
  btn.classList.toggle('has-unread', !!count && !S.chatOpen);
  btn.setAttribute('aria-expanded', S.chatOpen ? 'true' : 'false');
  btn.disabled = S.role === 'solo';
  btn.title = S.role === 'solo' ? 'Room chat is available in a shared game' : (S.chatOpen ? 'Close room chat' : 'Open room chat');
  updateChatSoundToggle();
}
function renderChatHistory(forceBottom, highlightEntry) {
  const box = $('#chatHistory');
  if (!box) return;
  const pinned = !!forceBottom || box.scrollHeight - box.scrollTop - box.clientHeight < 48;
  box.innerHTML = S.chat.slice(-100).map(e => {
    const time = new Date(e.ts || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const who = e.pid === S.pid ? 'You' : (e.name || 'Player');
    const highlight = e === highlightEntry ? ' is-new' : '';
    return '<div class="ct-chat-entry' + highlight + '"><div class="ct-chat-entry-head"><strong style="color:' + colorOf(e.pid) + '">' + esc(who) + '</strong><span class="ct-chat-entry-time">' + esc(time) + '</span></div><div class="ct-chat-entry-text">' + esc(e.text) + '</div></div>';
  }).join('') || '<div class="ct-chat-empty">No messages yet. Say hello to your table.</div>';
  if (pinned) requestAnimationFrame(() => { if (box.isConnected) box.scrollTop = box.scrollHeight; });
  updateChatButton();
}
function setChatPanelOpen(open) {
  S.chatOpen = !!open && S.role !== 'solo';
  if (S.chatOpen) S.chatUnread = 0;
  const panel = $('#chatPanel');
  if (panel) panel.classList.toggle('hidden', !S.chatOpen);
  if (window.CTChatPanel) CTChatPanel.setOpen(S.chatOpen);
  updateChatButton();
  if (S.chatOpen) {
    renderChatHistory(true);
    const input = $('#chatInput');
    if (input) input.focus();
  }
}
function showChatPopup(e) {
  const container = $('#chatPopups');
  if (!container || S.chatOpen || e.pid === S.pid) return;
  const popup = document.createElement('div');
  popup.className = 'ct-chat-popup';
  const who = document.createElement('strong');
  who.className = 'ct-chat-popup-name';
  who.textContent = e.name || 'Player';
  who.style.color = colorOf(e.pid);
  const message = document.createElement('span');
  message.className = 'ct-chat-popup-text';
  message.textContent = e.text;
  popup.append(who, message);
  container.appendChild(popup);
  while (container.children.length > 3) container.firstElementChild.remove();
  setTimeout(() => {
    if (!popup.isConnected) return;
    popup.classList.add('is-leaving');
    setTimeout(() => popup.remove(), 380);
  }, 4200);
}
function sendChatFromForm(e) {
  e.preventDefault();
  const input = $('#chatInput');
  if (!input) return;
  if (sendChat(input.value)) { input.value = ''; input.focus(); }
}

// --- preview panel
// Floating preview: follows the cursor while you hover a card; hidden while dragging / magnifying.
let pvMouse = { x: 0, y: 0 };
function placePv() {
  const pv = $('#pv'); if (!pv || pv.classList.contains('hidden')) return;
  const w = pv.offsetWidth, h = pv.offsetHeight, gap = 18, m = 8;
  if (S.pvFix) { // a card in my hand: show the preview in a fixed spot just above the hand so it never covers the other hand cards
    const hr = S.pvFix.getBoundingClientRect();
    const fx = clamp(hr.left + 8, m, Math.max(m, innerWidth - w - m)), fy = clamp(hr.top - h - 10, m, Math.max(m, innerHeight - h - m));
    pv.style.transform = `translate(${Math.round(fx)}px,${Math.round(fy)}px)`;
    return;
  }
  let x = pvMouse.x + gap;
  if (x + w > innerWidth - m) x = pvMouse.x - gap - w;            // flip to the left of the cursor
  x = clamp(x, m, Math.max(m, innerWidth - w - m));
  const y = clamp(pvMouse.y - h / 2, m, Math.max(m, innerHeight - h - m));
  pv.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
}
function hidePreview() { const pv = $('#pv'); if (pv) pv.classList.add('hidden'); }
function preview(def, hidden, tag) {
  const pv = $('#pv');
  if (!def || !pv) return;
  pv.classList.remove('hidden');
  setTimeout(placePv, 0);
  if (hidden) { pv.innerHTML = `<div class="pv-imgs">${UI.cardBackHTML()}</div><div class="pv-tag">Face-down card</div>` + (S.touchMode && S.touchPreview ? `<button class="ct-touch-actions" type="button" data-touch-actions="${esc(S.touchPreview.iid)}">Actions</button>` : ''); return; }
  const imgs = [def.img, def.imgBack].filter(IMG_OK);
  // The card image carries its own text; only show text when there's no image (or a COPY / attached tag).
  pv.innerHTML = (imgs.length
    ? `<div class="pv-imgs ${imgs.length > 1 ? 'two' : ''}">${imgs.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>`
    : `<div class="pv-txt"><b>${esc(def.name || '')}</b>${def.mana ? ' ' + esc(def.mana) : ''}${def.type ? `<br><span class="muted">${esc(def.type)}</span>` : ''}${def.oracle ? `<br>${esc(def.oracle)}` : ''}${def.pt ? `<br><b>${esc(def.pt)}</b>` : ''}</div>`) +
    (tag ? `<div class="pv-tag"><span class="tag ${tag === 'Copy' ? 'cp' : ''}">${esc(tag.toUpperCase())}</span></div>` : '') +
    (S.touchMode && S.touchPreview ? `<button class="ct-touch-actions" type="button" data-touch-actions="${esc(S.touchPreview.iid)}">Actions</button>` : '');
}
const tagOf = c => (c.cp ? 'Copy' : c.tok ? 'Token' : '');
function previewFromEl(cardEl) {
  const pid = cardEl.dataset.pid, iid = cardEl.dataset.iid;
  // Anonymous card backs in an opponent's hand have no identity to preview.
  // Hide the previous card's preview instead of leaving it stuck over the hand.
  if (!pid || !iid) {
    S.hover = null;
    S.touchPreview = null;
    S.pvFix = null;
    hidePreview();
    return;
  }
  S.hover = { pid, iid };
  S.touchPreview = S.touchMode ? { pid, iid } : null;
  S.pvFix = pid === S.pid && cardEl.dataset.zone === 'hand' ? (cardEl.closest('#myHand, .thand') || null) : null;
  if (pid === S.pid) {
    const f = findCard(iid);
    if (f) {
      let tag = tagOf(f.card);
      if (f.card.att) { const h = hostInfo(f.card.att.p, f.card.att.i); if (h) tag = (tag ? tag + ' · ' : '') + 'attached to ' + dname(h.def); }
      preview(defOf(f.card), false, tag);
    }
    return;
  }
  const f = oppCard(pid, iid);
  if (f) preview(f.def || { name: 'Face-down card' }, !f.def, tagOf(f.c));
}

// =====================================================================
//  Shared targeting arrows (transient public visuals, outside saved game state)
// =====================================================================
let arrowFrame = 0, lastArrowPickAt = 0, arrowSerial = 0, lastArrowPaint = 0;
function arrowSeats() { return (S.table && S.table.seats) || []; }
function startTargeting(from) {
  if (!S.me || !S.table) return;
  if (S.role !== 'solo' && S.net.state !== 'online') { UI.toast('Reconnect before drawing an arrow.', { kind: 'warn' }); return; }
  if (S.arrange) { UI.toast('Finish arranging zones before drawing an arrow.'); return; }
  doPublish(); // solo and host validation must see freshly played cards too
  const source = from ? CTTargeting.endpoint(from, S.players, arrowSeats()) : null;
  if (from && !source) return;
  endAttach(); hidePreview(); UI.closeMenu();
  if (S.targetArrows.length >= CTTargeting.MAX_ARROWS) { UI.toast('Clear some arrows before adding more.'); return; }
  S.arrowControlsDismissed = false;
  S.arrowPick = { from: source };
  refreshTargeting();
}
function endTargeting() { S.arrowPick = null; refreshTargeting(); }
function hideTargetingControls() { S.arrowControlsDismissed = true; endTargeting(); }
function showTargetingControls() { S.arrowControlsDismissed = false; refreshTargeting(); }
function clearTargetArrows() {
  if (S.role !== 'solo' && S.net.state !== 'online') { UI.toast('Reconnect before clearing shared arrows.', { kind: 'warn' }); return; }
  toHost({ t: 'arrows', k: 'clear' });
  endTargeting();
}
function removeTargetArrow(id) {
  if (S.role !== 'solo' && S.net.state !== 'online') { UI.toast('Reconnect before removing a shared arrow.', { kind: 'warn' }); return; }
  S.dragEndAt = Date.now(); // a double-click must not activate a card underneath the removed line
  lastArrowPickAt = Date.now();
  toHost({ t: 'arrows', k: 'remove', id });
}
function handleArrowRemoval(e) {
  if (S.arrowPick || (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ')) return false;
  const item = e.target.closest('[data-arrow-id]');
  if (!item) return false;
  e.preventDefault(); e.stopImmediatePropagation();
  removeTargetArrow(item.dataset.arrowId);
  return true;
}
function arrowEndpointAt(target) {
  const card = target.closest('.card');
  if (card) return card.dataset.zone === 'battlefield' ? { kind: 'card', pid: card.dataset.pid, iid: card.dataset.iid } : null;
  const player = target.closest('[data-phead]');
  if (player) return { kind: 'player', pid: player.dataset.phead };
  if (target.closest('[data-pile], .tstrip, .thand, .tpile, #myRow, .lifebox, button, input, textarea, .rlabel, .grip')) return null;
  const board = target.closest('.board'), wrap = target.closest('.boardwrap');
  const pid = board && board.dataset.pid || (wrap && wrap.firstElementChild && wrap.firstElementChild.dataset.pid);
  if (pid) return { kind: 'player', pid };
  const opp = target.closest('.obf');
  if (opp) {
    const tile = opp.closest('.opp');
    if (tile) return { kind: 'player', pid: tile.dataset.opp || S.pid };
  }
  return target.closest('#myBf') ? { kind: 'player', pid: S.pid } : null;
}
function pickArrowEndpoint(target) {
  const raw = arrowEndpointAt(target);
  doPublish();
  const ep = CTTargeting.endpoint(raw, S.players, arrowSeats());
  if (!ep) { UI.toast('Choose a battlefield card, empty battlefield space, or a player’s name.'); return; }
  if (!S.arrowPick.from) { S.arrowPick.from = ep; refreshTargeting(); return; }
  if (CTTargeting.same(S.arrowPick.from, ep)) { UI.toast('Choose a different target.'); return; }
  const from = CTTargeting.endpoint(S.arrowPick.from, S.players, arrowSeats());
  if (!from) { endTargeting(); UI.toast('The starting card or player is no longer available.'); return; }
  lastArrowPickAt = Date.now();
  endTargeting();
  if (S.role !== 'solo' && S.net.state !== 'online') { UI.toast('Connection lost. Draw the arrow again after reconnecting.', { kind: 'warn' }); return; }
  toHost({ t: 'arrows', k: 'add', arrow: { from, to: ep } });
}
function arrowAnchor(ep) {
  // A player/card may appear twice (large board and miniature). Choose the largest visible copy.
  const nodes = ep.kind === 'card' ? document.querySelectorAll('#game .board .card[data-zone="battlefield"], #game .board .card[data-arrow-zone="battlefield"]')
    : document.querySelectorAll('#game .boardwrap');
  let best = null;
  nodes.forEach(el => {
    const match = ep.kind === 'card'
      ? (el.dataset.pid === ep.pid && el.dataset.iid === ep.iid) || (el.dataset.arrowPid === ep.pid && el.dataset.arrowIid === ep.iid)
      : el.firstElementChild && (el.firstElementChild.dataset.pid === ep.pid || el.firstElementChild.dataset.arrowPid === ep.pid);
    if (!match || getComputedStyle(el).visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return;
    if (!best || r.width * r.height > best.width * best.height) best = r;
  });
  if (ep.kind === 'player') {
    // Player arrows land inside the board, independent of where it was clicked.
    if (best) return { left: best.left + best.width / 2 - 6, top: best.top + best.height / 2 - 6, width: 12, height: 12 };
    const name = [...document.querySelectorAll('#game [data-phead]')].find(el => el.dataset.phead === ep.pid && el.getBoundingClientRect().width);
    return name ? name.getBoundingClientRect() : null;
  }
  return best;
}
function refreshTargeting() {
  S.targetArrows = CTTargeting.cleanList(S.targetArrows, S.players, arrowSeats());
  const active = S.me && !$('#game').classList.contains('hidden');
  const picking = active && !!S.arrowPick;
  document.body.classList.toggle('ct-arrow-picking', !!picking);
  let controls = $('#ct-arrow-controls');
  if (active && (picking || (S.targetArrows.length && !S.arrowControlsDismissed))) {
    if (!controls) {
      controls = document.createElement('div'); controls.id = 'ct-arrow-controls';
      controls.innerHTML = '<span role="status"></span><button type="button" data-arrow-clear></button><button type="button" data-arrow-dismiss aria-label="Hide arrow controls" title="Hide controls without removing arrows; reopen from the table menu">×</button>';
      controls.querySelector('[data-arrow-clear]').addEventListener('click', () => S.arrowPick ? endTargeting() : clearTargetArrows());
      controls.querySelector('[data-arrow-dismiss]').addEventListener('click', hideTargetingControls);
      $('#game').appendChild(controls);
    }
    controls.querySelector('span').textContent = picking
      ? (S.arrowPick.from ? 'Choose a target card, empty board, or name.' : 'Choose a starting card, empty board, or name.')
      : `${S.targetArrows.length} targeting arrow${S.targetArrows.length === 1 ? '' : 's'} · click a line to remove it`;
    controls.querySelector('[data-arrow-clear]').textContent = picking ? 'Cancel' : 'Clear all';
  } else if (controls) controls.remove();
  if (!active || !S.targetArrows.length) {
    if (arrowFrame) cancelAnimationFrame(arrowFrame);
    arrowFrame = 0;
    const svg = $('#ct-target-arrow'); if (svg) svg.remove();
    return;
  }
  if (!arrowFrame) arrowFrame = requestAnimationFrame(drawTargetArrows);
}
function drawTargetArrows(time) {
  arrowFrame = 0;
  if (!S.me || !S.targetArrows.length || $('#game').classList.contains('hidden')) return;
  // One shared painter, capped near 30fps, with endpoint rectangles reused within each frame.
  if (time - lastArrowPaint < 32) { arrowFrame = requestAnimationFrame(drawTargetArrows); return; }
  lastArrowPaint = time;
  let svg = $('#ct-target-arrow');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'ct-target-arrow'; svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Targeting arrows. Select an arrow to remove it.');
    svg.addEventListener('keydown', handleArrowRemoval);
    $('#game').appendChild(svg);
  }
  const present = new Map([...svg.querySelectorAll('[data-arrow-id]')].map(el => [el.dataset.arrowId, el]));
  const anchors = new Map();
  const anchor = ep => {
    const key = JSON.stringify(ep);
    if (!anchors.has(key)) anchors.set(key, arrowAnchor(ep));
    return anchors.get(key);
  };
  S.targetArrows.forEach((arrow, index) => {
    let item = present.get(arrow.id); present.delete(arrow.id);
    if (!item) {
      item = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      item.dataset.arrowId = arrow.id; item.classList.add('ct-arrow-item'); item.setAttribute('role', 'button'); item.setAttribute('tabindex', '0');
      item.innerHTML = '<title></title><defs><marker viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z"/></marker></defs><line class="ct-arrow-shadow"/><line class="ct-arrow-line"/><circle class="ct-arrow-player-target" r="7"/><line class="ct-arrow-hit"/>';
      const markerId = 'ct-arrow-tip-' + arrow.id;
      item.querySelector('marker').id = markerId;
      item.querySelector('.ct-arrow-line').setAttribute('marker-end', 'url(#' + markerId + ')');
      svg.appendChild(item);
    }
    const label = `Remove targeting arrow ${index + 1} by ${pname(arrow.by)}`;
    item.setAttribute('aria-label', label); item.querySelector('title').textContent = label;
    const a = anchor(arrow.from), b = anchor(arrow.to), coords = a && b && CTTargeting.line(a, b);
    item.style.display = coords ? '' : 'none';
    if (coords) {
      item.style.color = colorOf(arrow.by);
      item.querySelector('marker path').setAttribute('fill', colorOf(arrow.by));
      const dot = item.querySelector('circle');
      dot.style.display = arrow.to.kind === 'player' ? '' : 'none';
      dot.setAttribute('cx', b.left + b.width / 2); dot.setAttribute('cy', b.top + b.height / 2);
      item.querySelectorAll('line').forEach(el => Object.entries(coords).forEach(([k, v]) => el.setAttribute(k, v.toFixed(1))));
    }
  });
  present.forEach(el => el.remove());
  arrowFrame = requestAnimationFrame(drawTargetArrows);
}

// =====================================================================
//  Events
// =====================================================================
let drag = null; // a card being dragged with the pointer
let selectionDrag = null; // a temporary selection rectangle
function bindGame() {
  const g = $('#game');
  for (const type of ['pointerdown', 'click', 'dblclick', 'contextmenu']) g.addEventListener(type, e => {
    if (boardTransferLock && !e.target.closest('#chatPanel, #chatBtn')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  // Picking is handled before normal clicks/drags, including touch inspection and life buttons.
  g.addEventListener('pointerdown', e => {
    if (e.target.closest('#chatPanel, #chatBtn')) return;
    if (!S.arrowPick && e.target.closest('[data-arrow-id]')) { e.stopImmediatePropagation(); return; }
    if (!S.arrowPick || e.target.closest('#ct-arrow-controls')) return;
    e.stopImmediatePropagation();
  }, true);
  g.addEventListener('click', e => {
    if (e.target.closest('#chatPanel, #chatBtn')) return;
    if (handleArrowRemoval(e)) return;
    if (!S.arrowPick || e.target.closest('#ct-arrow-controls')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    pickArrowEndpoint(e.target);
  }, true);
  g.addEventListener('dblclick', e => {
    if (e.target.closest('#chatPanel, #chatBtn')) return;
    if (S.arrowPick || Date.now() - lastArrowPickAt < 400) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  if (window.CTChatPanel) CTChatPanel.init();
  const chatBtn = $('#chatBtn'), chatClose = $('#chatClose'), chatForm = $('#chatForm'), chatSoundToggle = $('#chatSoundToggle');
  if (chatBtn) chatBtn.addEventListener('click', e => { e.stopPropagation(); if (S.chatOpen && window.CTChatPanel && CTChatPanel.isFaded()) CTChatPanel.wake(true); else setChatPanelOpen(!S.chatOpen); });
  if (chatClose) chatClose.addEventListener('click', () => { setChatPanelOpen(false); if (chatBtn) chatBtn.focus(); });
  if (chatForm) chatForm.addEventListener('submit', sendChatFromForm);
  if (chatSoundToggle) chatSoundToggle.addEventListener('click', toggleChatSound);
  document.addEventListener('pointerdown', function unlockSavedChatSound() {
    if (!chatSoundEnabled() || (!window.AudioContext && !window.webkitAudioContext)) return;
    prepareChatAudio();
    if (chatAudioContext && chatAudioContext.state === 'running') document.removeEventListener('pointerdown', unlockSavedChatSound);
  });
  window.addEventListener('resize', positionMulliganBar, { passive: true });
  // Native browser text/image dragging can steal pointer gestures from the tabletop's card drag logic.
  g.addEventListener('dragstart', e => {
    if (e.target.closest('.board, .card')) e.preventDefault();
  });
  g.addEventListener('click', e => {
    if (Date.now() - S.dragEndAt < 250) return; // the click that ends a drag
    const t = e.target;
    if (S.attachFrom) {
      const card = t.closest('.board .card');
      const from = S.attachFrom;
      endAttach();
      if (card && card.dataset.zone === 'battlefield') attachTo(from, card.dataset.pid, card.dataset.iid);
      return;
    }
    const btn = t.closest('[data-a]');
    if (btn) { onButton(btn.dataset.a, btn, e); return; }
    if (S.ctrOpen && !t.closest('.ctrpanel')) { S.ctrOpen = null; render(); }
    // Sidebar / Focus layouts: click a player's tile to view their board big (YOU tile = back to mine)
    const tile = t.closest('#opps .opp:not(.focus):not(.mytile)');
    if (tile && !t.closest('button, .life, .lifebox, .oz, [data-pile], .ohhand, .ctrpanel, .cdchip, .ocmd')) {
      const pid = tile.classList.contains('youtile') ? null : tile.dataset.opp;
      if (tile.classList.contains('youtile') && !S.focus) return;
      S.focus = pid; render();
      return;
    }
    const ctr = t.closest('.ctr');
    const card = t.closest('.card');
    if (ctr && card && card.dataset.pid === S.pid) { addCounter(card.dataset.iid, ctr.dataset.ctr, 1); return; }
    const ptStat = t.closest('.badges .pt-stat');
    if (ptStat && card && card.dataset.pid === S.pid) {
      changePT(card.dataset.iid, ptStat.dataset.ptStat === 'power' ? 1 : 0, ptStat.dataset.ptStat === 'toughness' ? 1 : 0);
      return;
    }
    if (card && e.shiftKey && card.dataset.pid === S.pid && card.dataset.zone === 'battlefield') {
      const f = findCard(card.dataset.iid);
      if (f && f.zone === 'battlefield' && !f.card.att) {
        if (S.selected.has(card.dataset.iid)) S.selected.delete(card.dataset.iid);
        else S.selected.add(card.dataset.iid);
        applySelectionClasses(); render();
      }
      return;
    }
    if (t.closest('.ad-control')) return; // Auto-Draw control is inside the clickable Library pile
    const pile = t.closest('[data-pile]');
    if (pile) {
      const { pile: zone, pid } = pile.dataset;
      if (pid === S.pid && zone === 'library') draw(1);
      else if (zone !== 'library') viewZone(pid, zone);
      return;
    }
    if (card && card.dataset.pid === S.pid && card.dataset.zone === 'battlefield') toggleTap(card.dataset.iid);
  });
  g.addEventListener('dblclick', e => {
    const card = e.target.closest('.card');
    if (!card) {
      const opp = e.target.closest('.opp .obf');
      if (opp) toggleFocus(opp.closest('.opp').dataset.opp);
      return;
    }
    if (card.dataset.pid !== S.pid) return;
    const z = card.dataset.zone;
    if (z === 'hand' || z === 'command') doMove(card.dataset.iid, 'battlefield');
  });
  g.addEventListener('contextmenu', e => {
    if (e.target.closest('input,textarea')) return;
    e.preventDefault();
    if (S.arrowPick) { endTargeting(); return; }
    if (S.attachFrom) { endAttach(); return; }
    // right-click = go back one step on tax, counters, P/T and commander damage
    const tax = e.target.closest('[data-a="tax"]');
    if (tax) { changeTax(tax.dataset.iid, -1); return; }
    const tag = e.target.closest('.cdtag[data-a="cdmg"]');
    if (tag) { cmdDmgClick(tag, -1); return; }
    const rcard = e.target.closest('.card');
    const rctr = e.target.closest('.ctrs .ctr');
    if (rctr && rcard && rcard.dataset.pid === S.pid) { addCounter(rcard.dataset.iid, rctr.dataset.ctr, -1); return; }
    const rpt = e.target.closest('.badges .pt-stat');
    if (rpt && rcard && rcard.dataset.pid === S.pid) {
      changePT(rcard.dataset.iid, rpt.dataset.ptStat === 'power' ? -1 : 0, rpt.dataset.ptStat === 'toughness' ? -1 : 0);
      return;
    }
    const card = e.target.closest('.card');
    if (card && card.dataset.pid === S.pid) { cardMenu(e.clientX, e.clientY, card.dataset.iid); return; }
    if (card) { oppCardMenu(e.clientX, e.clientY, card.dataset.pid, card.dataset.iid); return; }
    const pile = e.target.closest('[data-pile]');
    if (pile && pile.dataset.pid === S.pid) { pileMenu(e.clientX, e.clientY, pile.dataset.pile); return; }
    if (pile) { if (pile.dataset.pile !== 'library') viewZone(pile.dataset.pid, pile.dataset.pile); return; }
    const head = e.target.closest('[data-phead]') || e.target.closest('.ohead');
    if (head) { const pid = head.dataset.phead || head.parentElement.dataset.opp; if (pid) playerMenu(e.clientX, e.clientY, pid); return; }
    if (e.target.closest('#myBf')) mainMenu(e.clientX, e.clientY);
  });
  g.addEventListener('mouseover', e => {
    const card = e.target.closest('.card');
    if (S.arrowPick) return;
    if (card && !drag) { previewFromEl(card); return; }
    const ref = e.target.closest('.cref');
    if (ref) { const c = S.log[+ref.dataset.li] && S.log[+ref.dataset.li].cards[+ref.dataset.ci]; if (c) preview(c); return; }
    const pimg = e.target.closest('[data-pvid]');
    if (pimg) {
      const pile = pimg.closest('[data-pile]'); const pid = pile && pile.dataset.pid;
      const d = pid === S.pid ? S.me.defs[pimg.dataset.pvid] : (S.players[pid] && S.players[pid].defs[pimg.dataset.pvid]);
      if (d) preview(d);
    }
  });
  // Which hand card is "up" is decided by where the pointer is across the fan, using each card's resting
  // position (offsetLeft ignores transforms). With :hover, the enlarged card covered the next card's strip,
  // so in a big hand the second card could only be reached by going to the third and back.
  const handEl = $('#myHand');
  const setHov = el => {
    handEl.querySelectorAll('.card.hov').forEach(c => { if (c !== el) c.classList.remove('hov'); });
    if (el) el.classList.add('hov');
    S.handHov = el ? el.dataset.iid : null;
  };
  handEl.addEventListener('pointermove', e => {
    if (drag) return;
    const cards = [...handEl.children].filter(c => c.classList.contains('card'));
    if (!cards.length || !cards[0].offsetParent) return setHov(null);
    const x = e.clientX - cards[0].offsetParent.getBoundingClientRect().left;
    let hit = null;
    for (let i = 0; i < cards.length; i++) {
      const l = cards[i].offsetLeft, r = i + 1 < cards.length ? cards[i + 1].offsetLeft : l + cards[i].offsetWidth;
      if (x >= l && x < r) { hit = cards[i]; break; }
    }
    setHov(hit);
  });
  handEl.addEventListener('pointerleave', () => setHov(null));
  g.addEventListener('mouseout', e => {
    const from = e.target.closest && e.target.closest('.card, .cref, [data-pvid]');
    const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.card, .cref, [data-pvid]');
    if (from && !to) { if (e.target.closest('.card')) S.hover = null; hidePreview(); }
  });
  document.addEventListener('pointermove', e => {
    pvMouse = { x: e.clientX, y: e.clientY };
    // anything that isn't a card (board, hand, log reference, zone viewer tile) hides the preview
    if (!(e.target.closest && e.target.closest('.card, .cref, [data-pvid], [data-iid]'))) hidePreview(); else placePv();
  }, { passive: true });
  document.addEventListener('pointerdown', e => {
    if (S.touchMode && e.target.closest && e.target.closest('#pv')) return;
    hidePreview();
  }, true);
  $('#pv').addEventListener('click', e => {
    const btn = e.target.closest('[data-touch-actions]');
    if (!btn || !S.touchMode || !S.touchPreview) return;
    e.preventDefault(); e.stopPropagation();
    const r = btn.getBoundingClientRect(), target = S.touchPreview;
    hidePreview();
    if (target.pid === S.pid) cardMenu(r.left, r.top, target.iid);
    else oppCardMenu(r.left, r.top, target.pid, target.iid);
  });

  // ---- pointer-driven dragging: cards (anywhere) and zones (arrange mode)
  let touchHoldTimer = null, touchHoldTarget = null, touchHoldFired = false, touchHoldStart = null;
  const clearTouchHold = () => { if (touchHoldTimer) clearTimeout(touchHoldTimer); touchHoldTimer = null; touchHoldTarget = null; touchHoldStart = null; };
  g.addEventListener('pointerdown', e => {
    if (e.button !== 0 || S.attachFrom || S.arrowPick) return;
    if (S.touchMode && e.pointerType === 'touch') {
      const target = e.target.closest('.badges .pt-stat, .card, [data-pile], [data-phead], .ohead, [data-a="tax"], .ctrs .ctr, .badges .pt');
      if (target) {
        clearTouchHold(); touchHoldFired = false; touchHoldTarget = target; touchHoldStart = { x: e.clientX, y: e.clientY };
        const heldTarget = target, heldPoint = touchHoldStart;
        touchHoldTimer = setTimeout(() => {
          touchHoldTimer = null; touchHoldFired = true; drag = null; selectionDrag = null; hidePreview();
          heldTarget.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: heldPoint.x, clientY: heldPoint.y, button: 2, buttons: 0 }));
        }, 550);
      }
    }
    const handle = e.target.closest('.board.arrange .rlabel, .board.arrange .grip');
    if (handle && handle.closest('.board').dataset.pid === S.pid) { startRegionDrag(e, handle); return; }
    // Empty-space drag on my own battlefield starts a selection box, unless we're arranging zones.
    const selectionWrap = e.target.closest('.boardwrap');
    const selectionBoard = selectionWrap && selectionWrap.firstElementChild;
    if (selectionWrap && selectionWrap.dataset.board === S.pid && selectionBoard &&
        selectionBoard.dataset.pid === S.pid && !S.arrange && !selectionBoard.classList.contains('arrange') &&
        !e.target.closest('.card, .bpile, .zbox, .tpile, .tstrip, [data-drop], [data-pile], .rlabel, .grip, button, input, label, .ad-control')) {
      startSelectionDrag(e, selectionWrap);
      return;
    }
    // dragging one of my piles drags its top card (library: top of deck; graveyard/exile: newest)
    if (e.target.closest('.ad-control')) return; // the Auto-Draw switch inside the Library pile isn't a drag handle
    const pile = e.target.closest('.zbox[data-pile], .tpile[data-pile]');
    if (pile) {
      if (pile.dataset.pid !== S.pid) return;
      const list = S.me.zones[pile.dataset.pile] || [];
      const top = pile.dataset.pile === 'library' ? list[0] : list[list.length - 1];
      if (top) drag = { iid: top.iid, el: pile.querySelector('.zcard, .tpcard') || pile, sx: e.clientX, sy: e.clientY, moved: false };
      return;
    }
    const card = e.target.closest('.card');
    if (!card || card.dataset.pid !== S.pid || e.target.closest('.ctr')) return;
    drag = { iid: card.dataset.iid, el: card, sx: e.clientX, sy: e.clientY, moved: false };
  });
  window.addEventListener('pointermove', e => {
    if (touchHoldTimer && touchHoldStart && Math.hypot(e.clientX - touchHoldStart.x, e.clientY - touchHoldStart.y) >= 6) clearTouchHold();
    if (S.regionDrag) { regionMove(e); return; }
    if (selectionDrag) { moveSelectionDrag(e); return; }
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      beginCardDrag(e);
    }
    drag.ghost.style.left = (e.clientX - drag.gx) + 'px';
    drag.ghost.style.top = (e.clientY - drag.gy) + 'px';
    dragHighlight(e);
  });
  window.addEventListener('pointerup', e => {
    if (S.arrowPick) { clearTouchHold(); return; }
    if (touchHoldFired) { touchHoldFired = false; clearTouchHold(); S.dragEndAt = Date.now(); return; }
    clearTouchHold();
    if (S.regionDrag) { regionEnd(); return; }
    if (selectionDrag) { endSelectionDrag(e); return; }
    if (!drag) {
      if (S.touchMode && e.pointerType === 'touch') { const card = e.target.closest && e.target.closest('.card'); if (card) previewFromEl(card); }
      return;
    }
    const d = drag; drag = null;
    if (!d.moved) {
      if (S.touchMode && e.pointerType === 'touch' && d.el && d.el.classList.contains('card')) previewFromEl(d.el);
      return;
    }
    S.dragEndAt = Date.now();
    d.ghost.remove();
    d.el.classList.remove('dragging');
    clearHighlights();
    S.dragging = false;
    try { dropCard(d, e); } finally { render(); }
  });
  window.addEventListener('pointercancel', () => {
    clearTouchHold(); touchHoldFired = false;
    if (selectionDrag) { cancelSelectionDrag(false); return; }
    if (drag && drag.moved) { drag.ghost.remove(); drag.el.classList.remove('dragging'); clearHighlights(); S.dragging = false; render(); }
    drag = null;
    if (S.regionDrag) regionEnd();
  });

  // ---- splitter between opponents and me
  const split = $('#split');
  split.addEventListener('pointerdown', e => {
    e.preventDefault();
    const r = $('#table').getBoundingClientRect();
    const mv = ev => setSplit((ev.clientY - r.top) / r.height);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); LS.set('ct.split3', S.split); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  setSplit(LS.get('ct.split3', 0.47));

  // ---- hand-size splitter (drag up = bigger hand cards)
  const handSplit = $('#handSplit');
  handSplit.addEventListener('pointerdown', e => {
    e.preventDefault();
    handSplit.classList.add('dragging');
    const startY = e.clientY, startW = S.handCw || 82;
    const mv = ev => setHandSize(clamp(startW + (startY - ev.clientY) / 1.396, 56, 240));
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      handSplit.classList.remove('dragging');
      LS.set('ct.handCw', S.handCw);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  handSplit.addEventListener('dblclick', () => { setHandSize(82); LS.set('ct.handCw', S.handCw); });
  setHandSize(LS.get('ct.handCw', 82));
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => fitBoards());
    ro.observe($('#table'));
    ro.observe($('#myBf'));
  }
  window.addEventListener('resize', fitBoards);
  document.addEventListener('keydown', onKey);
}
function setSplit(f) {
  S.split = clamp(+f || 0.42, 0.15, 0.8);
  $('#table').style.setProperty('--top', (S.split * 100) + 'fr');
  $('#table').style.setProperty('--bot', ((1 - S.split) * 100) + 'fr');
  S.effSplit = 0; // let fitOppArea re-shrink from the new splitter position
  fitBoards();
}
function setHandSize(w) {
  S.handCw = Math.round(w);
  $('#myRow').style.setProperty('--cw', S.handCw + 'px');
  fitBoards();
}

function beginCardDrag(e) {
  const el = drag.el;
  const r = el.getBoundingClientRect();
  const board = el.closest('.board');
  const s = board ? (+board.dataset.s || 1) : 1;
  const w = el.offsetWidth * s, h = el.offsetHeight * s;
  // Keep the pointer offset relative to the grabbed card for accurate drop placement.
  drag.offC = { dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
  const f = findCard(drag.iid);
  const requested = S.selected.has(drag.iid) ? [...S.selected] : [drag.iid];
  drag.groupPositions = requested.map(iid => {
    const found = findCard(iid);
    return found && found.zone === 'battlefield' && !found.card.att
      ? { iid, x: num(found.card.x, 10), y: num(found.card.y, 20) } : null;
  }).filter(Boolean);
  if (!drag.groupPositions.some(p => p.iid === drag.iid) && f)
    drag.groupPositions = [{ iid: drag.iid, x: num(f.card.x, 10), y: num(f.card.y, 20) }];

  // When moving a selection, preview every card at its current relative position.
  // Keep the normal single-card/pile ghost for one-card drags.
  let gh = null;
  const groupEls = board && drag.groupPositions.length > 1
    ? drag.groupPositions.map(p => [...board.querySelectorAll('.card[data-iid]')].find(node => node.dataset.iid === p.iid)).filter(Boolean)
    : [];
  if (drag.groupPositions.length > 1 && groupEls.length > 1) {
    const entries = groupEls.map(node => ({ node, rect: node.getBoundingClientRect() }));
    const left = Math.min(...entries.map(x => x.rect.left));
    const top = Math.min(...entries.map(x => x.rect.top));
    const right = Math.max(...entries.map(x => x.rect.right));
    const bottom = Math.max(...entries.map(x => x.rect.bottom));
    gh = document.createElement('div');
    gh.className = 'ct-group-ghost';
    gh.style.cssText = `position:fixed;left:0;top:0;width:${right-left}px;height:${bottom-top}px;`;
    entries.forEach(({ node, rect }, index) => {
      const clone = node.cloneNode(true);
      clone.classList.remove('dragging');
      clone.removeAttribute('style');
      clone.classList.add('drag-preview-card');
      clone.style.setProperty('position', 'absolute', 'important');
      clone.style.setProperty('left', (rect.left - left) + 'px', 'important');
      clone.style.setProperty('top', (rect.top - top) + 'px', 'important');
      clone.style.setProperty('width', rect.width + 'px', 'important');
      clone.style.setProperty('height', rect.height + 'px', 'important');
      clone.style.setProperty('--cw', rect.width + 'px');
      clone.style.setProperty('margin', '0', 'important');
      clone.style.setProperty('transform', 'none', 'important');
      clone.style.setProperty('transition', 'none', 'important');
      clone.style.setProperty('z-index', String(index + 1), 'important');
      clone.style.setProperty('pointer-events', 'none', 'important');
      gh.appendChild(clone);
    });
    document.body.appendChild(gh);
    // Anchor the whole preview at the exact point where the grabbed card was picked up.
    drag.gx = e.clientX - left;
    drag.gy = e.clientY - top;
  } else {
    gh = el.cloneNode(true);
    gh.classList.add('card', 'ghost'); // 'card' too: a pile being dragged ghosts as a card
    gh.removeAttribute('style');
    gh.style.cssText = `width:${w}px;height:${h}px;--cw:${w}px;left:0;top:0;`;
    document.body.appendChild(gh);
    // keep the grab point so the single-card preview follows the pointer naturally
    drag.gx = drag.offC.dx + w / 2; drag.gy = drag.offC.dy + h / 2;
  }
  drag.ghost = gh; drag.moved = true;
  drag.attachable = drag.groupPositions.length === 1 && !!(f && isAttachable(defOf(f.card)));
  el.classList.add('dragging');
  S.dragging = true; uiEpoch++;
  UI.closeMenu && UI.closeMenu();
}
function clearHighlights() { uiEpoch++; document.querySelectorAll('.dropok,.dropattach').forEach(x => x.classList.remove('dropok', 'dropattach')); }
// Convert a screen point to logical board coordinates for one board wrapper.
function boardPoint(wrap, clientX, clientY) {
  const b = wrap.firstElementChild, s = +b.dataset.s || 1, ox = +b.dataset.ox || 0, oy = +b.dataset.oy || 0, rect = wrap.getBoundingClientRect();
  return { x: (clientX - rect.left - ox) / s, y: (clientY - rect.top - oy) / s };
}

function selectionBoxElement() {
  let box = document.getElementById('ct-selection-rectangle');
  if (!box) {
    box = document.createElement('div');
    box.id = 'ct-selection-rectangle';
    box.className = 'ct-selection-rectangle';
    document.body.appendChild(box);
  }
  return box;
}
function pruneSelection() {
  for (const iid of S.selected) {
    const f = findCard(iid);
    if (!f || f.zone !== 'battlefield' || f.card.att) S.selected.delete(iid);
  }
}
function applySelectionClasses() {
  document.querySelectorAll('.board .card[data-iid]').forEach(el => {
    el.classList.toggle('selected',
      el.dataset.pid === S.pid && el.dataset.zone === 'battlefield' && S.selected.has(el.dataset.iid));
  });
}
function startSelectionDrag(e, wrap) {
  e.preventDefault();
  const additive = !!e.shiftKey;
  const base = additive ? new Set(S.selected) : new Set();
  if (!additive) S.selected.clear();
  selectionDrag = { wrap, sx: e.clientX, sy: e.clientY, additive, base, moved: false };
  const box = selectionBoxElement();
  box.style.display = 'none';
  applySelectionClasses();
}
function moveSelectionDrag(e) {
  const d = selectionDrag;
  if (!d) return;
  if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
  d.moved = true;
  const left = Math.min(d.sx, e.clientX), top = Math.min(d.sy, e.clientY);
  const right = Math.max(d.sx, e.clientX), bottom = Math.max(d.sy, e.clientY);
  const box = selectionBoxElement();
  box.style.left = left + 'px';
  box.style.top = top + 'px';
  box.style.width = Math.max(1, right - left) + 'px';
  box.style.height = Math.max(1, bottom - top) + 'px';
  box.style.display = 'block';

  const hits = new Set();
  d.wrap.querySelectorAll('.board .card[data-zone="battlefield"][data-iid]').forEach(el => {
    if (el.dataset.pid !== S.pid) return;
    const f = findCard(el.dataset.iid);
    if (!f || f.zone !== 'battlefield' || f.card.att) return;
    const r = el.getBoundingClientRect();
    if (r.right >= left && r.left <= right && r.bottom >= top && r.top <= bottom) hits.add(el.dataset.iid);
  });
  S.selected.clear();
  d.base.forEach(iid => S.selected.add(iid));
  hits.forEach(iid => S.selected.add(iid));
  applySelectionClasses();
}
function endSelectionDrag(e) {
  const d = selectionDrag;
  if (!d) return;
  if (d.moved) moveSelectionDrag(e);
  else S.selected.clear(); // clicking empty battlefield clears selection
  selectionDrag = null;
  const box = document.getElementById('ct-selection-rectangle');
  if (box) box.style.display = 'none';
  if (d.moved) S.dragEndAt = Date.now(); // suppress the click generated when a drag ends
  applySelectionClasses();
  render();
}
function cancelSelectionDrag(clearSelection = true) {
  const d = selectionDrag;
  selectionDrag = null;
  const box = document.getElementById('ct-selection-rectangle');
  if (box) box.style.display = 'none';
  S.selected.clear();
  if (!clearSelection && d) d.base.forEach(iid => S.selected.add(iid));
  applySelectionClasses();
  render();
}
function moveGroupOnBattlefield(group, dx, dy) {
  const moved = [];
  act(() => {
    const bf = S.me.zones.battlefield;
    for (const p of group) {
      const f = findCard(p.iid);
      if (!f || f.zone !== 'battlefield' || f.card.att) continue;
      f.card.x = clamp(Math.round(p.x + dx), 0, BW - CW);
      f.card.y = clamp(Math.round(p.y + dy), 0, myBH() - CH);
      moved.push(f.card);
    }
    if (!moved.length) return null;
    const ids = new Set(moved.map(c => c.iid));
    S.me.zones.battlefield = bf.filter(c => !ids.has(c.iid)).concat(moved);
    return ['moved ' + moved.length + ' cards together'];
  });
}
function finishGroupZoneMove(results, to) {
  for (const r of results) {
    if (r.orphans && r.orphans.length) orphanToast(r.orphans);
    if (r.card && r.card.cmd && !r.gone && to !== 'command' && to !== 'battlefield' && r.card.own === S.pid) {
      UI.toast(dname(r.def) + ' went to your ' + ZL[to] + '.', {
        ms: 8000, action: { label: 'Move to command zone', onClick: () => doMove(r.card.iid, 'command') }
      });
    }
  }
}
function moveGroupToZone(group, to, opts = {}) {
  const results = [];
  act(() => {
    const order = to === 'library' && opts.pos !== 'bottom' ? [...group].reverse() : group;
    for (const p of order) {
      const r = moveCard(p.iid, to, opts);
      if (r && !r.repos) results.push(r);
    }
    if (!results.length) return null;
    return ['moved ' + results.length + ' cards to ' + (ZL[to] || to)];
  });
  finishGroupZoneMove(results, to);
  if (to === 'battlefield' && results.length) emitCardPlaceSound(results[0].card.iid);
}
function giveControlGroup(group, to, at, anchorIid) {
  if (!canEnterBattlefield()) { UI.toast('Control changes are available after the host starts the game.', { kind: 'warn' }); return; }
  if (!group.length) return;
  const lead = group.find(p => p.iid === anchorIid) || group[0];
  let count = 0;
  const orphaned = [];
  act(() => {
    for (const p of group) {
      const f = findCard(p.iid);
      if (!f) continue;
      const def = defOf(f.card);
      S.me.zones[f.zone].splice(f.idx, 1);
      if (f.zone === 'hand') delete f.card.rvh;
      if (f.zone === 'battlefield') {
        const detached = detachFrom(S.pid, p.iid);
        if (detached.length) orphaned.push(...detached);
      }
      const card = Object.assign({}, f.card);
      delete card.x; delete card.y; card.att = null;
      if (f.zone !== 'battlefield') { card.t = false; card.fd = false; card.fl = false; card.c = {}; }
      const req = { k: 'give', card, def: Deck.slimDef(def) };
      req.x = clamp(Math.round(at.x + p.x - lead.x), 0, BW - CW);
      req.y = clamp(Math.round(at.y + p.y - lead.y), 0, myBH() - CH);
      sendReq(to, req);
      count++;
    }
    return count ? ['gave control of ' + count + ' cards to ' + pname(to)] : null;
  });
  if (orphaned.length) setTimeout(() => orphanToast(orphaned), 0);
}

function dragHighlight(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  let tgt = null, cls = 'dropok';
  if (el) {
    const tcard = el.closest('.board .card');
    const wrap = el.closest('.boardwrap');
    if (drag.attachable && tcard && tcard.dataset.iid !== drag.iid && tcard.dataset.zone === 'battlefield') { tgt = tcard; cls = 'dropattach'; }
    else tgt = el.closest('[data-drop]') || wrap;
  }
  if (tgt && tgt.classList.contains(cls)) return;
  clearHighlights();
  if (tgt) tgt.classList.add(cls);
}
function dropCard(d, e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return;
  const f = findCard(d.iid); if (!f) return;
  if (d.groupPositions && d.groupPositions.length > 1) {
    const wrap = el.closest('.boardwrap');
    const tgt = el.closest('[data-drop]');
    if (tgt && (!wrap || wrap.dataset.board === S.pid)) {
      moveGroupToZone(d.groupPositions, tgt.dataset.drop,
        tgt.dataset.drop === 'library' ? { pos: e.shiftKey ? 'bottom' : 'top' } : {});
      return;
    }
    if (wrap && wrap.dataset.board === S.pid) {
      const pt = boardPoint(wrap, e.clientX - d.offC.dx, e.clientY - d.offC.dy);
      const pos = storedPos(wrap.firstElementChild, pt.x - CW / 2, pt.y - CH / 2);
      const lead = d.groupPositions.find(p => p.iid === d.iid) || d.groupPositions[0];
      moveGroupOnBattlefield(d.groupPositions, pos.x - lead.x, pos.y - lead.y);
      return;
    }
    if (wrap && wrap.dataset.board && wrap.dataset.board !== S.pid && S.players[wrap.dataset.board]) {
      const pt = boardPoint(wrap, e.clientX, e.clientY);
      const pos = storedPos(wrap.firstElementChild, pt.x - CW / 2, pt.y - CH / 2);
      giveControlGroup(d.groupPositions, wrap.dataset.board, pos, d.iid);
      return;
    }
    return;
  }
  const tcard = el.closest('.board .card');
  if (d.attachable && tcard && tcard.dataset.iid !== d.iid && tcard.dataset.zone === 'battlefield') {
    attachTo(d.iid, tcard.dataset.pid, tcard.dataset.iid);
    return;
  }
  // In Grid, the hand and piles are rendered inside the fitted board itself. Check explicit
  // drop targets before the surrounding board wrapper, or a pile drop is mistaken for a
  // battlefield reposition because both elements share the same .boardwrap.
  const tgt = el.closest('[data-drop]');
  if (tgt) {
    const zone = tgt.dataset.drop;
    if (zone === 'hand' && f.zone === 'hand') { reorderHand(d.iid, e.clientX); return; }
    doMove(d.iid, zone, zone === 'library' ? { pos: e.shiftKey ? 'bottom' : 'top' } : {});
    return;
  }
  const wrap = el.closest('.boardwrap');
  if (wrap && wrap.dataset.board === S.pid) {
    const pt = boardPoint(wrap, e.clientX - d.offC.dx, e.clientY - d.offC.dy);
    const sp = storedPos(wrap.firstElementChild, pt.x - CW / 2, pt.y - CH / 2);
    doMove(d.iid, 'battlefield', { x: sp.x, y: sp.y });
    return;
  }
  if (wrap && wrap.dataset.board && wrap.dataset.board !== S.pid && S.players[wrap.dataset.board]) {
    // Dropped on a friend's board: they get control of it, centred where it was dropped. (The grab
    // offset is measured at our own board's zoom, so it doesn't apply to a differently scaled board.)
    const pt = boardPoint(wrap, e.clientX, e.clientY);
    { const sp = storedPos(wrap.firstElementChild, pt.x - CW / 2, pt.y - CH / 2); giveControl(d.iid, wrap.dataset.board, { x: sp.x, y: sp.y }); }
    return;
  }
}
function reorderHand(iid, clientX) {
  const els = [...document.querySelectorAll('#myHand .card')].filter(c => c.dataset.iid !== iid);
  const before = els.find(c => { const r = c.getBoundingClientRect(); return clientX < r.left + r.width / 2; });
  act(() => {
    const h = S.me.zones.hand;
    const i = h.findIndex(c => c.iid === iid); if (i < 0) return null;
    const [c] = h.splice(i, 1);
    const j = before ? h.findIndex(x => x.iid === before.dataset.iid) : -1;
    h.splice(j < 0 ? h.length : j, 0, c);
    return null;
  }, { noUndo: true });
}

// --- moving / resizing my zones (arrange mode)
function startRegionDrag(e, handle) {
  e.preventDefault();
  const regEl = handle.closest('.region'); const board = handle.closest('.board');
  const r = S.me.layout.find(x => x.k === regEl.dataset.region); if (!r) return;
  pushUndo('Arranged battlefield zones');
  const mode = handle.classList.contains('grip') ? 'resize' : 'move';
  const cards = mode === 'move'
    ? S.me.zones.battlefield.concat(S.me.zones.command).filter(c => !c.att && c.x != null && centerIn(c, r)).map(c => [c, c.x, c.y])
    : [];
  S.regionDrag = { r, mode, corner: handle.dataset.c || 'se', s: +board.dataset.s || 1, sx: e.clientX, sy: e.clientY, x: r.x, y: r.y, w: r.w, h: r.h, cards };
}
function regionMove(e) {
  const d = S.regionDrag, r = d.r;
  const dx = (e.clientX - d.sx) / d.s, dy = (e.clientY - d.sy) / d.s;
  if (d.mode === 'move') {
    r.x = Math.round(clamp(d.x + dx, 0, BW - r.w)); r.y = Math.round(clamp(d.y + dy, 0, myBH() - r.h));
    const mx = r.x - d.x, my = r.y - d.y;
    d.cards.forEach(([c, x0, y0]) => { c.x = clamp(x0 + mx, 0, BW - CW); c.y = clamp(y0 + my, 0, myBH() - CH); });
  } else {
    // resize from whichever corner was grabbed; the opposite corner stays put
    const c = d.corner;
    let { x, y, w, h } = d;
    if (c.includes('e')) w = clamp(d.w + dx, 100, BW - d.x);
    if (c.includes('s')) h = clamp(d.h + dy, 60, myBH() - d.y);
    if (c.includes('w')) { x = clamp(d.x + dx, 0, d.x + d.w - 100); w = d.w + (d.x - x); }
    if (c.includes('n')) { y = clamp(d.y + dy, 0, d.y + d.h - 60); h = d.h + (d.y - y); }
    r.x = Math.round(x); r.y = Math.round(y); r.w = Math.round(w); r.h = Math.round(h);
  }
  render();
}
function regionEnd() {
  S.regionDrag = null;
  S.me.layoutAuto = false; // arranged by hand: keep it exactly as placed
  LS.set('ct.layout2', S.me.layout); // remember my layout for future games
  commit();
}

function onButton(a, btn, e) {
  const d = num(btn.dataset.d) * (e.shiftKey ? 5 : 1);
  const r = btn.getBoundingClientRect();
  switch (a) {
    case 'life': changeLife(d); break;
    case 'setlife': {
      const pid = btn.dataset.pid || S.pid;
      const current = pid === S.pid ? S.me.life : (S.players[pid] && S.players[pid].life);
      if (!Number.isFinite(current)) break;
      UI.prompt({ title: `Set ${pid === S.pid ? 'your' : pname(pid) + "'s"} life total`, label: 'New life total (whole number)', type: 'number', value: current, min: -9999, max: 9999 })
        .then(value => {
          if (value == null) return;
          if (!Number.isInteger(value)) { UI.toast('Enter a whole-number life total.', { kind: 'error' }); return; }
          if (pid === S.pid) changeLife(value - S.me.life);
          else sendReq(pid, { k: 'life-set', life: value });
        });
      break;
    }
    case 'poison': changePoison(d); break;
    case 'pctr': {
      const k = btn.dataset.k;
      if (k === 'Poison') changePoison(d);
      else act(() => { S.me.ctr[k] = (S.me.ctr[k] || 0) + d; if (S.me.ctr[k] <= 0) delete S.me.ctr[k]; });
      break;
    }
    case 'ctrs': S.ctrOpen = S.ctrOpen === btn.dataset.pid ? null : btn.dataset.pid; render(); break;
    case 'tax': changeTax(btn.dataset.iid, 1); break;
    case 'addctr': UI.menu(r.left, r.bottom + 4, PLAYER_COUNTERS.map(k => ({ label: k, onClick: () => act(() => { S.me.ctr[k] = (S.me.ctr[k] || 0) + 1; }) }))); break;
    case 'cdmg': cmdDmgClick(btn, +btn.dataset.d || 1); break;
    case 'olife': sendReq(btn.dataset.pid, { k: 'life', d }); break;
    case 'draw': draw(1); break;
    case 'untapall': untapAll(); break;
    case 'autodraw': act(() => { S.me.autoDraw = !S.me.autoDraw; }, { noUndo: true }); UI.toast(`Auto-draw ${S.me.autoDraw ? 'on' : 'off'}`, { ms: 1500 }); break;
    case 'autountap': act(() => { S.me.autoUntap = !S.me.autoUntap; }, { noUndo: true }); UI.toast(`Auto-untap ${S.me.autoUntap ? 'on' : 'off'}`, { ms: 1500 }); break;
    case 'tokens': tokensMenu(r.left, r.bottom + 4); break;
    case 'keep': keepHand(); break;
    case 'mull': mulligan(); break;
    case 'start': toHost({ t: 'op', op: { k: 'start' } }); break;
    case 'pass': passTurn(); break;
    case 'phase': toHost({ t: 'op', op: { k: 'phase', v: num(btn.dataset.i) } }); break;
    case 'dice': diceMenu(r.left, r.bottom + 4); break;
    case 'undo': undo(); break;
    case 'response': sendResponse(); break;
    case 'undohistory': undoHistoryMenu(btn); break;
    case 'menu': mainMenu(r.right - 240, r.bottom + 4); break;
    case 'openingrule': openingRulesMenu(btn); break;
    case 'copyroom': copyRoom(); break;
    case 'arrange': toggleArrange(); break;
    case 'tidy': act(() => { tidyBoard(); return ['tidied up their battlefield']; }); break;
    case 'resetzones': act(() => {
      // stretch the default layout to fit MY SCREEN (not the current board, which may be oversized)
      S.me.layout = fittedLayout(); S.me.layoutAuto = true;
      S.me.bh = 0; // recomputed from the new layout
      LS.del('ct.layout2'); tidyBoard(); return ['reset their zone layout'];
    }); break;
    case 'focus':
      toggleFocus(btn.dataset.pid); break;
    case 'viewme': S.focus = null; render(); break;
    case 'side':
      document.body.classList.toggle('side-open');
      if (document.body.classList.contains('side-open')) { const log = $('#log'); if (log) log.scrollTop = 0; }
      break;
    case 'view': S.view = btn.dataset.v; LS.set('ct.view', S.view); S.focus = null; document.body.classList.remove('side-open'); render(); break;
    case 'displaysettings': displaySettings(); break;
  }
}
let concedePromptOpen = false;
function askConcede(message, title) {
  if (concedePromptOpen) return;
  concedePromptOpen = true;
  let result;
  try {
    result = UI.confirm(message, { title, danger: true, okLabel: 'Concede game' });
  } catch (e) {
    concedePromptOpen = false;
    throw e;
  }
  Promise.resolve(result).then(ok => {
    if (ok) concedeGame();
  }, () => {}).finally(() => { concedePromptOpen = false; });
}
function concedeGame() {
  const T = S.table;
  if (!T || !T.started || !T.seats.includes(S.pid) || (T.out && T.out[S.pid])) return;
  toHost({ t: 'op', op: { k: 'concede' } });
}
async function passTurn() {
  const T = S.table; if (!T || !T.started || !T.active) return;
  if (T.active !== S.pid && !(await UI.confirm(`It's ${pname(T.active)}'s turn. Pass it for them?`, { okLabel: 'Pass their turn' }))) return;
  const seq = Math.max(1, num(T.turnSeq, num(T.turn)));
  toHost({ t: 'op', op: { k: 'pass', turn: seq, turnSeq: seq } });
}
// Invite link = this page's address (works on GitHub Pages' /commander-table/ path, the
// LAN server and file://) + ?join=CODE. The bare room code still works as a fallback.
function inviteLink(room) {
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('join', room);
  const net = new URLSearchParams(location.search).get('net');
  if (net) u.searchParams.set('net', net);
  return u.href;
}
function copyRoom() {
  if (!S.room || S.role === 'solo') return;
  const link = inviteLink(S.room);
  const done = () => UI.toast(`Invite link copied — friends open it to join room ${S.room}.`, { ms: 6000 });
  const fail = () => UI.prompt({ title: 'Invite link', label: `Send this to your friends (room code ${S.room}):`, value: link, okLabel: 'Done' });
  try { navigator.clipboard.writeText(link).then(done, fail); } catch (e) { fail(); }
}
// Browser facts that help explain display problems (e.g. flicker only in Safari).
function browserDiag() {
  const nav = navigator, d = { userAgent: nav.userAgent, platform: nav.platform, vendor: nav.vendor, language: nav.language };
  const safe = f => { try { return f(); } catch (e) { return 'n/a'; } };
  d.viewport = innerWidth + 'x' + innerHeight;
  d.screen = safe(() => screen.width + 'x' + screen.height);
  d.pixelRatio = devicePixelRatio;
  d.view = S.view || 'side';
  d.dark = safe(() => matchMedia('(prefers-color-scheme: dark)').matches);
  d.reducedMotion = safe(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  d.online = nav.onLine;
  d.visibility = document.visibilityState;
  d.storage = safe(() => { localStorage.setItem('ct.probe', '1'); localStorage.removeItem('ct.probe'); return 'ok'; });
  d.webpEncode = safe(() => document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'));
  d.cores = nav.hardwareConcurrency; d.memoryGB = nav.deviceMemory;
  d.renders = Object.assign({}, renderStats);
  d.cardImages = document.querySelectorAll('.card img').length;
  d.imagesNotLoaded = [...document.querySelectorAll('.card img')].filter(i => !i.complete || !i.naturalWidth).length;
  return d;
}
function showConnInfo() {
  const d = Object.assign({ page: location.href.split('?')[0], app: APP_VERSION }, Net.diag(), { browser: browserDiag() });
  const pre = document.createElement('pre');
  pre.className = 'conn-diag';
  pre.textContent = JSON.stringify(d, null, 2);
  const wrap = document.createElement('div');
  const p = document.createElement('p');
  p.className = 'muted small';
  p.textContent = 'If you have connection or display trouble (flicker, missing images), copy this and send it along with what you see.';
  const b = document.createElement('button');
  b.textContent = 'Copy';
  b.onclick = () => { try { navigator.clipboard.writeText(pre.textContent).then(() => UI.toast('Copied.')); } catch (e) { /* ignore */ } };
  wrap.append(p, pre, b);
  UI.modal({ title: 'Connection details', el: wrap });
}
function onKey(e) {
  if (e.defaultPrevented) return;
  if (!S.me || $('#game').classList.contains('hidden')) return;
  if (e.target.closest && e.target.closest('#chatPanel')) {
    if (e.key === 'Escape' && S.chatOpen) { setChatPanelOpen(false); $('#chatBtn').focus(); e.preventDefault(); }
    return;
  }
  if (boardTransferLock) return;
  if (S.arrowPick) { if (e.key === 'Escape') { endTargeting(); e.preventDefault(); } return; }
  if (e.key === 'Escape' && S.attachFrom) { endAttach(); return; }
  if (e.key === 'Escape' && S.chatOpen) { setChatPanelOpen(false); e.preventDefault(); return; }
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  if (document.querySelector('.w-backdrop')) return; // a dialog/viewer is open
  if (e.key === 'Escape' && (selectionDrag || S.selected.size)) { cancelSelectionDrag(true); return; }
  if (e.code === 'Space' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Leave Spacebar's native behavior alone when a button or other interactive control has focus.
    if (e.target.closest && e.target.closest('button,a,[role="button"],[tabindex],label')) return;
    e.preventDefault(); passTurn(); return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  const h = S.hover;
  const mine = h && h.pid === S.pid && findCard(h.iid);
  // Alt+1..4 = power/toughness on the hovered card (Ctrl+number is reserved by the browser for tabs)
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const ptKeys = { Digit1: [1, 0], Digit2: [0, 1], Digit3: [-1, 0], Digit4: [0, -1] };
    if (mine && ptKeys[e.code]) { e.preventDefault(); changePT(h.iid, ...ptKeys[e.code]); }
    return;
  }
  if (e.ctrlKey || e.metaKey) return;
  // Shift+1/2/3 = increment / double / decrement all counters on the hovered card
  if (e.shiftKey && mine && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
    e.preventDefault(); allCounters(h.iid, { Digit1: 'inc', Digit2: 'double', Digit3: 'dec' }[e.code]); return;
  }
  const k = e.key.toLowerCase();
  if (k === 'r') { if (!e.repeat) { e.preventDefault(); sendResponse(); } return; }
  if (k === 't' && ownEmptyBattlefieldHovered()) {
    e.preventDefault();
    tokensMenu(pvMouse.x, pvMouse.y);
    return;
  }
  if (k === 'escape' && S.arrange) { toggleArrange(); return; }
  if ((k === 's' || k === 'x') && e.repeat) return; // avoid repeated shuffle/mill while a key is held
  if (k === 's') {
    if (ownLibraryHovered()) { e.preventDefault(); shuffleLib(); }
    return;
  }
  if (k === 'x' && ownLibraryHovered()) { e.preventDefault(); millTopCard(); return; }
  if (k === 'l') { e.preventDefault(); viewZone(S.pid, 'library'); return; }
  if (k === 'd') { draw(1); return; }
  if (k === 'u') { untapAll(); return; }
  if (k === 'i' && h) { // info works on anyone's card
    const f = mine ? { def: defOf(mine.card) } : oppCard(h.pid, h.iid);
    if (f && f.def) { e.preventDefault(); viewInfo(f.def); }
    return;
  }
  if (!mine) return;
  const map = { t: () => mine.zone === 'hand' ? doMove(h.iid, 'battlefield', { tapped: true }) : toggleTap(h.iid), f: () => flip(h.iid), g: () => doMove(h.iid, 'graveyard'),
    e: () => doMove(h.iid, 'exile'), h: () => doMove(h.iid, 'hand'), b: () => doMove(h.iid, 'battlefield'), a: () => startAttach(h.iid),
    z: () => toggleFaceDown(h.iid), j: () => customCounter(h.iid),
    '+': () => addCounter(h.iid, '+1/+1', 1), '=': () => addCounter(h.iid, '+1/+1', 1),
    '-': () => addCounter(h.iid, '-1/-1', 1), '_': () => addCounter(h.iid, '-1/-1', 1) };
  if (map[k]) { e.preventDefault(); map[k](); }
}

// =====================================================================
//  Networking glue
// =====================================================================
const lostTimers = {};
// A random secret per player session. The relay lets a reloaded host take its room back
// with it (instead of waiting for the old connection to time out), and nobody else can.
function netKey() {
  const k = 'ct.nk.' + S.pid;
  let v = LS.get(k, null);
  if (!v) {
    try { v = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); }
    catch (e) { v = uid() + uid() + uid(); }
    LS.set(k, v);
  }
  return v;
}
function startNet() {
  if (S.role === 'solo') return;
  if (typeof Peer === 'undefined') { S.net = { state: 'error', text: 'Connection library failed to load (are you online?)' }; render(); return; }
  Net.start({
    role: S.role, room: S.room, pid: S.pid, key: netKey(),
    onMessage: (msg, from) => {
      if (S.role === 'host') { if (authorizeClientMessage(msg, from)) hostRecv(msg, from); }
      else clientRecv(msg);
    },
    onStatus: (state, text, code, transport) => {
      const was = S.net.state;
      S.net = { state, text: text || '', code: code || '', transport: transport || '' };
      if (state === 'online' && was !== 'online' && S.role === 'client') {
        roomBackupSent.delete(S.room + ':' + S.pid);
        publish(true);
        queueRoomBackup();
        if (S.table && S.table.room === S.room) toHost({ t: 'tsync', table: S.table });
      }
      if (state === 'online' && was !== 'online' && S.role === 'host') { roomBackupSent.delete(S.room + ':' + S.pid); queueRoomBackup(); }
      render();
    },
    onDropped: msgs => {
      const n = msgs.filter(m => m.t !== 'log').length;
      if (n) UI.toast(`${n === 1 ? 'An action' : n + ' actions'} you made while disconnected didn't reach the table, so ${n === 1 ? 'it was' : 'they were'} not applied late. Redo ${n === 1 ? 'it' : 'them'} if still needed.`, { kind: 'warn', ms: 9000 });
    },
    onJoin: pid => {
      clearTimeout(lostTimers[pid]);
      if (lostTimers[pid] === 'logged') sysLog(`${pname(pid)} reconnected.`);
      delete lostTimers[pid];
      S.online[pid] = true;
      Net.sendTo(pid, snapFor());
      broadcast({ t: 'online', online: S.online });
    },
    onLeave: pid => {
      if (S.pendingSeats && !S.table.seats.includes(pid)) delete S.pendingSeats[pid];
      S.online[pid] = false;
      broadcast({ t: 'online', online: S.online });
      // brief blips reconnect within a few seconds — only log real outages
      clearTimeout(lostTimers[pid]);
      lostTimers[pid] = setTimeout(() => {
        if (S.online[pid] === false) { sysLog(`${pname(pid)} lost connection — waiting for them to come back…`); lostTimers[pid] = 'logged'; }
      }, 6000);
    }
  });
}

// Private room snapshots: status/roster metadata is public, saved card data is not.
const roomBackupSent = new Map(), roomBackupQueues = new Map(), roomBackupVersion = new Map(), roomBackupAccepted = new Map();
function queueRoomBackup() {
  if (!S.me || boardTransferLock || S.role === 'solo' || !S.table || !S.table.seats.includes(S.pid) || S.net.state !== 'online') return;
  const deck = Deck.get(S.deckId); if (!deck) return;
  const { roomSaveRevision, ...me } = S.me;
  const data = { me, deck }, serialized = JSON.stringify(data), key = S.room + ':' + S.pid;
  if (roomBackupSent.get(key) === serialized) return;
  roomBackupSent.set(key, serialized);
  S.me.roomSaveRevision = Math.max(Date.now(), (Number(roomSaveRevision) || 0) + 1);
  const revision = S.me.roomSaveRevision;
  if (S.role === 'host') saveRoomBoard(S.pid, JSON.parse(serialized), revision);
  else toHost({ t: 'private-board', data: JSON.parse(serialized), revision });
}
function roomBackupStatus(pid, status, at, error) {
  S.boardBackups = S.boardBackups || {};
  S.boardBackups[pid] = { status, at: at || 0, error: error || '' };
  const label = document.querySelector(`[data-room-save="${CSS.escape(pid)}"]`);
  if (label) label.textContent = roomBackupLabel(pid);
}
function roomBackupLabel(pid) {
  const status = (S.boardBackups || {})[pid];
  return status && status.status === 'saved' ? 'Saved to room ' + new Date(status.at).toLocaleTimeString() : status && status.status === 'pending' ? 'Saving to room…' : 'Room backup unavailable';
}
function saveRoomBoard(pid, data, revision) {
  if (typeof Net.roomVault !== 'function') return;
  const me = cleanPrivateBoard(data && data.me, pid, pid), deck = cleanTransferDeck(data && data.deck);
  if (!me || !deck || !Number.isSafeInteger(revision) || revision <= (roomBackupAccepted.get(pid) || 0)) return;
  roomBackupAccepted.set(pid, revision);
  const room = S.room, version = (roomBackupVersion.get(pid) || 0) + 1; roomBackupVersion.set(pid, version);
  roomBackupStatus(pid, 'pending');
  broadcast({ t: 'backup-status', pid, status: 'pending' });
  const previous = roomBackupQueues.get(pid) || Promise.resolve();
  const task = previous.catch(() => {}).then(() => {
    if (S.room !== room || S.role !== 'host' || !S.table.seats.includes(pid)) return;
    return Net.roomVault('put', { pid, data: { me, deck, revision } }).then(result => {
      if (roomBackupVersion.get(pid) === version && S.room === room && S.table && S.table.seats.includes(pid)) broadcast({ t: 'backup-status', pid, status: 'saved', at: result && result.updatedAt || Date.now() });
    }).catch(error => {
      if (roomBackupVersion.get(pid) === version && S.room === room && S.table) broadcast({ t: 'backup-status', pid, status: 'unavailable', error: error.message });
    });
  });
  roomBackupQueues.set(pid, task);
}
function showBoardRecovery(preselect) {
  const T = S.table; if (!T) return;
  const rows = T.seats.map(pid => {
    const p = S.players[pid];
    const canChoose = pid !== S.pid && pid !== T.hostPid;
    return `<div class="ct-recovery-seat"><b>${esc(p ? p.name : pid)}</b> <span class="muted small">${S.online[pid] || pid === T.hostPid ? 'Connected' : 'Disconnected'} · <span data-room-save="${esc(pid)}">${esc(roomBackupLabel(pid))}</span></span>${canChoose ? `<button type="button" data-recover-seat="${esc(pid)}">${isModerator() ? 'Assign board…' : 'Request this board'}</button>` : ''}</div>`;
  }).join('');
  let requested = false;
  const waiting = !T.seats.includes(S.pid);
  const modal = UI.modal({ title: 'Choose / recover a board', onClose: () => { if (waiting && !requested) exitModerated('No board was selected. Join with a different name or request your existing board again.'); }, html: `<p>Choose the board you need. A moderator must approve changing who controls it. Private hand and library are restored from the latest completed room save.</p>${rows}<button id="ctRetryRoomSave" type="button">Save my board now</button><p class="muted small">Room saves expire after 24 hours. A save still pending when the browser closes may miss the latest action. If room backup is unavailable, keep the original browser’s saved game.</p>` });
  modal.el.querySelectorAll('[data-recover-seat]').forEach(button => {
    button.onclick = () => {
      const source = button.dataset.recoverSeat;
      requested = true; modal.close();
      if (isModerator()) showBoardTransfer(source);
      else { toHost({ t: 'recover-seat-request', source }); UI.toast('Board request sent. A moderator must approve it.', { ms: 30000, action: { label: 'Cancel request', onClick: () => { if (waiting) exitModerated('Board request cancelled.'); } } }); }
    };
  });
  modal.el.querySelector('#ctRetryRoomSave').onclick = () => { roomBackupSent.delete(S.room + ':' + S.pid); queueRoomBackup(); };
  if (preselect) modal.el.querySelector(`[data-recover-seat="${CSS.escape(preselect)}"]`)?.focus();
}
function reviewSeatRequest(request) {
  UI.confirm(`${request.name} requests control of ${pname(request.source)}'s board. Approve replacing their current empty board, including private hand/library?`, { title: 'Approve board claim', danger: true, okLabel: 'Assign board' }).then(ok => {
    if (ok) toHost({ t: 'op', op: { k: 'handoff', pid: request.source, to: request.from } });
  });
}

// Host-authorized moderation and private board handoffs. Private state is addressed
// only to the host and the selected recipient, never included in room broadcasts.
let boardTransferLock = false, pendingBoardTransfer = null, boardTransferTimer = null;
function seatKey() {
  const name = 'ct.seatKey.' + S.room + '.' + S.pid;
  let key = LS.get(name, null);
  if (!key) { key = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); LS.set(name, key); }
  return key;
}
function authorizeClientMessage(msg, from) {
  // Public seat IDs cannot grant host/moderator authority or claim an offline seat.
  if (!isObj(msg) || from === S.pid || typeof from !== 'string' || !/^[\w-]{1,40}$/.test(from)) return false;
  if (typeof msg.seatKey !== 'string' || !/^[a-f0-9]{32}$/.test(msg.seatKey)) return false;
  S.seatKeys = S.seatKeys || {};
  if (S.seatKeys[from]) return S.seatKeys[from] === msg.seatKey;
  if (msg.t !== 'pub') return false;
  S.seatKeys[from] = msg.seatKey; saveNow(); return true;
}
function samePlayerName(a, b) { return String(a || '').trim().toLocaleLowerCase() === String(b || '').trim().toLocaleLowerCase(); }
function isModerator(pid = S.pid) {
  return !!S.table && (pid === S.table.hostPid || (pid === S.pid && S.role !== 'client') || (S.table.mods || []).includes(pid));
}
function cleanHandoffs(raw) {
  if (!isObj(raw)) return {};
  return Object.fromEntries(Object.entries(raw).slice(-8).filter(([pid, r]) => /^[\w-]{1,40}$/.test(pid) && isObj(r) && typeof r.id === 'string' && typeof r.source === 'string').map(([pid, r]) => [pid, { id: r.id.slice(0, 40), source: r.source.slice(0, 40) }]));
}
function directPlayer(pid, msg) { if (pid === S.pid) handleClientModeration(msg); else Net.sendTo(pid, msg); }
function transferNotice(pid, text) { directPlayer(pid, { t: 'moderation-notice', text }); }
function boardPendingKey() { return 'ct.boardPending.' + S.room + '.' + S.pid; }
function archiveBoard() {
  if (!S.me) return true;
  return LS.set('ct.recovery.' + S.pid, { at: Date.now(), room: S.room, role: S.role, deckId: S.deckId, me: S.me });
}
function savedRoomSession(room) {
  try {
    const entries = Object.keys(window.localStorage).filter(k => k.startsWith('ct.sess.')).map(k => ({ pid: k.slice(8), sess: loadSession(k.slice(8)) })).filter(e => e.sess && e.sess.role !== 'solo' && e.sess.room === room);
    return entries.sort((a, b) => b.sess.at - a.sess.at)[0] || null;
  } catch (_) { return null; }
}
function exitModerated(reason) {
  if (!S.me) return;
  archiveBoard(); clearTimeout(pubTimer); clearTimeout(saveT); clearTimeout(boardTransferTimer);
  boardTransferLock = false; S.colorFlow = false; S.colorRequestPending = false; closeColorModal();
  Net.stop(); LS.del('ct.sess.' + S.pid); if (LS.get('ct.last') === S.pid) LS.del('ct.last');
  S.me = null; S.table = null; S.players = {}; S.log = []; S.undo = []; S.selected.clear(); S.focus = null;
  S.viewers.forEach(v => v.v.close());
  S.pid = 'p' + uid(); SS.set('ct.pid', S.pid);
  showLobby(); UI.toast(reason, { kind: 'warn', ms: 14000 });
}
function handleRemovedSeat() {
  if (S.table && (S.table.kicked || []).includes(S.pid)) { exitModerated('Your previous seat was removed or transferred by a moderator. A local recovery copy was kept.'); return true; }
  return false;
}
function remapBoardReferences(me, source, target) {
  if (!me) return;
  const iid = value => typeof value === 'string' && value.startsWith(source + '_') ? target + value.slice(source.length) : value;
  Object.values(me.zones || {}).forEach(list => { if (Array.isArray(list)) list.forEach(c => {
    c.iid = iid(c.iid); if (c.own === source) c.own = target;
    if (c.att) { c.att.i = iid(c.att.i); if (c.att.p === source) c.att.p = target; }
  }); });
  me.revealTopOnce = iid(me.revealTopOnce);
  if (Array.isArray(me.cmdrs)) me.cmdrs.forEach(c => { c.iid = iid(c.iid); });
  if (me.casts) me.casts = Object.fromEntries(Object.entries(me.casts).map(([k, v]) => [iid(k), v]));
  if (me.cmdDmg) me.cmdDmg = Object.fromEntries(Object.entries(me.cmdDmg).map(([k, v]) => {
    const [pid, card] = k.split(':'); return [(pid === source ? target : pid) + ':' + iid(card), v];
  }));
}
function cleanPrivateBoard(raw, source, target) {
  if (!isObj(raw) || raw.pid !== source || !isObj(raw.zones) || !isObj(raw.defs)) return null;
  try { if (JSON.stringify(raw).length > 650000) return null; } catch (_) { return null; }
  const ids = new Set();
  for (const z of ZONES) {
    if (!Array.isArray(raw.zones[z]) || raw.zones[z].length > 400) return null;
    for (const c of raw.zones[z]) {
      if (!isObj(c) || typeof c.iid !== 'string' || !/^[\w-]{1,40}$/.test(c.iid) || ids.has(c.iid)) return null;
      ids.add(c.iid);
      if (typeof c.id !== 'string' || !isObj(raw.defs[c.id]) || raw.defs[c.id].id !== c.id) return null;
    }
  }
  if (ids.size > 600 || Object.keys(raw.defs).length > 800) return null;
  const m = JSON.parse(JSON.stringify(raw));
  // JSON data only; keep the complete owned state (including counters, P/T and reveals).
  m.pid = target; m.name = String(m.name || 'Player').slice(0, 24);
  m.cmdrs = Array.isArray(m.cmdrs) ? m.cmdrs.slice(0, 3).filter(c => isObj(c) && typeof c.iid === 'string').map(c => ({ iid: c.iid, name: String(c.name || '').slice(0, 80) })) : [];
  m.tokens = Array.isArray(m.tokens) ? m.tokens.filter(id => typeof id === 'string' && m.defs[id]).slice(0, 100) : [];
  m.seq = Math.max(num(m.seq), ids.size); m.mull = Math.max(0, num(m.mull));
  m.life = num(m.life, 40); m.poison = num(m.poison); m.ctr = numMap(m.ctr); m.casts = numMap(m.casts); m.cmdDmg = numMap(m.cmdDmg);
  m.defs = Object.fromEntries(Object.entries(m.defs).filter(([id, d]) => isObj(d) && d.id === id).map(([id, d]) => [id, Deck.slimDef(d)]));
  if ([...ids].some(iid => !iid)) return null;
  remapBoardReferences(m, source, target);
  return m;
}
function cleanTransferDeck(raw) {
  if (!isObj(raw) || !Array.isArray(raw.cards) || raw.cards.length > 400 || !Array.isArray(raw.commanders) || raw.commanders.length > 3) return null;
  const def = d => isObj(d) && typeof d.id === 'string' ? Deck.slimDef(d) : null;
  const cards = raw.cards.map(r => ({ def: def(r && r.def), qty: num(r && r.qty) }));
  const commanders = raw.commanders.map(def);
  if (cards.some(r => !r.def || r.qty < 1 || r.qty > 250) || commanders.some(d => !d) || cards.reduce((n, r) => n + r.qty, 0) > 600) return null;
  return { name: String(raw.name || 'Transferred deck').slice(0, 100), cards, commanders, tokens: (Array.isArray(raw.tokens) ? raw.tokens.slice(0, 100).map(def).filter(Boolean) : []) };
}
function beginBoardTransfer(source, target, moderator) {
  const T = S.table;
  if (pendingBoardTransfer) { transferNotice(moderator, 'Finish the current board handoff first.'); return; }
  if (!T.seats.includes(source) || (!T.seats.includes(target) && !(S.pendingSeats || {})[target]) || source === target || source === S.pid || (target !== S.pid && !S.online[target])) { transferNotice(moderator, 'Choose a connected recipient and a different non-host board.'); return; }
  // Replacing a live battlefield would strand its attachments/borrowed cards.
  const old = S.players[target] || S.pendingSeats?.[target]?.p;
  if (!old || ['battlefield', 'graveyard', 'exile'].some(z => old.zones[z].length) || Object.entries(S.players).some(([pid, p]) => pid !== target && p.zones.battlefield.some(c => c.own === target || (c.att && c.att.p === target)))) { transferNotice(moderator, 'The recipient needs an empty battlefield, graveyard and exile, with no cards controlled by others. Their hand/command/library will be backed up and replaced.'); return; }
  const id = 'h' + uid() + uid();
  pendingBoardTransfer = { id, source, target, moderator, stage: 'capture' };
  boardTransferTimer = setTimeout(() => abortBoardTransfer('Board handoff timed out. No seat was removed.'), 25000);
  const recovery = !S.online[source];
  if (recovery && typeof Net.roomVault === 'function') {
    Net.roomVault('get', { pid: source }).then(result => {
      if (pendingBoardTransfer?.id !== id) return;
      handleHostBoardTransfer({ t: 'board-captured', id, me: result.data.me, deck: result.data.deck }, target);
    }).catch(error => {
      if (pendingBoardTransfer?.id !== id) return;
      pendingBoardTransfer.recoveryError = error.message;
      directPlayer(target, { t: 'board-capture', id, source, target, recovery: true });
    });
  } else directPlayer(recovery ? target : source, { t: 'board-capture', id, source, target, recovery });
}
function abortBoardTransfer(reason) {
  const p = pendingBoardTransfer; if (!p) return;
  pendingBoardTransfer = null; clearTimeout(boardTransferTimer);
  for (const pid of new Set([p.source, p.target, p.moderator])) directPlayer(pid, { t: 'board-abort', id: p.id, text: reason });
}
function handleHostBoardTransfer(msg, from) {
  if (!['board-captured', 'board-ready', 'board-failed'].includes(msg.t)) return false;
  const p = pendingBoardTransfer;
  if (!p || msg.id !== p.id || (!S.table.seats.includes(from) && !(from === p.target && S.pendingSeats?.[from])) || !isModerator(p.moderator)) return true;
  if (msg.t === 'board-failed' && [p.source, p.target].includes(from)) { abortBoardTransfer(p.recoveryError ? `No room-server backup was available: ${p.recoveryError} The original browser's local save was also unavailable.` : 'The private saved board was unavailable or could not be saved. Check the room backup status or reconnect the original browser.'); return true; }
  if (msg.t === 'board-captured' && p.stage === 'capture' && from === (S.online[p.source] ? p.source : p.target)) {
    const me = cleanPrivateBoard(msg.me, p.source, p.target);
    if (!me) { abortBoardTransfer('The saved board failed validation; no seat was removed.'); return true; }
    p.stage = 'install';
    const deck = cleanTransferDeck(msg.deck);
    if (!deck) { abortBoardTransfer('The original saved deck is unavailable; restore it in the original browser first.'); return true; }
    directPlayer(p.target, { t: 'board-prepare', id: p.id, source: p.source, me, deck });
  } else if (msg.t === 'board-ready' && p.stage === 'install' && from === p.target) {
    const T = S.table;
    // Recipient has durably stored the private copy before public ownership changes.
    T.handoffs = { ...(T.handoffs || {}), [p.target]: { id: p.id, source: p.source } };
    T.kicked = [...new Set([...(T.kicked || []), p.source])].slice(-128);
    T.seats = T.seats.filter(pid => pid !== p.target).map(pid => pid === p.source ? p.target : pid);
    const oldOrder = T.order.filter(pid => pid !== p.target);
    T.order = oldOrder.map(pid => pid === p.source ? p.target : pid);
    if (T.active === p.source) T.active = p.target;
    if (T.monarch === p.source) T.monarch = p.target;
    if (T.initiative === p.source) T.initiative = p.target;
    if (T.out[p.source]) T.out[p.target] = true; else delete T.out[p.target];
    delete T.out[p.source]; T.mods = (T.mods || []).filter(pid => pid !== p.source);
    const inheritedColor = T.colors && T.colors[p.source];
    T.colors = { ...(T.colors || {}) }; delete T.colors[p.source]; delete T.colors[p.target];
    if (inheritedColor) T.colors[p.target] = inheritedColor;
    T.colors = CTPlayerColors.normalize(T.seats, T.colors, false);
    if (T.openingAllowances) { T.openingAllowances[p.target] = T.openingAllowances[p.source] || 0; delete T.openingAllowances[p.source]; }
    Object.values(S.players).forEach(player => remapBoardReferences(player, p.source, p.target));
    const sourceName = pname(p.source), targetName = S.players[p.target]?.name || S.pendingSeats?.[p.target]?.p.name || pname(p.target);
    delete S.players[p.source];
    if (S.pendingSeats) delete S.pendingSeats[p.target];
    if (typeof Net.roomVault === 'function') Net.roomVault('delete', { pid: p.source }).catch(() => {});
    pendingBoardTransfer = null; clearTimeout(boardTransferTimer);
    broadcast({ t: 'board-remap', source: p.source, target: p.target });
    pushTable();
    // Include the current public table for recipients even if table delivery was lost.
    directPlayer(p.target, { t: 'board-activate', table: T });
    directPlayer(p.source, { t: 'moderation-exit', reason: `Your board was transferred to ${targetName} by a moderator. A local recovery copy was kept.` });
    broadcast({ t: 'arrows', arrows: [] });
    sysLog(`${targetName} took control of ${sourceName}'s board (authorized by ${pname(p.moderator)}).`);
  }
  return true;
}
function applyCommittedHandoff() {
  if (!S.table || !S.me) return;
  const record = (S.table.handoffs || {})[S.pid], pending = LS.get(boardPendingKey(), null);
  if (!record || !pending || pending.id !== record.id) return;
  const me = cleanPrivateBoard(pending.me, S.pid, S.pid);
  if (!me) return;
  S.me = me; S.deckId = pending.deckId; S.undo = []; S.selected.clear(); S.focus = null; boardTransferLock = false;
  normalizeMe(S.me); saveNow(); LS.del(boardPendingKey()); publish(true);
  UI.toast('You now control the transferred board, including its hand and library. Your previous board is saved locally.', { ms: 12000 });
}
function handleClientModeration(msg) {
  if (!msg || typeof msg.t !== 'string') return false;
  if (msg.t === 'moderation-exit') { exitModerated(String(msg.reason || 'Your seat was removed.')); return true; }
  if (msg.t === 'moderation-notice') { UI.toast(String(msg.text || ''), { kind: 'warn', ms: 12000 }); return true; }
  if (msg.t === 'seat-conflict') {
    if (!boardTransferLock) { boardTransferLock = true; S.colorFlow = false; S.colorRequestPending = false; closeColorModal(); UI.toast('That player already has a board. Request it below; a moderator must approve.', { ms: 10000 }); showBoardRecovery(msg.pid); } return true;
  }
  if (msg.t === 'backup-status') { roomBackupStatus(msg.pid, msg.status, msg.at, msg.error); return true; }
  if (msg.t === 'recovery-request') { if (isModerator()) UI.toast(`${msg.request.name} requests ${pname(msg.request.source)}'s board.`, { ms: 20000, action: { label: 'Review', onClick: () => reviewSeatRequest(msg.request) } }); return true; }
  if (msg.t === 'board-capture') {
    if (!S.me || typeof msg.id !== 'string') return true;
    let me = S.me, deckId = S.deckId;
    if (msg.recovery) {
      const sess = loadSession(msg.source);
      if (!sess || sess.room !== S.room) { toHost({ t: 'board-failed', id: msg.id }); return true; }
      me = sess.me; deckId = sess.deckId;
    } else {
      if (msg.source !== S.pid || boardTransferLock) return true;
      saveNow(); boardTransferLock = true;
      clearTimeout(boardTransferTimer); boardTransferTimer = setTimeout(() => { boardTransferLock = false; }, 30000);
      UI.toast('A moderator is transferring this board. Actions are paused briefly.', { ms: 12000 });
    }
    toHost({ t: 'board-captured', id: msg.id, me, deck: Deck.get(deckId) }); return true;
  }
  if (msg.t === 'board-prepare') {
    if (!S.me) return true;
    const me = cleanPrivateBoard(msg.me, S.pid, S.pid), deck = cleanTransferDeck(msg.deck);
    let savedDeck;
    try { if (me && deck && archiveBoard()) savedDeck = Deck.save(deck); } catch (_) {}
    if (!savedDeck || !LS.set(boardPendingKey(), { id: msg.id, me, deckId: savedDeck.id })) { toHost({ t: 'board-failed', id: msg.id }); return true; }
    boardTransferLock = true;
    clearTimeout(boardTransferTimer); boardTransferTimer = setTimeout(() => { boardTransferLock = false; }, 30000);
    toHost({ t: 'board-ready', id: msg.id }); return true;
  }
  if (msg.t === 'board-activate') { S.table = cleanTable(msg.table); applyCommittedHandoff(); syncColorFlow(); render(); return true; }
  if (msg.t === 'board-abort') {
    const pending = LS.get(boardPendingKey(), null); if (pending && pending.id === msg.id) LS.del(boardPendingKey());
    boardTransferLock = false; UI.toast(String(msg.text || 'Handoff cancelled.'), { kind: 'warn', ms: 10000 }); return true;
  }
  if (msg.t === 'board-remap') {
    S.undo = [];
    if (S.me) { remapBoardReferences(S.me, msg.source, msg.target); saveNow(); }
    Object.values(S.players).forEach(p => remapBoardReferences(p, msg.source, msg.target));
    delete S.players[msg.source]; return true;
  }
  return false;
}
function showBoardTransfer(source) {
  const choices = [...new Set([...S.table.seats, ...Object.keys(S.pendingSeats || {})])].filter(pid => pid !== source && (pid === S.pid || S.online[pid]));
  if (!choices.length) { UI.toast('A connected recipient is required.', { kind: 'warn' }); return; }
  const modal = UI.modal({ title: `Transfer ${pname(source)}'s board`, html: `<p>Select the player who will control this board, including its private hand and library. Their previous board will be backed up locally and replaced. Use an empty replacement seat.</p><select id="ctTransferRecipient">${choices.map(pid => `<option value="${esc(pid)}">${esc(S.pendingSeats?.[pid]?.p.name || pname(pid))}</option>`).join('')}</select><p class="muted small">Disconnected boards use their latest completed room-server save. If server backup is unavailable, the original browser's saved session is needed.</p><button class="danger" id="ctTransferGo">Transfer board</button>` });
  modal.el.querySelector('#ctTransferGo').onclick = async () => {
    const to = modal.el.querySelector('select').value;
    if (!await UI.confirm(`Transfer ${pname(source)}'s complete board to ${pname(to)} and replace their current board? The old owner's seat will be removed.`, { danger: true, okLabel: 'Transfer' })) return;
    modal.close(); toHost({ t: 'op', op: { k: 'handoff', pid: source, to } });
  };
}


// =====================================================================
//  Session persistence (crash / reload recovery)
// =====================================================================
let saveT = null;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveNow, 300); }
function saveNow() {
  if (!S.me) return;
  const host = S.role !== 'client';
  queueRoomBackup();
  LS.set('ct.sess.' + S.pid, {
    v: 2, at: Date.now(), role: S.role, room: S.room, deckId: S.deckId, me: S.me, seatKeys: host ? S.seatKeys : null,
    table: host ? S.table : null, players: host ? S.players : null, log: host ? S.log.slice(-150) : null, chat: host ? S.chat.slice(-100) : null
  });
  LS.set('ct.last', S.pid);
}
function loadSession(pid) {
  const s = LS.get('ct.sess.' + pid);
  return s && s.me && Date.now() - s.at < 24 * 3600e3 ? s : null;
}
function resume(sess) {
  S.role = sess.role; S.room = sess.room; S.deckId = sess.deckId; S.me = sess.me; S.seatKeys = isObj(sess.seatKeys) ? sess.seatKeys : {};
  normalizeMe(S.me);
  S.table = cleanTable(sess.table) || null; S.players = sess.players || {}; S.log = sess.log || []; S.chat = cleanChatHistory(sess.chat); S.chatOpen = false; S.chatUnread = 0; S.online = {};
  if (S.table && S.role === 'host') S.table.hostPid = S.pid;
  if (S.table) {
    S.table.openingMode = CTMulligan.normalizeMode(S.table.openingMode);
    S.table.openingAllowances = S.table.openingAllowances || {};
    if (!S.table.openingDeal) S.table.openingDeal = uid();
    if (!S.me.openingDeal) S.me.openingDeal = S.table.openingDeal;
  }
  S.colorFlow = S.role !== 'solo' && !ownColorLocked(); S.colorRequestPending = false;
  if (S.role === 'host') Object.keys(S.players).forEach(p => { if (p !== S.pid) S.online[p] = false; });
  showGame();
  startNet();
  if (S.role === 'client') showColorPicker();
  else if (ownColorLocked()) publish(true);
  else showColorPicker();
  UI.toast(S.role === 'solo' ? 'Practice game restored.' : `Rejoined room ${S.room} — your game was restored.`);
}
function leaveGame() {
  UI.confirm('Leave this game? Your seat will be marked as out.', { danger: true, okLabel: 'Leave' }).then(ok => {
    if (!ok) return;
    if (S.table && S.table.started) toHost({ t: 'op', op: { k: 'concede' } });
    setTimeout(() => {
      try { Net.stop(); } catch (e) { /* ignore */ }
      LS.del('ct.sess.' + S.pid); LS.del('ct.last');
      S.targetArrows = []; S.arrowControlsDismissed = false; endTargeting();
      S.me = null; S.table = null; S.players = {}; S.log = []; S.undo = []; S.selected.clear();
      S.viewers.forEach(v => v.v.close());
      showLobby();
    }, 300);
  });
}

// =====================================================================
//  Lobby
// =====================================================================
let selDeck = null;
function showLobby() {
  clearResponseNotice();
  S.targetArrows = []; S.arrowControlsDismissed = false; endTargeting();
  $('#game').classList.add('hidden'); $('#lobby').classList.remove('hidden');
  refreshTouchOrientationHint();
  document.title = 'Commander Table';
  $('#nameIn').value = LS.get('ct.name', '') || '';
  renderAppearancePickers();
  selDeck = LS.get('ct.selDeck', null);
  renderDeckList();
  $('#netWarn').classList.toggle('hidden', typeof Peer !== 'undefined');
  const inv = (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ib = $('#inviteBox');
  if (inv.length === 5) {
    $('#joinIn').value = inv;
    ib.innerHTML = `<b>You're invited to room ${esc(inv)}.</b><span class="muted">Enter your name and pick a deck, then press <b>Join</b>.</span>`;
    ib.classList.remove('hidden');
  } else ib.classList.add('hidden');
  const lan = window.CT_LAN, li = $('#lanInfo');
  if (lan && lan.urls && lan.urls.length) {
    li.innerHTML = `<b>LAN game</b> — players on your network open ${lan.urls.map(u => `<code>${esc(u)}</code>`).join(' or ')}, then join with the room code.`;
    li.classList.remove('hidden');
  } else li.classList.add('hidden');
  const last = LS.get('ct.last', null);
  const sess = last && last !== S.pid ? loadSession(last) : null;
  const rb = $('#resumeBox');
  if (sess) {
    rb.innerHTML = `<b>Resume your last game?</b><span class="muted">${sess.role === 'solo' ? 'Practice game' : `Room ${esc(sess.room)} (${sess.role === 'host' ? 'you were hosting' : 'joined'})`} · ${esc(sess.me.name)}</span>
      <button class="primary" id="resumeBtn">Resume</button><button id="discardBtn" title="Keep the saved game and hide this reminder">Dismiss</button>`;
    rb.classList.remove('hidden');
    $('#resumeBtn').onclick = () => { SS.set('ct.pid', last); location.reload(); };
    $('#discardBtn').onclick = () => { rb.classList.add('hidden'); };
  } else rb.classList.add('hidden');
}
function showGame() {
  $('#lobby').classList.add('hidden'); $('#game').classList.remove('hidden');
  setChatPanelOpen(false);
  seedTurnNotice(S.table);
  refreshTouchOrientationHint();
  document.title = S.role === 'solo' ? 'Practice — Commander Table' : `${S.room} — Commander Table`;
  logLen = -1;
  render();
}
function renderDeckList() {
  const decks = Deck.list();
  if (selDeck && !decks.some(d => d.id === selDeck)) selDeck = null;
  if (!selDeck && decks.length) selDeck = decks[0].id;
  $('#deckList').innerHTML = decks.map(d => `<div class="deck-row ${d.id === selDeck ? 'sel' : ''}" data-deck="${esc(d.id)}">
      <input type="radio" name="deck" ${d.id === selDeck ? 'checked' : ''} tabindex="-1">
      <span class="dn">${esc(d.name)}</span><span class="dc">${esc(d.commanderNames.join(' + ') || 'no commander')} · ${d.count} cards</span>
      <button class="x" data-del="${esc(d.id)}" title="Delete deck">✕</button></div>`).join('');
  $('#editDeckBtn').disabled = !selDeck || !Deck.get(selDeck);
}
function bindLobby() {
  $('#ver').textContent = APP_VERSION;
  $('#cardBackPicker').addEventListener('click', e => chooseAppearance(e, 'cardBack'));
  $('#backgroundPicker').addEventListener('click', e => chooseAppearance(e, 'background'));
  $('#customBackFile').addEventListener('change', e => readCustomImage(e.target.files && e.target.files[0], 'cardBack'));
  $('#customBackgroundFile').addEventListener('change', e => readCustomImage(e.target.files && e.target.files[0], 'background'));
  $('#resetCustomBack').addEventListener('click', () => resetCustomImage('cardBack'));
  $('#resetCustomBackground').addEventListener('click', () => resetCustomImage('background'));
  $('#editDeckBtn').onclick = () => {
    if (!selDeck) { UI.toast('Select or import a saved deck first.', { kind: 'warn' }); return; }
    CTDeckEditor.open(selDeck, renderDeckList, { onHover: d => preview(d), onLeave: () => hidePreview() });
  };
  $('#deckList').addEventListener('click', async e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const d = Deck.get(del.dataset.del);
      if (d && await UI.confirm(`Delete the deck “${d.name}”?`, { danger: true, okLabel: 'Delete' })) {
        if (selDeck === d.id) CTDeckEditor.close();
        Deck.remove(d.id); renderDeckList();
      }
      return;
    }
    const row = e.target.closest('[data-deck]');
    if (row) {
      if (selDeck !== row.dataset.deck) CTDeckEditor.close();
      selDeck = row.dataset.deck; LS.set('ct.selDeck', selDeck); renderDeckList();
    }
  });
  $('#backupBtn').onclick = () => CTBackup.open();
  $('#importBtn').onclick = () => { $('#importBox').classList.remove('hidden'); $('#importBtn').classList.add('hidden'); $('#deckText').focus(); };
  $('#cancelImport').onclick = closeImport;
  $('#loadDeck').onclick = loadDeck;
  $('#nameIn').addEventListener('change', () => LS.set('ct.name', $('#nameIn').value.trim()));
  $('#hostBtn').onclick = () => begin('host');
  const hostRule = $('#hostMulligan');
  if (hostRule) {
    hostRule.value = CTMulligan.normalizeMode(LS.get('ct.openingMode', 'london'));
    hostRule.addEventListener('change', () => LS.set('ct.openingMode', CTMulligan.normalizeMode(hostRule.value)));
  }
  $('#soloBtn').onclick = () => begin('solo');
  $('#joinBtn').onclick = () => begin('client');
  $('#joinIn').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#joinIn').addEventListener('keydown', e => { if (e.key === 'Enter') begin('client'); });
}
function renderAppearancePickers() {
  const prefs = CTAppearance.getPrefs(), custom = CTAppearance.getCustom();
  $('#cardBackPicker').innerHTML = CTAppearance.renderCardBacks(custom.cardBack && custom.cardBackActive ? 'custom-local' : prefs.cardBack);
  $('#backgroundPicker').innerHTML = CTAppearance.renderBackgrounds(custom.background && custom.backgroundActive ? 'custom-local' : prefs.background);
  const rb = $('#resetCustomBack'), rg = $('#resetCustomBackground');
  if (rb) rb.disabled = !custom.cardBack;
  if (rg) rg.disabled = !custom.background;
  const bs = $('#customBackStatus'), gs = $('#customBackgroundStatus');
  if (bs) bs.textContent = custom.cardBack ? (custom.cardBackActive ? 'Saved in this browser · currently in use.' : 'Saved in this browser · not currently selected.') : 'No saved card-back image.';
  if (gs) gs.textContent = custom.background ? (custom.backgroundActive ? 'Saved in this browser · currently in use.' : 'Saved in this browser · not currently selected.') : 'No saved background image.';
}
function readCustomImage(file, kind) {
  const status = $(kind === 'cardBack' ? '#customBackStatus' : '#customBackgroundStatus');
  if (!file) return;
  status.textContent = '';
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { status.textContent = 'Choose a JPG, PNG, or WebP image.'; return; }
  if (file.size > 10 * 1024 * 1024) { status.textContent = 'That file is over 10 MB. Choose a smaller image.'; return; }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const back = kind === 'cardBack', minW = back ? 250 : 1280, minH = back ? 350 : 720;
    if (img.naturalWidth < minW || img.naturalHeight < minH) { status.textContent = 'Image is ' + img.naturalWidth + ' × ' + img.naturalHeight + 'px; minimum is ' + minW + ' × ' + minH + 'px.'; return; }
    const maxW = back ? 900 : 1600, maxH = back ? 1260 : 900;
    const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) { status.textContent = 'Your browser could not process that image.'; return; }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = 0.82, data = canvas.toDataURL('image/webp', quality);
    while (data.length > 800000 && quality > 0.4) { quality = Math.max(0.4, quality - 0.1); data = canvas.toDataURL('image/webp', quality); }
    if (data.length > 800000) { status.textContent = 'That image is still too large after optimization. Try a simpler or smaller image.'; return; }
    if (!CTAppearance.saveCustom(kind, data)) { status.textContent = 'Browser storage is full. Clear site storage or try a smaller image.'; return; }
    renderAppearancePickers();
    if (!$('#game').classList.contains('hidden')) render();
  };
  img.onerror = () => { URL.revokeObjectURL(url); status.textContent = 'The image could not be opened. Try another file.'; };
  img.src = url;
}
function resetCustomImage(kind) {
  CTAppearance.clearCustom(kind);
  const input = $(kind === 'cardBack' ? '#customBackFile' : '#customBackgroundFile');
  if (input) input.value = '';
  renderAppearancePickers();
  if (!$('#game').classList.contains('hidden')) render();
}
function chooseAppearance(e, kind) {
  const choice = e.target.closest('[data-appearance-id]');
  if (!choice) return;
  const prefs = CTAppearance.getPrefs(), id = choice.dataset.appearanceId;
  if (id === 'custom-local') {
    if (!CTAppearance.setCustomActive(kind, true)) return;
  } else {
    if (kind === 'cardBack' && !CTAppearance.backOptions.some(x => x.id === id)) return;
    if (kind === 'background' && !CTAppearance.backgroundOptions.some(x => x.id === id)) return;
    CTAppearance.setCustomActive(kind, false);
    prefs[kind] = id;
    CTAppearance.savePrefs(prefs);
  }
  renderAppearancePickers();
  if (!$('#game').classList.contains('hidden')) render();
}
function closeImport() {
  $('#importBox').classList.add('hidden'); $('#importBtn').classList.remove('hidden');
  $('#impResult').innerHTML = ''; $('#impStatus').textContent = ''; $('#deckText').value = '';
}
async function loadDeck() {
  const text = $('#deckText').value;
  const parsed = Deck.parse(text);
  if (!parsed.main.length && !parsed.commanders.length) { UI.toast('That doesn\'t look like a decklist — paste lines like “1 Sol Ring”.', { kind: 'warn' }); return; }
  const btn = $('#loadDeck'); btn.disabled = true;
  const status = $('#impStatus');
  let res;
  try {
    res = await Deck.resolve(parsed, (done, total, msg) => { status.textContent = msg || `Looking up cards… ${done}/${total}`; });
  } catch (e) {
    status.textContent = ''; btn.disabled = false;
    UI.toast(e.message || 'Card lookup failed', { kind: 'error' });
    return;
  }
  btn.disabled = false; status.textContent = '';
  showImportResult(res, text, parsed);
}
function showImportResult(res, source, parsed) {
  const box = $('#impResult');
  const total = res.commanders.length + res.cards.reduce((a, c) => a + c.qty, 0);
  const cands = res.commanders.length ? [] : Deck.commanderCandidates(res.cards);
  const opt = d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`;
  box.innerHTML = `
    <div><b>${total}</b> cards found${res.commanders.length ? ` · commander: <b>${esc(res.commanders.map(dname).join(' + '))}</b>` : ''}.
      ${total !== 100 ? '<span class="muted">(Commander decks are usually 100.)</span>' : ''}</div>
    ${res.notFound.length ? `<div class="warn">Couldn't find: ${esc(res.notFound.join(', '))}</div>` : ''}
    ${parsed.warnings && parsed.warnings.length ? `<div class="muted small">Skipped lines: ${esc(parsed.warnings.slice(0, 6).join(' · '))}</div>` : ''}
    ${!res.commanders.length ? `
      <label>No commander was marked in the list — pick it:</label>
      <select id="cmdPick1"><option value="">— choose your commander —</option>${cands.map(opt).join('')}</select>
      <label>Partner / background (optional)</label>
      <select id="cmdPick2"><option value="">— none —</option>${cands.map(opt).join('')}</select>` : ''}
    <label>Deck name</label><input id="deckName" maxlength="60" value="${esc(res.name || '')}">
    <div class="row" style="margin-top:10px"><button class="primary" id="saveDeck">Save deck</button></div>`;
  $('#saveDeck').onclick = () => {
    const commanders = res.commanders.slice();
    let cards = res.cards.map(c => ({ def: c.def, qty: c.qty }));
    if (!commanders.length) {
      const ids = [$('#cmdPick1').value, $('#cmdPick2').value].filter(Boolean);
      if (!ids.length) { UI.toast('Pick your commander first.', { kind: 'warn' }); return; }
      for (const id of [...new Set(ids)]) {
        const e = cards.find(c => c.def.id === id);
        if (!e) continue;
        commanders.push(e.def);
        e.qty -= 1;
      }
      cards = cards.filter(c => c.qty > 0);
    }
    const name = $('#deckName').value.trim() || commanders.map(dname).join(' + ') || 'Untitled deck';
    try {
      const saved = Deck.save({ name, commanders, cards, tokens: res.tokens || [], source });
      selDeck = saved.id; LS.set('ct.selDeck', selDeck);
      closeImport(); renderDeckList();
      UI.toast(`Saved “${name}”.`);
    } catch (e) { UI.toast(e.message || 'Could not save the deck', { kind: 'error' }); }
  };
}
async function begin(role) {
  const name = $('#nameIn').value.trim();
  if (!name) { UI.toast('Enter your name first.', { kind: 'warn' }); $('#nameIn').focus(); return; }
  LS.set('ct.name', name);
  const deck = selDeck && Deck.get(selDeck);
  if (!deck) { UI.toast('Import or pick a deck first.', { kind: 'warn' }); return; }
  let room = null;
  if (role === 'client') {
    room = $('#joinIn').value.trim().toUpperCase();
    if (room.length !== 5) { UI.toast('Enter the 5-character room code from the host.', { kind: 'warn' }); $('#joinIn').focus(); return; }
  }
  if (role === 'client') {
    const saved = savedRoomSession(room);
    if (saved) {
      const restore = await UI.confirm(`A saved seat for ${saved.sess.me.name} exists in room ${room}. Resume it to keep your board, hand and library?`, { title: 'Resume your existing seat', okLabel: 'Resume seat', cancelLabel: 'Different player' });
      if (restore) { S.pid = saved.pid; SS.set('ct.pid', S.pid); resume(saved.sess); return; }
      if (!await UI.confirm('Create a separate seat instead? Use a different name; your saved seat will remain available.', { okLabel: 'Join separately', cancelLabel: 'Cancel' })) return;
    }
  }
  if (role !== 'solo' && typeof Peer === 'undefined') { UI.toast('Online play needs an internet connection — try Practice solo.', { kind: 'error' }); return; }
  if (role === 'host') room = Net.makeRoomCode();
  try { // the invite has done its job; keep any ?net= override
    const u = new URL(location.href);
    if (u.searchParams.has('join')) { u.searchParams.delete('join'); history.replaceState(null, '', u.href); }
  } catch (e) { /* ignore */ }
  S.role = role; S.room = room; S.deckId = deck.id;
  S.players = {}; S.log = []; S.online = {}; S.undo = [];
  const openingMode = role === 'host' ? CTMulligan.normalizeMode($('#hostMulligan').value) : 'london';
  const openingDeal = role === 'client' ? null : uid();
  S.me = newPlayer(deck, name, null, openingMode, openingDeal);
  S.table = role === 'client' ? null : newTable(room, openingMode, openingDeal);
  S.colorFlow = role !== 'solo'; S.colorRequestPending = false;
  S.net = { state: role === 'solo' ? 'online' : 'connecting', text: '' };
  showGame();
  startNet();
  if (role === 'host') showColorPicker();
  else if (role === 'client') showColorPicker();
  else publish(true);
  saveNow();
  if (role === 'host') UI.toast(`You're hosting room ${room}. Click the code at the top-left to copy an invite link for your friends.`, { ms: 8000 });
  if (role === 'solo') sysLog('Practice game started. Use “Start game” to begin turn tracking.');
}

// =====================================================================
//  Boot
// =====================================================================
function boot() {
  window.addEventListener('beforeunload', e => { if (S.me && S.role !== 'solo') { e.preventDefault(); e.returnValue = ''; } });
  document.body.classList.toggle('touch-mode', S.touchMode);
  updateTouchViewportHeight();
  refreshTouchOrientationHint();
  const updateMobileViewport = () => {
    updateTouchViewportHeight();
    refreshTouchOrientationHint();
  };
  window.addEventListener('resize', updateMobileViewport, { passive: true });
  window.addEventListener('orientationchange', updateMobileViewport, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateMobileViewport, { passive: true });
  let pid = SS.get('ct.pid', null);
  if (!pid) { pid = 'p' + uid(); SS.set('ct.pid', pid); }
  S.pid = pid;
  bindLobby(); bindGame();
  window.addEventListener('beforeunload', saveNow);
  const sess = loadSession(pid);
  if (sess) resume(sess); else showLobby();
}
// Expose a little for debugging from the console.
window.CT = { S, act, render, dragState: () => drag, hostRecv, cleanTable };
// ---- stay on one version -----------------------------------------------------------------------
// GitHub Pages lets browsers reuse cached files for 10 minutes. index.html links every file with ?v=<version>
// (tools/bump-version.py), so a new page never pulls old files. If this script and the page that loaded it
// still disagree, reload once from a fresh URL. And if a new version goes live while the game is open, say so.
const PAGE_VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || APP_VERSION;
const newerVersion = (a, b) => {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};
function freshUrl(v) { const u = new URL(location.href); u.searchParams.set('v', v); return u.href; }
function versionGuard() {
  if (PAGE_VERSION === APP_VERSION) return false;
  const k = 'ct.verfix.' + PAGE_VERSION;
  if (SS.get(k, false)) return false; // already tried once: don't loop
  SS.set(k, true);
  location.replace(freshUrl(PAGE_VERSION));
  return true;
}
let updateNoticed = false;
async function checkForNewVersion() {
  if (updateNoticed || location.protocol === 'file:' || window.CT_LAN) return; // LAN games use js/updates.js
  try {
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('check', Date.now());
    const m = (await (await fetch(u.href, { cache: 'no-store' })).text()).match(/<meta name="app-version" content="([^"]+)"/);
    if (!m || !newerVersion(m[1], APP_VERSION)) return;
    updateNoticed = true;
    UI.toast(`Version ${m[1]} is out — reload to get it (your game carries on).`, { ms: 3600000, action: { label: 'Reload', onClick: () => { saveNow(); location.replace(freshUrl(m[1])); } } });
  } catch (e) { /* offline: try again later */ }
}
// tests/net-harness.html loads the page with ?nettest to drive Net directly, without the app.
if (!new URLSearchParams(location.search).has('nettest') && !versionGuard()) {
  boot();
  setTimeout(checkForNewVersion, 5000);
  setInterval(checkForNewVersion, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForNewVersion(); });
}
})();
