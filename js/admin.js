/* Private room dashboard. The static page contains no credential; the relay checks every request. */
(function () {
'use strict';
const base = String(window.CT_NET && window.CT_NET.relayUrl || '').replace(/\/$/, '');
const $ = id => document.getElementById(id);
let passphrase = sessionStorage.getItem('ct.admin.passphrase') || '';
let timer = null;
const joinStates = new Map();
function message(value) { $('message').textContent = value || ''; }
function showSignedIn(yes) { $('signin').hidden = yes; $('dashboard').hidden = !yes; }
async function api(path, method = 'GET') {
  if (!base.startsWith('https://') && !base.startsWith('http://127.0.0.1:')) throw new Error('A secure room relay is required.');
  const response = await fetch(base + '/admin/' + path, { method, cache: 'no-store', headers: { Authorization: 'Bearer ' + passphrase } });
  let data = {};
  try { data = await response.json(); } catch (_) { /* show the HTTP failure below */ }
  if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ').');
  return data;
}
function cell(tag, text, className) {
  const el = document.createElement(tag); el.textContent = text;
  if (className) el.className = className;
  return el;
}
function button(label, action, className) {
  const el = cell('button', label, className); el.type = 'button'; el.addEventListener('click', action); return el;
}
async function requestJoin(room, output, control) {
  control.disabled = true;
  setJoinState(room, 'waiting');
  try {
    const request = await api('rooms/' + room + '/join', 'POST');
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await api('rooms/' + room + '/join/' + encodeURIComponent(request.id));
      if (result.status === 'pending') continue;
      if (result.status === 'approved') {
        setJoinState(room, 'approved');
      } else setJoinState(room, 'declined');
      return;
    }
    setJoinState(room, 'expired');
  } catch (error) { setJoinState(room, error.message); }
  finally { control.disabled = false; }
}
function setJoinState(room, state) {
  joinStates.set(room, state);
  const panel = [...$('rooms').children].find(el => el.dataset.room === room);
  if (panel) renderJoinState(room, panel.querySelector('.join-result'));
}
function renderJoinState(room, output) {
  const state = joinStates.get(room);
  if (state === 'approved') {
    output.textContent = 'Host approved. ';
    const link = cell('a', 'Join this game');
    link.href = 'index.html?join=' + encodeURIComponent(room);
    output.appendChild(link);
  } else {
    output.textContent = {
      waiting: 'Waiting for the host to approve…',
      declined: 'The host declined the request.',
      expired: 'The request expired. Try again if the host is still connected.',
    }[state] || state || '';
  }
}
async function closeRoom(room, control) {
  if (!confirm('Close room ' + room + '? All relay connections will end, and this room code cannot reconnect for 24 hours.')) return;
  control.disabled = true;
  try { await api('rooms/' + room + '/close', 'POST'); message('Room ' + room + ' closed.'); await refresh(); }
  catch (error) { message(error.message); control.disabled = false; }
}
function renderRoom(info) {
  const room = info.room, panel = cell('article', '', 'room');
  panel.dataset.room = room;
  const head = cell('div', '', 'room-head');
  head.appendChild(cell('h2', 'Room ' + room));
  head.appendChild(cell('span', info.started ? 'Game started' : 'Opening lobby', 'muted'));
  panel.appendChild(head);
  panel.appendChild(cell('p', 'Host: ' + (info.host || 'Connecting')));
  const players = Array.isArray(info.players) ? info.players : [];
  panel.appendChild(cell('p', 'Players: ' + players.length + ' / 6', 'muted'));
  const list = document.createElement('ul');
  for (const player of players) list.appendChild(cell('li', player.name + (player.connected ? '' : ' · disconnected')));
  if (players.length) panel.appendChild(list);
  const actions = cell('div', '', 'actions');
  const result = cell('p', '', 'join-result');
  const joinButton = button('Request to join', function () { requestJoin(room, result, this); });
  joinButton.disabled = joinStates.get(room) === 'waiting';
  actions.appendChild(joinButton);
  actions.appendChild(button('Spectate', () => { location.href = 'index.html?adminSpectate=' + encodeURIComponent(room); }));
  actions.appendChild(button('Close room', function () { closeRoom(room, this); }, 'danger'));
  panel.appendChild(actions); panel.appendChild(result);
  renderJoinState(room, result);
  return panel;
}
async function refresh() {
  try {
    const data = await api('rooms');
    showSignedIn(true); message('');
    $('count').textContent = data.count + ' active relay game' + (data.count === 1 ? '' : 's');
    $('rooms').replaceChildren(...data.rooms.map(renderRoom));
    if (!data.count) $('rooms').appendChild(cell('p', 'No relay-connected games are active right now.', 'muted'));
  } catch (error) { message(error.message); if (/passphrase|401/i.test(error.message)) showSignedIn(false); }
}
$('signIn').addEventListener('click', async () => {
  passphrase = $('passphrase').value;
  sessionStorage.setItem('ct.admin.passphrase', passphrase);
  await refresh();
  if ($('dashboard').hidden) { sessionStorage.removeItem('ct.admin.passphrase'); passphrase = ''; }
  $('passphrase').value = '';
});
$('passphrase').addEventListener('keydown', e => { if (e.key === 'Enter') $('signIn').click(); });
$('signOut').addEventListener('click', () => { passphrase = ''; joinStates.clear(); sessionStorage.removeItem('ct.admin.passphrase'); showSignedIn(false); $('rooms').replaceChildren(); message('Signed out.'); });
$('refresh').addEventListener('click', refresh);
if (passphrase) refresh();
timer = setInterval(() => { if (!$('dashboard').hidden) refresh(); }, 15000);
}());
