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

const APP_VERSION = '0.20.0';

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
    pid: S.pid, name, appearance: CTAppearance.getPrefs(), life: 40, poison: 0, ctr: {}, cmdDmg: {}, casts: {}, mull: 0, kept: false,
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
  m.zones.hand = m.zones.library.splice(0, 7);
  return m;
}
// Bring older saved games up to the current shape (layout + card positions).
function normalizeMe(m) {
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
    pid: m.pid, bw: BW, name: m.name, appearance: CTAppearance.normalizePrefs(m.appearance), life: m.life, poison: m.poison, ctr: m.ctr, cmdDmg: m.cmdDmg, cmdrs: m.cmdrs,
    casts: m.casts, hand: z.hand.length, lib: z.library.length, kept: m.kept, layout: m.layout, bh: myBH(),
    zones: { battlefield: take(z.battlefield), graveyard: take(z.graveyard), exile: take(z.exile), command: take(z.command) },
    revHand: m.revealHand ? take(z.hand) : null,
    revTop: topIsRevealed(m) && z.library.length ? take([z.library[0]]) : null,
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
  return { room, seats: [S.pid], order: [], active: null, turn: 0, turnSeq: 0, phase: 3, started: false, monarch: null, initiative: null, out: {} };
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
    case 'drawfx': {
      if (!S.table.seats.includes(from)) return;
      const count = clamp(Math.floor(num(msg.count, 1)), 1, 5);
      broadcast({ t: 'drawfx', pid: from, count });
      break;
    }
    case 'slamfx': {
      if (!S.table.seats.includes(from) || typeof msg.iid !== 'string' || !/^[\\w-]{1,40}$/.test(msg.iid)) return;
      const player = S.players[from];
      const card = player && player.zones && player.zones.battlefield.find(c => c.iid === msg.iid && c.cmd);
      if (!card) return;
      const ci = Array.isArray(msg.ci) ? [...new Set(msg.ci.filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c)))] : [];
      broadcast({ t: 'slamfx', pid: from, iid: msg.iid, ci });
      break;
    }
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
    turn: Math.max(0, num(t.turn)), turnSeq: Math.max(0, num(t.turnSeq, num(t.turn))), phase: clamp(num(t.phase, 3), 0, PHASES.length - 1), started: !!t.started,
    monarch: str(t.monarch), initiative: str(t.initiative),
    out: isObj(t.out) ? Object.fromEntries(Object.keys(t.out).slice(0, 8).map(k => [k.slice(0, 40), !!t.out[k]])) : {},
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

function tableOp(op, from) {
  const T = S.table;
  if (!isObj(op) || typeof op.k !== 'string') return;
  const isHost = from === S.pid;
  switch (op.k) {
    case 'rollfirst': {
      if (T.started) return;
      const live = T.seats.filter(p => !T.out[p]);
      if (!live.length) return;
      rollFirstPlayer(T, live);
      break;
    }
    case 'start': {
      if (!isHost) return;
      const live = T.seats.filter(p => !T.out[p]);
      if (!live.length) return;
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
      Object.assign(T, { order: [], active: null, turn: 0, turnSeq: 0, phase: 3, started: false, monarch: null, initiative: null, out: {} });
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
    pid: from, name: String(p.name || 'Player').slice(0, 24), appearance: CTAppearance.normalizePrefs(p.appearance), life: num(p.life, 40), poison: num(p.poison),
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
  switch (msg.t) {
    case 'pub': if (msg.p && msg.p.pid) { S.players[msg.p.pid] = msg.p; if (msg.p.pid !== S.pid) checkOrphans(); } break;
    case 'log': S.log.push(msg.e); if (S.log.length > 300) S.log.splice(0, S.log.length - 300); break;
    case 'drawfx': if (typeof msg.pid === 'string') animateDrawCard(msg.pid, clamp(Math.floor(num(msg.count, 1)), 1, 5)); break;
    case 'slamfx':
      if (typeof msg.pid === 'string' && typeof msg.iid === 'string') {
        const ci = Array.isArray(msg.ci) ? [...new Set(msg.ci.filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c)))] : [];
        animateCommanderSlam(msg.pid, msg.iid, ci);
      }
      break;
    case 'table': S.table = msg.table; afterTable(); break;
    case 'firstroll': showFirstRoll(msg); break;
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
}
function resetForNewGame() {
  const deck = Deck.get(S.deckId);
  if (!deck) { UI.toast('Your deck is missing from this browser — cannot restart.', { kind: 'error' }); return; }
  S.me = newPlayer(deck, S.me.name, S.me);
  S.selected.clear();
  S.undo = [];
  publish(true);
}

// =====================================================================
//  Card moves
// =====================================================================
function insertCard(card, to, opts = {}) {
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
  if (res.from === 'command' && to === 'battlefield' && card.cmd && !card.fd && !res.gone && def) {
    emitCommanderSlam(card.iid, def.ci);
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
  if (drawn.length < requested) UI.toast('Your library is empty!', { kind: 'warn' });
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
// The short delay lets the public battlefield update reach the host before it validates the event.
function emitCommanderSlam(iid, ci) {
  const colors = Array.isArray(ci) ? [...new Set(ci.filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c)))] : [];
  if (S.role === 'solo') {
    onBroadcast({ t: 'slamfx', pid: S.pid, iid, ci: colors });
    return;
  }
  setTimeout(() => toHost({ t: 'slamfx', iid, ci: colors }), 180);
}

function animateCommanderSlam(pid, iid, ci) {
  if (!pid || !iid || $('#game').classList.contains('hidden') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const palette = { W: '#f2e4b5', U: '#62c5f2', B: '#a38bd2', R: '#ff705f', G: '#76cf91' };
  const colors = [...new Set((ci || []).filter(c => palette[c]).map(c => palette[c]))];
  if (!colors.length) colors.push('#e6d8a5'); // a neutral glow for colorless commanders
  const glow = colors.map(c => '0 0 20px 4px ' + c + '99').join(', ');
  const border = colors.length === 1 ? colors[0] : 'transparent';
  let attempts = 0;

  const start = () => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const candidates = [...document.querySelectorAll('.card[data-iid]')]
      .filter(el => el.dataset.iid === iid && drawAnimationVisible(el))
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
      borderColor: border,
      background: 'linear-gradient(transparent, transparent) padding-box, conic-gradient(' + colors.join(', ') + ') border-box',
      boxShadow: glow
    });
    document.body.appendChild(ring);

    card.animate([
      { transform: 'translateY(-18px) scale(1.055) rotate(-1.4deg)', filter: 'brightness(1.28)', boxShadow: glow, offset: 0 },
      { transform: 'translateY(2px) scale(.985) rotate(.25deg)', filter: 'brightness(1.15)', boxShadow: glow, offset: .58 },
      { transform: 'translateY(0) scale(1) rotate(0)', filter: 'brightness(1)', boxShadow: 'none', offset: 1 }
    ], { duration: 430, easing: 'cubic-bezier(.2,.75,.25,1)' });
    const motion = ring.animate([
      { opacity: 0, transform: 'translateY(-10px) scale(.9)' },
      { opacity: .95, transform: 'translateY(0) scale(1.02)', offset: .36 },
      { opacity: .65, transform: 'translateY(0) scale(1.09)', offset: .65 },
      { opacity: 0, transform: 'translateY(0) scale(1.16)' }
    ], { duration: 540, easing: 'cubic-bezier(.2,.75,.25,1)' });
    motion.finished.then(() => ring.remove(), () => ring.remove());
  };
  requestAnimationFrame(() => requestAnimationFrame(start));
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
// A copy behaves like a token (it ceases to exist off the battlefield) but is labelled TOKEN COPY.
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
  try { prints = await Deck.fetchPrints(d.name); } catch (e) { UI.toast(e.message || 'Could not load printings', { kind: 'error' }); return; }
  finally { if (t && t.close) t.close(); }
  if (!prints.length) { UI.toast(`No other printings found for ${dname(d)}.`); return; }
  const copies = ZONES.reduce((n, z) => n + S.me.zones[z].filter(c => !c.tok && S.me.defs[c.id] && S.me.defs[c.id].name === d.name).length, 0);
  UI.printPicker({
    title: `Switch printing for ${d.name}`, prints, currentId: d.id, showAll: copies > 1,
    onPick: (nd, scope) => applyPrinting(iid, d, nd, scope)
  });
}
function applyPrinting(iid, oldDef, nd, scope) {
  act(() => {
    S.me.defs[nd.id] = Object.assign({}, nd, { tokens: (oldDef.tokens && oldDef.tokens.length ? oldDef.tokens : nd.tokens) || [] });
    for (const z of ZONES) for (const c of S.me.zones[z]) {
      const same = scope === 'all' && !c.tok && S.me.defs[c.id] && S.me.defs[c.id].name === oldDef.name;
      if (c.iid === iid || same) c.id = nd.id;
    }
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
// Owner reclaims a card they gave away: ask the controller's game to hand it straight back (no approval needed).
function takeBack(pid, iid) {
  const f = oppCard(pid, iid);
  if (!f || f.c.own !== S.pid) return;
  sendReq(pid, { k: 'take', iid });
  UI.toast(`Taking back ${f.def ? dname(f.def) : 'your card'} from ${pname(pid)}…`, { ms: 3000 });
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
    UI.confirm(`You are at ${after} life. Would you like to concede? You can choose Cancel and continue playing at negative life.`, {
      title: 'You reached 0 life', danger: true, okLabel: 'Concede game'
    }).then(ok => { if (ok) concedeGame(); });
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
    S.me.revealTopOnce = null;
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
    items.push({ label: 'Play tapped', hint: 'T', onClick: () => doMove(iid, 'battlefield', { tapped: true }) });
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
  const items = [];
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
      ['D', 'Draw one card'], ['U', 'Untap all'], ['L', 'Open Search Library from anywhere'],
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
  S.viewers.forEach(v => { try { v.refresh(); } catch (e) { console.error(e); } });
}

function appearanceBackFor(pid) {
  const owner = pid === S.pid ? S.me : (S.players[pid] || null);
  return CTAppearance.normalizePrefs(owner && owner.appearance).cardBack;
}
function appearanceBoardStyleFor(pid) {
  const owner = pid === S.pid ? S.me : (S.players[pid] || null);
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
  const bw = mode ? dw : BW;
  return `<div class="board${editing ? ' arrange' : ''}" data-pid="${esc(pid)}"${mode ? ` data-fit="${mode}" data-dw="${dw}" data-dh="${dh}" data-bh0="${bh0}"` : ''} style="width:${bw}px;height:${(mode ? dh : bh0) + (tile ? TILE_STRIP : 0)}px">${html}</div>`;
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
      <div class="zlabel${k === 'library' ? ' zlabel-lib' : ''}">${label} <b>${pi[k].n}</b>${sub ? ` <span class="zsub">${sub}</span>` : ''}</div><div class="zcard">${pi[k].face}</div></div>`;
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
  const rows = Object.keys(PLAYER_CTR_ICONS).map(k => `<div class="ctrrow"><span class="ci">${PLAYER_CTR_ICONS[k]}</span><span class="cn">${k}</span><b>${vals[k] || 0}</b>` +
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
      <button class="life-adjust" type="button" data-a="${a}" data-pid="${esc(pid)}" data-d="-1" aria-label="Decrease life total">−</button><b class="lifeN">${life}</b><button class="life-adjust" type="button" data-a="${a}" data-pid="${esc(pid)}" data-d="1" aria-label="Increase life total">+</button>
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
      (S.role !== 'client' ? ' <button class="primary" data-a="start" title="Uses the rolled order, or randomizes if you have not rolled">Start game</button>' : ' <span class="muted">— waiting for the host to start</span>');
  } else if (!T.active) {
    html = `<span class="muted">No active player · everyone has conceded</span>`;
  } else {
    const mine = T.active === S.pid;
    html = `<span>Round <b>${T.turn}</b> · <b style="color:${colorOf(T.active)}">${esc(mine ? 'Your' : pname(T.active) + "'s")}</b> turn</span>`;
  }
  $('#turnBox').innerHTML = html;
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
  // strip ids so the miniature never answers clicks/drags meant for my real board
  el.querySelector('.obf').innerHTML = viewingMe ? '<div class="viewing-note">👁 Viewing your board</div>'
    : `<div class="boardwrap thumb" data-board="thumb:${esc(S.pid)}">${boardHTML(S.pid, idx).replace(/ data-(iid|pid|zone|region|c)="[^"]*"/g, '')}</div>`;
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
function oppHandHTML(pid) {
  const p = S.players[pid], defs = p.defs || {};
  const revealed = !!(p.revHand && p.revHand.length);
  const n = revealed ? p.revHand.length : Math.min(num(p.hand), 14);
  const mid = (n - 1) / 2, step = n > 1 ? Math.min(3, 28 / n) : 0;
  const fan = i => { const off = i - mid; return `--rot:${(off * step).toFixed(2)}deg;--arc:${(mid ? 12 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}`; };
  return revealed
    ? p.revHand.map((c, i) => cardHTML(c, c.id && defs[c.id], { mine: false, pid, ctrl: pid, zone: 'hand', style: fan(i) })).join('')
    : Array.from({ length: n }, (_, i) => `<div class="card oback" style="${fan(i)}">${UI.cardBackHTML('', appearanceBackFor(pid))}</div>`).join('');
}
function oppZonesHTML(pid) {
  const p = S.players[pid], defs = p.defs || {}, pi = pileInfo(pid);
  const box = (k, label, sub) => `<div class="zbox" data-pile="${k}" data-pid="${esc(pid)}" title="${esc(pi[k].tip)}${k === 'library' ? '' : ' — click to search'}">
      <div class="zlabel">${label} <b>${pi[k].n}</b>${sub ? ` <span class="zsub">${sub}</span>` : ''}</div><div class="zcard">${pi[k].face}</div></div>`;
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
  const pile = (k, label) => `<div class="tpile" data-pile="${k}" data-pid="${esc(S.pid)}" data-drop="${k}" title="${esc(pi[k].tip)}"><div class="tpcard">${pi[k].face || ''}</div><div class="tplabel">${label} <b>${pi[k].n}</b></div></div>`;
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
  const handN = num(p.hand), n = revealed ? p.revHand.length : Math.min(handN, 12);
  const mid = (n - 1) / 2, step = n > 1 ? Math.min(4, 30 / n) : 0;
  const fan = i => { const off = i - mid; return `--rot:${(off * step).toFixed(1)}deg;--arc:${(mid ? 8 * (off / mid) ** 2 : 0).toFixed(1)}px;z-index:${i + 1}`; };
  const hand = revealed
    ? p.revHand.map((c, i) => cardHTML(c, c.id && defs[c.id], { mine: false, pid, ctrl: pid, zone: 'hand', style: fan(i) })).join('')
    : Array.from({ length: n }, (_, i) => `<div class="card oback" style="${fan(i)}">${UI.cardBackHTML('', appearanceBackFor(pid))}</div>`).join('');
  const pile = (k, label) => `<div class="tpile"${k === 'library' ? ` data-fx="library" data-pid="${esc(pid)}"` : ''}><div class="tpcard">${pi[k].face || ''}</div><div class="tplabel">${label} <b>${pi[k].n}</b></div></div>`;
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
    : Array.from({ length: shown }, (_, i) => `<div class="card oback" style="${fan(i)}">${UI.cardBackHTML('', appearanceBackFor(pid))}</div>`).join('');
  const handHTML = `<span class="ohhand${revealed ? ' revealed' : ''}${handN ? '' : ' empty'}" title="${esc(p.name)} has ${plural(handN, 'card')} in hand${revealed ? ' (revealed — hover to read)' : ''}">${handCards}<b class="ohn">${handN}</b></span>`;
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
  $('#handLabel').innerHTML = vo ? `${esc(S.players[vo].name)} · HAND <b>${num(S.players[vo].hand)}</b>${S.players[vo].revHand && S.players[vo].revHand.length ? ' · REVEALED' : ''}` : `HAND <b>${z.hand.length}</b>`;
  $('#myHand').style.setProperty('--n', Math.max(1, hn)); // CSS overlaps cards so the hand never scrolls
  setHTML($('#myZones'), vo ? oppZonesHTML(vo) : myZonesHTML());
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
//  Events
// =====================================================================
let drag = null; // a card being dragged with the pointer
let selectionDrag = null; // a temporary selection rectangle
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
    const ptb = t.closest('.badges .pt');
    if (ptb && card && card.dataset.pid === S.pid) { changePT(card.dataset.iid, 1, 1); return; }
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
  document.addEventListener('pointerdown', hidePreview, true);

  // ---- pointer-driven dragging: cards (anywhere) and zones (arrange mode)
  g.addEventListener('pointerdown', e => {
    if (e.button !== 0 || S.attachFrom) return;
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
    if (S.regionDrag) { regionEnd(); return; }
    if (selectionDrag) { endSelectionDrag(e); return; }
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
}
function giveControlGroup(group, to, at, anchorIid) {
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
  if (!S.me || $('#game').classList.contains('hidden')) return;
  if (e.key === 'Escape' && S.attachFrom) { endAttach(); return; }
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
  $('#game').classList.add('hidden'); $('#lobby').classList.remove('hidden');
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
  $('#cardBackPicker').addEventListener('click', e => chooseAppearance(e, 'cardBack'));
  $('#backgroundPicker').addEventListener('click', e => chooseAppearance(e, 'background'));
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
function renderAppearancePickers() {
  const prefs = CTAppearance.getPrefs();
  $('#cardBackPicker').innerHTML = CTAppearance.renderCardBacks(prefs.cardBack);
  $('#backgroundPicker').innerHTML = CTAppearance.renderBackgrounds(prefs.background);
}
function chooseAppearance(e, kind) {
  const choice = e.target.closest('[data-appearance-id]');
  if (!choice) return;
  const prefs = CTAppearance.getPrefs(), id = choice.dataset.appearanceId;
  if (kind === 'cardBack' && !CTAppearance.backOptions.some(x => x.id === id)) return;
  if (kind === 'background' && !CTAppearance.backgroundOptions.some(x => x.id === id)) return;
  prefs[kind] = id;
  CTAppearance.savePrefs(prefs);
  renderAppearancePickers();
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
