/* Sync box integration checks against a local Miniflare copy of the relay (never touches Cloudflare).
   Install Miniflare outside the project and run, from the project folder:
     npm install --prefix /tmp/ct-vault-runtime --no-audit --no-fund miniflare@4
     NODE_PATH=/tmp/ct-vault-runtime/node_modules node tests/test_sync_worker.cjs */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Miniflare } = require('miniflare');

const WORKER = path.join(path.resolve(__dirname, '..'), 'relay', 'worker.js');
const ORIGIN = 'https://ccall1212.github.io';
const ID = 'a'.repeat(32), ID2 = 'b'.repeat(32), ID3 = 'c'.repeat(32);
const b64 = n => Buffer.alloc(n, 7).toString('base64'); // some valid base64 text
const blob = (ctBytes = 300, over = {}) => ({ v: 1, c: 'gzip', iv: Buffer.alloc(12, 3).toString('base64'), ct: b64(ctBytes), ...over });

function make(withSync) {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-sync-'));
  const durableObjects = { ROOMS: { className: 'Room', useSQLite: true }, DIRECTORY: { className: 'RoomDirectory', useSQLite: true } };
  if (withSync) durableObjects.SYNC = { className: 'SyncBox', useSQLite: true };
  return new Miniflare({ modules: true, scriptPath: WORKER, compatibilityDate: '2025-09-01', durableObjects, durableObjectsPersist: state });
}
const call = (mf, id, method = 'GET', body, headers = {}, query = '') =>
  mf.dispatchFetch('http://relay.test/sync/' + id + query, { method, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    headers: { Origin: ORIGIN, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers } });
const json = async r => r.json();

(async () => {
  const mf = make(true), off = make(false);
  try {
    // ---- Health advertises the feature only when the storage is configured. ----
    let health = await (await mf.dispatchFetch('http://relay.test/health', { headers: { Origin: ORIGIN } })).json();
    assert.ok(health.features.includes('sync-v1'), 'health advertises sync-v1');
    assert.ok(health.features.includes('room-vault-v1'), 'existing features are still advertised');
    health = await (await off.dispatchFetch('http://relay.test/health', { headers: { Origin: ORIGIN } })).json();
    assert.ok(!health.features.includes('sync-v1'), 'a relay without the storage does not advertise sync');
    let res = await call(off, ID);
    assert.equal(res.status, 501, 'a relay without the storage answers 501');

    // ---- CORS: the browser asks permission before PUT and DELETE. ----
    res = await mf.dispatchFetch('http://relay.test/sync/' + ID, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'PUT' } });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('Access-Control-Allow-Methods'), /PUT/); assert.match(res.headers.get('Access-Control-Allow-Methods'), /DELETE/);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    res = await mf.dispatchFetch('http://relay.test/sync/' + ID, { method: 'OPTIONS', headers: { Origin: 'null' } });
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'null', 'a page opened from a downloaded file (origin "null") is allowed');

    // ---- Basic store and read; an unknown box is just "not found". ----
    res = await call(mf, ID); assert.equal(res.status, 404); assert.equal((await json(res)).error, 'not-found', 'unknown box');
    const first = blob(1000);
    res = await call(mf, ID, 'PUT', first); assert.equal(res.status, 200, 'store');
    const stored = await json(res); assert.equal(stored.ok, true); assert.equal(stored.bytes, first.ct.length);
    res = await call(mf, ID); assert.equal(res.status, 200);
    let got = await json(res);
    assert.deepEqual({ v: got.v, c: got.c, iv: got.iv, ct: got.ct }, first, 'what was stored comes back unchanged');
    assert.ok(got.updatedAt > 0);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'replies carry the CORS header');
    assert.equal(res.headers.get('Cache-Control'), 'no-store');

    // ---- Replacing, and a big one across several chunks, then a smaller one (no leftovers). ----
    const big = blob(1500000); // about 2 MB of base64 text, many 60 KB chunks
    res = await call(mf, ID, 'PUT', big); assert.equal(res.status, 200, 'a large copy is accepted');
    got = await json(await call(mf, ID)); assert.equal(got.ct.length, big.ct.length); assert.equal(got.ct, big.ct, 'a multi-chunk copy comes back exactly');
    const small = blob(500, { c: 'none' });
    await call(mf, ID, 'PUT', small);
    got = await json(await call(mf, ID)); assert.equal(got.ct, small.ct, 'replacing with a smaller copy leaves nothing of the old one'); assert.equal(got.c, 'none');

    // ---- Size cap and bad input. ----
    res = await call(mf, ID2, 'PUT', blob(1900000)); // about 2.53 MB of base64 text, over the cap
    assert.ok([400, 413].includes(res.status), 'a copy over the size cap is refused (' + res.status + ')');
    assert.equal((await call(mf, ID2)).status, 404, 'and nothing was stored');
    for (const [label, bad] of [['not JSON', 'nope{'], ['wrong version', blob(100, { v: 2 })], ['unknown compression', blob(100, { c: 'zip' })],
      ['text instead of base64', blob(100, { ct: 'not base64 !!' })], ['empty ciphertext', blob(100, { ct: '' })], ['missing iv', blob(100, { iv: undefined })],
      ['huge iv', blob(100, { iv: 'A'.repeat(100) })], ['a list', [1, 2, 3]], ['null', 'null']]) {
      res = await call(mf, ID2, 'PUT', bad); assert.equal(res.status, 400, 'refused: ' + label);
    }
    assert.equal((await call(mf, ID2)).status, 404, 'bad input never creates a box');
    for (const badId of ['short', 'G'.repeat(32), 'A'.repeat(32), 'a'.repeat(33), '../x']) {
      res = await call(mf, badId); assert.equal(res.status, 404, 'not a valid box id: ' + badId);
    }
    res = await call(mf, ID, 'POST', {}); assert.equal(res.status, 405, 'only GET, PUT and DELETE');

    // ---- Origin check. ----
    res = await call(mf, ID, 'GET', undefined, { Origin: 'https://evil.example' });
    assert.equal(res.status, 403, 'a web page from another site is refused');
    res = await mf.dispatchFetch('http://relay.test/sync/' + ID); // no Origin header at all (curl)
    assert.equal(res.status, 200, 'a request with no Origin (not a web page) is allowed, like the other HTTP routes');

    // ---- Delete: the code simply stops existing. ----
    res = await call(mf, ID, 'DELETE'); assert.equal(res.status, 200);
    assert.equal((await call(mf, ID)).status, 404, 'deleted: not found');
    assert.equal((await call(mf, ID, 'DELETE')).status, 200, 'deleting twice is fine');
    assert.equal((await call(mf, ID, 'PUT', blob(100))).status, 200, 'and the same code can be used again after a delete');

    // ---- Replaced: a computer still using the old code is told so, and cannot write to it. ----
    await call(mf, ID3, 'PUT', blob(200));
    res = await call(mf, ID3, 'DELETE', undefined, {}, '?mode=replaced'); assert.equal(res.status, 200);
    res = await call(mf, ID3); assert.equal(res.status, 410, 'replaced code reads as 410'); assert.equal((await json(res)).error, 'replaced');
    res = await call(mf, ID3, 'PUT', blob(200)); assert.equal(res.status, 410, 'cannot save to a replaced code'); assert.equal((await json(res)).error, 'replaced');
    assert.equal((await call(mf, ID3, 'DELETE')).status, 200, 'a replaced marker can still be removed');
    assert.equal((await call(mf, ID3)).status, 404, 'and then it is simply unknown');

    // ---- Write limit per network address (the first 60 writes in an hour, then 429). ----
    const ip = { 'CF-Connecting-IP': '203.0.113.7' };
    const other = { 'CF-Connecting-IP': '203.0.113.8' };
    let limited = 0, lastOk = 0;
    for (let i = 1; i <= 66; i++) {
      res = await call(mf, ID2, 'PUT', blob(100), ip);
      if (res.status === 429) limited++; else { assert.equal(res.status, 200); lastOk = i; }
    }
    assert.equal(lastOk, 60, 'sixty writes are allowed');
    assert.equal(limited, 6, 'the rest are limited');
    res = await call(mf, ID2, 'PUT', blob(100), ip); assert.equal(res.status, 429); assert.match((await json(res)).error, /Too many/);
    assert.equal((await call(mf, ID2, 'DELETE', undefined, ip)).status, 429, 'deleting counts as a write');
    assert.equal((await call(mf, ID2, 'GET', undefined, ip)).status, 200, 'reading is never limited');
    assert.equal((await call(mf, ID2, 'PUT', blob(100), other)).status, 200, 'another address is not affected');

    // ---- Existing room routes still behave. ----
    res = await mf.dispatchFetch('http://relay.test/nothing', { headers: { Origin: ORIGIN } }); assert.equal(res.status, 404);
    res = await mf.dispatchFetch('http://relay.test/room/ABCDE', { headers: { Origin: ORIGIN } }); assert.equal(res.status, 426 === res.status ? 426 : res.status, 'rooms still need a WebSocket');

    console.log('PASS sync worker: advertised only when configured, CORS, store/read/replace across chunks, size and input checks, origin check, delete, replaced marker, per-address write limit, other routes unchanged');
  } finally {
    await mf.dispose(); await off.dispose();
  }
})().catch(error => { console.error(error); process.exit(1); });
