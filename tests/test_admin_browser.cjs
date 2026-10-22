/* Real Chromium UI check with a simulated admin relay API. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1050, height: 760 } });
    const errors = [], calls = []; let closed = false;
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.route('**/admin/**', async route => {
      const request = route.request(), url = new URL(request.url());
      calls.push({ path: url.pathname, method: request.method(), authorized: request.headers().authorization === 'Bearer private-test-passphrase' });
      const authorized = request.headers().authorization === 'Bearer private-test-passphrase';
      let status = authorized ? 200 : 401, result = authorized ? {} : { error: 'Invalid admin passphrase' };
      if (authorized && url.pathname === '/admin/rooms') result = { count: closed ? 0 : 1, rooms: closed ? [] : [{ room: 'ABCDE', host: 'Chris', started: true, players: [{ name: 'Chris', connected: true }, { name: 'Friend', connected: false }], updatedAt: Date.now() }] };
      if (authorized && url.pathname === '/admin/rooms/ABCDE/join' && request.method() === 'POST') result = { id: 'join-test', status: 'pending' };
      if (authorized && url.pathname === '/admin/rooms/ABCDE/join/join-test') result = { status: 'approved' };
      if (authorized && url.pathname === '/admin/rooms/ABCDE/close') { closed = true; result = { ok: true }; }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(result), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto('http://127.0.0.1:8099/admin.html');
    assert.equal(await page.locator('#dashboard').isVisible(), false);
    await page.locator('#passphrase').fill('private-test-passphrase');
    await page.locator('#signIn').click();
    await page.getByText('1 active relay game').waitFor();
    await page.getByText('Host: Chris').waitFor();
    await page.getByText('Friend · disconnected').waitFor();
    await page.getByRole('button', { name: 'Request to join' }).click();
    const link = page.getByRole('link', { name: 'Join this game' }); await link.waitFor();
    assert.equal(await link.getAttribute('href'), 'index.html?join=ABCDE');
    await page.getByRole('button', { name: 'Refresh' }).click();
    await link.waitFor();
    await page.getByRole('button', { name: 'Close room' }).click();
    await page.getByText('0 active relay games').waitFor();
    assert.equal(closed, true);
    assert.deepEqual(errors, []);
    assert.ok(calls.length >= 4 && calls.every(call => call.authorized), 'every admin API request carries the private passphrase');
    console.log('PASS admin browser: private sign-in, room/host/players, host-approved join link, close, no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
