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

const APP_VERSION = '0.7.1';

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
const OLD_BW = 1400; // board width of clients before v0.7 (they don't send `bw`)
const myBH = () => (S.me && S.me.bh) || BH;
const DEFAULT_LAYOUT = [
  // library / graveyard / exile / command zone live in the bottom row, not on the board
  { k: 'creatures', label: 'Creatures / Planeswalkers', x: 0, y: 0, w: 1000, h: 250 },
  { k: 'lands', label: 'Lands', x: 0, y: 260, w: 540, h: 170 },
  { k: 'permanents', label: 'Artifacts / Enchantments', x: 550, y: 260, w: 450, h: 170 }
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
    const v = LS.get('ct.view', 'top');
    W = innerWidth * (v === 'side' || v === 'focus' ? 0.8 : 1);
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
  undo: [],
  net: { state: 'offline', text: '' },
  hover: null,      // {pid, iid}
  dragging: false,
  dragEndAt: 0,
  arrange: false,   // editing my zone layout
  focus: null,      // opponent pid shown large
  autoFocus: LS.get('ct.autoFocus', true) !== false, // follow the active player in Focus view
  attachFrom: null, // iid waiting for an attach target
  attachToast: null,
  regionDrag: null,
  viewers: new Set()
};

const pname = pid => (pid === S.pid && S.me) ? S.me.name : ((S.players[pid] && S.players[pid].name) || 'Someone');
function colorOf(pid) {
  const seats = (S.table && S.table.seats) || [];
  const i = seats.indexOf(pid);
  if (i >= 0) return COLORS[i % COLORS.length];
  let h = 0; for (const ch of String(pid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

// =====================================================================
//  Player state
// =====================================================================
function newPlayer(deck, name, prev) {
  const m = {
    pid: S.pid, name, life: 40, poison: 0, ctr: {}, cmdDmg: {}, casts: {}, mull: 0, kept: false,
    revealHand: false, revealTop: false, seq: 0, lastTurn: 0,
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
  m.zones.hand = m.zones.library.splice(0, 7);
  return m;
}
// Bring older saved games up to the current shape (layout + card positions).
function normalizeMe(m) {
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
function snapshot() { const { defs, ...rest } = S.me; return JSON.stringify(rest); }
function pushUndo() { S.undo.push(snapshot()); if (S.undo.length > 40) S.undo.shift(); }
function act(fn, opts) {
  if (!S.me) return;
  if (!(opts && opts.noUndo)) pushUndo();
  const r = fn();
  if (Array.isArray(r) && r[0]) say(r[0], r[1]);
  commit();
}
function commit() { publish(); saveSoon(); render(); }
function undo() {
  const s = S.undo.pop();
  if (!s) { UI.toast('Nothing to undo'); return; }
  const defs = S.me.defs;
  S.me = JSON.parse(s); S.me.defs = defs;
  say('undid their last action');
  commit();
}

// =====================================================================
//  Public view + messaging
// =====================================================================
function pubCard(c) {
  const pos = { x: c.x, y: c.y, att: c.att || null };
  if (c.fd) return Object.assign({ iid: c.iid, fd: 1, t: c.t ? 1 : 0, c: c.c, own: c.own, tok: c.tok ? 1 : 0 }, pos);
  return Object.assign({ iid: c.iid, id: c.id, t: c.t ? 1 : 0, fl: c.fl ? 1 : 0, c: c.c, own: c.own, tok: c.tok ? 1 : 0, cmd: c.cmd ? 1 : 0, cp: c.cp ? 1 : 0,
    pb: c.pb || undefined, dp: c.dp || 0, dt: c.dt || 0 }, pos);
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
    pid: m.pid, bw: BW, name: m.name, life: m.life, poison: m.poison, ctr: m.ctr, cmdDmg: m.cmdDmg, cmdrs: m.cmdrs,
    casts: m.casts, hand: z.hand.length, lib: z.library.length, kept: m.kept, layout: m.layout, bh: myBH(),
    zones: { battlefield: take(z.battlefield), graveyard: take(z.graveyard), exile: take(z.exile), command: take(z.command) },
    revHand: m.revealHand ? take(z.hand) : null,
    revTop: m.revealTop && z.library.length ? take([z.library[0]]) : null,
    defs
  };
}
let pubTimer = null;
function publish(now) { clearTimeout(pubTimer); pubTimer = setTimeout(doPublish, now ? 0 : 120); }
function doPublish() { if (!S.me) return; toHost({ t: 'pub', p: publicView() }); }

function toHost(msg) { if (S.role === 'client') Net.send(msg); else hostRecv(msg, S.pid); }
function broadcast(msg) { if (S.role === 'host') Net.send(msg); onBroadcast(msg); }
function sendReq(to, req) { if (to === S.pid) onReq(req, S.pid); else toHost({ t: 'req', to, req }); }
function say(text, cards) {
  const cs = (cards || []).filter(Boolean).slice(0, 8).map(d => ({ id: d.id || '', name: dname(d), img: d.img || '', imgBack: d.imgBack || '' }));
  toHost({ t: 'log', text, cards: cs });
}

// ----- host side -----
function newTable(room) {
  return { room, seats: [S.pid], order: [], active: null, turn: 0, phase: 3, started: false, monarch: null, initiative: null, out: {} };
}
function hostRecv(msg, from) {
  if (!msg || typeof msg.t !== 'string' || !S.table) return;
  switch (msg.t) {
    case 'pub': {
      const p = cleanPub(msg.p, from); if (!p) return;
      S.players[from] = p;
      seat(from);
      broadcast({ t: 'pub', p });
      break;
    }
    case 'log': { const e = cleanLog(msg, from); if (e) broadcast({ t: 'log', e }); break; }
    case 'op': tableOp(msg.op, from); break;
    case 'req': {
      if (typeof msg.to !== 'string') return;
      if (msg.to === S.pid) onReq(msg.req, from);
      else if (S.role === 'host') Net.sendTo(msg.to, { t: 'req', from, req: msg.req });
      break;
    }
    case 'tsync': {
      // A player reconnected with a copy of the table. If it's newer than ours (the host
      // reloaded before its last change was saved), adopt it; otherwise ignore it.
      const t = cleanTable(msg.table);
      if (!t || t.room !== S.table.room || t.rev <= (S.table.rev || 0) || !t.seats.includes(S.pid)) return;
      S.table = t;
      sysLog(`Restored the latest table state (turn ${t.turn}) from ${pname(from)}.`);
      afterTable();
      pushTable();
      break;
    }
  }
}
function seat(pid) {
  const T = S.table;
  if (T.seats.includes(pid) || T.seats.length >= 6) return;
  T.seats.push(pid);
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
  return {
    room: String(t.room || '').slice(0, 8), seats: ids(t.seats), order: ids(t.order), active: str(t.active),
    turn: Math.max(0, num(t.turn)), phase: clamp(num(t.phase, 3), 0, PHASES.length - 1), started: !!t.started,
    monarch: str(t.monarch), initiative: str(t.initiative),
    out: isObj(t.out) ? Object.fromEntries(Object.keys(t.out).slice(0, 8).map(k => [k.slice(0, 40), !!t.out[k]])) : {},
    rev: Math.max(0, num(t.rev))
  };
}
function sysLog(text) { broadcast({ t: 'log', e: { ts: Date.now(), pid: null, name: '', text, cards: [] } }); }
function tableOp(op, from) {
  const T = S.table;
  if (!isObj(op) || typeof op.k !== 'string') return;
  const isHost = from === S.pid;
  switch (op.k) {
    case 'start': {
      if (!isHost) return;
      T.order = shuffle(T.seats.filter(p => !T.out[p]));
      T.active = T.order[0]; T.turn = 1; T.phase = 3; T.started = true;
      sysLog(`Game started! Turn order: ${T.order.map(pname).join(' → ')}. ${pname(T.active)} goes first.`);
      break;
    }
    case 'pass': {
      if (!T.started) return;
      // Ignore a pass meant for a turn that's already over (double click by two players,
      // or a pass that arrives late after a reconnect) so a turn is never skipped.
      if (op.turn != null && num(op.turn) !== T.turn) return;
      const live = T.order.filter(p => !T.out[p]);
      if (!live.length) return;
      const i = live.indexOf(T.active);
      T.active = live[(i + 1) % live.length]; T.turn++; T.phase = 3;
      sysLog(`Turn ${T.turn}: ${pname(T.active)}${from !== T.active && from !== live[i] ? ` (passed by ${pname(from)})` : ''}`);
      break;
    }
    case 'phase': T.phase = clamp(num(op.v), 0, PHASES.length - 1); break;
    case 'monarch': T.monarch = T.seats.includes(op.pid) ? op.pid : null;
      sysLog(T.monarch ? `${pname(T.monarch)} is the monarch 👑` : 'Nobody is the monarch.'); break;
    case 'initiative': T.initiative = T.seats.includes(op.pid) ? op.pid : null;
      sysLog(T.initiative ? `${pname(T.initiative)} has the initiative 🏰` : 'Nobody has the initiative.'); break;
    case 'concede': {
      T.out[from] = true;
      sysLog(`${pname(from)} left the game.`);
      if (T.active === from && T.started) { tableOp({ k: 'pass' }, from); return; }
      break;
    }
    case 'kick': {
      if (!isHost || op.pid === S.pid) return;
      T.seats = T.seats.filter(p => p !== op.pid); T.order = T.order.filter(p => p !== op.pid);
      if (T.active === op.pid) T.active = T.order[0] || null;
      sysLog(`${pname(op.pid)} was removed from the table.`);
      delete S.players[op.pid];
      break;
    }
    case 'newgame': {
      if (!isHost) return;
      Object.assign(T, { order: [], active: null, turn: 0, phase: 3, started: false, monarch: null, initiative: null, out: {} });
      pushTable();
      broadcast({ t: 'newgame' });
      sysLog('New game — everyone reshuffled and drew 7.');
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
    pid: from, name: String(p.name || 'Player').slice(0, 24), life: num(p.life, 40), poison: num(p.poison),
    ctr: numMap(p.ctr), cmdDmg: numMap(p.cmdDmg), casts: numMap(p.casts),
    cmdrs: Array.isArray(p.cmdrs) ? p.cmdrs.slice(0, 3).filter(isObj).map(c => ({ iid: String(c.iid).slice(0, 40), name: String(c.name || '').slice(0, 80) })) : [],
    hand: num(p.hand), lib: num(p.lib), kept: !!p.kept,
    layout: cleanLayout(p.layout) || cloneLayout(DEFAULT_LAYOUT), bh: clamp(num(p.bh, BH), BH, BH_MAX),
    zones: { battlefield: cleanCards(z.battlefield), graveyard: cleanCards(z.graveyard), exile: cleanCards(z.exile), command: cleanCards(z.command, 4) },
    revHand: p.revHand ? cleanCards(p.revHand, 60) : null, revTop: p.revTop ? cleanCards(p.revTop, 1) : null,
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
function onBroadcast(msg) {
  switch (msg.t) {
    case 'pub': if (msg.p && msg.p.pid) { S.players[msg.p.pid] = msg.p; if (msg.p.pid !== S.pid) checkOrphans(); } break;
    case 'log': S.log.push(msg.e); if (S.log.length > 300) S.log.splice(0, S.log.length - 300); break;
    case 'table': S.table = msg.table; afterTable(); break;
    case 'online': S.online = msg.online || {}; break;
    case 'newgame': resetForNewGame(); break;
    default: return;
  }
  saveSoon(); render();
}
function clientRecv(msg) {
  if (!msg) return;
  if (msg.t === 'snap') {
    S.table = msg.table; S.players = msg.players || {}; S.log = msg.log || []; S.online = msg.online || {};
    S.players[S.pid] = publicView();
    checkOrphans();
    afterTable(); saveSoon(); render();
    return;
  }
  if (msg.t === 'req') { onReq(msg.req, msg.from); return; }
  onBroadcast(msg);
}
function snapFor() { return { t: 'snap', table: S.table, players: S.players, log: S.log.slice(-150), online: S.online }; }

// Requests from other players, applied to MY state.
function onReq(req, from) {
  if (!isObj(req) || typeof req.k !== 'string') return;
  if (req.k === 'give' || req.k === 'return') {
    const c = cleanCards([req.card], 1)[0]; const d = isObj(req.def) ? req.def : null;
    if (!c || !d || typeof d.id !== 'string') return;
    const zone = req.k === 'give' ? 'battlefield' : (ZONES.includes(req.zone) ? req.zone : 'graveyard');
    act(() => {
      if (!S.me.defs[d.id]) S.me.defs[d.id] = d;
      if (findCard(c.iid)) return null; // already have it (duplicate message)
      const card = { iid: c.iid, id: d.id, own: c.own || from, t: zone === 'battlefield' ? !!c.t : false, fl: false, fd: false, c: zone === 'battlefield' ? c.c : {}, tok: !!c.tok, cmd: !!c.cmd, cp: !!c.cp };
      if (req.k === 'return' && card.tok) return null;
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
  if (req.k === 'life') {
    const d = clamp(num(req.d), -100, 100);
    if (d) changeLife(d, pname(from));
  }
  if (req.k === 'cmddmg' && typeof req.key === 'string' && req.key.startsWith(from + ':')) {
    // another player dealt me damage with their own commander
    const d = clamp(num(req.d), -21, 21);
    if (d) changeCmdDmg(req.key.slice(0, 90), d);
  }
}

// After the shared table changes: run my turn-start automation once per turn.
function afterTable() {
  const T = S.table, m = S.me;
  if (!T || !m) return;
  if (!T.started) return;
  if (T.active === S.pid && T.turn > (m.lastTurn || 0)) {
    m.lastTurn = T.turn;
    const skipDraw = T.turn === 1 && T.order.length === 2; // 2-player: first player skips first draw
    const bits = [];
    act(() => {
      if (m.autoUntap && m.zones.battlefield.some(c => c.t)) { m.zones.battlefield.forEach(c => { c.t = false; }); bits.push('untapped'); }
      if (m.autoDraw && !skipDraw && m.zones.library.length) { m.zones.hand.push(m.zones.library.shift()); bits.push('drew a card'); }
      return bits.length ? [bits.join(' and ')] : null;
    }, { noUndo: true });
  }
}
function resetForNewGame() {
  const deck = Deck.get(S.deckId);
  if (!deck) { UI.toast('Your deck is missing from this browser — cannot restart.', { kind: 'error' }); return; }
  S.me = newPlayer(deck, S.me.name, S.me);
  S.undo = [];
  publish(true);
}

// =====================================================================
//  Card moves
// =====================================================================
function insertCard(card, to, opts = {}) {
  const z = S.me.zones[to];
  if (to === 'library') { if (opts.pos === 'bottom') z.push(card); else z.unshift(card); } else z.push(card);
  if (to === 'battlefield') {
    if (opts.x != null) { card.x = clamp(Math.round(opts.x), 0, BW - CW); card.y = clamp(Math.round(opts.y), 0, myBH() - CH); }
    else if (card.x == null) autoPlace(card, to);
  }
  if (to === 'battlefield') {
    const d = defOf(card);
    if (d && d.loyalty && !card.c.Loyalty && /Planeswalker/.test(d.type || '')) card.c.Loyalty = parseInt(d.loyalty, 10) || 0;
  }
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
  lost.forEach(c => { c.att = null; if (c.x == null) autoPlace(c, 'battlefield'); });
  orphanToast(lost);
  publish(); saveSoon();
}
// Low-level move; returns info for logging or null.
function moveCard(iid, to, opts = {}) {
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
  if (!res || res.repos) return;
  const { card, def } = res;
  if (res.orphans && res.orphans.length) orphanToast(res.orphans);
  if (card.cmd && !res.gone && to !== 'command' && to !== 'battlefield' && card.own === S.pid) {
    UI.toast(`${dname(def)} went to your ${ZL[to]}.`, { ms: 8000, action: { label: 'Move to command zone', onClick: () => doMove(iid, 'command') } });
  }
  if (to === 'battlefield' && res.from !== 'battlefield' && def && def.tokens && def.tokens.length && !card.fd) suggestTokens(def);
}
function suggestTokens(def) {
  const toks = def.tokens.map(id => S.me.defs[id]).filter(Boolean);
  if (!toks.length) return;
  if (toks.length === 1) {
    UI.toast(`${dname(def)} makes tokens`, { ms: 7000, action: { label: `+ ${dname(toks[0])}`, onClick: () => createToken(toks[0]) } });
  } else {
    UI.toast(`${dname(def)} makes tokens`, { ms: 7000, action: { label: 'Choose token…', onClick: () => {
      const r = $('#myBf').getBoundingClientRect();
      UI.menu(r.left + 40, r.top + 20, toks.map(t => ({ label: tokenLabel(t), onClick: () => createToken(t) })));
    } } });
  }
}
const tokenLabel = t => `${dname(t)}${t.pt ? ' ' + t.pt : ''}${t.type ? ' — ' + t.type.replace(/^Token /, '') : ''}`;

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

function draw(n = 1) {
  const z = S.me.zones; let k = 0;
  act(() => { while (k < n && z.library.length) { z.hand.push(z.library.shift()); k++; } return k ? [`drew ${plural(k, 'card')}`] : null; });
  if (k < n) UI.toast('Your library is empty!', { kind: 'warn' });
}
function untapAll() { act(() => { S.me.zones.battlefield.forEach(c => { c.t = false; }); return ['untapped everything']; }); }
function shuffleLib() { act(() => { shuffle(S.me.zones.library); return ['shuffled their library']; }); }
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
  const m = /^(-?\d+)\/(-?\d+)$/.exec(base);
  const cnt = ((c.c && c.c['+1/+1']) || 0) - ((c.c && c.c['-1/-1']) || 0);
  const dp = (c.dp || 0) + cnt, dt = (c.dt || 0) + cnt;
  const modified = !!(c.pb || dp || dt);
  if (m) return { text: `${+m[1] + dp}/${+m[2] + dt}`, modified };
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
  act(() => {
    S.me.defs[def.id] = S.me.defs[def.id] || def;
    for (let i = 0; i < n; i++) insertCard(mkCard(def, { tok: true }), 'battlefield');
    if (!S.me.tokens.includes(def.id)) S.me.tokens.push(def.id);
    return [`created ${n > 1 ? n + ' ' : 'a '}{0} token${n > 1 ? 's' : ''}`, [def]];
  });
}
// A copy behaves like a token (it ceases to exist off the battlefield) but is labelled COPY.
function copyCard(def, flipped, tapped) {
  if (!def || !def.id) return;
  act(() => {
    S.me.defs[def.id] = S.me.defs[def.id] || def;
    insertCard(mkCard(def, { tok: true, cp: true, t: !!tapped, fl: !!(flipped && (def.imgBack || def.backName)) }), 'battlefield');
    return [`created a ${tapped ? 'tapped ' : ''}copy of {0}`, [def]];
  });
}
// --- switch a card's printing (art). Everyone sees the new art; the choice is saved to the deck.
async function switchPrinting(iid) {
  const f = findCard(iid); const d = f && defOf(f.card);
  if (!d || !d.name) return;
  const t = UI.toast(`Finding printings of ${dname(d)}…`, { ms: 4000 });
  let prints;
  try { prints = await Deck.fetchPrints(d.name, 10); } catch (e) { UI.toast(e.message || 'Could not load printings', { kind: 'error' }); return; }
  finally { if (t && t.close) t.close(); }
  if (!prints.length) { UI.toast(`No other printings found for ${dname(d)}.`); return; }
  const copies = ZONES.reduce((n, z) => n + S.me.zones[z].filter(c => !c.tok && S.me.defs[c.id] && S.me.defs[c.id].name === d.name).length, 0);
  UI.printPicker({
    title: `Switch printing for ${d.name}`, prints, currentId: d.id, showAll: copies > 1,
    onPick: (nd, scope) => applyPrinting(iid, d, nd, scope)
  });
}
function applyPrinting(iid, oldDef, nd, scope) {
  let n = 0;
  act(() => {
    S.me.defs[nd.id] = Object.assign({}, nd, { tokens: (oldDef.tokens && oldDef.tokens.length ? oldDef.tokens : nd.tokens) || [] });
    for (const z of ZONES) for (const c of S.me.zones[z]) {
      const same = scope === 'all' && !c.tok && S.me.defs[c.id] && S.me.defs[c.id].name === oldDef.name;
      if (c.iid === iid || same) { c.id = nd.id; n++; }
    }
    const where = nd.setName ? ` (${nd.setName}${nd.cn ? ' #' + nd.cn : ''})` : '';
    return [`switched ${n > 1 ? n + ' copies of ' : ''}{0} to another printing${where}`, [nd]];
  });
  // Remember it for future games: update the saved deck's copy of this card.
  try {
    const deck = Deck.get(S.deckId);
    if (deck) {
      let changed = false;
      deck.commanders = deck.commanders.map(c => (c.name === oldDef.name ? (changed = true, nd) : c));
      deck.cards.forEach(e => { if (e.def.name === oldDef.name && (scope === 'all' || e.qty === 1)) { e.def = nd; changed = true; } });
      if (changed) { Deck.save(deck); UI.toast('Saved — your deck will use this printing next game too.', { ms: 3000 }); }
    }
  } catch (e) { console.warn('could not save printing to deck', e); }
}
// Works from any zone (menu or drag-and-drop). `at` = where on their board it lands.
function giveControl(iid, to, at) {
  const f = findCard(iid); if (!f) return;
  const d = defOf(f.card);
  act(() => {
    S.me.zones[f.zone].splice(f.idx, 1);
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
function returnControl(iid) {
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
  act(() => {
    if (lifeLog.from == null) lifeLog.from = S.me.life;
    if (by) lifeLog.by = by;
    S.me.life += d;
  }, { noUndo: !!by });
  clearTimeout(lifeLog.timer);
  lifeLog.timer = setTimeout(() => {
    if (lifeLog.from !== S.me.life) say(`life ${lifeLog.from} → ${S.me.life}${lifeLog.by ? ` (by ${lifeLog.by})` : ''}`);
    lifeLog.from = null; lifeLog.by = '';
  }, 1400);
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
  if (cur + d < 0) return;
  act(() => { S.me.cmdDmg[key] = cur + d; if (S.me.cmdDmg[key] === 0) delete S.me.cmdDmg[key]; });
  changeLife(-d);
  const [opid, ciid] = key.split(':');
  const cm = ((S.players[opid] && S.players[opid].cmdrs) || []).find(c => c.iid === ciid);
  clearTimeout(cdLog[key]);
  cdLog[key] = setTimeout(() => {
    const v = S.me.cmdDmg[key] || 0;
    say(`has taken ${v} commander damage from ${pname(opid)}'s ${cm ? cm.name : 'commander'}`);
    if (v >= 21) UI.toast(`21+ commander damage from ${cm ? cm.name : 'one commander'} — that's lethal.`, { kind: 'error', ms: 6000 });
  }, 1400);
}

// --- mulligan (London, first one free in Commander)
function mulligan() {
  act(() => {
    const z = S.me.zones;
    z.library.push(...z.hand.splice(0));
    shuffle(z.library);
    z.hand = z.library.splice(0, 7);
    S.me.mull++;
    return [`took a mulligan (#${S.me.mull}${S.me.mull === 1 ? ', free' : ''})`];
  });
}
function keepHand() {
  const n = Math.max(0, S.me.mull - 1);
  if (!n) { act(() => { S.me.kept = true; return [`kept their opening hand${S.me.mull ? ` after ${plural(S.me.mull, 'mulligan')}` : ''}`]; }); return; }
  pushUndo();
  let picked = 0;
  UI.viewer({
    title: `Put ${plural(n, 'card')} on the bottom`,
    cards: S.me.zones.hand.map(c => ({ iid: c.iid, def: defOf(c) })),
    actions: [],
    pick: { count: n, actionKey: 'bottom', prompt: `You took ${plural(S.me.mull, 'mulligan')} (first one free): choose ${n} to put on the bottom` },
    onAction: (k, iid) => {
      moveCard(iid, 'library', { pos: 'bottom' });
      if (++picked === n) { S.me.kept = true; say(`kept ${S.me.zones.hand.length} cards after ${plural(S.me.mull, 'mulligan')}`); commit(); }
    },
    onHover: d => preview(d)
  });
}

// =====================================================================
//  Zone viewers (searchable graveyard / exile / library)
// =====================================================================
const MOVE_ACTIONS = [
  { key: 'hand', label: 'To hand', hint: 'H' }, { key: 'battlefield', label: 'To battlefield', hint: 'B' },
  { key: 'bftapped', label: 'To battlefield tapped' }, { key: 'graveyard', label: 'To graveyard', hint: 'G' },
  { key: 'exile', label: 'Exile', hint: 'X' }, { key: 'top', label: 'Library — top' }, { key: 'bottom', label: 'Library — bottom' },
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
    if (faceDown) return [`exiled the top ${plural(moved.length, 'card')} face down`];
    const refs = moved.slice(0, 8).map((_, i) => `{${i}}`).join(', ');
    return [`${to === 'graveyard' ? 'milled' : 'exiled from the top'} ${moved.length}: ${refs}${moved.length > 8 ? '…' : ''}`, moved];
  });
}
function revealTop() {
  const c = S.me.zones.library[0];
  if (!c) return UI.toast('Library is empty');
  say('revealed the top card of their library: {0}', [defOf(c)]);
}
function discardRandom() {
  const h = S.me.zones.hand;
  if (!h.length) return UI.toast('No cards in hand');
  doMove(h[rnd(h.length)].iid, 'graveyard');
}

// --- tokens
function tokensMenu(x, y) {
  const toks = S.me.tokens.map(id => S.me.defs[id]).filter(Boolean).sort((a, b) => dname(a).localeCompare(dname(b)));
  const items = toks.map(t => ({ label: tokenLabel(t), onClick: () => createToken(t) }));
  if (!items.length) items.push({ label: 'No tokens linked to this deck', disabled: true });
  items.push({ sep: true }, { label: 'Search all tokens…', onClick: searchTokens });
  UI.menu(x, y, items);
}
async function searchTokens() {
  const q = await UI.prompt({ title: 'Create a token', label: 'Search tokens (e.g. Goblin, Treasure, Zombie, 1/1 Soldier)' });
  if (!q) return;
  let res;
  try { res = await Deck.searchTokens(String(q)); } catch (e) { UI.toast(e.message || 'Token search failed', { kind: 'error' }); return; }
  if (!res.length) { UI.toast(`No tokens found for “${q}”`); return; }
  const byIid = {};
  const cards = res.map(d => { byIid['tk_' + d.id] = d; return { iid: 'tk_' + d.id, def: d }; });
  UI.viewer({
    title: `Tokens matching “${q}”`, cards,
    actions: [{ key: 'one', label: 'Create 1' }, { key: 'many', label: 'Create several…' }], primary: 'one',
    onAction: async (k, iid) => {
      const d = byIid[iid]; if (!d) return;
      let n = 1;
      if (k === 'many') { n = await UI.prompt({ title: `How many ${dname(d)} tokens?`, type: 'number', value: 2, min: 1, max: 60 }); if (!n) return; }
      createToken(d, n);
    },
    onHover: d => preview(d)
  });
}
async function relatedToken(id) {
  let d = S.me.defs[id];
  if (!d) {
    try { d = await Deck.fetchById(id); } catch (e) { UI.toast('Could not load that token', { kind: 'error' }); return; }
  }
  createToken(d);
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
      items.push({ label: 'Create related token', sub: d.tokens.map(id => ({ label: S.me.defs[id] ? tokenLabel(S.me.defs[id]) : 'Token', onClick: () => relatedToken(id) })) });
    }
    if (opps.length) items.push({ label: 'Give control to', sub: opps.map(p => ({ label: pname(p), onClick: () => giveControl(iid, p) })) });
    if (c.own !== S.pid) items.push({ label: `Return control to ${pname(c.own)}`, onClick: () => returnControl(iid) });
  }
  if (z === 'hand') {
    items.push({ label: 'Play', hint: 'B', onClick: () => doMove(iid, 'battlefield') });
    if (attachable) items.push({ label: /Equipment/.test(d.type || '') ? 'Play & equip to…' : 'Cast & attach to…', onClick: () => startAttach(iid) });
    items.push({ label: 'Play tapped', onClick: () => doMove(iid, 'battlefield', { tapped: true }) });
    items.push({ label: 'Play face down', onClick: () => doMove(iid, 'battlefield', { faceDown: true }) });
    items.push({ label: 'Reveal to everyone', onClick: () => say('revealed {0} from their hand', [d]) });
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
  const c = (p.revHand || []).find(x => x.iid === iid);
  return c ? { c, def: c.id ? p.defs[c.id] : null } : null;
}
function oppCardMenu(x, y, pid, iid) {
  const f = oppCard(pid, iid);
  if (!f) return;
  UI.menu(x, y, [
    { label: 'View information', disabled: !f.def, onClick: () => viewInfo(f.def) },
    { label: 'Copy this card', disabled: !f.def, hint: f.def ? '' : 'face down', onClick: () => copyCard(f.def, f.c.fl) }
  ]);
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
    { label: 'Increment power', hint: 'Alt+1', onClick: () => changePT(iid, 1, 0) },
    { label: 'Decrement power', hint: 'Alt+3', onClick: () => changePT(iid, -1, 0) },
    { label: 'Increment toughness', hint: 'Alt+2', onClick: () => changePT(iid, 0, 1) },
    { label: 'Decrement toughness', hint: 'Alt+4', onClick: () => changePT(iid, 0, -1) },
    { label: '+1/+1 until reset', onClick: () => changePT(iid, 1, 1) },
    { sep: true },
    { label: 'Reset power/toughness', disabled: !mod, onClick: () => resetPT(iid) }
  ];
}
function libraryMenu(x, y) {
  UI.menu(x, y, [
    { label: 'Draw', hint: 'D', onClick: () => draw(1) },
    { label: 'Draw X…', onClick: async () => { const n = await UI.prompt({ title: 'Draw cards', type: 'number', value: 2, min: 1, max: 30 }); if (n) draw(n); } },
    { label: 'Shuffle', onClick: shuffleLib },
    { sep: true },
    { label: 'Search library…', hint: 'S', onClick: () => viewZone(S.pid, 'library') },
    { label: 'Look at top X (scry)…', onClick: () => lookTop() },
    { label: 'Reveal top card', onClick: revealTop },
    { label: 'Play with top card revealed', checked: S.me.revealTop, onClick: () => act(() => { S.me.revealTop = !S.me.revealTop; return [S.me.revealTop ? 'is playing with the top card revealed' : 'stopped revealing the top card']; }) },
    { sep: true },
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
    { label: T.monarch === pid ? 'Remove monarch' : 'Make monarch 👑', onClick: () => toHost({ t: 'op', op: { k: 'monarch', pid: T.monarch === pid ? null : pid } }) },
    { label: T.initiative === pid ? 'Remove initiative' : 'Give initiative 🏰', onClick: () => toHost({ t: 'op', op: { k: 'initiative', pid: T.initiative === pid ? null : pid } }) }
  ];
  const p = S.players[pid];
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
  if (S.role !== 'client' && pid !== S.pid) {
    items.push({ sep: true }, { label: 'Remove from table', danger: true, onClick: async () => {
      if (await UI.confirm(`Remove ${pname(pid)} from the table? Use this only if they're not coming back.`, { danger: true, okLabel: 'Remove' })) toHost({ t: 'op', op: { k: 'kick', pid } });
    } });
  }
  UI.menu(x, y, items);
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
function mainMenu(x, y) {
  const m = S.me;
  const items = [
    { label: 'Draw a card', hint: 'D', onClick: () => draw(1) },
    { label: 'Untap all', hint: 'U', onClick: untapAll },
    { label: 'Tokens…', onClick: () => tokensMenu(x, y) },
    { sep: true },
    { label: S.arrange ? 'Done arranging zones' : 'Arrange my zones', onClick: toggleArrange },
    { label: 'Tidy up my cards', onClick: () => act(() => { tidyBoard(); return ['tidied up their battlefield']; }) },
    { label: 'Display settings…', onClick: displaySettings },
    { sep: true },
    { label: 'Auto-untap on my turn', checked: m.autoUntap, onClick: () => act(() => { m.autoUntap = !m.autoUntap; }, { noUndo: true }) },
    { label: 'Auto-draw on my turn', checked: m.autoDraw, onClick: () => act(() => { m.autoDraw = !m.autoDraw; }, { noUndo: true }) },
    { label: 'Reveal my hand to everyone', checked: m.revealHand, onClick: () => act(() => { m.revealHand = !m.revealHand; return [m.revealHand ? 'revealed their hand' : 'stopped revealing their hand']; }) },
    { label: 'Discard at random', onClick: discardRandom },
    { sep: true }
  ];
  if (S.role !== 'client') items.push({ label: 'Start a new game (everyone)', onClick: async () => {
    if (await UI.confirm('Start a new game? Everyone reshuffles their deck and draws 7.', { okLabel: 'New game' })) toHost({ t: 'op', op: { k: 'newgame' } });
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
  if (S.arrange) UI.toast('Drag a zone by its name to move it (its cards come along). Drag the corner to resize. Everyone sees your layout.', { ms: 7000 });
  render();
}
// Pass turn sits next to Draw / Untap all (highlighted on your turn; greyed until the game starts).
function passBtn() {
  const T = S.table, started = !!(T && T.started), mine = started && T.active === S.pid;
  return `<div class="ztool"><button data-a="pass" class="${mine ? 'primary' : ''}"${started ? '' : ' disabled'} title="Pass the turn to the next player">Pass turn ▶</button></div>`;
}
function toggleFocus(pid) { S.focus = S.focus === pid ? null : pid; render(); }
function displaySettings() {
  const r0 = window.Lens ? Lens.getRadius() : 90;
  const m = UI.modal({ title: 'Display settings', html: `
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
      <label class="display-check"><input id="ctAutoFocus" type="checkbox" ${S.autoFocus ? 'checked' : ''}><span>Auto-focus the active player in Focus view</span></label>
      <p class="display-note">Saved in this browser only; doesn't change what other players see.</p>
    </div>` });
  const hs = m.el.querySelector('#ctHandSize'), hv = m.el.querySelector('#ctHandValue');
  const setHand = v => { setHandSize(clamp(num(v, 82), 60, 160)); LS.set('ct.handCw', S.handCw); hs.value = S.handCw; hv.textContent = S.handCw + 'px'; };
  hs.addEventListener('input', () => setHand(hs.value));
  m.el.querySelector('#ctHandReset').addEventListener('click', () => setHand(82));
  const lens = m.el.querySelector('#ctLensSize'), lv = m.el.querySelector('#ctLensValue');
  lens.addEventListener('input', () => { const r = window.Lens ? Lens.setRadius(+lens.value) : +lens.value; lv.textContent = r + 'px'; });
  m.el.querySelector('#ctAutoFocus').addEventListener('change', e => {
    S.autoFocus = e.target.checked;
    LS.set('ct.autoFocus', S.autoFocus);
    render();
  });
}
// Current view mode; with no opponents there's only one sensible layout.
function curView() {
  if (!S.view) S.view = LS.get('ct.view', 'top');
  return oppPids().length ? (['top', 'side', 'grid', 'focus'].includes(S.view) ? S.view : 'top') : 'top';
}

// =====================================================================
//  Rendering
// =====================================================================
let rq = false;
function render() {
  if (rq) return;
  rq = true;
  // rAF is paused in background tabs; the timeout keeps a hidden tab's board current anyway.
  let done = false;
  const run = () => { if (done) return; done = true; rq = false; if (!S.dragging) renderNow(); else render(); };
  requestAnimationFrame(run);
  setTimeout(run, 150);
}
function renderNow() {
  if (!S.me || $('#game').classList.contains('hidden')) return;
  const idx = buildIndex();
  renderTop(); renderOpps(idx); renderMine(idx); renderLog();
  fitBoards();
  S.viewers.forEach(v => { try { v.refresh(); } catch (e) { console.error(e); } });
}

function cardHTML(c, def, o) {
  // o: {mine, pid (board owner), ctrl (who controls it), zone, style}
  const ctrl = o.ctrl || o.pid;
  const cls = ['card'];
  if (c.t) cls.push('tapped'); if (o.mine) cls.push('mine'); if (c.att) cls.push('att');
  let inner;
  if (c.fd) {
    inner = UI.cardBackHTML() + (o.mine && def ? `<span class="fdname">${esc(dname(def))}</span>` : '');
  } else {
    const back = c.fl && def && def.imgBack;
    const u = def ? (back ? def.imgBack : def.img) : '';
    const rot = c.fl && def && !def.imgBack ? ' class="rot"' : '';
    inner = IMG_OK(u)
      ? `<img src="${esc(u)}"${rot} alt="${esc(def.name)}" loading="lazy" draggable="false">`
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
      badges += `<span class="pt${pt.modified ? ' mod' : ''}" title="Power/toughness${def && def.pt ? ' (printed ' + esc(def.pt) + ')' : ''} — left-click +1/+1, right-click −1/−1">${esc(pt.text)}</span>`;
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
  const extra = (c.cp ? '<span class="tk cp" title="A copy — it disappears when it leaves the battlefield">COPY</span>' : c.tok ? '<span class="tk">TOKEN</span>' : '') +
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
function boardHTML(pid, idx) {
  const mine = pid === S.pid;
  const p = mine ? null : S.players[pid];
  const layout = mine ? S.me.layout : (p.layout || DEFAULT_LAYOUT);
  const editing = mine && S.arrange;
  let html = layout.map(r => `<div class="region" data-region="${esc(r.k)}" style="left:${num(r.x)}px;top:${num(r.y)}px;width:${num(r.w)}px;height:${num(r.h)}px">
    <span class="rlabel">${esc(r.label)}</span>${editing ? ['nw', 'ne', 'sw', 'se'].map(c => `<span class="grip ${c}" data-c="${c}" title="Drag to resize"></span>`).join('') : ''}</div>`).join('');
  let z = 10;
  const place = (e, zone, x, y, zi) => cardHTML(e.c, e.def, { mine: e.ctrl === S.pid, pid, ctrl: e.ctrl, zone, style: `left:${x}px;top:${y}px;z-index:${zi}` });
  for (const e of idx.entries) {
    if (e.ctrl !== pid || (e.c.att && !e.orphan)) continue;
    const x = num(e.c.x, 10), y = num(e.c.y, 20);
    const list = idx.atts.get(pid + '|' + e.c.iid) || [];
    const up = y >= 22 * list.length; // attachments peek out above the host (or below if there's no room)
    list.forEach((a, k) => { html += place(a, 'battlefield', x, up ? y - 22 * (k + 1) : y + 22 * (k + 1), z + list.length - k); });
    html += place(e, 'battlefield', x, y, z + list.length + 1);
    z += list.length + 2;
  }
  const bh = mine ? myBH() : ((p && p.bh) || BH);
  return `<div class="board${editing ? ' arrange' : ''}" data-pid="${esc(pid)}" style="height:${bh}px">${html}</div>`;
}
// Untouched default zones follow the board's shape in the current view: zones and the cards in them
// spread vertically (cards keep their size), so switching Top / Sidebar / Grid never shrinks the cards.
function stretchAutoLayout(W, H) {
  const m = S.me, bottom = Math.max(...m.layout.map(r => r.y + r.h));
  const target = clamp(Math.round(Math.min(BW * H / W, 800)), BH, BH_MAX);
  if (!bottom || Math.abs(target - bottom) <= 4) return;
  const f = target / bottom;
  m.layout.forEach(r => { r.y = Math.round(r.y * f); r.h = Math.round(r.h * f); });
  m.zones.battlefield.forEach(c => { if (c.y != null && !c.att) c.y = clamp(Math.round(c.y * f), 0, target - CH); });
  m.bh = 0;
  saveSoon(); publish(); setTimeout(render, 0);
}
function fitBoards() {
  document.querySelectorAll('.boardwrap').forEach(w => {
    const b = w.firstElementChild; if (!b) return;
    const W = w.clientWidth, H = w.clientHeight; if (!W || !H) return;
    const thumb = w.classList.contains('thumb'), pid = thumb ? w.dataset.board.slice(6) : w.dataset.board;
    if (pid === S.pid && !thumb && S.me && S.me.layoutAuto && !S.arrange && !S.dragging) stretchAutoLayout(W, H);
    const bh = pid === S.pid && S.me ? (thumb ? myBH() : myBoardHeight(W, H)) : ((S.players[pid] && S.players[pid].bh) || BH);
    b.style.height = bh + 'px';
    // Boards always fit their area (never scroll); hold V to magnify cards instead.
    const s = Math.min(W / BW, H / bh);
    const ox = Math.max(0, (W - BW * s) / 2);
    b.style.transform = `translate(${ox}px,0) scale(${s})`;
    b.dataset.s = s; b.dataset.ox = ox; b.dataset.oy = 0;
    b.style.setProperty('--inv', (1 / s).toFixed(3)); // lets labels stay a readable size at any zoom
  });
  fitOppArea();
}
// Opponents' boards keep their shape, so a tall opponents' area just leaves blank space under
// them. Shrink that area to what the boards actually need (never more than the user's splitter).
function fitOppArea() {
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
    library: { n: mine ? z.library.length : num(p.lib), top: mine ? (S.me.revealTop && z.library[0]) : (p.revTop && p.revTop[0]), label: 'Library' },
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
    d.face = d.top ? cardFace(d.top, defs) : (k === 'library' && d.n ? UI.cardBackHTML() : '');
  }
  return out;
}
// My bottom-right zones: Draw/Untap, LIB, GY, EXILE, CMD (with clickable commander tax).
function myZonesHTML() {
  const pi = pileInfo(S.pid), me = S.me;
  const box = (k, label, sub) => `<div class="zbox" data-pile="${k}" data-pid="${esc(S.pid)}" data-drop="${k}" title="${esc(pi[k].tip)}">
      <div class="zlabel">${label} <b>${pi[k].n}</b>${sub ? ` <span class="zsub">${sub}</span>` : ''}</div><div class="zcard">${pi[k].face}</div></div>`;
  const cmd = me.zones.command;
  const taxIid = (cmd[0] && cmd[0].iid) || (me.cmdrs[0] && me.cmdrs[0].iid) || '';
  const tax = taxIid ? 2 * (me.casts[taxIid] || 0) : 0;
  // Draw / Untap all each have a small switch beside them: on = happens automatically at the start of your turn
  const auto = (key, on, what) => `<label class="tgl" title="Auto: ${what} at the start of your turn (${on ? 'on' : 'off'})"><input type="checkbox" data-a="${key}"${on ? ' checked' : ''}><span></span></label>`;
  return `<div class="ztools">
      <div class="ztool"><button data-a="draw" title="Draw (D)">Draw</button>${auto('autodraw', me.autoDraw, 'Draw a card')}</div>
      <div class="ztool"><button data-a="untapall" title="Untap all (U)">Untap all</button>${auto('autountap', me.autoUntap, 'Untap everything')}</div>
      ${passBtn()}</div>` +
    box('library', 'LIB') + box('graveyard', 'GY', pi.graveyard.n ? `${pi.graveyard.tc.perm}P` : '') + box('exile', 'EXILE') +
    `<div class="zbox cmdbox" data-drop="command">
      ${taxIid ? `<div class="taxchip" data-a="tax" data-iid="${esc(taxIid)}" title="Commander tax — left-click +2, right-click −2">🪙 <b>${tax}</b></div>` : ''}
      <div class="zlabel">CMD</div>
      <div class="zcard cmdcards">${cmd.map(c => cardHTML(c, defOf(c), { mine: true, pid: S.pid, zone: 'command' })).join('')}</div></div>`;
}
// Life box + expandable counters panel (EDHPlay style). Mine is editable; opponents' life +/- sends a request.
function lifeBoxHTML(pid) {
  const mine = pid === S.pid;
  const p = mine ? null : S.players[pid];
  const life = mine ? S.me.life : p.life;
  const open = mine ? S.ctrOpen === S.pid : S.ctrOpen === pid;
  const a = mine ? 'life' : 'olife';
  const vals = mine ? Object.assign({ Poison: S.me.poison }, S.me.ctr) : Object.assign({ Poison: p.poison }, p.ctr || {});
  const rows = Object.keys(PLAYER_CTR_ICONS).map(k => `<div class="ctrrow"><span class="ci">${PLAYER_CTR_ICONS[k]}</span><span class="cn">${k}</span><b>${vals[k] || 0}</b>` +
    (mine ? `<button data-a="pctr" data-k="${k}" data-d="-1">−</button><button data-a="pctr" data-k="${k}" data-d="1">+</button>` : '<span></span><span></span>') + '</div>').join('');
  const any = Object.keys(PLAYER_CTR_ICONS).filter(k => vals[k]).map(k => `${PLAYER_CTR_ICONS[k]}${vals[k]}`).join(' ');
  return `<span class="lifebox" title="Life${mine ? ' (Shift-click: ±5)' : ` — changing it asks ${esc(p.name)}'s game to apply it`}">
      <button data-a="${a}" data-pid="${esc(pid)}" data-d="-1">−</button><b class="lifeN">${life}</b><button data-a="${a}" data-pid="${esc(pid)}" data-d="1">+</button>
      <button class="more" data-a="ctrs" data-pid="${esc(pid)}" title="Poison, energy, experience, rad, tickets">${any ? esc(any) + ' ' : ''}▾</button></span>` +
    (open ? `<div class="ctrpanel">${rows}</div>` : '');
}
// Colored commander-damage tags: the damage `victim` has taken from each other player's commander(s).
function cmdTagsHTML(victim) {
  const vMine = victim === S.pid;
  const dmg = vMine ? S.me.cmdDmg : ((S.players[victim] || {}).cmdDmg || {});
  const sources = ((S.table && S.table.seats) || []).filter(p => p !== victim && (p === S.pid ? S.me.cmdrs.length : S.players[p]));
  const tags = [];
  for (const src of sources) {
    const cmdrs = src === S.pid ? S.me.cmdrs : (S.players[src].cmdrs || []);
    for (const cm of cmdrs) {
      const key = src + ':' + cm.iid, v = dmg[key] || 0;
      const can = vMine || src === S.pid; // I track my own damage, and can deal damage with my commander
      tags.push(`<span class="cdtag${vMine ? ' mine' : can ? ' can' : ''}${v >= 21 ? ' lethal' : ''}${v ? '' : ' zero'}" style="--tc:${colorOf(src)}"${can ? ` data-a="cdmg" data-k="${esc(key)}" data-pid="${esc(victim)}"` : ''}
        title="${esc(vMine ? 'You have' : pname(victim) + ' has')} taken ${v} commander damage from ${esc(pname(src))}'s ${esc(cm.name)}${can ? ' — left-click +1, right-click −1' : ''}">${v}</span>`);
    }
  }
  return tags.length ? `<span class="cdtags">${tags.join('')}</span>` : '';
}
function pileHTML(zone, cards, defs, o, extraTop) {
  const n = cards.length;
  let top = '';
  if (zone === 'library') top = extraTop ? cardFace(extraTop, defs) : (n ? UI.cardBackHTML() : '');
  else if (n) top = cardFace(cards[n - 1], defs);
  const lbl = { library: 'Library', graveyard: 'Graveyard', exile: 'Exile' }[zone];
  return `<div class="pile" data-pile="${zone}" data-pid="${esc(o.pid)}"${o.mine ? ` data-drop="${zone}"` : ''} title="${lbl}">
    <div class="pcard">${top}</div><div class="plabel">${lbl} <b>${n}</b></div></div>`;
}
function cardFace(c, defs) {
  const d = c.id && defs[c.id];
  if (c.fd || !d) return UI.cardBackHTML();
  return IMG_OK(d.img) ? `<img src="${esc(d.img)}" alt="" loading="lazy" draggable="false" data-pvid="${esc(d.id)}">` : `<div class="ph">${esc(dname(d))}</div>`;
}

function renderTop() {
  const T = S.table;
  $('#roomBtn').textContent = S.role === 'solo' ? 'SOLO' : (S.room || '');
  $('#roomBtn').disabled = S.role === 'solo';
  const pill = $('#netPill');
  const st = S.role === 'solo' ? 'online' : S.net.state;
  pill.className = 'pill ' + st;
  pill.textContent = S.role === 'solo' ? 'Practice' : ({ online: 'Connected', connecting: 'Connecting…', reconnecting: 'Reconnecting…', offline: 'Offline', error: 'Error' }[st] || st);
  pill.title = S.net.text || '';
  let html;
  if (!T) html = `<span class="muted">${esc(S.net.text || 'Connecting to the host…')}</span>`;
  else if (!T.started) {
    html = `<span class="muted">Not started · ${plural(T.seats.length, 'player')} seated</span>` +
      (S.role !== 'client' ? ' <button class="primary" data-a="start" title="Randomizes turn order">Start game</button>' : ' <span class="muted">— waiting for the host to start</span>');
  } else {
    const mine = T.active === S.pid;
    html = `<span>Turn <b>${T.turn}</b> · <b style="color:${colorOf(T.active)}">${esc(mine ? 'Your' : pname(T.active) + "'s")}</b> turn</span>`;
  }
  $('#turnBox').innerHTML = html;
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
  if (view === 'focus' && S.autoFocus) {
    const active = S.table && S.table.started ? S.table.active : null;
    S.focus = active && active !== S.pid && pids.includes(active) ? active : null;
  }
  if (S.focus && !pids.includes(S.focus)) S.focus = null;
  box.className = 'n' + pids.length;
  const tbl = $('#table');
  tbl.classList.toggle('noopps', !pids.length);
  // Focus reuses sidebar geometry but follows the active player into the large slot.
  ['top', 'side', 'grid', 'focus'].forEach(v => tbl.classList.toggle('view-' + v, v === view));
  tbl.classList.toggle('view-side', view === 'side' || view === 'focus');
  document.body.classList.toggle('view-side', view === 'side' || view === 'focus');
  document.body.classList.toggle('view-focus', view === 'focus');
  document.body.classList.toggle('view-grid', view === 'grid');
  tbl.dataset.n = pids.length;
  tbl.classList.toggle('has-focus', !!S.focus && view !== 'top');
  document.querySelectorAll('.viewsw [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (S.view || 'top')));
  // keep one stable element per opponent
  const have = new Map([...box.children].map(el => [el.dataset.opp, el]));
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
  const sideLike = view === 'side' || view === 'focus';
  let you = box.querySelector('.youtile');
  if (sideLike && pids.length) {
    if (!you) { you = document.createElement('div'); you.className = 'opp youtile'; you.innerHTML = '<div class="ohead"></div><div class="obody"><div class="obf"></div></div>'; }
    if (box.firstElementChild !== you) box.insertBefore(you, box.firstElementChild);
    renderYouTile(you, idx);
  } else if (you) you.remove();
  // rows in the right-hand column: everyone not shown in the big area (+ the YOU tile)
  tbl.style.setProperty('--rows', Math.max(1, (sideLike && pids.length ? 1 : 0) + pids.length - (S.focus && view !== 'top' ? 1 : 0)));
}
// The YOU tile: a read-only miniature of my board while I'm looking at someone else's; just a label otherwise.
function renderYouTile(el, idx) {
  const viewingMe = !S.focus, T = S.table || {};
  el.classList.toggle('viewing', viewingMe);
  el.classList.toggle('active', T.active === S.pid);
  el.querySelector('.ohead').innerHTML = `<span class="dot" style="--pc:${colorOf(S.pid)}"></span><span class="pname">${esc(S.me.name)}</span><span class="tag you">YOU</span>
    ${T.active === S.pid ? '<span class="tag">TURN</span>' : ''}<span class="life-ro">♥ <b>${S.me.life}</b></span>`;
  // strip ids so the miniature never answers clicks/drags meant for my real board
  el.querySelector('.obf').innerHTML = viewingMe ? '<div class="viewing-note">👁 Viewing your board</div>'
    : `<div class="boardwrap thumb" data-board="thumb:${esc(S.pid)}">${boardHTML(S.pid, idx).replace(/ data-(iid|pid|zone|region|c)="[^"]*"/g, '')}</div>`;
}
function renderOpp(el, pid, idx) {
  const p = S.players[pid], T = S.table || {}, defs = p.defs || {};
  const o = { mine: false, pid };
  el.classList.toggle('active', T.active === pid);
  const off = S.role !== 'solo' && S.online[pid] === false;
  el.classList.toggle('offline', off);
  el.classList.toggle('out', !!(T.out && T.out[pid]));
  el.classList.toggle('mini', curView() === 'top' && !!S.focus && S.focus !== pid);
  el.classList.toggle('focus', S.focus === pid);
  const pi = pileInfo(pid);
  const oz = (k, label, sub) => `<span class="oz" data-pile="${k}" data-pid="${esc(pid)}" title="${esc(pi[k].tip)}${k === 'library' ? '' : ' — click to search'}">${label} <b>${pi[k].n}</b>${sub ? ` <span class="zsub">${sub}</span>` : ''}</span>`;
  const cmdCards = (p.zones.command || []).map(c => cardHTML(c, c.id && defs[c.id], Object.assign({}, o, { zone: 'command' }))).join('');
  // their hand, right next to their commander: a small fan of card backs (face up only if they revealed it) + the count
  const revealed = !!(p.revHand && p.revHand.length);
  const handN = num(p.hand);
  const shown = revealed ? p.revHand.length : Math.min(handN, 10);
  const mid = (shown - 1) / 2, step = shown > 1 ? Math.min(6, 40 / shown) : 0;
  const fan = i => { const off = i - mid; return `--rot:${(off * step).toFixed(1)}deg;--arc:${(mid ? 3 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}`; };
  const handCards = revealed
    ? p.revHand.map((c, i) => cardHTML(c, c.id && defs[c.id], Object.assign({}, o, { zone: 'hand', style: fan(i) }))).join('')
    : Array.from({ length: shown }, (_, i) => `<div class="card oback" style="${fan(i)}">${UI.cardBackHTML()}</div>`).join('');
  const handHTML = `<span class="ohhand${revealed ? ' revealed' : ''}${handN ? '' : ' empty'}" title="${esc(p.name)} has ${plural(handN, 'card')} in hand${revealed ? ' (revealed — hover to read)' : ''}">${handCards}<b class="ohn">${handN}</b></span>`;
  el.querySelector('.ohead').innerHTML = `<span class="dot" style="--pc:${colorOf(pid)}"></span>
    <span class="pname" data-phead="${esc(pid)}" title="Right-click for options">${esc(p.name)}</span>
    ${off ? '<span class="tag off">RECONNECTING</span>' : ''}${T.out && T.out[pid] ? '<span class="tag off">OUT</span>' : ''}
    ${T.active === pid ? '<span class="tag">TURN</span>' : ''}${T.monarch === pid ? '<span title="Monarch">👑</span>' : ''}${T.initiative === pid ? '<span title="Initiative">🏰</span>' : ''}
    ${lifeBoxHTML(pid)}
    ${cmdTagsHTML(pid)}
    <span class="ozones">${oz('library', 'LIB')}${oz('graveyard', 'GY', pi.graveyard.n ? pi.graveyard.tc.perm + 'P' : '')}${oz('exile', 'EX')}</span>
    ${handHTML}
    ${cmdCards ? `<span class="ocmd" title="Command zone">${cmdCards}</span>` : ''}
    ${!p.kept ? '<span class="muted small">mulliganing…</span>' : ''}`;
  el.querySelector('.obf').innerHTML = `<div class="boardwrap" data-board="${esc(pid)}">${boardHTML(pid, idx)}</div>`;
}

function renderMine(idx) {
  const m = S.me, z = m.zones, T = S.table || {};
  const o = { mine: true, pid: S.pid };
  $('#mine').classList.toggle('active', T.active === S.pid);
  // --- bar: name, life box (+ counters panel), colored commander-damage tags, actions
  $('#myBar').innerHTML = `<span class="dot" style="--pc:${colorOf(S.pid)}"></span><span class="pname" data-phead="${esc(S.pid)}" title="Right-click for options">${esc(m.name)}</span>
    ${T.monarch === S.pid ? '<span title="Monarch">👑</span>' : ''}${T.initiative === S.pid ? '<span title="Initiative">🏰</span>' : ''}
    ${lifeBoxHTML(S.pid)}
    ${cmdTagsHTML(S.pid)}
    ${S.arrange ? `<span class="mb-actions"><button data-a="tidy" title="Put every card back into its zone">Tidy cards</button><button data-a="resetzones">Reset zones</button>
      <button data-a="arrange" class="primary" title="Finish moving and resizing your zones">✓ Done arranging</button></span>` : ''}`;
  // --- battlefield, hand, bottom-right zones
  $('#myBf').innerHTML = `<div class="boardwrap" data-board="${esc(S.pid)}">${boardHTML(S.pid, idx)}</div>`;
  // fan the hand: each card tilts a little away from the middle and dips on a gentle arc (CSS uses --rot / --arc)
  const nh = z.hand.length, mid = (nh - 1) / 2, step = nh > 1 ? Math.min(3, 28 / nh) : 0;
  $('#myHand').innerHTML = z.hand.map((c, i) => {
    const off = i - mid;
    return cardHTML(c, defOf(c), Object.assign({}, o, { zone: 'hand',
      // arc is normalised so the outermost cards dip at most ~12px however big the hand is
      style: `--rot:${(off * step).toFixed(2)}deg;--arc:${(mid ? 12 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}` }));
  }).join('');
  $('#handLabel').innerHTML = `HAND <b>${z.hand.length}</b>`;
  $('#myHand').style.setProperty('--n', Math.max(1, z.hand.length)); // CSS overlaps cards so the hand never scrolls
  $('#myZones').innerHTML = myZonesHTML();
  const mb = $('#mullBar');
  if (!m.kept) {
    const next = m.mull === 0 ? 'next mulligan is free' : `next mulligan: put ${m.mull} on the bottom`;
    mb.innerHTML = `<b>Opening hand</b> <button class="primary" data-a="keep">Keep ${z.hand.length}${m.mull > 1 ? ` (bottom ${m.mull - 1})` : ''}</button>
      <button data-a="mull">Mulligan</button><span class="muted small">${next}</span>`;
    mb.classList.remove('hidden');
  } else mb.classList.add('hidden');
}

let logLen = -1, logLast = null;
function renderLog() {
  const box = $('#log');
  const last = S.log[S.log.length - 1] || null;
  if (logLen === S.log.length && logLast === last && box.childElementCount) return;
  logLen = S.log.length; logLast = last;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = S.log.slice(-200).map((e, i, arr) => {
    const li = S.log.length - arr.length + i;
    const time = new Date(e.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const text = esc(e.text).replace(/\{(\d)\}/g, (m0, n) => {
      const c = e.cards && e.cards[+n];
      return c ? `<span class="cref" data-li="${li}" data-ci="${n}">${esc(c.name)}</span>` : '';
    });
    return e.pid ? `<div class="le"><span class="ts">${time}</span><b style="color:${colorOf(e.pid)}">${esc(e.name)}</b> ${text}</div>`
      : `<div class="le sys"><span class="ts">${time}</span>${text}</div>`;
  }).join('');
  if (atBottom) box.scrollTop = box.scrollHeight;
}

// --- preview panel
// Floating preview: follows the cursor while you hover a card; hidden while dragging / magnifying.
let pvMouse = { x: 0, y: 0 };
function placePv() {
  const pv = $('#pv'); if (!pv || pv.classList.contains('hidden')) return;
  const w = pv.offsetWidth, h = pv.offsetHeight, gap = 18, m = 8;
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
  if (hidden) { pv.innerHTML = `<div class="pv-imgs">${UI.cardBackHTML()}</div><div class="pv-tag">Face-down card</div>`; return; }
  const imgs = [def.img, def.imgBack].filter(IMG_OK);
  // The card image carries its own text; only show text when there's no image (or a COPY / attached tag).
  pv.innerHTML = (imgs.length
    ? `<div class="pv-imgs ${imgs.length > 1 ? 'two' : ''}">${imgs.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>`
    : `<div class="pv-txt"><b>${esc(def.name || '')}</b>${def.mana ? ' ' + esc(def.mana) : ''}${def.type ? `<br><span class="muted">${esc(def.type)}</span>` : ''}${def.oracle ? `<br>${esc(def.oracle)}` : ''}${def.pt ? `<br><b>${esc(def.pt)}</b>` : ''}</div>`) +
    (tag ? `<div class="pv-tag"><span class="tag ${tag === 'Copy' ? 'cp' : ''}">${esc(tag.toUpperCase())}</span></div>` : '');
}
const tagOf = c => (c.cp ? 'Copy' : c.tok ? 'Token' : '');
function previewFromEl(cardEl) {
  const pid = cardEl.dataset.pid, iid = cardEl.dataset.iid;
  S.hover = { pid, iid };
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
//  Events
// =====================================================================
let drag = null; // a card being dragged with the pointer
function bindGame() {
  const g = $('#game');
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
    const tile = ['side', 'focus'].includes(curView()) && t.closest('#opps .opp:not(.focus)');
    if (tile && !t.closest('button, .life, .lifebox, .oz, [data-pile], .ohhand, .ctrpanel, .cdchip, .ocmd')) {
      const pid = tile.classList.contains('youtile') ? null : tile.dataset.opp;
      if (tile.classList.contains('youtile') && !S.focus) return;
      if (curView() === 'focus' && S.autoFocus) { S.autoFocus = false; LS.set('ct.autoFocus', false); }
      S.focus = pid; render();
      return;
    }
    const ctr = t.closest('.ctr');
    const card = t.closest('.card');
    if (ctr && card && card.dataset.pid === S.pid) { addCounter(card.dataset.iid, ctr.dataset.ctr, 1); return; }
    const ptb = t.closest('.badges .pt');
    if (ptb && card && card.dataset.pid === S.pid) { changePT(card.dataset.iid, 1, 1); return; }
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
    if (S.attachFrom) { endAttach(); return; }
    // right-click = go back one step on tax, counters, P/T and commander damage
    const tax = e.target.closest('[data-a="tax"]');
    if (tax) { changeTax(tax.dataset.iid, -1); return; }
    const tag = e.target.closest('.cdtag[data-a="cdmg"]');
    if (tag) { cmdDmgClick(tag, -1); return; }
    const rcard = e.target.closest('.card');
    const rctr = e.target.closest('.ctrs .ctr');
    if (rctr && rcard && rcard.dataset.pid === S.pid) { addCounter(rcard.dataset.iid, rctr.dataset.ctr, -1); return; }
    const rpt = e.target.closest('.badges .pt');
    if (rpt && rcard && rcard.dataset.pid === S.pid) { changePT(rcard.dataset.iid, -1, -1); return; }
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
  document.addEventListener('pointerdown', hidePreview, true);

  // ---- pointer-driven dragging: cards (anywhere) and zones (arrange mode)
  g.addEventListener('pointerdown', e => {
    if (e.button !== 0 || S.attachFrom) return;
    const handle = e.target.closest('.board.arrange .rlabel, .board.arrange .grip');
    if (handle && handle.closest('.board').dataset.pid === S.pid) { startRegionDrag(e, handle); return; }
    // dragging one of my piles drags its top card (library: top of deck; graveyard/exile: newest)
    const pile = e.target.closest('.zbox[data-pile]');
    if (pile) {
      if (pile.dataset.pid !== S.pid) return;
      const list = S.me.zones[pile.dataset.pile] || [];
      const top = pile.dataset.pile === 'library' ? list[0] : list[list.length - 1];
      if (top) drag = { iid: top.iid, el: pile.querySelector('.zcard') || pile, sx: e.clientX, sy: e.clientY, moved: false };
      return;
    }
    const card = e.target.closest('.card');
    if (!card || card.dataset.pid !== S.pid || e.target.closest('.ctr')) return;
    drag = { iid: card.dataset.iid, el: card, sx: e.clientX, sy: e.clientY, moved: false };
  });
  window.addEventListener('pointermove', e => {
    if (S.regionDrag) { regionMove(e); return; }
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
    if (S.regionDrag) { regionEnd(); return; }
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    S.dragEndAt = Date.now();
    d.ghost.remove();
    d.el.classList.remove('dragging');
    clearHighlights();
    S.dragging = false;
    try { dropCard(d, e); } finally { render(); }
  });
  window.addEventListener('pointercancel', () => {
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
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); LS.set('ct.split', S.split); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  });
  setSplit(LS.get('ct.split', 0.38));

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
  const gh = el.cloneNode(true);
  gh.classList.add('card', 'ghost'); // 'card' too: a pile being dragged ghosts as a card
  gh.removeAttribute('style');
  gh.style.cssText = `width:${w}px;height:${h}px;--cw:${w}px;left:0;top:0;`;
  document.body.appendChild(gh);
  // keep the grab point: pointer offset from the card's visual centre
  drag.offC = { dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
  drag.gx = drag.offC.dx + w / 2; drag.gy = drag.offC.dy + h / 2;
  drag.ghost = gh; drag.moved = true;
  const f = findCard(drag.iid);
  drag.attachable = !!(f && isAttachable(defOf(f.card)));
  el.classList.add('dragging');
  S.dragging = true;
  UI.closeMenu && UI.closeMenu();
}
function clearHighlights() { document.querySelectorAll('.dropok,.dropattach').forEach(x => x.classList.remove('dropok', 'dropattach')); }
// Convert a screen point to logical board coordinates for one board wrapper.
function boardPoint(wrap, clientX, clientY) {
  const b = wrap.firstElementChild, s = +b.dataset.s || 1, ox = +b.dataset.ox || 0, oy = +b.dataset.oy || 0, rect = wrap.getBoundingClientRect();
  return { x: (clientX - rect.left - ox) / s, y: (clientY - rect.top - oy) / s };
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
  const tcard = el.closest('.board .card');
  if (d.attachable && tcard && tcard.dataset.iid !== d.iid && tcard.dataset.zone === 'battlefield') {
    attachTo(d.iid, tcard.dataset.pid, tcard.dataset.iid);
    return;
  }
  const wrap = el.closest('.boardwrap');
  if (wrap && wrap.dataset.board === S.pid) {
    const pt = boardPoint(wrap, e.clientX - d.offC.dx, e.clientY - d.offC.dy);
    doMove(d.iid, 'battlefield', { x: pt.x - CW / 2, y: pt.y - CH / 2 });
    return;
  }
  if (wrap && wrap.dataset.board && wrap.dataset.board !== S.pid && S.players[wrap.dataset.board]) {
    // Dropped on a friend's board: they get control of it, centred where it was dropped. (The grab
    // offset is measured at our own board's zoom, so it doesn't apply to a differently scaled board.)
    const pt = boardPoint(wrap, e.clientX, e.clientY);
    giveControl(d.iid, wrap.dataset.board, { x: pt.x - CW / 2, y: pt.y - CH / 2 });
    return;
  }
  const tgt = el.closest('[data-drop]');
  if (tgt) {
    const zone = tgt.dataset.drop;
    if (zone === 'hand' && f.zone === 'hand') { reorderHand(d.iid, e.clientX); return; }
    doMove(d.iid, zone, zone === 'library' ? { pos: e.shiftKey ? 'bottom' : 'top' } : {});
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
  pushUndo();
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
    case 'poison': act(() => { S.me.poison = Math.max(0, S.me.poison + d); return S.me.poison >= 10 && d > 0 ? ['has 10+ poison counters ☠'] : null; }); break;
    case 'pctr': act(() => {
      const k = btn.dataset.k;
      if (k === 'Poison') { S.me.poison = Math.max(0, S.me.poison + d); return S.me.poison >= 10 && d > 0 ? ['has 10+ poison counters ☠'] : null; }
      S.me.ctr[k] = (S.me.ctr[k] || 0) + d; if (S.me.ctr[k] <= 0) delete S.me.ctr[k];
    }); break;
    case 'ctrs': S.ctrOpen = S.ctrOpen === btn.dataset.pid ? null : btn.dataset.pid; render(); break;
    case 'tax': changeTax(btn.dataset.iid, 1); break;
    case 'addctr': UI.menu(r.left, r.bottom + 4, PLAYER_COUNTERS.map(k => ({ label: k, onClick: () => act(() => { S.me.ctr[k] = (S.me.ctr[k] || 0) + 1; }) }))); break;
    case 'cdmg': cmdDmgClick(btn, 1); break;
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
    case 'menu': mainMenu(r.right - 240, r.bottom + 4); break;
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
      if (curView() === 'focus' && S.autoFocus) { S.autoFocus = false; LS.set('ct.autoFocus', false); }
      toggleFocus(btn.dataset.pid); break;
    case 'side': document.body.classList.toggle('side-open'); break;
    case 'view': S.view = btn.dataset.v; LS.set('ct.view', S.view); S.focus = null; document.body.classList.remove('side-open'); render(); break;
    case 'displaysettings': displaySettings(); break;
  }
}
async function passTurn() {
  const T = S.table; if (!T || !T.started) return;
  if (T.active !== S.pid && !(await UI.confirm(`It's ${pname(T.active)}'s turn. Pass it for them?`, { okLabel: 'Pass their turn' }))) return;
  toHost({ t: 'op', op: { k: 'pass', turn: T.turn } });
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
function showConnInfo() {
  const d = Object.assign({ page: location.href.split('?')[0], app: APP_VERSION }, Net.diag());
  const pre = document.createElement('pre');
  pre.className = 'conn-diag';
  pre.textContent = JSON.stringify(d, null, 2);
  const wrap = document.createElement('div');
  const p = document.createElement('p');
  p.className = 'muted small';
  p.textContent = 'If you have connection trouble, copy this and send it along with what you see.';
  const b = document.createElement('button');
  b.textContent = 'Copy';
  b.onclick = () => { try { navigator.clipboard.writeText(pre.textContent).then(() => UI.toast('Copied.')); } catch (e) { /* ignore */ } };
  wrap.append(p, pre, b);
  UI.modal({ title: 'Connection details', el: wrap });
}
function onKey(e) {
  if (!S.me || $('#game').classList.contains('hidden')) return;
  if (e.key === 'Escape' && S.attachFrom) { endAttach(); return; }
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  if (document.querySelector('.w-backdrop')) return; // a dialog/viewer is open
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
  if (k === 'escape' && S.arrange) { toggleArrange(); return; }
  if (k === 'd') { draw(1); return; }
  if (k === 'u') { untapAll(); return; }
  if (k === 's') { viewZone(S.pid, 'library'); return; }
  if (k === 'i' && h) { // info works on anyone's card
    const f = mine ? { def: defOf(mine.card) } : oppCard(h.pid, h.iid);
    if (f && f.def) { e.preventDefault(); viewInfo(f.def); }
    return;
  }
  if (!mine) return;
  const map = { t: () => toggleTap(h.iid), ' ': () => toggleTap(h.iid), f: () => flip(h.iid), g: () => doMove(h.iid, 'graveyard'),
    x: () => doMove(h.iid, 'exile'), h: () => doMove(h.iid, 'hand'), b: () => doMove(h.iid, 'battlefield'), a: () => startAttach(h.iid),
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
      if (S.role === 'host') hostRecv(msg, from);
      else clientRecv(msg);
    },
    onStatus: (state, text, code, transport) => {
      const was = S.net.state;
      S.net = { state, text: text || '', code: code || '', transport: transport || '' };
      if (state === 'online' && was !== 'online' && S.role === 'client') {
        publish(true);
        if (S.table && S.table.room === S.room) Net.send({ t: 'tsync', table: S.table });
      }
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

// =====================================================================
//  Session persistence (crash / reload recovery)
// =====================================================================
let saveT = null;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveNow, 300); }
function saveNow() {
  if (!S.me) return;
  const host = S.role !== 'client';
  LS.set('ct.sess.' + S.pid, {
    v: 2, at: Date.now(), role: S.role, room: S.room, deckId: S.deckId, me: S.me,
    table: host ? S.table : null, players: host ? S.players : null, log: host ? S.log.slice(-150) : null
  });
  LS.set('ct.last', S.pid);
}
function loadSession(pid) {
  const s = LS.get('ct.sess.' + pid);
  return s && s.me && Date.now() - s.at < 24 * 3600e3 ? s : null;
}
function resume(sess) {
  S.role = sess.role; S.room = sess.room; S.deckId = sess.deckId; S.me = sess.me;
  normalizeMe(S.me);
  S.table = sess.table || null; S.players = sess.players || {}; S.log = sess.log || []; S.online = {};
  if (S.role === 'host') Object.keys(S.players).forEach(p => { if (p !== S.pid) S.online[p] = false; });
  showGame();
  startNet();
  publish(true);
  UI.toast(S.role === 'solo' ? 'Practice game restored.' : `Rejoined room ${S.room} — your game was restored.`);
}
function leaveGame() {
  UI.confirm('Leave this game? Your seat will be marked as out.', { danger: true, okLabel: 'Leave' }).then(ok => {
    if (!ok) return;
    if (S.table && S.table.started) toHost({ t: 'op', op: { k: 'concede' } });
    setTimeout(() => {
      try { Net.stop(); } catch (e) { /* ignore */ }
      LS.del('ct.sess.' + S.pid); LS.del('ct.last');
      S.me = null; S.table = null; S.players = {}; S.log = []; S.undo = [];
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
  $('#game').classList.add('hidden'); $('#lobby').classList.remove('hidden');
  document.title = 'Commander Table';
  $('#nameIn').value = LS.get('ct.name', '') || '';
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
      <button class="primary" id="resumeBtn">Resume</button><button id="discardBtn">Discard</button>`;
    rb.classList.remove('hidden');
    $('#resumeBtn').onclick = () => { SS.set('ct.pid', last); location.reload(); };
    $('#discardBtn').onclick = () => { LS.del('ct.sess.' + last); LS.del('ct.last'); rb.classList.add('hidden'); };
  } else rb.classList.add('hidden');
}
function showGame() {
  $('#lobby').classList.add('hidden'); $('#game').classList.remove('hidden');
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
}
function bindLobby() {
  $('#ver').textContent = APP_VERSION;
  $('#deckList').addEventListener('click', async e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const d = Deck.get(del.dataset.del);
      if (d && await UI.confirm(`Delete the deck “${d.name}”?`, { danger: true, okLabel: 'Delete' })) { Deck.remove(d.id); renderDeckList(); }
      return;
    }
    const row = e.target.closest('[data-deck]');
    if (row) { selDeck = row.dataset.deck; LS.set('ct.selDeck', selDeck); renderDeckList(); }
  });
  $('#importBtn').onclick = () => { $('#importBox').classList.remove('hidden'); $('#importBtn').classList.add('hidden'); $('#deckText').focus(); };
  $('#cancelImport').onclick = closeImport;
  $('#loadDeck').onclick = loadDeck;
  $('#nameIn').addEventListener('change', () => LS.set('ct.name', $('#nameIn').value.trim()));
  $('#hostBtn').onclick = () => begin('host');
  $('#soloBtn').onclick = () => begin('solo');
  $('#joinBtn').onclick = () => begin('client');
  $('#joinIn').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#joinIn').addEventListener('keydown', e => { if (e.key === 'Enter') begin('client'); });
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
function begin(role) {
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
  if (role !== 'solo' && typeof Peer === 'undefined') { UI.toast('Online play needs an internet connection — try Practice solo.', { kind: 'error' }); return; }
  if (role === 'host') room = Net.makeRoomCode();
  try { // the invite has done its job; keep any ?net= override
    const u = new URL(location.href);
    if (u.searchParams.has('join')) { u.searchParams.delete('join'); history.replaceState(null, '', u.href); }
  } catch (e) { /* ignore */ }
  S.role = role; S.room = room; S.deckId = deck.id;
  S.players = {}; S.log = []; S.online = {}; S.undo = [];
  S.me = newPlayer(deck, name);
  S.table = role === 'client' ? null : newTable(room);
  S.net = { state: role === 'solo' ? 'online' : 'connecting', text: '' };
  showGame();
  startNet();
  publish(true);
  saveNow();
  if (role === 'host') UI.toast(`You're hosting room ${room}. Click the code at the top-left to copy an invite link for your friends.`, { ms: 8000 });
  if (role === 'solo') sysLog('Practice game started. Use “Start game” to begin turn tracking.');
}

// =====================================================================
//  Boot
// =====================================================================
function boot() {
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
// tests/net-harness.html loads the page with ?nettest to drive Net directly, without the app.
if (!new URLSearchParams(location.search).has('nettest')) boot();
})();
