/* Real-browser check for room access (lock, ask before joining, blocking). Needs the page and a local copy of the
 * relay running first; the same setup the other *_browser tests use:
 *   python3 -m http.server 8107 --bind 127.0.0.1                       (from the project folder)
 *   node <a script that starts relay/worker.js with Miniflare on 127.0.0.1:8112>
 * Then run:
 *   NODE_PATH=<folder with playwright> node tests/test_room_access_browser.cjs
 * Set CT_CHROMIUM to a Chromium/Chrome executable if it is not at /usr/bin/chromium. Never touches Cloudflare. */
'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.CT_TEST_URL || 'http://127.0.0.1:8107/index.html?relay=http%3A%2F%2F127.0.0.1%3A8112&net=relay';
const deck = {
  id: 'room-access-test', name: 'Room access test', commanders: [],
  cards: [
    { def: { id: 'ra-land', name: 'Island', type: 'Basic Land — Island', ci: ['U'], tokens: [] }, qty: 40 },
    { def: { id: 'ra-spell', name: 'Test instant', type: 'Instant', ci: ['U'], tokens: [] }, qty: 60 }
  ], tokens: [], createdAt: '2026-10-30', source: ''
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CT_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];

  // A player with their own browser profile. `frames` records everything the relay sends to this page.
  async function player(name) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    const frames = [];
    page.on('websocket', ws => ws.on('framereceived', f => frames.push(typeof f.payload === 'string' ? f.payload : '')));
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.addInitScript(({ deck, name }) => {
      localStorage.setItem('ct.decks.v1', JSON.stringify([deck]));
      localStorage.setItem('ct.name', JSON.stringify(name));
    }, { deck, name });
    await page.goto(BASE);
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    return Object.assign(page, { frames, playerName: name });
  }
  const pickColor = async (page, color) => { await page.locator(`.ct-player-color-option[data-color="${color}"]`).click(); };
  async function hostGame(name, color) {
    const page = await player(name);
    await page.locator('#hostBtn').click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await pickColor(page, color);
    await page.waitForFunction(() => CT.S.role === 'host' && CT.S.room && CT.S.table.colors[CT.S.pid]);
    return page;
  }
  async function startJoin(page, room) {
    await page.locator('#joinIn').fill(room);
    await page.locator('#joinBtn').click();
    await page.getByRole('button', { name: 'Join game', exact: true }).click();
  }
  async function setAccess(host, { lock, ask }) {
    await host.getByRole('button', { name: /^(☰|Menu)/ }).first().click();
    await host.locator('text=/^Room access…/').first().click();
    const dialog = host.locator('.w-room-access-dialog');
    await dialog.waitFor();
    if (lock !== undefined) await dialog.locator('#ctRoomLock').setChecked(lock);
    if (ask !== undefined) await dialog.locator('#ctRoomAsk').setChecked(ask);
    await host.waitForFunction(([l, a]) => (l === undefined || CT.S.table.locked === l) && (a === undefined || CT.S.table.askJoin === a), [lock, ask]);
    await host.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  }
  const seatCount = page => page.evaluate(() => CT.S.table.seats.length);
  const inLobby = page => page.evaluate(() => CT.S.me === null && getComputedStyle(document.querySelector('#lobby')).display !== 'none');
  const sawFrame = (page, text) => page.frames.some(f => f.includes(text));

  try {
    const host = await hostGame('Host Hal', 'gold');
    const room = await host.evaluate(() => CT.S.room);
    assert.match(room, /^[A-Z2-9]{5}$/);
    assert.equal(await host.getByRole('button', { name: /^(☰|Menu)/ }).first().count(), 1);
    await host.getByRole('button', { name: /^(☰|Menu)/ }).first().click();
    assert.equal(await host.locator('text=/^Room access…/').count(), 1, 'the host has a Room access menu item');
    await host.keyboard.press('Escape');

    // ---- 1. Locked room: a stranger is turned away and receives nothing from the table. ----
    await setAccess(host, { lock: true });
    const menuLabel = await (async () => { await host.getByRole('button', { name: /^(☰|Menu)/ }).first().click(); const t = await host.locator('text=/^Room access…/').first().innerText(); await host.keyboard.press('Escape'); return t; })();
    assert.match(menuLabel, /\(locked\)/, 'the menu item shows the room is locked');
    const stranger = await player('Stranger Sam');
    await startJoin(stranger, room);
    await stranger.getByText('This room is locked').waitFor();
    assert.equal(await inLobby(stranger), true, 'the stranger is sent back to the start screen');
    assert.equal(sawFrame(stranger, 'join-refused'), true, 'they were told why');
    assert.equal(sawFrame(stranger, '"t":"snap"'), false, 'they were never sent the table');
    assert.equal(sawFrame(stranger, 'Host Hal'), false, 'they never saw the host\'s name or board');
    assert.equal(await seatCount(host), 1, 'the host\'s table is unchanged');
    assert.equal(await host.evaluate(() => Object.keys(CT.S.joinRequests).length), 0, 'no join request is left waiting');

    // ---- 2. Unlock: the same person can now join normally. ----
    await setAccess(host, { lock: false });
    await startJoin(stranger, room);
    await pickColor(stranger, 'red');
    await host.waitForFunction(() => CT.S.table.seats.length === 2);
    assert.equal(await stranger.evaluate(() => CT.S.table.seats.length), 2, 'unlocked: the joiner is seated');
    const strangerPid = await stranger.evaluate(() => CT.S.pid);
    assert.equal(sawFrame(stranger, '"t":"snap"'), true, 'control: once admitted the same joiner does receive the table, so the "never sent" checks above are meaningful');
    assert.equal(sawFrame(stranger, 'Host Hal'), true, 'control: and then sees the host\'s name');

    // ---- 3. Ask before anyone joins: Let in. ----
    await setAccess(host, { ask: true });
    const bea = await player('Bea Guest');
    await startJoin(bea, room);
    await bea.getByText('Waiting for the host to let you in').waitFor();
    assert.equal(sawFrame(bea, '"t":"snap"'), false, 'waiting: nothing from the table has been sent yet');
    await host.getByText(/Bea Guest wants to join this game/).waitFor();
    await host.getByRole('button', { name: 'Let in', exact: true }).click();
    await pickColor(bea, 'green');
    await host.waitForFunction(() => CT.S.table.seats.length === 3);
    assert.equal(await bea.evaluate(() => CT.S.table.seats.length), 3, 'Let in: the joiner is seated');
    assert.equal(await bea.locator('text=Waiting for the host').count(), 0, 'the waiting message is gone');

    // ---- 4. Ask before anyone joins: Decline. ----
    const cy = await player('Cy Guest');
    await startJoin(cy, room);
    await cy.getByText('Waiting for the host to let you in').waitFor();
    await host.getByText(/Cy Guest wants to join this game/).waitFor();
    await host.getByRole('button', { name: 'Decline', exact: true }).click();
    await cy.getByText('The host did not let you in').waitFor();
    assert.equal(await inLobby(cy), true, 'declined: back at the start screen');
    assert.equal(sawFrame(cy, '"t":"snap"'), false, 'declined: never sent the table');
    assert.equal(await seatCount(host), 3, 'declined: no seat was taken');

    // ---- 5. Kick: blocked by name, even from a brand-new browser. ----
    await setAccess(host, { ask: false });
    await host.evaluate(pid => CT.hostRecv({ t: 'op', op: { k: 'kick', pid } }, CT.S.pid), strangerPid);
    await stranger.getByText(/removed by a moderator/).waitFor();
    assert.equal(await inLobby(stranger), true, 'the removed player is back at the start screen');
    assert.equal(await seatCount(host), 2, 'their seat is gone');
    assert.deepEqual(await host.evaluate(() => [...CT.S.table.blockedNames]), ['Stranger Sam'], 'their name is blocked');
    await startJoin(stranger, room);
    await stranger.getByText('You cannot join this room').waitFor();
    assert.equal(await seatCount(host), 2, 'the blocked name gets no seat');
    const fresh = await player('stranger sam'); // a different browser profile, different capitalisation
    await startJoin(fresh, room);
    await fresh.getByText('You cannot join this room').waitFor();
    assert.equal(await seatCount(host), 2, 'a new browser with the same name is blocked too');

    // ---- 6. Unblock from the Room access dialog: they can join again. ----
    await host.getByRole('button', { name: /^(☰|Menu)/ }).first().click();
    await host.locator('text=/^Room access…/').first().click();
    const dialog = host.locator('.w-room-access-dialog');
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Stranger Sam/, 'the dialog lists the blocked name');
    await dialog.getByRole('button', { name: 'Unblock' }).click();
    await host.waitForFunction(() => CT.S.table.blockedNames.length === 0);
    assert.match(await dialog.innerText(), /Nobody is blocked/);
    await host.keyboard.press('Escape');
    await startJoin(fresh, room);
    await pickColor(fresh, 'purple');
    await host.waitForFunction(() => CT.S.table.seats.length === 3);
    assert.equal(await fresh.evaluate(() => CT.S.table.seats.length), 3, 'unblocked: the name can join again');

    // ---- 7. A seated player can still reconnect to a locked room. ----
    await setAccess(host, { lock: true });
    await bea.reload();
    await bea.getByText(/Rejoin|Resume/i).first().waitFor().catch(() => {});
    await bea.evaluate(() => { const b = [...document.querySelectorAll('#resumeBox button')].find(x => /rejoin|resume/i.test(x.textContent)); if (b) b.click(); });
    await bea.waitForFunction(() => CT.S.table && CT.S.table.seats.includes(CT.S.pid) && CT.S.table.locked === true, null, { timeout: 40000 });
    assert.equal(await bea.evaluate(() => CT.S.table.locked), true, 'a seated player gets back into a locked room');

    assert.deepEqual(errors, [], 'no page errors in any browser');
    console.log('PASS room access (real browsers + local relay): lock refuses and sends nothing, unlock, ask-first Let in / Decline, kick blocks name even from a new browser, unblock, seated players reconnect to a locked room');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
