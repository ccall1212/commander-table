/* Run with Node: node tests/test_targeting.cjs. No packages or browser required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sent = [];
const game = { classList: { contains: () => true } };
let arrowNodes = [];
const context = vm.createContext({
  console, URL, URLSearchParams, Set, Map, Uint32Array, performance,
  innerWidth: 1200, innerHeight: 900, getComputedStyle: el => ({ visibility: el.visibility || 'visible' }),
  location: { search: '?nettest', protocol: 'http:', href: 'http://localhost/?nettest' },
  document: { querySelector: s => s === '#game' ? game : null,
    querySelectorAll: () => arrowNodes, body: { classList: { toggle() {} } } },
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1,
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  Net: { send: msg => sent.push(JSON.parse(JSON.stringify(msg))) }
});
context.window = context;
vm.runInContext(fs.readFileSync(path.join(root, 'js/targeting.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/player-colors.js'), 'utf8'), context);
// Expose real picker/removal/state helpers to this unit harness; production exports stay unchanged.
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8').replace('window.CT = { S,', 'window.CT = { arrowEndpointAt, arrowAnchor, renderYouTile, handleArrowRemoval, hideTargetingControls, showTargetingControls, snapFor, refreshTargeting, S,');
vm.runInContext(appSource, context);
const { S, hostRecv } = context.CT, T = context.CTTargeting;
S.pid = 'p1'; S.role = 'host'; S.me = {};
S.table = { seats: ['p1', 'p2'] };
S.players = {
  p1: { zones: { battlefield: [{ iid: 'p6u6wnase_1', fd: true }] } },
  p2: { zones: { battlefield: [{ iid: 'p2_2' }], hand: [{ iid: 'secret_1' }] } }
};
const element = matches => ({ closest: selector => matches[selector] || null });
const wrap = { firstElementChild: { dataset: { pid: 'p2' } } };
assert.equal(context.CT.arrowEndpointAt(element({'.boardwrap':wrap})).pid, 'p2', 'empty opponent board targets player');
assert.equal(context.CT.arrowEndpointAt(element({'#myBf':{}})).pid, 'p1', 'empty own board targets player');
assert.equal(context.CT.arrowEndpointAt(element({'[data-phead]':{dataset:{phead:'p2'}}})).pid, 'p2', 'name remains a fallback');
assert.equal(context.CT.arrowEndpointAt(element({'.card':{dataset:{zone:'hand',pid:'p1',iid:'hidden'}},'.boardwrap':wrap})),null,'hand never falls back to player board');
assert.equal(context.CT.arrowEndpointAt(element({'.boardwrap':wrap,'[data-pile], .tstrip, .thand, .tpile, #myRow, .lifebox, button, input, textarea, .rlabel, .grip':{}})),null,'life/pile/interactive controls are excluded');
assert.equal(context.CT.arrowEndpointAt(element({'.card':{dataset:{zone:'battlefield',pid:'p2',iid:'p2_2'}},'.boardwrap':wrap})).kind,'card','battlefield cards take priority over board target');

// The YOU miniature must retain a separate arrow identity namespace after its click/drag IDs are stripped.
// Exercise the real renderer, then the real anchor lookup with only that miniature available (the full board
// is hidden while viewing an opponent) and with both visible copies (the larger copy should win).
S.me = { name: 'Me', life: 40, poison: 0, ctr: {}, cmdDmg: {}, casts: {}, zones: {
  battlefield: [{ iid: 'own-card', x: 20, y: 30 }], hand: [], library: [], graveyard: [], exile: [], command: []
}, layout: [
  { k: 'creatures', label: 'Creatures', x: 0, y: 0, w: 1000, h: 170 },
  { k: 'lands', label: 'Lands', x: 0, y: 180, w: 540, h: 250 },
  { k: 'permanents', label: 'Permanents', x: 550, y: 180, w: 450, h: 250 }
] };
S.focus = 'p2';
context.CTAppearance = { getCustom: () => ({}), normalizePrefs: () => ({}), boardBackgroundStyle: () => '' };
context.UI = { cardBackHTML: () => '' };
const youHead = { innerHTML: '' }, youBody = { innerHTML: '' };
const youHtml = { classList: { toggle() {} }, querySelector: sel => sel === '.ohead' ? youHead : youBody };
context.CT.renderYouTile(youHtml, { entries: [{ ctrl: 'p1', c: S.me.zones.battlefield[0], def: null }], atts: new Map() });
assert.match(youBody.innerHTML, /data-arrow-iid="own-card"[^>]*data-arrow-pid="p1"[^>]*data-arrow-zone="battlefield"/, 'YOU miniature renders dedicated arrow identity attributes');
assert.doesNotMatch(youBody.innerHTML, /data-(?:pid|iid|zone)="(?:p1|own-card|battlefield)"/, 'YOU miniature still strips interaction identity attributes');
const box = (left, top, width, height, visibility = 'visible') => ({ dataset: {}, left, top, width, height, right: left + width, bottom: top + height, visibility, getBoundingClientRect() { return this; } });
const miniCard = box(100, 120, 32, 45); Object.assign(miniCard.dataset, { arrowPid: 'p1', arrowIid: 'own-card', arrowZone: 'battlefield' });
const hiddenReal = box(400, 120, 80, 112, 'hidden'); Object.assign(hiddenReal.dataset, { pid: 'p1', iid: 'own-card', zone: 'battlefield' });
arrowNodes = [hiddenReal, miniCard];
const ownCard = { kind: 'card', pid: 'p1', iid: 'own-card' };
const anchorRect = () => { const r = context.CT.arrowAnchor(ownCard); return r && { left: r.left, top: r.top, width: r.width, height: r.height }; };
assert.deepEqual(anchorRect(), { left: 100, top: 120, width: 32, height: 45 }, 'focused view anchors own card to visible YOU miniature when full board is hidden');
const largeVisibleReal = box(600, 120, 80, 112); Object.assign(largeVisibleReal.dataset, { pid: 'p1', iid: 'own-card', zone: 'battlefield' });
arrowNodes = [hiddenReal, miniCard, largeVisibleReal];
assert.deepEqual(anchorRect(), { left: 600, top: 120, width: 80, height: 112 }, 'largest visible real copy wins when both copies can be seen');
// Since v0.54.0 a player arrow lands on the visible name, including the name inside the read-only YOU miniature.
const youName = box(900, 100, 60, 14); youName.closest = selector => selector === '.opp.youtile' ? {} : null;
arrowNodes = [youName];
const playerAnchor = context.CT.arrowAnchor({ kind: 'player', pid: 'p1' });
assert.deepEqual(JSON.parse(JSON.stringify({ left: playerAnchor.left, top: playerAnchor.top, width: playerAnchor.width, height: playerAnchor.height })), { left: 900, top: 100, width: 60, height: 14 }, 'own player arrow lands on the visible name in the read-only YOU miniature')
arrowNodes = [];
const card = { kind: 'card', pid: 'p1', iid: 'p6u6wnase_1' };
const player = { kind: 'player', pid: 'p2' };
const send = (arrow, from = 'p1') => hostRecv({ t: 'arrows', k: 'add', arrow }, from);
send({ from: card, to: player, by: 'spoof', id: 'forged', name: 'secret' });
assert.equal(sent.length, 1);
assert.equal(S.targetArrows.length, 1);
assert.equal(S.targetArrows[0].by, 'p1');
assert.notEqual(S.targetArrows[0].id, 'forged');
assert.deepEqual(Object.keys(sent[0].arrows[0]).sort(), ['by', 'from', 'id', 'to']);
assert.equal(sent[0].arrows[0].from.iid, 'p6u6wnase_1');
send({ from: player, to: card }, 'intruder');
assert.equal(sent.length, 1, 'unseated sender rejected');
for (const bad of [
  { from: card, to: card },
  { from: card, to: { kind: 'card', pid: 'p2', iid: 'secret_1' } },
  { from: card, to: { kind: 'card', pid: 'p2', iid: 'missing' } },
  { from: card, to: { kind: 'player', pid: 'intruder' } },
  { from: { kind: 'card', pid: 'p1', iid: '<script>' }, to: player },
  { from: card, to: { kind: 'library', pid: 'p2' } },
  { from: null, to: player }, false, {}
]) send(bad);
assert.equal(sent.length, 1, 'invalid/private endpoints do not broadcast');
// Four attackers can all target the same player without replacing an earlier line.
for(let n=2;n<=4;n++) {
  S.players.p1.zones.battlefield.push({iid:'p1_'+n});
  send({from:{kind:'card',pid:'p1',iid:'p1_'+n},to:player});
}
assert.equal(S.targetArrows.length,4);
assert.equal(new Set(S.targetArrows.map(a=>a.id)).size,4);
const ids=S.targetArrows.map(a=>a.id);
send({from:card,to:player});
assert.equal(S.targetArrows.length,4,'duplicate does not erase or add lines');
assert.equal(context.CT.snapFor().arrows.length,4,'join snapshot includes all arrows');
const beforeHide=sent.length;
context.CT.hideTargetingControls();
assert.equal(S.arrowControlsDismissed,true);
assert.equal(S.targetArrows.length,4);
assert.equal(sent.length,beforeHide,'hiding controls is local, not a clear operation');
hostRecv({t:'arrows',k:'remove',id:ids[0]},'intruder');
assert.equal(S.targetArrows.length,4,'unseated sender cannot remove');
hostRecv({t:'arrows',k:'remove',id:'nonexistent'},'p1');
assert.equal(S.targetArrows.length,4);
S.net.state='online';
const gameState=JSON.stringify(S.players);
let prevented=false,stopped=false;
const click={type:'click',target:element({'[data-arrow-id]':{dataset:{arrowId:ids[1]}}}),preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}};
assert.equal(context.CT.handleArrowRemoval(click),true);
assert.equal(prevented && stopped,true,'line click cannot activate the card/life/board underneath');
assert.equal(S.targetArrows.length,3);
assert.equal(S.targetArrows.some(a=>a.id===ids[1]),false);
assert.equal(S.targetArrows.some(a=>a.id===ids[0]),true,'other attackers keep their arrows');
assert.equal(S.arrowControlsDismissed,true,'click removal does not reopen dismissed toolbar');
assert.equal(JSON.stringify(S.players),gameState,'arrow removal does not alter game/card state');
const key={...click,type:'keydown',key:'Enter',target:element({'[data-arrow-id]':{dataset:{arrowId:ids[2]}}})};
assert.equal(context.CT.handleArrowRemoval(key),true);
assert.equal(S.targetArrows.length,2,'keyboard removes only the focused line');
S.arrowPick={from:card};
assert.equal(context.CT.handleArrowRemoval(click),false,'picking does not delete an existing arrow');
S.arrowPick=null;
context.CT.showTargetingControls();
assert.equal(S.arrowControlsDismissed,false);
// Invalidate one endpoint. Unrelated arrows survive.
S.players.p1.zones.battlefield=S.players.p1.zones.battlefield.filter(c=>c.iid!==card.iid);
context.CT.refreshTargeting();
assert.equal(S.targetArrows.length,1);
assert.equal(S.targetArrows[0].from.iid,'p1_4');
hostRecv({t:'arrows',k:'clear'},'intruder');assert.equal(S.targetArrows.length,1);
hostRecv({t:'arrows',k:'clear'},'p2');assert.equal(S.targetArrows.length,0);
S.role='solo';
send({from:player,to:{kind:'card',pid:'p1',iid:'p1_4'}});
assert.equal(S.targetArrows.length,1,'solo uses the same host validation path');
const existing=S.targetArrows[0];
assert.equal(T.cleanList([existing,existing],S.players,S.table.seats).length,1,'duplicate IDs rejected');
assert.equal(T.cleanList([{...existing,id:'<script>'}],S.players,S.table.seats).length,0);
S.table.seats=['p1'];
assert.equal(T.cleanList(S.targetArrows,S.players,S.table.seats).length,0,'removed player invalidates only their endpoints');
S.table.seats=['p1','p2'];
S.targetArrows=Array.from({length:T.MAX_ARROWS},(_,i)=>({...existing,id:'limit_'+i}));
send({from:{kind:'card',pid:'p1',iid:'p1_4'},to:player},'p2');
assert.equal(S.targetArrows.length,T.MAX_ARROWS);
assert.equal(S.targetArrows[0].id,'limit_0','capacity never erases an old arrow');
const a = { left: 10, top: 20, width: 80, height: 112 };
const b = { left: 210, top: 20, width: 80, height: 112 };
const line = T.line(a, b);
assert.equal(line.x1, 90); assert.equal(line.x2, 210);
assert.equal(line.y1, 76); assert.equal(line.y2, 76);
assert.equal(T.line(a, a), null);
assert.equal(T.line(a, { ...a, left: 30 }), null, 'overlapping targets do not produce reversed lines');
const scaled = T.line({ left: 5, top: 10, width: 40, height: 56 }, { left: 105, top: 10, width: 40, height: 56 });
assert.equal(scaled.x1, line.x1 / 2); assert.equal(scaled.x2, line.x2 / 2);
console.log('PASS targeting: four attackers, unique IDs, individual click/keyboard removal, dismissal/reopen, complete join snapshot, endpoint pruning, host/solo authorization, private data exclusions and scaled geometry');
